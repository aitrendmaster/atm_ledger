# D4 — atmbook.app 통합 가이드 (stateless → moa365 인증 클라이언트)

> **목적**: 현재 계정이 없는 정적 atmbook 사이트를, moa365 백엔드를 인증·권한 서버로 쓰는 클라이언트로 전환한다.
>
> 기준 코드: `전자책/moa365 ai agent/site/`
> 관련 문서: [D1 인증](01-moa365-auth-manual.md) · [D2 Entitlement](02-atm-account-linking.md) · [D3 LS 웹훅](03-lemonsqueezy-cross-grant.md)

---

## 1. 현재 vs 전환 후

| | 현재(stateless) | 전환 후(통합 계정) |
|---|---|---|
| 신원 | 없음. 기기별 localStorage HMAC 토큰 | moa365 JWT 로그인(이메일/구글) |
| 콘텐츠 게이팅 | `api/content.js` 자체 HMAC `verify()` | moa365 `/entitlements/check?sku=atmbook:book-001` |
| 잠금해제 | `api/unlock.js` 라이선스 키→자체 토큰 | 로그인 + 결제 귀속 + entitlement |
| 결제 귀속 | 없음(누가 샀는지 모름) | `checkout[custom][user_id]` 로 계정 귀속 |
| 교차 권한 | 불가 | 자동(전자책 구매 → moa365 6개월) |

전환은 **점진적**으로 가능하다(§6 마이그레이션 전략).

---

## 2. 환경 값

```js
// site/assets/config.js — 추가
window.SITE_CONFIG = {
  brand: "atmbook.app",
  priceLabel: "₩22,000",
  defaultLang: "ko",
  // 통합 스토어 체크아웃 (D3에서 user_id 주입)
  lemonStoreSlug: "atmstore",                 // 통합 후 단일 스토어 slug
  ebookVariantId: "b6a94278-8844-4725-ac83-c9b3afccda8c",  // book-001
  ebookSku: "atmbook:book-001",
  // moa365 인증·권한 API 베이스
  moaApiBase: "https://api.moa365.com",
  googleClientId: "<moa365 와 동일한 GOOGLE_CLIENT_ID>",
};
```

> `moaApiBase` 는 moa365 백엔드. 백엔드 `CORS_ORIGINS` 에 `https://atmbook.app` 이 포함돼야 함(D1 §8).

---

## 3. 로그인 UI (D1 패턴 적용)

```js
// site/assets/auth.js (신규)
var CFG = window.SITE_CONFIG;
var LS = window.localStorage;

function getToken() { return LS.getItem("atm_access") || ""; }
function setTokens(d) {
  if (d.access_token) LS.setItem("atm_access", d.access_token);
  if (d.refresh_token) LS.setItem("atm_refresh", d.refresh_token);
}
function logout() { LS.removeItem("atm_access"); LS.removeItem("atm_refresh"); }

async function login(email, password) {
  var r = await fetch(CFG.moaApiBase + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: password }),
  });
  if (!r.ok) throw new Error("login_failed");
  var d = await r.json(); setTokens(d); return d;
}

async function signup(email, password, displayName) {
  var r = await fetch(CFG.moaApiBase + "/auth/signup", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: password, display_name: displayName }),
  });
  return r.json(); // 가입 후 이메일 인증 필요 — 안내 표시
}

async function googleLogin(idToken) {
  var r = await fetch(CFG.moaApiBase + "/auth/google", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!r.ok) throw new Error("google_failed");
  var d = await r.json(); setTokens(d); return d;
}
window.ATM = { getToken: getToken, login: login, signup: signup, googleLogin: googleLogin, logout: logout };
```

구글 버튼은 Google Identity Services 스크립트(`https://accounts.google.com/gsi/client`)를 로드하고 `CFG.googleClientId` 로 초기화 → 콜백에서 `googleLogin(response.credential)`.

---

## 4. 콘텐츠 게이팅 전환 (`api/content.js`)

현재(자체 HMAC):
```js
// 현재 — site/api/content.js (요약)
var unlocked = verify(req.headers["x-unlock-token"]);  // 자체 HMAC
chapters.forEach(function (c) { if (c.free || unlocked) content[c.id] = c.html; });
```

전환 후 — **moa365 entitlements API로 위임**. 두 가지 방식:

### 방식 A (권장) — 서버가 moa365에 권한 질의
```js
// site/api/content.js (전환 — 참조)
const BOOK = require("./_book.js");
const MOA_API = process.env.MOA_API_BASE; // https://api.moa365.com
const EBOOK_SKU = process.env.EBOOK_SKU || "atmbook:book-001";

async function isEntitled(authHeader) {
  if (!authHeader) return false;
  try {
    const r = await fetch(
      MOA_API + "/entitlements/check?sku=" + encodeURIComponent(EBOOK_SKU),
      { headers: { Authorization: authHeader } }   // 사용자의 moa365 JWT 전달
    );
    if (!r.ok) return false;
    const d = await r.json();
    return !!d.granted;
  } catch (e) { return false; }
}

module.exports = async (req, res) => {
  var lang = (req.query && req.query.lang) || "ko";
  var chapters = BOOK[lang] || BOOK.ko || [];
  var unlocked = await isEntitled(req.headers["authorization"]);
  var toc = chapters.map(c => ({ id: c.id, part: c.part, title: c.title, free: c.free }));
  var content = {};
  chapters.forEach(c => { if (c.free || unlocked) content[c.id] = c.html; });
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.status(200).json({ unlocked: unlocked, toc: toc, content: content });
};
```
프론트는 `fetch("/api/content?lang=ko", { headers: { Authorization: "Bearer " + ATM.getToken() } })`.

### 방식 B (과도기, 최소 변경) — moa365가 단기 서명 토큰 발급
moa365에 `GET /entitlements/atmbook-token?sku=...` 추가 → 권한 있으면 기존 `content.js` 와 같은 형식의 단기(예: 1시간) HMAC 토큰을 **공유 시크릿**으로 발급. atmbook의 기존 `verify()` 는 그대로 두고 토큰 출처만 바꾼다. 코드 변경 최소화가 필요할 때만.

> **권장은 A**. stateless 자체 토큰의 한계(기기별·만료 5년·폐기 불가)를 제거하고 실시간 권한 반영(환불·만료 즉시)이 가능하다.

---

## 5. 결제 → 계정 귀속 (`unlock.js` / 체크아웃)

### 5-1. 체크아웃에 user_id 주입
로그인 사용자만 결제 진입. 체크아웃 URL에 `custom[user_id]` 를 주입한다(D3와 동일 규약).

```js
// site/assets/checkout.js (신규 — 참조)
function ebookCheckoutUrl(userId) {
  var CFG = window.SITE_CONFIG;
  var qs = new URLSearchParams();
  qs.set("checkout[custom][user_id]", String(userId));
  return "https://" + CFG.lemonStoreSlug + ".lemonsqueezy.com/checkout/buy/"
    + CFG.ebookVariantId + "?" + qs.toString();
}
// 구매 버튼: 비로그인 → 로그인 모달, 로그인 → ebookCheckoutUrl(user.id) 로 이동/오버레이
```
결제 완료 → LS 웹훅(`order_created`) → moa365가 `atmbook:book-001` + `moa365:subscription` 6개월 부여(D3). atmbook은 별도 unlock 호출 불필요(권한이 서버에 생김).

### 5-2. 기존 라이선스 키 입력 → 계정 연결 (마이그레이션)
기존 구매자(계정 없이 라이선스 키만 보유)를 위한 복구 폼. moa365에 신규 엔드포인트 추가:

```python
# app/routers/entitlements.py — 추가 (참조)
import httpx
@router.post("/redeem-license")
async def redeem_license(
    payload: dict,                                   # {"license_key": "..."}
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """기존 atmbook 라이선스 키를 현재 로그인 계정에 귀속."""
    key = (payload or {}).get("license_key", "")
    async with httpx.AsyncClient(timeout=10) as cx:
        r = await cx.post("https://api.lemonsqueezy.com/v1/licenses/validate",
                          json={"license_key": key})
        d = r.json() if r.status_code == 200 else {}
    if not d.get("valid"):
        raise HTTPException(400, "유효하지 않은 라이선스 키")
    await grant(db, user_id=user.id, product="atmbook", sku="atmbook:book-001",
                source="purchase", source_ref=f"license:{key[:24]}", expires_at=None)
    await db.commit()
    return {"granted": True, "sku": "atmbook:book-001"}
```
atmbook 프론트: "이미 구매하셨나요? 라이선스 키로 계정에 연결" → `POST {moaApiBase}/entitlements/redeem-license` (Bearer).

> 6개월 moa365 comp 를 기존 구매자에게도 줄지(소급)는 운영 정책 결정사항. 주려면 redeem 시 `moa365:subscription` comp 도 함께 grant.

---

## 6. 마이그레이션 전략 (점진적 전환)

```
단계 1) 백엔드 준비: entitlements 테이블 + /entitlements/* + LS 웹훅 order_created 확장 (D2/D3)
단계 2) atmbook에 로그인/회원가입/구글 UI 추가 (자체 unlock 과 '병존')
단계 3) content.js 를 방식 A 로 전환 — Authorization 헤더 없으면 무료 챕터만,
        있으면 entitlements/check. (기존 x-unlock-token 도 당분간 함께 허용 가능)
단계 4) 신규 결제는 전부 user_id 귀속 체크아웃으로. 라이선스 키 입력은 redeem 으로.
단계 5) 안정화 후 자체 HMAC unlock.js / x-unlock-token 경로 제거.
```

---

## 7. atmbook 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `site/assets/config.js` | `moaApiBase`, `googleClientId`, `lemonStoreSlug`, `ebookVariantId`, `ebookSku` 추가 |
| `site/assets/auth.js` (신규) | 로그인/가입/구글 로직 (`window.ATM`) |
| `site/assets/checkout.js` (신규) | `ebookCheckoutUrl(userId)` |
| `site/api/content.js` | `verify()` → moa365 `/entitlements/check` 위임(방식 A) |
| `site/index.html` / `reader.html` | 로그인 버튼·상태 표시, 구매 버튼 동작 변경, GSI 스크립트 로드 |
| `site/api/unlock.js` | (과도기 유지 후) 제거 또는 redeem 안내로 대체 |

> moa365 백엔드 변경(`entitlements` 모델/라우터, LS 핸들러 확장, CORS)은 [D2](02-atm-account-linking.md)·[D3](03-lemonsqueezy-cross-grant.md) 참조.
