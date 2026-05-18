from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(20), default="password", nullable=False)
    provider_sub: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    monthly_income: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    monthly_budget: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 운영용. ADMIN_EMAILS 부트스트랩으로 채워지며 admin UI 에서 토글 가능.
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="0")
    # Soft delete. NULL 이면 활성, 값이 있으면 비활성 (로그인 차단, admin 목록에서 제외).
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
