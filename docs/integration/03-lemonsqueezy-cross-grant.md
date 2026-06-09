# D3 — 단일 Lemon Squeezy 스토어 교차 권한 부여 구현 가이드

> **목적**: 하나로 통합한 Lemon Squeezy 스토어의 웹훅을 moa365 백엔드에서 처리해, 구독·전자책 결제에 따라 [D2](02-atm-account-linking.md)의 Entitlement를 자동 부여하는 구현 가이드.
>
> 기준 코드: `atm-ledger/backend/app/services/lemonsqueezy_service.py`, `app/routers/lemonsqueezy_webhook.py`
> 관련 문서: [D2 Entitlement 설계](02-atm-account-linking.md) · [D4 atmbook 통합](04-atmbook-integration.md)

---

## 1. 스토어 구성: 단일 스토어로 통합

현재:
- atmbook → `atmstore.lemonsqueezy.com`, 전자책 variant `b6a94278-8844-4725-ac83-c9b3afccda8c` (₩22,000), 라이선스 키 발급 + 자체 검증.
- moa365 → `lemonsqueezy_store_slug` 의 구독 product, variant monthly/yearly.

**개편**: 두 상품을 **하나의 LS 스토어**에 모은다. 장점:
- 웹훅 엔드포인트 1개(`POST /webhooks/lemonsqueezy`)에서 모든 결제 이벤트 처리.
- `custom_data.user_id` 로 모든 구매를 통합 계정에 귀속.
- 번들 상품("전자책+6개월")을 한 스토어 안에서 구성 가능.

스토어에 둘 상품:
| 상품 | variant | 타입 | 설정 env |
|------|---------|------|----------|
| moa365 구독(월) | monthly variant | subscription | `LEMONSQUEEZY_VARIANT_ID_MONTHLY` |
| moa365 구독(연) | yearly variant | subscription | `LEMONSQUEEZY_VARIANT_ID_YEARLY` |
| atmbook 전자책 #1 | book-001 variant | one-time + license key | `LEMONSQUEEZY_VARIANT_EBOOK_001` (신규) |
| (향후) 전자책 #2… | book-XXX variant | one-time | variant→sku 매핑에 추가 |

---

## 2. variant → SKU 매핑 설정

전자책이 늘어날 때 **코드 수정 없이 설정만 추가**하도록 매핑 테이블을 둔다.

```python
# app/config.py 에 추가 (참조)
class Settings(BaseSettings):
    # ... 기존 LS 설정 ...
    # variant_id : sku  매핑 (전자책 등 단건 상품). "변형UUID=sku" 콤마 구분.
    # 예: "b6a94278-...=atmbook:book-001,77ff...=atmbook:book-002"
    lemonsqueezy_variant_sku_map: str = ""

    @property
    def ls_variant_sku(self) -> dict[str, str]:
        out = {}
        for pair in (self.lemonsqueezy_variant_sku_map or "").split(","):
            pair = pair.strip()
            if "=" in pair:
                vid, sku = pair.split("=", 1)
                out[vid.strip()] = sku.strip()
        return out
```

| env (신규) | 예시 값 |
|------|--------|
| `LEMONSQUEEZY_VARIANT_SKU_MAP` | `b6a94278-8844-4725-ac83-c9b3afccda8c=atmbook:book-001` |
| `EBOOK_CROSS_GRANT_MONTHS` | `6` (전자책 구매 시 moa365 무료 개월) |

> 월/연 구독 variant는 이미 `lemonsqueezy_variant_id_monthly` / `_yearly` 로 식별되므로 매핑에 넣지 않아도 된다.

---

## 3. 웹훅 처리할 이벤트

현재 `lemonsqueezy_service.py` 의 `SUBSCRIPTION_EVENTS` 는 `subscription_*` 만 처리한다(`order_created` 는 `"LS event 무시"` 로그 후 종료). **확장 대상**:

| LS 이벤트 | 처리 |
|-----------|------|
| `subscription_created` / `subscription_payment_success` | 구독 갱신(기존) + `atmbook:all` 교차 부여(월/연 분기) |
| `subscription_expired` | 구독 free 강등(기존) + `atmbook:all` 만료 동기화 |
| `subscription_cancelled` / `_paused` 등 | 기존 로직 유지(만료 시각까지 권한 유지) |
| **`order_created`** (신규) | variant→sku 로 전자책 식별 → `atmbook:book-XXX` 부여 + `moa365:subscription` 6개월 comp |
| **`subscription_refunded` / `order_refunded`** (신규) | 해당 `source_ref` 권한 `revoke` |
| `license_key_created` (옵션) | 라이선스 키 ↔ user 매핑 저장(복구용) |

---

## 4. 서명 검증 (기존 재사용)

`verify_signature()` 는 그대로 사용. **raw body** 에 HMAC-SHA256(hex), `X-Signature` 헤더 비교.

```python
# app/services/lemonsqueezy_service.py (기존 — 변경 없음)
def verify_signature(body: bytes, signature_header: str | None) -> bool:
    if not signature_header:
        return False
    secret = get_settings().lemonsqueezy_webhook_secret
    if not secret:
        return False
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)
```

> LS 대시보드에서 통합 스토어의 단일 웹훅을 `https://api.moa365.com/webhooks/lemonsqueezy` 로 설정하고, 모든 이벤트(subscription_*, order_*, license_key_*)를 구독. 시크릿은 `LEMONSQUEEZY_WEBHOOK_SECRET` 동일 사용.

---

## 5. `handle_event` 확장 (참조 구현)

기존 `handle_event` 는 `if event_name not in SUBSCRIPTION_EVENTS: return ...무시` 에서 멈춘다. 아래처럼 **분기를 추가**한다.

```python
# app/services/lemonsqueezy_service.py — 확장 (참조 diff)

from datetime import timedelta, timezone
from ..services.entitlement_service import grant
from ..models.entitlement import Entitlement
from sqlalchemy import select

ORDER_EVENTS = {"order_created"}
REFUND_EVENTS = {"order_refunded", "subscription_refunded"}


async def handle_event(payload: dict, db: AsyncSession) -> dict:
    event_name = payload.get("meta", {}).get("event_name")
    if not event_name:
        return {"ok": False, "reason": "missing event_name"}

    user_id = _extract_user_id(payload)        # meta.custom_data.user_id (기존 함수)
    if user_id is None:
        logger.warning(f"LS {event_name}: custom_data.user_id 누락 — 미귀속 큐로")
        return {"ok": False, "reason": "missing user_id", "event": event_name}

    user = await db.get(User, user_id)
    if user is None:
        return {"ok": False, "reason": "user not found", "event": event_name}

    data = payload.get("data") or {}
    attrs = data.get("attributes") or {}

    # ── A) 구독 이벤트 (기존 로직 + 교차 부여) ──────────────────
    if event_name in SUBSCRIPTION_EVENTS:
        subscription_id = data.get("id")
        if subscription_id:
            user.lemonsqueezy_subscription_id = str(subscription_id)
        if attrs.get("customer_id"):
            user.lemonsqueezy_customer_id = str(attrs["customer_id"])

        _apply_attrs(user, attrs, event_name)   # 기존 함수 — tier/status/expires 갱신

        # 교차 부여: 구독 활성이면 atmbook:all, 만료면 회수
        if event_name == EVENT_SUBSCRIPTION_EXPIRED or (attrs.get("status") == "expired"):
            await _expire_cross_grant(db, user_id, "atmbook:all")
        elif user.subscription_tier == "paid":
            await grant(
                db, user_id=user_id, product="atmbook", sku="atmbook:all",
                source="cross_grant", source_ref=str(subscription_id or ""),
                expires_at=user.subscription_expires_at,   # 구독 만료와 동기화
            )
        await db.commit()
        return {"ok": True, "event": event_name, "tier": user.subscription_tier}

    # ── B) 단건 주문 (전자책) ───────────────────────────────────
    if event_name in ORDER_EVENTS:
        s = get_settings()
        order_id = str(data.get("id") or "")
        variant_id = _order_variant_id(attrs)            # 아래 헬퍼
        sku = s.ls_variant_sku.get(variant_id)
        if not sku:
            logger.info(f"LS order_created: 매핑 없는 variant={variant_id} — 무시")
            return {"ok": True, "event": event_name, "handled": False}

        # ① 전자책 영구 권한
        await grant(db, user_id=user_id, product="atmbook", sku=sku,
                    source="purchase", source_ref=order_id, expires_at=None)

        # ② 교차 지급: moa365 N개월 무료 comp
        #   이미 유료/comp 기간이 남아 있으면 그 '뒤에' 쌓는다(중복 소모 방지, D2 시나리오 ⑤).
        months = int(getattr(s, "ebook_cross_grant_months", 6) or 6)
        base = await _current_paid_until(db, user_id)     # 현재 유효 만료(없으면 now)
        comp_until = base + timedelta(days=30 * months)
        await grant(db, user_id=user_id, product="moa365", sku="moa365:subscription",
                    source="cross_grant", source_ref=order_id, expires_at=comp_until)

        await db.commit()
        logger.info(f"LS order {order_id} → {sku} 영구 + moa365 {months}개월 comp (user={user_id})")
        return {"ok": True, "event": event_name, "sku": sku, "comp_months": months}

    # ── C) 환불 ────────────────────────────────────────────────
    if event_name in REFUND_EVENTS:
        ref = str(data.get("id") or "")
        await _revoke_by_ref(db, user_id, ref)
        await db.commit()
        return {"ok": True, "event": event_name, "revoked_ref": ref}

    logger.info(f"LS event 무시: {event_name}")
    return {"ok": True, "event": event_name, "handled": False}


def _order_variant_id(attrs: dict) -> str:
    """order_created 페이로드의 first_order_item.variant_id 추출."""
    foi = attrs.get("first_order_item") or {}
    vid = foi.get("variant_id") or attrs.get("variant_id")
    return _normalize_variant_id(str(vid)) if vid else ""


async def _expire_cross_grant(db: AsyncSession, user_id: int, sku: str) -> None:
    rows = (await db.execute(
        select(Entitlement).where(
            Entitlement.user_id == user_id, Entitlement.sku == sku,
            Entitlement.source == "cross_grant", Entitlement.status == "active",
        )
    )).scalars().all()
    for e in rows:
        e.status = "expired"


async def _current_paid_until(db: AsyncSession, user_id: int) -> datetime:
    """현재 유효한 moa365 유료 만료 시각(구독 expires_at + 기존 comp 중 최댓값). 없으면 now.

    comp 를 '기존 만료 뒤에 쌓기' 위한 기준선. 구독(users.subscription_expires_at)과
    기존 moa365:subscription comp entitlement 를 모두 본다."""
    now = datetime.now(timezone.utc)
    base = now
    user = await db.get(User, user_id)
    if user and user.subscription_tier == "paid" and user.subscription_expires_at and user.subscription_expires_at > base:
        base = user.subscription_expires_at
    rows = (await db.execute(
        select(Entitlement).where(
            Entitlement.user_id == user_id, Entitlement.sku == "moa365:subscription",
            Entitlement.source == "cross_grant", Entitlement.status == "active",
        )
    )).scalars().all()
    for e in rows:
        if e.expires_at and e.expires_at > base:
            base = e.expires_at
    return base


async def _revoke_by_ref(db: AsyncSession, user_id: int, source_ref: str) -> None:
    rows = (await db.execute(
        select(Entitlement).where(
            Entitlement.user_id == user_id, Entitlement.source_ref == source_ref,
        )
    )).scalars().all()
    for e in rows:
        e.status = "revoked"
```

> `_extract_user_id`, `_apply_attrs`, `_normalize_variant_id` 는 **기존 함수 그대로** 재사용.

---

## 6. 멱등성

- `grant()` 가 `(user_id, sku, source_ref)` UNIQUE 제약으로 upsert → LS 재시도가 와도 중복 부여 안 됨.
- comp 6개월은 `_max_expiry` 로 기존 만료 뒤에 append → 같은 주문 재처리 시 만료가 더 밀리지 않음(같은 `source_ref` 라 같은 레코드 갱신).
- 웹훅 라우터는 항상 200을 반환(서명 불일치만 401)하여 LS 무한 재시도 방지(기존 동작 유지).

---

## 7. 웹훅 라우터 (기존 + 확장 포인트)

```python
# app/routers/lemonsqueezy_webhook.py (기존 구조)
@router.post("/webhooks/lemonsqueezy", status_code=200)
async def ls_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.body()                       # raw bytes (서명용 — 필수)
    sig = request.headers.get("X-Signature")
    if not lemonsqueezy_service.verify_signature(body, sig):
        raise HTTPException(status_code=401, detail="invalid signature")
    payload = json.loads(body)
    result = await lemonsqueezy_service.handle_event(payload, db)   # ← 확장된 핸들러
    return result
```
변경 없음(핸들러 내부만 확장). 단, `order_*` / `license_key_*` 이벤트를 LS 대시보드 웹훅 구독 목록에 **추가 체크**해야 백엔드로 전달된다.

---

## 8. 체크아웃 URL — user_id 주입 (기존 패턴 재사용)

구독은 이미 `build_checkout_url()` 이 `checkout[custom][user_id]` 를 주입한다. **전자책 체크아웃도 동일 패턴**을 써야 교차 부여가 동작한다(D4에서 atmbook 프론트가 주입).

```python
# 기존 build_checkout_url() — 구독용
params = {
    "checkout[email]": user.email,
    "checkout[custom][user_id]": str(user.id),   # ← webhook meta.custom_data.user_id
}
base = f"https://{s.lemonsqueezy_store_slug}.lemonsqueezy.com/checkout/buy/{variant_id}"
return f"{base}?{urlencode(params)}"
```

전자책용 헬퍼(참조):
```python
def build_ebook_checkout_url(user: User, variant_id: str) -> str:
    s = get_settings()
    params = {"checkout[email]": user.email, "checkout[custom][user_id]": str(user.id)}
    base = f"https://{s.lemonsqueezy_store_slug}.lemonsqueezy.com/checkout/buy/{_normalize_variant_id(variant_id)}"
    return f"{base}?{urlencode(params)}"
```

---

## 9. 테스트 절차

```
1) 로컬: uvicorn app.main:app --reload  (LS env 설정: API_KEY/WEBHOOK_SECRET/STORE_SLUG/VARIANT_*)
2) LS 대시보드 → Webhooks → Send test → 'order_created' (custom_data.user_id 포함)
   또는 ngrok 으로 로컬 노출 후 실제 테스트 결제(테스트 모드)
3) 확인:
   - entitlements 테이블에 atmbook:book-001(영구) + moa365:subscription(+6개월) 2행 생성
   - GET /me/billing → active=true, tier=paid (comp 반영)
   - GET /entitlements/check?sku=atmbook:book-001 → granted=true
4) 'subscription_expired' 테스트 → atmbook:all 이 expired 로, 개별 book 권한은 active 유지 확인
5) 'order_refunded' 재전송 → 해당 source_ref 권한 revoked 확인
```
