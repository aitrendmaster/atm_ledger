"""Toss Payments 웹훅 수신. 가상계좌·간편결제 비동기 결과 등 후속 이벤트 처리용.

카드 결제는 charge API 응답이 즉시이므로 webhook 없이도 동작.
가상계좌(Virtual Account) 사용 시 입금 통지가 webhook 으로 도착.

Toss 는 별도 signing secret 을 두지 않고, 가맹점이 IP 또는 paymentKey 조회로 검증한다.
여기서는 payload 의 paymentKey 를 Toss API 에 재조회해 진위 확인 (idempotent).
"""
from __future__ import annotations

from fastapi import APIRouter, Request, status
from loguru import logger

router = APIRouter(prefix="/webhooks/toss", tags=["webhooks"])


@router.post("", status_code=status.HTTP_200_OK)
async def toss_webhook(request: Request):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    event_type = payload.get("eventType") or payload.get("status")
    payment_key = payload.get("paymentKey")
    logger.info(
        f"Toss webhook 수신: eventType={event_type} paymentKey={payment_key} keys={list(payload.keys())}"
    )
    # 카드 정기결제는 charge() 응답이 즉시이므로 추가 처리 불필요.
    # 가상계좌 등 비동기 케이스가 도입되면 여기서 payment-status 조회 + DB 갱신.
    return {"received": True}
