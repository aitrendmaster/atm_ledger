import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Users, ShoppingBag, Calendar, BookOpen, TrendingUp, ShieldAlert } from 'lucide-react'
import { adminApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
const fmtDate = (s: string) => new Date(s).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })

export default function Admin() {
  const { user, loading } = useAuth()
  const [accessDenied, setAccessDenied] = useState(false)

  const statsQ = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.stats().then(r => r.data),
    enabled: Boolean(user?.is_admin),
    staleTime: 0,
  })

  const usersQ = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.users(100, 0).then(r => r.data),
    enabled: Boolean(user?.is_admin),
    staleTime: 0,
  })

  useEffect(() => {
    if (!loading && user && !user.is_admin) setAccessDenied(true)
  }, [loading, user])

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
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/app" className="text-atm-muted hover:text-atm-ink">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-semibold text-atm-ink">관리자 대시보드</h1>
          </div>
          <div className="text-xs text-atm-muted">{user.email}</div>
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
          <h2 className="text-sm font-semibold text-atm-muted mb-3 uppercase tracking-wide">
            사용자 목록 ({users.length})
          </h2>
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
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
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t border-stone-100">
                    <td className="px-4 py-2.5 text-atm-muted">{u.id}</td>
                    <td className="px-4 py-2.5 text-atm-ink">{u.email}</td>
                    <td className="px-4 py-2.5 text-atm-muted">{u.display_name || '—'}</td>
                    <td className="px-4 py-2.5 text-right">{u.entries_count}</td>
                    <td className="px-4 py-2.5 text-right">{u.planned_count}</td>
                    <td className="px-4 py-2.5 text-right">{u.reflections_count}</td>
                    <td className="px-4 py-2.5 text-atm-muted text-xs">{fmtDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-atm-muted">사용자가 없습니다.</div>
            )}
          </div>
        </section>

        {(statsQ.isError || usersQ.isError) && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            데이터 조회 실패. 새로고침해 보세요.
          </div>
        )}
      </main>
    </div>
  )
}

interface KpiProps {
  icon: React.ComponentType<{ size?: number; className?: string }>
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
