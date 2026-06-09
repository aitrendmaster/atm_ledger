"""장소-커뮤니티 예비 스키마 (스캐폴딩 + 백필).

현재 장소 데이터는 Entry 행에 비정규화(place_name/lat/lng/address/rating/review/mood)
되어 있다. 향후 "네이버 플레이스"형 장소 리뷰 커뮤니티로 확장하기 위해 first-class
canonical Place + PlaceReview 를 둔다.

- Place: 좌표/이름으로 dedup 된 정규 장소. 집계(review_count/rating_sum/visit_count) 캐시.
- PlaceReview: 장소별 리뷰. 레거시(개인 가계부) 리뷰는 visibility='private' 로 백필 —
  커뮤니티 공개는 향후 사용자 동의 + 약관 개정 후에만.
- PlaceReviewPhoto: 커뮤니티 리뷰 사진(향후). 백필 단계 미사용.
- PlaceReviewReport: 신고/모더레이션 큐.
"""
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Place(Base):
    __tablename__ = "places"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # 향후 canonical dedup 용 (Google Place ID 등). 레거시 백필엔 없음.
    google_place_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # 집계 캐시 — avg_rating = rating_sum / review_count
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")
    rating_sum: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")
    visit_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PlaceReview(Base):
    __tablename__ = "place_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    place_id: Mapped[int] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # 원천 가계부 항목 링크 (백필/연동). entry 삭제돼도 리뷰는 보존(SET NULL).
    entry_id: Mapped[int | None] = mapped_column(
        ForeignKey("entries.id", ondelete="SET NULL"), nullable=True, index=True
    )
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    mood: Mapped[str | None] = mapped_column(String(20), nullable=True)  # again | normal | never
    # private(개인 기록) | public(커뮤니티 공개). 레거시는 전부 private.
    visibility: Mapped[str] = mapped_column(
        String(16), default="private", nullable=False, server_default="private"
    )
    # visible | hidden | flagged | removed (모더레이션)
    status: Mapped[str] = mapped_column(
        String(16), default="visible", nullable=False, server_default="visible", index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PlaceReviewPhoto(Base):
    __tablename__ = "place_review_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    place_review_id: Mapped[int] = mapped_column(
        ForeignKey("place_reviews.id", ondelete="CASCADE"), index=True
    )
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PlaceReviewReport(Base):
    __tablename__ = "place_review_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    place_review_id: Mapped[int] = mapped_column(
        ForeignKey("place_reviews.id", ondelete="CASCADE"), index=True
    )
    reporter_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # open | resolved | dismissed
    status: Mapped[str] = mapped_column(
        String(16), default="open", nullable=False, server_default="open", index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
