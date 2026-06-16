"""Entitlement (이용 권한) 모델 — moa365 ↔ atmbook 통합 계정의 교차 권한 저장소.

User.subscription_* 컬럼은 "moa365 가계부 유료 여부" 하나만 표현한다. 그런데
atmbook 전자책은 SKU 별로 계속 늘어나고(1 사용자 : N 권한), moa365 구독자에게
전자책 열람권을, 전자책 구매자에게 moa365 무료 기간을 교차로 부여해야 한다.
이 1:N·다종 권한을 담기 위해 User 컬럼 확장이 아니라 별도 테이블을 둔다.

SKU 컨벤션:
  moa365:subscription   가계부 유료 이용권(구독 or 교차지급 comp)
  atmbook:all           전자책 전체 카탈로그 열람권(구독자 교차부여)
  atmbook:book-001 ...   개별 전자책 1권

source:
  purchase       직접 구매(LS order/subscription)
  cross_grant    교차 지급(구독→전자책, 전자책→가계부 comp)
  admin / beta   운영자 지급 / 베타

멱등성: (user_id, sku, source_ref) UNIQUE — LS webhook 재시도가 와도 중복 부여 방지.
"""
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Entitlement(Base):
    __tablename__ = "entitlements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    product: Mapped[str] = mapped_column(String(16), nullable=False)  # "moa365" | "atmbook"
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    source: Mapped[str] = mapped_column(String(24), nullable=False)  # purchase | cross_grant | admin | beta
    # LS order_id / subscription_id / "license:..." — 멱등 키. 없으면 빈 문자열.
    source_ref: Mapped[str] = mapped_column(
        String(96), nullable=False, default="", server_default=""
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="active", server_default="active"
    )  # active | expired | revoked
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # None = 영구(개별 전자책 등). 값이 있으면 그 시각 이후 만료.
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "sku", "source_ref", name="uq_entitlement_user_sku_ref"),
        Index("ix_entitlement_user_sku", "user_id", "sku"),
    )
