import { NavLink, useLocation } from 'react-router-dom'
import { Calendar, Home, Stamp as StampIcon, RefreshCw, User as UserIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../hooks/useAuth'

/**
 * 모바일 전용 하단 탭바 — 크림 벤토 시스템 (HANDOFF 3-6).
 *
 * - md (>=768px) 이상에서는 자동 숨김 (`md:hidden`)
 * - 로그인 상태에서만 표시
 * - 5 탭: 홈 / 캘린더 / 여정 / 반복 / MY
 * - safe-area-inset-bottom 자동 패딩 (iOS 홈 인디케이터 대응)
 * - 활성 탭: text-ink + font-display + 하단 record 도트 5px / 비활성: text-ink-faint
 *
 * 캘린더·여정 탭은 ledger 페이지의 해당 탭으로 navigate (쿼리 파라미터 사용).
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
      isActive: () => location.pathname === '/app' && !location.search.includes('tab='),
    },
    {
      to: '/app?tab=calendar',
      icon: Calendar,
      label: t('bottomNav.calendar', { defaultValue: '캘린더' }),
      isActive: () => location.pathname === '/app' && location.search.includes('tab=calendar'),
    },
    {
      to: '/app?tab=journey',
      icon: StampIcon,
      label: t('bottomNav.journey', { defaultValue: '여정' }),
      isActive: () => location.pathname === '/app' && location.search.includes('tab=journey'),
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
                 bg-surface border-t border-line
                 pb-[max(8px,env(safe-area-inset-bottom))]
                 grid grid-cols-5"
      style={{ minHeight: 'calc(64px + max(8px, env(safe-area-inset-bottom)))' }}
    >
      {tabs.map((tab) => {
        const active = tab.isActive()
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={`relative flex flex-col items-center justify-center gap-0.5 min-h-touch
                        ${active ? 'text-ink font-display' : 'text-ink-faint font-medium active:bg-sunken'}`}
          >
            <tab.icon size={20} strokeWidth={active ? 2.2 : 1.8} />
            <span className="text-[11px] leading-tight truncate max-w-full px-1">{tab.label}</span>
            {/* 활성 도트 — record 5px (HANDOFF 3-6) */}
            {active && <span aria-hidden className="absolute bottom-1 w-[5px] h-[5px] rounded-pill bg-record" />}
          </NavLink>
        )
      })}
    </nav>
  )
}
