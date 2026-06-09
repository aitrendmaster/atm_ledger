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
    # 운영 메타
    subscription_tier: str = "free"
    plan_active: bool = True
    last_active_at: datetime | None = None
    admin_comp_until: datetime | None = None


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


class AdminEntrySummary(BaseModel):
    id: int
    description: str
    amount: int
    category: str
    date: str
    place_name: str | None = None


class AdminUserDetail(BaseModel):
    id: int
    email: EmailStr
    display_name: str | None
    monthly_income: int
    monthly_budget: int
    is_admin: bool
    auth_provider: str
    created_at: datetime
    deleted_at: datetime | None
    entries_count: int
    planned_count: int
    reflections_count: int
    photos_count: int
    entries_amount_total: int
    entries_by_category: dict[str, int]
    recent_entries: list[AdminEntrySummary]
    # ----- 운영/구독/활동 -----
    email_verified: bool = True
    country_code: str | None = None
    currency_code: str | None = None
    locale: str | None = None
    subscription_tier: str = "free"
    subscription_status: str | None = None
    subscription_expires_at: datetime | None = None
    admin_comp_until: datetime | None = None
    admin_comp_note: str | None = None
    plan_active: bool = True
    ai_daily_limit: int | None = None
    last_active_at: datetime | None = None
    card_brand: str | None = None
    card_last4: str | None = None
    first_entry_date: str | None = None
    last_entry_date: str | None = None


class GrantCompIn(BaseModel):
    """운영자 이용권 부여. days 또는 until 중 하나 필수."""
    days: int | None = Field(default=None, ge=1, le=3650)
    until: datetime | None = None
    note: str | None = Field(default=None, max_length=255)


class SetAiLimitIn(BaseModel):
    """사용자별 AI 일일 호출 상한. null=전역 기본값, 0=차단."""
    limit: int | None = Field(default=None, ge=0, le=100000)


class AdminAuditRow(BaseModel):
    id: int
    admin_email: str
    action: str
    target_user_id: int | None
    target_email: str | None
    payload: str | None
    created_at: datetime


class AIUsageBucket(BaseModel):
    label: str  # today | last_7d | last_30d
    calls: int
    errors: int
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float


class AIUsageModelRow(BaseModel):
    model: str
    calls: int
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float


class AIUsageSummary(BaseModel):
    today: AIUsageBucket
    last_7d: AIUsageBucket
    last_30d: AIUsageBucket
    by_model: list[AIUsageModelRow]
    recent_errors: list[str]


class AdminUserAiUsage(BaseModel):
    """특정 사용자의 AI 사용량 버킷(today/7d/30d)."""
    today: AIUsageBucket
    last_7d: AIUsageBucket
    last_30d: AIUsageBucket
