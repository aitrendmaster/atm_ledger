from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=80)
    # 지역화 — 미지정 시 백엔드가 'KR/KRW/ko' 기본값 적용 (countries.country_defaults 사용)
    country_code: str | None = Field(default=None, max_length=2)
    currency_code: str | None = Field(default=None, max_length=3)
    locale: str | None = Field(default=None, max_length=10)
    # Cloudflare Turnstile 위젯 토큰. TURNSTILE_SECRET_KEY 설정 시 필수(봇 가입 차단).
    turnstile_token: str | None = Field(default=None, max_length=2048)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None = None
    display_name: str | None
    monthly_income: int
    monthly_budget: int
    country_code: str = "KR"
    currency_code: str = "KRW"
    locale: str = "ko"
    is_admin: bool = False
    subscription_tier: str = "free"
    subscription_expires_at: datetime | None = None
    allow_location_metadata: bool = False
    last_geo_city: str | None = None
    last_geo_region: str | None = None
    last_geo_country: str | None = None

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    full_name: str | None = Field(default=None, max_length=80)
    display_name: str | None = Field(default=None, max_length=80)
    monthly_income: int | None = Field(default=None, ge=0)
    monthly_budget: int | None = Field(default=None, ge=0)
    allow_location_metadata: bool | None = None
    country_code: str | None = Field(default=None, max_length=2)
    currency_code: str | None = Field(default=None, max_length=3)
    locale: str | None = Field(default=None, max_length=10)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetRequestIn(BaseModel):
    email: EmailStr


class PasswordResetConfirmIn(BaseModel):
    token: str = Field(min_length=10, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class BootstrapResetIn(BaseModel):
    email: EmailStr
    new_password: str = Field(min_length=8, max_length=128)
    token: str = Field(min_length=16, max_length=256)


class SimpleResult(BaseModel):
    ok: bool
    message: str | None = None
