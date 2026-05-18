import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  BookOpen,
  Bell,
  Calendar,
  Cpu,
  Download,
  Eye,
  EyeOff,
  FileText,
  History,
  Key,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { AdminUserSort, AnnouncementLevel } from '../services/api'
import { adminApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import AppHeader from '../components/AppHeader'

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
const fmtDate = (s: string) => new Date(s).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })

export default function Admin() {
  const { user, loading } = useAuth()
  const queryClient = useQueryClient()
  const [accessDenied, setAccessDenied] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [pwTarget, setPwTarget] = useState<{ id: number; email: string } | null>(null)
  const [pwValue, setPwValue] = useState('')
  const [pwShow, setPwShow] = useState(false)
  // 검색·정렬·필터
  const [query, setQuery] = useState('')
  const [queryInput, setQueryInput] = useState('')
  const [sort, setSort] = useState<AdminUserSort>('created_at_desc')
  const [hasData, setHasData] = useState(false)
  // 회원 상세 모달
  const [detailUserId, setDetailUserId] = useState<number | null>(null)
  // 감사 로그 펼치기
  const [auditOpen, setAuditOpen] = useState(false)
  // 공지 관리
  const [annoOpen, setAnnoOpen] = useState(false)
  const [annoForm, setAnnoForm] = useState<{
    title: string
    body: string
    level: AnnouncementLevel
    active: boolean
  }>({ title: '', body: '', level: 'info', active: true })

  const statsQ = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.stats().then(r => r.data),
    enabled: Boolean(user?.is_admin),
    staleTime: 0,
  })

  const usersQ = useQuery({
    queryKey: ['admin', 'users', query, sort, hasData],
    queryFn: () =>
      adminApi
        .users({ q: query || undefined, sort, has_data: hasData, limit: 100 })
        .then(r => r.data),
    enabled: Boolean(user?.is_admin),
    staleTime: 0,
  })

  const detailQ = useQuery({
    queryKey: ['admin', 'user-detail', detailUserId],
    queryFn: () => adminApi.userDetail(detailUserId!).then(r => r.data),
    enabled: Boolean(user?.is_admin) && detailUserId !== null,
    staleTime: 0,
  })

  const auditQ = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () => adminApi.audit(50).then(r => r.data),
    enabled: Boolean(user?.is_admin) && auditOpen,
    staleTime: 0,
  })

  const aiUsageQ = useQuery({
    queryKey: ['admin', 'ai-usage'],
    queryFn: () => adminApi.aiUsageSummary().then(r => r.data),
    enabled: Boolean(user?.is_admin),
    staleTime: 30_000,
  })

  const annoListQ = useQuery({
    queryKey: ['admin', 'announcements'],
    queryFn: () => adminApi.listAnnouncements().then(r => r.data),
    enabled: Boolean(user?.is_admin) && annoOpen,
    staleTime: 0,
  })

  const refreshAnnouncements = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] })
    queryClient.invalidateQueries({ queryKey: ['announcements', 'active'] })
  }

  const submitAnnouncement = async () => {
    if (!annoForm.title.trim() || !annoForm.body.trim()) {
      toast.error('제목과 본문은 필수입니다.')
      return
    }
    try {
      await adminApi.createAnnouncement({
        title: annoForm.title.trim(),
        body: annoForm.body.trim(),
        level: annoForm.level,
        active: annoForm.active,
      })
      setAnnoForm({ title: '', body: '', level: 'info', active: true })
      refreshAnnouncements()
      toast.success('공지 추가 완료')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '공지 추가 실패')
    }
  }

  const toggleAnnouncementActive = async (id: number, active: boolean) => {
    try {
      await adminApi.updateAnnouncement(id, { active })
      refreshAnnouncements()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '갱신 실패')
    }
  }

  const deleteAnnouncement = async (id: number, title: string) => {
    if (!window.confirm(`공지 "${title}" 을 삭제하시겠습니까?`)) return
    try {
      await adminApi.deleteAnnouncement(id)
      refreshAnnouncements()
      toast.success('삭제 완료')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '삭제 실패')
    }
  }

  useEffect(() => {
    if (!loading && user && !user.is_admin) setAccessDenied(true)
  }, [loading, user])

  const refreshAdminData = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] })
    if (detailUserId !== null) {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-detail', detailUserId] })
    }
  }

  const handleExportUser = async (id: number, email: string) => {
    try {
      const res = await adminApi.exportUser(id)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
      a.download = `moa-ai-user-${id}-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`${email} 데이터 익스포트 완료`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '익스포트 실패')
    }
  }

  const handleHardDelete = async (id: number, email: string) => {
    const confirmText = window.prompt(
      `⚠️ ${email} 의 모든 데이터(가계부/예정/회고/사진)를 영구 삭제합니다.\n` +
        `이 작업은 되돌릴 수 없습니다.\n\n` +
        `진행하려면 대상 이메일을 그대로 입력하세요:`,
    )
    if (!confirmText) return
    if (confirmText.trim().toLowerCase() !== email.toLowerCase()) {
      toast.error('이메일 불일치. 작업 취소.')
      return
    }
    setBusyId(id)
    try {
      const r = await adminApi.hardDelete(id, confirmText.trim())
      toast.success(r.data.message || '영구 삭제 완료')
      refreshAdminData()
      setDetailUserId(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '영구 삭제 실패')
    } finally {
      setBusyId(null)
    }
  }

  const handleExportCsv = async () => {
    try {
      const res = await adminApi.exportUsersCsv()
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
      a.download = `moa-ai-users-${stamp}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('CSV 다운로드를 시작합니다.')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'CSV 내보내기 실패')
    }
  }

  const openResetPassword = (id: number, email: string) => {
    setPwTarget({ id, email })
    setPwValue('')
    setPwShow(false)
  }

  const submitResetPassword = async () => {
    if (!pwTarget) return
    if (pwValue.length < 8) {
      toast.error('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    setBusyId(pwTarget.id)
    try {
      const r = await adminApi.resetPassword(pwTarget.id, pwValue)
      toast.success(r.data.message || '비밀번호 재설정 완료')
      setPwTarget(null)
      setPwValue('')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '재설정 실패')
    } finally {
      setBusyId(null)
    }
  }

  const handleToggleAdmin = async (id: number, email: string, current: boolean) => {
    const next = !current
    const ok = window.confirm(
      `${email} 의 admin 권한을 ${next ? '부여' : '해제'}하시겠습니까?`,
    )
    if (!ok) return
    setBusyId(id)
    try {
      const r = await adminApi.setAdmin(id, next)
      toast.success(r.data.message || '권한 변경 완료')
      refreshAdminData()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '권한 변경 실패')
    } finally {
      setBusyId(null)
    }
  }

  const handleSoftDelete = async (id: number, email: string) => {
    const ok = window.confirm(
      `${email} 계정을 비활성화(soft delete)합니다.\n` +
        `해당 사용자는 로그인 불가, admin 목록에서 제외됩니다.\n` +
        `가계부 데이터는 보존됩니다. 진행할까요?`,
    )
    if (!ok) return
    setBusyId(id)
    try {
      const r = await adminApi.softDelete(id)
      toast.success(r.data.message || '비활성화 완료')
      refreshAdminData()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '삭제 실패')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <div className="p-8 text-atm-muted">로딩 중…</div>

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-atm-muted">
          로그인 후 이용 가능합니다. <Link to="/login" className="text-atm-accent">로그인</Link>
        </div>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-white border border-stone-200 rounded-2xl p-8 max-w-md text-center">
          <ShieldAlert size={40} className="text-atm-accent mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-atm-ink mb-2">관리자 전용</h2>
          <p className="text-sm text-atm-muted mb-5">
            이 페이지는 운영자 계정만 접근할 수 있습니다.
            <br />
            현재 계정: {user.email}
          </p>
          <Link to="/app" className="inline-block px-5 py-2.5 bg-atm-accent text-white rounded-lg text-sm">
            가계부로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  const s = statsQ.data
  const users = usersQ.data ?? []

  return (
    <div className="min-h-screen bg-atm-bg">
      <header className="px-6 py-4 bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/app" className="text-atm-muted hover:text-atm-ink">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-semibold text-atm-ink">관리자 대시보드</h1>
          </div>
          <AppHeader variant="inline" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Cards */}
        <section>
          <h2 className="text-sm font-semibold text-atm-muted mb-3 uppercase tracking-wide">현황</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Kpi icon={Users} label="전체 사용자" value={s?.users_total ?? '—'} sub={`최근 7일 +${s?.recent_signups_7d ?? 0}`} />
            <Kpi icon={ShoppingBag} label="총 지출 건수" value={s?.entries_total ?? '—'} />
            <Kpi icon={Calendar} label="예정 지출" value={s?.planned_total ?? '—'} />
            <Kpi icon={BookOpen} label="회고 기록" value={s?.reflections_total ?? '—'} />
          </div>
          <div className="mt-4">
            <Kpi
              icon={TrendingUp}
              label="누적 지출 합계"
              value={s ? won(s.entries_amount_total) : '—'}
              full
            />
          </div>
        </section>

        {/* AI 사용량 위젯 */}
        <section>
          <h2 className="text-sm font-semibold text-atm-muted mb-3 uppercase tracking-wide flex items-center gap-2">
            <Cpu size={14} /> AI 사용량 (Claude)
          </h2>
          {aiUsageQ.data ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  ['오늘', aiUsageQ.data.today],
                  ['최근 7일', aiUsageQ.data.last_7d],
                  ['최근 30일', aiUsageQ.data.last_30d],
                ] as const).map(([label, b]) => (
                  <div key={label} className="bg-white border border-stone-200 rounded-2xl p-4">
                    <div className="text-xs text-atm-muted mb-1.5">{label}</div>
                    <div className="text-lg font-semibold text-atm-ink">
                      ${b.estimated_cost_usd.toFixed(4)}
                    </div>
                    <div className="text-xs text-atm-muted mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>호출 {b.calls.toLocaleString()}</span>
                      <span>입력 {b.input_tokens.toLocaleString()}t</span>
                      <span>출력 {b.output_tokens.toLocaleString()}t</span>
                      {b.errors > 0 && (
                        <span className="text-red-600">실패 {b.errors}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {aiUsageQ.data.by_model.length > 0 && (
                <div className="bg-white border border-stone-200 rounded-2xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50 text-xs text-atm-muted">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">모델 (최근 30일)</th>
                        <th className="text-right px-4 py-2 font-medium">호출</th>
                        <th className="text-right px-4 py-2 font-medium">입력 토큰</th>
                        <th className="text-right px-4 py-2 font-medium">출력 토큰</th>
                        <th className="text-right px-4 py-2 font-medium">비용 (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiUsageQ.data.by_model.map((r) => (
                        <tr key={r.model} className="border-t border-stone-100">
                          <td className="px-4 py-2 text-atm-ink font-mono text-xs">{r.model}</td>
                          <td className="px-4 py-2 text-right">{r.calls.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right text-atm-muted">{r.input_tokens.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right text-atm-muted">{r.output_tokens.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-medium">${r.estimated_cost_usd.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {aiUsageQ.data.recent_errors.length > 0 && (
                <details className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs">
                  <summary className="cursor-pointer text-red-700 font-medium">
                    최근 오류 {aiUsageQ.data.recent_errors.length}건
                  </summary>
                  <ul className="mt-2 space-y-1 text-red-700">
                    {aiUsageQ.data.recent_errors.map((e, i) => (
                      <li key={i} className="font-mono break-all">{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ) : aiUsageQ.isLoading ? (
            <div className="text-sm text-atm-muted">불러오는 중…</div>
          ) : (
            <div className="text-sm text-atm-muted">사용량 데이터가 없습니다.</div>
          )}
        </section>

        {/* Category breakdown */}
        {s && Object.keys(s.entries_by_category).length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-atm-muted mb-3 uppercase tracking-wide">
              카테고리별 누적
            </h2>
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              {Object.entries(s.entries_by_category)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([cat, amt]) => {
                  const max = Math.max(...Object.values(s.entries_by_category), 1)
                  const pct = ((amt as number) / max) * 100
                  return (
                    <div key={cat} className="px-4 py-3 border-b border-stone-100 last:border-b-0">
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-atm-ink">{cat}</span>
                        <span className="text-atm-muted">{won(amt as number)}</span>
                      </div>
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-atm-accent rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          </section>
        )}

        {/* Users table */}
        <section>
          <div className="flex flex-wrap items-end gap-3 mb-3">
            <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide">
              사용자 목록 ({users.length})
            </h2>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs text-atm-muted hover:bg-stone-50"
              title="활성 사용자 CSV 내보내기"
            >
              <Download size={12} /> CSV
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setQuery(queryInput.trim())
              }}
              className="flex items-center gap-1 flex-1 min-w-[200px]"
            >
              <div className="relative flex-1">
                <Search
                  size={12}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-atm-muted"
                />
                <input
                  type="search"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="이메일·닉네임 검색"
                  className="w-full pl-7 pr-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-atm-accent"
                />
              </div>
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQueryInput('')
                    setQuery('')
                  }}
                  className="text-xs text-atm-muted hover:text-atm-ink px-2"
                >
                  지우기
                </button>
              )}
            </form>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as AdminUserSort)}
              className="px-2 py-1.5 text-sm border border-stone-200 rounded-lg bg-white"
            >
              <option value="created_at_desc">최근 가입순</option>
              <option value="created_at_asc">오래된 순</option>
              <option value="email">이메일순</option>
              <option value="entries_desc">지출 건수순</option>
            </select>
            <label className="inline-flex items-center gap-1.5 text-xs text-atm-muted">
              <input
                type="checkbox"
                checked={hasData}
                onChange={(e) => setHasData(e.target.checked)}
                className="accent-atm-accent"
              />
              지출 있음
            </label>
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-atm-muted">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">ID</th>
                  <th className="text-left px-4 py-2.5 font-medium">이메일</th>
                  <th className="text-left px-4 py-2.5 font-medium">닉네임</th>
                  <th className="text-right px-4 py-2.5 font-medium">지출</th>
                  <th className="text-right px-4 py-2.5 font-medium">예정</th>
                  <th className="text-right px-4 py-2.5 font-medium">회고</th>
                  <th className="text-left px-4 py-2.5 font-medium">가입일</th>
                  <th className="text-right px-4 py-2.5 font-medium">액션</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isSelf = u.id === user.id
                  const busy = busyId === u.id
                  return (
                    <tr key={u.id} className="border-t border-stone-100">
                      <td className="px-4 py-2.5 text-atm-muted">{u.id}</td>
                      <td className="px-4 py-2.5 text-atm-ink">
                        <button
                          type="button"
                          onClick={() => setDetailUserId(u.id)}
                          className="flex items-center gap-2 hover:underline text-left"
                          title="상세 보기"
                        >
                          <span>{u.email}</span>
                          {u.is_admin && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-atm-accent/10 text-atm-accent rounded text-[10px] font-medium">
                              <ShieldCheck size={10} /> ADMIN
                            </span>
                          )}
                          {isSelf && (
                            <span className="px-1.5 py-0.5 bg-stone-100 text-atm-muted rounded text-[10px]">
                              본인
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-atm-muted">{u.display_name || '—'}</td>
                      <td className="px-4 py-2.5 text-right">{u.entries_count}</td>
                      <td className="px-4 py-2.5 text-right">{u.planned_count}</td>
                      <td className="px-4 py-2.5 text-right">{u.reflections_count}</td>
                      <td className="px-4 py-2.5 text-atm-muted text-xs whitespace-nowrap">
                        {fmtDate(u.created_at)}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openResetPassword(u.id, u.email)}
                            title="비밀번호 재설정"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-stone-200 rounded-md hover:bg-stone-50 disabled:opacity-50"
                          >
                            <Key size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={busy || isSelf}
                            onClick={() => handleToggleAdmin(u.id, u.email, u.is_admin)}
                            title={u.is_admin ? 'admin 해제' : 'admin 부여'}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs border rounded-md disabled:opacity-50 ${
                              u.is_admin
                                ? 'border-atm-accent text-atm-accent hover:bg-atm-accent/5'
                                : 'border-stone-200 text-atm-muted hover:bg-stone-50'
                            }`}
                          >
                            <ShieldCheck size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={busy || isSelf}
                            onClick={() => handleSoftDelete(u.id, u.email)}
                            title="비활성화 (soft delete)"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-atm-muted">
                {query ? '검색 결과 없음.' : '사용자가 없습니다.'}
              </div>
            )}
          </div>
        </section>

        {/* 공지 배너 관리 */}
        <section>
          <button
            type="button"
            onClick={() => setAnnoOpen((o) => !o)}
            className="flex items-center gap-2 mb-3 text-sm font-semibold text-atm-muted uppercase tracking-wide hover:text-atm-ink"
          >
            <Bell size={14} />
            공지 배너 {annoOpen ? '▾' : '▸'}
          </button>
          {annoOpen && (
            <div className="space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void submitAnnouncement()
                }}
                className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3"
              >
                <input
                  type="text"
                  value={annoForm.title}
                  onChange={(e) => setAnnoForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="제목 (예: 점검 안내)"
                  maxLength={120}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
                />
                <textarea
                  value={annoForm.body}
                  onChange={(e) => setAnnoForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="본문 (한 줄~여러 줄)"
                  rows={3}
                  maxLength={4000}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent resize-y"
                />
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="inline-flex items-center gap-1.5">
                    중요도
                    <select
                      value={annoForm.level}
                      onChange={(e) =>
                        setAnnoForm((f) => ({
                          ...f,
                          level: e.target.value as AnnouncementLevel,
                        }))
                      }
                      className="px-2 py-1 border border-stone-200 rounded-md bg-white"
                    >
                      <option value="info">info</option>
                      <option value="warning">warning</option>
                      <option value="critical">critical (닫기 불가)</option>
                    </select>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-atm-muted">
                    <input
                      type="checkbox"
                      checked={annoForm.active}
                      onChange={(e) =>
                        setAnnoForm((f) => ({ ...f, active: e.target.checked }))
                      }
                      className="accent-atm-accent"
                    />
                    즉시 활성
                  </label>
                  <div className="flex-1" />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-atm-accent text-white rounded-lg text-sm"
                  >
                    <Plus size={12} /> 추가
                  </button>
                </div>
              </form>

              <div className="bg-white border border-stone-200 rounded-2xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-xs text-atm-muted">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">제목 / 본문</th>
                      <th className="text-left px-4 py-2.5 font-medium">레벨</th>
                      <th className="text-left px-4 py-2.5 font-medium">활성</th>
                      <th className="text-left px-4 py-2.5 font-medium">생성</th>
                      <th className="text-right px-4 py-2.5 font-medium">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(annoListQ.data ?? []).map((a) => (
                      <tr key={a.id} className="border-t border-stone-100">
                        <td className="px-4 py-2 max-w-md">
                          <div className="font-medium text-atm-ink truncate">{a.title}</div>
                          <div className="text-xs text-atm-muted truncate">{a.body}</div>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                              a.level === 'critical'
                                ? 'bg-red-100 text-red-700'
                                : a.level === 'warning'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-sky-100 text-sky-700'
                            }`}
                          >
                            {a.level}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={a.active}
                              onChange={(e) => toggleAnnouncementActive(a.id, e.target.checked)}
                              className="accent-atm-accent"
                            />
                            {a.active ? '노출' : '숨김'}
                          </label>
                        </td>
                        <td className="px-4 py-2 text-atm-muted text-xs whitespace-nowrap">
                          {fmtDate(a.created_at)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => deleteAnnouncement(a.id, a.title)}
                            className="inline-flex items-center px-2 py-1 text-xs border border-red-200 text-red-600 rounded-md hover:bg-red-50"
                            title="삭제"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {annoListQ.data && annoListQ.data.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-atm-muted">
                    공지가 없습니다.
                  </div>
                )}
                {annoListQ.isLoading && (
                  <div className="px-4 py-6 text-center text-sm text-atm-muted">
                    불러오는 중…
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 감사 로그 */}
        <section>
          <button
            type="button"
            onClick={() => setAuditOpen((o) => !o)}
            className="flex items-center gap-2 mb-3 text-sm font-semibold text-atm-muted uppercase tracking-wide hover:text-atm-ink"
          >
            <History size={14} />
            감사 로그 {auditOpen ? '▾' : '▸'}
          </button>
          {auditOpen && (
            <div className="bg-white border border-stone-200 rounded-2xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-xs text-atm-muted">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">시각</th>
                    <th className="text-left px-4 py-2.5 font-medium">관리자</th>
                    <th className="text-left px-4 py-2.5 font-medium">액션</th>
                    <th className="text-left px-4 py-2.5 font-medium">대상</th>
                    <th className="text-left px-4 py-2.5 font-medium">payload</th>
                  </tr>
                </thead>
                <tbody>
                  {(auditQ.data ?? []).map((row) => (
                    <tr key={row.id} className="border-t border-stone-100">
                      <td className="px-4 py-2 text-atm-muted text-xs whitespace-nowrap">
                        {fmtDate(row.created_at)}
                      </td>
                      <td className="px-4 py-2 text-atm-ink">{row.admin_email}</td>
                      <td className="px-4 py-2">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-atm-accent/10 text-atm-accent text-[11px] font-medium">
                          {row.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-atm-muted">
                        {row.target_email || (row.target_user_id ? `#${row.target_user_id}` : '—')}
                      </td>
                      <td className="px-4 py-2 text-atm-muted text-xs font-mono truncate max-w-xs">
                        {row.payload || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {auditQ.data && auditQ.data.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-atm-muted">감사 로그가 없습니다.</div>
              )}
              {auditQ.isLoading && (
                <div className="px-4 py-6 text-center text-sm text-atm-muted">불러오는 중…</div>
              )}
            </div>
          )}
        </section>

        {(statsQ.isError || usersQ.isError) && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            데이터 조회 실패. 새로고침해 보세요.
          </div>
        )}
      </main>

      {/* 회원 상세 모달 */}
      {detailUserId !== null && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetailUserId(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[88vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-atm-accent" />
                <h3 className="text-base font-semibold text-atm-ink">회원 상세</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailUserId(null)}
                className="text-atm-muted hover:text-atm-ink"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {detailQ.isLoading && (
                <div className="text-sm text-atm-muted">불러오는 중…</div>
              )}
              {detailQ.isError && (
                <div className="text-sm text-red-600">조회 실패. 다시 시도해 주세요.</div>
              )}
              {detailQ.data && (() => {
                const d = detailQ.data
                return (
                  <>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div className="text-atm-muted">이메일</div>
                      <div className="text-atm-ink flex items-center gap-1.5">
                        {d.email}
                        {d.is_admin && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-atm-accent/10 text-atm-accent rounded text-[10px] font-medium">
                            <ShieldCheck size={10} /> ADMIN
                          </span>
                        )}
                      </div>
                      <div className="text-atm-muted">닉네임</div>
                      <div className="text-atm-ink">{d.display_name || '—'}</div>
                      <div className="text-atm-muted">인증 방식</div>
                      <div className="text-atm-ink">{d.auth_provider}</div>
                      <div className="text-atm-muted">가입일</div>
                      <div className="text-atm-ink">{fmtDate(d.created_at)}</div>
                      <div className="text-atm-muted">월 수입 / 예산</div>
                      <div className="text-atm-ink">{won(d.monthly_income)} / {won(d.monthly_budget)}</div>
                      {d.deleted_at && (
                        <>
                          <div className="text-red-500">탈퇴 시각</div>
                          <div className="text-red-600">{fmtDate(d.deleted_at)}</div>
                        </>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-atm-muted uppercase tracking-wide mb-2">데이터 현황</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <Stat label="지출" value={d.entries_count} />
                        <Stat label="예정" value={d.planned_count} />
                        <Stat label="회고" value={d.reflections_count} />
                        <Stat label="사진" value={d.photos_count} />
                      </div>
                      <div className="mt-2 text-sm text-atm-ink">
                        누적 지출 합계: <span className="font-semibold">{won(d.entries_amount_total)}</span>
                      </div>
                    </div>

                    {Object.keys(d.entries_by_category).length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-atm-muted uppercase tracking-wide mb-2">카테고리별</h4>
                        <div className="space-y-1.5">
                          {Object.entries(d.entries_by_category)
                            .sort(([, a], [, b]) => b - a)
                            .map(([cat, amt]) => (
                              <div key={cat} className="flex items-center justify-between text-sm border-b border-stone-100 pb-1">
                                <span className="text-atm-ink">{cat}</span>
                                <span className="text-atm-muted">{won(amt)}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {d.recent_entries.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-atm-muted uppercase tracking-wide mb-2">최근 지출 (10건)</h4>
                        <div className="space-y-1.5">
                          {d.recent_entries.map((e) => (
                            <div key={e.id} className="flex items-center justify-between text-sm border-b border-stone-100 pb-1">
                              <div className="flex-1 min-w-0 truncate">
                                <span className="text-atm-ink">{e.description}</span>
                                {e.place_name && (
                                  <span className="text-atm-muted text-xs"> · {e.place_name}</span>
                                )}
                              </div>
                              <div className="text-atm-muted text-xs whitespace-nowrap ml-3">
                                {e.date} · {e.category} · {won(e.amount)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* GDPR 액션 */}
                    <div className="pt-4 border-t border-stone-200">
                      <h4 className="text-xs font-semibold text-atm-muted uppercase tracking-wide mb-2">
                        GDPR
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleExportUser(d.id, d.email)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-stone-200 rounded-lg hover:bg-stone-50"
                          title="해당 회원의 모든 데이터 JSON 익스포트 (Article 20)"
                        >
                          <Download size={12} /> 데이터 익스포트 (JSON)
                        </button>
                        {d.id !== user.id && (
                          <button
                            type="button"
                            disabled={busyId === d.id}
                            onClick={() => handleHardDelete(d.id, d.email)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                            title="영구 삭제 (Article 17) — 되돌릴 수 없음"
                          >
                            <Trash2 size={12} /> 영구 삭제
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-atm-muted mt-2">
                        영구 삭제는 가계부·예정·회고·사진을 모두 즉시 제거합니다. 이메일 확인을 통과해야 진행됩니다.
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 재설정 모달 */}
      {pwTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPwTarget(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key size={16} className="text-atm-accent" />
                <h3 className="text-base font-semibold text-atm-ink">비밀번호 재설정</h3>
              </div>
              <button
                type="button"
                onClick={() => setPwTarget(null)}
                className="text-atm-muted hover:text-atm-ink"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-atm-muted mb-3">
              <span className="text-atm-ink font-medium">{pwTarget.email}</span> 의 새 비밀번호 (8자 이상).
              사용자에게는 별도 안전한 채널로 전달하세요.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void submitResetPassword()
              }}
            >
              <div className="relative mb-4">
                <input
                  type={pwShow ? 'text' : 'password'}
                  autoFocus
                  value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)}
                  minLength={8}
                  placeholder="새 비밀번호"
                  className="w-full px-3 py-2.5 pr-9 border border-stone-200 rounded-lg focus:outline-none focus:border-atm-accent text-sm"
                />
                <button
                  type="button"
                  onClick={() => setPwShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-atm-muted hover:text-atm-ink"
                  title={pwShow ? '숨기기' : '보기'}
                >
                  {pwShow ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPwTarget(null)}
                  className="flex-1 py-2 border border-stone-200 rounded-lg text-sm text-atm-muted hover:bg-stone-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={busyId === pwTarget.id || pwValue.length < 8}
                  className="flex-1 py-2 bg-atm-accent text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {busyId === pwTarget.id ? '저장 중…' : '재설정'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

interface KpiProps {
  icon: LucideIcon
  label: string
  value: number | string
  sub?: string
  full?: boolean
}

function Kpi({ icon: Icon, label, value, sub, full }: KpiProps) {
  return (
    <div className={`bg-white border border-stone-200 rounded-2xl p-5 ${full ? '' : ''}`}>
      <div className="flex items-center gap-2 mb-2 text-atm-muted text-xs">
        <Icon size={14} />
        {label}
      </div>
      <div className="text-2xl font-semibold text-atm-ink">{value}</div>
      {sub && <div className="text-xs text-atm-muted mt-1">{sub}</div>}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-stone-50 rounded-lg p-2.5">
      <div className="text-[10px] text-atm-muted uppercase tracking-wide">{label}</div>
      <div className="text-lg font-semibold text-atm-ink mt-0.5">{value}</div>
    </div>
  )
}
