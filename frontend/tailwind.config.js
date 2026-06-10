/** ============================================================
 * moa365 Tailwind Config — src/styles/tokens.css 의 CSS 변수에 1:1 매핑
 * 규칙: 컴포넌트에서 임의 값(arbitrary value)으로 hex 를 쓰지 말 것.
 * 모든 색·라운드·그림자는 아래 토큰 클래스로만. (브랜드 플레이북 Part 11)
 * ============================================================ */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ---- 레거시 atm 팔레트 (랜딩·로그인 등 기존 페이지 호환용) ----
        atm: {
          bg: '#FBF8F3',
          card: '#FFFFFF',
          ink: '#2E2A24',
          muted: '#7A7567',
          accent: '#E07856',
        },
        // ---- 크림 벤토 Surface ----
        cream: 'var(--bg-base)',
        surface: 'var(--surface)',
        sunken: 'var(--surface-sunken)',
        line: 'var(--line)',
        // ---- Ink ----
        ink: {
          DEFAULT: 'var(--ink-primary)',
          secondary: 'var(--ink-secondary)',
          tertiary: 'var(--ink-tertiary)',
          faint: 'var(--ink-faint)',
          ondark: 'var(--ink-on-dark)',
          'ondark-muted': 'var(--ink-on-dark-muted)',
        },
        // ---- Semantic (단색 대표값 — 텍스트/아이콘용) ----
        // 리터럴 hex 유지 이유: Tailwind 3 의 /opacity 변형(bg-insight/10 등)이
        // var() 값에는 동작하지 않음. tokens.css 와 값 동기화 필수.
        record: { from: '#FF6B2C', to: '#FFA63D', DEFAULT: '#FF6B2C' },
        journey: { from: '#01DCE3', to: '#2D7DFF', DEFAULT: '#2D7DFF' },
        insight: { from: '#A78BFA', to: '#7B61FF', DEFAULT: '#7B61FF' },
        growth: { from: '#9BE15D', to: '#00C48C', DEFAULT: '#00C48C' },
        saving: 'var(--saving-text)',
        'tint-saving': 'var(--tint-saving)',
      },
      // 그라데이션 방향 135° 고정 — tokens.css 프리셋만 사용 (HANDOFF §1-3)
      backgroundImage: {
        'grad-record': 'var(--grad-record)',
        'grad-saving': 'var(--grad-saving)',
        'grad-journey': 'var(--grad-journey)',
        'grad-insight': 'var(--grad-insight)',
        'grad-memorial': 'var(--grad-memorial)', // 스탬프 전용
        'grad-hidden': 'var(--grad-hidden)',     // 스탬프 전용
      },
      borderRadius: {
        card: 'var(--radius-card)',         // rounded-card
        'card-lg': 'var(--radius-card-lg)', // rounded-card-lg (히어로 벤토)
        pill: 'var(--radius-pill)',         // rounded-pill
      },
      boxShadow: {
        soft: 'var(--shadow-soft)', // shadow-soft — 카드 그림자는 이것 하나만
      },
      fontFamily: {
        sans: [
          'Pretendard Variable', 'Pretendard', '-apple-system', 'BlinkMacSystemFont',
          'Segoe UI', 'Noto Sans KR', 'Apple SD Gothic Neo', 'sans-serif',
        ],
      },
      fontWeight: {
        display: '800', // font-display — 타이틀·숫자 (벤토의 주인공)
        caption: '300', // font-caption
      },
      // iOS notch / Android navigation bar 안전 영역 — Capacitor 환경에서 자동 활성화
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
        page: 'var(--space-page)', // px-page
      },
      minHeight: {
        // Apple HIG 44pt / Material 48dp 의 합집합으로 44px 채택
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
      keyframes: {
        'stamp-in': {
          '0%': { transform: 'scale(1.4) rotate(var(--stamp-rot, 0deg))', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(var(--stamp-rot, 0deg))', opacity: '1' },
        },
        'fade-up': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'stamp-in': 'stamp-in var(--dur-stamp) var(--ease-spring) both',
        'fade-up': 'fade-up var(--dur-base) var(--ease-out) both',
      },
    },
  },
  plugins: [],
}
