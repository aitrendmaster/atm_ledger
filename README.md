# ATM 가계부

> 대화하듯 기록하고, 한 달을 회고하는 가계부.

## 빠른 시작

### 1) 백엔드
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# .env 에서 ANTHROPIC_API_KEY, JWT_SECRET 채우기
python -m uvicorn app.main:app --reload --port 8000
```
→ http://localhost:8000/docs

### 2) 프론트
```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```
→ http://localhost:5173

## 핵심 문서
- [CLAUDE.md](CLAUDE.md) — 프로젝트 가이드라인 (모든 작업 전 필독)
- [infra/docs/DEPLOYMENT.md](infra/docs/DEPLOYMENT.md) — Railway + Vercel 배포
- [infra/docs/AGENT_TEAM.md](infra/docs/AGENT_TEAM.md) — 에이전트 팀 역할 & R&R (QA 포함)
- [infra/docs/ROADMAP.md](infra/docs/ROADMAP.md) — v0.5 → v1 → v2

## 현재 상태 — v0.5 스캐폴딩 완료

- ✅ FastAPI 백엔드 (인증, CRUD, AI 프록시, 사진 업로드)
- ✅ Vite + React + TS 프론트 (인증 페이지, 원본 Ledger UI 이전)
- ✅ 약관·개인정보 처리방침 초안
- ⏳ Ledger 페이지의 in-memory state → DB 연동 (v1 작업)
- ⏳ Vercel + Railway 첫 배포 (v1 작업)

## 기술 스택
FastAPI · SQLAlchemy 2.0 · Postgres · React 18 · Vite · TanStack Query · Tailwind · Claude Haiku 4.5
