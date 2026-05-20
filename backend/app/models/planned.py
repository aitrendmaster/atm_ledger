from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Planned(Base):
    """예정 지출."""
    __tablename__ = "planned"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    description: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(20), default="event", nullable=False)  # legacy: recurring|event|planned
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 반복 규칙. recurrence='none' 이면 일회성, 그 외는 매월/매주/매년 반복.
    # date 가 첫 발생일. recurrence_day 가 매월/매주 시 사용. recurrence_until 가 종료일(선택).
    recurrence: Mapped[str] = mapped_column(String(20), default="none", server_default="none", nullable=False)
    recurrence_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recurrence_until: Mapped[str | None] = mapped_column(String(10), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
