/**
 * Capacitor 네이티브 초기화.
 *
 * - 네이티브(Android/iOS) 빌드에서만 StatusBar/SplashScreen 제어
 * - 웹 빌드에서는 isNativePlatform() === false 라서 모두 no-op
 * - 동적 import 로 웹 번들 크기 영향 최소화
 *
 * `main.tsx` 의 ReactDOM.createRoot() 직후에 호출.
 */

export async function initCapacitorNative(): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return

    const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/splash-screen'),
    ])

    // 상태바: 밝은 배경(#FBF8F3) + 어두운 아이콘
    await StatusBar.setStyle({ style: Style.Light })
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#FBF8F3' })
    }

    // 스플래시 자동 숨김 — capacitor.config.ts 의 launchShowDuration 과 함께 동작
    setTimeout(() => {
      SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {
        /* 이미 숨겨진 경우 무시 */
      })
    }, 600)
  } catch (err) {
    // Capacitor 모듈이 없거나 (웹 dev 환경에서 일부 빌드 도구가 못 resolve) 실패해도
    // 앱 부팅은 계속되어야 함.
    // eslint-disable-next-line no-console
    console.debug('Capacitor native init skipped:', err)
  }
}
