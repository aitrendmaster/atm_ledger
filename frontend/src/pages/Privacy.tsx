import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { COMPANY } from '../config/company'

/**
 * Moa AI 가계부 개인정보처리방침.
 *
 * 구조: 12개 절 + 위탁·국외이전 표 + 보유기간 표.
 * 마스터: 한국어 (ko). 개인정보보호법·전자상거래법 준수 기준.
 */
export default function Privacy() {
  const { t } = useTranslation()

  const sections = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <div className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-atm-ink">{t('privacy.title')}</h1>
      <p className="text-sm text-atm-muted mb-8">
        {t('privacy.effectiveLabel')}: {COMPANY.privacyEffectiveDate}
      </p>

      <article className="space-y-6 text-sm text-atm-ink leading-relaxed">
        <p className="text-atm-muted whitespace-pre-line">{t('privacy.intro')}</p>

        {sections.map((n) => (
          <section key={n}>
            <h2 className="font-bold text-base mb-2 mt-4 text-atm-ink">
              {t(`privacy.s${n}.title`)}
            </h2>
            <p className="whitespace-pre-line text-atm-ink/90">{t(`privacy.s${n}.body`)}</p>
          </section>
        ))}

        {/* 개인정보보호책임자 */}
        <section className="mt-8 p-5 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-atm-muted leading-relaxed">
          <div className="font-semibold text-atm-ink mb-2">{t('privacy.officerTitle')}</div>
          <div>
            {t('privacy.officerName')}: {COMPANY.privacyOfficerName}
          </div>
          <div>
            {t('privacy.officerEmail')}:{' '}
            <a
              href={`mailto:${COMPANY.privacyOfficerEmail}`}
              className="hover:text-atm-ink underline"
            >
              {COMPANY.privacyOfficerEmail}
            </a>
          </div>
          <div className="mt-2">{t('privacy.officerDesc')}</div>
        </section>

        {/* 회사 정보 */}
        <section className="p-5 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-atm-muted leading-relaxed">
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
            {t('terms.companyAddress')}: {COMPANY.addressKo}
          </div>
        </section>

        <p className="text-xs text-atm-muted mt-8">
          {t('privacy.effectiveLabel')}: {COMPANY.privacyEffectiveDate}
        </p>
      </article>

      <footer className="mt-12 pt-6 border-t border-stone-200 text-xs text-atm-muted flex flex-wrap gap-4">
        <Link to="/" className="hover:text-atm-ink">{t('common.home')}</Link>
        <Link to="/pricing" className="hover:text-atm-ink">{t('common.pricing')}</Link>
        <Link to="/terms" className="hover:text-atm-ink">{t('landing.footerTerms')}</Link>
        <Link to="/refund" className="hover:text-atm-ink">{t('common.refund')}</Link>
        <Link to="/account-deletion" className="hover:text-atm-ink">{t('landing.footerDataDeletion')}</Link>
        <Link to="/faq" className="hover:text-atm-ink">FAQ</Link>
      </footer>
    </div>
  )
}
