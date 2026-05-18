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

    # Toss Payments 정기결제 (빌링키 기반). 한국 사업자 PG.
    # 값이 비어 있으면 결제 엔드포인트가 503 으로 graceful disable.
    # 가맹 신청 후 dev center 에서 test_sk_*/test_ck_* 발급 → 검증 → live 키 전환.
    toss_secret_key: str = ""
    toss_client_key: str = ""
    # 정기결제 가격(KRW). UI 에는 "₩5,400 / 월 (≈ $4)" 로 표시.
    toss_monthly_price_krw: int = 5400
    toss_monthly_order_name: str = "Moa AI 가계부 월 정기결제"

    # 베타 기간 무료 모드. true 면:
    # - 모든 사용자가 paid 와 동일한 권한 (엑셀 익스포트 등)
    # - 트라이얼 만료/구독 게이트 우회
    # - UI 결제 탭에 "베타 기간 무료" 안내 표시, 업그레이드 버튼 비활성
    # 정식 유료화 출시 시 BETA_FREE_MODE=false 로 변경.
    beta_free_mode: bool = True

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
