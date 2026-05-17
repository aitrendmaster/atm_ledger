import { LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
// @ts-ignore - .jsx 파일을 무타입으로 가져옴 (점진적 TS 전환)
import ChatLedger from './Ledger.jsx'

export default function Ledger() {
  const { user, signout } = useAuth()
  return (
    <div className="relative">
      <div className="absolute top-3 right-4 z-50 flex items-center gap-3">
        <span className="text-xs text-atm-muted">{user?.display_name || user?.email}</span>
        <button
          onClick={signout}
          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-atm-muted hover:bg-stone-50"
        >
          <LogOut size={14} /> 로그아웃
        </button>
      </div>
      <ChatLedger />
    </div>
  )
}
