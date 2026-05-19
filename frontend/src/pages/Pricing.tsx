import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'

export default function Pricing() {
  const { t } = useTranslation()
  const features = [
    'aiClassify',
    'receiptOcr',
    'multilang',
    'excelExport',
    'unlimited',
    'reflectInsight',
    'placesMap',
    'reminder',
  ] as const
  return (
    <div className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <header className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-atm-ink mb-2">{t('pricing.title')}</h1>
        <p className="text-atm-muted">{t('pricing.subtitle')}</p>
      </header>

      <div className="mb-10 rounded-2xl p-5 border border-emerald-200 bg-emerald-50 text-sm text-emerald-900">
        <strong className="block mb-1">{t('pricing.betaTitle')}</strong>
        {t('pricing.betaDesc')}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-stone-200 p-6 bg-white">
          <div className="text-sm font-medium text-atm-muted mb-1">{t('pricing.freePlan')}</div>
          <div className="text-3xl font-bold text-atm-ink mb-3">{t('pricing.freePrice')}</div>
          <p className="text-sm text-atm-muted mb-5">{t('pricing.freeDesc')}</p>
          <Link
            to="/signup"
            className="block w-full text-center px-4 py-2 rounded-xl border border-atm-ink text-atm-ink hover:bg-stone-50"
          >
            {t('pricing.freeCta')}
          </Link>
        </div>

        <div className="rounded-2xl border-2 border-atm-ink p-6 bg-stone-50 relative">
          <span className="absolute -top-3 left-6 px-2 py-0.5 rounded-full bg-atm-ink text-white text-[11px]">
            {t('pricing.paidBadge')}
          </span>
          <div className="text-sm font-medium text-atm-muted mb-1">{t('pricing.paidPlan')}</div>
          <div className="text-3xl font-bold text-atm-ink mb-1">{t('pricing.paidPriceKrw')}</div>
          <div className="text-xs text-atm-muted mb-3">{t('pricing.paidPriceNote')}</div>
          <p className="text-sm text-atm-muted mb-5">{t('pricing.paidDesc')}</p>
          <Link
            to="/signup"
            className="block w-full text-center px-4 py-2 rounded-xl bg-atm-ink text-white hover:opacity-90"
          >
            {t('pricing.paidCta')}
          </Link>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4 text-atm-ink">{t('pricing.featuresTitle')}</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map((key) => (
            <li key={key} className="flex items-start gap-2 text-sm text-atm-ink">
              <Check size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{t(`pricing.features.${key}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-3 text-atm-ink">{t('pricing.paymentTitle')}</h2>
        <p className="text-sm text-atm-muted leading-relaxed mb-2">
          {t('pricing.paymentDesc')}
        </p>
        <ul className="text-sm text-atm-muted list-disc pl-5 space-y-1">
          <li>{t('pricing.paymentKr')}</li>
          <li>{t('pricing.paymentIntl')}</li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-3 text-atm-ink">{t('pricing.cancelTitle')}</h2>
        <p className="text-sm text-atm-muted leading-relaxed">
          {t('pricing.cancelDesc')}{' '}
          <Link to="/refund" className="underline text-atm-ink">{t('pricing.refundLink')}</Link>
        </p>
      </section>

      <footer className="mt-16 pt-6 border-t border-stone-200 text-xs text-atm-muted flex flex-wrap gap-4">
        <Link to="/" className="hover:text-atm-ink">{t('common.home')}</Link>
        <Link to="/terms" className="hover:text-atm-ink">{t('landing.footerTerms')}</Link>
        <Link to="/privacy" className="hover:text-atm-ink">{t('landing.footerPrivacy')}</Link>
        <Link to="/refund" className="hover:text-atm-ink">{t('common.refund')}</Link>
        <Link to="/faq" className="hover:text-atm-ink">FAQ</Link>
      </footer>
    </div>
  )
}
