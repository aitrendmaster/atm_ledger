import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Mail,
  Sparkles,
  MessageCircle,
  CalendarDays,
  ListChecks,
  MapPin,
  Brain,
  Wallet,
  Repeat,
  Check,
  X,
  Minus,
  Briefcase,
  GraduationCap,
  Plane,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { SUPPORT_EMAIL } from '../services/api'
import { COMPANY } from '../config/company'
import AnnouncementBar from '../components/AnnouncementBar'
import AppHeader from '../components/AppHeader'
import Faq from '../components/Faq'
import PhoneMockup from '../components/landing/PhoneMockup'
import MockChatPanel from '../components/landing/MockChatPanel'
import MockCalendarPanel from '../components/landing/MockCalendarPanel'
import MockDayDetailPanel from '../components/landing/MockDayDetailPanel'
import MockPlacePanel from '../components/landing/MockPlacePanel'
import MockInsightPanel from '../components/landing/MockInsightPanel'
import MockBalancePanel from '../components/landing/MockBalancePanel'
import MockRecurringPanel from '../components/landing/MockRecurringPanel'
import DotLine, { type DotLineColor } from '../components/brand/DotLine'

// 4 시맨틱 액센트 → 정적 Tailwind 클래스(문자열 리터럴이어야 JIT 가 생성). text-* 는 DEFAULT 색.
const ACCENT: Record<DotLineColor, { text: string }> = {
  record: { text: 'text-record' },
  journey: { text: 'text-journey' },
  insight: { text: 'text-insight' },
  growth: { text: 'text-growth' },
}

export default function Landing() {
  const { user } = useAuth()
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-cream text-ink">
      <AnnouncementBar />
      <AppHeader />

      {/* ===== Hero (dark) — 브랜드 표면은 다크 유지, 액센트만 Record 그라데이션 (playbook 11-1) ===== */}
      <section className="relative bg-ink text-white overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--record) 16%, transparent), transparent 55%)' }}
          aria-hidden
        />
        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-20 md:pt-32 md:pb-28 grid md:grid-cols-[1.15fr_1fr] gap-12 md:gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/15 rounded-pill text-xs text-white/85 mb-6 backdrop-blur">
              <Sparkles size={14} className="text-record" />
              {t('landing.hero.badge')}
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-display leading-[1.1] tracking-tight mb-5 [word-break:keep-all]">
              {t('landing.hero.headline1')}
              <br />
              <span className="bg-grad-record bg-clip-text text-transparent">{t('landing.hero.headline2')}</span>
            </h1>
            <p className="text-white/75 text-base sm:text-lg leading-relaxed max-w-xl mb-8 [word-break:keep-all]">
              {t('landing.hero.subtitle')}
            </p>
            <div className="flex flex-wrap gap-3">
              {user ? (
                <Link
                  to="/app"
                  className="px-6 py-3.5 bg-grad-record text-white rounded-pill font-bold hover:opacity-90 transition active:scale-[0.98]"
                >
                  {t('landing.hero.ctaApp')}
                </Link>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className="px-6 py-3.5 bg-grad-record text-white rounded-pill font-bold hover:opacity-90 transition active:scale-[0.98]"
                  >
                    {t('landing.hero.ctaPrimary')}
                  </Link>
                  <Link
                    to="/login"
                    className="px-6 py-3.5 bg-white/10 border border-white/20 text-white rounded-pill font-bold hover:bg-white/20 transition active:scale-[0.98]"
                  >
                    {t('landing.hero.ctaLogin')}
                  </Link>
                </>
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-mono tracking-wider uppercase text-white/55">
              <span>{t('landing.hero.trust1')}</span>
              <span>·</span>
              <span>{t('landing.hero.trust2')}</span>
              <span>·</span>
              <span>{t('landing.hero.trust3')}</span>
              <span>·</span>
              <span className="text-record/80">{t('landing.hero.trust4')}</span>
            </div>
            <p className="mt-7 max-w-md text-xs leading-relaxed text-white/45 [word-break:keep-all]">
              {t('landing.hero.privacy')}
            </p>
          </div>

          <div className="flex justify-center md:justify-end">
            <PhoneMockup>
              <MockChatPanel
                userText={t('landing.feature1.demoUser')}
                aiText={t('landing.feature1.demoAi')}
                tags={[
                  t('landing.feature1.tagCafe'),
                  t('landing.feature1.tagAmount'),
                  t('landing.feature1.tagPlace'),
                ]}
                inputPlaceholder={t('landing.feature1.demoPlaceholder')}
              />
            </PhoneMockup>
          </div>
        </div>
      </section>

      {/* ===== Problem ===== */}
      <section className="px-6 py-20 md:py-24 max-w-5xl mx-auto">
        <header className="text-center mb-12">
          <div className="text-xs font-mono tracking-[0.25em] uppercase text-record mb-3">
            {t('landing.problem.label')}
          </div>
          <h2 className="text-3xl md:text-4xl font-display mb-4 [word-break:keep-all]">
            {t('landing.problem.title')}
          </h2>
          <p className="text-ink-secondary max-w-2xl mx-auto leading-relaxed [word-break:keep-all]">
            {t('landing.problem.subtitle')}
          </p>
        </header>

        <div className="grid sm:grid-cols-3 gap-4">
          {(['card1', 'card2', 'card3'] as const).map((k) => (
            <div
              key={k}
              className="bg-surface border border-line rounded-card p-5 shadow-soft"
            >
              <div className="text-3xl text-record mb-2 font-serif leading-none">"</div>
              <p className="text-sm leading-relaxed text-ink mb-3 [word-break:keep-all]">
                {t(`landing.problem.${k}.quote`)}
              </p>
              <div className="text-xs font-mono tracking-wider text-ink-secondary">
                — {t(`landing.problem.${k}.meta`)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Features ===== */}
      <FeatureSection
        n="01"
        accent="record"
        icon={MessageCircle}
        labelKey="landing.feature1.label"
        titleKey="landing.feature1.title"
        descKey="landing.feature1.desc"
        pointKeys={['landing.feature1.point1', 'landing.feature1.point2', 'landing.feature1.point3']}
        mockup={
          <PhoneMockup>
            <MockChatPanel
              userText={t('landing.feature1.demoUser')}
              aiText={t('landing.feature1.demoAi')}
              tags={[
                t('landing.feature1.tagCafe'),
                t('landing.feature1.tagAmount'),
                t('landing.feature1.tagPlace'),
              ]}
              inputPlaceholder={t('landing.feature1.demoPlaceholder')}
            />
          </PhoneMockup>
        }
      />

      <FeatureSection
        n="02"
        accent="journey"
        reverse
        icon={CalendarDays}
        labelKey="landing.feature2.label"
        titleKey="landing.feature2.title"
        descKey="landing.feature2.desc"
        pointKeys={['landing.feature2.point1', 'landing.feature2.point2', 'landing.feature2.point3']}
        mockup={
          <PhoneMockup>
            <MockCalendarPanel
              month={t('landing.feature2.month')}
              upcoming={[
                { day: 25, label: t('landing.feature2.upcoming1'), amount: t('landing.feature2.amount1') },
                { day: 28, label: t('landing.feature2.upcoming2'), amount: t('landing.feature2.amount2') },
                { day: 30, label: t('landing.feature2.upcoming3'), amount: t('landing.feature2.amount3') },
              ]}
            />
          </PhoneMockup>
        }
      />

      <FeatureSection
        n="03"
        accent="growth"
        icon={ListChecks}
        labelKey="landing.feature3.label"
        titleKey="landing.feature3.title"
        descKey="landing.feature3.desc"
        pointKeys={['landing.feature3.point1', 'landing.feature3.point2', 'landing.feature3.point3']}
        mockup={
          <PhoneMockup>
            <MockDayDetailPanel
              dateLabel={t('landing.feature3.dateLabel')}
              total={t('landing.feature3.total')}
            />
          </PhoneMockup>
        }
      />

      <FeatureSection
        n="04"
        accent="journey"
        reverse
        icon={MapPin}
        labelKey="landing.feature4.label"
        titleKey="landing.feature4.title"
        descKey="landing.feature4.desc"
        pointKeys={['landing.feature4.point1', 'landing.feature4.point2', 'landing.feature4.point3']}
        mockup={
          <PhoneMockup>
            <MockPlacePanel />
          </PhoneMockup>
        }
      />

      {/* Feature 05 — signature with extra message box */}
      <section className="relative bg-cream px-6 py-20 md:py-24">
        <div className="max-w-6xl mx-auto grid md:grid-cols-[1.05fr_1fr] gap-12 md:gap-16 items-center">
          <div>
            <FeatureHeader
              n="05"
              icon={Brain}
              labelKey="landing.feature5.label"
              titleKey="landing.feature5.title"
              descKey="landing.feature5.desc"
              accent="insight"
            />
            <FeaturePoints
              pointKeys={['landing.feature5.point1', 'landing.feature5.point2', 'landing.feature5.point3']}
            />
            <div className="mt-6 bg-insight/10 border border-insight/25 rounded-card p-4">
              <div className="text-sm font-bold text-insight mb-1 flex items-center gap-1.5">
                <Sparkles size={14} />
                {t('landing.feature5.messageTitle')}
              </div>
              <p className="text-sm text-ink leading-relaxed [word-break:keep-all]">
                {t('landing.feature5.messageSub')}
              </p>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <PhoneMockup>
              <MockInsightPanel
                monthLabel={t('landing.feature5.monthLabel')}
                total={t('landing.feature5.total')}
                strength={t('landing.feature5.strength')}
                weakness={t('landing.feature5.weakness')}
                advice={t('landing.feature5.advice')}
              />
            </PhoneMockup>
          </div>
        </div>
      </section>

      <FeatureSection
        n="06"
        accent="growth"
        reverse
        icon={Wallet}
        labelKey="landing.feature6.label"
        titleKey="landing.feature6.title"
        descKey="landing.feature6.desc"
        pointKeys={['landing.feature6.point1', 'landing.feature6.point2', 'landing.feature6.point3']}
        mockup={
          <PhoneMockup>
            <MockBalancePanel
              monthLabel={t('landing.feature6.monthLabel')}
              income={t('landing.feature6.income')}
              spent={t('landing.feature6.spent')}
              saved={t('landing.feature6.saved')}
              free={t('landing.feature6.free')}
            />
          </PhoneMockup>
        }
      />

      <FeatureSection
        n="07"
        accent="growth"
        icon={Repeat}
        labelKey="landing.feature7.label"
        titleKey="landing.feature7.title"
        descKey="landing.feature7.desc"
        pointKeys={['landing.feature7.point1', 'landing.feature7.point2', 'landing.feature7.point3']}
        mockup={
          <PhoneMockup>
            <MockRecurringPanel
              rows={[
                {
                  name: t('landing.feature7.row1.name'),
                  amount: t('landing.feature7.row1.amount'),
                  cycle: t('landing.feature7.row1.cycle'),
                  next: t('landing.feature7.row1.next'),
                },
                {
                  name: t('landing.feature7.row2.name'),
                  amount: t('landing.feature7.row2.amount'),
                  cycle: t('landing.feature7.row2.cycle'),
                  next: t('landing.feature7.row2.next'),
                },
                {
                  name: t('landing.feature7.row3.name'),
                  amount: t('landing.feature7.row3.amount'),
                  cycle: t('landing.feature7.row3.cycle'),
                  next: t('landing.feature7.row3.next'),
                },
                {
                  name: t('landing.feature7.row4.name'),
                  amount: t('landing.feature7.row4.amount'),
                  cycle: t('landing.feature7.row4.cycle'),
                  next: t('landing.feature7.row4.next'),
                },
              ]}
            />
          </PhoneMockup>
        }
      />

      {/* ===== Compare table ===== */}
      <section className="px-6 py-20 md:py-24 bg-surface border-y border-line">
        <div className="max-w-5xl mx-auto">
          <header className="text-center mb-10">
            <div className="text-xs font-mono tracking-[0.25em] uppercase text-record mb-3">
              {t('landing.compare.label')}
            </div>
            <h2 className="text-3xl md:text-4xl font-display mb-3 [word-break:keep-all]">
              {t('landing.compare.title')}
            </h2>
            <p className="text-ink-secondary [word-break:keep-all]">{t('landing.compare.subtitle')}</p>
          </header>

          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="text-left py-3 px-3 text-ink-secondary font-mono text-xs tracking-wider uppercase">
                    {t('landing.compare.colFeature')}
                  </th>
                  <th className="text-center py-3 px-3">
                    <span className="inline-block px-2.5 py-1 bg-grad-record text-white rounded-md text-xs font-bold">
                      Moa
                    </span>
                  </th>
                  <th className="text-center py-3 px-3 text-ink-secondary font-mono text-xs tracking-wider uppercase">
                    {t('landing.compare.colOther')}
                  </th>
                  <th className="text-center py-3 px-3 text-ink-secondary font-mono text-xs tracking-wider uppercase">
                    {t('landing.compare.colExcel')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {([
                  ['row1', 'check', 'cross', 'cross'],
                  ['row2', 'check', 'partial', 'cross'],
                  ['row3', 'check', 'cross', 'cross'],
                  ['row4', 'check', 'check', 'partial'],
                  ['row5', 'check', 'cross', 'partial'],
                  ['row6', 'check', 'partial', 'cross'],
                  ['row7', 'check', 'cross', 'cross'],
                  ['row8', 'check', 'cross', 'check'],
                ] as const).map(([rk, m, o, e]) => (
                  <tr key={rk}>
                    <td className="py-3 px-3 font-medium text-ink [word-break:keep-all]">
                      {t(`landing.compare.${rk}`)}
                    </td>
                    <td className="py-3 px-3 text-center"><Mark v={m} /></td>
                    <td className="py-3 px-3 text-center"><Mark v={o} /></td>
                    <td className="py-3 px-3 text-center"><Mark v={e} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ===== Target (dark) ===== */}
      <section className="bg-ink text-white px-6 py-20 md:py-24">
        <div className="max-w-5xl mx-auto">
          <header className="text-center mb-12">
            <div className="text-xs font-mono tracking-[0.25em] uppercase text-record mb-3">
              {t('landing.target.label')}
            </div>
            <h2 className="text-3xl md:text-4xl font-display [word-break:keep-all]">
              {t('landing.target.title')}
            </h2>
          </header>

          <div className="grid sm:grid-cols-3 gap-5">
            {/* 이모지 대신 벡터 아이콘 + 시맨틱 그라데이션 칩 (playbook 11-3) */}
            {([
              ['persona1', Briefcase, 'bg-grad-record'],
              ['persona2', GraduationCap, 'bg-grad-journey'],
              ['persona3', Plane, 'bg-grad-saving'],
            ] as const).map(([k, PersonaIcon, chip]) => (
              <div
                key={k}
                className="bg-white/5 border border-white/10 rounded-card p-6 backdrop-blur"
              >
                <span className={`w-10 h-10 rounded-pill ${chip} flex items-center justify-center mb-3`} aria-hidden>
                  <PersonaIcon size={18} className="text-white" />
                </span>
                <h3 className="text-lg font-bold mb-2 [word-break:keep-all]">
                  {t(`landing.target.${k}.name`)}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed [word-break:keep-all]">
                  {t(`landing.target.${k}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ (light) ===== */}
      <section className="px-6 py-20 bg-surface border-y border-line">
        <Faq />
      </section>

      {/* ===== CTA 2 (dark) ===== */}
      {/* 그라데이션 전면 배경 금지 (playbook 11-3) — 플랫 잉크 패널 */}
      <section className="bg-ink text-white px-6 py-20 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-display mb-4 [word-break:keep-all]">
            {t('landing.cta2.title')}
          </h2>
          <p className="text-white/75 text-base sm:text-lg leading-relaxed mb-8 [word-break:keep-all]">
            {t('landing.cta2.subtitle')}
          </p>

          {user ? (
            <Link
              to="/app"
              className="inline-block px-8 py-4 bg-grad-record text-white rounded-pill font-bold hover:opacity-90 transition active:scale-[0.98]"
            >
              {t('landing.hero.ctaApp')}
            </Link>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/signup"
                className="px-8 py-4 bg-grad-record text-white rounded-pill font-bold hover:opacity-90 transition active:scale-[0.98]"
              >
                {t('landing.hero.ctaPrimary')}
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 bg-white/10 border border-white/20 text-white rounded-pill font-bold hover:bg-white/20 transition active:scale-[0.98]"
              >
                {t('landing.hero.ctaLogin')}
              </Link>
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-mono tracking-wider uppercase text-white/55">
            <span>{t('landing.cta2.trust1')}</span>
            <span>·</span>
            <span>{t('landing.cta2.trust2')}</span>
            <span>·</span>
            <span>{t('landing.cta2.trust3')}</span>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="px-6 py-10 bg-sunken border-t border-line">
        <div className="max-w-5xl mx-auto space-y-6 text-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div className="flex items-center gap-3">
              <img src="/favicon.svg" alt="" width={40} height={40} className="flex-shrink-0" />
              <div>
                <div className="font-semibold text-ink mb-0.5">{t('app.name')}</div>
                <div className="text-xs text-ink-secondary">{t('landing.footerTagline')}</div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 text-ink-secondary">
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-2 hover:text-ink"
              >
                <Mail size={14} /> {SUPPORT_EMAIL}
              </a>
              <Link to="/pricing" className="hover:text-ink">{t('common.pricing')}</Link>
              <Link to="/terms" className="hover:text-ink">{t('landing.footerTerms')}</Link>
              <Link to="/privacy" className="hover:text-ink">{t('landing.footerPrivacy')}</Link>
              <Link to="/refund" className="hover:text-ink">{t('common.refund')}</Link>
              <Link to="/account-deletion" className="hover:text-ink">{t('landing.footerDataDeletion')}</Link>
              <Link to="/faq" className="hover:text-ink">FAQ</Link>
            </div>
          </div>

          {/* 사업자 정보 — 전자상거래법 준수 */}
          <div className="pt-5 border-t border-line text-[11px] text-ink-secondary leading-relaxed">
            <div className="font-semibold text-ink mb-1.5">{COMPANY.legalNameKo} ({COMPANY.legalNameEn})</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>{t('landing.bizCeo')}: {COMPANY.ceo}</span>
              <span>{t('landing.bizNo')}: {COMPANY.businessRegistrationNumber}</span>
              <span>{t('landing.bizMailOrder')}: {COMPANY.mailOrderRegistrationNumber}</span>
              <span>{t('landing.bizAddress')}: {COMPANY.addressKo}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

interface FeatureSectionProps {
  n: string
  icon: LucideIcon
  labelKey: string
  titleKey: string
  descKey: string
  pointKeys: string[]
  mockup: React.ReactNode
  reverse?: boolean
  accent?: DotLineColor
}

function FeatureSection({
  n,
  icon: Icon,
  labelKey,
  titleKey,
  descKey,
  pointKeys,
  mockup,
  reverse,
  accent = 'record',
}: FeatureSectionProps) {
  return (
    <section className="px-6 py-20 md:py-24 max-w-6xl mx-auto">
      <div
        className={`grid md:grid-cols-[1.05fr_1fr] gap-12 md:gap-16 items-center ${
          reverse ? 'md:[&>*:first-child]:order-2' : ''
        }`}
      >
        <div>
          <FeatureHeader n={n} icon={Icon} labelKey={labelKey} titleKey={titleKey} descKey={descKey} accent={accent} />
          <FeaturePoints pointKeys={pointKeys} />
        </div>
        <div className={`flex justify-center ${reverse ? 'md:justify-start' : 'md:justify-end'}`}>
          {mockup}
        </div>
      </div>
    </section>
  )
}

function FeatureHeader({
  n,
  icon: Icon,
  labelKey,
  titleKey,
  descKey,
  accent = 'record',
}: {
  n: string
  icon: LucideIcon
  labelKey: string
  titleKey: string
  descKey: string
  accent?: DotLineColor
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-xs tracking-[0.3em] text-ink-secondary">{n}</span>
        <span className="h-px flex-1 max-w-12 bg-line" />
        <span className={`inline-flex items-center gap-1.5 text-xs font-mono tracking-wider uppercase ${ACCENT[accent].text}`}>
          <Icon size={14} />
          {t(labelKey)}
        </span>
      </div>
      <h2 className="text-3xl md:text-4xl font-display leading-tight mb-4 [word-break:keep-all]">
        {t(titleKey)}
      </h2>
      <p className="text-ink-secondary text-base md:text-lg leading-relaxed mb-5 [word-break:keep-all]">
        {t(descKey)}
      </p>
      {/* 점-선 모티프 — 기능별 시맨틱 색으로 '한 줄 → 길' */}
      <DotLine color={accent} count={6} className="max-w-[150px] mb-1" />
    </>
  )
}

function FeaturePoints({ pointKeys }: { pointKeys: string[] }) {
  const { t } = useTranslation()
  return (
    <ul className="space-y-2.5">
      {pointKeys.map((k) => (
        <li key={k} className="flex items-start gap-2.5 text-ink">
          <span className="mt-1 w-4 h-4 rounded-full bg-record/15 flex items-center justify-center flex-shrink-0">
            <Check size={10} className="text-record" strokeWidth={3} />
          </span>
          <span className="text-sm md:text-base leading-relaxed [word-break:keep-all]">
            {t(k)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Mark({ v }: { v: 'check' | 'cross' | 'partial' }) {
  if (v === 'check') {
    return (
      <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-record/15">
        <Check size={14} className="text-record" strokeWidth={3} />
      </span>
    )
  }
  if (v === 'partial') {
    return (
      <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-sunken">
        <Minus size={14} className="text-ink-secondary" strokeWidth={3} />
      </span>
    )
  }
  return (
    <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-sunken">
      <X size={14} className="text-ink-faint" strokeWidth={3} />
    </span>
  )
}
