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
