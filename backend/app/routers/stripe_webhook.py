"""Stripe Webhook 수신 라우터. 인증 헤더 대신 Stripe-Signature 로 검증."""
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
import stripe

from ..database import get_db
from ..services import stripe_service

router = APIRouter(prefix="/webhooks/stripe", tags=["webhooks"])


@router.post("", status_code=status.HTTP_200_OK)
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
    db: AsyncSession = Depends(get_db),
):
    if not stripe_service.configured():
        # 키 미설정이면 webhook 자체를 받지 않음 — 외부 노출 차단.
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE)

    payload = await request.body()
    try:
        event = stripe_service.construct_event(payload, stripe_signature or "")
    except stripe.error.SignatureVerificationError:
        logger.warning("Stripe webhook signature verification failed")
        raise HTTPException(status_code=400, detail="invalid signature")
    except Exception:
        logger.exception("Stripe webhook payload parse failed")
        raise HTTPException(status_code=400, detail="invalid payload")

    try:
        await stripe_service.apply_subscription_event(db, event)
    except Exception:
        logger.exception(f"Stripe webhook 처리 중 오류 type={event.get('type')}")
        # Stripe 에 200 을 돌려주지 않으면 retry 가 폭주하니, 처리 실패도 200 + 내부 로그로.

    return {"received": True}
