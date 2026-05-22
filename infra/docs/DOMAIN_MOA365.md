# moa365.com 도메인 연결 (dual-host)

> 2026-05-22 — moa365.com 신규 도메인 인수 (Cloudflare 등록).
> moa.atm.ai.kr 과 함께 dual-host 로 운영. moa365.com 이 주 도메인.

## 1. 전제

- moa365.com: Cloudflare 등록(Registrar + DNS).
- moa.atm.ai.kr: 기존 Cloudflare DNS 그대로 유지.
- 프론트: Vercel (atm-ledger-ntrv 프로젝트, team `team_0qfhQGO0vA3MT6CnPqS9zhdl`).
- 백엔드: Render (atm-ledger.onrender.com) — 변경 없음.

## 2. Vercel 도메인 등록

1. https://vercel.com/aitrendmasters-projects/atm-ledger-ntrv/settings/domains
2. **Add Domain** → `moa365.com` 입력 → Add
3. **Add Domain** → `www.moa365.com` 입력 → "Redirect to moa365.com" 선택 (또는 둘 다 직접)
4. Vercel이 안내하는 DNS 레코드 메모 (apex A `76.76.21.21`, www CNAME `cname.vercel-dns.com`)

## 3. Cloudflare DNS 레코드

`moa365.com` DNS 설정에 다음 추가:

| Type  | Name      | Content                 | Proxy status                       |
|-------|-----------|-------------------------|------------------------------------|
| A     | `@`       | `76.76.21.21`           | **DNS only (회색 구름)**           |
| CNAME | `www`     | `cname.vercel-dns.com`  | **DNS only (회색 구름)**           |

> Cloudflare Proxy(주황 구름) 모드는 Vercel SSL과 충돌 → "Too many redirects" / SSL handshake 오류. **반드시 회색 구름**.

DNS 전파(15분~1시간) → Vercel이 Let's Encrypt 인증서 자동 발급.

## 4. Backend 환경변수 갱신 (Render)

`atm_ledger` 서비스 → Environment:

```
CORS_ORIGINS=https://moa365.com,https://www.moa365.com,https://moa.atm.ai.kr,https://atm-ledger-ntrv.vercel.app
FRONTEND_BASE_URL=https://moa365.com
```

Save → Render 자동 재시작 (~1분).

검증: `https://atm-ledger.onrender.com/health/diag` 응답에 `cors_includes_moa365: true` 확인.

## 5. Google Cloud — Maps API 키 referer

Console → API 및 서비스 → 사용자 인증 정보 → **`moa-browser-key`** 수정 → 애플리케이션 제한사항 (웹사이트) 에 추가:

```
https://moa365.com/*
https://www.moa365.com/*
```

(기존 `https://moa.atm.ai.kr/*`, `https://*.vercel.app/*`, `http://localhost:5173/*`, `http://localhost:4173/*` 유지)

## 6. Google Cloud — OAuth 2.0 클라이언트 출처

Console → 사용자 인증 정보 → **OAuth 2.0 클라이언트 ID `Moa AI 가계부`** 수정 → 승인된 JavaScript 출처에 추가:

```
https://moa365.com
https://www.moa365.com
```

(기존 `https://moa.atm.ai.kr` 유지. 승인된 리디렉션 URI는 SPA + Google Identity Service 사용 시 불필요)

## 7. Resend (선택, 브랜드 일관성)

발신 도메인을 moa365.com 으로 검증하려면:

1. Resend Dashboard → Domains → **Add Domain** → `moa365.com`
2. 안내된 SPF/DKIM/DMARC TXT 레코드를 Cloudflare DNS에 추가
3. ~24h 후 Verified 확인
4. Render `RESEND_FROM` 갱신: `Moa AI 가계부 <noreply@moa365.com>`

> 검증 전까지는 기존 발신 도메인 유지. 검증 후 교체.

## 8. 검증 체크리스트

- [ ] `nslookup moa365.com` → `76.76.21.21`
- [ ] `nslookup www.moa365.com` → `cname.vercel-dns.com`
- [ ] https://moa365.com 접속 → Moa Landing 정상 로드 + 자물쇠 (SSL)
- [ ] https://www.moa365.com 접속 → apex 로 redirect (또는 직접 표시)
- [ ] https://moa.atm.ai.kr 접속 → 그대로 정상 (변경 없음)
- [ ] 회원가입/로그인 동작 (CORS 에러 없음)
- [ ] Google 로그인 동작 (OAuth 출처 검증)
- [ ] 가계부 → 장소 모달 → Google Maps 정상 렌더
- [ ] 비밀번호 재설정 메일 링크가 moa365.com 으로 발송됨

## 9. 코드 변경 사항 (이미 commit 됨)

- [main.py](../backend/app/main.py): `/health/diag` 의 `cors_includes_moa365` 진단 항목
- [geo_service.py](../backend/app/services/geo_service.py): Nominatim User-Agent
- [backend/.env.example](../backend/.env.example), [frontend/.env.example](../frontend/.env.example): 가이드 주석 갱신
- [CLAUDE.md](../CLAUDE.md): 도메인 섹션 추가

## 10. 1년 후 정리 검토

baseline: 2027-05-22

- moa.atm.ai.kr 트래픽 비중 < 5% 인지 확인
- < 5% 이면 301 redirect 또는 DNS 삭제 검토
- > 5% 이면 dual-host 유지
