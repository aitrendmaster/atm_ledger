import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Trash2, Mail, AlertCircle } from 'lucide-react'
import { SUPPORT_EMAIL } from '../services/api'
import LanguageSwitcher from '../components/LanguageSwitcher'

/**
 * 계정 및 데이터 삭제 요청 안내 페이지.
 *
 * Google Play Data Safety 정책 요구사항: 사용자가 앱 외부에서도 접근할 수 있는
 * 공개 URL 이 있어야 함. Play Console "사용자 데이터 삭제" 항목에 이 URL 등록.
 *
 * 두 가지 경로 안내:
 *  1. 앱 내: MyPage → 회원탈퇴 → DELETE /auth/me (즉시 soft-delete, 30일 후 영구 폐기)
 *  2. 이메일: 앱 미설치/접근 불가 시 SUPPORT_EMAIL 로 본인 확인 후 7영업일 내 처리
 */
export default function AccountDeletion() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-atm-bg">
      <div className="absolute top-3 right-4"><LanguageSwitcher /></div>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-2">
          <Trash2 size={28} className="text-atm-accent" />
          <h1 className="text-3xl font-bold text-atm-ink">{t('accountDeletion.title')}</h1>
        </div>
        <p className="text-sm text-atm-muted mb-8">{t('accountDeletion.subtitle')}</p>

        <section className="bg-white rounded-2xl p-6 mb-4 border border-stone-200">
          <h2 className="text-lg font-semibold text-atm-ink mb-3">
            {t('accountDeletion.method1Title')}
          </h2>
          <p className="text-sm text-atm-ink leading-relaxed mb-3 whitespace-pre-line">
            {t('accountDeletion.method1Body')}
          </p>
          <ol className="list-decimal list-inside text-sm text-atm-ink space-y-1 mb-3">
            <li>{t('accountDeletion.method1Step1')}</li>
            <li>{t('accountDeletion.method1Step2')}</li>
            <li>{t('accountDeletion.method1Step3')}</li>
          </ol>
          <p className="text-xs text-atm-muted">{t('accountDeletion.method1Note')}</p>
        </section>

        <section className="bg-white rounded-2xl p-6 mb-4 border border-stone-200">
          <h2 className="text-lg font-semibold text-atm-ink mb-3 flex items-center gap-2">
            <Mail size={18} className="text-atm-accent" />
            {t('accountDeletion.method2Title')}
          </h2>
          <p className="text-sm text-atm-ink leading-relaxed mb-3 whitespace-pre-line">
            {t('accountDeletion.method2Body')}
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[Moa365] 계정 삭제 요청')}`}
            className="inline-block px-4 py-2 bg-atm-accent text-white rounded-lg text-sm font-medium hover:opacity-90"
          >
            {SUPPORT_EMAIL}
          </a>
          <p className="text-xs text-atm-muted mt-3">{t('accountDeletion.method2Note')}</p>
        </section>

        <section className="bg-white rounded-2xl p-6 mb-4 border border-stone-200">
          <h2 className="text-lg font-semibold text-atm-ink mb-3">
            {t('accountDeletion.deletedDataTitle')}
          </h2>
          <ul className="list-disc list-inside text-sm text-atm-ink space-y-1.5 leading-relaxed">
            <li>{t('accountDeletion.deletedItem1')}</li>
            <li>{t('accountDeletion.deletedItem2')}</li>
            <li>{t('accountDeletion.deletedItem3')}</li>
            <li>{t('accountDeletion.deletedItem4')}</li>
            <li>{t('accountDeletion.deletedItem5')}</li>
            <li>{t('accountDeletion.deletedItem6')}</li>
          </ul>
        </section>

        <section className="bg-amber-50 rounded-2xl p-6 mb-4 border border-amber-200">
          <h2 className="text-lg font-semibold text-atm-ink mb-3 flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-600" />
            {t('accountDeletion.retainedDataTitle')}
          </h2>
          <p className="text-sm text-atm-ink leading-relaxed mb-2 whitespace-pre-line">
            {t('accountDeletion.retainedDataBody')}
          </p>
          <ul className="list-disc list-inside text-sm text-atm-ink space-y-1 leading-relaxed">
            <li>{t('accountDeletion.retainedItem1')}</li>
            <li>{t('accountDeletion.retainedItem2')}</li>
          </ul>
          <p className="text-xs text-atm-muted mt-3">{t('accountDeletion.retainedNote')}</p>
        </section>

        <section className="bg-stone-50 rounded-2xl p-6 mb-4 border border-stone-200">
          <h2 className="text-lg font-semibold text-atm-ink mb-1">
            {t('accountDeletion.partialTitle')}
          </h2>
          <p className="text-xs text-atm-muted mb-4">{t('accountDeletion.partialSubtitle')}</p>

          <h3 className="text-sm font-semibold text-atm-ink mb-2">
            {t('accountDeletion.partialMethod1Title')}
          </h3>
          <ul className="list-disc list-inside text-sm text-atm-ink space-y-1 mb-4 leading-relaxed">
            <li>{t('accountDeletion.partialItem1')}</li>
            <li>{t('accountDeletion.partialItem2')}</li>
            <li>{t('accountDeletion.partialItem3')}</li>
            <li>{t('accountDeletion.partialItem4')}</li>
            <li>{t('accountDeletion.partialItem5')}</li>
          </ul>

          <h3 className="text-sm font-semibold text-atm-ink mb-2">
            {t('accountDeletion.partialMethod2Title')}
          </h3>
          <p className="text-sm text-atm-ink leading-relaxed mb-2 whitespace-pre-line">
            {t('accountDeletion.partialMethod2Body')}
          </p>
          <p className="text-xs text-atm-muted">{t('accountDeletion.partialMethod2Note')}</p>
        </section>

        <section className="bg-white rounded-2xl p-6 mb-8 border border-stone-200">
          <h2 className="text-lg font-semibold text-atm-ink mb-3">
            {t('accountDeletion.timelineTitle')}
          </h2>
          <ul className="text-sm text-atm-ink space-y-2 leading-relaxed">
            <li>
              <strong>{t('accountDeletion.timelineInAppLabel')}:</strong>{' '}
              {t('accountDeletion.timelineInAppValue')}
            </li>
            <li>
              <strong>{t('accountDeletion.timelineEmailLabel')}:</strong>{' '}
              {t('accountDeletion.timelineEmailValue')}
            </li>
          </ul>
        </section>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link to="/" className="text-atm-accent hover:underline">
            {t('accountDeletion.backHome')}
          </Link>
          <span className="text-atm-muted">·</span>
          <Link to="/privacy" className="text-atm-accent hover:underline">
            {t('accountDeletion.privacyLink')}
          </Link>
          <span className="text-atm-muted">·</span>
          <Link to="/terms" className="text-atm-accent hover:underline">
            {t('accountDeletion.termsLink')}
          </Link>
        </div>
      </div>
    </div>
  )
}
