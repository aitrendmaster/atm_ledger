"""Lemon Squeezy webhook 수신.

LS 는 raw body 에 HMAC-SHA256 서명을 X-Signature 헤더로 전송한다.
JSON 파싱 후 재인코딩하면 서명이 깨지므로 raw bytes 로 검증한 뒤 파싱한다.

LS retry 정책: 200 이 아니면 최대 3회 재시도 (지수 backoff). 비즈니스 실패는
200 + 로그만 (이미 받은 이벤트라 재시도 의미 없음). 서명 검증 실패만 401.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Header, HTTPException, Request, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from ..database import get_db
from ..services import lemonsqueezy_service

router = APIRouter(prefix="/webhooks/lemonsqueezy", tags=["webhooks"])


@router.post("", status_code=status.HTTP_200_OK)
async def lemonsqueezy_webhook(
    request: Request,
    x_signature: str | None = Header(default=None, alias="X-Signature"),
    db: AsyncSession = Depends(get_db),
):
    """Lemon Squeezy 이벤트 수신.

    Flow:
      1) raw body 읽기 (서명 검증용)
      2) X-Signature HMAC-SHA256 검증 — 실패 시 401
      3) JSON 파싱 후 service.handle_event() 위임
      4) 항상 200 (LS 무한 재시도 방지) — 실패는 로그만
    """
    if not lemonsqueezy_service.configured():
        # LS 미설정이면 webhook 도 비활성화 — 403 (의도적 미사용)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Lemon Squeezy is not configured on this deployment.",
        )

    raw = await request.body()

    if not lemonsqueezy_service.verify_signature(raw, x_signature):
        logger.warning("LS webhook 서명 검증 실패 — 401 반환")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature.",
        )

    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception as e:
        logger.warning(f"LS webhook payload JSON 파싱 실패: {e}")
        # 200 로 ack — 재시도 의미 없음
        return {"ok": False, "reason": "invalid json"}

    try:
        result = await lemonsqueezy_service.handle_event(payload, db)
        return result
    except Exception:
        logger.exception("LS webhook 핸들러에서 예외 발생 — 200 반환")
        return {"ok": False, "reason": "handler error"}
