// 국가 ↔ 통화 ↔ UI locale 매핑. 백엔드 backend/app/constants/countries.py 와 동기 필수.

export interface Country {
  code: string       // ISO 3166-1 alpha-2
  nameKo: string     // 한국어 표기
  nameEn: string     // 영어 표기
  currency: string   // ISO 4217
  locale: string     // BCP 47 base (frontend/src/i18n.ts 지원 17개 중 하나)
}

export const COUNTRY_LIST: Country[] = [
  { code: 'KR', nameKo: '대한민국',         nameEn: 'South Korea',         currency: 'KRW', locale: 'ko' },
  { code: 'US', nameKo: '미국',             nameEn: 'United States',       currency: 'USD', locale: 'en' },
  { code: 'JP', nameKo: '일본',             nameEn: 'Japan',               currency: 'JPY', locale: 'ja' },
  { code: 'CN', nameKo: '중국',             nameEn: 'China',               currency: 'CNY', locale: 'zh' },
  { code: 'TW', nameKo: '대만',             nameEn: 'Taiwan',              currency: 'TWD', locale: 'zh' },
  { code: 'HK', nameKo: '홍콩',             nameEn: 'Hong Kong',           currency: 'HKD', locale: 'zh' },
  { code: 'SG', nameKo: '싱가포르',         nameEn: 'Singapore',           currency: 'SGD', locale: 'en' },
  { code: 'GB', nameKo: '영국',             nameEn: 'United Kingdom',      currency: 'GBP', locale: 'en' },
  { code: 'DE', nameKo: '독일',             nameEn: 'Germany',             currency: 'EUR', locale: 'de' },
  { code: 'FR', nameKo: '프랑스',           nameEn: 'France',              currency: 'EUR', locale: 'fr' },
  { code: 'ES', nameKo: '스페인',           nameEn: 'Spain',               currency: 'EUR', locale: 'es' },
  { code: 'IT', nameKo: '이탈리아',         nameEn: 'Italy',               currency: 'EUR', locale: 'it' },
  { code: 'NL', nameKo: '네덜란드',         nameEn: 'Netherlands',         currency: 'EUR', locale: 'nl' },
  { code: 'MX', nameKo: '멕시코',           nameEn: 'Mexico',              currency: 'MXN', locale: 'es' },
  { code: 'AR', nameKo: '아르헨티나',       nameEn: 'Argentina',           currency: 'ARS', locale: 'es' },
  { code: 'BR', nameKo: '브라질',           nameEn: 'Brazil',              currency: 'BRL', locale: 'pt' },
  { code: 'TH', nameKo: '태국',             nameEn: 'Thailand',            currency: 'THB', locale: 'th' },
  { code: 'VN', nameKo: '베트남',           nameEn: 'Vietnam',             currency: 'VND', locale: 'vi' },
  { code: 'MY', nameKo: '말레이시아',       nameEn: 'Malaysia',            currency: 'MYR', locale: 'ms' },
  { code: 'ID', nameKo: '인도네시아',       nameEn: 'Indonesia',           currency: 'IDR', locale: 'id' },
  { code: 'PH', nameKo: '필리핀',           nameEn: 'Philippines',         currency: 'PHP', locale: 'en' },
  { code: 'IN', nameKo: '인도',             nameEn: 'India',               currency: 'INR', locale: 'hi' },
  { code: 'AU', nameKo: '호주',             nameEn: 'Australia',           currency: 'AUD', locale: 'en' },
  { code: 'NZ', nameKo: '뉴질랜드',         nameEn: 'New Zealand',         currency: 'NZD', locale: 'en' },
  { code: 'CA', nameKo: '캐나다',           nameEn: 'Canada',              currency: 'CAD', locale: 'en' },
  { code: 'AE', nameKo: '아랍에미리트',     nameEn: 'United Arab Emirates', currency: 'AED', locale: 'ar' },
  { code: 'SA', nameKo: '사우디아라비아',   nameEn: 'Saudi Arabia',        currency: 'SAR', locale: 'ar' },
  { code: 'ZA', nameKo: '남아프리카공화국', nameEn: 'South Africa',        currency: 'ZAR', locale: 'en' },
  { code: 'CH', nameKo: '스위스',           nameEn: 'Switzerland',         currency: 'CHF', locale: 'de' },
  { code: 'SE', nameKo: '스웨덴',           nameEn: 'Sweden',              currency: 'SEK', locale: 'sv' },
]

const _BY_CODE: Record<string, Country> = COUNTRY_LIST.reduce((acc, c) => {
  acc[c.code] = c
  return acc
}, {} as Record<string, Country>)

export const SUPPORTED_LOCALES = [
  'ko', 'en', 'ja', 'zh', 'es', 'th', 'vi', 'ms', 'hi',
  'de', 'fr', 'it', 'nl', 'pt', 'ar', 'sv', 'id',
] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const SUPPORTED_CURRENCIES = Array.from(new Set(COUNTRY_LIST.map((c) => c.currency)))

export function getCountry(code: string | null | undefined): Country | undefined {
  if (!code) return undefined
  return _BY_CODE[code.toUpperCase()]
}

export function countryDefaults(code: string | null | undefined): {
  country_code: string
  currency_code: string
  locale: SupportedLocale
} {
  const info = getCountry(code)
  if (!info) return { country_code: 'KR', currency_code: 'KRW', locale: 'ko' }
  return {
    country_code: info.code,
    currency_code: info.currency,
    locale: info.locale as SupportedLocale,
  }
}

export function normalizeLocale(loc: string | null | undefined): SupportedLocale {
  if (!loc) return 'ko'
  const base = loc.split('-')[0].split('_')[0].toLowerCase()
  return (SUPPORTED_LOCALES as readonly string[]).includes(base)
    ? (base as SupportedLocale)
    : 'ko'
}

/** 브라우저 navigator.language 에서 국가 코드 추정. 실패 시 KR. */
export function guessCountryFromBrowser(): string {
  if (typeof navigator === 'undefined') return 'KR'
  const langs = [navigator.language, ...(navigator.languages || [])]
  for (const lang of langs) {
    if (!lang) continue
    // 'en-US' → 'US', 'ko-KR' → 'KR'
    const parts = lang.split('-')
    if (parts.length >= 2 && parts[1].length === 2) {
      const code = parts[1].toUpperCase()
      if (_BY_CODE[code]) return code
    }
    // 'ja' → 'JP' (locale → country 폴백)
    const base = parts[0].toLowerCase()
    const match = COUNTRY_LIST.find((c) => c.locale === base)
    if (match) return match.code
  }
  return 'KR'
}

/** 언어 코드별 표기명 (LanguageSwitcher 등에서 사용) */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  zh: '中文',
  es: 'Español',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  ms: 'Bahasa Melayu',
  hi: 'हिन्दी',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  nl: 'Nederlands',
  pt: 'Português',
  ar: 'العربية',
  sv: 'Svenska',
  id: 'Bahasa Indonesia',
}
