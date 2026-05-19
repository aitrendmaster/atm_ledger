import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Terms() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6">{t('terms.title')}</h1>
      <article className="prose prose-sm text-atm-ink space-y-4">
        <p>{t('terms.intro')}</p>

        <h2 className="font-semibold mt-6">{t('terms.a1Title')}</h2>
        <p>{t('terms.a1Body')}</p>

        <h2 className="font-semibold mt-6">{t('terms.a2Title')}</h2>
        <p>{t('terms.a2Body')}</p>

        <h2 className="font-semibold mt-6">{t('terms.a3Title')}</h2>
        <p>{t('terms.a3Body')}</p>

        <h2 className="font-semibold mt-6">{t('terms.a4Title')}</h2>
        <p>{t('terms.a4Body')}</p>

        <h2 className="font-semibold mt-6">{t('terms.a5Title')}</h2>
        <p>{t('terms.a5Body')}</p>

        <h2 className="font-semibold mt-6">{t('terms.a6Title')}</h2>
        <p>
          {t('terms.a6BodyPrefix')}{' '}
          <Link className="underline" to="/refund">{t('terms.a6Link')}</Link>
          {t('terms.a6BodySuffix')}
        </p>

        <h2 className="font-semibold mt-6">{t('terms.a7Title')}</h2>
        <p>{t('terms.a7Body')}</p>

        <h2 className="font-semibold mt-6">{t('terms.a8Title')}</h2>
        <p>{t('terms.a8Body')}</p>

        <h2 className="font-semibold mt-6">{t('terms.a9Title')}</h2>
        <p>
          {t('terms.a9BodyPrefix')}{' '}
          <Link className="underline" to="/privacy">{t('terms.a9Link')}</Link>
          {t('terms.a9BodySuffix')}
        </p>

        <h2 className="font-semibold mt-6">{t('terms.a10Title')}</h2>
        <p>{t('terms.a10Body')}</p>

        <h2 className="font-semibold mt-6">{t('terms.a11Title')}</h2>
        <p>{t('terms.a11Body')}</p>

        <h2 className="font-semibold mt-6">{t('terms.a12Title')}</h2>
        <p>{t('terms.a12Body')}</p>

        <p className="text-xs text-atm-muted mt-8">{t('terms.effective')}</p>
      </article>

      <footer className="mt-12 pt-6 border-t border-stone-200 text-xs text-atm-muted flex flex-wrap gap-4">
        <Link to="/" className="hover:text-atm-ink">{t('common.home')}</Link>
        <Link to="/pricing" className="hover:text-atm-ink">{t('common.pricing')}</Link>
        <Link to="/privacy" className="hover:text-atm-ink">{t('landing.footerPrivacy')}</Link>
        <Link to="/refund" className="hover:text-atm-ink">{t('common.refund')}</Link>
        <Link to="/faq" className="hover:text-atm-ink">FAQ</Link>
      </footer>
    </div>
  )
}
