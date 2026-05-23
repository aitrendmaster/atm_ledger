import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'kr.atm.moa',
  appName: 'Moa AI 가계부',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#FBF8F3',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#FBF8F3',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Camera: {
      // 권한 안내 문구는 AndroidManifest / Info.plist 에서 별도 관리
    },
    FirebaseAuthentication: {
      // 네이티브 sign-in (Google Sign-In SDK) + Firebase Auth 둘 다 처리.
      // Google id_token 은 google-services.json 의 client_id 로 audience 발급.
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
}

export default config
