import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import GoogleSignInButton from '../components/GoogleSignInButton'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function Signup() {
  const { t } = useTranslation()
  const { signup } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [agree, setAgree] = useState(false)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!agree) return toast.error(t('signup.agreeRequired'))
    setLoading(true)
    try {
      await signup(email, password, displayName || undefined)
      nav('/app')
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
      </form>
    </div>
  )
}
