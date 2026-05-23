"""FCM 푸시 토큰 등록·해제 + 관리자 테스트 발송 라우터.

엔드포인트:
- POST   /me/push-token              FCM 토큰 upsert (로그인 직후 호출)
- DELETE /me/push-token              FCM 토큰 삭제 (로그아웃 시 호출 권장)
- POST   /admin/push-test            관리자 전용 — 본인에게 테스트 알림 발송

토큰은 디바이스 고유라서 unique constraint (uq_fcm_token). 같은 토큰을 다른 user 가
재등록하면 user_id 만 갱신 (앱 새 계정 로그인).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_admin_user, get_current_user
from ..models.fcm_token import FCMToken
from ..models.user import User
from ..services.fcm_service import send_to_user

router = APIRouter(prefix="/me", tags=["push"])
admin_router = APIRouter(prefix="/admin", tags=["push-admin"])


class PushTokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=512)
    platform: str = Field(default="android", pattern="^(android|ios|web)$")
    device_info: str | None = Field(default=None, max_length=255)


class PushTokenOut(BaseModel):
    ok: bool
    id: int
    platform: str


@router.post("/push-token", response_model=PushTokenOut)
async def upsert_push_token(
    body: PushTokenIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """현재 user 의 FCM 토큰 등록/갱신."""
    res = await db.execute(select(FCMToken).where(FCMToken.token == body.token))
    existing = res.scalar_one_or_none()

    if existing:
        # 토큰은 그대로지만 user 가 바뀌었거나 device_info 갱신
        existing.user_id = user.id
        existing.platform = body.platform
        if body.device_info:
            existing.device_info = body.device_info
        await db.commit()
        await db.refresh(existing)
        return PushTokenOut(ok=True, id=existing.id, platform=existing.platform)

    new_token = FCMToken(
        user_id=user.id,
        token=body.token,
        platform=body.platform,
        device_info=body.device_info,
    )
    db.add(new_token)
    await db.commit()
    await db.refresh(new_token)
    logger.info(f"[FCM] 토큰 등록: user={user.id} platform={body.platform}")
    return PushTokenOut(ok=True, id=new_token.id, platform=new_token.platform)


class DeleteIn(BaseModel):
    token: str = Field(min_length=10, max_length=512)


@router.delete("/push-token")
async def delete_push_token(
    body: DeleteIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """현재 user 의 토큰 삭제. 로그아웃 또는 알림 거부 시 호출."""
    res = await db.execute(
        select(FCMToken).where(
            FCMToken.token == body.token, FCMToken.user_id == user.id
        )
    )
    row = res.scalar_one_or_none()
    if not row:
        # 이미 없거나 다른 user 의 토큰 — 아무것도 안 함 (idempotent)
        return {"ok": True}
    await db.delete(row)
    await db.commit()
    return {"ok": True}


class TestSendIn(BaseModel):
    title: str = Field(default="Moa 테스트", max_length=80)
    body: str = Field(default="푸시 알림이 정상 작동합니다 🎉", max_length=200)


@admin_router.post("/push-test")
async def admin_push_test(
    body: TestSendIn,
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """관리자 전용 — 본인에게 테스트 푸시 발송. Firebase 설정 검증용."""
    sent = await send_to_user(db, user.id, body.title, body.body, data={"type": "test"})
    if sent == 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="발송 실패 — Firebase 미설정 또는 토큰 없음. /me/push-token 으로 토큰 먼저 등록.",
        )
    return {"ok": True, "sent": sent}
