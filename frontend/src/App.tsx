import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useGaPageView } from './hooks/useGaPageView'
import BottomTabBar from './components/BottomTabBar'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Ledger from './pages/Ledger'
import Landing from './pages/Landing'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import Refund from './pages/Refund'
import Pricing from './pages/Pricing'
import Admin from './pages/Admin'
import FaqPage from './pages/FaqPage'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import MyPage from './pages/MyPage'
import RecurringExpenses from './pages/RecurringExpenses'

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8 text-atm-muted">로딩 중…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  useGaPageView()
  return (
    <>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/refund" element={<Refund />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/app" element={<Protected><Ledger /></Protected>} />
      <Route path="/me" element={<Protected><MyPage /></Protected>} />
      <Route path="/recurring" element={<Protected><RecurringExpenses /></Protected>} />
      <Route path="/admin" element={<Protected><Admin /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    {/* 모바일 하단 탭바 — 로그인 사용자에게만 노출 (BottomTabBar 내부 가드).
        md 이상에서는 컴포넌트가 자동 숨김. */}
    <BottomTabBar />
    </>
  )
}
