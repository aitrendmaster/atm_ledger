# D1 — moa365 회원가입·로그인·구글 OAuth 개발 상세 매뉴얼

> **목적**: moa365(가계부) 백엔드의 인증 시스템을 그대로 **atmbook.app의 인증 서버**로 재사용하기 위한 기술 명세서.
> atmbook은 자체 계정 DB·로그인 로직을 만들지 않고, 아래 moa365 백엔드 엔드포인트를 호출하는 **클라이언트**가 된다.
>
> 기준 코드: `atm-ledger/backend/app/`
> 관련 문서: [D2 통합 계정·Entitlement](02-atm-account-linking.md) · [D4 atmbook 통합 가이드](04-atmbook-integration.md)

---

## 0. 한눈에 보기

```
[브라우저 / atmbook 프론트]
        │  ① 이메일·비번 또는 구글 id_token
        ▼
POST /auth/login  또는  POST /auth/google
        │  ② JWT access(60분) + refresh(30일) 발급
        ▼
[localStorage 에 토큰 저장]
        │  ③ 이후 모든 요청에 Authorization: Bearer <access>
        ▼
GET /auth/me · /me/billing · /entitlements/check ...
```

- **인증 방식**: JWT Bearer (세션·쿠키 없음). Stateless. 모바일·웹·타 도메인(atmbook) 모두 동일.
- **비밀번호**: bcrypt 해시 (`passlib`).
- **소셜 로그인**: Google Identity Services → 백엔드 `id_token` 검증.
- **이메일 인증**: 신규 가입 시 필수(미인증 계정 로그인 차단). Resend 메일 발송.

---

## 1. 엔드포인트 전체 목록

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/auth/signup` | — | 회원가입. 인증 메일 발송, 로그인 전 이메일 인증 필요 |
| POST | `/auth/login` | — | 로그인 → `TokenPair` |
| POST | `/auth/google` | — | 구글 `id_token` 로그인/가입(upsert) |
| GET | `/auth/verify-email?token=` | — | 이메일 인증 처리 |
| POST | `/auth/resend-verification` | — | 인증 메일 재발송 |
| POST | `/auth/refresh` | refresh token | access 토큰 재발급 |
| GET | `/auth/me` | access | 현재 사용자 조회 |
| PATCH | `/auth/me` | access | 프로필 수정(display_name, monthly_income 등) |
| POST | `/auth/change-password` | access | 비밀번호 변경(password 계정만) |
| POST | `/auth/password-reset/request` | — | 재설정 메일 요청 |
| POST | `/auth/password-reset/confirm` | — | 토큰으로 새 비밀번호 확정 |
| GET | `/auth/me/export` | access | GDPR 데이터 내보내기(JSON) |
| DELETE | `/auth/me` | access | 계정 소프트 삭제 |

> 라우터 등록 위치: `app/main.py` 의 `app.include_router(auth.router)` / `app.include_router(oauth.router)`.

---

## 2. JWT 토큰 (`app/security.py`)

토큰 생성·검증 로직은 아래가 **실제 구현 그대로**다.

```python
# app/security.py
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from .config import get_settings

settings = get_settings()
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return _pwd.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    return _pwd.verify(password, hashed)

def create_access_token(sub: str, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,                 # user_id (문자열)
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_access_ttl_min)).timestamp()),
        "type": "access",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def create_refresh_token(sub: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.jwt_refresh_ttl_days)).timestamp()),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as e:
        raise ValueError(str(e)) from e
```

| 항목 | 값 |
|------|-----|
| 알고리즘 | HS256 (`JWT_ALGORITHM`) |
| access 만료 | 기본 60분 (`JWT_ACCESS_TTL_MIN`) |
| refresh 만료 | 기본 30일 (`JWT_REFRESH_TTL_DAYS`) |
| 비밀키 | `JWT_SECRET` (프로덕션 필수 교체) |
| payload | `sub`(user_id), `iat`, `exp`, `type`(access/refresh) |

> **atmbook 적용 핵심**: atmbook은 같은 `JWT_SECRET` 을 쓰는 moa365 백엔드를 그대로 호출하므로, atmbook 측에서 토큰을 따로 만들 필요가 없다. 받은 토큰을 저장했다가 헤더로 실어 보내기만 하면 된다.

---

## 3. 회원가입 / 로그인 흐름

### 3-1. 회원가입 (`POST /auth/signup`)

**요청**
```json
{
  "email": "user@example.com",
  "password": "********",
  "display_name": "오유진",
  "country_code": "KR",
  "currency_code": "KRW",
  "locale": "ko"
}
```
- 비밀번호는 즉시 `hash_password()` 로 해시 저장.
- `email_verified=false` 상태로 생성 → **인증 메일 발송** → 인증 전 로그인 차단.
- 인증 토큰은 원본을 저장하지 않고 SHA-256 해시(`email_verification_token`)만 저장, 24시간 TTL.

### 3-2. 로그인 (`POST /auth/login`)

**요청** `{ "email": "...", "password": "..." }`
**응답** (`TokenPair`)
```json
{ "access_token": "eyJ...", "refresh_token": "eyJ..." }
```
검증 순서: 사용자 존재 → `verify_password()` → `email_verified` 확인 → `deleted_at IS NULL` → 토큰 발급.

### 3-3. 토큰 재발급 (`POST /auth/refresh`)
refresh 토큰을 받아 `type=="refresh"` 확인 후 새 access(필요 시 refresh) 발급.

---

## 4. Google OAuth (`app/routers/oauth.py`)

### 4-1. 동작 흐름

```
[프론트] Google Identity Services 버튼 → 사용자 구글 로그인
        │  google 가 id_token(JWT) 반환
        ▼
POST /auth/google  { "id_token": "<google id_token>" }
        │  백엔드: google-auth 로 서명·aud·iss·email_verified 검증
        │  provider_sub(구글 sub) 또는 email 로 사용자 매칭/머지/신규생성
        ▼
응답  { access_token, refresh_token, user }
```

### 4-2. 핵심 코드 (실제 구현)

```python
# app/routers/oauth.py — 검증부
def _verify_id_token(id_token_str: str, allowed_client_ids: list[str]) -> dict:
    from google.auth.transport import requests as g_requests
    from google.oauth2 import id_token as gid_token
    request = g_requests.Request()
    last_err = None
    for cid in allowed_client_ids:           # 웹/안드로이드 client_id 순회
        if not cid:
            continue
        try:
            return gid_token.verify_oauth2_token(id_token_str, request, cid)
        except ValueError as e:
            last_err = e
            continue
    raise last_err or ValueError("허용된 Google client_id 가 없습니다.")
```

라우트 본문의 검증 게이트(요약):
```python
if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
    raise HTTPException(401, "유효하지 않은 토큰 발급자")
if not claims.get("email_verified", False):
    raise HTTPException(401, "Google 이메일이 검증되지 않았습니다.")
```

사용자 매칭 3단계:
1. `provider_sub == sub AND auth_provider == "google"` 로 조회.
2. 없으면 **같은 email** 로 조회 → 기존 password 계정에 `provider_sub` 채워 **머지**.
3. 둘 다 없으면 신규 생성 (`auth_provider="google"`, `email_verified=True` — 구글이 메일 소유권 보증).

> 구글로 로그인하면 별도 이메일 인증 절차가 생략된다(구글이 이미 보증).

### 4-3. Google Cloud Console 설정 (atmbook 추가 시)

1. **Google Cloud Console → API 및 서비스 → OAuth 동의 화면**
   - 앱 이름, 지원 이메일, 로고 등록. 게시 상태 "프로덕션".
2. **사용자 인증 정보 → OAuth 2.0 클라이언트 ID (웹 애플리케이션)**
   - **승인된 JavaScript 원본**에 두 도메인 모두 추가:
     - `https://moa365.com`
     - `https://atmbook.app`
   - (필요 시 로컬: `http://localhost:5173`, `http://localhost:3000`)
3. 발급된 **클라이언트 ID**를 백엔드 `GOOGLE_CLIENT_ID` 에 설정.
   - 안드로이드/Firebase 등 추가 audience 가 있으면 `GOOGLE_EXTRA_CLIENT_IDS` 에 콤마로 추가 (백엔드가 `google_client_ids_all` 로 합쳐 순회 검증).
4. **중요**: moa365와 atmbook이 **같은 백엔드(같은 GOOGLE_CLIENT_ID)** 를 쓰므로, 같은 웹 클라이언트 ID를 두 사이트 프론트에서 공유하면 된다. 승인된 JS 원본 목록에만 atmbook 도메인을 추가하면 끝.

> `GOOGLE_CLIENT_ID` 미설정 시 `/auth/google` 은 503을 반환하므로, 프론트는 구글 버튼을 숨기면 된다.

---

## 5. 이메일 인증 & 비밀번호 재설정

### 5-1. 이메일 발송 (`app/services/email_service.py`)
- Resend SDK 사용. `RESEND_API_KEY` 미설정 시 링크를 로그로만 출력(개발 폴백).
- 발신자: `RESEND_FROM` (기본 `"Moa AI 가계부 <onboarding@resend.dev>"`).
- 링크 베이스: `FRONTEND_BASE_URL`.

### 5-2. 토큰 저장 원칙
- 인증·재설정 토큰은 **원본을 DB에 저장하지 않는다**. `hashlib.sha256(raw).hexdigest()` 해시만 저장.
- 메일 링크에만 원본 토큰을 실어 보낸다.
- 재설정 토큰은 `PasswordResetToken` 테이블(컬럼: `user_id`, `token_hash`, `expires_at`, `used_at`), 기본 60분 TTL.
- 재설정 확정 시 해당 사용자의 모든 재설정 토큰을 `used` 처리(재사용 방지).

---

## 6. User 모델 — 인증/구독 컬럼 (`app/models/user.py`)

atmbook 통합 시 알아야 할 핵심 컬럼만 정리(실제 모델 기준):

| 컬럼 | 타입 | 의미 |
|------|------|------|
| `id` | int PK | 사용자 식별자. JWT `sub` 와 LS `custom_data.user_id` 의 값 |
| `email` | str unique | 로그인 ID. 구글/패스워드 머지 키 |
| `password_hash` | str? | bcrypt 해시. 구글 전용 계정은 NULL |
| `auth_provider` | str | `"password"` \| `"google"` |
| `provider_sub` | str? | 구글 `sub` 클레임 |
| `display_name` | str? | 표시 이름 |
| `country_code` / `currency_code` / `locale` | str | 지역화 (기본 KR/KRW/ko) |
| `subscription_tier` | str | `"free"` \| `"paid"` |
| `subscription_expires_at` | datetime? | 구독 만료/갱신 시각 |
| `subscription_status` | str? | `active` \| `past_due` \| `canceled` \| NULL |
| `lemonsqueezy_subscription_id` | str? | LS 구독 ID |
| `lemonsqueezy_variant_id` | str? | 가입 플랜(월/연) variant |
| `lemonsqueezy_renews_at` | datetime? | LS 다음 갱신 시각 |
| `toss_billing_key` 외 | — | Toss 정기결제 관련(국내 카드) |
| `email_verified` | bool | 인증 완료 여부(미인증 로그인 차단) |
| `is_admin` | bool | 운영자 |
| `deleted_at` | datetime? | 소프트 삭제(NULL=활성) |
| `created_at` | datetime | 가입일(무료 트라이얼 30일 기준점) |

> **D2에서 추가할 것**: 위 모델은 "전자책 권한"을 표현하지 못한다. atmbook 전자책은 SKU별로 늘어나므로, User 컬럼 확장이 아니라 **별도 `entitlements` 테이블**(1:N)을 신설한다. → [D2 참조](02-atm-account-linking.md).

---

## 7. 프론트엔드 통합 패턴

### 7-1. axios 인스턴스 + 토큰 인터셉터 (atmbook/moa365 공통)

```typescript
// services/authApi.ts
import axios from "axios";

const AUTH_BASE = import.meta.env.VITE_MOA_API; // 예: https://api.moa365.com

export const authApi = axios.create({ baseURL: AUTH_BASE });

authApi.interceptors.request.use((cfg) => {
  const tk = localStorage.getItem("atm_access");
  if (tk) cfg.headers.Authorization = `Bearer ${tk}`;
  return cfg;
});

// 401 → refresh 시도 → 실패 시 로그아웃
authApi.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401) {
      const rt = localStorage.getItem("atm_refresh");
      if (rt) {
        try {
          const { data } = await axios.post(`${AUTH_BASE}/auth/refresh`, { refresh_token: rt });
          localStorage.setItem("atm_access", data.access_token);
          err.config.headers.Authorization = `Bearer ${data.access_token}`;
          return axios(err.config); // 원 요청 재시도
        } catch {
          localStorage.removeItem("atm_access");
          localStorage.removeItem("atm_refresh");
        }
      }
    }
    return Promise.reject(err);
  }
);
```

### 7-2. 로그인 호출

```typescript
export async function login(email: string, password: string) {
  const { data } = await authApi.post("/auth/login", { email, password });
  localStorage.setItem("atm_access", data.access_token);
  localStorage.setItem("atm_refresh", data.refresh_token);
  return data;
}

export async function googleLogin(idToken: string) {
  const { data } = await authApi.post("/auth/google", { id_token: idToken });
  localStorage.setItem("atm_access", data.access_token);
  localStorage.setItem("atm_refresh", data.refresh_token);
  return data; // { access_token, refresh_token, user }
}
```

> localStorage 키는 두 사이트에서 `atm_access` / `atm_refresh` 로 통일(통합 계정이므로 토큰 의미가 동일).

---

## 8. atmbook 적용 체크리스트

```
□ 백엔드 CORS_ORIGINS 에 https://atmbook.app 추가 (app/main.py CORSMiddleware)
□ Google Cloud Console 승인된 JS 원본에 https://atmbook.app 추가
□ atmbook 프론트에 로그인/회원가입/구글 버튼 추가 → moa365 /auth/* 호출
□ 토큰을 localStorage(atm_access/atm_refresh)에 저장, axios 인터셉터로 자동 첨부
□ (콘텐츠 게이팅 전환은 D4) 자체 HMAC 토큰 → /entitlements/check 로 교체
□ FRONTEND_BASE_URL 은 메일 링크용 — moa365 도메인 유지(또는 분기 처리)
```

---

## 9. 관련 환경 변수 (백엔드 `app/config.py`)

| 변수 | 용도 |
|------|------|
| `JWT_SECRET` / `JWT_ALGORITHM` / `JWT_ACCESS_TTL_MIN` / `JWT_REFRESH_TTL_DAYS` | JWT |
| `GOOGLE_CLIENT_ID` / `GOOGLE_EXTRA_CLIENT_IDS` | 구글 OAuth |
| `RESEND_API_KEY` / `RESEND_FROM` / `PASSWORD_RESET_TTL_MIN` | 이메일 |
| `FRONTEND_BASE_URL` | 메일 링크 베이스 |
| `CORS_ORIGINS` | 허용 출처(콤마 구분) — **atmbook 도메인 추가 필요** |
| `ADMIN_EMAILS` | 운영자 부트스트랩 |

→ 결제·구독·교차 권한 관련 변수는 [D3](03-lemonsqueezy-cross-grant.md) 참조.
