from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: str = "development"
    log_level: str = "INFO"

    database_url: str = "sqlite+aiosqlite:///./atm_ledger.db"

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_db_url(cls, v: str) -> str:
        # Railway / Heroku give postgresql:// — force asyncpg driver
        if isinstance(v, str) and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_min: int = 60
    jwt_refresh_ttl_days: int = 30

    cors_origins: str = "http://localhost:5173"

    anthropic_api_key: str = ""

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""

    kakao_rest_api_key: str = ""
    kakao_redirect_uri: str = ""

    storage_backend: str = "local"  # local | r2
    local_upload_dir: str = "./uploads"
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""
    r2_public_base_url: str = ""

    frontend_base_url: str = "http://localhost:5173"

    # Resend (이메일 발송). 비어 있으면 reset 링크를 백엔드 로그에 출력만 함(개발용 폴백).
    resend_api_key: str = ""
    resend_from: str = "Moa AI 가계부 <onboarding@resend.dev>"

    # Password reset 토큰 유효 기간
    password_reset_ttl_min: int = 60

    # Stripe 정기결제 — 값이 비어 있으면 결제 엔드포인트가 503 으로 graceful disable.
    # Stripe Dashboard → Products → Price 등록 후 STRIPE_PRICE_ID 사용 ($4/mo recurring).
    # Webhook secret 은 Stripe CLI 또는 Dashboard 에서 webhook endpoint 등록 후 발급.
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_price_id: str = ""
    stripe_webhook_secret: str = ""

    # Admin 권한 부여 이메일 (콤마 구분). 운영자만 /admin/* 접근 가능
    admin_emails: str = "aitrendmarketer@gmail.com"

    # 공식 문의 연락처 (Landing/FAQ/Footer 등에 노출용)
    support_email: str = "master@aitrend.kr"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
