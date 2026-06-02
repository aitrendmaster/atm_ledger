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

    # Production 은 Render env var 로 override.
    # 기본값에 Capacitor 모바일 origin (https://localhost, capacitor://localhost) 포함 —
    # env var 가 빠져도 안드로이드/iOS 앱은 동작하도록 안전망 확보.
    cors_origins: str = "http://localhost:5173,https://localhost,capacitor://localhost"

    anthropic_api_key: str = ""

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""

    # Google id_token 검증 시 허용할 추가 client_id 들 (콤마 구분).
    # Capacitor Android 앱은 google-services.json 의 client_id 로 audience 발급하므로,
    # Firebase 가 생성한 Android(type=1) + Web(type=3) client_id 두 개를 여기 등록.
    google_extra_client_ids: str = ""

    # Google Maps Platform — 백엔드 전용 서버 키 (Geocoding API).
    # 미설정 시 Nominatim 으로 자동 fallback. Render IP 제한 권장.
    google_maps_server_key: str = ""

    # Firebase Admin SDK (FCM 푸시 발송용).
    # Firebase Console > 프로젝트 설정 > 서비스 계정 > "새 비공개 키 생성" → JSON 다운로드.
    # 그 JSON 내용 전체를 raw 그대로 또는 base64 인코딩해서 환경변수에 넣음.
    # 미설정 시 FCM 발송 시 로그만 출력하고 graceful disable.
    firebase_credentials_json: str = ""

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
    # 정기결제 가격(KRW). UI 에는 "₩5,500 / 월 (≈ $4)" 로 표시.
    # Pricing 페이지·LS Moa 365 상품과 일치.
    toss_monthly_price_krw: int = 5500
    toss_monthly_order_name: str = "Moa AI 가계부 월 정기결제"

    # Lemon Squeezy (Merchant of Record, 글로벌 카드/페이팔, 한국 사업자 없이 결제 가능).
    # Toss(KRW 즉시)와 병존 — 사용자가 결제 페이지에서 선택. 미설정이면 LS 엔드포인트가 503.
    # 발급 위치:
    #   API key   → https://app.lemonsqueezy.com/settings/api
    #   Webhook secret → Settings > Webhooks > Add endpoint 시 자동 발급
    #   Store slug → 체크아웃 URL 의 서브도메인 (예: `atmstore.lemonsqueezy.com` → `atmstore`)
    #   Variant ID → Products > 변형 > URL 끝 UUID
    lemonsqueezy_api_key: str = ""
    lemonsqueezy_webhook_secret: str = ""
    lemonsqueezy_store_slug: str = ""
    lemonsqueezy_variant_id_monthly: str = ""
    lemonsqueezy_variant_id_yearly: str = ""

    # 단건 상품(전자책 등) variant → entitlement SKU 매핑. "변형UUID=sku" 콤마 구분.
    # 전자책이 늘어나면 코드 수정 없이 이 값만 추가한다.
    # 예: "b6a94278-8844-4725-ac83-c9b3afccda8c=atmbook:book-001,77ff...=atmbook:book-002"
    # ※ 키는 bare UUID 로 넣을 것(체크아웃 URL 통째 X).
    lemonsqueezy_variant_sku_map: str = ""

    # atmbook 전자책 구매 시 교차 지급하는 moa365 무료 이용 개월 수.
    ebook_cross_grant_months: int = 6
    # 교차 지급 comp 누적 상한(개월). 여러 전자책 반복 구매로 무한 누적되는 것을 방지.
    # 0 이면 무제한. 기본 12개월(지금부터 최대 1년치까지만 쌓임).
    ebook_cross_grant_max_months: int = 12

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

    # Cloudflare Turnstile (무료 CAPTCHA) — 봇 자동 가입 차단.
    # 미설정이면 검증 우회(가입 정상 동작). 설정 시 가입 폼이 위젯 토큰을 함께 보내야 함.
    # 발급: Cloudflare 대시보드 > Turnstile > 위젯 추가 → Site key(프론트) / Secret key(백엔드)
    turnstile_secret_key: str = ""
    turnstile_site_key: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def google_client_ids_all(self) -> List[str]:
        """`google_client_id` + `google_extra_client_ids` 를 합친 audience 허용 목록."""
        ids = [self.google_client_id] if self.google_client_id else []
        ids += [c.strip() for c in self.google_extra_client_ids.split(",") if c.strip()]
        # 중복 제거하면서 순서 유지
        seen: set[str] = set()
        return [c for c in ids if not (c in seen or seen.add(c))]

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    @property
    def ls_variant_sku(self) -> dict[str, str]:
        """`lemonsqueezy_variant_sku_map` 문자열을 {variant_id: sku} 딕셔너리로 파싱."""
        out: dict[str, str] = {}
        for pair in (self.lemonsqueezy_variant_sku_map or "").split(","):
            pair = pair.strip()
            if "=" in pair:
                vid, sku = pair.split("=", 1)
                vid, sku = vid.strip(), sku.strip()
                if vid and sku:
                    out[vid] = sku
        return out


@lru_cache
def get_settings() -> Settings:
    return Settings()
