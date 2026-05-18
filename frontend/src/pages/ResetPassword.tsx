import { FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'
import { authApi } from '../services/api'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function ResetPassword() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="absolute top-3 right-4"><LanguageSwitcher /></div>
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 text-center">
          <h1 className="text-lg font-semibold text-atm-ink mb-2">{t('reset.invalid')}</h1>
          <p className="text-sm text-atm-muted mb-4">{t('reset.invalidDesc')}</p>
          <Link to="/forgot-password" className="inline-block w-full py-2.5 bg-atm-accent text-white rounded-lg text-sm">
            {t('reset.requestAgain')}
          </Link>
        </div>
      </div>
    )
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      toast.error(t('reset.minLength'))
      return
    }
    setLoading(true)
    try {
      await authApi.confirmPasswordReset(token, password)
      toast.success(t('reset.success'))
      nav('/login', { replace: true })
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('reset.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="absolute top-3 right-4"><LanguageSwitcher /></div>
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-atm-ink">{t('reset.title')}</h1>
        <p className="text-sm text-atm-muted">{t('reset.intro')}</p>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'} required minLength={8}
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder={t('reset.newPassword')}
            className="w-full px-4 py-3 pr-10 border border-stone-200 rounded-lg focus:outline-none focus:border-atm-accent"
          />
          <button
            type="button" onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-atm-muted hover:text-atm-ink"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          type="submit" disabled={loading}
          className="w-full py-3 bg-atm-accent text-white rounded-lg disabled:opacity-50"
        >
          {loading ? t('reset.submitBusy') : t('reset.submit')}
        </button>
      </form>
    </div>
  )
}
