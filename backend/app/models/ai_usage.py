from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class AIUsage(Base):
    """Claude API 호출 로그. 청구·할당량·이상 사용 탐지에 사용."""

    __tablename__ = "ai_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # parse | insight | other
    kind: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 추정 비용. 정수 millicent (1/1000 of a cent) 로 저장해 정밀도 보존.
    estimated_cost_mc: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # ok | error
    status: Mapped[str] = mapped_column(
        String(10), nullable=False, default="ok", server_default="ok"
    )
    error: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
