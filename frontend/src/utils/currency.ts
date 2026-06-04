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

/**
 * "압축(compact)" 임계값 — 이 값 미만이면 풀 표시, 이상이면 Intl compact 표기.
 * KRW·JPY 등 소액 단위가 큰 통화는 1만(10,000) 미만까지 풀 표시해야 자연스럽고,
 * USD·EUR 등은 1,000 미만을 풀 표시한다.
 * (이 분기가 없으면 $10 → "0.0k" 처럼 0 으로 뭉개지는 버그가 발생.)
 */
const COMPACT_THRESHOLDS: Record<string, number> = {
  KRW: 10_000, JPY: 10_000, VND: 10_000, IDR: 10_000,
}
const DEFAULT_COMPACT_THRESHOLD = 1_000

/**
 * 달력 셀·요약 카드용 짧은 금액 표기. 통화·로케일에 맞춰 Intl 이 자동 압축한다.
 * - 소액(임계값 미만): 풀 표시  → USD $10 → "$10.00", KRW ₩4,500 → "₩4,500"
 * - 고액(임계값 이상): compact → USD $1,500 → "$1.5K", KRW ₩45,000 → "₩4.5만"
 * 어떤 통화·언어에서도 0 으로 뭉개지지 않는다.
 */
export function compactCurrency(
  amount: number,
  code: string | null | undefined = 'KRW',
): string {
  const info = currencyInfo(code)
  const cur = (code || 'KRW').toUpperCase()
  const safe = Number.isFinite(amount) ? amount : 0
  const threshold = COMPACT_THRESHOLDS[cur] ?? DEFAULT_COMPACT_THRESHOLD
  try {
    if (Math.abs(safe) < threshold) {
      return new Intl.NumberFormat(info.locale, {
        style: 'currency',
        currency: cur,
        minimumFractionDigits: info.decimals,
        maximumFractionDigits: info.decimals,
      }).format(safe)
    }
    return new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: cur,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(safe)
  } catch {
    // 알 수 없는 통화 코드 → 심볼 + 반올림 숫자
    return `${info.symbol}${Math.round(safe).toLocaleString(info.locale)}`
  }
}
