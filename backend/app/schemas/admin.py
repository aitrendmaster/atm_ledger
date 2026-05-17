from datetime import datetime
from pydantic import BaseModel, EmailStr


class AdminUserRow(BaseModel):
    id: int
    email: EmailStr
    display_name: str | None
    monthly_income: int
    monthly_budget: int
    created_at: datetime
    entries_count: int
    planned_count: int
    reflections_count: int


class AdminStats(BaseModel):
    users_total: int
    entries_total: int
    planned_total: int
    reflections_total: int
    entries_amount_total: int
    entries_by_category: dict[str, int]
    recent_signups_7d: int


class AdminMeOut(BaseModel):
    id: int
    email: EmailStr
    display_name: str | None
    is_admin: bool
    support_email: str
