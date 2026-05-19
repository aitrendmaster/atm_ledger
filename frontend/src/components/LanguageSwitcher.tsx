import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LOCALES, type SupportedLang } from '../i18n'
import { authApi, tokenStore } from '../services/api'
import { useAuth } from '../hooks/useAuth'

/**
 * 작은 globe 아이콘 + 셀렉트로 i18n 언어 전환.
 * - localStorage(`moa_locale`) 자동 저장 (i18next LanguageDetector).
 * - 로그인 상태면 백엔드 user.locale 도 PATCH /auth/me 로 동기화.
 */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation()
  const { user, refresh } = useAuth()
  const current = (i18n.resolvedLanguage || i18n.language || 'ko') as SupportedLang

  const onChange = async (next: string) => {
    await i18n.changeLanguage(next)
    // 로그인 상태면 백엔드 영속화. 토큰 없으면 localStorage 만 신뢰.
    if (tokenStore.access && user && user.locale !== next) {
      try {
        await authApi.updateMe({ locale: next })
        await refresh()
      } catch {
        /* 네트워크 오류 시 localStorage 만 유지 */
      }
    }
  }

  return (
    <label
      className="inline-flex items-center gap-1.5 text-xs text-atm-muted cursor-pointer"
      title="Language / 언어"
    >
      <Globe size={12} />
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
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
