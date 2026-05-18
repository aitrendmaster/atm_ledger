import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  MessageCircle,
  Calendar,
  MapPin,
  BarChart3,
  Mail,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { SUPPORT_EMAIL } from '../services/api'
import AnnouncementBar from '../components/AnnouncementBar'
import AppHeader from '../components/AppHeader'
import Faq from '../components/Faq'

export default function Landing() {
  const { user } = useAuth()
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-atm-bg">
      <AnnouncementBar />
      <AppHeader />
      {/* Hero */}
      <section className="px-6 pt-20 pb-16 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-stone-200 rounded-full text-xs text-atm-muted mb-6">
          <Sparkles size={14} className="text-atm-accent" />
          {t('landing.badge')}
        </div>
        <h1 className="text-5xl sm:text-6xl font-semibold text-atm-ink mb-5 leading-tight tracking-tight">
          {t('landing.headline1')}<br />
          <span className="text-atm-accent">{t('landing.headline2')}</span>
        </h1>
        <p className="text-atm-muted text-lg sm:text-xl leading-relaxed max-w-2xl mb-10">
          {t('landing.subtitle')}
        </p>
        <div className="flex flex-wrap gap-3">
          {user ? (
            <Link
              to="/app"
              className="px-6 py-3 bg-atm-accent text-white rounded-lg font-medium hover:opacity-90 transition"
            >
              {t('landing.ctaApp')}
            </Link>
          ) : (
            <>
              <Link
                to="/signup"
                className="px-6 py-3 bg-atm-accent text-white rounded-lg font-medium hover:opacity-90 transition"
              >
                {t('landing.ctaPrimary')}
              </Link>
              <Link
                to="/login"
                className="px-6 py-3 bg-white border border-stone-300 text-atm-ink rounded-lg font-medium hover:bg-stone-50 transition"
              >
                {t('landing.ctaLogin')}
              </Link>
            </>
          )}
        </div>
      </section>

      {/* USP — 4개 핵심 가치 */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <header className="text-center mb-12">
          <h2 className="text-3xl font-semibold text-atm-ink mb-3">
            {t('landing.uspHeading')}
          </h2>
          <p className="text-atm-muted">{t('landing.uspSubtitle')}</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Usp icon={MessageCircle} title={t('landing.uspChatTitle')} desc={t('landing.uspChatDesc')} />
          <Usp icon={Calendar} title={t('landing.uspCalendarTitle')} desc={t('landing.uspCalendarDesc')} />
          <Usp icon={MapPin} title={t('landing.uspMapTitle')} desc={t('landing.uspMapDesc')} />
          <Usp icon={BarChart3} title={t('landing.uspCoachTitle')} desc={t('landing.uspCoachDesc')} />
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16 bg-white border-y border-stone-200">
        <Faq />
      </section>

      {/* CTA + 연락처 */}
      <section className="px-6 py-16 max-w-2xl mx-auto text-center">
        <h2 className="text-2xl font-semibold text-atm-ink mb-3">
          {t('landing.cta2Heading')}
        </h2>
        <p className="text-atm-muted mb-6">{t('landing.cta2Subtitle')}</p>
        {!user && (
          <Link
            to="/signup"
            className="inline-block px-8 py-3 bg-atm-accent text-white rounded-lg font-medium hover:opacity-90 transition"
          >
            {t('landing.ctaPrimary')}
          </Link>
        )}
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 bg-stone-50 border-t border-stone-200">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 text-sm">
          <div>
            <div className="font-semibold text-atm-ink mb-1">{t('app.name')}</div>
            <div className="text-xs text-atm-muted">{t('landing.footerTagline')}</div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 text-atm-muted">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2 hover:text-atm-ink"
            >
              <Mail size={14} /> {SUPPORT_EMAIL}
            </a>
            <Link to="/terms" className="hover:text-atm-ink">{t('landing.footerTerms')}</Link>
            <Link to="/privacy" className="hover:text-atm-ink">{t('landing.footerPrivacy')}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

interface UspProps {
  icon: LucideIcon
  title: string
  desc: string
}

function Usp({ icon: Icon, title, desc }: UspProps) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-stone-200">
      <div className="w-10 h-10 rounded-lg bg-atm-bg flex items-center justify-center mb-4">
        <Icon size={20} className="text-atm-accent" />
      </div>
      <h3 className="font-semibold text-atm-ink text-lg mb-2">{title}</h3>
      <p className="text-sm text-atm-muted leading-relaxed">{desc}</p>
    </div>
  )
}
