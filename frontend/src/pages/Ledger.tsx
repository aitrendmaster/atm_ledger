import AnnouncementBar from '../components/AnnouncementBar'
import AppHeader from '../components/AppHeader'
// @ts-ignore - .jsx 파일을 무타입으로 가져옴 (점진적 TS 전환)
import ChatLedger from './Ledger.jsx'

export default function Ledger() {
  return (
    <div className="relative">
      <AnnouncementBar />
      <AppHeader />
      <ChatLedger />
    </div>
  )
}
