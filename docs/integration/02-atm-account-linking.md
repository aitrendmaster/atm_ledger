# D2 — 통합 계정 + Entitlement 설계 & 운영 방침

> **목적**: moa365 ↔ atmbook 회원을 하나의 "ATM 통합 계정"으로 묶고, 결제에 따라 상호 서비스 이용 권한(Entitlement)을 자동 부여하는 데이터 모델과 운영 규칙을 정의한다.
>
> 기준 코드: `atm-ledger/backend/app/`
> 관련 문서: [D1 인증 매뉴얼](01-moa365-auth-manual.md) · [D3 LS 웹훅 교차부여](03-lemonsqueezy-cross-grant.md) · [D4 atmbook 통합](04-atmbook-integration.md)

---

## 1. 설계 원칙

1. **단일 신원(Single Identity)** — moa365 백엔드의 `users` 테이블이 두 서비스의 유일한 계정 저장소. atmbook은 별도 계정 DB를 만들지 않는다.
2. **권한과 결제의 분리** — "무엇을 이용할 수 있는가(Entitlement)"를 "어떻게 결제했는가(구독/단건)"와 분리한다. 교차 부여·관리자 지급·번들이 모두 같은 Entitlement로 표현된다.
3. **권위 서버 단일화** — 결제 → 권한 부여 규칙은 오직 moa365 백엔드의 LS 웹훅 핸들러 한 곳에서 강제한다(클라이언트 신뢰 금지).
4. **멱등성** — LS 웹훅은 재시도되므로 모든 부여는 멱등(같은 결제 이벤트는 한 번만 반영).

---

## 2. 신규 데이터 모델 — `entitlements` 테이블

atmbook 전자책이 SKU별로 계속 늘어나므로(1 사용자 : N 권한), User 컬럼 확장이 아니라 **별도 테이블**을 신설한다.

```python
# app/models/entitlement.py  (신규 — 참조 구현)
from datetime import datetime
from sqlalchemy import DateTime, Integer, String, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class Entitlement(Base):
    __tablename__ = "entitlements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    product: Mapped[str] = mapped_column(String(16), nullable=False)   # "moa365" | "atmbook"
    sku: Mapped[str] = mapped_column(String(64), nullable=False)       # "moa365:subscription" | "atmbook:all" | "atmbook:book-001"
    source: Mapped[str] = mapped_column(String(24), nullable=False)    # "purchase" | "cross_grant" | "admin" | "beta"
    source_ref: Mapped[str] = mapped_column(String(96), nullable=False, default="")  # LS order_id / subscription_id (멱등 키)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")  # "active" | "expired" | "revoked"
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # None = 영구

    __table_args__ = (
        # 같은 결제(source_ref)로 같은 sku 를 중복 부여하지 않도록 — 멱등성의 핵심
        UniqueConstraint("user_id", "sku", "source_ref", name="uq_entitlement_user_sku_ref"),
        Index("ix_entitlement_user_sku", "user_id", "sku"),
    )
```

> Alembic 마이그레이션 1개 추가(`alembic revision --autogenerate -m "add entitlements"`). 앱 부팅 시 lifespan 의 마이그레이션 단계에서 자동 적용.

---

## 3. SKU 컨벤션

| SKU | product | 의미 |
|-----|---------|------|
| `moa365:subscription` | moa365 | 가계부 유료 이용권(구독 또는 교차 지급 comp) |
| `atmbook:all` | atmbook | 전자책 **전체 카탈로그** 열람권 (moa365 구독자에게 교차 부여) |
| `atmbook:book-001` | atmbook | 개별 전자책 1권 (예: ₩22,000 상품) |
| `atmbook:book-002` … | atmbook | 향후 추가되는 개별 전자책 (각자 가격·SKU) |

규칙:
- 개별 전자책 권한은 `atmbook:book-XXX`.
- 전체 열람권 `atmbook:all` 은 개별 권한들의 **상위 권한**(있으면 모든 책 열람).
- 향후 "라이브러리 패스"도 `atmbook:all` 의 유료판으로 표현 가능(소스만 `purchase`).

---

## 4. 권한 판정 헬퍼

```python
# app/services/entitlement_service.py  (신규 — 참조 구현)
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.entitlement import Entitlement


async def has_entitlement(db: AsyncSession, user_id: int, sku: str) -> bool:
    """user 가 sku(또는 상위 atmbook:all)에 대한 active·미만료 권한을 갖는지."""
    now = datetime.now(timezone.utc)
    candidates = [sku]
    if sku.startswith("atmbook:") and sku != "atmbook:all":
        candidates.append("atmbook:all")   # 전체 열람권이 개별 권한을 포함

    rows = (await db.execute(
        select(Entitlement).where(
            Entitlement.user_id == user_id,
            Entitlement.sku.in_(candidates),
            Entitlement.status == "active",
        )
    )).scalars().all()

    for e in rows:
        if e.expires_at is None or e.expires_at > now:
            return True
    return False


async def grant(
    db: AsyncSession, *, user_id: int, product: str, sku: str,
    source: str, source_ref: str, expires_at: datetime | None,
) -> Entitlement:
    """멱등 upsert. (user_id, sku, source_ref) 가 같으면 기존 레코드 갱신.

    이미 미래 만료의 같은 sku active 권한이 있으면 expires_at 을 그 뒤로 'append'
    (중복 결제로 권한이 깎이지 않도록 — 6개월 comp 누적 등)."""
    existing = (await db.execute(
        select(Entitlement).where(
            Entitlement.user_id == user_id,
            Entitlement.sku == sku,
            Entitlement.source_ref == source_ref,
        )
    )).scalar_one_or_none()

    if existing:
        existing.status = "active"
        existing.expires_at = _max_expiry(existing.expires_at, expires_at)
        return existing

    ent = Entitlement(
        user_id=user_id, product=product, sku=sku,
        source=source, source_ref=source_ref or "", status="active",
        expires_at=expires_at,
    )
    db.add(ent)
    return ent


def _max_expiry(a, b):
    if a is None or b is None:
        return None  # None = 영구 → 더 강한 권한
    return max(a, b)
```

---

## 5. 교차 권한 규칙 (운영 방침의 핵심)

| 트리거 결제 | 부여 SKU | source | 만료(expires_at) |
|---|---|---|---|
| moa365 **월** 구독 활성/갱신 | `atmbook:all` | `cross_grant` | = `user.subscription_expires_at` (구독 갱신마다 롤링 연장) |
| moa365 **연** 구독 활성/갱신 | `atmbook:all` | `cross_grant` | = `user.subscription_expires_at` (≈ now + 365d) |
| atmbook **₩22,000 전자책** 구매 | ① `atmbook:book-001` (영구) ② `moa365:subscription` (comp) | `purchase` / `cross_grant` | ① 영구(None) ② **now + 6개월** |
| atmbook **개별 전자책** 구매 | `atmbook:book-XXX` | `purchase` | 영구(None) |

> 월/연 분기는 LS `variant_id` 로 판별(= `lemonsqueezy_variant_id_monthly` / `_yearly` 설정값과 비교). 구체 매핑·핸들러는 [D3](03-lemonsqueezy-cross-grant.md).

### 5-1. comp(무료 지급) 구독 처리 — `BillingStatus.active` 보강

현재 `app/routers/me.py` 의 `_billing_status()` 는 "베타 모드 → active", "tier==paid & 미만료 → active", "트라이얼 기간 → active" 만 본다. **여기에 comp Entitlement 판정을 추가**한다.

```python
# app/routers/me.py — _billing_status() 보강 (참조 diff)
# 기존 베타/paid 분기 '앞'에 comp 권한 체크 추가:

#   comp 구독: atmbook 구매로 받은 moa365:subscription cross_grant 권한
if await has_entitlement(db, user.id, "moa365:subscription"):
    # 결제 정보(Toss/LS) 없이도 유료 기능 개방. 자동청구는 하지 않음.
    return BillingStatus(
        tier="paid",
        active=True,
        paid_until=_comp_until(db, user.id),   # 해당 entitlement 의 expires_at
        days_remaining=...,                    # (paid_until - now).days
        **common,
    )
```

> `_billing_status()` 가 동기 함수이므로, 비동기 `has_entitlement` 를 쓰려면 호출부(`my_billing`, `_paid_or_trial_active`)를 async 로 바꾸고 `db` 를 주입한다. 또는 comp 여부를 미리 조회해 인자로 전달한다. (구현 단계 결정사항)
> comp 기간 동안은 **Toss/LS 자동결제 청구를 하지 않는다**(billing_key 미발급 상태이므로 `subscription_scheduler` 가 자연히 건너뜀).

### 5-2. 구독 만료 시 교차 권한 동기화
moa365 구독이 `subscription_expired` 로 떨어지면, 같은 사용자의 `atmbook:all` (source=`cross_grant`) 권한도 `status="expired"` 처리한다(D3 웹훅 핸들러에서 동시 수행).

---

## 6. 엔드포인트 — `/entitlements/*` (신규)

```python
# app/routers/entitlements.py  (신규 — 참조 구현)
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..deps import get_current_user
from ..models.user import User
from ..models.entitlement import Entitlement
from ..services.entitlement_service import has_entitlement

router = APIRouter(prefix="/entitlements", tags=["entitlements"])


@router.get("/check")
async def check(
    sku: str = Query(..., min_length=3),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """atmbook 콘텐츠 게이팅용. JWT 로 인증된 사용자가 sku 권한을 갖는지."""
    return {"sku": sku, "granted": await has_entitlement(db, user.id, sku)}


@router.get("/me")
async def my_entitlements(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """사용자의 전체 권한 목록(마이페이지·복구 화면용)."""
    rows = (await db.execute(
        select(Entitlement).where(Entitlement.user_id == user.id)
    )).scalars().all()
    return [
        {"sku": e.sku, "product": e.product, "status": e.status,
         "source": e.source, "expires_at": e.expires_at}
        for e in rows
    ]
```

> `app/main.py` 에 `app.include_router(entitlements.router)` 등록.

---

## 7. 엣지 케이스 & 운영 규칙

| 케이스 | 처리 |
|--------|------|
| **비로그인 구매** | LS `custom_data.user_id` 가 없어 부여 대상 불명. → atmbook 체크아웃 진입 전 **로그인 강제**(D4). 백업: LS `customer email` 로 기존 계정 사후 매칭 후 부여. 매칭 실패분은 운영자 대시보드에 "미귀속 결제"로 적재. |
| **이미 유료 구독 중 + 전자책 구매** | 6개월 comp `moa365:subscription` 의 `expires_at` 을 **현 만료일 뒤에 append**(`_max_expiry`). 기존 유료 기간이 깎이지 않음. |
| **환불 / `subscription_refunded`** | 해당 `source_ref` 권한 `status="revoked"`. |
| **구독 취소(말일까지 유지)** | 권한 즉시 회수하지 않음. `expires_at` 까지 유지 후 `subscription_expired` 시 만료. |
| **atmbook 기존 구매자 마이그레이션** | 현재 atmbook은 기기별 localStorage HMAC 토큰이라 "누가 샀는지" 정보가 없음. → 통합 계정 전환 후 **라이선스 키 입력 → 계정 귀속** 폼 제공(D4 §5). LS `/v1/licenses/validate` 로 키 유효성 확인 후 `atmbook:book-001` 부여. |
| **계정 삭제(soft delete)** | `users.deleted_at` 설정. 권한은 FK CASCADE 또는 조회 시 `deleted_at IS NULL` 게이트로 차단. |

---

## 8. 상태 전이 시나리오 (검증용)

| # | 시나리오 | 결과 entitlement / billing |
|---|----------|---------------------------|
| ① | moa365 **월** 구독 신규 결제 | `moa365:subscription`(구독, 기존 컬럼) + `atmbook:all`(cross_grant, expires=구독만료) → atmbook 즉시 열람 |
| ② | atmbook **₩22,000** 구매(로그인 상태) | `atmbook:book-001`(영구) + `moa365:subscription`(cross_grant, +6개월) → moa365 유료 기능 6개월 개방 |
| ③ | moa365 구독 **만료**(`subscription_expired`) | `subscription_tier=free` + `atmbook:all` → `expired`. 단, `purchase` 로 산 개별 책 권한은 유지 |
| ④ | **비로그인** atmbook 구매 | 부여 보류 → email 매칭 시도 → 실패 시 운영자 미귀속 큐 |
| ⑤ | 유료 구독 중 atmbook 구매 | comp 6개월을 현 만료일 뒤에 append (중복 소모 없음) |

→ 이 표는 [D3](03-lemonsqueezy-cross-grant.md)의 이벤트 매핑과 1:1 대응해야 한다(상호 검증).
