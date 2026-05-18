import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'

export default function ForgotPassword() {
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
      // 보안 정책상 백엔드는 항상 200 응답 — 여기 들어오면 네트워크 문제일 가능성
      toast.error('잠시 후 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-atm-ink">비밀번호 재설정</h1>
        {sent ? (
          <>
            <p className="text-sm text-atm-muted">
              해당 이메일이 등록되어 있다면 비밀번호 재설정 안내를 발송했어요.
              메일이 보이지 않으면 스팸함을 확인해 주세요. 링크는 1시간 동안 유효합니다.
            </p>
            <Link
              to="/login"
              className="block text-center w-full py-3 bg-atm-accent text-white rounded-lg"
            >
              로그인 페이지로
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-atm-muted">
              가입하신 이메일을 입력하시면 재설정 링크를 보내드립니다.
            </p>
            <form onSubmit={onSubmit} className="space-y-4">
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일"
                className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:outline-none focus:border-atm-accent"
              />
              <button
                type="submit" disabled={loading}
                className="w-full py-3 bg-atm-accent text-white rounded-lg disabled:opacity-50"
              >
                {loading ? '발송 중…' : '재설정 메일 받기'}
              </button>
            </form>
            <div className="text-sm text-center text-atm-muted">
              <Link to="/login" className="text-atm-accent">로그인으로 돌아가기</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
