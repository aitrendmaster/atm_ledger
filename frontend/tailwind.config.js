/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        atm: {
          bg: '#FBF8F3',
          card: '#FFFFFF',
          ink: '#2E2A24',
          muted: '#7A7567',
          accent: '#E07856',
        },
        // moa365 4색 시맨틱 (제품 기능 축 — 지출 카테고리 색과 별개).
        // 그라데이션 from→to. accent(#E07856)는 record 와 정합.
        record: { from: '#FF6B2C', to: '#FFA63D', DEFAULT: '#FF6B2C' },
        journey: { from: '#01DCE3', to: '#2D7DFF', DEFAULT: '#2D7DFF' },
        insight: { from: '#7B61FF', to: '#A78BFA', DEFAULT: '#7B61FF' },
        growth: { from: '#9BE15D', to: '#00C48C', DEFAULT: '#00C48C' },
      },
      // 좌→우 통일 = 시간이 흐르는 방향(여정).
      backgroundImage: {
        'grad-record': 'linear-gradient(90deg, #FF6B2C 0%, #FFA63D 100%)',
        'grad-journey': 'linear-gradient(90deg, #01DCE3 0%, #2D7DFF 100%)',
        'grad-insight': 'linear-gradient(90deg, #7B61FF 0%, #A78BFA 100%)',
        'grad-growth': 'linear-gradient(90deg, #9BE15D 0%, #00C48C 100%)',
      },
      fontFamily: {
        sans: [
          'Pretendard Variable', 'Pretendard', '-apple-system', 'BlinkMacSystemFont',
          'Segoe UI', 'Noto Sans KR', 'Apple SD Gothic Neo', 'sans-serif',
        ],
      },
      // iOS notch / Android navigation bar 안전 영역 — Capacitor 환경에서 자동 활성화
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      minHeight: {
        // Apple HIG 44pt / Material 48dp 의 합집합으로 44px 채택
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
}
