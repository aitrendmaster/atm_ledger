# moa365 ↔ atmbook 통합 회원·결제 연동 문서 세트

moa365(가계부)와 atmbook.app(전자책)의 **통합 계정 + 교차 이용 권한** 설계·개발 매뉴얼.

핵심 결정: **moa365 FastAPI 백엔드를 "ATM 통합 계정 + Entitlement(이용권한) 권위 서버"로 승격**한다. atmbook은 자체 계정 DB 없이 moa365의 `/auth/*`·`/entitlements/*` API를 호출하는 클라이언트가 된다. 결제 → 권한 부여는 단일 Lemon Squeezy 스토어 웹훅이 moa365에서 한 곳으로 강제한다.

## 문서

| # | 문서 | 내용 |
|---|------|------|
| D1 | [01-moa365-auth-manual.md](01-moa365-auth-manual.md) | 회원가입·로그인·구글 OAuth 개발 상세 매뉴얼 (atmbook 적용용 재사용 스펙) |
| D2 | [02-atm-account-linking.md](02-atm-account-linking.md) | 통합 계정 + Entitlement 데이터 모델 & 운영 방침(교차 권한 규칙) |
| D3 | [03-lemonsqueezy-cross-grant.md](03-lemonsqueezy-cross-grant.md) | 단일 LS 스토어 웹훅 → 교차 권한 부여 구현 가이드 |
| D4 | [04-atmbook-integration.md](04-atmbook-integration.md) | atmbook 정적 사이트 → moa365 인증/콘텐츠 게이팅 클라이언트 전환 |
| D5 | [05-pricing-strategy.md](05-pricing-strategy.md) | 가격 전략 리서치·분석 + 개편안 |

## 교차 권한 규칙(요약)

| 트리거 | 부여 | 만료 |
|--------|------|------|
| moa365 월 구독 | `atmbook:all` | 구독 만료와 동기화(롤링) |
| moa365 연 구독 | `atmbook:all` | 구독 만료(≈1년) |
| atmbook ₩22,000 구매 | `atmbook:book-001`(영구) + `moa365:subscription`(comp) | 영구 / now+6개월 |
| atmbook 개별 전자책 | `atmbook:book-XXX` | 영구 |

## 구현 산출물 범위

본 문서는 **참조 구현 스니펫**을 포함한다(사용자 선택: 문서 + 스니펫). 실제 프로덕션 코드 반영은 후속 작업:
- 신규: `backend/app/models/entitlement.py`, `backend/app/routers/entitlements.py`, `backend/app/services/entitlement_service.py`
- 확장: `backend/app/services/lemonsqueezy_service.py`(`handle_event`), `app/routers/me.py`(comp 반영), `app/main.py`(라우터·CORS), `app/config.py`(variant→sku 매핑)
- atmbook: `site/api/content.js`, `site/assets/{config,auth,checkout}.js`
