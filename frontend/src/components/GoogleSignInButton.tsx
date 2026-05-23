import { GoogleLogin } from '@react-oauth/google'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Capacitor } from '@capacitor/core'

import { useAuth } from '../hooks/useAuth'

/**
 * Google 로그인 버튼.
 *
 * - 웹: `@react-oauth/google` 의 `<GoogleLogin>` (Google Identity Services).
 *   `VITE_GOOGLE_CLIENT_ID` 가 비어 있으면 컴포넌트 자체 hidden.
 * - 네이티브(Android/iOS): `@capacitor-firebase/authentication` 의
 *   `signInWithGoogle()` 호출 → result.credential.idToken 을 백엔드로 전달.
 *   네이티브는 google-services.json 의 client_id 로 audience 발급하므로,
 *   백엔드 `GOOGLE_EXTRA_CLIENT_IDS` 에 그 client_id 가 등록돼 있어야 검증 통과.
 *
 * Login/Signup 양쪽에서 같은 동작 — 신규/기존 동일 흐름(upsert).
 */
export default function GoogleSignInButton({ redirectTo = '/app' }: { redirectTo?: string }) {
  const isNative = Capacitor.isNativePlatform()
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  const { signinWithGoogle } = useAuth()
  const nav = useNavigate()

  // 웹: clientId 없으면 숨김. 네이티브: google-services.json 사용해서 clientId 무관.
  if (!isNative && !clientId) return null

  if (isNative) {
    const handleNativeLogin = async () => {
      try {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication')
        // 1) 직전에 캐시된 Google 계정을 해제해서 자동 로그인 방지.
        //    (비활성화·잘못된 계정이 자동 선택되면 사용자가 빠져나올 방법이 없으므로)
        try {
          await FirebaseAuthentication.signOut()
        } catch (_) {
          // 첫 호출 등으로 sign-out 할 게 없으면 무시
        }
        // 2) Google 표준 'select_account' prompt 로 매번 계정 선택 다이얼로그 강제.
        const result = await FirebaseAuthentication.signInWithGoogle({
          customParameters: [{ key: 'prompt', value: 'select_account' }],
        })
        const idToken = result.credential?.idToken
        if (!idToken) {
          toast.error('Google 응답에 토큰이 없습니다.')
          return
        }
        await signinWithGoogle(idToken)
        nav(redirectTo, { replace: true })
      } catch (err: any) {
        // 사용자가 시스템 다이얼로그에서 취소한 경우 — 조용히 무시
        const msg = String(err?.message || err?.code || '')
        if (
          msg.includes('canceled') ||
          msg.includes('cancelled') ||
          msg.includes('12501') ||
          err?.code === 'sign_in_cancelled'
        ) {
          return
        }
        toast.error(err?.response?.data?.detail || err?.message || 'Google 로그인 실패')
      }
    }

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="text-[11px] text-atm-muted">또는</div>
        <button
          type="button"
          onClick={handleNativeLogin}
          className="flex items-center gap-3 px-6 py-2.5 border border-stone-300 rounded-md
                     bg-white text-sm font-medium text-stone-700 min-h-touch
                     hover:bg-stone-50 active:bg-stone-100 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Google로 계속하기
        </button>
      </div>
    )
  }

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
