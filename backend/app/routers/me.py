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
from ..services import lemonsqueezy_service, toss_service
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
    price_usd_monthly: int  # 표시용 (실제 청구는 KRW)
    price_krw_monthly: int
    # Toss 연동 상태
    provider: str  # toss | none
    toss_configured: bool = False
    toss_client_key: str | None = None  # 프론트 위젯 초기화용 publishable key
    customer_key: str | None = None     # 위젯 requestBillingAuth 에 전달
    subscription_status: str | None = None  # active | past_due | canceled | None
    card_brand: str | None = None
    card_last4: str | None = None
    last_billing_error: str | None = None
    # 베타 기간 무료 모드 — 활성 시 모든 사용자가 유료 권한, UI 는 결제 비활성
    beta_free_mode: bool = False
    # Lemon Squeezy (MoR — 글로벌 카드/페이팔) 연동 상태
    lemonsqueezy_configured: bool = False
    lemonsqueezy_subscription_id: str | None = None
    lemonsqueezy_renews_at: datetime | None = None
    lemonsqueezy_variant_id: str | None = None


def _customer_key_for(user: User) -> str:
    """Toss 가 요구하는 customerKey — 가맹점이 관리. 결정적·고유."""
    return user.toss_customer_key or f"moa-user-{user.id}"


def _billing_status(user: User) -> BillingStatus:
    now = datetime.now(timezone.utc)
    free_trial_ends = (user.created_at or now) + timedelta(days=FREE_TRIAL_DAYS)
    settings = get_settings()
    toss_on = toss_service.configured()
    provider = "toss" if toss_on else "none"
    beta = bool(settings.beta_free_mode)

    ls_on = lemonsqueezy_service.configured()
    common = dict(
        free_trial_ends_at=free_trial_ends,
        price_usd_monthly=PAID_MONTHLY_USD,
        price_krw_monthly=settings.toss_monthly_price_krw,
        provider=provider,
        toss_configured=toss_on,
        toss_client_key=(settings.toss_client_key or None) if toss_on else None,
        customer_key=_customer_key_for(user) if toss_on else None,
        subscription_status=user.subscription_status,
        card_brand=user.toss_card_brand,
        card_last4=user.toss_card_last4,
        last_billing_error=user.last_billing_error,
        beta_free_mode=beta,
        lemonsqueezy_configured=ls_on,
        lemonsqueezy_subscription_id=user.lemonsqueezy_subscription_id,
        lemonsqueezy_renews_at=user.lemonsqueezy_renews_at,
        lemonsqueezy_variant_id=user.lemonsqueezy_variant_id,
    )

    # 베타 기간 무료 — 모든 사용자가 active. 표시되는 tier 는 그대로(`free`)지만
    # active=True 라 _paid_or_trial_active() 가 통과 → 엑셀 등 유료 기능 개방.
    if beta:
        return BillingStatus(
            tier=user.subscription_tier or "free",
            active=True,
            paid_until=None,
            days_remaining=9999,
            **common,
        )

    if user.subscription_tier == "paid" and (
        user.subscription_expires_at is None or user.subscription_expires_at > now
    ):
        paid_until = user.subscription_expires_at
        days = max(0, ((paid_until or now) - now).days) if paid_until else 30
        return BillingStatus(
            tier="paid",
            active=True,
            paid_until=paid_until,
            days_remaining=days,
            **common,
        )
    active = now < free_trial_ends
    days_remaining = max(0, (free_trial_ends - now).days)
    return BillingStatus(
        tier="free",
        active=active,
        paid_until=None,
        days_remaining=days_remaining,
        **common,
    )


@router.get("/billing", response_model=BillingStatus)
async def my_billing(user: User = Depends(get_current_user)):
    return _billing_status(user)


class TossConfirmIn(BaseModel):
    auth_key: str
    customer_key: str


@router.post("/billing/toss/confirm", response_model=BillingStatus)
async def my_billing_toss_confirm(
    body: TossConfirmIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """카드 등록 위젯이 반환한 authKey 를 영구 빌링키로 교환하고 즉시 첫 결제.

    customerKey 는 백엔드가 발급한 결정적 값이어야 함 — 클라이언트가 변조해 보내도
    서버 측 _customer_key_for(user) 와 일치할 때만 통과.
    """
    if get_settings().beta_free_mode:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="현재 베타 기간 동안 무료로 운영되어 결제가 비활성화되어 있습니다.",
        )
    if not toss_service.configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="결제 게이트웨이가 아직 활성화되지 않았습니다.",
        )
    expected_ck = _customer_key_for(user)
    if body.customer_key != expected_ck:
        raise HTTPException(status_code=400, detail="customerKey 가 일치하지 않습니다.")

    # 1) 빌링키 발급
    try:
        bk_resp = await toss_service.issue_billing_key(
            auth_key=body.auth_key, customer_key=expected_ck
        )
    except toss_service.TossError as e:
        raise HTTPException(status_code=400, detail=f"빌링키 발급 실패: {e.message}")

    billing_key = bk_resp.get("billingKey")
    if not billing_key:
        raise HTTPException(status_code=400, detail="빌링키 응답이 비어 있습니다.")

    card = bk_resp.get("card") or {}
    user.toss_customer_key = expected_ck
    user.toss_billing_key = billing_key
    user.toss_card_brand = (card.get("company") or card.get("issuerCode")) or None
    user.toss_card_last4 = ((card.get("number") or "")[-4:]) or None
    user.toss_billing_issued_at = datetime.now(timezone.utc)
    user.last_billing_error = None
    await db.commit()

    # 2) 즉시 첫 결제
    settings = get_settings()
    now = datetime.now(timezone.utc)
    period = now.strftime("%Y%m")
    order_id = toss_service.make_order_id(user.id, period)
    try:
        charge_resp = await toss_service.charge(
            billing_key=billing_key,
            customer_key=expected_ck,
            amount=settings.toss_monthly_price_krw,
            order_id=order_id,
            order_name=settings.toss_monthly_order_name,
        )
    except toss_service.TossError as e:
        user.last_billing_error = f"{e.code}: {e.message[:200]}"
        user.subscription_status = "past_due"
        await db.commit()
        raise HTTPException(status_code=402, detail=f"결제 승인 실패: {e.message}")

    if charge_resp.get("status") != "DONE":
        user.subscription_status = "past_due"
        await db.commit()
        raise HTTPException(
            status_code=402,
            detail=f"결제가 완료되지 않았습니다 (status={charge_resp.get('status')})",
        )

    user.subscription_tier = "paid"
    user.subscription_status = "active"
    user.subscription_expires_at = now + timedelta(days=PAID_MONTHLY_DAYS)
    user.last_billing_error = None
    await db.commit()
    return _billing_status(user)


@router.post("/billing/toss/cancel", response_model=BillingStatus)
async def my_billing_toss_cancel(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """정기결제 해지. 빌링키 폐기 + tier='free'. 남은 기간은 유지하지 않고 즉시 free.

    (Toss 는 별도 빌링키 폐기 API 가 없음 — 가맹점이 자체 폐기. 다음 청구 안 함.)
    """
    user.subscription_tier = "free"
    user.subscription_status = "canceled"
    user.toss_billing_key = None
    user.toss_card_brand = None
    user.toss_card_last4 = None
    user.last_billing_error = None
    await db.commit()
    return _billing_status(user)


# ---------- Lemon Squeezy (MoR) ----------


class LemonSqueezyCheckoutOut(BaseModel):
    url: str
    plan: str  # monthly | yearly  — 실제로 사용된 variant
    expires_at_iso: str | None = None  # LS 체크아웃 세션 만료 (선택)


@router.get(
    "/billing/lemonsqueezy/checkout-url",
    response_model=LemonSqueezyCheckoutOut,
)
async def my_billing_ls_checkout_url(
    plan: str | None = Query(default=None, pattern="^(monthly|yearly)$"),
    user: User = Depends(get_current_user),
):
    """LS 체크아웃 URL 발급 — user_id·email 을 쿼리 파라미터로 사전 주입.

    plan 파라미터:
      - 명시 (monthly|yearly) — 그 variant 로 직접 이동
      - 생략 — 설정된 variant 중 monthly 우선, 없으면 yearly. 두 플랜이 같은 product
        의 다른 variant 라면 LS 페이지에 두 옵션이 함께 노출되므로 단일 버튼 UX 와 호환.

    Flow:
      Frontend  →  GET /me/billing/lemonsqueezy/checkout-url
              ←  { url: "https://atmstore.lemonsqueezy.com/checkout/buy/{variant}?..." }
      Frontend  →  window.location.href = url   (LS 호스팅 결제 페이지로 이동)
      User 결제 완료  →  LS  →  POST /webhooks/lemonsqueezy
                              →  User.subscription_tier = paid 자동 갱신
    """
    if get_settings().beta_free_mode:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="현재 베타 기간 동안 무료로 운영되어 결제가 비활성화되어 있습니다.",
        )
    if not lemonsqueezy_service.configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Lemon Squeezy 결제가 아직 활성화되지 않았습니다.",
        )

    s = get_settings()
    if plan is None:
        # 단일 버튼 UX — 둘 중 설정된 것 우선 (monthly → yearly 순)
        from ..services.lemonsqueezy_service import _normalize_variant_id  # local import
        if _normalize_variant_id(s.lemonsqueezy_variant_id_monthly):
            plan = "monthly"
        elif _normalize_variant_id(s.lemonsqueezy_variant_id_yearly):
            plan = "yearly"
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Lemon Squeezy variant 가 설정되어 있지 않습니다.",
            )

    try:
        url = lemonsqueezy_service.build_checkout_url(user, plan)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return LemonSqueezyCheckoutOut(url=url, plan=plan)


# 레거시 mock 경로 (Toss 미설정 + 개발 폴백) — Toss 활성 시 405 로 차단.
@router.post("/billing/upgrade", response_model=BillingStatus)
async def my_billing_upgrade_mock(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if get_settings().beta_free_mode:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="현재 베타 기간 동안 무료로 운영되어 결제가 비활성화되어 있습니다.",
        )
    if toss_service.configured():
        raise HTTPException(
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
            detail="실 결제가 활성화되어 있습니다. /me/billing/toss/confirm 을 사용하세요.",
        )
    user.subscription_tier = "paid"
    user.subscription_status = "active"
    user.subscription_expires_at = datetime.now(timezone.utc) + timedelta(days=PAID_MONTHLY_DAYS)
    await db.commit()
    return _billing_status(user)


@router.post("/billing/cancel", response_model=BillingStatus)
async def my_billing_cancel_mock(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if toss_service.configured():
        raise HTTPException(
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
            detail="실 결제가 활성화되어 있습니다. /me/billing/toss/cancel 을 사용하세요.",
        )
    user.subscription_tier = "free"
    user.subscription_status = "canceled"
    await db.commit()
    return _billing_status(user)


# ---------- Excel export ----------


def _paid_or_trial_active(user: User) -> bool:
    # _billing_status() 가 베타 모드면 active=True 로 반환하므로 자동 통과.
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
