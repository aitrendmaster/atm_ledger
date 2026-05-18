from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Level = Literal["info", "warning", "critical"]


class AnnouncementOut(BaseModel):
    id: int
    title: str
    body: str
    level: Level
    active: bool
    starts_at: datetime | None
    ends_at: datetime | None
    created_by_email: str | None
    created_at: datetime
    updated_at: datetime


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=4000)
    level: Level = "info"
    active: bool = True
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class AnnouncementUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    body: str | None = Field(default=None, min_length=1, max_length=4000)
    level: Level | None = None
    active: bool | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
