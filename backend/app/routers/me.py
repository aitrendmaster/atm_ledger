"""마이페이지 전용 라우터 — /me/* (auth router 의 `/auth/me` 와 분리해 정리).

- GET /me/geo         IP 기반 위치 추정. 옵트인된 사용자는 last_geo_* 업데이트.
- GET /me/billing     구독 상태(free trial 만료, paid 유효 등) 계산해서 반환.
- POST /me/billing/upgrade   결제 mock — 실제 결제는 PR-J2.
- POST /me/billing/cancel    유료 → 만료일까지 유지 후 free.
- GET /me/export.xlsx?period=monthly&month=YYYY-MM
- GET /me/export.xlsx?period=annual&year=YYYY
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse

from ..config import get_settings
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_current_user
from ..models.entry import Entry
from ..models.planned import Planned
from ..models.reflection import Reflection
from ..models.user import User
from ..services import stripe_service
from ..services.geo_service import (
    apply_geo_to_user,
    cached_geo_is_fresh,
    client_ip_from_request,
    lookup_ip_geo,
)
from ..services.xlsx_export import build_annual_xlsx, build_monthly_xlsx

router = APIRouter(prefix="/me", tags=["me"])

FREE_TRIAL_DAYS = 30
PAID_MONTHLY_USD = 4
PAID_MONTHLY_DAYS = 30


# ---------- Geo ----------


class GeoOut(BaseModel):
    enabled: bool
    ip: str | None = None
    country: str | None = None
    region: str | None = None
    city: str | None = None
    lat: float | None = None
    lng: float | None = None
    cached: bool = False


@router.get("/geo", response_model=GeoOut)
async def my_geo(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """옵트인 시: 1시간 TTL 캐시된 last_geo_* 반환, 만료면 ipapi.co 재조회.

    옵트인 안 한 사용자: enabled=False, 좌표 미반환.
    """
    if not user.allow_location_metadata:
        return GeoOut(enabled=False)

    if cached_geo_is_fresh(user):
        return GeoOut(
            enabled=True,
            ip=user.last_ip,
            country=user.last_geo_country,
            region=user.last_geo_region,
            city=user.last_geo_city,
            lat=user.last_geo_lat,
            lng=user.last_geo_lng,
            cached=True,
        )

    ip = client_ip_from_request(
        {k.lower(): v for k, v in request.headers.items()},
        fallback=request.client.host if request.client else None,
    )
    geo = await lookup_ip_geo(ip) if ip else None
    if not geo:
        # 조회 실패해도 동의 상태는 유지. 단순히 좌표 없이 응답.
        return GeoOut(enabled=True, ip=ip, cached=False)

    apply_geo_to_user(user, geo)
    await db.commit()
    return GeoOut(
        enabled=True,
        ip=geo.get("ip"),
        country=geo.get("country"),
        region=geo.get("region"),
        city=geo.get("city"),
        lat=geo.get("lat"),
        lng=geo.get("lng"),
        cached=False,
    )


# ---------- Billing (mock) ----------


class BillingStatus(BaseModel):
    tier: str  # free | paid
    active: bool
    free_trial_ends_at: datetime
    paid_until: datetime | None
    days_remaining: int
    price_usd_monthly: int
    # Stripe 연동 상태 — 프론트가 결제 흐름을 선택할 때 사용
    stripe_configured: bool = False
    subscription_status: str | None = None  # trialing | active | past_due | canceled | None


def _billing_status(user: User) -> BillingStatus:
    now = datetime.now(timezone.utc)
    free_trial_ends = (user.created_at or now) + timedelta(days=FREE_TRIAL_DAYS)
    stripe_on = stripe_service.configured()
    if user.subscription_tier == "paid" and (
        user.subscription_expires_at is None or user.subscription_expires_at > now
    ):
        paid_until = user.subscription_expires_at
        days = max(0, ((paid_until or now) - now).days) if paid_until else 30
        return BillingStatus(
            tier="paid",
            active=True,
            free_trial_ends_at=free_trial_ends,
            paid_until=paid_until,
            days_remaining=days,
            price_usd_monthly=PAID_MONTHLY_USD,
            stripe_configured=stripe_on,
            subscription_status=user.subscription_status,
        )
    active = now < free_trial_ends
    days_remaining = max(0, (free_trial_ends - now).days)
    return BillingStatus(
        tier="free",
        active=active,
        free_trial_ends_at=free_trial_ends,
        paid_until=None,
        days_remaining=days_remaining,
        price_usd_monthly=PAID_MONTHLY_USD,
        stripe_configured=stripe_on,
        subscription_status=user.subscription_status,
    )


@router.get("/billing", response_model=BillingStatus)
async def my_billing(user: User = Depends(get_current_user)):
    return _billing_status(user)


class CheckoutUrlOut(BaseModel):
    url: str


@router.post("/billing/checkout", response_model=CheckoutUrlOut)
async def my_billing_checkout(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stripe Checkout Session 을 생성하고 redirect URL 반환.

    Stripe 미설정 시 503 — 프론트는 그 경우 mock upgrade(아래) 노출.
    """
    if not stripe_service.configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="결제 게이트웨이가 아직 활성화되지 않았습니다.",
        )
    settings = get_settings()
    base = settings.frontend_base_url.rstrip("/")
    customer_id = await stripe_service.ensure_customer(db, user)
    url = stripe_service.create_checkout_session(
        customer_id=customer_id,
        success_url=f"{base}/me?billing=success",
        cancel_url=f"{base}/me?billing=cancel",
    )
    return CheckoutUrlOut(url=url)


@router.post("/billing/portal", response_model=CheckoutUrlOut)
async def my_billing_portal(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """결제 정보 관리/해지 — Stripe Customer Portal."""
    if not stripe_service.configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="결제 게이트웨이가 아직 활성화되지 않았습니다.",
        )
    if not user.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="아직 결제를 진행한 적이 없습니다.",
        )
    settings = get_settings()
    url = stripe_service.create_portal_session(
        customer_id=user.stripe_customer_id,
        return_url=f"{settings.frontend_base_url.rstrip('/')}/me?billing=portal",
    )
    return CheckoutUrlOut(url=url)


@router.post("/billing/upgrade", response_model=BillingStatus)
async def my_billing_upgrade(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """**Stripe 미설정 시 한정** — 데모용 즉시 paid 전환. 실 결제 활성 시 405."""
    if stripe_service.configured():
        raise HTTPException(
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
            detail="실 결제가 활성화되어 있습니다. /me/billing/checkout 을 사용하세요.",
        )
    user.subscription_tier = "paid"
    user.subscription_status = "active"
    user.subscription_expires_at = datetime.now(timezone.utc) + timedelta(days=PAID_MONTHLY_DAYS)
    await db.commit()
    return _billing_status(user)


@router.post("/billing/cancel", response_model=BillingStatus)
async def my_billing_cancel(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stripe 활성 시: Portal 로 안내(405). 미설정 시: 데모용 즉시 free 전환."""
    if stripe_service.configured():
        raise HTTPException(
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
            detail="실 결제가 활성화되어 있습니다. /me/billing/portal 을 사용하세요.",
        )
    user.subscription_tier = "free"
    user.subscription_status = "canceled"
    await db.commit()
    return _billing_status(user)


# ---------- Excel export ----------


def _paid_or_trial_active(user: User) -> bool:
    s = _billing_status(user)
    return s.active


@router.get("/export.xlsx")
async def my_export_xlsx(
    period: str = Query(..., pattern="^(monthly|annual)$"),
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    year: str | None = Query(default=None, pattern=r"^\d{4}$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """가계부 내역을 엑셀(.xlsx) 로 다운로드.

    무료 트라이얼 기간(가입 후 30일) 또는 paid 인 동안만 허용 — 명세상 데이터 내보내기는 유료 기능.
    GDPR `/auth/me/export` (JSON) 는 항상 가능 (그것과 별개).
    """
    if not _paid_or_trial_active(user):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="엑셀 내보내기는 유료 플랜에서 제공됩니다.",
        )

    if period == "monthly":
        if not month:
            raise HTTPException(400, "month=YYYY-MM 가 필요합니다.")
        rows = (
            await db.execute(
                select(Entry)
                .where(Entry.user_id == user.id, Entry.date.like(f"{month}%"))
                .order_by(Entry.date.asc())
            )
        ).scalars().all()
        planned = (
            await db.execute(
                select(Planned)
                .where(Planned.user_id == user.id, Planned.date.like(f"{month}%"))
                .order_by(Planned.date.asc())
            )
        ).scalars().all()
        reflections = (
            await db.execute(
                select(Reflection)
                .where(Reflection.user_id == user.id, Reflection.month == month)
            )
        ).scalars().all()
        body = build_monthly_xlsx(
            month=month,
            user_email=user.email,
            entries=list(rows),
            planned=list(planned),
            reflections=list(reflections),
        )
        filename = f"moa-ai-{month}.xlsx"
    else:  # annual
        if not year:
            raise HTTPException(400, "year=YYYY 가 필요합니다.")
        rows = (
            await db.execute(
                select(Entry)
                .where(Entry.user_id == user.id, Entry.date.like(f"{year}-%"))
                .order_by(Entry.date.asc())
            )
        ).scalars().all()
        by_month: dict[str, list[Entry]] = {}
        for e in rows:
            mk = (e.date or "")[:7]
            by_month.setdefault(mk, []).append(e)
        planned = (
            await db.execute(
                select(Planned)
                .where(Planned.user_id == user.id, Planned.date.like(f"{year}-%"))
            )
        ).scalars().all()
        reflections = (
            await db.execute(
                select(Reflection)
                .where(Reflection.user_id == user.id, Reflection.month.like(f"{year}-%"))
            )
        ).scalars().all()
        body = build_annual_xlsx(
            year=year,
            user_email=user.email,
            entries_by_month=by_month,
            planned=list(planned),
            reflections=list(reflections),
        )
        filename = f"moa-ai-{year}.xlsx"

    return StreamingResponse(
        iter([body]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
