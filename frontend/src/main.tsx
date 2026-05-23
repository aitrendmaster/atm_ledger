import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { GoogleOAuthProvider } from '@react-oauth/google'

import App from './App'
import { AuthProvider } from './hooks/useAuth'
import { initCapacitorNative } from './lib/capacitor-init'
import './i18n'
import './index.css'

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 0, refetchOnWindowFocus: false } },
})

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

const Root = (
  <React.StrictMode>
    <HashRouter>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <App />
          <Toaster position="top-center" />
        </AuthProvider>
      </QueryClientProvider>
    </HashRouter>
  </React.StrictMode>
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  GOOGLE_CLIENT_ID ? (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{Root}</GoogleOAuthProvider>
  ) : (
    Root
  ),
)

// 네이티브(Android/iOS) 빌드에서만 동작. 웹은 no-op.
initCapacitorNative()
