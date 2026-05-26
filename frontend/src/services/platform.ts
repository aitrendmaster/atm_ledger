/**
 * 플랫폼 분기 헬퍼.
 *
 * Capacitor 네이티브(Android) 환경에서는 외부 URL 을 시스템 브라우저
 * (Chrome Custom Tab) 으로 띄워야 한다. 이유:
 *   1) Google Play 정책 — 제3자 결제 페이지를 in-app WebView 안에서
 *      여는 것은 보안 정책상 위험으로 분류돼 리젝 사유가 될 수 있다.
 *   2) 3DS / SCA 카드 인증이 WebView 내부에서 안정적이지 않다.
 *   3) Custom Tab 은 시스템 브라우저의 자동완성·저장된 카드를 그대로
 *      활용할 수 있어 UX 가 더 매끄럽다.
 *
 * 웹(브라우저)에서는 그냥 같은 탭으로 이동시킨다.
 */
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

export const isNative = (): boolean => Capacitor.isNativePlatform()

export async function openExternalCheckout(url: string): Promise<void> {
  if (isNative()) {
    await Browser.open({ url, presentationStyle: 'fullscreen' })
  } else {
    window.location.href = url
  }
}
