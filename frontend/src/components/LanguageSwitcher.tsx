import { useRef } from 'react'
import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LOCALES, type SupportedLang } from '../i18n'
import { authApi, tokenStore } from '../services/api'
import { useAuth } from '../hooks/useAuth'

/**
 * 작은 globe 아이콘 + 셀렉트로 i18n 언어 전환.
 * - localStorage(`moa_locale`) 자동 저장 (i18next LanguageDetector).
 * - 로그인 상태면 백엔드 user.locale 도 PATCH /auth/me 로 동기화.
 * - 350ms debounce: 빠른 연속 전환 시 i18next 내부 상태 손상 + localStorage 부분 기록 방지.
 */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation()
  const { user, refresh } = useAuth()
  const current = (i18n.resolvedLanguage || i18n.language || 'ko') as SupportedLang
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onChange = (next: string) => {
    if (pendingRef.current) clearTimeout(pendingRef.current)
    pendingRef.current = setTimeout(async () => {
      try {
        await i18n.changeLanguage(next)
      } catch (err) {
        console.warn('changeLanguage failed:', err)
        return
      }
      if (tokenStore.access && user && user.locale !== next) {
        try {
          await authApi.updateMe({ locale: next })
          await refresh()
        } catch {
          /* 네트워크 오류 시 localStorage 만 유지 */
        }
      }
    }, 350)
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
