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
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models.user import User
from . import entitlement_service


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

# 단건 주문(전자책) — atmbook 통합 스토어에서 발생.
EVENT_ORDER_CREATED = "order_created"
EVENT_ORDER_REFUNDED = "order_refunded"
EVENT_SUBSCRIPTION_REFUNDED = "subscription_payment_refunded"
ORDER_EVENTS = {EVENT_ORDER_CREATED}
REFUND_EVENTS = {EVENT_ORDER_REFUNDED, EVENT_SUBSCRIPTION_REFUNDED}

# 교차 권한 SKU
EBOOK_ALL_SKU = entitlement_service.EBOOK_ALL_SKU
MOA_SUBSCRIPTION_SKU = entitlement_service.MOA_SUBSCRIPTION_SKU


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


def _order_variant_id(attrs: dict[str, Any]) -> str:
    """order_created 페이로드에서 구매한 variant_id 추출 후 정규화.

    LS order 객체는 first_order_item.variant_id 에 구매 변형을 담는다."""
    foi = attrs.get("first_order_item") or {}
    vid = foi.get("variant_id") or attrs.get("variant_id")
    return _normalize_variant_id(str(vid)) if vid else ""


async def handle_event(
    payload: dict[str, Any],
    db: AsyncSession,
) -> dict[str, Any]:
    """LS webhook 페이로드 처리. 200 으로 ack 하되 에러는 로깅만 한다 (LS 가 무한 재시도 방지).

    처리 분기:
      A) 구독 이벤트  → User.subscription_* 갱신 + atmbook:all 교차 부여/만료
      B) order_created → 전자책 권한(영구) + moa365 N개월 무료 comp 교차 부여
      C) 환불 이벤트   → 해당 주문/구독으로 부여한 권한 revoke

    Returns: 처리 결과 요약 (테스트/디버깅용).
    """
    event_name = payload.get("meta", {}).get("event_name")
    if not event_name:
        return {"ok": False, "reason": "missing event_name"}

    if event_name not in SUBSCRIPTION_EVENTS and event_name not in ORDER_EVENTS and event_name not in REFUND_EVENTS:
        logger.info(f"LS event 무시: {event_name}")
        return {"ok": True, "event": event_name, "handled": False}

    user_id = _extract_user_id(payload)
    if user_id is None:
        # 비로그인 결제 등 — 부여 대상 불명. 운영자가 email 로 사후 매칭해야 함.
        logger.warning(f"LS event {event_name} 에 custom_data.user_id 누락 — 미귀속(보류)")
        return {"ok": False, "reason": "missing user_id", "event": event_name}

    user = await db.get(User, user_id)
    if user is None:
        logger.warning(f"LS event {event_name} user_id={user_id} 사용자 없음")
        return {"ok": False, "reason": "user not found", "event": event_name}

    data = payload.get("data") or {}
    attrs = data.get("attributes") or {}

    # ── A) 구독 이벤트 ──────────────────────────────────────────────
    if event_name in SUBSCRIPTION_EVENTS:
        subscription_id = data.get("id")
        if subscription_id:
            user.lemonsqueezy_subscription_id = str(subscription_id)
        customer_id = attrs.get("customer_id")
        if customer_id:
            user.lemonsqueezy_customer_id = str(customer_id)

        _apply_attrs(user, attrs, event_name)

        # 교차 부여: 구독 활성이면 atmbook 전체 열람권, 만료면 회수.
        if event_name == EVENT_SUBSCRIPTION_EXPIRED or (attrs.get("status") or "").lower() == "expired":
            await entitlement_service.expire_cross_grant(db, user_id, EBOOK_ALL_SKU)
        elif user.subscription_tier == "paid":
            await entitlement_service.grant(
                db,
                user_id=user_id,
                product="atmbook",
                sku=EBOOK_ALL_SKU,
                source="cross_grant",
                source_ref=str(subscription_id or ""),
                expires_at=user.subscription_expires_at,  # 구독 만료와 동기화(갱신 시 롤링)
            )

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

    # ── B) 단건 주문(전자책) ─────────────────────────────────────────
    if event_name in ORDER_EVENTS:
        s = get_settings()
        order_id = str(data.get("id") or "")

        # 환불/무효 상태로 들어온 주문은 권한 부여하지 않음(백필·재전송 방어).
        order_status = (attrs.get("status") or "").lower()
        if order_status in ("refunded", "partial_refund", "void"):
            logger.info(f"LS order_created status={order_status} — 부여 생략 order={order_id}")
            return {"ok": True, "event": event_name, "handled": False, "status": order_status}

        # 방어적 검증: 주문 이메일과 계정 이메일 불일치 시 경고(차단은 안 함 — 서명은 이미 통과).
        order_email = (attrs.get("user_email") or "").lower()
        if order_email and user.email and order_email != user.email.lower():
            logger.warning(
                f"LS order {order_id}: custom_data.user_id={user_id} 의 이메일({user.email})과 "
                f"주문 이메일({order_email}) 불일치 — 검토 필요"
            )

        variant_id = _order_variant_id(attrs)
        sku = s.ls_variant_sku.get(variant_id)
        if not sku:
            logger.info(f"LS order_created: 매핑 없는 variant={variant_id} — 무시")
            return {"ok": True, "event": event_name, "handled": False, "variant_id": variant_id}

        # ① 전자책 영구 권한
        await entitlement_service.grant(
            db, user_id=user_id, product="atmbook", sku=sku,
            source="purchase", source_ref=order_id, expires_at=None,
        )
        # ② 교차 지급: moa365 N개월 무료 comp — 기존 유료/comp 만료 뒤에 누적(상한 적용).
        months = int(s.ebook_cross_grant_months or 0)
        result: dict[str, Any] = {"ok": True, "event": event_name, "sku": sku, "comp_months": months}
        if months > 0:
            now = datetime.now(timezone.utc)
            base = await entitlement_service.current_paid_until(db, user_id)
            comp_until = base + timedelta(days=30 * months)
            # 누적 상한: 반복 구매로 무한 적립되는 것을 방지(기존 권한은 깎지 않음).
            cap_months = int(s.ebook_cross_grant_max_months or 0)
            if cap_months > 0:
                cap_until = now + timedelta(days=30 * cap_months)
                comp_until = max(base, min(comp_until, cap_until))
            await entitlement_service.grant(
                db, user_id=user_id, product="moa365", sku=MOA_SUBSCRIPTION_SKU,
                source="cross_grant", source_ref=order_id, expires_at=comp_until,
            )
            result["comp_until"] = comp_until.isoformat()

        await db.commit()
        logger.info(f"LS order {order_id} → {sku} 영구 + moa365 {months}개월 comp (user={user_id})")
        return result

    # ── C) 환불 ──────────────────────────────────────────────────────
    if event_name in REFUND_EVENTS:
        # order_refunded 의 data.id = order_id(전자책 부여 source_ref).
        # subscription_payment_refunded 의 data.id = payment_id 라 구독 cross_grant 와 안 맞으므로
        # attrs.subscription_id / attrs.order_id 도 후보로 모아 모두 회수한다.
        candidates = {
            str(data.get("id") or ""),
            str(attrs.get("subscription_id") or ""),
            str(attrs.get("order_id") or ""),
        }
        revoked = 0
        for ref in candidates:
            if ref:
                revoked += await entitlement_service.revoke_by_ref(db, user_id, ref)
        await db.commit()
        logger.info(f"LS {event_name} 환불 처리 user_id={user_id} refs={candidates} revoked={revoked}")
        return {"ok": True, "event": event_name, "revoked": revoked}

    return {"ok": True, "event": event_name, "handled": False}
