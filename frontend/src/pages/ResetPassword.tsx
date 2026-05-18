import { FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'
import { authApi } from '../services/api'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 text-center">
          <h1 className="text-lg font-semibold text-atm-ink mb-2">잘못된 링크</h1>
          <p className="text-sm text-atm-muted mb-4">재설정 토큰이 없습니다. 메일 안의 링크를 다시 사용해 주세요.</p>
          <Link to="/forgot-password" className="inline-block w-full py-2.5 bg-atm-accent text-white rounded-lg text-sm">
            재설정 메일 다시 받기
          </Link>
        </div>
      </div>
    )
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    setLoading(true)
    try {
      await authApi.confirmPasswordReset(token, password)
      toast.success('비밀번호가 변경되었습니다. 다시 로그인해 주세요.')
      nav('/login', { replace: true })
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '재설정 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-atm-ink">새 비밀번호 설정</h1>
        <p className="text-sm text-atm-muted">8자 이상으로 입력해 주세요.</p>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'} required minLength={8}
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="새 비밀번호"
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
          {loading ? '변경 중…' : '비밀번호 변경'}
        </button>
      </form>
    </div>
  )
}
