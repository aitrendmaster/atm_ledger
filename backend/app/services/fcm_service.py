"""FCM (Firebase Cloud Messaging) 발송 서비스.

- Firebase Admin SDK 지연 import (라이브러리/credentials 미설치 시에도 부팅 가능)
- credentials 미설정 시 graceful disable — 로그만 남기고 return False
- 죽은 토큰 (UNREGISTERED / INVALID_ARGUMENT) 자동 정리
"""
from __future__ import annotations

import base64
import json
from typing import Any

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models.fcm_token import FCMToken

_firebase_initialized = False
_firebase_app = None


def _ensure_firebase_app() -> Any | None:
    """Firebase Admin SDK 초기화 (싱글톤). 실패 시 None 반환."""
    global _firebase_initialized, _firebase_app
    if _firebase_initialized:
        return _firebase_app

    _firebase_initialized = True  # 재시도 방지 — 한 번 실패하면 그대로 둠
    settings = get_settings()
    raw = settings.firebase_credentials_json
    if not raw:
        logger.warning("[FCM] FIREBASE_CREDENTIALS_JSON 미설정 — 푸시 발송 비활성")
        return None

    try:
        # raw JSON 또는 base64 인코딩 두 형식 모두 지원
        text = raw.strip()
        if not text.startswith("{"):
            # base64 디코딩 시도
            text = base64.b64decode(text).decode("utf-8")
        creds_dict = json.loads(text)

        import firebase_admin  # type: ignore
        from firebase_admin import credentials  # type: ignore

        cred = credentials.Certificate(creds_dict)
        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info(
            f"[FCM] Firebase Admin 초기화 완료 (project={creds_dict.get('project_id')})"
        )
        return _firebase_app
    except Exception:
        logger.exception("[FCM] Firebase Admin 초기화 실패 — 푸시 발송 비활성")
        return None


async def _delete_dead_token(db: AsyncSession, token: str) -> None:
    """발송 실패한 토큰을 DB 에서 제거."""
    try:
        res = await db.execute(select(FCMToken).where(FCMToken.token == token))
        row = res.scalar_one_or_none()
        if row:
            await db.delete(row)
            await db.commit()
            logger.info(f"[FCM] 죽은 토큰 정리: token={token[:16]}…")
    except Exception:
        logger.exception("[FCM] 죽은 토큰 정리 실패")


async def send_to_user(
    db: AsyncSession,
    user_id: int,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> int:
    """user_id 의 모든 FCM 토큰으로 발송. 발송 성공 개수 반환."""
    if not _ensure_firebase_app():
        return 0

    res = await db.execute(select(FCMToken).where(FCMToken.user_id == user_id))
    tokens = res.scalars().all()
    if not tokens:
        logger.info(f"[FCM] user={user_id} 등록 토큰 없음")
        return 0

    success = 0
    for t in tokens:
        if await _send_one(db, t.token, title, body, data):
            success += 1
    logger.info(f"[FCM] user={user_id} 발송 {success}/{len(tokens)}")
    return success


async def _send_one(
    db: AsyncSession,
    token: str,
    title: str,
    body: str,
    data: dict[str, str] | None,
) -> bool:
    """단일 토큰으로 발송. 실패 시 죽은 토큰 정리."""
    try:
        from firebase_admin import messaging  # type: ignore

        msg = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            token=token,
            data=data or {},
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    channel_id="moa_default",
                    color="#E07856",  # Moa 강조색
                    sound="default",
                ),
            ),
        )
        msg_id = messaging.send(msg)
        logger.debug(f"[FCM] sent token={token[:16]}… msg_id={msg_id}")
        return True
    except Exception as e:
        err = str(e)
        # 죽은 토큰 정리 (UNREGISTERED / NOT_FOUND / INVALID_ARGUMENT)
        if any(
            kw in err
            for kw in ("UNREGISTERED", "NotRegistered", "NOT_FOUND", "INVALID_ARGUMENT")
        ):
            await _delete_dead_token(db, token)
        else:
            logger.warning(f"[FCM] 발송 실패 token={token[:16]}… err={err}")
        return False
