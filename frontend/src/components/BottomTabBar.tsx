import { NavLink, useLocation } from 'react-router-dom'
import { Calendar, Home, RefreshCw, User as UserIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../hooks/useAuth'

/**
 * 모바일 전용 하단 탭바.
 *
 * - md (>=768px) 이상에서는 자동 숨김 (`md:hidden`)
 * - 로그인 상태에서만 표시
 * - 4 탭: 홈 / 캘린더 / 반복 / MY
 * - safe-area-inset-bottom 자동 패딩 (iOS 홈 인디케이터 대응)
 * - 활성 탭 색상 = atm-accent
 *
 * 캘린더 탭은 ledger 페이지의 calendar 탭으로 navigate (쿼리 파라미터 사용).
 * Ledger 페이지가 이미 마운트된 상태면 라우터가 같은 라우트라 페이지 리로드 없음.
 */
export default function BottomTabBar() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return null

  const tabs = [
    {
      to: '/app',
      icon: Home,
      label: t('bottomNav.home', { defaultValue: '홈' }),
      isActive: () => location.pathname === '/app' && !location.search.includes('tab=calendar'),
    },
    {
      to: '/app?tab=calendar',
      icon: Calendar,
      label: t('bottomNav.calendar', { defaultValue: '캘린더' }),
      isActive: () => location.pathname === '/app' && location.search.includes('tab=calendar'),
    },
    {
      to: '/recurring',
      icon: RefreshCw,
      label: t('bottomNav.recurring', { defaultValue: '반복' }),
      isActive: () => location.pathname.startsWith('/recurring'),
    },
    {
      to: '/me',
      icon: UserIcon,
      label: t('bottomNav.me', { defaultValue: 'MY' }),
      isActive: () => location.pathname.startsWith('/me'),
    },
  ]

  return (
    <nav
      aria-label={t('bottomNav.label', { defaultValue: '주 네비게이션' })}
      className="md:hidden fixed bottom-0 inset-x-0 z-30
                 bg-atm-card border-t border-stone-200
                 pb-[env(safe-area-inset-bottom)]
                 grid grid-cols-4 h-16"
    >
      {tabs.map((tab) => {
        const active = tab.isActive()
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 min-h-touch
                        ${active ? 'text-atm-accent' : 'text-atm-muted active:bg-stone-50'}`}
          >
            <tab.icon size={20} strokeWidth={active ? 2.2 : 1.8} />
            <span className="text-[11px] leading-tight truncate max-w-full px-1">{tab.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
