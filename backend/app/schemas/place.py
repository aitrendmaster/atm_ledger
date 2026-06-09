from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AdminPlaceRow(BaseModel):
    id: int
    name: str
    lat: float | None
    lng: float | None
    address: str | None
    category: str | None
    review_count: int
    visit_count: int
    avg_rating: float | None


class AdminPlaceReview(BaseModel):
    id: int
    user_id: int
    user_email: str | None
    entry_id: int | None
    rating: int | None
    body: str | None
    mood: str | None
    visibility: str
    status: str
    created_at: datetime
    photos: list[str] = []


class AdminPlaceDetail(AdminPlaceRow):
    google_place_id: str | None
    rating_sum: int
    created_at: datetime
    reviews: list[AdminPlaceReview]


class AdminPlaceReport(BaseModel):
    id: int
    place_review_id: int
    reporter_user_id: int | None
    reason: str | None
    status: str
    created_at: datetime
    resolved_at: datetime | None


class ModerateReviewIn(BaseModel):
    status: Literal["visible", "hidden", "flagged", "removed"]


class ResolveReportIn(BaseModel):
    status: Literal["resolved", "dismissed"]
