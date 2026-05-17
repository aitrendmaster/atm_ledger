from datetime import datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Entry(Base):
    """이미 쓴 지출 (spent)."""
    __tablename__ = "entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    description: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # YYYY-MM-DD

    # 장소 (선택)
    place_name: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    place_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    place_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    place_address: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # 후기
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    review: Mapped[str | None] = mapped_column(Text, nullable=True)
    mood: Mapped[str | None] = mapped_column(String(20), nullable=True)  # again | normal | never

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    photos: Mapped[list["EntryPhoto"]] = relationship(
        "EntryPhoto", back_populates="entry", cascade="all, delete-orphan", lazy="selectin"
    )


class EntryPhoto(Base):
    __tablename__ = "entry_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("entries.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    entry: Mapped["Entry"] = relationship("Entry", back_populates="photos")
