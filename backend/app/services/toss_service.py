"""Toss Payments 빌링키 정기결제 래퍼 (REST 직접 호출, Python SDK 없음).

API 문서: https://docs.tosspayments.com/reference

흐름:
1. 프론트가 위젯으로 카드 등록 → success_url 로 authKey + customerKey redirect
2. 백엔드가 issue_billing_key(authKey, customerKey) 호출 → billingKey 응답
3. charge(billingKey, ...) 로 즉시 1회 + 매월 자동 청구

인증: Basic Auth, base64(secret_key + ":")
"""
from __future__ import annotations

import base64
from typing import Any

import httpx
from loguru import logger

from ..config import get_settings

API_BASE = "https://api.tosspayments.com"


def configured() -> bool:
    s = get_settings()
    return bool(s.toss_secret_key) and bool(s.toss_client_key)


def _auth_header() -> dict[str, str]:
    secret = get_settings().toss_secret_key
    if not secret:
        raise RuntimeError("TOSS_SECRET_KEY 가 설정되지 않았습니다.")
    encoded = base64.b64encode((secret + ":").encode("utf-8")).decode("ascii")
    return {
        "Authorization": f"Basic {encoded}",
        "Content-Type": "application/json",
    }


class TossError(Exception):
    """Toss API 호출 실패. code/message 노출."""

    def __init__(self, code: str, message: str, http_status: int = 400):
        self.code = code
        self.message = message
        self.http_status = http_status
        super().__init__(f"[{code}] {message}")


async def _post(path: str, body: dict[str, Any]) -> dict[str, Any]:
    url = f"{API_BASE}{path}"
    async with httpx.AsyncClient(timeout=20.0, headers=_auth_header()) as cli:
        r = await cli.post(url, json=body)
    try:
        data = r.json()
    except Exception:
        data = {"code": "UNKNOWN", "message": r.text[:200]}
    if r.status_code >= 400:
        logger.warning(f"Toss API {path} {r.status_code}: {data}")
        raise TossError(
            code=str(data.get("code") or "HTTP_ERROR"),
            message=str(data.get("message") or "Toss 호출 실패"),
            http_status=r.status_code,
        )
    return data


async def issue_billing_key(*, auth_key: str, customer_key: str) -> dict[str, Any]:
    """카드 등록 위젯이 받은 authKey 를 영구 빌링키로 교환.

    응답: {billingKey, customerKey, authenticatedAt, method, card: {company, number, …}, …}
    """
    return await _post(
        "/v1/billing/authorizations/issue",
        {"authKey": auth_key, "customerKey": customer_key},
    )


async def charge(
    *,
    billing_key: str,
    customer_key: str,
    amount: int,
    order_id: str,
    order_name: str,
) -> dict[str, Any]:
    """빌링키로 결제 승인. orderId 가 동일하면 idempotent — Toss 가 동일 응답.

    응답: {paymentKey, orderId, status: 'DONE'|'CANCELED'|…, totalAmount, approvedAt, card, …}
    """
    return await _post(
        f"/v1/billing/{billing_key}",
        {
            "customerKey": customer_key,
            "amount": amount,
            "orderId": order_id,
            "orderName": order_name,
        },
    )


async def cancel_payment(*, payment_key: str, reason: str) -> dict[str, Any]:
    """단일 결제 취소(환불) — 빌링키 자체는 유지."""
    return await _post(
        f"/v1/payments/{payment_key}/cancel",
        {"cancelReason": reason},
    )


def make_order_id(user_id: int, period: str) -> str:
    """월별 결제 idempotency 키. 같은 사용자·같은 YYYYMM 은 한 번만 청구."""
    return f"moa-sub-{user_id}-{period}"
