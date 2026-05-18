import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Trash2,
  User as UserIcon,
} from 'lucide-react'
import { authApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'

export default function MyPage() {
  const { user, signout, refresh } = useAuth()
  const queryClient = useQueryClient()
  const nav = useNavigate()

  // 프로필
  const [displayName, setDisplayName] = useState('')
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [monthlyBudget, setMonthlyBudget] = useState(0)
  const [profileBusy, setProfileBusy] = useState(false)

  // 비밀번호
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    setDisplayName(user.display_name || '')
    setMonthlyIncome(user.monthly_income || 0)
    setMonthlyBudget(user.monthly_budget || 0)
  }, [user])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-atm-muted">
        로그인 후 이용 가능합니다. <Link to="/login" className="ml-2 text-atm-accent">로그인</Link>
      </div>
    )
  }

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setProfileBusy(true)
    try {
      await authApi.updateMe({
        display_name: displayName,
        monthly_income: monthlyIncome,
        monthly_budget: monthlyBudget,
      })
      await refresh()
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      toast.success('프로필이 저장되었습니다.')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '저장 실패')
    } finally {
      setProfileBusy(false)
    }
  }

  const changePw = async (e: FormEvent) => {
    e.preventDefault()
    if (newPw.length < 8) {
      toast.error('새 비밀번호는 8자 이상이어야 합니다.')
      return
    }
    setPwBusy(true)
    try {
      const r = await authApi.changePassword(curPw, newPw)
      toast.success(r.data.message || '비밀번호가 변경되었습니다.')
      setCurPw('')
      setNewPw('')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '비밀번호 변경 실패')
    } finally {
      setPwBusy(false)
    }
  }

  const exportData = async () => {
    try {
      const res = await authApi.exportMyData()
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
      a.download = `moa-ai-mydata-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('데이터 다운로드를 시작합니다.')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '내보내기 실패')
    }
  }

  const deleteAccount = async () => {
    const ok = window.confirm(
      `정말 탈퇴하시겠습니까?\n\n` +
        `· 로그인이 즉시 차단됩니다.\n` +
        `· 가계부 데이터는 일정 기간 보존된 뒤 영구 삭제됩니다.\n` +
        `· 완전 삭제를 원하시면 먼저 데이터를 내보내고 운영자에게 문의해 주세요.`,
    )
    if (!ok) return
    const phrase = window.prompt('탈퇴하려면 본인 이메일을 입력해 주세요.')
    if (!phrase || phrase.trim().toLowerCase() !== user.email.toLowerCase()) {
      toast.error('이메일 불일치. 작업 취소.')
      return
    }
    try {
      await authApi.deleteMe()
      toast.success('탈퇴 처리되었습니다.')
      signout()
      nav('/', { replace: true })
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '탈퇴 실패')
    }
  }

  const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

  return (
    <div className="min-h-screen bg-atm-bg">
      <header className="px-6 py-4 bg-white border-b border-stone-200">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/app" className="text-atm-muted hover:text-atm-ink">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-semibold text-atm-ink flex items-center gap-2">
              <UserIcon size={18} /> 마이페이지
            </h1>
          </div>
          <button
            onClick={signout}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs text-atm-muted hover:bg-stone-50"
          >
            <LogOut size={12} /> 로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* 계정 정보 */}
        <section className="bg-white border border-stone-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide mb-3">
            계정
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="text-atm-muted">이메일</div>
            <div className="text-atm-ink">{user.email}</div>
            <div className="text-atm-muted">로그인 방식</div>
            <div className="text-atm-ink">이메일·비밀번호</div>
            {user.is_admin && (
              <>
                <div className="text-atm-muted">권한</div>
                <div className="text-atm-accent font-medium">관리자</div>
              </>
            )}
          </div>
        </section>

        {/* 프로필 */}
        <section className="bg-white border border-stone-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide mb-3">
            프로필
          </h2>
          <form onSubmit={saveProfile} className="space-y-3">
            <label className="block">
              <span className="text-xs text-atm-muted">닉네임</span>
              <input
                type="text" value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                className="mt-1 w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-atm-muted">월 수입 (원)</span>
                <input
                  type="number" min={0} value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(Number(e.target.value) || 0)}
                  className="mt-1 w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
                />
                <span className="text-[10px] text-atm-muted">{won(monthlyIncome)}</span>
              </label>
              <label className="block">
                <span className="text-xs text-atm-muted">월 예산 (원)</span>
                <input
                  type="number" min={0} value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(Number(e.target.value) || 0)}
                  className="mt-1 w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
                />
                <span className="text-[10px] text-atm-muted">{won(monthlyBudget)}</span>
              </label>
            </div>
            <button
              type="submit" disabled={profileBusy}
              className="px-4 py-2 bg-atm-accent text-white rounded-lg text-sm disabled:opacity-50"
            >
              {profileBusy ? '저장 중…' : '프로필 저장'}
            </button>
          </form>
        </section>

        {/* 비밀번호 변경 */}
        <section className="bg-white border border-stone-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide mb-3 flex items-center gap-2">
            <KeyRound size={14} /> 비밀번호 변경
          </h2>
          <form onSubmit={changePw} className="space-y-3 max-w-sm">
            <input
              type={showPw ? 'text' : 'password'} required
              value={curPw} onChange={(e) => setCurPw(e.target.value)}
              placeholder="현재 비밀번호"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
            />
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'} required minLength={8}
                value={newPw} onChange={(e) => setNewPw(e.target.value)}
                placeholder="새 비밀번호 (8자 이상)"
                className="w-full px-3 py-2 pr-10 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
              />
              <button
                type="button" onClick={() => setShowPw((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-atm-muted hover:text-atm-ink p-1"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              type="submit" disabled={pwBusy}
              className="px-4 py-2 bg-atm-accent text-white rounded-lg text-sm disabled:opacity-50"
            >
              {pwBusy ? '변경 중…' : '비밀번호 변경'}
            </button>
          </form>
          <div className="mt-3 text-xs text-atm-muted">
            비밀번호를 잊으셨다면{' '}
            <Link to="/forgot-password" className="text-atm-accent">
              재설정 메일을 받으세요
            </Link>
            .
          </div>
        </section>

        {/* 데이터 / 탈퇴 */}
        <section className="bg-white border border-stone-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide mb-3">
            내 데이터
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button" onClick={exportData}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-stone-200 rounded-lg text-sm hover:bg-stone-50"
              title="GDPR Art.20 데이터 이동권 — 모든 가계부 데이터를 JSON 으로 다운로드"
            >
              <Download size={13} /> 내 데이터 내보내기 (JSON)
            </button>
            <button
              type="button" onClick={deleteAccount}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-700 rounded-lg text-sm hover:bg-red-50"
            >
              <Trash2 size={13} /> 탈퇴
            </button>
          </div>
          <div className="text-xs text-atm-muted mt-2">
            탈퇴 시 로그인이 즉시 차단됩니다. 가계부 데이터는 일정 기간 보존된 뒤 영구 삭제됩니다.
          </div>
        </section>
      </main>
    </div>
  )
}
