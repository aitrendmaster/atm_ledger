from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=80)


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
    display_name: str | None
    monthly_income: int
    monthly_budget: int
    is_admin: bool = False

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=80)
    monthly_income: int | None = Field(default=None, ge=0)
    monthly_budget: int | None = Field(default=None, ge=0)
