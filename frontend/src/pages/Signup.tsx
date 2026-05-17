import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'

export default function Signup() {
  const { signup } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [agree, setAgree] = useState(false)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!agree) return toast.error('약관과 개인정보 처리방침에 동의해주세요.')
    setLoading(true)
    try {
      await signup(email, password, displayName || undefined)
      nav('/app')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '가입 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-atm-ink">계정 만들기</h1>
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
        <input
          type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
          placeholder="닉네임 (선택)"
          className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:outline-none focus:border-atm-accent"
        />
        <label className="flex items-start gap-2 text-xs text-atm-muted">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
          <span>
            <Link to="/terms" className="underline">이용약관</Link>과{' '}
            <Link to="/privacy" className="underline">개인정보 처리방침</Link>에 동의합니다.
          </span>
        </label>
        <button
          type="submit" disabled={loading}
          className="w-full py-3 bg-atm-accent text-white rounded-lg disabled:opacity-50"
        >
          {loading ? '가입 중…' : '가입하기'}
        </button>
        <div className="text-sm text-center text-atm-muted">
          이미 계정이 있으세요? <Link to="/login" className="text-atm-accent">로그인</Link>
        </div>
      </form>
    </div>
  )
}
