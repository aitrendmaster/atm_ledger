"""Entitlement(이용 권한) 부여·조회 서비스.

LS webhook(lemonsqueezy_service) 와 마이페이지(me 라우터), atmbook 콘텐츠 게이팅
(entitlements 라우터)이 공통으로 쓰는 권한 로직을 한 곳에 모은다.

설계 원칙:
  - grant() 는 멱등 upsert. 같은 (user_id, sku, source_ref) 는 한 행만.
  - 만료 누적: 같은 행을 다시 부여하면 더 늦은 만료로 연장(권한이 깎이지 않음).
  - 권한 판정은 status=active AND (expires_at IS NULL OR expires_at > now).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.entitlement import Entitlement
from ..models.user import User

# 전자책 전체 열람권 — 개별 전자책 SKU 의 상위 권한.
EBOOK_ALL_SKU = "atmbook:all"
MOA_SUBSCRIPTION_SKU = "moa365:subscription"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    """SQLite(dev)는 tz-naive 로 돌려준다 — UTC 로 간주해 aware 비교를 안전하게."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _max_expiry(a: datetime | None, b: datetime | None) -> datetime | None:
    """둘 중 더 강한(늦은) 만료. None 은 영구이므로 가장 강함."""
    if a is None or b is None:
        return None
    return max(_aware(a), _aware(b))


def _is_active(e: Entitlement, now: datetime) -> bool:
    exp = _aware(e.expires_at)
    return e.status == "active" and (exp is None or exp > now)


async def has_entitlement(db: AsyncSession, user_id: int, sku: str) -> bool:
    """user 가 sku(또는 상위 atmbook:all)에 대한 active·미만료 권한을 갖는지."""
    now = _now()
    candidates = [sku]
    if sku.startswith("atmbook:") and sku != EBOOK_ALL_SKU:
        candidates.append(EBOOK_ALL_SKU)  # 전체 열람권이 개별 권한을 포함

    rows = (
        await db.execute(
            select(Entitlement).where(
                Entitlement.user_id == user_id,
                Entitlement.sku.in_(candidates),
                Entitlement.status == "active",
            )
        )
    ).scalars().all()
    return any(_is_active(e, now) for e in rows)


async def list_for_user(db: AsyncSession, user_id: int) -> list[Entitlement]:
    return list(
        (
            await db.execute(
                select(Entitlement)
                .where(Entitlement.user_id == user_id)
                .order_by(Entitlement.granted_at.desc())
            )
        ).scalars().all()
    )


async def grant(
    db: AsyncSession,
    *,
    user_id: int,
    product: str,
    sku: str,
    source: str,
    source_ref: str,
    expires_at: datetime | None,
) -> Entitlement:
    """멱등 upsert. (user_id, sku, source_ref) 가 같으면 기존 행을 active 로 되살리고
    만료를 더 늦은 쪽으로 연장한다. flush 만 하고 commit 은 호출자가 수행."""
    existing = (
        await db.execute(
            select(Entitlement).where(
                Entitlement.user_id == user_id,
                Entitlement.sku == sku,
                Entitlement.source_ref == (source_ref or ""),
            )
        )
    ).scalar_one_or_none()

    if existing is not None:
        existing.status = "active"
        existing.expires_at = _max_expiry(existing.expires_at, expires_at)
        await db.flush()
        return existing

    ent = Entitlement(
        user_id=user_id,
        product=product,
        sku=sku,
        source=source,
        source_ref=source_ref or "",
        status="active",
        expires_at=expires_at,
    )
    db.add(ent)
    await db.flush()
    return ent


async def comp_subscription_until(db: AsyncSession, user_id: int) -> datetime | None:
    """active 한 moa365:subscription comp(cross_grant) 권한 중 가장 늦은 만료. 없으면 None.

    영구(expires_at IS NULL)가 하나라도 있으면 None 을 반환하지 않고 가장 늦은 값을
    찾되, 영구가 있으면 '무기한'을 의미하는 None 을 그대로 반환한다."""
    now = _now()
    rows = (
        await db.execute(
            select(Entitlement).where(
                Entitlement.user_id == user_id,
                Entitlement.sku == MOA_SUBSCRIPTION_SKU,
                Entitlement.source == "cross_grant",
                Entitlement.status == "active",
            )
        )
    ).scalars().all()
    best: datetime | None = None
    found = False
    for e in rows:
        if not _is_active(e, now):
            continue
        found = True
        exp = _aware(e.expires_at)
        if exp is None:
            return None  # 무기한 comp
        if best is None or exp > best:
            best = exp
    return best if found else None


async def current_paid_until(db: AsyncSession, user_id: int) -> datetime:
    """현재 유효한 moa365 유료 만료 기준선(구독 + 기존 comp 중 최댓값). 없으면 now.

    전자책 구매로 주는 comp 6개월을 '기존 만료 뒤에' 쌓기 위한 base. (중복 소모 방지)"""
    now = _now()
    base = now
    user = await db.get(User, user_id)
    sub_exp = _aware(user.subscription_expires_at) if user is not None else None
    if (
        user is not None
        and user.subscription_tier == "paid"
        and sub_exp is not None
        and sub_exp > base
    ):
        base = sub_exp

    comp = await comp_subscription_until(db, user_id)
    if comp is None:
        # comp 가 무기한이거나 없음. 무기한이면 base 유지(추가 누적 의미 없음).
        return base
    if comp > base:
        base = comp
    return base


async def expire_cross_grant(db: AsyncSession, user_id: int, sku: str) -> int:
    """해당 sku 의 cross_grant 권한을 expired 처리. 변경된 행 수 반환. (commit 은 호출자)"""
    rows = (
        await db.execute(
            select(Entitlement).where(
                Entitlement.user_id == user_id,
                Entitlement.sku == sku,
                Entitlement.source == "cross_grant",
                Entitlement.status == "active",
            )
        )
    ).scalars().all()
    for e in rows:
        e.status = "expired"
    await db.flush()
    return len(rows)


async def license_holder(db: AsyncSession, source_ref: str) -> int | None:
    """source_ref(라이선스 해시)로 active 권한을 이미 보유한 user_id. 없으면 None.

    '한 라이선스 = 한 계정' 강제용 — 전역(모든 사용자) 조회."""
    if not source_ref:
        return None
    row = (
        await db.execute(
            select(Entitlement.user_id).where(
                Entitlement.source_ref == source_ref,
                Entitlement.status == "active",
            )
        )
    ).first()
    return row[0] if row else None


async def revoke_by_ref(db: AsyncSession, user_id: int, source_ref: str) -> int:
    """source_ref(주문/구독 ID)로 부여된 권한을 revoke. 환불 처리용. (commit 은 호출자)"""
    if not source_ref:
        return 0
    rows = (
        await db.execute(
            select(Entitlement).where(
                Entitlement.user_id == user_id,
                Entitlement.source_ref == source_ref,
                Entitlement.status == "active",
            )
        )
    ).scalars().all()
    for e in rows:
        e.status = "revoked"
    await db.flush()
    return len(rows)
