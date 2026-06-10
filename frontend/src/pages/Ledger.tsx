import { useState } from 'react'
import AnnouncementBar from '../components/AnnouncementBar'
import AppHeader from '../components/AppHeader'
import Onboarding, { shouldShowOnboarding } from '../components/Onboarding'
import { useEntries } from '../hooks/useLedgerData'
// @ts-ignore - .jsx 파일을 무타입으로 가져옴 (점진적 TS 전환)
import ChatLedger from './LedgerChat.jsx'

export default function Ledger() {
  // 온보딩(L1)은 신규 사용자(기록 0건)에게만 1회 노출 — 기존 활성 사용자 방해 방지.
  // useEntries 는 LedgerChat 과 동일 queryKey 라 캐시 공유(중복 fetch 없음).
  const { data: entries, isLoading } = useEntries()
  const [dismissed, setDismissed] = useState(false)
  const showOnboarding =
    !dismissed &&
    shouldShowOnboarding() &&
    !isLoading &&
    (entries?.length ?? 0) === 0

  return (
    <div className="relative">
      <AnnouncementBar />
      <AppHeader />
      <ChatLedger />
      {showOnboarding && <Onboarding onDone={() => setDismissed(true)} />}
    </div>
  )
}
