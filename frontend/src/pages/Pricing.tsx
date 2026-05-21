import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import { COMPANY } from '../config/company'

export default function Pricing() {
  const { t } = useTranslation()

  const compareRows = [
    'aiInput',
    'adFree',
    'reflectInsight',
    'receiptOcr',
    'multilang',
    'placesMap',
    'recurring',
    'excelExport',
    'unlimitedHistory',
    'priority',
  ] as const

  return (
    <div className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      <header className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-atm-ink mb-2">{t('pricing.title')}</h1>
        <p className="text-atm-muted">{t('pricing.subtitle')}</p>
      </header>

      {/* 베타 50% 할인 배너 */}
      <div className="mb-10 rounded-2xl p-5 border border-atm-accent/30 bg-atm-accent/10 text-sm text-atm-ink">
        <strong className="block mb-1">🎁 {t('pricing.betaTitle')}</strong>
        {t('pricing.betaDesc')}
      </div>

      {/* 가격 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
        {/* Free */}
        <div className="rounded-2xl border border-stone-200 p-6 bg-white">
          <div className="text-sm font-medium text-atm-muted mb-1">{t('pricing.freePlan')}</div>
          <div className="text-3xl font-bold text-atm-ink mb-1">{t('pricing.freePrice')}</div>
          <div className="text-xs text-atm-muted mb-4">{t('pricing.freePriceNote')}</div>
          <p className="text-sm text-atm-muted mb-5 leading-relaxed">{t('pricing.freeDesc')}</p>
          <Link
            to="/signup"
            className="block w-full text-center px-4 py-2.5 rounded-xl border border-atm-ink text-atm-ink hover:bg-stone-50 font-medium"
          >
            {t('pricing.freeCta')}
          </Link>
        </div>

        {/* Premium */}
        <div className="rounded-2xl border-2 border-atm-accent p-6 bg-white relative shadow-sm">
          <span className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-full bg-atm-accent text-white text-[11px] font-bold">
            {t('pricing.paidBadge')}
          </span>
          <div className="text-sm font-medium text-atm-muted mb-1">{t('pricing.paidPlan')}</div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-bold text-atm-ink">{t('pricing.paidPriceMonthly')}</span>
            <span className="text-sm text-atm-muted">{t('pricing.perMonth')}</span>
          </div>
          <div className="text-xs text-atm-muted mb-4">
            {t('pricing.paidPriceYearlyNote')}
          </div>
          <p className="text-sm text-atm-muted mb-5 leading-relaxed">{t('pricing.paidDesc')}</p>
          <Link
            to="/signup"
            className="block w-full text-center px-4 py-2.5 rounded-xl bg-atm-accent text-white hover:opacity-90 font-medium"
          >
            {t('pricing.paidCta')}
          </Link>
        </div>
      </div>

      {/* 비교표 */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-atm-ink">{t('pricing.compareTitle')}</h2>
        <div className="overflow-x-auto bg-white rounded-2xl border border-stone-200">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200">
              <tr>
                <th className="text-left py-3 px-4 text-atm-muted font-medium">
                  {t('pricing.compareFeature')}
                </th>
                <th className="text-center py-3 px-4 text-atm-muted font-medium">
                  {t('pricing.freePlan')}
                </th>
                <th className="text-center py-3 px-4 text-atm-accent font-bold">
                  {t('pricing.paidPlan')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {compareRows.map((row) => (
                <tr key={row}>
                  <td className="py-3 px-4 text-atm-ink">{t(`pricing.compare.${row}.feature`)}</td>
                  <td className="py-3 px-4 text-center text-atm-muted text-xs">
                    {t(`pricing.compare.${row}.free`)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {t(`pricing.compare.${row}.paid`) === '✓' ? (
                      <Check size={18} className="inline text-atm-accent" />
                    ) : t(`pricing.compare.${row}.paid`) === '✗' ? (
                      <X size={18} className="inline text-stone-400" />
                    ) : (
                      <span className="text-atm-ink font-medium text-xs">
                        {t(`pricing.compare.${row}.paid`)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 결제 수단 */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3 text-atm-ink">{t('pricing.paymentTitle')}</h2>
        <p className="text-sm text-atm-muted leading-relaxed mb-3">{t('pricing.paymentDesc')}</p>
        <ul className="text-sm text-atm-muted list-disc pl-5 space-y-1">
          <li>{t('pricing.paymentKr')}</li>
          <li>{t('pricing.paymentIntl')}</li>
        </ul>
      </section>

      {/* 해지 안내 */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3 text-atm-ink">{t('pricing.cancelTitle')}</h2>
        <p className="text-sm text-atm-muted leading-relaxed">
          {t('pricing.cancelDesc')}{' '}
          <Link to="/refund" className="underline text-atm-ink hover:text-atm-accent">
            {t('pricing.refundLink')}
          </Link>
        </p>
      </section>

      {/* 운영자 정보 */}
      <section className="mb-10 p-5 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-atm-muted leading-relaxed">
        <div className="font-semibold text-atm-ink mb-2">{t('pricing.operatorTitle')}</div>
        <div>
          {t('pricing.operatorName')}: {COMPANY.legalNameKo} ({COMPANY.legalNameEn})
        </div>
        <div>
          {t('pricing.operatorCeo')}: {COMPANY.ceo}
        </div>
        <div>
          {t('pricing.operatorBizNo')}: {COMPANY.businessRegistrationNumber}
        </div>
        <div>
          {t('pricing.operatorMailOrder')}: {COMPANY.mailOrderRegistrationNumber}
        </div>
        <div>
          {t('pricing.operatorContact')}:{' '}
          <a href={`mailto:${COMPANY.supportEmail}`} className="hover:text-atm-ink underline">
            {COMPANY.supportEmail}
          </a>
        </div>
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
