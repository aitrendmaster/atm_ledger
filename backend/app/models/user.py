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
    # 구독: free | paid (PR-J2 에서 실 결제 게이트웨이 연결). free 만료 = 가입 후 30일.
    subscription_tier: Mapped[str] = mapped_column(
        String(16), default="free", nullable=False, server_default="free"
    )
    subscription_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Stripe 정기결제 — webhook 가 동기화. 미연동 시 NULL 유지(레거시 free/paid 그대로).
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    # trialing | active | past_due | canceled | unpaid | incomplete | NULL
    subscription_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
