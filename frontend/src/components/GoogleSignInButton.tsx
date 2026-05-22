import { GoogleLogin } from '@react-oauth/google'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'

/**
 * Google 로그인 버튼. VITE_GOOGLE_CLIENT_ID 가 비어 있으면 컴포넌트 자체가 hidden.
 * Login 화면과 Signup 화면 양쪽에서 같은 동작 — 신규/기존 동일 흐름(upsert).
 */
export default function GoogleSignInButton({ redirectTo = '/app' }: { redirectTo?: string }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  const { signinWithGoogle } = useAuth()
  const nav = useNavigate()

  if (!clientId) return null

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[11px] text-atm-muted">또는</div>
      <GoogleLogin
        onSuccess={async (credentialResponse) => {
          const idToken = credentialResponse.credential
          if (!idToken) {
            toast.error('Google 응답이 비어 있습니다.')
            return
          }
          try {
            await signinWithGoogle(idToken)
            nav(redirectTo, { replace: true })
          } catch (err: any) {
            toast.error(err?.response?.data?.detail || 'Google 로그인 실패')
          }
        }}
        onError={() => {
          toast.error('Google 로그인이 취소되었거나 실패했습니다.')
        }}
        useOneTap={false}
        theme="outline"
        size="large"
        text="continue_with"
        shape="rectangular"
      />
    </div>
  )
}
