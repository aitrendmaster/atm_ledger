# 다음 단계 — 사용자가 직접 할 작업

> v0.5 스캐폴딩 + 로컬 검증 완료. 이 문서의 3 단계만 사용자가 직접 진행하면 됩니다.

---

## ✅ 자동으로 완료된 것

| 항목 | 상태 |
|------|------|
| 64 파일 스캐폴딩 (backend + frontend + infra) | ✅ |
| `backend/.env` 작성 (Anthropic 키 + JWT 시크릿) | ✅ |
| `frontend/.env` 작성 (VITE_API_BASE_URL) | ✅ |
| pip install (백엔드 의존성 모두 설치, bcrypt 4.2 핀) | ✅ |
| npm install (프론트엔드 의존성) | ✅ |
| Backend 부팅 검증: `/health` 200 OK, signup/login/me/CRUD 모두 작동 | ✅ |
| Frontend 부팅 검증: Vite dev server :5173 200 OK | ✅ |
| Git 저장소 초기화 + 첫 커밋 (64 files, 7477 insertions) | ✅ |
| R1 Architect로 v1 state migration plan 작성 | ✅ ([infra/docs/plans/v1-state-migration.md](infra/docs/plans/v1-state-migration.md)) |

---

## 🟡 사용자가 직접 할 3 단계

### 1. GitHub Push (인증 필요)

저장소 origin은 이미 설정되어 있고 첫 커밋도 완료. 자동 push는 Git Credential Manager가 인증 다이얼로그를 띄워야 하는데 CLI 환경에서 그게 멈춰 있어서 중단했습니다. 다음 중 하나로 진행하세요:

**옵션 A — VSCode Source Control (가장 쉬움)**
1. VSCode에서 `atm-ledger/` 폴더 열기
2. 왼쪽 사이드바 Source Control 아이콘 → "Publish Branch" 또는 "Push" 클릭
3. GitHub OAuth 창이 뜨면 로그인. 이후 VSCode가 토큰 캐싱.

**옵션 B — Personal Access Token (PAT)**
1. https://github.com/settings/tokens → "Generate new token (classic)"
2. Scope: `repo` 체크 → Generate → 토큰 복사 (한 번만 표시됨)
3. 터미널에서:
   ```powershell
   cd "c:\Users\okiro\OneDrive\문서\New solution\atm-ledger"
   git push -u origin main
   # username: aitrendmaster
   # password: <PAT 붙여넣기>
   ```

**옵션 C — GitHub CLI 설치 후 한 줄**
1. https://cli.github.com → 설치
2. `gh auth login` → 브라우저 OAuth
3. `git push -u origin main`

> 첫 push 후엔 Windows Credential Manager에 토큰이 저장되어 이후 push는 자동.

---

### 2. Railway 배포 (백엔드 + Postgres)

상세 절차: [infra/docs/DEPLOYMENT.md](infra/docs/DEPLOYMENT.md) §2

요약:
1. https://railway.app → GitHub 로그인
2. **New Project → Deploy from GitHub repo → `aitrendmaster/atm_ledger`**
3. Settings → Source → **Root Directory: `backend`**
4. **+ New → Database → PostgreSQL** 추가
5. 백엔드 서비스 → Variables 에 추가:
   ```
   ENV=production
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=<openssl rand -hex 32 결과를 새로 발급해 사용 — 로컬 .env 의 시크릿 재사용 금지>
   ANTHROPIC_API_KEY=sk-ant-api03-TvYy...A6Ww-Rw393AAA   (현재 .env 에 있는 값 그대로)
   CORS_ORIGINS=https://<Vercel 도메인 추후 추가>
   FRONTEND_BASE_URL=https://<Vercel 도메인>
   STORAGE_BACKEND=local
   ```
6. Settings → Networking → **Generate Domain** → `https://<service>.up.railway.app` 메모

> **Postgres 어댑터 자동 처리**: Railway가 주는 `postgresql://` URL은 `config.py` 의 `_normalize_db_url` validator 가 `postgresql+asyncpg://` 로 자동 변환합니다 (검증 완료, 별도 패치 불필요).

---

### 3. Vercel 배포 (프론트엔드)

상세 절차: [infra/docs/DEPLOYMENT.md](infra/docs/DEPLOYMENT.md) §3

요약:
1. https://vercel.com → GitHub 로그인
2. **Add New → Project → `aitrendmaster/atm_ledger` import**
3. **Root Directory: `frontend`**
4. Framework Preset: Vite (자동 감지)
5. Environment Variables:
   ```
   VITE_API_BASE_URL=https://<Railway 백엔드 도메인>
   ```
6. Deploy. 첫 도메인: `https://atm-ledger-aitrendmaster.vercel.app` 정도로 발급됨.
7. **Railway 환경변수의 `CORS_ORIGINS` / `FRONTEND_BASE_URL`** 에 이 Vercel 도메인을 추가하고 Railway 재배포.

---

## 🔑 사용된 API 키 출처 (사용자 요청)

| 키 | 출처 파일 | 값 일부 | 비고 |
|------|----------|---------|------|
| `ANTHROPIC_API_KEY` | `c:\Users\okiro\OneDrive\문서\New solution\backend\.env` (Adora AI 프로젝트의 `.env` 라인 2) | `sk-ant-api03-TvYy…A6Ww-Rw393AAA` | Adora AI와 동일 키 사용. 프로덕션 출시 후엔 별도 키 발급해 분리 권장 (사용량·과금·롤링 정책 분리). |
| `JWT_SECRET` | 신규 생성 (`python -c "import secrets; print(secrets.token_hex(32))"`) | `3125c50933c62…68a0` | 로컬용. **프로덕션(Railway)에는 반드시 새로 발급한 별도 시크릿 사용.** |
| `OPENAI_API_KEY` | 미사용 | — | Moa AI 가계부는 Claude만 사용 (이미지 픽스가 없음). |
| `GOOGLE_*`, `KAKAO_*` | 비워둠 | — | v1.5에서 소셜 로그인 추가 시 발급. |
| `R2_*` | 비워둠 | — | v1+ 사진 영구 저장 시 발급. v1 출시까지는 `STORAGE_BACKEND=local` 로 충분. |

---

## 🧪 로컬 검증 결과 (이미 통과)

```
POST /auth/signup     {"email":"smoke@example.com",...}  → 201, JWT pair 발급
POST /auth/login      {"email":"smoke@example.com",...}  → 200, JWT pair
GET  /auth/me         Authorization: Bearer ...           → 200, {id:1, email:"smoke@example.com", display_name:"Smoke", monthly_income:0, monthly_budget:0}
POST /entries         (ASCII)                             → 200, id:1
POST /entries         (Korean, UTF-8)                      → 200, id:2
GET  /entries         → 200, [2개 항목 반환, user_id로 격리됨]
GET  /health          → 200, {"status":"ok","env":"development"}
GET  http://localhost:5173/ (Vite)                         → 200
```

---

## 🚀 v1 본격 작업 시작 (push + 배포 완료 후)

[infra/docs/plans/v1-state-migration.md](infra/docs/plans/v1-state-migration.md) 가 R1 Architect 가 작성한 6 phase 상세 plan.

**다음 호출 권장**: R3 Frontend Engineer 에이전트에게 P1 (Adapter + Read-only queries) 위임. 약 4시간 작업.

예시 명령:
```
Agent({
  description: "v1 P1 — Ledger.jsx 상태를 React Query로 교체",
  prompt: "atm-ledger/infra/docs/plans/v1-state-migration.md 의 Phase 1 만 수행. ledgerMappers.ts + useLedgerData.ts 신규 생성, Ledger.jsx 의 L05~L07 useState 만 useQuery 로 교체. SEED_* 상수와 mutation 은 건드리지 말 것. P1 Acceptance Criteria 6개 모두 통과해야 완료."
})
```

P1 끝나면 → R4 QA & Reviewer → R5 Test & Eval → P2 …
