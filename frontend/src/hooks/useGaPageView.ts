import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void
  }
}

/**
 * SPA 라우트 변경 시마다 GA page_view 이벤트 발송.
 * index.html 의 gtag('config', 'G-...') 는 첫 로드만 추적하므로
 * React Router 클라이언트 라우팅을 별도로 잡아준다.
 */
export function useGaPageView() {
  const location = useLocation()
  useEffect(() => {
    if (typeof window.gtag !== 'function') return
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [location.pathname, location.search])
}
