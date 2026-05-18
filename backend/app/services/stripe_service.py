"""Stripe Subscriptions 래퍼.

설계:
- API 키 미설정 시 모든 함수가 RuntimeError 를 던지고, 라우터는 503 으로 graceful disable.
- Customer 는 1인 1개 — User.stripe_customer_id 가 없으면 즉시 생성.
- Subscription 상태 동기화는 webhook 가 단일 진실의 원천. 일반 라우터에서는 customer/checkout
  생성만, 상태 전환은 webhook 가 User 행에 반영한다.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import stripe
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models.user import User


def configured() -> bool:
    return bool(get_settings().stripe_secret_key) and bool(get_settings().stripe_price_id)


def _client() -> Any:
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise RuntimeError("STRIPE_SECRET_KEY 가 설정되지 않았습니다.")
    stripe.api_key = settings.stripe_secret_key
    return stripe


async def ensure_customer(db: AsyncSession, user: User) -> str:
    """User 에 stripe_customer_id 가 없으면 생성하고 저장."""
    if user.stripe_customer_id:
        return user.stripe_customer_id
    s = _client()
    cust = s.Customer.create(
        email=user.email,
        name=user.full_name or user.display_name or None,
        metadata={"user_id": str(user.id)},
    )
    user.stripe_customer_id = cust.id
    await db.commit()
    return cust.id


def create_checkout_session(*, customer_id: str, success_url: str, cancel_url: str) -> str:
    """월 정기결제 Checkout Session 을 만들고 url 반환."""
    settings = get_settings()
    s = _client()
    session = s.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": settings.stripe_price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        allow_promotion_codes=True,
        billing_address_collection="auto",
    )
    return session.url


def create_portal_session(*, customer_id: str, return_url: str) -> str:
    """결제 정보 관리 Customer Portal Session."""
    s = _client()
    session = s.billing_portal.Session.create(customer=customer_id, return_url=return_url)
    return session.url


def construct_event(payload: bytes, sig_header: str) -> stripe.Event:
    """Webhook 검증. signing secret 으로 서명 확인 — 실패 시 stripe.error.SignatureVerificationError."""
    settings = get_settings()
    if not settings.stripe_webhook_secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET 가 설정되지 않았습니다.")
    return stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)


async def apply_subscription_event(db: AsyncSession, event: stripe.Event) -> None:
    """Webhook 이벤트를 User 행에 반영. 알 수 없는 이벤트는 무시."""
    etype = event.get("type") or ""
    data = (event.get("data") or {}).get("object") or {}

    if etype.startswith("customer.subscription"):
        customer_id = data.get("customer")
        if not customer_id:
            return
        user = (
            await db.execute(select(User).where(User.stripe_customer_id == customer_id))
        ).scalar_one_or_none()
        if not user:
            logger.warning(f"Stripe webhook: 알 수 없는 customer {customer_id}")
            return

        status = data.get("status")  # active / trialing / past_due / canceled 등
        sub_id = data.get("id")
        cur_period_end = data.get("current_period_end")  # epoch seconds
        expires_at = (
            datetime.fromtimestamp(int(cur_period_end), tz=timezone.utc)
            if cur_period_end
            else None
        )

        user.stripe_subscription_id = sub_id
        user.subscription_status = status

        if status in ("active", "trialing"):
            user.subscription_tier = "paid"
            if expires_at is not None:
                user.subscription_expires_at = expires_at
        elif status in ("canceled", "unpaid", "incomplete_expired"):
            user.subscription_tier = "free"
            user.subscription_expires_at = expires_at or user.subscription_expires_at
        # past_due / incomplete: tier 유지, status 만 갱신

        await db.commit()
        logger.info(
            f"Stripe webhook {etype}: user_id={user.id} tier={user.subscription_tier} status={status}"
        )
        return

    if etype == "invoice.payment_failed":
        customer_id = data.get("customer")
        if not customer_id:
            return
        user = (
            await db.execute(select(User).where(User.stripe_customer_id == customer_id))
        ).scalar_one_or_none()
        if user:
            user.subscription_status = "past_due"
            await db.commit()
            logger.warning(f"Stripe invoice.payment_failed: user_id={user.id}")
