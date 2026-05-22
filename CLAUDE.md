# Moa AI 가계부 — 프로젝트 가이드라인 (CLAUDE.md)

> 이 파일은 모든 Claude Code 세션(로컬 CLI · 클라우드 web 둘 다)이 **반드시 먼저 읽어야 하는** 기준 문서다.
> 코딩 패턴, 아키텍처, 운영 상태, 인프라, 미결 작업을 한 파일에 응축.
> 최신 업데이트: **2026-05-21** (commit `a069237`)

---

## 0. 30초 요약 (클라우드 세션 시작 시 먼저 읽기)

| 항목 | 현재 값 |
|------|--------|
| **서비스** | Moa AI 가계부 — 대화하듯 입력하고 한 달을 회고하는 가계부 SaaS |
| **운영자** | ㈜에이티엠스토어 (ATM Store Co., Ltd.) · 대표 오유진 |
| **사업자등록번호** | 396-21-02113 · 통신판매업 2025-부천소사-0174 |
| **라이브 URL** | https://moa.atm.ai.kr (프론트) · `atm-ledger.onrender.com` (백엔드) |
| **저장소** | github.com/aitrendmaster/atm_ledger · main 브랜치 (PR 흐름 없음, 직접 push) |
| **최신 배포** | Vercel `dpl_5ar9zZ2g...` (READY) / Render `atm_ledger` (READY) |
| **베타 상태** | 무료 베타 (기능 전체 무제한). 정식 출시 시 옵션 B 가격 적용 |
| **다국어** | 9개 locale (ko / en / ja / zh / es / th / vi / ms / hi) — `fallbackLng: ['en', 'ko']` |
| **AI** | Anthropic Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — 분류 + 영수증 OCR + 회고 코칭 |
| **결제** | 국내: Toss Payments / 해외: Paddle (추후 활성화) |

**핵심 가치**: "채팅 + 캘린더 + 회고" 한 화면. 카테고리 버튼 X, AI가 자연어 한 줄을 분류.

---

## 1. 기술 스택

### Backend (`backend/`)
| 항목 | 버전 / 값 |
|------|---------|
| Python | 3.11+ |
| 프레임워크 | FastAPI 0.115 |
| ORM | SQLAlchemy 2.0 (async) |
| 마이그레이션 | Alembic |
| DB | 로컬: SQLite (aiosqlite) / **프로덕션: PostgreSQL 16 (Render `atm-ledger-db`)** |
| 인증 | JWT (python-jose) + bcrypt (passlib) + Google OAuth |
| AI | Anthropic Claude Haiku 4.5 (parse · insight) |
| 사진 저장 | LocalStorage (dev) / **Cloudflare R2 (prod, 활성화 예정)** |
| 이메일 발송 | **Resend** (`resend-py` SDK) — 비밀번호 재설정 |
| 외부 API | **Anthropic, Google Geocoding, OpenStreetMap Nominatim (폴백)** |
| 설정 관리 | pydantic-settings + `.env` |
| 로깅 | loguru |

### Frontend (`frontend/`)
| 항목 | 버전 / 값 |
|------|---------|
| 빌드 | Vite 5 |
| 언어 | TypeScript 5 (점진 전환 — `LedgerChat.jsx`만 .jsx 유지) |
| 프레임워크 | React 18 |
| 라우팅 | react-router-dom 6 |
| 데이터 페칭 | TanStack Query 5 + axios |
| 스타일 | Tailwind CSS 3 (디자인 토큰: `atm-bg` / `atm-card` / `atm-ink` / `atm-muted` / `atm-accent`) |
| 아이콘 | lucide-react |
| 알림 | react-hot-toast |
| 지도 | **`@googlemaps/js-api-loader` (Maps JS + Places New + Advanced Markers)** |
| Google 로그인 | `@react-oauth/google` |
| 다국어 | i18next + react-i18next, 9개 locale JSON |

### 배포
- **백엔드 + DB**: **Render** (Hobby 플랜) — 정적 outbound IP 없음
- **프론트**: **Vercel** (atm-ledger-ntrv 프로젝트, team_0qfhQGO0vA3MT6CnPqS9zhdl)
- **사진 (선택)**: Cloudflare R2
- **DNS**: Cloudflare → `moa.atm.ai.kr` (프론트) / `atm-ledger.onrender.com` (백엔드)

### Google Cloud 자원
- 프로젝트: `gen-lang-client-0909708324`
- 활성 API: Maps JavaScript, Places API (New), Geocoding
- 키 2개 분리:
  - `moa-browser-key`: HTTP referer 제한 + Maps JS + Places New
  - `moa-server-key`: Geocoding만 (IP 제한은 Render Hobby라 불가, API 제한으로 방어)
- OAuth 2.0 클라이언트: `Moa AI 가계부` (845731980768-f5hk...)

---

## 2. 디렉토리 구조

```
atm-ledger/
├── CLAUDE.md                       ← 이 파일
├── README.md
├── docs/
│   └── DESIGN_SYSTEM.md            ← Moa 디자인 시스템 (브랜드/색/타이포/컴포넌트)
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── Procfile / render.yaml
│   ├── alembic.ini, alembic/versions/
│   ├── uploads/                    ← 로컬 스토리지 사진 (gitignored)
│   └── app/
│       ├── main.py                 ← FastAPI 앱 + CORS + 라우터 등록
│       ├── config.py               ← Settings + get_settings() (singleton)
│       ├── database.py             ← async engine + Base
│       ├── security.py             ← JWT + bcrypt
│       ├── deps.py                 ← get_current_user
│       ├── models/                 ← SQLAlchemy 2.0
│       │   ├── user.py
│       │   ├── entry.py            ← 실제 지출/수입 기록
│       │   ├── planned.py          ← 예정 지출 + 반복 규칙
│       │   ├── reflection.py
│       │   └── password_reset_token.py
│       ├── schemas/                ← Pydantic v2
│       ├── routers/                ← auth, oauth, entries, planned, reflections,
│       │                              ai, geocode, photos, admin, health
│       ├── services/
│       │   ├── ai_service.py       ← Claude API 래퍼 (9개 locale 프롬프트 분기)
│       │   ├── email_service.py    ← Resend SDK 래퍼 (비번 재설정)
│       │   └── storage.py          ← Local | R2 스토리지
│       └── constants/
│           └── countries.py        ← 30개국 ↔ 통화 ↔ locale 매핑
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── vercel.json
    ├── tsconfig.json, tailwind.config.js, postcss.config.js
    ├── .env.example
    └── src/
        ├── main.tsx                ← GoogleOAuthProvider 마운트
        ├── App.tsx                 ← 라우팅 + Protected + BottomTabBar
        ├── index.css               ← Tailwind + safe-area 유틸리티
        ├── i18n.ts                 ← i18next 초기화, fallbackLng: ['en', 'ko']
        ├── config/
        │   └── company.ts          ← 운영자 정보 단일 진실 (㈜에이티엠스토어)
        ├── services/
        │   ├── api.ts              ← axios + 모든 API 함수 + 타입 + SUPPORT_EMAIL
        │   └── ledgerMappers.ts    ← 백엔드 ↔ UI 매핑 헬퍼
        ├── hooks/
        │   ├── useAuth.tsx         ← signin · signup · signinWithGoogle · me
        │   └── useLedgerData.ts    ← useEntries · usePlanned · useReflections + mutations
        ├── constants/
        │   └── countries.ts        ← 백엔드 동일 30개국 매핑
        ├── utils/
        │   └── currency.ts         ← formatCurrency · currencySymbol (Intl 기반)
        ├── pages/
        │   ├── Landing.tsx         ← 7-feature 원페이저
        │   ├── Login.tsx / Signup.tsx / ForgotPassword.tsx / ResetPassword.tsx
        │   ├── Pricing.tsx / Refund.tsx / Terms.tsx / Privacy.tsx / Faq.tsx
        │   ├── Ledger.tsx          ← 래퍼 (로그아웃 버튼, 모바일 헤더)
        │   ├── LedgerChat.jsx      ← 메인 가계부 (채팅 + 5탭: 캘린더/장소/회고/계획/대차표)
        │   ├── RecurringExpenses.tsx ← 반복지출 관리 (/recurring)
        │   ├── MyPage.tsx          ← 마이페이지 (region/locale/결제)
        │   └── Admin.tsx           ← 관리자 (P0 디버그)
        ├── components/
        │   ├── AppHeader.tsx       ← 모바일 sticky bar + 데스크탑 inline
        │   ├── BottomTabBar.tsx    ← 모바일 4탭 (홈/캘린더/반복/MY)
        │   ├── AnnouncementBar.tsx
        │   ├── Faq.tsx
        │   ├── GoogleMap.tsx       ← Google Maps JS API 래퍼
        │   ├── GoogleSignInButton.tsx ← @react-oauth/google
        │   ├── LanguageSwitcher.tsx
        │   └── landing/            ← Landing 페이지 Mock UI 컴포넌트 8개
        │       ├── PhoneMockup.tsx
        │       ├── MockChatPanel.tsx
        │       ├── MockCalendarPanel.tsx
        │       ├── MockDayDetailPanel.tsx
        │       ├── MockPlacePanel.tsx
        │       ├── MockInsightPanel.tsx
        │       ├── MockBalancePanel.tsx
        │       └── MockRecurringPanel.tsx
        ├── data/
        │   └── faq.ts              ← FAQ 항목 (한국어 하드코딩)
        └── locales/
            └── {ko,en,ja,zh,es,th,vi,ms,hi}/common.json
```

---

## 3. 환경 변수

### Backend `.env` (Render `atm_ledger` 서비스)
| 변수 | 용도 | 상태 |
|------|------|------|
| `DATABASE_URL` | Postgres async URL (Render `atm-ledger-db`) | ✅ |
| `JWT_SECRET` | `openssl rand -hex 32` | ✅ |
| `ANTHROPIC_API_KEY` | Claude Haiku 호출 | ✅ |
| `CORS_ORIGINS` | `https://moa.atm.ai.kr,https://atm-ledger-ntrv.vercel.app` | ✅ |
| `STORAGE_BACKEND` | `local` 또는 `r2` | local (R2 활성화 예정) |
| `R2_*` | Cloudflare R2 (account_id, access_key, secret, bucket) | 미설정 |
| `GOOGLE_CLIENT_ID` | OAuth 클라이언트 ID | ✅ |
| `GOOGLE_CLIENT_SECRET` | OAuth 클라이언트 시크릿 | ✅ |
| `RESEND_API_KEY` | 비번 재설정 메일 발송 | ✅ |
| `RESEND_FROM` | 발신 주소 (검증된 도메인) | ✅ |
| `GOOGLE_MAPS_SERVER_KEY` | Geocoding API 호출 | ✅ |
| `FRONTEND_BASE_URL` | 비번 재설정 링크용 (`https://moa.atm.ai.kr`) | ✅ |

### Frontend `.env` (Vercel `atm-ledger-ntrv` 프로젝트)
| 변수 | 용도 | 상태 |
|------|------|------|
| `VITE_API_BASE_URL` | 백엔드 베이스 URL | ✅ |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID | ✅ (한 번 누락된 적 있음, 재발 주의) |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps JS API 키 (`moa-browser-key`) | ✅ |

**⚠️ Vercel 환경변수 누락 사고**: `VITE_*` 변수는 빌드 시점에 번들에 인라인됨. 누락되면 `if (!key) return null` 패턴 컴포넌트가 silent fail. 변경 후 반드시 **Redeploy + Use existing Build Cache 해제**.

설정 로드 방법 (백엔드):
```python
from app.config import get_settings
settings = get_settings()  # @lru_cache — 앱 내 싱글톤
```

---

## 4. 핵심 코딩 패턴 (반드시 준수)

### 4-1. 외부 API 호출 — `try/except` + 폴백 필수
```python
try:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    resp = client.messages.create(...)
    return parse(resp)
except Exception as e:
    logger.warning(f"Claude API 실패: {e}")
    return _fallback()  # 항상 폴백 제공
```
AI 실패는 사용자에게 500이 아니라 폴백 응답으로 노출.

### 4-2. 인증이 필요한 라우터는 모두 `Depends(get_current_user)`
공개 엔드포인트는 `/health`, `/auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/password-reset/*`, `/oauth/google` 뿐.

### 4-3. 사용자 격리
모든 데이터 모델에 `user_id` FK 필수. 모든 쿼리에 `WHERE user_id = current_user.id` 추가. 다른 사용자 데이터 노출은 **P0 사고**.

### 4-4. 프론트 폴링 (필요 시)
```typescript
const q = useQuery({
  queryKey: ['job', jobId],
  queryFn: () => fetchJob(jobId),
  staleTime: 0,                   // 필수
  refetchInterval: (data) =>
    data?.status === 'processing' ? 2500 : false,
})
```

### 4-5. 프론트에서 외부 API 직접 호출 금지
Claude, Geocoding, Nominatim 등 외부 서비스는 **반드시** 백엔드 프록시 (`/ai/*`, `/geocode`) 경유. 브라우저에 API 키 노출은 **P0 사고**. (예외: `VITE_GOOGLE_MAPS_API_KEY` 는 브라우저용 분리 키 + referer 제한)

### 4-6. 비밀번호 해싱
회원가입은 `bcrypt`(passlib). 평문 저장 금지. 비밀번호 비교는 `verify_password()`.

### 4-7. 회사 정보 = 단일 진실 (config/company.ts)
운영자 이름·번호·주소가 약관·개인정보·푸터·결제 페이지에 반복 등장. 모두 [config/company.ts](frontend/src/config/company.ts)의 `COMPANY` 상수 참조. 값 변경 시 이 파일만 수정.

### 4-8. 다국어 마스터 + 폴백
- `ko` / `en` 만 풀세트 유지 (특히 법무 문서 — Korean original is authoritative)
- 나머지 7개 locale (ja/zh/es/th/vi/ms/hi)은 `fallbackLng: ['en', 'ko']` 로 자동 영어 폴백
- AI 프롬프트도 9개 locale별 시스템 메시지 분기 ([ai_service.py](backend/app/services/ai_service.py)의 `_PARSE_SYSTEM_BY_LOCALE`)

### 4-9. 반복지출 (planned) 은 확정 지출로 취급
사용자는 반복지출(월세·이자·구독료)을 "예정"이 아닌 "확정 지출"로 인식.
- `getMonthData()` 가 entries + 반복 planned 모두 카테고리·총액에 합산
- "예정된 지출" 섹션은 **일회성 planned** (recurrence='none' + 미래 날짜)만 표시
- 참조: [LedgerChat.jsx:133-165](frontend/src/pages/LedgerChat.jsx)

### 4-10. BottomTabBar ↔ LedgerChat 동기화
- 홈 버튼 → `/app` (탭 쿼리 없음) → 페이지 상단(채팅창)으로 스크롤
- 캘린더 버튼 → `/app?tab=calendar` → `activeTab='calendar'` + 탭 영역으로 스크롤
- LedgerChat이 `useSearchParams` 로 동기화

---

## 5. API 엔드포인트

### 공개
```
GET  /health
GET  /health/diag                    환경변수 binary 진단 (값 노출 X)
POST /auth/signup
POST /auth/login
POST /auth/refresh
POST /auth/password-reset/request
POST /auth/password-reset/confirm
POST /oauth/google                   Google ID 토큰 검증 + 가입/로그인 upsert
```

### 인증 필요 (Authorization: Bearer <access_token>)
```
GET    /auth/me
PATCH  /auth/me

GET    /entries?month=YYYY-MM
POST   /entries
PATCH  /entries/{id}
DELETE /entries/{id}
POST   /entries/{id}/photos          (multipart/form-data)
DELETE /entries/{id}/photos/{photo_id}

GET    /planned?month=YYYY-MM        그 달 일회성 + 반복 occurrence 가상 expansion
GET    /planned?include_rules=1      반복 규칙 마스터만 (RecurringExpenses 페이지)
POST   /planned
POST   /planned/batch                일괄 등록 (최대 100건)
PATCH  /planned/{id}
DELETE /planned/{id}

GET    /reflections?month=YYYY-MM
POST   /reflections
DELETE /reflections/{id}

POST   /ai/parse                     text or image → 카테고리 분류 (locale 분기)
POST   /ai/insight-from-stats        월별 통계 → 회고 인사이트

GET    /geocode?q=상호명             Google Geocoding 우선, Nominatim 폴백
```

---

## 6. 카테고리 (고정 10개)
```python
ALLOWED_CATEGORIES = {
    "식비", "카페/간식", "쇼핑", "교통", "주거/공과금",
    "건강/뷰티", "여행/이벤트", "경조사/선물", "금융/대출", "기타",
}
```
AI 응답이 이 외 카테고리를 반환하면 백엔드에서 강제로 `"기타"`로 정규화. `"금융/대출"` 은 반복지출(이자·월세·대출·보험) 인식용.

---

## 7. 가격 정책 (옵션 B 확정 — 2026-05-21)

| 티어 | 가격 | 포함 기능 |
|------|------|----------|
| **Free** | ₩0 | AI 입력 월 30회, 광고 없음, 12개월 보관, 가계부 기본 기능 |
| **Premium** | 월 ₩3,900 / 연 ₩29,000 (25% off) | AI 무제한, AI 회고 코칭, 영수증 OCR 무제한, 데이터 내보내기 |
| **베타 유저 혜택** | 첫 12개월 50% 할인 | 월 ₩1,950 / 연 ₩14,500 (정식 출시 직후 자동 적용) |

- 해외: $2.99/월, $21.99/년 환산
- 환불: 7일 청약철회 (30% 사용 시 제한) + 비율 환불 공식
- 결제: Toss Payments (국내) / Paddle (해외, 추후 활성화)

상세: [Pricing.tsx](frontend/src/pages/Pricing.tsx), [Refund.tsx](frontend/src/pages/Refund.tsx)

---

## 8. 법무 문서 구조

| 문서 | 구조 | 정본 |
|------|------|------|
| 이용약관 | 18조 (제11조 AI 기능 별도 조항) | 한국어 |
| 개인정보처리방침 | 12조 (제5조 위탁/국외이전 표 8개 수탁자) | 한국어 |
| 환불 정책 | 5조 (7일 청약철회 + 비율 환불 공식) | 한국어 |

다른 8개 locale은 영문 요약 + "Korean original is authoritative" 명시. 위탁/국외이전 표에 명시된 수탁자: Anthropic, Resend, Google, Render, Vercel, Toss, Paddle, Cloudflare.

상세: [Terms.tsx](frontend/src/pages/Terms.tsx), [Privacy.tsx](frontend/src/pages/Privacy.tsx)

---

## 9. 에이전트 팀 R&R

상시 (매 스프린트):
| 역할 | 책임 | 편집 영역 |
|------|------|----------|
| R1 Architect | 설계 plan 수립 | docs/plans/ |
| R2 Backend Engineer | FastAPI·DB·AI 프록시 | backend/app/** |
| R3 Frontend Engineer | React·페이지·API 호출 | frontend/src/** |
| R4 **QA & Reviewer** ⭐ | 코드 리뷰, P0/P1/P2 분류 (수정 금지) | — |
| R5 **Test & Eval** ⭐ | pytest/Vitest, AI 골든셋 회귀 평가 | tests/ |
| R6 DevOps & Release | 배포·환경변수·마이그레이션 | infra/ |

트리거 발생 시:
| 역할 | 호출 트리거 | 편집 영역 |
|------|-----------|----------|
| R7 AI Prompt Engineer | 골든셋 < 85%, 비용 급증, 모델 변경 | `ai_service.py` 프롬프트 |
| R8 Designer / UX Writer | 새 UI 추가, 출시 직전 1회 | `frontend/src/**` 문자열, tailwind |
| R9 Security Auditor | 인증·결제·민감정보 변경 | (없음, OWASP 리포트만) |
| R10 Legal Reviewer | 약관·개인정보 변경 | `Terms.tsx`, `Privacy.tsx` 초안 — **인간 변호사 최종 검토 필수** |

**QA·평가(R4·R5) 및 보안(R9)·법무(R10) 역할은 구현자가 아닌 별도 팀원이 수행**. 자체 평가 금지.

---

## 10. 개발 환경

### 로컬 Backend
```powershell
cd atm-ledger\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env       # 그리고 ANTHROPIC_API_KEY, JWT_SECRET 등 채우기
python -m uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

### 로컬 Frontend
```powershell
cd atm-ledger\frontend
npm install
copy .env.example .env
npm run dev
```
앱: http://localhost:5173

### 검증
- `cd frontend && npx tsc -b --noEmit` — TS 새 에러 0 확인
- `cd frontend && npx vite build` — production 빌드
- pytest는 아직 미도입 (백엔드 자동 테스트는 별도 PR 예정)

### 배포 흐름 (현재)
1. 로컬에서 작업 → 의미 단위 분리 커밋
2. `git push origin main` → GitHub
3. Vercel 자동 빌드 (~2-3분) / Render 자동 재시작 (~1분)
4. https://moa.atm.ai.kr 또는 백엔드 도메인에서 확인

**참고**: PR 흐름 없이 main 직접 push 패턴. 1인 운영자라 충돌 위험 낮음. 향후 협업자 늘면 PR 흐름 전환 검토.

---

## 11. 금지 사항 (DO NOT)

- `.env`를 Git 커밋 금지 → `.gitignore` 확인
- API 키·시크릿을 코드에 하드코딩 금지 (`get_settings()` 또는 `import.meta.env` 사용)
- 외부 API를 프론트에서 직접 호출 금지 (반드시 백엔드 프록시)
- 외부 API 호출을 `try/except` 없이 작성 금지
- 인증 미들웨어 없는 라우터에 사용자 데이터 노출 금지
- `WHERE user_id` 누락된 쿼리 금지 (사용자 격리 P0)
- 같은 파일을 두 명 이상의 팀원이 동시 편집 금지
- QA 역할이 코드 직접 수정 금지 (이슈 제기만)
- 프로덕션 환경에서 lifespan `create_all` 사용 금지 (Alembic 마이그레이션 사용)
- 약관·개인정보 처리방침을 법무 검토 없이 출시 금지
- `git push --force` to main 금지
- Vercel `VITE_*` 환경변수 변경 후 Redeploy 누락 금지 (silent fail 발생)
- 회사 정보 (사업자번호·대표·주소) 를 [config/company.ts](frontend/src/config/company.ts) 외 위치에 하드코딩 금지

---

## 12. 현재 운영 상태 & 최근 작업 (2026-05-21 기준)

### 최근 10개 commit (시간 역순)
```
a069237 fix(auth): clean up GoogleSignInButton TS errors
3fb1c89 fix(ledger): count recurring planned as confirmed spend + sync BottomTab routing
8b85a6d chore(company): fill in registered business address
b6b8a7e feat(legal+pricing): ATM Store biz info, tier-B pricing, refreshed Terms/Privacy/Refund
ed56252 fix(faq): point password reset answer to the actual forgot-password flow
0673495 feat(landing): 7-feature onepager + Moa design system docs
afcd508 feat(ledger): budget fix, recurring batch save, Google Maps integration
fad342e feat(mobile-header): sticky top bar + bottom tab + safe-area
09166b2 feat(geocode): Google Geocoding proxy with Nominatim fallback
f3ae7f5 feat(recurring): force end-date + auto-expand until recurrence_until
```

### 완료된 큰 사건들
- **2026-05-19**: P0 데이터 손실 fix (in-memory state → 백엔드 CRUD 영속)
- **2026-05-19**: 9개 locale 다국어 + 30개국 통화 자동 매핑
- **2026-05-20**: Railway → Render 마이그레이션 (Railway 광범위 장애 후)
- **2026-05-21 (오늘)**: 반복지출 종료일 강제 + 모바일 헤더 재설계 + Google Maps 통합 + 7-feature Landing + 법무 문서 + ATM Store 사업자 정보

### 활성 외부 자원
- Anthropic Claude Haiku 4.5 (parse + insight)
- Google Cloud (gen-lang-client-0909708324): Maps JS + Places New + Geocoding + OAuth
- Resend (이메일 발송) — 도메인 검증 완료
- Render Hobby (백엔드 + Postgres)
- Vercel (atm-ledger-ntrv 프로젝트)
- Cloudflare DNS (moa.atm.ai.kr)

---

## 13. 다음 우선순위 (Backlog)

### P0 (런칭 전 필수)
- **문의 게시판 폼** 신규 구현
  - 프론트: 비공개 폼 페이지 (`/support`)
  - 백엔드: `POST /support/inquiry` 엔드포인트
  - 저장: Google Sheets API 연동 (관리자 보기용)
  - 응답: AI 봇 자동 답변 초안 생성 → 관리자가 수동 발송
  - 현재는 master@aitrend.kr 직접 노출 중 (임시)

### P1 (안정성)
- **MyPage TS 에러 정리** (`requestBillingAuth` 타입 이슈, Paddle SDK)
- **Google Cloud 결제 예산 알림** (월 $30 한도) — 5분, 안전망
- **백엔드 pytest 자동 테스트** 도입 (`requirements.txt`에 pytest 추가)
- **Vercel 환경변수 백업** 매뉴얼 (`VITE_GOOGLE_CLIENT_ID` 누락 재발 방지)

### P2 (개선)
- 9개 locale 풀 번역 (현재 Terms/Privacy 는 ko/en 마스터, 나머지 영어 폴백)
- 6개월마다 Google Maps 키 회전 (다음 일정: 2026-11-21)
- Cloudflare R2 사진 저장 활성화 (현재 Render local disk)
- 회사 주소 사업자등록증 기준 영문 정확화 (현재 도로명 영문 translit)

### Render Hobby 제약 (해결 불가, 우회로 대응)
- 정적 outbound IP 없음 → `moa-server-key` IP 제한 불가
- 대체 방어: API 화이트리스트(Geocoding only) + 키 서버측 격리 + Billing 알림

---

## 14. 클라우드 세션 / 외부 작업 시 체크리스트

이 프로젝트를 처음 접하는 Claude Code 세션 (특히 클라우드 web 세션 + GitHub MCP)이 안전하게 작업하려면:

1. **이 CLAUDE.md를 끝까지 읽기** (특히 §0 30초 요약 + §11 금지 사항)
2. **현재 main HEAD 확인**: `git log --oneline -5` 후 §12 의 최근 commit 과 대조
3. **변경 전 작업 범위 명확화** — 동시 편집 충돌 방지
4. **외부 API 키는 절대 새로 발급/노출 금지** — 기존 환경변수 활용
5. **법무 문서 (Terms/Privacy/Refund) 수정 시** 변경 의도를 사용자에게 명시적으로 확인
6. **운영자 정보 변경 시** 반드시 [config/company.ts](frontend/src/config/company.ts) 만 수정 (다른 위치 하드코딩 금지)
7. **PR 흐름 vs main 직접 push**: 클라우드 세션은 PR을 자동 생성하는 게 안전. 로컬 세션은 기존대로 main 직접 push 가능
8. **메모리 (`~/.claude/projects/.../memory/`)** 는 로컬 세션에만 존재. 클라우드 세션은 이 CLAUDE.md 가 유일한 컨텍스트 — 작업 후 변경된 운영 상태는 이 파일 §12 에 반영

---

## 15. 참고 링크

- 라이브 프론트: https://moa.atm.ai.kr
- GitHub: https://github.com/aitrendmaster/atm_ledger
- Vercel: https://vercel.com/aitrendmasters-projects/atm-ledger-ntrv
- Render: https://dashboard.render.com (atm_ledger 서비스)
- Google Cloud: https://console.cloud.google.com (프로젝트 gen-lang-client-0909708324)
- Resend: https://resend.com (도메인 검증 완료)
- 디자인 시스템: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
