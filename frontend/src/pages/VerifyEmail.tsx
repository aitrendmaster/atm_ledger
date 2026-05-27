import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, Loader } from 'lucide-react'
import { authApi } from '../services/api'
import LanguageSwitcher from '../components/LanguageSwitcher'

type Status = 'pending' | 'success' | 'error'

export default function VerifyEmail() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<Status>('pending')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMsg(t('verifyEmail.noToken'))
      return
    }
    let cancelled = false
    authApi
      .verifyEmail(token)
      .then(() => {
        if (!cancelled) setStatus('success')
      })
      .catch((err) => {
        if (cancelled) return
        setStatus('error')
        setErrorMsg(err?.response?.data?.detail || t('verifyEmail.failed'))
      })
    return () => {
      cancelled = true
    }
  }, [token, t])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-atm-bg">
      <div className="absolute top-3 right-4"><LanguageSwitcher /></div>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4 text-center">
        {status === 'pending' && (
          <>
            <Loader size={40} className="mx-auto text-atm-accent animate-spin" />
            <h1 className="text-xl font-semibold text-atm-ink">{t('verifyEmail.pending')}</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 size={40} className="mx-auto text-green-600" />
            <h1 className="text-xl font-semibold text-atm-ink">{t('verifyEmail.successTitle')}</h1>
            <p className="text-sm text-atm-muted leading-relaxed">{t('verifyEmail.successBody')}</p>
            <Link
              to="/login"
              className="block w-full py-2.5 bg-atm-accent text-white rounded-lg text-sm font-medium"
            >
              {t('verifyEmail.toLogin')}
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={40} className="mx-auto text-red-500" />
            <h1 className="text-xl font-semibold text-atm-ink">{t('verifyEmail.errorTitle')}</h1>
            <p className="text-sm text-atm-muted leading-relaxed break-words">{errorMsg}</p>
            <Link
              to="/verify-pending"
              className="block w-full py-2.5 bg-atm-accent text-white rounded-lg text-sm font-medium"
            >
              {t('verifyEmail.resend')}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
