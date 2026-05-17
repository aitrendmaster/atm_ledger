# ATM 가계부 — 프로젝트 가이드라인 (CLAUDE.md)

> 이 파일은 모든 Claude Code 세션과 에이전트 팀원이 **반드시 먼저 읽어야 하는** 기준 문서다.

---

## 1. 프로젝트 개요

**ATM 가계부** — 대화하듯 기록하고 한 달을 회고하는 개인 가계부 SaaS.

| 항목 | 내용 |
|------|------|
| 타입 | B2C 공개 SaaS (다중 유저, 회원가입) |
| 사용자 | 일반 소비자 (한국) |
| 핵심 가치 | "채팅 + 캘린더 + 회고" 한 화면 |
| MVP 출처 | `chat-ledger.jsx` (단일 파일 React 프로토타입) |

상위 디렉토리의 **Adora AI** 와는 별개 프로젝트다. 기술 스택은 일부 공유하지만 도메인·고객·배포가 분리되어 있다.

---

## 2. 기술 스택

### Backend (`backend/`)
| 항목 | 버전 |
|------|------|
| Python | 3.11+ |
| 프레임워크 | FastAPI 0.115 |
| ORM | SQLAlchemy 2.0 (async) |
| 마이그레이션 | Alembic |
| DB | 로컬: SQLite (aiosqlite) / 프로덕션: PostgreSQL (asyncpg, Railway) |
| 인증 | JWT (python-jose) + bcrypt (passlib) |
| AI | `claude-haiku-4-5-20251001` (parse + insight) |
| 사진 저장 | LocalStorage (dev) / Cloudflare R2 (prod) |
| 외부 API | Anthropic, OpenStreetMap Nominatim |
| 설정 | pydantic-settings + `.env` |

### Frontend (`frontend/`)
| 항목 | 버전 |
|------|------|
| 빌드 | Vite 5 |
| 언어 | TypeScript 5 (점진 전환 — Ledger.jsx만 .jsx 유지) |
| 프레임워크 | React 18 |
| 라우팅 | react-router-dom 6 |
| 데이터 페칭 | TanStack Query 5 + axios |
| 스타일 | Tailwind CSS 3 |
| 아이콘 | lucide-react |
| 알림 | react-hot-toast |

### 배포
- **백엔드 + DB**: Railway (Postgres 내장)
- **프론트**: Vercel
- **사진**: Cloudflare R2 (선택)

---

## 3. 디렉토리 구조

```
atm-ledger/
├── CLAUDE.md                       ← 이 파일
├── README.md
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── Procfile / railway.json
│   ├── alembic.ini, alembic/
│   ├── uploads/                    ← 로컬 스토리지 사진 (gitignored)
│   └── app/
│       ├── main.py                 ← FastAPI 앱
│       ├── config.py               ← Settings + get_settings()
│       ├── database.py             ← async engine + Base
│       ├── security.py             ← JWT + bcrypt
│       ├── deps.py                 ← get_current_user
│       ├── models/                 ← SQLAlchemy 2.0
│       │   ├── user.py
│       │   ├── entry.py
│       │   ├── planned.py
│       │   └── reflection.py
│       ├── schemas/                ← Pydantic v2
│       ├── routers/                ← auth, entries, planned, reflections, ai, geocode, photos
│       └── services/
│           ├── ai_service.py       ← Claude API 래퍼 (백엔드 전용)
│           └── storage.py          ← Local | R2 스토리지
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── vercel.json
│   ├── tsconfig.json, tailwind.config.js, postcss.config.js
│   ├── .env.example
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                 ← 라우팅 + Protected
│       ├── index.css
│       ├── services/api.ts         ← axios + 모든 API 함수 + 타입
│       ├── hooks/useAuth.tsx
│       └── pages/
│           ├── Landing.tsx
│           ├── Login.tsx, Signup.tsx
│           ├── Terms.tsx, Privacy.tsx
│           ├── Ledger.tsx          ← 래퍼 (로그아웃 버튼)
│           └── Ledger.jsx          ← 원본 chat-ledger 컴포넌트 (AI 호출만 프록시화)
└── infra/
    └── docs/
        ├── DEPLOYMENT.md           ← Railway + Vercel 배포 가이드
        ├── ROADMAP.md              ← v0.5 → v1 → v2 단계
        └── AGENT_TEAM.md           ← 에이전트 팀 R&R (QA·평가 포함)
```

---

## 4. 환경 변수

### Backend `.env`
| 변수 | 용도 |
|------|------|
| `DATABASE_URL` | SQLite (dev) 또는 Postgres (prod) |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | Claude Haiku 호출 |
| `CORS_ORIGINS` | 콤마 구분, 프론트 도메인 |
| `STORAGE_BACKEND` | `local` 또는 `r2` |
| `R2_*` | Cloudflare R2 (선택) |
| `GOOGLE_CLIENT_ID/SECRET` | OAuth (v1+) |

### Frontend `.env`
| 변수 | 용도 |
|------|------|
| `VITE_API_BASE_URL` | 백엔드 베이스 URL |

자세한 값은 `backend/.env.example` / `frontend/.env.example` 참조.

---

## 5. 핵심 코딩 패턴 (반드시 준수)

### 5-1. 외부 API 호출 — `try/except` + 폴백 필수
```python
try:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    resp = client.messages.create(...)
    return parse(resp)
except Exception as e:
    logger.warning(f"Claude API 실패: {e}")
    return _fallback()
```
AI 실패는 사용자에게 500이 아니라 폴백 응답으로 노출.

### 5-2. 인증이 필요한 라우터는 모두 `Depends(get_current_user)`
```python
@router.get("/entries")
async def list_entries(user: User = Depends(get_current_user), ...):
    # user.id 로 본인 데이터만 필터
```
공개 엔드포인트는 `/health`, `/auth/signup`, `/auth/login`, `/auth/refresh` 뿐.

### 5-3. 사용자 격리
모든 데이터 모델에 `user_id` FK 필수. 모든 쿼리에 `WHERE user_id = current_user.id` 추가. 다른 사용자 데이터 노출은 P0 사고.

### 5-4. 프론트 폴링 (필요 시)
```typescript
const q = useQuery({
  queryKey: ['job', jobId],
  queryFn: () => fetchJob(jobId),
  staleTime: 0,                   // 필수
  refetchInterval: (data) =>
    data?.status === 'processing' ? 2500 : false,
})
```

### 5-5. 프론트에서 외부 API 직접 호출 금지
Claude, Nominatim 등 외부 서비스는 **반드시** 백엔드 프록시 (`/ai/*`, `/geocode`) 경유.
브라우저에 API 키가 노출되면 P0 사고.

### 5-6. 비밀번호 해싱
회원가입은 `bcrypt`(passlib). 평문 저장 금지. 비밀번호 비교는 `verify_password()`.

---

## 6. API 엔드포인트

### 공개
```
GET  /health
POST /auth/signup
POST /auth/login
POST /auth/refresh
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

GET    /planned
POST   /planned
PATCH  /planned/{id}
DELETE /planned/{id}

GET    /reflections?month=YYYY-MM
POST   /reflections
DELETE /reflections/{id}

POST   /ai/parse                     (text or image → 카테고리 분류)
POST   /ai/insight-from-stats        (월별 통계 → 인사이트)
GET    /geocode?q=상호명
```

---

## 7. 카테고리 (고정)
```python
ALLOWED_CATEGORIES = {
    "식비", "카페/간식", "쇼핑", "교통", "주거/공과금",
    "건강/뷰티", "여행/이벤트", "경조사/선물", "기타",
}
```
AI 응답이 이 외 카테고리를 반환하면 백엔드에서 강제로 `"기타"`로 정규화.

---

## 8. 에이전트 팀 R&R

상세는 [`infra/docs/AGENT_TEAM.md`](infra/docs/AGENT_TEAM.md) 참조.

### 상시 (매 스프린트)
| 역할 | 책임 | 편집 영역 |
|------|------|----------|
| R1 Architect | 설계 plan 수립 | docs/plans/ |
| R2 Backend Engineer | FastAPI·DB·AI 프록시 | backend/app/** |
| R3 Frontend Engineer | React·페이지·API 호출 | frontend/src/** |
| R4 **QA & Reviewer** ⭐ | 코드 리뷰, 체크리스트, P0/P1/P2 분류 (수정 금지) | — |
| R5 **Test & Eval** ⭐ | pytest/Vitest, AI 골든셋 회귀 평가 | tests/ |
| R6 DevOps & Release | 배포·환경변수·마이그레이션·백업 | infra/ |

### 트리거 발생 시 (특정 시점만)
| 역할 | 호출 트리거 | 편집 영역 |
|------|-----------|----------|
| R7 AI Prompt Engineer | 골든셋 통과율 < 85%, 비용 급증, 모델 변경 | `backend/app/services/ai_service.py` 프롬프트 문자열 |
| R8 Designer / UX Writer | 새 UI 추가, 한국어 문구 일관성 점검, 출시 직전 1회 | `frontend/src/**` 문자열, `tailwind.config.js` |
| R9 Security Auditor | 인증·결제·민감정보 변경, 출시 직전 1회 | (없음, OWASP 리포트만) |
| R10 Legal Reviewer | 약관·개인정보 변경, 결제 도입, 출시 직전 1회 | `Terms.tsx`, `Privacy.tsx` 초안 — **인간 변호사 최종 검토 필수** |

**QA·평가(R4·R5) 및 보안(R9)·법무(R10) 역할은 구현자가 아닌 별도 팀원이 수행**한다. 자체 평가는 편향 방지를 위해 금지.

---

## 9. 개발 서버 실행

### Backend
```powershell
cd atm-ledger\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env       # 그리고 ANTHROPIC_API_KEY, JWT_SECRET 채우기
python -m uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

### Frontend
```powershell
cd atm-ledger\frontend
npm install
copy .env.example .env
npm run dev
```
앱: http://localhost:5173

---

## 10. 금지 사항 (DO NOT)

- `.env`를 Git 커밋 금지
- API 키·시크릿을 코드에 하드코딩 금지
- 외부 API를 프론트에서 직접 호출 금지 (반드시 백엔드 프록시)
- 외부 API 호출을 `try/except` 없이 작성 금지
- 인증 미들웨어 없는 라우터에 사용자 데이터 노출 금지
- `WHERE user_id` 누락된 쿼리 금지 (사용자 격리)
- 같은 파일을 두 명 이상의 팀원이 동시 편집 금지
- QA 역할이 코드 직접 수정 금지 (이슈 제기만)
- 프로덕션 환경에서 lifespan `create_all` 사용 금지 (Alembic 마이그레이션 사용)
- 약관·개인정보 처리방침을 법무 검토 없이 출시 금지

---

## 11. 다음 단계 (v0.5 → v1)

상세 로드맵: [`infra/docs/ROADMAP.md`](infra/docs/ROADMAP.md)

핵심 작업:
1. Ledger.jsx의 in-memory state(`SEED_ENTRIES`, `setEntries` 등)를 React Query + 백엔드 CRUD로 교체
2. 사진 업로드 base64 → backend `POST /entries/{id}/photos`
3. Alembic 정식 마이그레이션 생성
4. Vercel + Railway 첫 배포
5. Google OAuth, Sentry, Rate limit 추가
