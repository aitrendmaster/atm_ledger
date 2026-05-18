# 배포 가이드 — Railway (백엔드 + DB) + Vercel (프론트)

## 0. 사전 준비
| 항목 | 발급처 |
|------|--------|
| Anthropic API Key | https://console.anthropic.com/ |
| Google OAuth (선택) | https://console.cloud.google.com → API & Services → Credentials |
| Cloudflare R2 (선택, 사진 저장) | https://dash.cloudflare.com → R2 |
| 도메인 (선택) | 가비아, Cloudflare Registrar 등 |
| Railway 계정 | https://railway.app (GitHub 로그인) |
| Vercel 계정 | https://vercel.com (GitHub 로그인) |

## 1. GitHub 저장소 생성
```bash
cd atm-ledger
git init
git add .
git commit -m "init: Moa AI 가계부 v0.5 scaffold"
gh repo create atm-ledger --private --source=. --push
```

## 2. Railway — 백엔드 + Postgres
1. Railway → **New Project** → "Deploy from GitHub repo" → `atm-ledger` 선택
2. **Settings → Source** → Root Directory: `backend`
3. Railway가 `railway.json` + `requirements.txt` 자동 감지
4. **+ New → Database → PostgreSQL** 추가
5. 백엔드 서비스의 **Variables**에 다음 추가:
   ```
   ENV=production
   DATABASE_URL=${{Postgres.DATABASE_URL}}    # Railway 변수 참조 문법
   JWT_SECRET=<openssl rand -hex 32 결과>
   ANTHROPIC_API_KEY=sk-ant-...
   CORS_ORIGINS=https://atm-ledger.vercel.app,https://atm-ledger.com
   FRONTEND_BASE_URL=https://atm-ledger.com
   STORAGE_BACKEND=local        # 또는 r2
   ```
   `DATABASE_URL`은 `postgresql://...` 형태로 들어옴 → 코드가 asyncpg 드라이버로 강제하려면 다음 한 줄 추가:
   ```python
   # backend/app/database.py 상단에
   if settings.database_url.startswith("postgresql://"):
       settings.database_url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
   ```
6. **Settings → Networking → Generate Domain** → `https://atm-ledger-api.up.railway.app` 생성
7. 첫 배포 후 마이그레이션:
   ```bash
   # Railway CLI로 1회 실행
   railway run --service backend alembic revision --autogenerate -m "init"
   railway run --service backend alembic upgrade head
   ```
   또는 ENV=development 로 두면 lifespan이 자동 create_all 수행 (프로덕션에선 권장하지 않음)

## 3. Vercel — 프론트
1. Vercel → **Add New Project** → `atm-ledger` import
2. **Root Directory**: `frontend`
3. **Framework Preset**: Vite (자동 감지)
4. **Environment Variables**:
   ```
   VITE_API_BASE_URL=https://atm-ledger-api.up.railway.app
   ```
5. Deploy. 첫 배포 후 도메인: `https://atm-ledger.vercel.app`
6. Railway의 `CORS_ORIGINS`에 이 도메인 추가 확인.

## 4. 커스텀 도메인 (선택)
- 가비아/Cloudflare에서 도메인 구매 (예: `atm-ledger.com`)
- Vercel: Settings → Domains → `atm-ledger.com` 추가, 안내된 A/CNAME 등록
- Railway: Settings → Networking → Custom Domain → `api.atm-ledger.com` 추가
- 양쪽 환경변수 업데이트:
  - Vercel: `VITE_API_BASE_URL=https://api.atm-ledger.com`
  - Railway: `CORS_ORIGINS=https://atm-ledger.com`, `FRONTEND_BASE_URL=https://atm-ledger.com`

## 5. Cloudflare R2 — 사진 저장 (선택, v1+)
1. Cloudflare → R2 → **Create bucket** → `atm-ledger-photos`
2. **Manage R2 API Tokens** → 새 토큰 (Object Read & Write) → Access Key ID / Secret 발급
3. 버킷 **Settings → Public access** → Allow → `https://pub-xxxx.r2.dev` 도메인 메모 (또는 커스텀 도메인 연결)
4. Railway 환경변수:
   ```
   STORAGE_BACKEND=r2
   R2_ACCOUNT_ID=xxxxxxxx
   R2_ACCESS_KEY_ID=xxxxxxxx
   R2_SECRET_ACCESS_KEY=xxxxxxxx
   R2_BUCKET=atm-ledger-photos
   R2_PUBLIC_BASE_URL=https://pub-xxxx.r2.dev
   ```

## 6. 비용 가이드 (월 추정)
| 항목 | 무료 한도 | 초과 시 |
|------|-----------|---------|
| Vercel Hobby | 100GB 대역폭 | 개인 사이드 프로젝트엔 충분 |
| Railway | $5 크레딧/월 (Hobby) | 백엔드+Postgres 합쳐 $5~15/월 예상 |
| Anthropic Claude (Haiku 4.5) | 종량제 | 사용자당 월 $0.1~1 (캡션·인사이트 호출 수에 비례) |
| Cloudflare R2 | 10GB 저장 + 무제한 무료 egress | 초과분 $0.015/GB |
| 도메인 | — | 연 $10~15 |

→ **MVP 단계 월 예상: $5~25** (사용자 수에 따라 변동)

## 7. 출시 전 체크리스트
- [ ] `.env`가 Git에 커밋되지 않았는지 확인 (`git status`)
- [ ] `JWT_SECRET`이 임시값이 아닌지
- [ ] `CORS_ORIGINS`에 프로덕션 도메인만 (와일드카드 X)
- [ ] Alembic 마이그레이션이 production DB에 적용됐는지 (`alembic current`)
- [ ] 약관·개인정보 처리방침 법무 검토
- [ ] 사용자 데이터 백업 자동화 (Railway DB → 일 1회 dump)
- [ ] Sentry 같은 에러 트래킹 연결
- [ ] Rate limit (예: `slowapi` 미들웨어) 적용 — 특히 `/ai/parse`
