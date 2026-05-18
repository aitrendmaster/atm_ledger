# Moa AI 가계부 로드맵

## v0.5 (현재 — 스캐폴딩 완료)
- [x] 폴더 구조, FastAPI 백엔드 스켈레톤, Vite+TS 프론트 스켈레톤
- [x] 이메일/비밀번호 회원가입·로그인 (JWT 액세스+리프레시)
- [x] Claude API 백엔드 프록시 (`/ai/parse`, `/ai/insight-from-stats`)
- [x] Nominatim 지오코딩 프록시 (`/geocode`)
- [x] 엔티티 CRUD 엔드포인트 (entries / planned / reflections / photos)
- [x] 로컬·R2 두 가지 사진 스토리지 백엔드
- [x] 약관·개인정보 처리방침 초안

## v1 (DB 연동 + 출시) — 1~2주
- [ ] **프론트 in-memory state → React Query 로 DB 연동** (가장 큰 작업)
  - `entries`, `planned`, `reflections` 모두 `useQuery` 로 교체
  - 낙관적 업데이트(optimistic update) 적용
- [ ] 사진 업로드를 base64 client-state → backend `POST /entries/{id}/photos`
- [ ] 사용자 프로필 화면 (월 수입·예산 편집)
- [ ] 시드 데이터(SEED_ENTRIES, SEED_REFLECTIONS, SEED_PLANNED) 제거 또는 "데모 데이터로 시작" 옵션
- [ ] Alembic 정식 마이그레이션 생성
- [ ] Vercel + Railway 첫 배포
- [ ] 약관/개인정보 법률 검토 및 확정
- [ ] Google OAuth 추가 (이메일+소셜 둘 다)
- [ ] Sentry 에러 트래킹
- [ ] Rate limit (`/ai/*`에 분당 10회 등)

## v1.5 (사용성) — 2~4주
- [ ] Kakao OAuth (한국 사용자 친화)
- [ ] PWA — 모바일 홈화면 설치
- [ ] 이메일 인증 (회원가입 시)
- [ ] 비밀번호 재설정
- [ ] 데이터 내보내기 (CSV 다운로드)
- [ ] 카테고리 커스터마이즈 (사용자가 추가/이름변경)
- [ ] 영수증 OCR 정확도 측정 + 프롬프트 튜닝
- [ ] 사용 통계 (Plausible 또는 Umami)

## v2 (확장) — 3개월+
- [ ] 카카오뱅크 / 토스 OpenBanking 연동 (자동 거래 수집)
- [ ] 가족·커플 공유 가계부 (그룹 기능)
- [ ] 주간 리포트 이메일
- [ ] 모바일 앱 (React Native / Capacitor)
- [ ] 다국어 (영어, 일본어)
- [ ] AI 코칭 챗 — 단순 인사이트가 아닌 멀티턴 대화
