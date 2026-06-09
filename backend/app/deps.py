from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .database import get_db
from .models.user import User
from .security import decode_token


async def get_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="wrong token type")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="no sub")
    res = await db.execute(select(User).where(User.id == int(user_id)))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
    if user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="account disabled")
    return user


def is_admin_email(email: str) -> bool:
    """ENV 화이트리스트 기준 admin 여부 — 부트스트랩/UI 미사용 시 fallback. 운영 판정은 User.is_admin."""
    return (email or "").lower() in get_settings().admin_email_set


def is_admin(user: User) -> bool:
    """현행 판정 함수. DB 컬럼이 truth source. ENV 화이트리스트는 부트스트랩 시드로만 사용."""
    return bool(user.is_admin)


async def get_admin_user(user: User = Depends(get_current_user)) -> User:
    """관리자 권한 필요한 엔드포인트용 의존성."""
    if not is_admin(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin only")
    return user


# 무료 체험 기간 (가입 후 N일). me.py 의 FREE_TRIAL_DAYS 와 동일하게 유지.
FREE_TRIAL_DAYS = 31


def _plan_active(user: User) -> bool:
    """유료/무료 트라이얼 활성 여부 — 외부 의존(entitlement comp) 없이 자체 판정.

    me.py._billing_status 의 active 산정과 동일한 기준(베타·paid·트라이얼)을 쓰되,
    교차지급(comp)은 제외(별도 통합 작업 범위). 결제·구독 흐름과 분리해 순환참조 없음.
    """
    settings = get_settings()
    if settings.beta_free_mode:
        return True
    now = datetime.now(timezone.utc)
    if user.subscription_tier == "paid" and (
        user.subscription_expires_at is None or user.subscription_expires_at > now
    ):
        return True
    created = user.created_at or now
    return now < created + timedelta(days=FREE_TRIAL_DAYS)


async def require_active_plan(user: User = Depends(get_current_user)) -> User:
    """무료 체험(가입 후 31일) 만료 시 402 로 차단하는 의존성.

    채팅/AI/기록 등 모든 쓰기 동작에 적용 → 만료된 free 사용자는 잠금.
    조회(GET)는 이 의존성을 쓰지 않으므로 읽기 전용 열람은 그대로 가능.
    관리자(is_admin)·베타 무료 모드·유료·트라이얼 활성은 통과.
    """
    if is_admin(user):
        return user
    if not _plan_active(user):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="무료 체험 기간이 종료되었습니다. 계속 이용하려면 결제가 필요합니다.",
        )
    return user
