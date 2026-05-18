import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LOCALES, type SupportedLang } from '../i18n'

/**
 * 작은 globe 아이콘 + 셀렉트로 i18n 언어 전환.
 * 선택값은 localStorage(`moa_locale`) 에 자동 저장됨 — i18next LanguageDetector.
 */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation()
  const current = (i18n.resolvedLanguage || i18n.language || 'ko') as SupportedLang

  return (
    <label
      className="inline-flex items-center gap-1.5 text-xs text-atm-muted cursor-pointer"
      title="Language / 언어"
    >
      <Globe size={12} />
      <select
        value={current}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="bg-transparent text-xs focus:outline-none cursor-pointer"
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {compact ? l.code.toUpperCase() : l.name}
          </option>
        ))}
      </select>
    </label>
  )
}
