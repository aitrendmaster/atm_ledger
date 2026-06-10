import { useState } from 'react'
import AnnouncementBar from '../components/AnnouncementBar'
import AppHeader from '../components/AppHeader'
import Onboarding, { shouldShowOnboarding } from '../components/Onboarding'
// @ts-ignore - .jsx 파일을 무타입으로 가져옴 (점진적 TS 전환)
import ChatLedger from './LedgerChat.jsx'

export default function Ledger() {
  // 첫 로그인 1회 온보딩(L1). localStorage 'moa_onboarding_seen' 로 재노출 방지.
  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding)

  return (
    <div className="relative">
      <AnnouncementBar />
      <AppHeader />
      <ChatLedger />
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
    </div>
  )
}
