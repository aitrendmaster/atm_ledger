import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Mail } from 'lucide-react'
import { authApi } from '../services/api'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function VerifyPending() {
  const { t } = useTranslation()
  const location = useLocation()
  const initialEmail = (location.state as { email?: string } | null)?.email || ''
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)

  const onResend = async () => {
    if (!email) return toast.error(t('verifyPending.emailRequired'))
    setBusy(true)
    try {
      await authApi.resendVerification(email)
      toast.success(t('verifyPending.resendSuccess'))
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('verifyPending.resendFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-atm-bg">
      <div className="absolute top-3 right-4"><LanguageSwitcher /></div>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4 text-center">
        <Mail size={40} className="mx-auto text-atm-accent" />
        <h1 className="text-xl font-semibold text-atm-ink">{t('verifyPending.title')}</h1>
        <p className="text-sm text-atm-muted leading-relaxed">{t('verifyPending.body')}</p>
        {initialEmail && (
          <p className="text-sm font-medium text-atm-ink break-all">{initialEmail}</p>
        )}
        <div className="pt-2 space-y-2">
          {!initialEmail && (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('verifyPending.emailPlaceholder')}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
            />
          )}
          <button
            onClick={onResend}
            disabled={busy || !email}
            className="w-full py-2.5 bg-atm-accent text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {busy ? '...' : t('verifyPending.resend')}
          </button>
          <Link
            to="/login"
            className="block w-full py-2.5 text-atm-accent text-sm font-medium"
          >
            {t('verifyPending.toLogin')}
          </Link>
        </div>
        <p className="text-[11px] text-atm-muted pt-2 border-t border-stone-100">
          {t('verifyPending.hint')}
        </p>
      </div>
    </div>
  )
}
