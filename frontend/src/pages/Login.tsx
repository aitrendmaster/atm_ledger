import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
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
      toast.error(err?.response?.data?.detail || '로그인 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-atm-ink">Moa AI 가계부</h1>
        <p className="text-sm text-atm-muted">로그인하고 가계부를 시작하세요.</p>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:outline-none focus:border-atm-accent"
        />
        <input
          type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (8자 이상)"
          className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:outline-none focus:border-atm-accent"
        />
        <button
          type="submit" disabled={loading}
          className="w-full py-3 bg-atm-accent text-white rounded-lg disabled:opacity-50"
        >
          {loading ? '로그인 중…' : '로그인'}
        </button>
        <div className="text-sm text-center text-atm-muted">
          계정이 없으세요? <Link to="/signup" className="text-atm-accent">가입하기</Link>
        </div>
        <div className="text-xs text-center">
          <Link to="/forgot-password" className="text-atm-muted hover:text-atm-ink underline">
            비밀번호를 잊으셨나요?
          </Link>
        </div>
      </form>
    </div>
  )
}
