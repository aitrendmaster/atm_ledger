import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Privacy() {
  const { t } = useTranslation()
  const supportEmail = 'master@aitrend.kr'
  return (
    <div className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6">{t('privacy.title')}</h1>
      <article className="prose prose-sm text-atm-ink space-y-4">
        <p>{t('privacy.intro')}</p>

        <h2 className="font-semibold mt-6">{t('privacy.s1Title')}</h2>
        <ul className="list-disc pl-5">
          <li>{t('privacy.s1Required')}</li>
          <li>{t('privacy.s1Generated')}</li>
          <li>{t('privacy.s1Auto')}</li>
        </ul>

        <h2 className="font-semibold mt-6">{t('privacy.s2Title')}</h2>
        <ul className="list-disc pl-5">
          <li>{t('privacy.s2a')}</li>
          <li>{t('privacy.s2b')}</li>
          <li>{t('privacy.s2c')}</li>
        </ul>

        <h2 className="font-semibold mt-6">{t('privacy.s3Title')}</h2>
        <p>{t('privacy.s3Body')}</p>

        <h2 className="font-semibold mt-6">{t('privacy.s4Title')}</h2>
        <ul className="list-disc pl-5">
          <li>{t('privacy.s4Anthropic')}</li>
          <li>{t('privacy.s4Toss')}</li>
          <li>{t('privacy.s4Paddle')}</li>
          <li>{t('privacy.s4R2')}</li>
          <li>{t('privacy.s4Ga')}</li>
        </ul>

        <h2 className="font-semibold mt-6">{t('privacy.s5Title')}</h2>
        <p>{t('privacy.s5Body')}</p>

        <h2 className="font-semibold mt-6">{t('privacy.s6Title')}</h2>
        <p>{t('privacy.s6Body')}</p>

        <h2 className="font-semibold mt-6">{t('privacy.s7Title')}</h2>
        <p>{t('privacy.s7Body')}</p>

        <h2 className="font-semibold mt-6">{t('privacy.s8Title')}</h2>
        <p>
          {t('privacy.s8Body')}{' '}
          <a className="underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </p>

        <p className="text-xs text-atm-muted mt-8">{t('privacy.effective')}</p>
      </article>

      <footer className="mt-12 pt-6 border-t border-stone-200 text-xs text-atm-muted flex flex-wrap gap-4">
        <Link to="/" className="hover:text-atm-ink">{t('common.home')}</Link>
        <Link to="/pricing" className="hover:text-atm-ink">{t('common.pricing')}</Link>
        <Link to="/terms" className="hover:text-atm-ink">{t('landing.footerTerms')}</Link>
        <Link to="/refund" className="hover:text-atm-ink">{t('common.refund')}</Link>
        <Link to="/faq" className="hover:text-atm-ink">FAQ</Link>
      </footer>
    </div>
  )
}
