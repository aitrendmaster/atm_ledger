import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import GoogleSignInButton from '../components/GoogleSignInButton'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function Login() {
  const { t } = useTranslation()
  const { signin } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signin(email, password)
      nav('/app')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('login.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="absolute top-3 right-4"><LanguageSwitcher /></div>
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" width={48} height={48} className="flex-shrink-0" />
          <h1 className="text-2xl font-semibold text-atm-ink">{t('app.name')}</h1>
        </div>
        <p className="text-sm text-atm-muted">{t('login.subtitle')}</p>
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
        <button
          type="submit" disabled={loading}
          className="w-full py-3 bg-atm-accent text-white rounded-lg disabled:opacity-50"
        >
          {loading ? t('login.submitBusy') : t('login.submit')}
        </button>
        <div className="text-sm text-center text-atm-muted">
          {t('login.noAccount')} <Link to="/signup" className="text-atm-accent">{t('login.signupLink')}</Link>
        </div>
        <div className="text-xs text-center">
          <Link to="/forgot-password" className="text-atm-muted hover:text-atm-ink underline">
            {t('login.forgotLink')}
          </Link>
        </div>
        <GoogleSignInButton />
      </form>
    </div>
  )
}
