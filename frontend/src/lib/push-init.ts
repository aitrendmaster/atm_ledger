/**
 * Capacitor PushNotifications 초기화 + FCM 토큰 등록.
 *
 * 호출 시점: 로그인 후 `useAuth.loadMe()` 가 user 를 설정한 직후.
 * 흐름:
 *   1) Capacitor.isNativePlatform() 가드 (웹은 no-op)
 *   2) PushNotifications.requestPermissions() — Android 13+ 는 명시적 권한 요구
 *   3) 거부됐으면 안내 토스트 후 종료
 *   4) register() — FCM/APNs 토큰 발급 요청
 *   5) 'registration' 이벤트로 토큰 받으면 백엔드 /me/push-token 등록
 *   6) 'registrationError' 는 로그만
 *   7) 'pushNotificationReceived' / 'pushNotificationActionPerformed' 핸들러
 *
 * 멱등 보장: 같은 토큰을 여러 번 register 해도 백엔드 upsert.
 */
import { pushApi } from '../services/api'

let _initialized = false
let _registered = false

export async function initPushNotifications(): Promise<void> {
  if (_initialized) return
  _initialized = true

  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return

    const { PushNotifications } = await import('@capacitor/push-notifications')

    // 1) 권한 요청
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') {
      // eslint-disable-next-line no-console
      console.warn('[push] 권한 거부됨 — 알림 비활성')
      return
    }

    // 2) 이벤트 리스너 등록 (한 번만)
    await PushNotifications.addListener('registration', async (regToken) => {
      if (_registered) return
      _registered = true
      try {
        const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web'
        const device = `${platform} / Capacitor`
        await pushApi.registerToken(regToken.value, platform, device)
        // eslint-disable-next-line no-console
        console.log('[push] 백엔드 등록 완료')
      } catch (err) {
        _registered = false
        // eslint-disable-next-line no-console
        console.error('[push] 백엔드 등록 실패', err)
      }
    })

    await PushNotifications.addListener('registrationError', (err) => {
      // eslint-disable-next-line no-console
      console.error('[push] FCM 등록 실패', err)
    })

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // 포어그라운드에서 받은 알림 — 일단 로그만 (인앱 토스트는 v2)
      // eslint-disable-next-line no-console
      console.log('[push] foreground 알림', notification.title, notification.body)
    })

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      // 사용자가 알림을 탭한 경우 — 향후 deep-link 처리 (현재는 로그)
      // eslint-disable-next-line no-console
      console.log('[push] 알림 탭됨', action.notification.data)
    })

    // 3) FCM 토큰 발급 요청 → 'registration' 이벤트 트리거
    await PushNotifications.register()
  } catch (err) {
    // 어떤 이유로든 실패해도 앱 부팅에는 영향 없도록 swallow
    // eslint-disable-next-line no-console
    console.debug('[push] 초기화 실패 (web build 등)', err)
  }
}
