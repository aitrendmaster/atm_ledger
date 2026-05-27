import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { COMPANY } from '../config/company'

/**
 * Moa AI 가계부 이용약관.
 *
 * 구조: 18개 조 + 회사 정보 블록 + 시행일.
 * 마스터: 한국어 (ko). 다른 locale 은 핵심 조 (제1·5·8·11·13·18조) 만 번역되고 나머지는 ko 또는 en fallback.
 */
export default function Terms() {
  const { t } = useTranslation()

  const articles = Array.from({ length: 18 }, (_, i) => i + 1)

  return (
    <div className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-atm-ink">{t('terms.title')}</h1>
      <p className="text-sm text-atm-muted mb-8">
        {t('terms.effectiveLabel')}: {COMPANY.termsEffectiveDate}
      </p>

      <article className="space-y-6 text-sm text-atm-ink leading-relaxed">
        <p className="text-atm-muted">{t('terms.intro')}</p>

        {articles.map((n) => (
          <section key={n}>
            <h2 className="font-bold text-base mb-2 mt-4 text-atm-ink">
              {t(`terms.a${n}.title`)}
            </h2>
            <p className="whitespace-pre-line text-atm-ink/90">{t(`terms.a${n}.body`)}</p>
          </section>
        ))}

        {/* 회사 정보 */}
        <section className="mt-10 p-5 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-atm-muted leading-relaxed">
          <div className="font-semibold text-atm-ink mb-2">{t('terms.companyInfoTitle')}</div>
          <div>
            {t('terms.companyName')}: {COMPANY.legalNameKo} ({COMPANY.legalNameEn})
          </div>
          <div>
            {t('terms.companyCeo')}: {COMPANY.ceo}
          </div>
          <div>
            {t('terms.companyBizNo')}: {COMPANY.businessRegistrationNumber}
          </div>
          <div>
            {t('terms.companyMailOrder')}: {COMPANY.mailOrderRegistrationNumber}
          </div>
          <div>
            {t('terms.companyAddress')}: {COMPANY.addressKo}
          </div>
          <div>
            {t('terms.companyContact')}:{' '}
            <a
              href={`mailto:${COMPANY.supportEmail}`}
              className="hover:text-atm-ink underline"
            >
              {COMPANY.supportEmail}
            </a>
          </div>
        </section>

        <p className="text-xs text-atm-muted mt-8">
          {t('terms.effectiveLabel')}: {COMPANY.termsEffectiveDate}
        </p>
      </article>

      <footer className="mt-12 pt-6 border-t border-stone-200 text-xs text-atm-muted flex flex-wrap gap-4">
        <Link to="/" className="hover:text-atm-ink">{t('common.home')}</Link>
        <Link to="/pricing" className="hover:text-atm-ink">{t('common.pricing')}</Link>
        <Link to="/privacy" className="hover:text-atm-ink">{t('landing.footerPrivacy')}</Link>
        <Link to="/refund" className="hover:text-atm-ink">{t('common.refund')}</Link>
        <Link to="/account-deletion" className="hover:text-atm-ink">{t('landing.footerDataDeletion')}</Link>
        <Link to="/faq" className="hover:text-atm-ink">FAQ</Link>
      </footer>
    </div>
  )
}
