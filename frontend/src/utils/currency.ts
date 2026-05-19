// 통화 표시 헬퍼. Intl.NumberFormat 기반.
// 사용자가 가계부에 입력한 숫자는 그대로 유지하고 통화 라벨/포맷만 변경한다 (환율 환산 안 함).

interface CurrencyInfo {
  symbol: string
  locale: string  // BCP 47, Intl.NumberFormat 용
  decimals: number
}

const CURRENCY_MAP: Record<string, CurrencyInfo> = {
  KRW: { symbol: '₩',   locale: 'ko-KR', decimals: 0 },
  USD: { symbol: '$',   locale: 'en-US', decimals: 2 },
  EUR: { symbol: '€',   locale: 'en-IE', decimals: 2 },
  JPY: { symbol: '¥',   locale: 'ja-JP', decimals: 0 },
  CNY: { symbol: '¥',   locale: 'zh-CN', decimals: 2 },
  TWD: { symbol: 'NT$', locale: 'zh-TW', decimals: 0 },
  HKD: { symbol: 'HK$', locale: 'zh-HK', decimals: 2 },
  SGD: { symbol: 'S$',  locale: 'en-SG', decimals: 2 },
  GBP: { symbol: '£',   locale: 'en-GB', decimals: 2 },
  AUD: { symbol: 'A$',  locale: 'en-AU', decimals: 2 },
  NZD: { symbol: 'NZ$', locale: 'en-NZ', decimals: 2 },
  CAD: { symbol: 'C$',  locale: 'en-CA', decimals: 2 },
  CHF: { symbol: 'CHF', locale: 'de-CH', decimals: 2 },
  SEK: { symbol: 'kr',  locale: 'sv-SE', decimals: 2 },
  MXN: { symbol: 'Mex$', locale: 'es-MX', decimals: 2 },
  ARS: { symbol: 'AR$', locale: 'es-AR', decimals: 2 },
  BRL: { symbol: 'R$',  locale: 'pt-BR', decimals: 2 },
  THB: { symbol: '฿',   locale: 'th-TH', decimals: 2 },
  VND: { symbol: '₫',   locale: 'vi-VN', decimals: 0 },
  MYR: { symbol: 'RM',  locale: 'ms-MY', decimals: 2 },
  IDR: { symbol: 'Rp',  locale: 'id-ID', decimals: 0 },
  PHP: { symbol: '₱',   locale: 'en-PH', decimals: 2 },
  INR: { symbol: '₹',   locale: 'hi-IN', decimals: 2 },
  AED: { symbol: 'د.إ', locale: 'en-AE', decimals: 2 },
  SAR: { symbol: '﷼',   locale: 'en-SA', decimals: 2 },
  ZAR: { symbol: 'R',   locale: 'en-ZA', decimals: 2 },
}

const KRW = CURRENCY_MAP.KRW

/** 통화 코드 → 정보 (알 수 없으면 KRW 폴백). */
export function currencyInfo(code: string | null | undefined): CurrencyInfo {
  if (!code) return KRW
  return CURRENCY_MAP[code.toUpperCase()] || KRW
}

/** 통화 심볼만 (라벨 뒤에 붙일 때). */
export function currencySymbol(code: string | null | undefined): string {
  return currencyInfo(code).symbol
}

/**
 * 금액 + 통화 포맷.
 * - 기본: Intl.NumberFormat currency style → 통화 코드별 적절한 위치/구분자.
 * - withSymbol=false: 숫자만 그룹 구분자로 포맷 (예: "1,234").
 */
export function formatCurrency(
  amount: number,
  code: string | null | undefined = 'KRW',
  opts: { withSymbol?: boolean } = {},
): string {
  const info = currencyInfo(code)
  const safe = Number.isFinite(amount) ? amount : 0
  if (opts.withSymbol === false) {
    return new Intl.NumberFormat(info.locale, {
      minimumFractionDigits: info.decimals,
      maximumFractionDigits: info.decimals,
    }).format(safe)
  }
  try {
    return new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: (code || 'KRW').toUpperCase(),
      minimumFractionDigits: info.decimals,
      maximumFractionDigits: info.decimals,
    }).format(safe)
  } catch {
    // 알 수 없는 통화 코드 → 심볼 + 숫자 단순 결합
    return `${info.symbol}${safe.toLocaleString(info.locale)}`
  }
}

/** 짧게 압축 표시: 12,345 → "12.3k", 1,234,567 → "1.2M". 통화 심볼은 prefix. */
export function compactCurrency(
  amount: number,
  code: string | null | undefined = 'KRW',
): string {
  const info = currencyInfo(code)
  const safe = Number.isFinite(amount) ? amount : 0
  const abs = Math.abs(safe)
  let display: string
  if (abs >= 1_000_000) display = (safe / 1_000_000).toFixed(1) + 'M'
  else if (abs >= 1_000) display = (safe / 1_000).toFixed(1) + 'k'
  else display = String(Math.round(safe))
  return `${info.symbol}${display}`
}
