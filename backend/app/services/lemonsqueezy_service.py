"""Lemon Squeezy (Merchant of Record) 통합 — 글로벌 카드/페이팔 결제.

Toss(KRW 즉시 카드) 와 병존. 사용자가 결제 페이지에서 통화/방법에 따라 선택.

핵심 흐름:
  1) 프론트 'Premium' 버튼  →  GET /me/billing/lemonsqueezy/checkout-url?plan=monthly|yearly
  2) 백엔드가 user_id + email 을 쿼리에 담은 LS 체크아웃 URL 반환
  3) 사용자 LS 결제 완료  →  LS 가 POST /webhooks/lemonsqueezy 로 이벤트 전송
  4) signature 검증 후 User.lemonsqueezy_* 필드 갱신 + subscription_tier=paid

LS 미설정(빈 env vars) 이면 configured()=False — 엔드포인트가 503 반환.
"""
from __future__ import annotations

import hashlib
import hmac
from datetime import datetime
from typing import Any
from urllib.parse import urlencode

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models.user import User


# 사용자에게 노출할 플랜 식별자
PLAN_MONTHLY = "monthly"
PLAN_YEARLY = "yearly"
ALLOWED_PLANS = {PLAN_MONTHLY, PLAN_YEARLY}


# LS event_name 매핑. 핸들링 안 하는 이벤트는 무시 (LS 가 retry 안 함, 200 만 응답).
EVENT_SUBSCRIPTION_CREATED = "subscription_created"
EVENT_SUBSCRIPTION_UPDATED = "subscription_updated"
EVENT_SUBSCRIPTION_CANCELLED = "subscription_cancelled"
EVENT_SUBSCRIPTION_RESUMED = "subscription_resumed"
EVENT_SUBSCRIPTION_EXPIRED = "subscription_expired"
EVENT_SUBSCRIPTION_PAUSED = "subscription_paused"
EVENT_SUBSCRIPTION_UNPAUSED = "subscription_unpaused"
EVENT_PAYMENT_SUCCESS = "subscription_payment_success"
EVENT_PAYMENT_FAILED = "subscription_payment_failed"
EVENT_PAYMENT_RECOVERED = "subscription_payment_recovered"

SUBSCRIPTION_EVENTS = {
    EVENT_SUBSCRIPTION_CREATED,
    EVENT_SUBSCRIPTION_UPDATED,
    EVENT_SUBSCRIPTION_CANCELLED,
    EVENT_SUBSCRIPTION_RESUMED,
    EVENT_SUBSCRIPTION_EXPIRED,
    EVENT_SUBSCRIPTION_PAUSED,
    EVENT_SUBSCRIPTION_UNPAUSED,
    EVENT_PAYMENT_SUCCESS,
    EVENT_PAYMENT_FAILED,
    EVENT_PAYMENT_RECOVERED,
}


def configured() -> bool:
    """LS 필수 env 4개 모두 설정되었는지. 하나라도 비면 graceful disable."""
    s = get_settings()
    return bool(
        s.lemonsqueezy_api_key
        and s.lemonsqueezy_webhook_secret
        and s.lemonsqueezy_store_slug
        and (s.lemonsqueezy_variant_id_monthly or s.lemonsqueezy_variant_id_yearly)
    )


def verify_signature(body: bytes, signature_header: str | None) -> bool:
    """LS webhook X-Signature 검증 (HMAC-SHA256, hex). 시크릿 미설정 시 항상 False.

    LS 는 raw request body 에 HMAC-SHA256 을 적용한 hex 다이제스트를 헤더로 전송한다.
    JSON 파싱 후 다시 인코딩하면 공백·키 순서가 달라져 서명이 깨지므로 raw bytes 가 필수.
    """
    if not signature_header:
        return False
    secret = get_settings().lemonsqueezy_webhook_secret
    if not secret:
        return False
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


def _normalize_variant_id(value: str) -> str:
    """env 값이 UUID 만 들어있든, 전체 체크아웃 URL 이 통째로 들어있든 UUID 만 추출.

    예) 'b5d0282a-...'           → 그대로
        'https://...buy/abc-..'  → 'abc-...'
        '/checkout/buy/abc?x=1'  → 'abc'
    """
    value = (value or "").strip()
    for marker in ("/checkout/buy/", "/buy/"):
        if marker in value:
            value = value.rsplit(marker, 1)[-1]
            break
    # 쿼리 파라미터·트레일링 슬래시 제거
    value = value.split("?", 1)[0].rstrip("/")
    return value


def build_checkout_url(user: User, plan: str) -> str:
    """LS 체크아웃 URL 생성. user_id 를 custom_data 에 담아 webhook 에서 사용자 매칭.

    plan = "monthly" | "yearly". 해당 variant 가 설정 안 됐으면 ValueError.

    URL 파라미터 (LS 공식):
      checkout[email]=...               — 이메일 사전 입력
      checkout[custom][user_id]=...     — webhook meta.custom_data.user_id 로 반환됨
      checkout[discount_code]=...       — (선택) 할인 코드
    """
    if plan not in ALLOWED_PLANS:
        raise ValueError(f"unknown plan: {plan}")

    s = get_settings()
    raw = (
        s.lemonsqueezy_variant_id_monthly if plan == PLAN_MONTHLY else s.lemonsqueezy_variant_id_yearly
    )
    variant_id = _normalize_variant_id(raw)
    if not variant_id:
        raise ValueError(f"variant id for plan={plan} is not configured")
    if not s.lemonsqueezy_store_slug:
        raise ValueError("lemonsqueezy_store_slug is not configured")

    params = {
        "checkout[email]": user.email,
        "checkout[custom][user_id]": str(user.id),
    }
    base = f"https://{s.lemonsqueezy_store_slug}.lemonsqueezy.com/checkout/buy/{variant_id}"
    return f"{base}?{urlencode(params)}"


# ---------- 이벤트 처리 ----------


def _parse_iso(value: str | None) -> datetime | None:
    """LS 의 ISO8601 타임스탬프 ('2026-06-25T12:00:00.000000Z') → tz-aware datetime."""
    if not value:
        return None
    try:
        # Python 3.11+ 는 'Z' 직접 처리 못 함 — '+00:00' 으로 치환.
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        logger.warning(f"LS 타임스탬프 파싱 실패: {value}")
        return None


def _extract_user_id(payload: dict[str, Any]) -> int | None:
    """meta.custom_data.user_id → int. 체크아웃 URL 의 custom 파라미터로 주입됨."""
    try:
        raw = payload.get("meta", {}).get("custom_data", {}).get("user_id")
        return int(raw) if raw is not None else None
    except (TypeError, ValueError):
        return None


def _apply_attrs(user: User, attrs: dict[str, Any], event_name: str) -> None:
    """LS subscription attrs 를 User 필드로 매핑.

    LS status:        → User.subscription_status :  User.subscription_tier
      active                active                   paid
      on_trial              active                   paid (트라이얼도 paid 권한 부여)
      paused                canceled                 paid (renews_at 까지 유지)
      past_due              past_due                 paid (결제 재시도 중)
      cancelled             canceled                 paid (renews_at 까지)
      unpaid                past_due                 paid
      expired               canceled                 free  ← 유일하게 free 로 강등
    """
    status = (attrs.get("status") or "").lower()
    cancelled_flag = bool(attrs.get("cancelled"))
    renews_at = _parse_iso(attrs.get("renews_at"))
    ends_at = _parse_iso(attrs.get("ends_at"))

    status_map = {
        "active": "active",
        "on_trial": "active",
        "paused": "canceled",
        "past_due": "past_due",
        "cancelled": "canceled",
        "unpaid": "past_due",
        "expired": "canceled",
    }
    user.subscription_status = status_map.get(status, status or None)

    # tier 결정
    if event_name == EVENT_SUBSCRIPTION_EXPIRED or status == "expired":
        user.subscription_tier = "free"
    else:
        user.subscription_tier = "paid"

    # LS 고유 필드
    user.lemonsqueezy_renews_at = renews_at
    user.lemonsqueezy_variant_id = str(attrs.get("variant_id")) if attrs.get("variant_id") else user.lemonsqueezy_variant_id

    # subscription_expires_at — 사용자에게 보여줄 만료 시각. LS 의 경우:
    #   - 정상 갱신: renews_at (다음 결제일까지 유료)
    #   - cancelled but 활성: ends_at (실제 종료일)
    user.subscription_expires_at = ends_at or renews_at

    # 결제 실패 사유
    if event_name == EVENT_PAYMENT_FAILED:
        user.last_billing_error = "Lemon Squeezy payment failed"
    elif event_name in (EVENT_PAYMENT_SUCCESS, EVENT_PAYMENT_RECOVERED):
        user.last_billing_error = None

    if cancelled_flag and event_name != EVENT_SUBSCRIPTION_EXPIRED:
        # 취소되었지만 아직 ends_at 까지는 유료. status 는 canceled, tier 는 paid 유지.
        pass


async def handle_event(
    payload: dict[str, Any],
    db: AsyncSession,
) -> dict[str, Any]:
    """LS webhook 페이로드 처리. 200 으로 ack 하되 에러는 로깅만 한다 (LS 가 무한 재시도 방지).

    Returns: 처리 결과 요약 (테스트/디버깅용).
    """
    event_name = payload.get("meta", {}).get("event_name")
    if not event_name:
        return {"ok": False, "reason": "missing event_name"}

    if event_name not in SUBSCRIPTION_EVENTS:
        logger.info(f"LS event 무시: {event_name}")
        return {"ok": True, "event": event_name, "handled": False}

    user_id = _extract_user_id(payload)
    if user_id is None:
        logger.warning(f"LS event {event_name} 에 custom_data.user_id 누락 — 무시")
        return {"ok": False, "reason": "missing user_id", "event": event_name}

    user = await db.get(User, user_id)
    if user is None:
        logger.warning(f"LS event {event_name} user_id={user_id} 사용자 없음")
        return {"ok": False, "reason": "user not found", "event": event_name}

    data = payload.get("data") or {}
    attrs = data.get("attributes") or {}
    subscription_id = data.get("id")

    if subscription_id:
        user.lemonsqueezy_subscription_id = str(subscription_id)
    customer_id = attrs.get("customer_id")
    if customer_id:
        user.lemonsqueezy_customer_id = str(customer_id)

    _apply_attrs(user, attrs, event_name)
    await db.commit()

    logger.info(
        f"LS {event_name} 처리 user_id={user_id} tier={user.subscription_tier} "
        f"status={user.subscription_status} renews_at={user.lemonsqueezy_renews_at}"
    )
    return {
        "ok": True,
        "event": event_name,
        "user_id": user_id,
        "tier": user.subscription_tier,
        "status": user.subscription_status,
    }
