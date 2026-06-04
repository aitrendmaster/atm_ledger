import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  HelpCircle,
  LogOut,
  MoreVertical,
  RefreshCw,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../hooks/useAuth'

/**
 * 페이지 공통 헤더 — 모바일/데스크탑 책임 분리.
 *
 * 모바일 (< md):
 *   - variant="absolute" 인 페이지(Landing/Ledger/Recurring/FAQ)는 sticky bar + 우측 3-dot
 *   - variant="inline" 인 페이지(Admin/MyPage)는 페이지가 이미 헤더 bar 를 갖고 있으므로
 *     3-dot 버튼만 (라벨 없는 단일 아이콘) 노출
 *   - 3-dot 탭하면 우측 drawer 메뉴 (FAQ/반복/내계정/관리자/로그아웃)
 *
 * 데스크탑 (>= md):
 *   - 기존 inline 버튼 5개 (FAQ/반복/내계정/관리자/로그아웃) 그대로 노출
 *   - LanguageSwitcher 는 헤더에서 제거 — MyPage Region 섹션에서만 변경 가능
 *
 * 향후 Capacitor (iOS/Android) 환경: safe-area-inset env 변수가 자동 적용되어
 * 노치/홈 인디케이터 충돌 없음.
 */
export default function AppHeader({
  variant = 'absolute',
  showFaq = true,
  title,
}: {
  variant?: 'absolute' | 'inline'
  showFaq?: boolean
  /** 모바일 sticky bar 에 표시할 페이지 타이틀. 미지정 시 브랜드명 */
  title?: string
}) {
  const { t } = useTranslation()
  const { user, signout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  // 브랜드명은 번역하지 않고 모든 언어에서 "Moa 365" 로 통일 (i18n app.name 값도 동일).
  const displayTitle = title || t('app.name', { defaultValue: 'Moa 365' })

  // ESC 키로 메뉴 닫기 + body 스크롤 잠금
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [menuOpen])

  // 메뉴 항목 정의 — drawer 와 데스크탑 모두 같은 데이터에서 파생.
  type MenuItem = {
    to?: string
    onClick?: () => void
    icon: typeof HelpCircle
    label: string
    accent?: boolean
  }
  const menuItems: MenuItem[] = user
    ? [
        ...(showFaq
          ? [{ to: '/faq', icon: HelpCircle, label: t('appHeader.faq', { defaultValue: 'FAQ' }) }]
          : []),
        {
          to: '/recurring',
          icon: RefreshCw,
          label: t('appHeader.recurring', { defaultValue: '반복 지출' }),
        },
        {
          to: '/me',
          icon: UserIcon,
          label: t('appHeader.myAccount', { defaultValue: '내 계정' }),
        },
        ...(user.is_admin
          ? [
              {
                to: '/admin',
                icon: ShieldCheck,
                label: t('appHeader.admin', { defaultValue: '관리자' }),
                accent: true,
              },
            ]
          : []),
      ]
    : []

  // 모바일 sticky bar (absolute variant 만)
  const mobileStickyBar = variant === 'absolute' && (
    <header
      className="md:hidden sticky top-0 z-40 bg-atm-card/95 backdrop-blur-sm
                 border-b border-stone-200 px-4 h-14
                 flex items-center justify-between
                 pt-[env(safe-area-inset-top)]"
    >
      <span className="text-base font-semibold text-atm-ink truncate">{displayTitle}</span>
      {user && (
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={t('appHeader.menu', { defaultValue: '메뉴' })}
          className="w-11 h-11 -mr-2 flex items-center justify-center text-atm-ink
                     active:bg-stone-100 rounded-lg"
        >
          <MoreVertical size={20} />
        </button>
      )}
    </header>
  )

  // 모바일 인라인 3-dot 버튼 (inline variant 만 — 페이지가 이미 헤더 bar 보유)
  const mobileInlineButton = variant === 'inline' && user && (
    <button
      type="button"
      onClick={() => setMenuOpen(true)}
      aria-label={t('appHeader.menu', { defaultValue: '메뉴' })}
      className="md:hidden w-11 h-11 -mr-2 flex items-center justify-center text-atm-ink
                 active:bg-stone-100 rounded-lg"
    >
      <MoreVertical size={20} />
    </button>
  )

  // 데스크탑 inline 버튼들
  const desktopWrapper =
    variant === 'absolute'
      ? 'hidden md:flex absolute top-3 right-4 z-40 items-center gap-2'
      : 'hidden md:flex items-center gap-2'

  const desktopButtons = (
    <div className={desktopWrapper}>
      {user && (
        <>
          {showFaq && (
            <Link
              to="/faq"
              title="FAQ"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-stone-200
                         rounded-lg text-xs text-atm-muted hover:bg-stone-50"
            >
              <HelpCircle size={14} /> <span>FAQ</span>
            </Link>
          )}
          <Link
            to="/recurring"
            title={t('appHeader.recurring', { defaultValue: '반복 지출' })}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-stone-200
                       rounded-lg text-xs text-atm-muted hover:bg-stone-50"
          >
            <RefreshCw size={14} />{' '}
            <span>{t('appHeader.recurring', { defaultValue: '반복 지출' })}</span>
          </Link>
          <Link
            to="/me"
            title={t('appHeader.myAccount', { defaultValue: '내 계정' })}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-stone-200
                       rounded-lg text-xs text-atm-muted hover:bg-stone-50"
          >
            <UserIcon size={14} />{' '}
            <span>{t('appHeader.myAccount', { defaultValue: '내 계정' })}</span>
          </Link>
          {user.is_admin && (
            <Link
              to="/admin"
              title={t('appHeader.admin', { defaultValue: '관리자' })}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-stone-200
                         rounded-lg text-xs text-atm-accent hover:bg-stone-50"
            >
              <ShieldCheck size={14} />{' '}
              <span>{t('appHeader.admin', { defaultValue: '관리자' })}</span>
            </Link>
          )}
          <button
            type="button"
            onClick={signout}
            title={t('appHeader.logout', { defaultValue: '로그아웃' })}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-stone-200
                       rounded-lg text-xs text-atm-muted hover:bg-stone-50"
          >
            <LogOut size={14} />{' '}
            <span>{t('appHeader.logout', { defaultValue: '로그아웃' })}</span>
          </button>
        </>
      )}
    </div>
  )

  // 모바일 overflow drawer
  const drawer = menuOpen && (
    <>
      {/* backdrop */}
      <button
        type="button"
        aria-label={t('appHeader.close', { defaultValue: '닫기' })}
        onClick={() => setMenuOpen(false)}
        className="md:hidden fixed inset-0 z-50 bg-black/40"
      />
      {/* drawer panel */}
      <div
        role="menu"
        className="md:hidden fixed right-0 top-0 bottom-0 z-50
                   w-72 max-w-[80vw] bg-white shadow-xl
                   flex flex-col
                   pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-stone-200">
          <span className="font-semibold text-atm-ink">
            {t('appHeader.menu', { defaultValue: '메뉴' })}
          </span>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label={t('appHeader.close', { defaultValue: '닫기' })}
            className="w-11 h-11 -mr-2 flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {menuItems.map((item) => (
            <Link
              key={item.to}
              to={item.to!}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-4 h-12 text-sm hover:bg-stone-50 active:bg-stone-100 ${
                item.accent ? 'text-atm-accent' : 'text-atm-ink'
              }`}
            >
              <item.icon size={18} className="text-atm-muted" />
              <span>{item.label}</span>
            </Link>
          ))}
          {user && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                signout()
              }}
              className="w-full flex items-center gap-3 px-4 h-12 text-sm text-atm-ink
                         hover:bg-stone-50 active:bg-stone-100
                         border-t border-stone-100 mt-2"
            >
              <LogOut size={18} className="text-atm-muted" />
              <span>{t('appHeader.logout', { defaultValue: '로그아웃' })}</span>
            </button>
          )}
        </nav>
      </div>
    </>
  )

  return (
    <>
      {mobileStickyBar}
      {mobileInlineButton}
      {desktopButtons}
      {drawer}
    </>
  )
}
