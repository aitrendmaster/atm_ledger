import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { loadPaymentWidget } from '@tosspayments/payment-widget-sdk'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  MapPin,
  Shield,
  Trash2,
  User as UserIcon,
} from 'lucide-react'
import { authApi, meApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import AppHeader from '../components/AppHeader'
import i18n, { SUPPORTED_LOCALES } from '../i18n'
import {
  COUNTRY_LIST,
  SUPPORTED_CURRENCIES,
  countryDefaults,
} from '../constants/countries'
import { formatCurrency } from '../utils/currency'

type Tab = 'general' | 'billing' | 'privacy' | 'location' | 'export'

const TABS: { key: Tab; label: string; icon: typeof UserIcon }[] = [
  { key: 'general', label: '일반', icon: UserIcon },
  { key: 'billing', label: '결제', icon: CreditCard },
  { key: 'privacy', label: '개인정보보호', icon: Shield },
  { key: 'location', label: '위치', icon: MapPin },
  { key: 'export', label: '데이터 내보내기', icon: Download },
]

// 사용자 통화 기반 포맷. user.currency_code 가 없으면 KRW 폴백.
const wonFor = (n: number, code?: string) => formatCurrency(n, code || 'KRW')
const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString() : '—'

export default function MyPage() {
  const { user, signout, refresh } = useAuth()
  const queryClient = useQueryClient()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('general')

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-atm-muted">
        로그인 후 이용 가능합니다. <Link to="/login" className="ml-2 text-atm-accent">로그인</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-atm-bg">
      <header className="px-6 py-4 bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/app" className="text-atm-muted hover:text-atm-ink">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-semibold text-atm-ink flex items-center gap-2">
              <UserIcon size={18} /> 마이페이지
            </h1>
          </div>
          <AppHeader variant="inline" showFaq={false} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6">
          {/* 사이드 탭 */}
          <aside>
            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
              {TABS.map((t) => {
                const Icon = t.icon
                const active = tab === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                      active
                        ? 'bg-white border border-stone-200 text-atm-ink font-medium shadow-sm'
                        : 'text-atm-muted hover:text-atm-ink hover:bg-white'
                    }`}
                  >
                    <Icon size={14} /> {t.label}
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* 본문 */}
          <section className="space-y-5">
            {tab === 'general' && (
              <GeneralTab user={user} refresh={refresh} queryClient={queryClient} />
            )}
            {tab === 'billing' && <BillingTab queryClient={queryClient} />}
            {tab === 'privacy' && (
              <PrivacyTab user={user} refresh={refresh} queryClient={queryClient} />
            )}
            {tab === 'location' && <LocationTab />}
            {tab === 'export' && <ExportTab />}

            <DangerZone
              email={user.email}
              onDeleted={() => {
                signout()
                nav('/', { replace: true })
              }}
            />
          </section>
        </div>
      </main>
    </div>
  )
}

// =================== 일반 ===================

function GeneralTab({
  user,
  refresh,
  queryClient,
}: {
  user: any
  refresh: () => Promise<void>
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const { t } = useTranslation()
  const [fullName, setFullName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [monthlyBudget, setMonthlyBudget] = useState(0)
  const [profileBusy, setProfileBusy] = useState(false)

  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)

  useEffect(() => {
    setFullName(user.full_name || '')
    setDisplayName(user.display_name || '')
    setMonthlyIncome(user.monthly_income || 0)
    setMonthlyBudget(user.monthly_budget || 0)
  }, [user])

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setProfileBusy(true)
    try {
      await authApi.updateMe({
        full_name: fullName,
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

  return (
    <>
      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide mb-3">
          계정
        </h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="text-atm-muted">이메일</div>
          <div className="text-atm-ink">{user.email}</div>
          <div className="text-atm-muted">권한</div>
          <div className="text-atm-ink">
            {user.is_admin ? <span className="text-atm-accent font-medium">관리자</span> : '일반 회원'}
          </div>
        </div>
      </div>

      <form
        onSubmit={saveProfile}
        className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3"
      >
        <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide">프로필</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-atm-muted">이름</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={80}
              placeholder="홍길동"
              className="mt-1 w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
            />
          </label>
          <label className="block">
            <span className="text-xs text-atm-muted">닉네임</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              placeholder="가계부지킴이"
              className="mt-1 w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
            />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-atm-muted">월 수입 (원)</span>
            <input
              type="number"
              min={0}
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(Number(e.target.value) || 0)}
              className="mt-1 w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
            />
            <span className="text-[10px] text-atm-muted">{wonFor(monthlyIncome, user.currency_code)}</span>
          </label>
          <label className="block">
            <span className="text-xs text-atm-muted">월 예산 (원)</span>
            <input
              type="number"
              min={0}
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(Number(e.target.value) || 0)}
              className="mt-1 w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
            />
            <span className="text-[10px] text-atm-muted">{wonFor(monthlyBudget, user.currency_code)}</span>
          </label>
        </div>
        <button
          type="submit"
          disabled={profileBusy}
          className="px-4 py-2 bg-atm-accent text-white rounded-lg text-sm disabled:opacity-50"
        >
          {profileBusy ? '저장 중…' : '프로필 저장'}
        </button>
      </form>

      <RegionSection user={user} refresh={refresh} />

      <form
        onSubmit={changePw}
        className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3 max-w-md"
      >
        <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide flex items-center gap-2">
          <KeyRound size={14} /> 비밀번호 수정
        </h2>
        <input
          type={showPw ? 'text' : 'password'}
          required
          value={curPw}
          onChange={(e) => setCurPw(e.target.value)}
          placeholder="현재 비밀번호"
          className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
        />
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            required
            minLength={8}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="새 비밀번호 (8자 이상)"
            className="w-full px-3 py-2 pr-10 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-atm-muted hover:text-atm-ink p-1"
          >
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pwBusy}
            className="px-4 py-2 bg-atm-accent text-white rounded-lg text-sm disabled:opacity-50"
          >
            {pwBusy ? '변경 중…' : '비밀번호 변경'}
          </button>
          <Link to="/forgot-password" className="text-xs text-atm-muted hover:text-atm-ink underline">
            비밀번호를 잊으셨나요?
          </Link>
        </div>
      </form>
    </>
  )
}

// =================== 결제 ===================

function BillingTab({
  queryClient,
}: {
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const q = useQuery({
    queryKey: ['me', 'billing'],
    queryFn: () => meApi.billing().then((r) => r.data),
    staleTime: 30_000,
  })

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['me', 'billing'] })
  const [params, setParams] = useSearchParams()

  // Toss 위젯이 success_url 로 돌려준 authKey/customerKey 를 백엔드 confirm 으로 교환
  useEffect(() => {
    const authKey = params.get('authKey')
    const customerKey = params.get('customerKey')
    const billingResult = params.get('billing')
    if (authKey && customerKey) {
      ;(async () => {
        try {
          await meApi.tossConfirm(authKey, customerKey)
          toast.success('결제가 완료되었습니다.')
          refetch()
        } catch (err: any) {
          toast.error(err?.response?.data?.detail || '결제 확정 실패')
        } finally {
          const next = new URLSearchParams(params)
          next.delete('authKey')
          next.delete('customerKey')
          next.delete('billing')
          next.delete('code')
          next.delete('message')
          setParams(next, { replace: true })
        }
      })()
    } else if (billingResult === 'fail') {
      toast.error(params.get('message') || '결제 창에서 취소되었습니다.')
      const next = new URLSearchParams(params)
      next.delete('billing')
      next.delete('code')
      next.delete('message')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const upgrade = async () => {
    const b = q.data
    if (b?.beta_free_mode) {
      toast('베타 기간 동안은 모든 기능이 무료입니다.', { icon: '🎉' })
      return
    }
    if (b?.toss_configured && b.toss_client_key && b.customer_key) {
      try {
        const widget = await loadPaymentWidget(b.toss_client_key, b.customer_key)
        const base = window.location.origin
        await widget.requestBillingAuth('카드', {
          customerEmail: undefined,
          successUrl: `${base}/me?billing=success`,
          failUrl: `${base}/me?billing=fail`,
        })
      } catch (err: any) {
        toast.error(err?.message || '결제창을 열지 못했습니다.')
      }
      return
    }
    // Toss 미설정 시: 데모 mock
    const ok = window.confirm(
      `월 ₩${(b?.price_krw_monthly ?? 5400).toLocaleString()} (≈ $${b?.price_usd_monthly ?? 4}) 유료 플랜으로 업그레이드하시겠습니까?\n\n` +
        '※ 현재 결제 게이트웨이가 운영자 환경에 연결되지 않았습니다.\n' +
        '데모용 즉시 전환이 됩니다 (실 결제 없음).',
    )
    if (!ok) return
    try {
      await meApi.upgrade()
      toast.success('유료 플랜으로 전환되었습니다.')
      refetch()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '업그레이드 실패')
    }
  }

  const changeCard = async () => {
    // 동일 흐름 — 빌링키 재발급. 기존 카드는 폐기.
    return upgrade()
  }

  const cancel = async () => {
    const b = q.data
    const ok = window.confirm(
      '유료 플랜을 해지하시겠습니까?\n' +
        '· 카드 빌링키가 즉시 폐기되며, 다음 결제는 청구되지 않습니다.\n' +
        '· 이번 결제 기간이 끝나면 자동으로 무료로 전환됩니다.',
    )
    if (!ok) return
    try {
      if (b?.toss_configured) {
        await meApi.tossCancel()
      } else {
        await meApi.cancel()
      }
      toast.success('해지 처리되었습니다.')
      refetch()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '해지 실패')
    }
  }

  const b = q.data
  if (!b) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-5 text-sm text-atm-muted">
        {q.isLoading ? '불러오는 중…' : '구독 정보를 가져올 수 없습니다.'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {b.beta_free_mode && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm">
          <div className="font-medium text-emerald-800 mb-1">🎉 베타 기간 무료 운영 중</div>
          <div className="text-emerald-700 text-xs leading-relaxed">
            현재 모든 기능을 무료로 이용할 수 있어요. 엑셀 내보내기·전체 가계부 기능 포함.
            정식 유료화(<strong>₩{b.price_krw_monthly.toLocaleString()} / 월</strong>)와 결제 시스템(Toss Payments)은
            현재 <strong>테스트 모드</strong>로 준비되어 있으며, 베타 종료 시 별도 안내드립니다.
          </div>
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide mb-3 flex items-center gap-2">
          <CreditCard size={14} /> 결제 상태
        </h2>
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              b.tier === 'paid'
                ? 'bg-atm-accent/10 text-atm-accent'
                : b.active
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {b.tier === 'paid' ? '유료' : b.active ? '무료 (트라이얼 중)' : '만료됨'}
          </span>
          <span className="text-xs text-atm-muted">{b.days_remaining}일 남음</span>
          {b.subscription_status === 'past_due' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700">
              결제 보류
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <div className="text-atm-muted">무료 트라이얼 만료</div>
          <div className="text-atm-ink">{fmtDate(b.free_trial_ends_at)}</div>
          {b.paid_until && (
            <>
              <div className="text-atm-muted">유료 유효</div>
              <div className="text-atm-ink">~ {fmtDate(b.paid_until)}</div>
            </>
          )}
          <div className="text-atm-muted">유료 가격</div>
          <div className="text-atm-ink">
            ₩{b.price_krw_monthly.toLocaleString()} / 월{' '}
            <span className="text-xs text-atm-muted">(≈ ${b.price_usd_monthly})</span>
          </div>
          {b.card_brand && b.card_last4 && (
            <>
              <div className="text-atm-muted">등록 카드</div>
              <div className="text-atm-ink">
                {b.card_brand} · **** {b.card_last4}
              </div>
            </>
          )}
        </div>
        {b.tier === 'paid' && b.toss_configured && (
          <button
            type="button"
            onClick={changeCard}
            className="mt-3 text-xs underline text-atm-muted hover:text-atm-ink"
          >
            결제수단 변경 (새 카드 등록)
          </button>
        )}
        {b.last_billing_error && (
          <div className="mt-3 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl p-2">
            마지막 결제 오류: <span className="font-mono">{b.last_billing_error}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlanCard
          title="무료"
          price="₩ 0"
          features={['가입 후 1개월 가계부 이용', 'AI 분류·캘린더·회고', '장소 핀과 후기', '내 데이터 JSON 익스포트']}
          highlight={b.tier === 'free'}
        />
        <PlanCard
          title="유료"
          price={`₩${b.price_krw_monthly.toLocaleString()} / 월`}
          features={[
            '무료 모든 기능',
            '가계부 지속 이용',
            '엑셀(.xlsx) 월별·연간 내보내기',
            '우선 지원',
          ]}
          highlight={b.tier === 'paid' && !b.beta_free_mode}
          actionLabel={
            b.beta_free_mode
              ? '베타 기간 무료'
              : b.tier === 'paid'
              ? '해지'
              : '업그레이드'
          }
          onAction={b.tier === 'paid' ? cancel : upgrade}
          actionDisabled={b.beta_free_mode}
        />
      </div>

      {b.toss_configured ? (
        <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          ✅ Toss Payments 정기결제 연결됨. 카드 1회 등록 후 매월 자동 청구됩니다 (한국 PG).
          {b.subscription_status && (
            <span className="ml-1 font-mono">(status: {b.subscription_status})</span>
          )}
        </div>
      ) : (
        <div className="text-[11px] text-atm-muted bg-stone-50 border border-stone-200 rounded-xl p-3">
          💡 현재 운영자 환경에 Toss 키가 입력되어 있지 않아 데모 모드입니다 (실 결제 없음).
          <code className="mx-1">TOSS_SECRET_KEY</code> 와 <code className="mx-1">TOSS_CLIENT_KEY</code>
          가 Railway 에 설정되면 자동으로 실 결제 흐름이 활성화됩니다.
        </div>
      )}
    </div>
  )
}

function PlanCard({
  title,
  price,
  features,
  highlight,
  actionLabel,
  onAction,
  actionDisabled,
}: {
  title: string
  price: string
  features: string[]
  highlight?: boolean
  actionLabel?: string
  onAction?: () => void
  actionDisabled?: boolean
}) {
  return (
    <div
      className={`bg-white border rounded-2xl p-5 ${
        highlight ? 'border-atm-accent shadow-sm' : 'border-stone-200'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-atm-ink">{title}</h3>
        {highlight && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-atm-accent/10 text-atm-accent font-medium">
            현재 플랜
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold text-atm-ink mb-3">{price}</div>
      <ul className="space-y-1 text-sm text-atm-muted mb-4">
        {features.map((f) => (
          <li key={f}>· {f}</li>
        ))}
      </ul>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className={`w-full py-2 rounded-lg text-sm font-medium ${
            actionDisabled
              ? 'border border-stone-200 text-atm-muted cursor-not-allowed opacity-60'
              : highlight
              ? 'border border-stone-200 text-atm-muted hover:bg-stone-50'
              : 'bg-atm-accent text-white hover:opacity-90'
          }`}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

// =================== 개인정보보호 ===================

function PrivacyTab({
  user,
  refresh,
  queryClient,
}: {
  user: any
  refresh: () => Promise<void>
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const [allow, setAllow] = useState<boolean>(!!user.allow_location_metadata)
  const [busy, setBusy] = useState(false)

  useEffect(() => setAllow(!!user.allow_location_metadata), [user.allow_location_metadata])

  const save = async (next: boolean) => {
    setBusy(true)
    try {
      await authApi.updateMe({ allow_location_metadata: next })
      setAllow(next)
      await refresh()
      queryClient.invalidateQueries({ queryKey: ['me', 'geo'] })
      toast.success(next ? '위치 메타데이터 사용을 허용했습니다.' : '위치 메타데이터 사용을 해제했습니다.')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '저장 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide flex items-center gap-2">
        <Shield size={14} /> 개인정보보호
      </h2>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={allow}
          disabled={busy}
          onChange={(e) => save(e.target.checked)}
          className="mt-1 accent-atm-accent w-4 h-4"
        />
        <span className="text-sm">
          <div className="text-atm-ink font-medium">위치 메타데이터 사용 허용</div>
          <div className="text-xs text-atm-muted mt-1 leading-relaxed">
            Claude 가 제품 경험을 개선하기 위해 대략적인 위치 메타데이터(도시 / 지역)를 사용할 수 있도록 허용합니다.
            정확한 좌표는 사용되지 않으며, IP 기반 추정만 활용됩니다.{' '}
            <Link to="/privacy" className="underline text-atm-accent">자세히 알아보기</Link>
          </div>
          <div className="text-[11px] text-atm-muted mt-2">
            {allow ? '✓ 현재 사용 중 — 가계부 입력 시 주변 장소 자동 추천에 활용됩니다.' : '○ 해제됨 — IP 기반 위치 추정을 사용하지 않습니다.'}
          </div>
        </span>
      </label>
    </div>
  )
}

// =================== 위치 ===================

function LocationTab() {
  const q = useQuery({
    queryKey: ['me', 'geo'],
    queryFn: () => meApi.geo().then((r) => r.data),
    staleTime: 60_000,
  })

  const g = q.data

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide flex items-center gap-2">
        <MapPin size={14} /> 위치
      </h2>
      <p className="text-sm text-atm-muted">
        가계부 입력 시 장소를 연결하면 <strong>접속한 IP(모바일·PC)</strong> 기반으로 주변 위치가 우선 제안됩니다.
        결과가 부정확하면 장소 상세 화면에서 검색·지도로 직접 수정할 수 있습니다.
      </p>

      {!g || !g.enabled ? (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm text-atm-muted">
          위치 메타데이터 사용이 해제되어 있습니다. <strong>개인정보보호</strong> 탭에서 허용하면 자동 추정이 활성화됩니다.
        </div>
      ) : !g.lat || !g.lng ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          IP 기반 위치 추정이 일시 실패했어요. 새로고침하거나 잠시 후 다시 시도해 주세요.
          {g.ip && <div className="text-xs mt-1">감지된 IP: {g.ip}</div>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <div className="text-atm-muted">국가</div>
            <div className="text-atm-ink">{g.country || '—'}</div>
            <div className="text-atm-muted">시·도</div>
            <div className="text-atm-ink">{g.region || '—'}</div>
            <div className="text-atm-muted">도시</div>
            <div className="text-atm-ink">{g.city || '—'}</div>
            <div className="text-atm-muted">위·경도</div>
            <div className="text-atm-ink font-mono text-xs">
              {g.lat?.toFixed(4)}, {g.lng?.toFixed(4)}
            </div>
            <div className="text-atm-muted">IP</div>
            <div className="text-atm-ink font-mono text-xs">{g.ip || '—'}</div>
            <div className="text-atm-muted">데이터 출처</div>
            <div className="text-atm-ink text-xs">
              {g.cached ? '캐시 (최근 1시간)' : '방금 새로 추정'}
            </div>
          </div>
          <iframe
            title="map"
            width="100%"
            height="220"
            style={{ border: 0, borderRadius: 12 }}
            src={`https://maps.google.com/maps?q=${g.lat},${g.lng}&z=11&output=embed`}
            loading="lazy"
          />
          <div className="text-[11px] text-atm-muted flex items-center gap-1.5">
            <Globe2 size={11} /> 수동 수정은 각 가계부 항목의 장소 상세 화면에서 검색·지도 클릭으로 진행하세요.
          </div>
        </div>
      )}
    </div>
  )
}

// =================== 데이터 내보내기 ===================

function ExportTab() {
  const billing = useQuery({
    queryKey: ['me', 'billing'],
    queryFn: () => meApi.billing().then((r) => r.data),
    staleTime: 30_000,
  })

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisYear = String(now.getFullYear())
  const [month, setMonth] = useState(thisMonth)
  const [year, setYear] = useState(thisYear)

  const active = billing.data?.active === true

  const download = async (params: { period: 'monthly'; month: string } | { period: 'annual'; year: string }) => {
    if (!active) {
      toast.error('무료 트라이얼이 만료되었습니다. 유료로 업그레이드해 주세요.')
      return
    }
    try {
      const res = await meApi.exportXlsx(params)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = params.period === 'monthly' ? `moa-ai-${params.month}.xlsx` : `moa-ai-${params.year}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('엑셀 다운로드를 시작합니다.')
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      toast.error(detail || '내보내기 실패')
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide mb-3 flex items-center gap-2">
          <Download size={14} /> 가계부 내역 엑셀 내보내기
        </h2>
        <p className="text-xs text-atm-muted mb-4">
          .xlsx 파일로 다운로드. 월별 시트 한 장 또는 연간 12개월 + 요약 시트.
        </p>

        <div className="space-y-3">
          <div className="flex items-end gap-2 flex-wrap">
            <label className="flex-1 min-w-[160px]">
              <span className="text-xs text-atm-muted">월별</span>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
              />
            </label>
            <button
              type="button"
              disabled={!active}
              onClick={() => download({ period: 'monthly', month })}
              className="px-3 py-2 bg-atm-accent text-white rounded-lg text-sm disabled:opacity-50"
            >
              월별 다운로드
            </button>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <label className="flex-1 min-w-[160px]">
              <span className="text-xs text-atm-muted">연간</span>
              <input
                type="number"
                min={2020}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
              />
            </label>
            <button
              type="button"
              disabled={!active}
              onClick={() => download({ period: 'annual', year })}
              className="px-3 py-2 bg-atm-accent text-white rounded-lg text-sm disabled:opacity-50"
            >
              연간 다운로드
            </button>
          </div>
        </div>

        {!active && !billing.data?.beta_free_mode && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            엑셀 내보내기는 유료 플랜에서 제공됩니다.{' '}
            <strong>결제 탭</strong>에서 업그레이드하시면 즉시 이용 가능합니다.
          </div>
        )}
        {billing.data?.beta_free_mode && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800">
            🎉 베타 기간 동안 무료로 엑셀 내보내기를 사용할 수 있어요.
          </div>
        )}
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-atm-muted uppercase tracking-wide mb-2">
          전체 데이터 (GDPR)
        </h3>
        <p className="text-xs text-atm-muted mb-3">
          가계부 + 예정 + 회고 + 사진 메타데이터를 JSON 으로 내려받습니다. 어떤 플랜에서도 항상 가능합니다.
        </p>
        <button
          type="button"
          onClick={async () => {
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
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-stone-200 rounded-lg text-sm hover:bg-stone-50"
        >
          <Download size={13} /> 전체 데이터 (JSON)
        </button>
      </div>
    </div>
  )
}

// =================== Danger Zone ===================

function DangerZone({ email, onDeleted }: { email: string; onDeleted: () => void }) {
  const deleteAccount = async () => {
    const ok = window.confirm(
      `정말 탈퇴하시겠습니까?\n\n` +
        `· 로그인이 즉시 차단됩니다.\n` +
        `· 가계부 데이터는 일정 기간 보존된 뒤 영구 삭제됩니다.\n` +
        `· 완전 삭제를 원하시면 먼저 데이터를 내보내고 운영자에게 문의해 주세요.`,
    )
    if (!ok) return
    const phrase = window.prompt('탈퇴하려면 본인 이메일을 입력해 주세요.')
    if (!phrase || phrase.trim().toLowerCase() !== email.toLowerCase()) {
      toast.error('이메일 불일치. 작업 취소.')
      return
    }
    try {
      await authApi.deleteMe()
      toast.success('탈퇴 처리되었습니다.')
      onDeleted()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || '탈퇴 실패')
    }
  }

  return (
    <div className="bg-white border border-red-200 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-2">위험 영역</h3>
      <p className="text-xs text-atm-muted mb-3">
        탈퇴 시 로그인이 즉시 차단됩니다. 가계부 데이터는 일정 기간 보존된 뒤 영구 삭제됩니다.
      </p>
      <button
        type="button"
        onClick={deleteAccount}
        className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-700 rounded-lg text-sm hover:bg-red-50"
      >
        <Trash2 size={13} /> 탈퇴
      </button>
    </div>
  )
}

// =================== 지역화 (국가 / 통화 / 언어) ===================

function RegionSection({
  user,
  refresh,
}: {
  user: any
  refresh: () => Promise<void>
}) {
  const { t, i18n: i18nInst } = useTranslation()
  const [country, setCountry] = useState<string>(user.country_code || 'KR')
  const [currency, setCurrency] = useState<string>(user.currency_code || 'KRW')
  const [locale, setLocale] = useState<string>(user.locale || 'ko')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setCountry(user.country_code || 'KR')
    setCurrency(user.currency_code || 'KRW')
    setLocale(user.locale || 'ko')
  }, [user.country_code, user.currency_code, user.locale])

  const useKoreanLabel = i18nInst.language?.startsWith('ko')
  const countryOptions = useMemo(
    () =>
      [...COUNTRY_LIST]
        .map((c) => ({ code: c.code, label: useKoreanLabel ? c.nameKo : c.nameEn }))
        .sort((a, b) => a.label.localeCompare(b.label, useKoreanLabel ? 'ko' : 'en')),
    [useKoreanLabel],
  )

  const applyDefaults = () => {
    const d = countryDefaults(country)
    setCurrency(d.currency_code)
    setLocale(d.locale)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await authApi.updateMe({
        country_code: country,
        currency_code: currency,
        locale,
      })
      await refresh()
      if (i18n.language !== locale) await i18n.changeLanguage(locale)
      toast.success(t('mypage.region.saved'))
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={save}
      className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3"
    >
      <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide flex items-center gap-2">
        <Globe2 size={14} /> {t('mypage.region.title')}
      </h2>
      <p className="text-xs text-atm-muted">{t('mypage.region.subtitle')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs text-atm-muted">{t('mypage.region.country')}</span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:border-atm-accent"
          >
            {countryOptions.map((c) => (
              <option key={c.code} value={c.code}>{c.label} ({c.code})</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-atm-muted">{t('mypage.region.currency')}</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:border-atm-accent"
          >
            {[...SUPPORTED_CURRENCIES].sort().map((cur) => (
              <option key={cur} value={cur}>{cur}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-atm-muted">{t('mypage.region.language')}</span>
          <select
            value={locale}
            onChange={(e) => {
              const next = e.target.value
              setLocale(next)
              // 즉시 UI 미리보기 — 저장은 별도 Save 버튼에서 PATCH /auth/me 로 영속.
              // (구 AppHeader 의 LanguageSwitcher 즉시 전환 UX 보존)
              if (i18n.language !== next) i18n.changeLanguage(next)
            }}
            className="mt-1 w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:border-atm-accent"
          >
            {SUPPORTED_LOCALES.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 bg-atm-accent text-white rounded-lg text-sm disabled:opacity-50"
        >
          {busy ? '...' : t('common.save')}
        </button>
        <button
          type="button"
          onClick={applyDefaults}
          className="px-3 py-2 border border-stone-200 text-atm-muted rounded-lg text-xs hover:bg-stone-50"
        >
          {t('mypage.region.applyDefaults')}
        </button>
      </div>
    </form>
  )
}
