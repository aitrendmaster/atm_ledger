import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Refund() {
  const { t } = useTranslation()
  const supportEmail = 'master@aitrend.kr'
  return (
    <div className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-atm-ink mb-2">{t('refund.title')}</h1>
      <p className="text-atm-muted mb-8">{t('refund.subtitle')}</p>

      <article className="prose prose-sm max-w-none text-atm-ink space-y-6">
        <section>
          <h2 className="text-lg font-semibold">{t('refund.section1Title')}</h2>
          <p>{t('refund.section1Body')}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">{t('refund.section2Title')}</h2>
          <p>{t('refund.section2Body')}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">{t('refund.section3Title')}</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>{t('refund.step1')}</li>
            <li>
              {t('refund.step2Prefix')}{' '}
              <a className="underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>{' '}
              {t('refund.step2Suffix')}
            </li>
            <li>{t('refund.step3')}</li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold">{t('refund.section4Title')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('refund.notRefundable1')}</li>
            <li>{t('refund.notRefundable2')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">{t('refund.section5Title')}</h2>
          <p>{t('refund.section5Body')}</p>
        </section>

        <p className="text-xs text-atm-muted mt-8">{t('refund.effective')}</p>
      </article>

      <footer className="mt-16 pt-6 border-t border-stone-200 text-xs text-atm-muted flex flex-wrap gap-4">
        <Link to="/" className="hover:text-atm-ink">{t('common.home')}</Link>
        <Link to="/pricing" className="hover:text-atm-ink">{t('common.pricing')}</Link>
        <Link to="/terms" className="hover:text-atm-ink">{t('landing.footerTerms')}</Link>
        <Link to="/privacy" className="hover:text-atm-ink">{t('landing.footerPrivacy')}</Link>
        <Link to="/faq" className="hover:text-atm-ink">FAQ</Link>
      </footer>
    </div>
  )
}
