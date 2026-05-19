"""국가 ↔ 통화 ↔ 사용자 인터페이스 locale 매핑.

신규 회원가입 시 사용자가 국가를 고르면 currency/locale 기본값을 자동으로 도출한다.
프론트와 동일한 데이터는 frontend/src/constants/countries.ts 에 있다.
"""
from __future__ import annotations

# 우선순위: i18n 지원 9개 언어 (ko/en/ja/zh/es/th/vi/ms/hi) 가 자연스럽게 매핑되는 국가 위주.
# (code, name_ko, name_en, currency, locale)
COUNTRIES: list[dict] = [
    {"code": "KR", "name_ko": "대한민국",       "name_en": "South Korea",     "currency": "KRW", "locale": "ko"},
    {"code": "US", "name_ko": "미국",           "name_en": "United States",   "currency": "USD", "locale": "en"},
    {"code": "JP", "name_ko": "일본",           "name_en": "Japan",           "currency": "JPY", "locale": "ja"},
    {"code": "CN", "name_ko": "중국",           "name_en": "China",           "currency": "CNY", "locale": "zh"},
    {"code": "TW", "name_ko": "대만",           "name_en": "Taiwan",          "currency": "TWD", "locale": "zh"},
    {"code": "HK", "name_ko": "홍콩",           "name_en": "Hong Kong",       "currency": "HKD", "locale": "zh"},
    {"code": "SG", "name_ko": "싱가포르",       "name_en": "Singapore",       "currency": "SGD", "locale": "en"},
    {"code": "GB", "name_ko": "영국",           "name_en": "United Kingdom",  "currency": "GBP", "locale": "en"},
    {"code": "DE", "name_ko": "독일",           "name_en": "Germany",         "currency": "EUR", "locale": "en"},
    {"code": "FR", "name_ko": "프랑스",         "name_en": "France",          "currency": "EUR", "locale": "en"},
    {"code": "ES", "name_ko": "스페인",         "name_en": "Spain",           "currency": "EUR", "locale": "es"},
    {"code": "IT", "name_ko": "이탈리아",       "name_en": "Italy",           "currency": "EUR", "locale": "en"},
    {"code": "NL", "name_ko": "네덜란드",       "name_en": "Netherlands",     "currency": "EUR", "locale": "en"},
    {"code": "MX", "name_ko": "멕시코",         "name_en": "Mexico",          "currency": "MXN", "locale": "es"},
    {"code": "AR", "name_ko": "아르헨티나",     "name_en": "Argentina",       "currency": "ARS", "locale": "es"},
    {"code": "BR", "name_ko": "브라질",         "name_en": "Brazil",          "currency": "BRL", "locale": "en"},
    {"code": "TH", "name_ko": "태국",           "name_en": "Thailand",        "currency": "THB", "locale": "th"},
    {"code": "VN", "name_ko": "베트남",         "name_en": "Vietnam",         "currency": "VND", "locale": "vi"},
    {"code": "MY", "name_ko": "말레이시아",     "name_en": "Malaysia",        "currency": "MYR", "locale": "ms"},
    {"code": "ID", "name_ko": "인도네시아",     "name_en": "Indonesia",       "currency": "IDR", "locale": "ms"},
    {"code": "PH", "name_ko": "필리핀",         "name_en": "Philippines",     "currency": "PHP", "locale": "en"},
    {"code": "IN", "name_ko": "인도",           "name_en": "India",           "currency": "INR", "locale": "hi"},
    {"code": "AU", "name_ko": "호주",           "name_en": "Australia",       "currency": "AUD", "locale": "en"},
    {"code": "NZ", "name_ko": "뉴질랜드",       "name_en": "New Zealand",     "currency": "NZD", "locale": "en"},
    {"code": "CA", "name_ko": "캐나다",         "name_en": "Canada",          "currency": "CAD", "locale": "en"},
    {"code": "AE", "name_ko": "아랍에미리트",   "name_en": "United Arab Emirates", "currency": "AED", "locale": "en"},
    {"code": "SA", "name_ko": "사우디아라비아", "name_en": "Saudi Arabia",    "currency": "SAR", "locale": "en"},
    {"code": "ZA", "name_ko": "남아프리카공화국", "name_en": "South Africa",  "currency": "ZAR", "locale": "en"},
    {"code": "CH", "name_ko": "스위스",         "name_en": "Switzerland",     "currency": "CHF", "locale": "en"},
    {"code": "SE", "name_ko": "스웨덴",         "name_en": "Sweden",          "currency": "SEK", "locale": "en"},
]

_BY_CODE: dict[str, dict] = {c["code"]: c for c in COUNTRIES}

# i18n 에서 지원 중인 언어 코드 목록 (frontend/src/i18n.ts 와 동기 필수)
SUPPORTED_LOCALES = {"ko", "en", "ja", "zh", "es", "th", "vi", "ms", "hi"}

# 통화 코드 화이트리스트 (위 COUNTRIES 에서 사용되는 통화 + KRW 기본)
SUPPORTED_CURRENCIES = {c["currency"] for c in COUNTRIES}


def country_defaults(code: str | None) -> dict:
    """국가 코드에서 currency/locale 기본값 도출.

    알 수 없는 국가면 KR/KRW/ko 로 폴백.
    """
    if not code:
        return {"country_code": "KR", "currency_code": "KRW", "locale": "ko"}
    info = _BY_CODE.get(code.upper())
    if not info:
        return {"country_code": "KR", "currency_code": "KRW", "locale": "ko"}
    return {
        "country_code": info["code"],
        "currency_code": info["currency"],
        "locale": info["locale"],
    }


def normalize_locale(locale: str | None) -> str:
    """locale 정규화: 'en-US' → 'en'. 지원 안 하는 경우 'ko' 폴백."""
    if not locale:
        return "ko"
    base = locale.split("-")[0].split("_")[0].lower()
    return base if base in SUPPORTED_LOCALES else "ko"


def normalize_currency(currency: str | None) -> str:
    if not currency:
        return "KRW"
    code = currency.upper()
    return code if code in SUPPORTED_CURRENCIES else "KRW"


def normalize_country(country: str | None) -> str:
    if not country:
        return "KR"
    code = country.upper()
    return code if code in _BY_CODE else "KR"
