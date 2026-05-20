import { Link } from 'react-router-dom'
import { HelpCircle, LogOut, RefreshCw, ShieldCheck, User as UserIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import LanguageSwitcher from './LanguageSwitcher'

/**
 * 페이지 우상단 공통 헤더. 로그인 상태/관리자 여부에 따라 메뉴가 다름.
 * Landing/Login/Signup/Ledger/MyPage/Admin/FAQ 등 어디서나 같은 UX.
 *
 * - 비로그인: 언어 셀렉터만
 * - 로그인: 언어 셀렉터 + FAQ + 내 계정 + (admin 이면) Admin + 로그아웃
 */
export default function AppHeader({
  variant = 'absolute',
  showFaq = true,
}: {
  variant?: 'absolute' | 'inline'
  showFaq?: boolean
}) {
  const { t } = useTranslation()
  const { user, signout } = useAuth()
  const wrapperClass =
    variant === 'absolute'
      ? 'absolute top-3 right-4 z-40 flex items-center gap-2'
      : 'flex items-center gap-2'

  return (
    <div className={wrapperClass}>
      <LanguageSwitcher />
      {user && (
        <>
          {showFaq && (
            <Link
              to="/faq"
              title="FAQ"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-atm-muted hover:bg-stone-50"
            >
              <HelpCircle size={14} /> <span className="hidden sm:inline">FAQ</span>
            </Link>
          )}
          <Link
            to="/recurring"
            title={t('appHeader.recurring', { defaultValue: '반복 지출' })}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-atm-muted hover:bg-stone-50"
          >
            <RefreshCw size={14} /> <span className="hidden sm:inline">{t('appHeader.recurring', { defaultValue: '반복 지출' })}</span>
          </Link>
          <Link
            to="/me"
            title={t('appHeader.myAccount')}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-atm-muted hover:bg-stone-50"
          >
            <UserIcon size={14} /> <span className="hidden sm:inline">{t('appHeader.myAccount')}</span>
          </Link>
          {user.is_admin && (
            <Link
              to="/admin"
              title={t('appHeader.admin')}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-atm-accent hover:bg-stone-50"
            >
              <ShieldCheck size={14} /> <span className="hidden sm:inline">{t('appHeader.admin')}</span>
            </Link>
          )}
          <button
            type="button"
            onClick={signout}
            title={t('appHeader.logout')}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-atm-muted hover:bg-stone-50"
          >
            <LogOut size={14} /> <span className="hidden sm:inline">{t('appHeader.logout')}</span>
          </button>
        </>
      )}
    </div>
  )
}
