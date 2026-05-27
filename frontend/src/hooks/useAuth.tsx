import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import i18n from '../i18n'
import { initPushNotifications } from '../lib/push-init'
import { authApi, SignupExtras, tokenStore, User } from '../services/api'

interface AuthCtx {
  user: User | null
  loading: boolean
  signin: (email: string, password: string) => Promise<void>
  signup: (
    email: string,
    password: string,
    displayName?: string,
    extras?: SignupExtras,
  ) => Promise<void>
  signinWithGoogle: (idToken: string) => Promise<void>
  signout: () => void
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const loadMe = async () => {
    if (!tokenStore.access) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const r = await authApi.me()
      setUser(r.data)
      // 백엔드에 저장된 locale 을 UI 에 즉시 적용 (다른 기기에서 변경된 경우 동기화)
      if (r.data.locale && i18n.language !== r.data.locale) {
        try { await i18n.changeLanguage(r.data.locale) } catch { /* 폴백 무시 */ }
      }
      // 네이티브: 푸시 알림 권한 + FCM 토큰 등록 (웹은 no-op).
      // 멱등 — 같은 토큰 반복 호출해도 백엔드에서 upsert.
      void initPushNotifications()
    } catch {
      tokenStore.clear()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMe()
  }, [])

  const value: AuthCtx = {
    user,
    loading,
    async signin(email, password) {
      const r = await authApi.login(email, password)
      tokenStore.set(r.data.access_token, r.data.refresh_token)
      await loadMe()
    },
    async signup(email, password, displayName, extras) {
      // 가입은 토큰을 발급하지 않는다 — 이메일 인증 후 수동 로그인.
      // 호출처(Signup.tsx)에서 응답을 기반으로 verify-pending 페이지로 이동.
      await authApi.signup(email, password, displayName, extras)
    },
    async signinWithGoogle(idToken) {
      const r = await authApi.googleLogin(idToken)
      tokenStore.set(r.data.access_token, r.data.refresh_token)
      await loadMe()
    },
    signout() {
      tokenStore.clear()
      setUser(null)
    },
    refresh: loadMe,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used within AuthProvider')
  return v
}
