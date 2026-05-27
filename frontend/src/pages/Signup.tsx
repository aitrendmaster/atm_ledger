import { FormEvent, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import GoogleSignInButton from '../components/GoogleSignInButton'
import LanguageSwitcher from '../components/LanguageSwitcher'
import {
  COUNTRY_LIST,
  countryDefaults,
  guessCountryFromBrowser,
} from '../constants/countries'

export default function Signup() {
  const { t, i18n } = useTranslation()
  const { signup } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [agree, setAgree] = useState(false)
  const [loading, setLoading] = useState(false)
  const [country, setCountry] = useState<string>(() => guessCountryFromBrowser())

  // 국가명은 현재 UI 언어에 따라 한국어 또는 영어. 다른 언어 사용자는 영어 라벨 fallback.
  const useKoreanLabel = i18n.language?.startsWith('ko')
  const countryOptions = useMemo(
    () =>
      [...COUNTRY_LIST]
        .map((c) => ({ code: c.code, label: useKoreanLabel ? c.nameKo : c.nameEn }))
        .sort((a, b) => a.label.localeCompare(b.label, useKoreanLabel ? 'ko' : 'en')),
    [useKoreanLabel],
  )

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!agree) return toast.error(t('signup.agreeRequired'))
    setLoading(true)
    try {
      const extras = countryDefaults(country)
      await signup(email, password, displayName || undefined, extras)
      // 이메일 인증 필수 — 가입 직후 안내 페이지로 이동.
      nav('/verify-pending', { state: { email } })
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('signup.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="absolute top-3 right-4"><LanguageSwitcher /></div>
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-atm-ink">{t('signup.title')}</h1>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={t('login.email')}
          className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:outline-none focus:border-atm-accent"
        />
        <input
          type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder={t('login.password8')}
          className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:outline-none focus:border-atm-accent"
        />
        <input
          type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t('signup.nickname')}
          className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:outline-none focus:border-atm-accent"
        />
        <div>
          <label className="block text-xs text-atm-muted mb-1">{t('signup.countryLabel')}</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:outline-none focus:border-atm-accent bg-white"
          >
            {countryOptions.map((c) => (
              <option key={c.code} value={c.code}>{c.label} ({c.code})</option>
            ))}
          </select>
          <p className="text-[11px] text-atm-muted mt-1">{t('signup.countryHint')}</p>
        </div>
        <label className="flex items-start gap-2 text-xs text-atm-muted">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
          <span>
            {t('signup.agreeStart')}
            <Link to="/terms" className="underline">{t('signup.agreeTerms')}</Link>
            {t('signup.agreeAnd')}
            <Link to="/privacy" className="underline">{t('signup.agreePrivacy')}</Link>
            {t('signup.agreeEnd')}
          </span>
        </label>
        <button
          type="submit" disabled={loading}
          className="w-full py-3 bg-atm-accent text-white rounded-lg disabled:opacity-50"
        >
          {loading ? t('signup.submitBusy') : t('signup.submit')}
        </button>
        <div className="text-sm text-center text-atm-muted">
          {t('signup.hasAccount')} <Link to="/login" className="text-atm-accent">{t('signup.loginLink')}</Link>
        </div>
        <GoogleSignInButton />
        <div className="pt-2 border-t border-stone-100 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-atm-muted justify-center">
          <Link to="/pricing" className="hover:text-atm-ink">{t('common.pricing')}</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-atm-ink">{t('landing.footerTerms')}</Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-atm-ink">{t('landing.footerPrivacy')}</Link>
          <span>·</span>
          <Link to="/refund" className="hover:text-atm-ink">{t('common.refund')}</Link>
          <span>·</span>
          <Link to="/account-deletion" className="hover:text-atm-ink">{t('landing.footerDataDeletion')}</Link>
          <span>·</span>
          <Link to="/faq" className="hover:text-atm-ink">FAQ</Link>
        </div>
      </form>
    </div>
  )
}
