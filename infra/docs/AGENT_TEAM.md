# Moa AI 가계부 — 에이전트 팀 구조 & R&R

> 이 문서는 Moa AI 가계부 프로젝트를 개발할 때 Claude Code 에이전트 팀을 어떻게 구성·운영할지 정의합니다.
> 리더(메인 세션)는 작업 전 이 문서를 참고하여 팀을 구성하고, 팀원에게 적절한 역할을 위임합니다.

---

## 0. 팀 운영 원칙

1. **리더 1인 + 팀원 N인**. 리더는 사용자와 직접 소통하는 메인 세션. 팀원은 `Agent` 도구로 스폰된 서브에이전트.
2. **파일 소유권 분리**. 동시에 동일 파일을 편집하는 팀원이 2명 이상이면 충돌 → 영역 분리 후 합류 지점만 리더가 통합.
3. **QA·리뷰는 별도 팀원이 수행**. 구현자가 자기 코드를 자체 평가하지 않는다 (편향 방지).
4. **팀 정리는 리더만**. 팀원이 임의로 팀 해산·재구성 금지.
5. **결과는 항상 코드+근거**. "수정했습니다"가 아니라 `file:line` + diff 요약을 남긴다.

---

## 1. 기본 10 역할 (Core Roles)

### R1. **Architect** (설계자)
- **소속 도구**: `Plan` subagent
- **R&R**:
  - 새 기능에 대한 구현 전략 수립 (단계별 파일·인터페이스·DB 변경)
  - 기존 코드와의 통합 지점 명시
  - 트레이드오프(성능/복잡도/보안) 정리
- **결과물**: `docs/plans/<feature>.md` 또는 conversation 내 plan
- **호출 시점**: 새 기능 시작 전, 또는 리팩토링이 3개 파일 이상 건드릴 때

### R2. **Backend Engineer** (백엔드)
- **소속 도구**: `Agent` (general-purpose)
- **R&R**:
  - FastAPI 라우터, 서비스, SQLAlchemy 모델 작성/수정
  - Alembic 마이그레이션 생성
  - 외부 API 호출 (Claude, Nominatim, R2) 통합
  - **반드시 `try/except` + 폴백 적용** (프로젝트 규칙)
- **편집 영역**: `backend/app/**`
- **금지**: `frontend/` 수정, `.env` 커밋, API 키 하드코딩

### R3. **Frontend Engineer** (프론트엔드)
- **소속 도구**: `Agent` (general-purpose)
- **R&R**:
  - React 페이지·컴포넌트, axios 호출, TanStack Query 훅
  - Tailwind 스타일링, 반응형
  - **`staleTime: 0` + 폴링 패턴 준수** (프로젝트 규칙)
- **편집 영역**: `frontend/src/**`
- **금지**: 백엔드 모델 수정, API 키 직접 호출 (반드시 `/api/*` 경유)

### R4. **QA & Reviewer** (검수자) ⭐
- **소속 도구**: `Agent` (Explore subagent 또는 general-purpose)
- **R&R**:
  - 다른 팀원이 작성한 코드 리뷰 (구현자가 자기 코드를 리뷰하지 않는다)
  - 체크리스트:
    - [ ] `try/except` 누락 없는가? (외부 API 호출)
    - [ ] API 키·시크릿이 코드에 하드코딩 안 되었는가?
    - [ ] CORS·인증 우회 가능한 라우터 없는가? (예: `get_current_user` 누락)
    - [ ] 프론트가 사용자 토큰 없이 호출 가능한 엔드포인트가 있는가?
    - [ ] N+1 쿼리 / 누락된 인덱스
    - [ ] 입력 검증 (Pydantic 패턴, 길이 제한)
    - [ ] 폼 검증 누락 (프론트)
    - [ ] 한국어 UX 문구 자연스러움
    - [ ] CLAUDE.md 규칙 위반 없는가
  - 발견 사항을 **심각도(P0/P1/P2)** 로 분류하여 리포트
- **결과물**: 마크다운 리뷰 리포트 (이슈 목록 + 권고)
- **권한**: 직접 수정 금지. 이슈 제기만. 수정은 원작자에게 다시 위임.

### R5. **Test & Eval** (테스트·평가) ⭐
- **소속 도구**: `Agent` (general-purpose)
- **R&R**:
  - pytest 단위·통합 테스트 작성/실행
  - Vitest 프론트 테스트
  - 핵심 시나리오 수동 검증 시 절차 작성:
    - 회원가입 → 로그인 → 항목 추가 → AI 파싱 → 회고 작성 → 로그아웃
  - AI 출력 품질 평가 (영수증 OCR 정확도, 인사이트 톤·정확성)
    - 골든셋 10~20개 케이스 유지 (`tests/eval/ledger_parse.jsonl`)
    - 회귀 추적: 이전 빌드 대비 통과율 변화
  - 성능 측정 (응답 시간, AI 호출 비용)
- **결과물**: `tests/` 디렉토리 + 평가 리포트
- **권한**: `tests/` 디렉토리 + CI 설정만 수정

### R6. **DevOps & Release** (배포·운영)
- **소속 도구**: `Agent` (general-purpose)
- **R&R**:
  - Railway / Vercel 환경변수·도메인 점검
  - Alembic 마이그레이션 적용 절차 작성
  - 백업·복구 절차
  - 인시던트 대응 가이드
  - 출시 체크리스트 관리 (`infra/docs/DEPLOYMENT.md` § 7)
- **편집 영역**: `infra/**`, `*.json` (railway/vercel), `Dockerfile`(예정)

---

## 2. 기본 10 역할 (이어서)

> 아래 4 역할은 매 스프린트 상시 호출이 아니라 **특정 시점·트리거에만** 호출하지만, 출시 전·중요 변경 시 **반드시 1회 이상 거쳐야 하는** 코어 멤버다.

### R7. **AI Prompt Engineer**
- **소속 도구**: `Agent` (general-purpose)
- **R&R**:
  - `backend/app/services/ai_service.py` 의 프롬프트 문자열 최적화
  - 시스템 프롬프트의 카테고리 정의, JSON 응답 스키마, 예시 추가/제거
  - R5(Test & Eval)의 골든셋(`tests/eval/ledger_parse.jsonl`) 결과를 보고 A/B 비교:
    - 정확도(카테고리 매칭, 금액 추출, 날짜 파싱)
    - 환각 비율 (없는 항목을 만들어내는가)
    - 토큰 비용 (max_tokens, system 길이)
  - 모델 변경 검토 (`claude-haiku-4-5-20251001` ↔ Sonnet) — 비용 vs 정확도
- **편집 영역**: `backend/app/services/ai_service.py` 의 system/user 프롬프트 문자열만. **로직·DB·라우터 수정 금지**
- **호출 트리거**:
  - R5가 골든셋 통과율 < 85% 리포트할 때
  - 새 카테고리 추가, 다국어 지원 시
  - 비용이 급증할 때 (월 $50+)
- **결과물**: 프롬프트 변경 diff + before/after 평가 표
- **금지**: R5 골든셋 결과 없이 "감"으로 프롬프트 수정 (체리피킹 방지)

### R8. **Designer / UX Writer**
- **소속 도구**: `Agent` (general-purpose)
- **R&R**:
  - **마이크로카피**: 한국어 톤 일관성. 반말·다정한 코치 톤 유지 ("기록했어 ✓", "다시 적어줄래?", "다음달 행동 제안")
  - **디자인 토큰**: `frontend/tailwind.config.js` 의 `atm.*` 컬러, 폰트 사이즈, 라운드 반경 일관성
  - **에러 메시지 한국어화**: `"not found"` → `"해당 항목을 찾지 못했어"` 같은 사용자 친화 변환
  - **공백·문장부호**: 가운뎃점·줄임표·이모지 사용 가이드 준수
  - **접근성**: 명도 대비(WCAG AA), 키보드 포커스 표시, aria-label
- **편집 영역**: `frontend/src/**/*.tsx` 의 문자열 리터럴, `tailwind.config.js`, `index.css`. **로직·상태·API 호출 수정 금지**
- **호출 트리거**:
  - 새 페이지·컴포넌트 추가 직후
  - 사용자 피드백에서 "문구가 어색하다" 류 리포트가 들어왔을 때
  - 출시 직전 1회 (전체 텍스트 일관성 검수)
- **결과물**: 문구·스타일 diff + 톤 가이드 업데이트 (`docs/voice-and-tone.md` 신설 권장)
- **금지**: 디자인 토큰을 페이지마다 다르게 인라인 스타일링

### R9. **Security Auditor**
- **소속 도구**: `Agent` (general-purpose) + `/security-review` 슬래시 커맨드 활용
- **R&R**:
  - 출시 직전 1회 + 인증/결제/사진 관련 큰 변경 후 호출
  - **점검 항목**:
    - **AuthN/AuthZ**: 모든 라우터의 `Depends(get_current_user)` 누락 여부, JWT 시크릿 강도·만료, refresh 토큰 회수 정책
    - **사용자 격리**: 모든 쿼리에 `WHERE user_id = current_user.id` 또는 동등 필터 (R4 체크리스트와 중복이지만 보안 관점에서 한 번 더)
    - **OWASP Top 10**:
      - A01 Broken Access Control — IDOR 가능한 라우터 (예: `GET /entries/{id}` 가 다른 유저 entry 보여주나)
      - A02 Cryptographic Failures — 평문 비밀번호, 약한 시드
      - A03 Injection — SQLAlchemy 사용으로 ORM이 대부분 막지만 raw SQL/`text()` 사용처 확인
      - A05 Security Misconfiguration — CORS 와일드카드, debug=True, 노출된 `/docs`
      - A07 Auth Failures — bcrypt cost factor, 동시 세션 제한
    - **시크릿 노출**: 코드·로그·에러 응답에 `JWT_SECRET`, `ANTHROPIC_API_KEY` 등 누출 없는가
    - **파일 업로드**: MIME 검증, 크기 제한(10MB), path traversal, EXIF GPS 누출
    - **AI 프록시 악용**: `/ai/parse` 호출 횟수·토큰 제한 없으면 비용 폭탄 가능 → Rate limit 필수
    - **CSRF/CORS**: JWT 헤더 방식이라 CSRF 영향 낮지만 `CORS_ORIGINS` 와일드카드 여부
    - **HTTPS·보안 헤더**: HSTS, X-Frame-Options, CSP (Vercel·Railway 기본값 검토)
- **편집 영역**: **없음**. 발견 사항은 P0/P1/P2 분류한 리포트만 작성. 수정은 R2/R3에게 재위임
- **호출 트리거**:
  - 출시 직전 (필수, 1회)
  - 인증 관련 코드 변경 시 (signup·login·refresh·get_current_user)
  - 외부 API·결제 추가 시
- **결과물**: 보안 감사 리포트 (`docs/security-audits/YYYY-MM-DD.md`)
- **금지**: 단순 리뷰(R4)와 중복 작업하지 말 것. R4가 일반 코드 품질·UX 체크리스트라면 R9는 **보안 전용**

### R10. **Legal Reviewer**
- **소속 도구**: `Agent` (general-purpose) — 단, 최종 확정은 **인간 법무 검토 필수**. 에이전트는 초안·체크리스트·질문 목록 작성까지만.
- **R&R**:
  - **약관(`frontend/src/pages/Terms.tsx`)** 검토:
    - 서비스 중단·변경 시 통지 의무 명시
    - 회원 의무·금지 행위 명확
    - 책임 제한 범위 합리적 (AI 부정확성 면책 포함)
    - 분쟁 해결·관할 법원
  - **개인정보 처리방침(`frontend/src/pages/Privacy.tsx`)** 검토:
    - 개인정보보호법 표준 양식 항목 누락 없는지 (수집 항목·목적·보유 기간·제3자 제공·국외 이전·이용자 권리·책임자)
    - **국외 이전 고지**: AI 처리 목적 Anthropic(미국)에 데이터 전송 — 사용자 동의 필요
    - 회원 탈퇴 시 데이터 파기 절차
    - 14세 미만 가입 차단 정책 (해당 시)
  - **쿠키·트래킹**: Sentry, Plausible 등 도입 시 쿠키 동의 배너 필요 여부
  - **AI 면책 문구**: 인사이트·분류 결과는 참고용이며 재무 자문이 아님 명시
  - **저작권**: 사용자가 업로드한 사진의 권리·삭제 의무
- **편집 영역**: `frontend/src/pages/Terms.tsx`, `Privacy.tsx`, AI 응답에 면책 문구 추가 시 `ai_service.py`
- **호출 트리거**:
  - 출시 직전 (필수, 1회)
  - 결제·구독 도입 시 (환불·청약철회)
  - 14세 미만 사용자 또는 민감정보 수집 시
  - GDPR/CCPA 대응 필요한 해외 사용자 유입 시
- **결과물**: 약관 diff + 법무 자문 권고 사항 리스트 (인간 변호사가 확인할 질문 목록)
- **금지**: 에이전트가 "법률 검토 완료" 처리하기 — 반드시 **인간 변호사 검토 후 출시**라고 리포트에 명시

---

## 3. 표준 워크플로우

### 새 기능 추가 (예: "지출 분할" 기능)
```
1. 리더 → R1 Architect: 설계 plan 작성
2. R1 → 리더: plan 제출 (파일 변경 목록, 마이그레이션 필요 여부, UI 흐름)
3. 리더 → 사용자: plan 공유, 승인
4. 리더 → R2 Backend + R3 Frontend: 병렬 위임 (계약 = API 스펙)
   ├─ AI 프롬프트 변경이 포함되면 → R7 AI Prompt Engineer 추가 호출
   └─ 새 UI 페이지가 있으면 → R8 Designer / UX Writer 마이크로카피 검수
5. R2/R3 완료 → R4 QA & Reviewer: 변경 사항 리뷰 + 체크리스트
6. R4 리포트의 P0/P1 → 원작자에게 재위임
7. P0/P1 해결되면 → R5 Test & Eval: 테스트 추가 + AI 골든셋 회귀
8. 인증·결제·민감정보 관련 변경이면 → R9 Security Auditor 1회 추가 호출
9. 약관·개인정보 변경이 동반되면 → R10 Legal Reviewer 검토
10. 통과하면 → R6 DevOps & Release: 배포 (스테이징 → 프로덕션)
```

### 출시 직전 (필수 체크포인트)
```
1. R4 QA: 전체 코드 마지막 리뷰
2. R5 Test & Eval: 골든셋 통과율 ≥ 85%, 핵심 시나리오 수동 검증
3. R7 AI Prompt: 프롬프트 비용·정확도 베이스라인 기록
4. R8 Designer: 전 페이지 한국어 톤·디자인 토큰 일관성 1회 스윕
5. R9 Security: OWASP 체크리스트, 보안 감사 리포트
6. R10 Legal: 약관·개인정보 처리방침 → 인간 변호사 최종 검토 의뢰
7. R6 DevOps: 출시 체크리스트(`DEPLOYMENT.md` §7)
```

### 버그 수정
```
1. 리더 → QA & Reviewer: "버그 재현 및 원인 진단"
2. QA → 리더: 원인 + 수정 위치 후보
3. 리더 → Backend 또는 Frontend Engineer: 픽스 위임
4. 완료 → QA & Reviewer: 회귀 확인
5. Test & Eval: 회귀 테스트 추가
```

---

## 4. 호출 예시

```
# Architect 호출
Agent({
  subagent_type: "Plan",
  description: "지출 분할 기능 설계",
  prompt: "Moa AI 가계부에 '지출 분할' 기능 추가. 한 entry를 여러 카테고리로 나눠 금액 분배. backend Entry 모델, 마이그레이션, 라우터 변경과 frontend UI 흐름 plan."
})

# QA & Reviewer 호출
Agent({
  subagent_type: "general-purpose",
  description: "최근 변경 코드 리뷰",
  prompt: "Moa AI 가계부 프로젝트. backend/app/routers/entries.py 와 frontend/src/pages/Ledger.jsx 의 최근 변경을 AGENT_TEAM.md R4 체크리스트 기준으로 리뷰. P0/P1/P2 분류해서 리포트."
})

# Test & Eval 호출
Agent({
  subagent_type: "general-purpose",
  description: "AI parse 골든셋 평가",
  prompt: "tests/eval/ledger_parse.jsonl 의 케이스 20개를 /ai/parse 에 보내 카테고리·금액·날짜 정확도 측정. 이전 결과(tests/eval/last_run.json)와 비교한 회귀 리포트."
})
```

---

## 5. 현재 상태 (2026-05-17 기준)

| 역할 | 충원 상태 | 호출 빈도 | 비고 |
|------|----------|----------|------|
| R1 Architect | 즉시 호출 가능 | 새 기능마다 | `Plan` subagent |
| R2 Backend | 즉시 호출 가능 | 상시 | — |
| R3 Frontend | 즉시 호출 가능 | 상시 | — |
| R4 QA & Reviewer ⭐ | 즉시 호출 가능 | 매 변경 후 | 수정 권한 없음 |
| R5 Test & Eval ⭐ | 즉시 호출 가능 | 매 변경 후 | `tests/` v1에서 신규 생성 |
| R6 DevOps | 즉시 호출 가능 | 출시·배포 시 | `infra/docs/` |
| R7 AI Prompt Engineer | 즉시 호출 가능 | 골든셋 통과율 < 85% 시 | `backend/app/services/ai_service.py` |
| R8 Designer / UX Writer | 즉시 호출 가능 | 새 UI + 출시 1회 | 마이크로카피·디자인 토큰 |
| R9 Security Auditor | 즉시 호출 가능 | 인증·결제 변경 + 출시 1회 | `/security-review` 활용 |
| R10 Legal Reviewer | 즉시 호출 가능 | 약관 변경 + 출시 1회 | **인간 변호사 최종 검토 필수** |

**현재까지 진행한 작업 (v0.5 스캐폴딩)** 은 리더(메인 세션)가 단독으로 수행했습니다.
v1 단계부터는 위 R&R에 따라 다중 에이전트 협업으로 전환합니다.

---

## 6. 안티패턴 (하지 말 것)

- ❌ Backend Engineer가 직접 자기 PR을 리뷰하고 "통과" 처리
- ❌ Frontend Engineer가 `backend/app/security.py` 수정
- ❌ QA가 코드를 직접 수정 (이슈만 제기)
- ❌ 같은 파일을 2명 이상이 동시 편집
- ❌ Test 없이 P0 픽스를 main에 머지
- ❌ 리더가 모든 일을 혼자 처리 (작업 분산이 팀 운영 목적)
