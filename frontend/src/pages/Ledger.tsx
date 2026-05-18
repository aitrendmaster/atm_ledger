import { Link } from 'react-router-dom'
import { HelpCircle, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import AnnouncementBar from '../components/AnnouncementBar'
// @ts-ignore - .jsx 파일을 무타입으로 가져옴 (점진적 TS 전환)
import ChatLedger from './Ledger.jsx'

export default function Ledger() {
  const { user, signout } = useAuth()
  return (
    <div className="relative">
      <AnnouncementBar />
      <div className="absolute top-3 right-4 z-50 flex items-center gap-2">
        <span className="hidden sm:inline text-xs text-atm-muted">
          {user?.display_name || user?.email}
        </span>
        <Link
          to="/faq"
          title="자주 묻는 질문"
          className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-atm-muted hover:bg-stone-50"
        >
          <HelpCircle size={14} /> <span className="hidden sm:inline">FAQ</span>
        </Link>
        {user?.is_admin && (
          <Link
            to="/admin"
            title="관리자 대시보드"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-atm-accent hover:bg-stone-50"
          >
            <ShieldCheck size={14} /> <span className="hidden sm:inline">Admin</span>
          </Link>
        )}
        <button
          onClick={signout}
          title="로그아웃"
          className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-atm-muted hover:bg-stone-50"
        >
          <LogOut size={14} /> <span className="hidden sm:inline">로그아웃</span>
        </button>
      </div>
      <ChatLedger />
    </div>
  )
}
