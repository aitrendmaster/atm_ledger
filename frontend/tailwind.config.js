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
