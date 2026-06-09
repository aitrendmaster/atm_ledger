# 보류(Deferred) UX 기능 로드맵

2026-06-09 moa365 UX 개선 작업에서 **즉시 출시한 4건**(시그너처 통일·프라이버시 신호·음성 입력·일간 카드)과
**무료/유료 페이월**은 `main`에 배포됨. 아래 3건은 범위·리스크가 커서 별도 작업으로 분리(이 PR에서 추적).

---

## 1. 안드로이드 결제 알림 자동 캡처 / 카카오톡 결제 알림 공유 파싱

**목표:** 사용자가 직접 입력하지 않아도, OS 결제 알림(은행/카드 푸시, 카카오페이 등)을 읽어
한 탭으로 가계부에 등록.

**왜 보류:** 순수 JS/웹으로 불가능. 안드로이드 네이티브 권한이 필요.
- 현재 `frontend/src/lib/push-init.ts` 는 **FCM 수신 전용**(서버→앱 푸시 받기)이지,
  OS 알림을 **읽는** 기능이 아님.
- 필요한 것:
  - Android `NotificationListenerService` (특수 권한 — 사용자가 설정에서 직접 허용) 또는
    `AccessibilityService` 기반 커스텀 Capacitor 플러그인.
  - 캡처한 알림 텍스트 → 기존 `POST /ai/parse` 로 전송하면 파싱은 재사용 가능.
  - Play Store 정책 심사(알림 접근은 민감 권한 — 용도 정당성·개인정보 처리방침 보강 필요).
- 카카오톡 "공유" 인텐트 수신: Android share-target(`intent-filter`) + 네이티브 브리지 필요.

**대안(저비용):** 사용자가 결제 알림을 길게 눌러 "공유 → Moa" 하면 share-target 으로 받아
`/ai/parse` 에 넘기는 방식. 그래도 네이티브 share-target 등록은 필요.

**예상 규모:** 네이티브 플러그인 1개 + 권한 온보딩 UX + 정책 문서 보강. 중대형.

---

## 2. 예약(스케줄) 데일리 푸시 — "오늘 0원 썼어요" 등 능동 알림

**목표:** 앱을 안 열어도 매일/주간 격려·회고 푸시로 리텐션 hook.

**현황:** 인앱 일간 카드(`LedgerChat.jsx`, 클라이언트 계산)는 이미 배포됨.
능동 푸시는 백엔드 스케줄러+배포 필요라 보류.

**구현 메모(재사용 가능 패턴):**
- `backend/app/services/notifier_scheduler.py` 가 이미 KST 09:00 tick 패턴으로 존재
  (D-1 반복지출 알림). 동일 패턴으로 데일리 격려 push 추가 가능.
- `fcm_service.send_to_user(...)` 로 발송. User 푸시 토큰은 이미 수집 중.
- 추가 필요:
  - User 에 `daily_nudge_opt_in`(bool) + `last_nudge_date` 컬럼 + 마이그레이션.
  - 사용자 타임존(현재 geo 메타로만 추정 — 알림 시각용 별도 선호값 권장).
  - 문구는 i18n(`ledger.daily.*` 재사용 가능). AI 호출 없이 통계 기반이면 비용 0.

**예상 규모:** 소~중. 외부 의존 없음(코드+마이그레이션+배포).

---

## 3. 카테고리 유연성 — 커스텀 카테고리 + 온보딩 라이프스타일 질문

**목표:** 기본 카테고리 외에 사용자가 직접 추가(펫·육아·취미 등), 가입 시 라이프스타일
질문으로 추천 카테고리 자동 세팅.

**왜 보류:** 라이브 B2C + 프로덕션 Postgres 마이그레이션 + AI 파싱 경로 변경이라
성급히 묶으면 파싱이 깨질 위험. 전용 PR 권장.

**현황/앵커:**
- 백엔드 카테고리는 `backend/app/services/ai_service.py` 의 `ALLOWED_CATEGORIES`
  (한국어 키 10개 하드코딩). 미인식 시 "기타" 로 다운그레이드.
- `entry.category` / `planned.category` 는 이미 free `String(40)` 컬럼 → DB 제약은 없음.
- 프론트 `LedgerChat.jsx` 의 `CATEGORIES` 맵(아이콘·색)도 하드코딩 → 동적화 필요.

**구현 스케치:**
1. User 에 `custom_categories`(JSON) 컬럼 + Alembic 마이그레이션.
2. `ai_service` 가 parse 시 전역 + 사용자 커스텀 목록을 병합해 허용.
3. `POST/DELETE /me/categories` 엔드포인트(커스텀 CRUD).
4. 프론트 `CATEGORIES` 를 API 기반으로 전환(아이콘은 기본 폴백).
5. 가입 후 온보딩 1스텝(라이프스타일 → 추천 카테고리 프리셋).

**주의:** 백엔드 카테고리 키는 한국어 유지 정책(표시 라벨만 i18n). 커스텀도 동일 규칙 또는
병렬 i18n 설계 필요.

**예상 규모:** 중. 마이그레이션 + AI 프롬프트 + 프론트 동적화 + 온보딩.

---

## 함께 보류된 통합 작업 (이 PR 본체)

이 PR 에는 위 3건 로드맵과 함께, 이전부터 HOLD 였던
**atmbook(전자책) ↔ moa365 통합 계정·Entitlement 교차권한** 백엔드(Phase 1A)도 포함됨
(`docs/integration/` 설계 5종 + `entitlement*` 모듈 + LS 교차지급 웹훅 + me.py comp 반영).
LemonSqueezy 웹훅 미설정 시 비활성이라 기존 동작 무영향. **머지 전 별도 검토 필요.**
