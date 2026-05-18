from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class AdminUserRow(BaseModel):
    id: int
    email: EmailStr
    display_name: str | None
    monthly_income: int
    monthly_budget: int
    is_admin: bool
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


class ResetPasswordIn(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class SetAdminIn(BaseModel):
    is_admin: bool


class AdminActionResult(BaseModel):
    ok: bool
    message: str | None = None
