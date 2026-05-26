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
import { App as CapacitorApp } from '@capacitor/app'
import { authApi, meApi } from '../services/api'
import { isNative, openExternalCheckout } from '../services/platform'
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

// 사용자 통화 기반 포맷. user.currency_code 가 없으면 KRW 폴백.
const wonFor = (n: number, code?: string) => formatCurrency(n, code || 'KRW')
const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString() : '—'

export default function MyPage() {
  const { t } = useTranslation()
  const { user, signout, refresh } = useAuth()
  const queryClient = useQueryClient()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('general')

  // i18n.changeLanguage 가 호출되면 t() 가 새 값을 반환하도록 컴포넌트 안에서 매번 생성.
  const TABS: { key: Tab; label: string; icon: typeof UserIcon }[] = [
    { key: 'general', label: t('mypage.tabs.general'), icon: UserIcon },
    { key: 'billing', label: t('mypage.tabs.billing'), icon: CreditCard },
    { key: 'privacy', label: t('mypage.tabs.privacy'), icon: Shield },
    { key: 'location', label: t('mypage.tabs.location'), icon: MapPin },
    { key: 'export', label: t('mypage.tabs.export'), icon: Download },
  ]

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-atm-muted">
        {t('mypage.requireLogin')} <Link to="/login" className="ml-2 text-atm-accent">{t('mypage.requireLoginCta')}</Link>
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
              <UserIcon size={18} /> {t('mypage.title')}
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
              {TABS.map((tabItem) => {
                const Icon = tabItem.icon
                const active = tab === tabItem.key
                return (
                  <button
                    key={tabItem.key}
                    type="button"
                    onClick={() => setTab(tabItem.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                      active
                        ? 'bg-white border border-stone-200 text-atm-ink font-medium shadow-sm'
                        : 'text-atm-muted hover:text-atm-ink hover:bg-white'
                    }`}
                  >
                    <Icon size={14} /> {tabItem.label}
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
      toast.success(t('mypage.toasts.profileSaved'))
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('mypage.toasts.saveFailed'))
    } finally {
      setProfileBusy(false)
    }
  }

  const changePw = async (e: FormEvent) => {
    e.preventDefault()
    if (newPw.length < 8) {
      toast.error(t('mypage.password.minLength'))
      return
    }
    setPwBusy(true)
    try {
      const r = await authApi.changePassword(curPw, newPw)
      toast.success(r.data.message || t('mypage.password.changed'))
      setCurPw('')
      setNewPw('')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('mypage.password.changeFailed'))
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <>
      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide mb-3">
          {t('mypage.account.title')}
        </h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="text-atm-muted">{t('mypage.account.email')}</div>
          <div className="text-atm-ink">{user.email}</div>
          <div className="text-atm-muted">{t('mypage.account.role')}</div>
          <div className="text-atm-ink">
            {user.is_admin ? <span className="text-atm-accent font-medium">{t('mypage.account.admin')}</span> : t('mypage.account.user')}
          </div>
        </div>
      </div>

      <form
        onSubmit={saveProfile}
        className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3"
      >
        <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide">{t('mypage.profile.title')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-atm-muted">{t('mypage.profile.name')}</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={80}
              placeholder={t('mypage.profile.namePlaceholder')}
              className="mt-1 w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
            />
          </label>
          <label className="block">
            <span className="text-xs text-atm-muted">{t('mypage.profile.displayName')}</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              placeholder={t('mypage.profile.displayNamePlaceholder')}
              className="mt-1 w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
            />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-atm-muted">{t('mypage.profile.monthlyIncome')}</span>
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
            <span className="text-xs text-atm-muted">{t('mypage.profile.monthlyBudget')}</span>
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
          {profileBusy ? t('mypage.profile.saving') : t('mypage.profile.save')}
        </button>
      </form>

      <RegionSection user={user} refresh={refresh} />

      <form
        onSubmit={changePw}
        className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3 max-w-md"
      >
        <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide flex items-center gap-2">
          <KeyRound size={14} /> {t('mypage.password.title')}
        </h2>
        <input
          type={showPw ? 'text' : 'password'}
          required
          value={curPw}
          onChange={(e) => setCurPw(e.target.value)}
          placeholder={t('mypage.password.current')}
          className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-atm-accent"
        />
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            required
            minLength={8}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder={t('mypage.password.newPlaceholder')}
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
            {pwBusy ? t('mypage.password.changing') : t('mypage.password.change')}
          </button>
          <Link to="/forgot-password" className="text-xs text-atm-muted hover:text-atm-ink underline">
            {t('mypage.password.forgot')}
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
  const { t } = useTranslation()
  const q = useQuery({
    queryKey: ['me', 'billing'],
    queryFn: () => meApi.billing().then((r) => r.data),
    staleTime: 30_000,
  })

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['me', 'billing'] })
  const [params, setParams] = useSearchParams()
  const [lsCheckoutLoading, setLsCheckoutLoading] = useState(false)

  const startLsCheckout = async () => {
    setLsCheckoutLoading(true)
    try {
      // plan 미지정 — 백엔드가 설정된 variant 자동 선택, LS 페이지에서 월/연 선택 가능.
      const { data } = await meApi.lemonSqueezyCheckoutUrl()
      toast(t('mypage.billing.returnHint'), {
        duration: 4000,
        icon: '🪟',
      })
      // 네이티브(Android)면 Chrome Custom Tab, 웹이면 같은 탭 이동.
      await openExternalCheckout(data.url)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 409) {
        toast(t('mypage.billing.betaActive'), { icon: '🎉' })
      } else if (status === 503) {
        toast.error(t('mypage.billing.checkoutUnavailable'))
      } else {
        toast.error(err?.response?.data?.detail || t('mypage.billing.checkoutError'))
      }
    } finally {
      setLsCheckoutLoading(false)
    }
  }

  // Toss 위젯이 success_url 로 돌려준 authKey/customerKey 를 백엔드 confirm 으로 교환
  useEffect(() => {
    const authKey = params.get('authKey')
    const customerKey = params.get('customerKey')
    const billingResult = params.get('billing')
    if (authKey && customerKey) {
      ;(async () => {
        try {
          await meApi.tossConfirm(authKey, customerKey)
          toast.success(t('mypage.billing.paymentComplete'))
          refetch()
        } catch (err: any) {
          toast.error(err?.response?.data?.detail || t('mypage.billing.confirmFailed'))
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
      toast.error(params.get('message') || t('mypage.billing.paymentCancelled'))
      const next = new URLSearchParams(params)
      next.delete('billing')
      next.delete('code')
      next.delete('message')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // LS 외부 체크아웃에서 돌아왔을 때 결제 상태 자동 refetch.
  // 네이티브(Android): Capacitor App.resume — Chrome Custom Tab 이 닫히고 Activity 가
  //   포그라운드로 돌아올 때 결정적으로 발화. (Samsung/MIUI 등 일부 OEM 에서 WebView 의
  //   visibilitychange 가 안 터지는 케이스를 회피.)
  // 웹: visibilitychange — 탭이 다시 보이면 발화.
  // invalidateQueries 는 staleTime 을 무시하고 강제 refetch 한다.
  useEffect(() => {
    const refetchBilling = () =>
      queryClient.invalidateQueries({ queryKey: ['me', 'billing'] })

    if (isNative()) {
      let remove: (() => void) | null = null
      CapacitorApp.addListener('resume', refetchBilling).then((handle) => {
        remove = () => handle.remove()
      })
      return () => {
        remove?.()
      }
    }

    const onVis = () => {
      if (document.visibilityState === 'visible') refetchBilling()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [queryClient])

  const upgrade = async () => {
    const b = q.data
    if (b?.beta_free_mode) {
      toast(t('mypage.billing.betaModeNotice'), { icon: '🎉' })
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
        toast.error(err?.message || t('mypage.billing.widgetFailed'))
      }
      return
    }
    // Toss 미설정 시: 데모 mock
    const priceStr = `₩${(b?.price_krw_monthly ?? 5500).toLocaleString()} (≈ $${b?.price_usd_monthly ?? 4})`
    const ok = window.confirm(t('mypage.billing.upgradeMockConfirm', { price: priceStr }))
    if (!ok) return
    try {
      await meApi.upgrade()
      toast.success(t('mypage.billing.upgradedMock'))
      refetch()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('mypage.billing.upgradeFailed'))
    }
  }

  const changeCard = async () => {
    // 동일 흐름 — 빌링키 재발급. 기존 카드는 폐기.
    return upgrade()
  }

  const cancel = async () => {
    const b = q.data
    const ok = window.confirm(t('mypage.billing.cancelConfirm'))
    if (!ok) return
    try {
      if (b?.toss_configured) {
        await meApi.tossCancel()
      } else {
        await meApi.cancel()
      }
      toast.success(t('mypage.billing.cancelled'))
      refetch()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('mypage.billing.cancelFailed'))
    }
  }

  const b = q.data
  if (!b) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-5 text-sm text-atm-muted">
        {q.isLoading ? t('common.loading') : t('mypage.billing.loadFailed')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {b.beta_free_mode && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm">
          <div className="font-medium text-emerald-800 mb-1">{t('mypage.billing.betaBannerTitle')}</div>
          <div className="text-emerald-700 text-xs leading-relaxed">
            {t('mypage.billing.betaBannerBody')}
          </div>
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide mb-3 flex items-center gap-2">
          <CreditCard size={14} /> {t('mypage.billing.statusTitle')}
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
            {b.tier === 'paid' ? t('mypage.billing.tierPaid') : b.active ? t('mypage.billing.tierFreeTrial') : t('mypage.billing.tierExpired')}
          </span>
          <span className="text-xs text-atm-muted">{t('mypage.billing.daysRemaining', { n: b.days_remaining })}</span>
          {b.subscription_status === 'past_due' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700">
              {t('mypage.billing.pastDue')}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <div className="text-atm-muted">{t('mypage.billing.trialEndsAt')}</div>
          <div className="text-atm-ink">{fmtDate(b.free_trial_ends_at)}</div>
          {b.paid_until && (
            <>
              <div className="text-atm-muted">{t('mypage.billing.paidUntil')}</div>
              <div className="text-atm-ink">~ {fmtDate(b.paid_until)}</div>
            </>
          )}
          <div className="text-atm-muted">{t('mypage.billing.price')}</div>
          <div className="text-atm-ink">
            ₩{b.price_krw_monthly.toLocaleString()} {t('mypage.billing.perMonth')}{' '}
            <span className="text-xs text-atm-muted">(≈ ${b.price_usd_monthly})</span>
          </div>
          {b.card_brand && b.card_last4 && (
            <>
              <div className="text-atm-muted">{t('mypage.billing.cardOnFile')}</div>
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
            {t('mypage.billing.changeCard')}
          </button>
        )}
        {b.last_billing_error && (
          <div className="mt-3 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl p-2">
            {t('mypage.billing.lastError')}: <span className="font-mono">{b.last_billing_error}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlanCard
          title={t('mypage.billing.freeTitle')}
          price="₩ 0"
          features={[
            t('mypage.billing.freeFeature1'),
            t('mypage.billing.freeFeature2'),
            t('mypage.billing.freeFeature3'),
            t('mypage.billing.freeFeature4'),
          ]}
          highlight={b.tier === 'free'}
        />

        {/* 유료 — LS 듀얼 플랜(월/연) + Toss 보조 옵션 */}
        <div
          className={`bg-white border rounded-2xl p-5 ${
            b.tier === 'paid' && !b.beta_free_mode
              ? 'border-atm-accent shadow-sm'
              : 'border-stone-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold text-atm-ink">{t('mypage.billing.paidTitle')}</h3>
            {b.tier === 'paid' && !b.beta_free_mode && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-atm-accent/10 text-atm-accent font-medium">
                {t('mypage.billing.currentPlan')}
              </span>
            )}
          </div>
          <div className="mb-1">
            <div className="text-2xl font-semibold text-atm-ink">{t('mypage.billing.priceMonthlyText')}</div>
            <div className="text-xs text-atm-muted mt-0.5">
              {t('mypage.billing.priceYearlyText')}
            </div>
          </div>
          <ul className="space-y-1 text-sm text-atm-muted mb-4 mt-3">
            <li>· {t('mypage.billing.paidFeature1')}</li>
            <li>· {t('mypage.billing.paidFeature2')}</li>
            <li>· {t('mypage.billing.paidFeature3')}</li>
            <li>· {t('mypage.billing.paidFeature4')}</li>
          </ul>

          {b.beta_free_mode ? (
            <button
              type="button"
              disabled
              className="w-full py-2 rounded-lg text-sm font-medium border border-stone-200 text-atm-muted cursor-not-allowed opacity-60"
            >
              {t('mypage.billing.betaButtonLabel')}
            </button>
          ) : b.tier === 'paid' ? (
            <button
              type="button"
              onClick={cancel}
              className="w-full py-2 rounded-lg text-sm font-medium border border-stone-200 text-atm-muted hover:bg-stone-50"
            >
              {t('mypage.billing.cancelButton')}
            </button>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={startLsCheckout}
                disabled={lsCheckoutLoading || !b.lemonsqueezy_configured}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-atm-accent text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {lsCheckoutLoading ? t('mypage.billing.checkoutLoading') : t('mypage.billing.checkoutStart')}
              </button>
              <p className="text-[11px] text-atm-muted text-center">
                {t('mypage.billing.planSelectionHint')}
              </p>
              {b.toss_configured && (
                <button
                  type="button"
                  onClick={upgrade}
                  className="block w-full text-center text-xs text-atm-muted hover:text-atm-ink underline mt-1"
                >
                  {t('mypage.billing.tossLink')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 결제 게이트웨이 상태 안내 — LS 우선, Toss 보조 */}
      {b.lemonsqueezy_configured ? (
        <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          {t('mypage.billing.lsConnected')}
          {b.toss_configured && ' ' + t('mypage.billing.tossAlsoActive')}
        </div>
      ) : (
        <div className="text-[11px] text-atm-muted bg-stone-50 border border-stone-200 rounded-xl p-3">
          {t('mypage.billing.lsUnconfigured')}
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
  const { t } = useTranslation()
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
            {t('mypage.billing.currentPlan')}
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
  const { t } = useTranslation()
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
      toast.success(next ? t('mypage.privacy.toggledOn') : t('mypage.privacy.toggledOff'))
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('mypage.toasts.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide flex items-center gap-2">
        <Shield size={14} /> {t('mypage.privacy.title')}
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
          <div className="text-atm-ink font-medium">{t('mypage.privacy.locationOptInTitle')}</div>
          <div className="text-xs text-atm-muted mt-1 leading-relaxed">
            {t('mypage.privacy.locationOptInBody')}{' '}
            <Link to="/privacy" className="underline text-atm-accent">{t('mypage.privacy.learnMore')}</Link>
          </div>
          <div className="text-[11px] text-atm-muted mt-2">
            {allow ? t('mypage.privacy.activeNote') : t('mypage.privacy.inactiveNote')}
          </div>
        </span>
      </label>
    </div>
  )
}

// =================== 위치 ===================

function LocationTab() {
  const { t } = useTranslation()
  const q = useQuery({
    queryKey: ['me', 'geo'],
    queryFn: () => meApi.geo().then((r) => r.data),
    staleTime: 60_000,
  })

  const g = q.data

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide flex items-center gap-2">
        <MapPin size={14} /> {t('mypage.location.title')}
      </h2>
      <p className="text-sm text-atm-muted">
        {t('mypage.location.intro')}
      </p>

      {!g || !g.enabled ? (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm text-atm-muted">
          {t('mypage.location.disabledNotice')}
        </div>
      ) : !g.lat || !g.lng ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          {t('mypage.location.tempFailure')}
          {g.ip && <div className="text-xs mt-1">{t('mypage.location.detectedIp')}: {g.ip}</div>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <div className="text-atm-muted">{t('mypage.location.country')}</div>
            <div className="text-atm-ink">{g.country || '—'}</div>
            <div className="text-atm-muted">{t('mypage.location.region')}</div>
            <div className="text-atm-ink">{g.region || '—'}</div>
            <div className="text-atm-muted">{t('mypage.location.city')}</div>
            <div className="text-atm-ink">{g.city || '—'}</div>
            <div className="text-atm-muted">{t('mypage.location.coordinates')}</div>
            <div className="text-atm-ink font-mono text-xs">
              {g.lat?.toFixed(4)}, {g.lng?.toFixed(4)}
            </div>
            <div className="text-atm-muted">{t('mypage.location.ipLabel')}</div>
            <div className="text-atm-ink font-mono text-xs">{g.ip || '—'}</div>
            <div className="text-atm-muted">{t('mypage.location.dataSource')}</div>
            <div className="text-atm-ink text-xs">
              {g.cached ? t('mypage.location.fromCache') : t('mypage.location.fresh')}
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
            <Globe2 size={11} /> {t('mypage.location.manualEditHint')}
          </div>
        </div>
      )}
    </div>
  )
}

// =================== 데이터 내보내기 ===================

function ExportTab() {
  const { t } = useTranslation()
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
      toast.error(t('mypage.export.trialExpired'))
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
      toast.success(t('mypage.export.downloadStarted'))
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      toast.error(detail || t('mypage.export.failed'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-atm-muted uppercase tracking-wide mb-3 flex items-center gap-2">
          <Download size={14} /> {t('mypage.export.xlsxTitle')}
        </h2>
        <p className="text-xs text-atm-muted mb-4">
          {t('mypage.export.xlsxDesc')}
        </p>

        <div className="space-y-3">
          <div className="flex items-end gap-2 flex-wrap">
            <label className="flex-1 min-w-[160px]">
              <span className="text-xs text-atm-muted">{t('mypage.export.monthly')}</span>
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
              {t('mypage.export.monthlyDownload')}
            </button>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <label className="flex-1 min-w-[160px]">
              <span className="text-xs text-atm-muted">{t('mypage.export.annual')}</span>
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
              {t('mypage.export.annualDownload')}
            </button>
          </div>
        </div>

        {!active && !billing.data?.beta_free_mode && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            {t('mypage.export.paidOnlyNotice')}
          </div>
        )}
        {billing.data?.beta_free_mode && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800">
            {t('mypage.export.betaFreeNotice')}
          </div>
        )}
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-atm-muted uppercase tracking-wide mb-2">
          {t('mypage.export.gdprTitle')}
        </h3>
        <p className="text-xs text-atm-muted mb-3">
          {t('mypage.export.gdprDesc')}
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
              toast.success(t('mypage.export.gdprStarted'))
            } catch (err: any) {
              toast.error(err?.response?.data?.detail || t('mypage.export.failed'))
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-stone-200 rounded-lg text-sm hover:bg-stone-50"
        >
          <Download size={13} /> {t('mypage.export.gdprButton')}
        </button>
      </div>
    </div>
  )
}

// =================== Danger Zone ===================

function DangerZone({ email, onDeleted }: { email: string; onDeleted: () => void }) {
  const { t } = useTranslation()
  const deleteAccount = async () => {
    const ok = window.confirm(t('mypage.dangerZone.deleteConfirm'))
    if (!ok) return
    const phrase = window.prompt(t('mypage.dangerZone.confirmEmailPrompt'))
    if (!phrase || phrase.trim().toLowerCase() !== email.toLowerCase()) {
      toast.error(t('mypage.dangerZone.emailMismatch'))
      return
    }
    try {
      await authApi.deleteMe()
      toast.success(t('mypage.dangerZone.deleted'))
      onDeleted()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('mypage.dangerZone.deleteFailed'))
    }
  }

  return (
    <div className="bg-white border border-red-200 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-2">{t('mypage.dangerZone.title')}</h3>
      <p className="text-xs text-atm-muted mb-3">
        {t('mypage.dangerZone.description')}
      </p>
      <button
        type="button"
        onClick={deleteAccount}
        className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-700 rounded-lg text-sm hover:bg-red-50"
      >
        <Trash2 size={13} /> {t('mypage.dangerZone.deleteButton')}
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
