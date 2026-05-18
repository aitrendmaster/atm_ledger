import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      await authApi.requestPasswordReset(email.trim())
      setSent(true)
    } catch (err: any) {
      toast.error(t('common.retry'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="absolute top-3 right-4"><LanguageSwitcher /></div>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-atm-ink">{t('forgot.title')}</h1>
        {sent ? (
          <>
            <p className="text-sm text-atm-muted">{t('forgot.sent')}</p>
            <Link
              to="/login"
              className="block text-center w-full py-3 bg-atm-accent text-white rounded-lg"
            >
              {t('forgot.backLogin')}
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-atm-muted">{t('forgot.intro')}</p>
            <form onSubmit={onSubmit} className="space-y-4">
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.email')}
                className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:outline-none focus:border-atm-accent"
              />
              <button
                type="submit" disabled={loading}
                className="w-full py-3 bg-atm-accent text-white rounded-lg disabled:opacity-50"
              >
                {loading ? t('forgot.submitBusy') : t('forgot.submit')}
              </button>
            </form>
            <div className="text-sm text-center text-atm-muted">
              <Link to="/login" className="text-atm-accent">{t('forgot.backLoginLink')}</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
