# 커스텀 도메인 연결 — `moa.atm.ai.kr`

> 가비아 (네임서버 `ns.gabia.co.kr`) 에 등록된 `atm.ai.kr` 의 서브도메인 `moa` 를 Vercel 프로덕션에 연결합니다.

---

## 전체 흐름

```
1. Vercel 대시보드에 moa.atm.ai.kr 추가  →  Vercel이 필요한 DNS 레코드 안내
2. 가비아 My가비아 → DNS 관리 → A 레코드(또는 CNAME) + TXT 검증 레코드 추가
3. DNS 전파 대기 (보통 5분 ~ 1시간)
4. Vercel이 자동으로 SSL 발급 + 도메인 활성화
5. Railway 백엔드 CORS_ORIGINS 에 https://moa.atm.ai.kr 추가
```

---

## 1단계. Vercel 도메인 등록

1. https://vercel.com → `atm-ledger-ntrv` 프로젝트 → **Settings** → **Domains**
2. 입력란에 **`moa.atm.ai.kr`** 입력 → **Add**
3. Vercel이 다음 중 하나의 옵션을 안내함:
   - **권장**: CNAME `cname.vercel-dns.com`
   - **대안**: A 레코드 `76.76.21.21` + TXT 검증 레코드
4. 화면에 표시되는 실제 값을 메모 (특히 TXT 검증 토큰은 도메인마다 다름)

---

## 2단계. 가비아 DNS 관리

### 2-A. 가비아 접속
- https://my.gabia.com 로그인
- **My가비아** → **서비스 관리** → **도메인** → **`atm.ai.kr`** 클릭
- 좌측 메뉴 **DNS 관리** 또는 **DNS 설정**

### 2-B. 레코드 추가

가비아는 DNS 관리 화면에서 호스트(이름)·타입·값을 표 형태로 입력합니다.

#### 옵션 A — CNAME (권장, 가장 간단)

| 타입 | 호스트 | 값 / 데이터 | TTL |
|------|--------|------------|-----|
| **CNAME** | `moa` | `cname.vercel-dns.com.` | 600 |

> 호스트 칸엔 서브도메인 부분만 적습니다 (`moa.atm.ai.kr` 의 `moa`). 가비아가 자동으로 `.atm.ai.kr` 을 붙입니다.
> 값 끝의 마침표(`.`)는 가비아 UI에 따라 자동 추가될 수 있습니다.

이 한 줄만으로 끝. **TXT 검증 레코드 불필요** (Vercel이 CNAME 응답으로 소유권 자동 확인).

#### 옵션 B — A 레코드 + TXT 검증 (사용자 요청 형식)

가비아 DNS 관리에 다음 **2개** 레코드 추가:

| # | 타입 | 호스트 | 값 / 데이터 | TTL |
|---|------|--------|------------|-----|
| 1 | **A** | `moa` | `76.76.21.21` | 600 |
| 2 | **TXT** | `_vercel.moa` | `vc-domain-verify=moa.atm.ai.kr,<Vercel이 제공하는 토큰>` | 600 |

⚠️ **TXT 값은 Vercel UI에서 정확한 문자열을 복사**해야 합니다. 위 예시의 `<Vercel이 제공하는 토큰>` 부분은 도메인마다 다르며, 1단계에서 Vercel이 화면에 표시한 그 토큰을 그대로 붙여넣으세요.

> Vercel은 종종 다음 형식 중 하나로 TXT 검증을 요청합니다:
> - 호스트 `_vercel` 값 `vc-domain-verify=...`
> - 호스트 `_vercel.moa` 값 `vc-domain-verify=...`
> - 호스트 `_acme-challenge.moa` 값 `xxxx...` (SSL 발급용)
>
> Vercel 화면에 표시되는 정확한 호스트·값을 따르세요.

### 2-C. 저장 후 전파 대기

- 가비아 DNS 관리에서 **저장** 또는 **적용** 클릭
- 전파 시간: 보통 5분~1시간. 가비아는 비교적 빠른 편
- 확인 방법 (Windows PowerShell):
  ```powershell
  nslookup moa.atm.ai.kr
  ```
  결과에 `cname.vercel-dns.com` (CNAME) 또는 `76.76.21.21` (A) 가 보이면 전파 완료

---

## 3단계. Vercel SSL 발급 자동화 대기

DNS 전파 완료되면 Vercel이 자동으로:
1. 도메인 소유권 확인 (TXT 또는 CNAME 매칭)
2. Let's Encrypt SSL 인증서 발급 (보통 1~5분)
3. 도메인 활성화

Vercel 대시보드 Domains 페이지에서 `moa.atm.ai.kr` 옆에 **Valid Configuration** + 초록색 자물쇠 아이콘 보이면 완료.

---

## 4단계. Railway 백엔드 CORS 업데이트 (필수)

새 도메인이 백엔드를 호출할 수 있도록 CORS 허용 목록에 추가합니다.

1. Railway → `atm_ledger` 서비스 → **Variables** 탭
2. `CORS_ORIGINS` 변수 클릭 → 편집
3. 기존 값에 `https://moa.atm.ai.kr` 콤마로 이어 추가:
   ```
   https://atm-ledger-ntrv.vercel.app,https://moa.atm.ai.kr
   ```
4. Save → Railway 자동 재배포 (1분)

---

## 5단계. 프론트엔드 환경변수 (선택)

Vercel은 도메인을 변경해도 빌드된 코드 안의 `VITE_API_BASE_URL` 은 그대로입니다. 즉, `moa.atm.ai.kr` 사용자도 백엔드는 여전히 `atmledger-production.up.railway.app` 을 호출하므로 변경 불필요.

추후 백엔드도 커스텀 도메인 (예: `api.moa.atm.ai.kr`) 으로 옮기려면 Railway Settings → Networking → Custom Domain 에서 별도 등록 + Vercel 환경변수 `VITE_API_BASE_URL` 업데이트 + 재배포.

---

## 6단계. 검증

브라우저에서:
```
https://moa.atm.ai.kr
```
접속 → ATM 가계부 랜딩 페이지 표시. SSL 자물쇠 아이콘 ✓ 확인.

회원가입·로그인 → CORS 에러 없이 정상 동작 → 끝.

---

## 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `nslookup` 결과가 비어 있음 | DNS 전파 대기 중. 1시간까지 대기 후 재확인 |
| Vercel 대시보드에 `Invalid Configuration` 빨간색 | 호스트명 오타. 가비아에서 `moa` (서브도메인만) 입력했는지 확인 |
| SSL 발급 실패 (1시간 이상) | TXT 검증 레코드 누락. Vercel 화면의 정확한 호스트·값 다시 확인 |
| 도메인은 열리는데 회원가입 시 CORS 오류 | Railway `CORS_ORIGINS` 에 `https://moa.atm.ai.kr` 추가 안 됨. 4단계 재확인 |
| `www.moa.atm.ai.kr` 도 연결하고 싶음 | 가비아에 동일하게 CNAME `www.moa` → `cname.vercel-dns.com` 추가 후 Vercel Domains 에도 등록 |

---

## 요약 — 가비아 DNS 관리에 입력할 최종 레코드

**가장 간단한 방법 (CNAME 한 줄):**
```
타입: CNAME
호스트: moa
값: cname.vercel-dns.com.
TTL: 600
```

**사용자 요청 형식 (A + TXT):**
```
[1번 레코드]
타입: A
호스트: moa
값: 76.76.21.21
TTL: 600

[2번 레코드 — Vercel 화면 확인 후 실제 토큰 입력]
타입: TXT
호스트: _vercel.moa  (또는 Vercel이 안내하는 호스트)
값: vc-domain-verify=...  (Vercel이 발급하는 정확한 토큰)
TTL: 600
```
