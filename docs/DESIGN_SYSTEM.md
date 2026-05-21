# Moa AI 가계부 — 디자인 시스템

> 본 문서는 Moa AI 가계부의 시각·인터랙션 디자인 단일 진실 (Single Source of Truth) 입니다.
> 새 페이지/컴포넌트 작성 시 본 문서의 토큰·패턴·원칙을 따르세요.

## 1. 브랜드 원칙

Moa는 **따뜻함 (warm), 친근함 (friendly), 정돈됨 (organized)** 세 단어로 요약됩니다.

| 원칙 | 의미 | 시각 표현 |
|---|---|---|
| 따뜻함 | 가계부 = 부담스럽다는 통념 해체 | 베이지·코랄 톤, 둥근 모서리, 시스템 폰트 |
| 친근함 | AI 코치가 "친구처럼" 격식 없이 대화 | 한국어 반말 카피, 둥근 채팅 버블, 이모지 활용 |
| 정돈됨 | 복잡한 가계 데이터를 한눈에 | 카드 그리드, 일관된 간격, 명확한 시각 위계 |

---

## 2. 색상 토큰

### 2.1 Tailwind `atm.*` 토큰 (`tailwind.config.js`)

| 토큰 | HEX | RGB | 용도 |
|---|---|---|---|
| `atm-bg` | `#FBF8F3` | 251, 248, 243 | 페이지 기본 배경 (베이지/크림) |
| `atm-card` | `#FFFFFF` | 255, 255, 255 | 카드/패널 표면 |
| `atm-ink` | `#2E2A24` | 46, 42, 36 | 본문/제목 텍스트, 다크 섹션 배경 |
| `atm-muted` | `#7A7567` | 122, 117, 103 | 보조 텍스트, 캡션, 비활성 아이콘 |
| `atm-accent` | `#E07856` | 224, 120, 86 | 주 CTA, 강조, 시그니처 컬러 (코랄) |

### 2.2 보조 톤 (Tailwind 기본 `stone-*` / `red-*` / `amber-*` 활용)

| 의도 | 권장 클래스 | 용도 |
|---|---|---|
| 카드 외곽 | `border-stone-200` | 라이트 섹션 카드 테두리 |
| 위험·삭제 | `text-red-500` `bg-red-50` | 삭제 확인, 종료일 누락 경고 |
| 주의·미저장 | `text-amber-600` `bg-amber-50` | 미저장 변경, 안내 배너 |
| 성공·저장 | `text-emerald-600` `bg-emerald-50` | 저장 완료, 인증 성공 |

### 2.3 다크 섹션 (네거티브 컨트라스트)

```tsx
<section className="bg-atm-ink text-atm-bg">
  <h2 className="text-white">제목</h2>
  <p className="text-white/70">부제목</p>
</section>
```

Hero·Target·CTA2 같은 강조 섹션에 사용. 본문 텍스트는 `text-atm-bg` 또는 `text-white/80` 으로 컨트라스트 확보.

---

## 3. 타이포그래피

### 3.1 폰트 패밀리

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
             'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif;
```

- **추가 웹폰트 없음** (LCP 최적화). 시스템 + Noto Sans KR 만으로 충분한 가독성 확보.
- 한·중·일·태·베·말·힌 모든 9개 locale 에서 시스템 폰트가 자연스럽게 폴백.

### 3.2 텍스트 스케일

| 용도 | 클래스 | 비고 |
|---|---|---|
| 히어로 H1 | `text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight` | 줄간 1.05 |
| 섹션 H2 | `text-3xl md:text-4xl font-bold tracking-tight` | |
| Feature 제목 | `text-2xl md:text-3xl font-bold` | |
| 본문 large | `text-base md:text-lg leading-relaxed` | |
| 본문 | `text-sm md:text-base` | 1.55 line-height |
| 캡션 | `text-xs text-atm-muted` | |
| 라벨/태그 | `text-[10px] uppercase tracking-wider` | DM Mono 대체 |
| 영문 디스플레이 | `font-bold tracking-tight uppercase` | Bebas Neue 대체 |

### 3.3 한국어 줄바꿈

`word-break: keep-all` 권장 (Tailwind 기본 없음, 필요 시 `style={{ wordBreak: 'keep-all' }}` 인라인).

---

## 4. 간격 · 라운드 · 그림자

### 4.1 간격 (Tailwind spacing 사용)

- 섹션 padding (모바일): `px-6 py-12`
- 섹션 padding (md+): `md:px-12 md:py-20`
- 카드 padding: `p-5` ~ `p-8`
- 컴포넌트 gap: `gap-3` (내부), `gap-6` (카드 그리드), `gap-12` (섹션 내 그룹)

### 4.2 라운드

| 용도 | 클래스 | 값 |
|---|---|---|
| 카드 | `rounded-2xl` | 16px |
| 큰 카드/패널 | `rounded-3xl` | 24px |
| 폰 목업 | `rounded-[2.5rem]` | 40px |
| 폰 스크린 | `rounded-[2rem]` | 32px |
| 버튼 | `rounded-xl` | 12px |
| 핀/뱃지 | `rounded-full` | — |
| 채팅 버블 (사용자) | `rounded-2xl rounded-br-md` | 비대칭 |
| 채팅 버블 (AI) | `rounded-2xl rounded-bl-md` | 비대칭 |

### 4.3 그림자

- 카드 기본: `shadow-sm`
- 호버 강조: `hover:shadow-lg`
- 폰 목업: `shadow-[0_30px_60px_rgba(46,42,36,0.25)]` (큰 드롭, 베이스 톤)

### 4.4 안전 영역 (iOS notch + Android nav bar)

```jsx
<header className="pt-[env(safe-area-inset-top)]">
<nav className="pb-[env(safe-area-inset-bottom)]">
```

`tailwind.config.js` 의 `spacing: { 'safe-top', 'safe-bottom', 'safe-left', 'safe-right' }` 토큰 활용 가능.

---

## 5. 컴포넌트 패턴

### 5.1 CTA 버튼 (주)

```tsx
<Link
  to="/signup"
  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-atm-accent text-white font-bold shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
>
  무료로 시작하기 <span aria-hidden>→</span>
</Link>
```

### 5.2 CTA 버튼 (보조)

```tsx
<Link
  to="/login"
  className="inline-flex items-center px-6 py-3 rounded-xl border border-stone-200 bg-white text-atm-ink font-bold hover:bg-stone-50 transition-colors"
>
  로그인
</Link>
```

### 5.3 카드 (라이트 섹션)

```tsx
<div className="bg-atm-card border border-stone-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
  ...
</div>
```

### 5.4 카드 (다크 섹션)

```tsx
<div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/8 transition-colors">
  ...
</div>
```

### 5.5 AI 채팅 버블

```tsx
{/* 사용자 (오른쪽 정렬, 다크 배경) */}
<div className="flex justify-end">
  <div className="bg-atm-accent text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-medium max-w-[85%]">
    스벅 강남역 6500원
  </div>
</div>

{/* AI (왼쪽 정렬, 라이트 배경) */}
<div className="flex justify-start">
  <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-atm-ink max-w-[85%]">
    기록 완료! ✓
    <div className="flex gap-1 mt-1.5">
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-atm-accent/15 text-atm-accent">카페·간식</span>
    </div>
  </div>
</div>
```

### 5.6 카테고리 태그

```tsx
<span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-atm-accent/15 text-atm-accent">
  카페·간식
</span>
```

### 5.7 섹션 라벨 (DM Mono 대체)

```tsx
<span className="inline-block px-2.5 py-1 rounded-md bg-atm-accent/10 text-atm-accent text-[10px] font-mono tracking-wider uppercase">
  💬 채팅 입력
</span>
```

### 5.8 어필 포인트 (체크리스트)

```tsx
<ul className="space-y-2.5 mt-4">
  <li className="flex items-start gap-2.5 text-sm">
    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-atm-accent text-white text-xs font-bold flex items-center justify-center mt-0.5">✓</span>
    <span><strong className="font-bold">입력 시간 1초.</strong> 기존 가계부의 1/30 수준</span>
  </li>
</ul>
```

### 5.9 폰 목업

```tsx
<div className="relative max-w-[280px] mx-auto p-3 pb-3.5 bg-gradient-to-br from-stone-800 to-stone-900 rounded-[2.5rem] shadow-[0_30px_60px_rgba(46,42,36,0.25)]">
  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-black rounded-full z-10" aria-hidden />
  <div className="rounded-[2rem] overflow-hidden bg-atm-bg aspect-[9/19]">
    {/* 스크린 내용 */}
  </div>
</div>
```

---

## 6. 인터랙션

### 6.1 트랜지션 기본

`transition-all duration-200` — 색·그림자·이동 모두 부드럽게.

### 6.2 호버 (데스크탑)

```tsx
className="hover:shadow-lg hover:-translate-y-0.5 transition-all"
```

### 6.3 액티브 (모바일 탭 피드백)

```tsx
className="active:scale-[0.98] transition-transform"
```

### 6.4 펄스 (Live 뱃지)

```tsx
<span className="relative flex h-2 w-2">
  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-atm-accent opacity-75" />
  <span className="relative inline-flex rounded-full h-2 w-2 bg-atm-accent" />
</span>
```

---

## 7. 그리드 & 반응형

### 7.1 브레이크포인트

Tailwind 기본:
- `sm` 640px / `md` 768px / `lg` 1024px / `xl` 1280px

### 7.2 패턴

**Mobile-first** — 모바일은 `flex-col` + full-width, 데스크탑부터 좌우 분할:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
  <div>{/* 텍스트 */}</div>
  <div>{/* 비주얼 */}</div>
</div>
```

**Feature reverse 패턴** (홀짝 교차):

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
  <div className="order-1 md:order-2">{/* 텍스트 */}</div>
  <div className="order-2 md:order-1">{/* 비주얼 */}</div>
</div>
```

### 7.3 최대 폭

페이지 컨테이너: `max-w-6xl mx-auto` (1152px). Hero 는 `max-w-5xl` (1024px).

---

## 8. 아이콘

- 라이브러리: **`lucide-react`** 통일 (외부 아이콘 import 금지)
- 크기 스케일:
  - 캡션·뱃지: `size={12}` ~ `size={14}`
  - 본문·버튼: `size={16}` ~ `size={18}`
  - 카드 헤더: `size={20}` ~ `size={24}`
  - 히어로/엠프티 스테이트: `size={32}` ~ `size={48}`

---

## 9. 모션 & 애니메이션

- 기본은 정적. 모션은 사용자 의도 (호버, 탭, 페이지 전환) 가 있을 때만.
- `prefers-reduced-motion: reduce` 환경에서 모션 비활성화 권장.

### 9.1 필요 시 추가할 keyframes (`tailwind.config.js`)

```js
extend: {
  animation: {
    'pulse-slow': 'pulse 2s ease-in-out infinite',
    'fade-up': 'fadeUp 0.5s ease-out',
  },
  keyframes: {
    fadeUp: {
      '0%': { opacity: '0', transform: 'translateY(20px)' },
      '100%': { opacity: '1', transform: 'translateY(0)' },
    },
  },
}
```

---

## 10. Mock UI 가이드라인 (Landing/마케팅 페이지용)

랜딩 페이지 Feature 섹션에서 실제 앱 화면을 React로 재현. `frontend/src/components/landing/` 디렉토리에 위치.

### 10.1 공통 외관

- `PhoneMockup` 컴포넌트로 외곽 통일 (위 §5.9 참고)
- 스크린 비율 9:19 (요즘 폰)
- 내용은 `bg-atm-bg` 위에 카드/채팅/리스트 형태로 stacked

### 10.2 데이터 원칙

- **정적 한국어 라벨**. 다국어는 props 또는 i18n 으로 후속 확장.
- 통화는 ₩ 기본 (locale 분기 시 $, ¥, đ 등 swap)
- 날짜는 "5월 21일" 자연어 또는 "2026-05-21" ISO 둘 다 사용 가능

---

## 11. 접근성 (WCAG AA)

### 11.1 명도 대비

- `atm-ink` (#2E2A24) on `atm-bg` (#FBF8F3): **9.84:1** ✓ AAA
- `atm-muted` (#7A7567) on `atm-bg`: **4.59:1** ✓ AA
- `white` on `atm-accent` (#E07856): **3.07:1** — 큰 텍스트만 AA / 본문은 회피, 굵게 + 큰 사이즈일 때만 사용

### 11.2 터치 타깃

`tailwind.config.js` 의 `min-w-touch min-h-touch` (44px) 활용. 모바일 인터랙티브 요소 필수.

### 11.3 ARIA

- 아이콘만 있는 버튼: `aria-label` 필수
- 데코 아이콘: `aria-hidden="true"`
- `<nav>` 에 `aria-label`, `<button>` 에 적절한 `type`, `<form>` 라벨 명시

### 11.4 키보드

- `<button>` `<a>` 만 사용, `<div onClick>` 금지
- `:focus-visible` 스타일 보존 (Tailwind 기본 OK)
- 메뉴 drawer: ESC 닫기 + focus trap

---

## 12. 다국어 (i18n)

- 9개 locale: **ko / en / ja / zh / es / th / vi / ms / hi**
- 인프라: `react-i18next` + `frontend/src/locales/{locale}/common.json`
- 키 네이밍: `{page}.{section}.{element}` (예: `landing.hero.ctaPrimary`)
- 새 키 추가 시 **9개 locale 모두 동시 번역** (영어 fallback 의존 X)
- 한국 특유 표현은 각 locale 의 동급 관용구로 의역 (직역 X)
- 통화 / 날짜 / 숫자는 locale 별 자연스러운 형식으로 swap

---

## 13. 컴포넌트 카탈로그 (재사용 가능)

| 컴포넌트 | 위치 | 용도 |
|---|---|---|
| `AppHeader` | `components/AppHeader.tsx` | 모든 페이지 헤더 (모바일 sticky / 데스크탑 floating) |
| `AnnouncementBar` | `components/AnnouncementBar.tsx` | 글로벌 공지 배너 (info/warning/critical) |
| `BottomTabBar` | `components/BottomTabBar.tsx` | 모바일 하단 탭 (인증 사용자만) |
| `LanguageSwitcher` | `components/LanguageSwitcher.tsx` | locale 선택 (MyPage Region 섹션) |
| `PhoneMockup` | `components/landing/PhoneMockup.tsx` | 랜딩 폰 목업 외곽 |
| `Mock*Panel` | `components/landing/Mock*Panel.tsx` | 랜딩 Feature 시각화 (Chat/Calendar/Place 등 7종) |
| `Faq` | `components/Faq.tsx` | FAQ 아코디언 |

---

## 14. 페이지 구조 패턴

### 14.1 일반 페이지 (Ledger, MyPage, Admin 등)

```tsx
<div className="min-h-screen bg-atm-bg">
  <AnnouncementBar />
  <AppHeader />
  <main className="max-w-6xl mx-auto px-6 py-12 pt-20">
    {/* 페이지 콘텐츠 */}
  </main>
  <BottomTabBar /> {/* 인증 사용자 only, 모바일 only */}
</div>
```

### 14.2 랜딩 페이지 (`/`)

수직 스크롤 멀티 섹션. AppHeader 가 첫 화면 위에 floating.

```tsx
<div className="min-h-screen bg-atm-bg">
  <AnnouncementBar />
  <AppHeader />
  <HeroSection />        {/* bg-atm-ink 다크 */}
  <ProblemSection />     {/* bg-atm-bg 라이트 */}
  <Feature1Section />    {/* bg-atm-bg */}
  <Feature2Section />    {/* bg-stone-50 reverse */}
  {/* ... */}
  <CompareSection />
  <TargetSection />      {/* bg-atm-ink 다크 */}
  <CTA2Section />        {/* bg-atm-ink 그라데이션 */}
  <Footer />
</div>
```

---

## 15. 변경 이력

- **2026-05-21**: 본 문서 신규 작성. Landing 원페이저 리뉴얼과 함께 디자인 시스템 공식 문서화.
