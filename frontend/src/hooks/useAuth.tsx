import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import i18n from '../i18n'
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
      const r = await authApi.signup(email, password, displayName, extras)
      tokenStore.set(r.data.access_token, r.data.refresh_token)
      await loadMe()
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
