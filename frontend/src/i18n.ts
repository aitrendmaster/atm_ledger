import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import en from './locales/en/common.json'
import es from './locales/es/common.json'
import hi from './locales/hi/common.json'
import ja from './locales/ja/common.json'
import ko from './locales/ko/common.json'
import ms from './locales/ms/common.json'
import th from './locales/th/common.json'
import vi from './locales/vi/common.json'
import zh from './locales/zh/common.json'

export type SupportedLang =
  | 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'th' | 'vi' | 'ms' | 'hi'

export const SUPPORTED_LOCALES: ReadonlyArray<{ code: SupportedLang; name: string }> = [
  { code: 'ko', name: '한국어' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'es', name: 'Español' },
  { code: 'th', name: 'ไทย' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'ms', name: 'Bahasa Melayu' },
  { code: 'hi', name: 'हिन्दी' },
]

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ko: { common: ko },
      en: { common: en },
      ja: { common: ja },
      zh: { common: zh },
      es: { common: es },
      th: { common: th },
      vi: { common: vi },
      ms: { common: ms },
      hi: { common: hi },
    },
    // 현재 언어 → 영어 → 한국어 순으로 폴백. 영어 사용자가 한국어 폴백을 보지 않도록.
    // 9개 언어 모두 핵심 UI 는 자연 번역돼 있고, 긴 문서(Pricing/Terms/Privacy/Refund) 는
    // en 만 채우고 나머지 언어는 en 폴백을 의도한다.
    fallbackLng: ['en', 'ko'],
    defaultNS: 'common',
    ns: ['common'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'moa_locale',
    },
    supportedLngs: ['ko', 'en', 'ja', 'zh', 'es', 'th', 'vi', 'ms', 'hi'],
    nonExplicitSupportedLngs: true,
  })

export default i18n
