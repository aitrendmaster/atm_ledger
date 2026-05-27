from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(20), default="password", nullable=False)
    provider_sub: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    monthly_income: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    monthly_budget: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 지역화 (사용자 명시 선택값 — last_geo_country 는 IP 추정값이라 별개)
    country_code: Mapped[str] = mapped_column(
        String(2), default="KR", nullable=False, server_default="KR"
    )
    currency_code: Mapped[str] = mapped_column(
        String(3), default="KRW", nullable=False, server_default="KRW"
    )
    locale: Mapped[str] = mapped_column(
        String(10), default="ko", nullable=False, server_default="ko"
    )
    # 구독: free | paid (PR-J2 에서 실 결제 게이트웨이 연결). free 만료 = 가입 후 30일.
    subscription_tier: Mapped[str] = mapped_column(
        String(16), default="free", nullable=False, server_default="free"
    )
    subscription_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Stripe 레거시 컬럼 — 한국 사업자 가입 불가로 PR-J2-rev 에서 Toss 로 교체.
    # drop 비용 회피 위해 컬럼만 유지(데이터 미사용).
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    # active | past_due | canceled | NULL — Toss 가 재사용.
    subscription_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Toss Payments 빌링키 — 카드 1회 등록 후 매월 자동 청구에 사용.
    toss_customer_key: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    toss_billing_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    toss_card_brand: Mapped[str | None] = mapped_column(String(32), nullable=True)
    toss_card_last4: Mapped[str | None] = mapped_column(String(8), nullable=True)
    # 빌링키 발급/갱신 시각, 마지막 결제 실패 사유
    toss_billing_issued_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_billing_error: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Lemon Squeezy (MoR, 글로벌 카드/페이팔). subscription_tier/status/expires_at 는 Toss 와 공유.
    # 사용자가 LS 체크아웃에서 결제하면 webhook 이 아래 ID 들을 채우고 tier=paid 로 승격.
    lemonsqueezy_customer_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    lemonsqueezy_subscription_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    # 현재 구독 중인 LS variant — 어떤 플랜(monthly/yearly)에 가입했는지 식별.
    lemonsqueezy_variant_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # LS 가 다음 갱신 시각을 webhook 으로 전달 — Toss subscription_expires_at 와 별도 보관
    # 해 plan 변경/취소 시 충돌 없이 LS 상태만 추적.
    lemonsqueezy_renews_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # FCM 예산 초과 알림 중복 방지 — YYYY-MM 형식. 같은 달 두 번 발송 방지.
    last_budget_breach_month: Mapped[str | None] = mapped_column(String(7), nullable=True)
    # 개인정보: 위치 메타데이터(도시/지역) 를 AI 가 제품 경험 개선용으로 사용해도 되는지.
    allow_location_metadata: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="0"
    )
    # IP 지오로케이션 캐시 — 페이지 진입 시 최신화. 가계부 장소 검색의 default 좌표로 사용.
    last_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_geo_country: Mapped[str | None] = mapped_column(String(80), nullable=True)
    last_geo_region: Mapped[str | None] = mapped_column(String(80), nullable=True)
    last_geo_city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    last_geo_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_geo_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_geo_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # 운영용. ADMIN_EMAILS 부트스트랩으로 채워지며 admin UI 에서 토글 가능.
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="0")
    # Soft delete. NULL 이면 활성, 값이 있으면 비활성 (로그인 차단, admin 목록에서 제외).
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # 이메일 인증 — 신규 가입 시 false, 토큰 검증 통과하면 true. 미인증 계정은 로그인 차단 (봇 방어).
    # Alembic 마이그레이션에서 기존 사용자는 일괄 true 로 backfill (기존 운영자/테스터 UX 보존).
    email_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="0"
    )
    # 토큰은 SHA-256 해시로 저장 (DB 노출 시 원본 토큰 비공개). 비교는 hashlib.sha256(token).
    email_verification_token: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    email_verification_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
