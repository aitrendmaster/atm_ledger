# D5 — 가격 전략 리서치·분석 + 개편안

> **목적**: moa365·atmbook의 현 가격 구조를 분석하고, 홍보·서비스 활성화를 위한 가격/번들 개편안을 데이터 기반으로 제안한다. 교차 권한 인프라([D2](02-atm-account-linking.md)/[D3](03-lemonsqueezy-cross-grant.md))를 마케팅 자산으로 활용한다.

---

## 1. 현재 가격 베이스라인

| 상품 | 현재 가격 | 모델 | 결제 |
|------|-----------|------|------|
| moa365 가계부 (월) | **₩5,500/월** (`toss_monthly_price_krw` 기본값) | 구독, 가입 후 30일 무료 트라이얼 | Toss / Lemon Squeezy |
| moa365 가계부 (연) | yearly variant (LS) | 구독 | Lemon Squeezy |
| atmbook 전자책 #1 | **₩22,000** 단건 | 일회성 구매(라이선스 키) | Lemon Squeezy / PayPal |
| atmbook 전자책 #2~ | (예정, SKU별 개별가) | 일회성 | Lemon Squeezy |

추가 사용자 요청 교차 정책:
- moa365 월 구독 → atmbook 1개월 열람 / 연 구독 → 1년 열람
- atmbook ₩22,000 구매 → moa365 6개월 무료

---

## 2. 리서치 요약 (2025 시장 데이터)

| 발견 | 시사점 |
|------|--------|
| **연간 구독은 이탈 ~30%↓, LTV ~27%↑**. 통상 "2개월 무료(≈16% 할인)"가 표준 인센티브. 기본은 월간으로 두고 연간을 업그레이드로 제시하는 편이 락인보다 효과적 | moa365 연간을 "2개월 무료"로 리프레이밍 |
| **무료체험 전환 15–30% vs 프리미엄(freemium) 3.7%**. 리버스/숏 트라이얼이 영구 무료보다 전환·유지에 유리 | moa365 기존 30일 트라이얼 유지, 프리미엄 신설 비권장 |
| **번들/컬렉션은 AOV·인지가치 상승**, 의사결정 피로 감소, 개별 미구매 기능의 교차판매 | "전자책+구독" 번들로 객단가 상승 |
| **앵커링**: 먼저 제시된 가격이 이후 판단 기준. 높은 정가 옆 할인가가 효과적 | 교차 혜택의 "상당가치"를 명시(앵커) |
| 솔로 마이크로-SaaS는 **단일 유료 티어 + 무료체험**이 복잡한 다단계보다 단순·효과적 | moa365 단일 티어 유지 |

(출처: §6 참고문헌)

---

## 3. 교차 권한의 마케팅 가치 (인지가치 역전 앵커)

이미 구축한 교차 부여 인프라가 **그 자체로 강력한 프로모션**이 된다.

- **"₩22,000 전자책을 사면 moa365 가계부 6개월 무료(₩33,000 상당)"**
  → 6개월 가치(₩5,500 × 6 = ₩33,000)가 전자책 가격(₩22,000)을 **초과** → 인지가치 역전. 전자책 단건 구매의 강력한 이유.
- **"moa365 연 구독자는 atmbook 전자책 전체를 1년간 무료 열람"**
  → 구독의 부가가치를 키워 연간 전환·유지율 상승.

이 메시지는 두 상품의 랜딩·체크아웃·이메일에 일관되게 노출한다.

---

## 4. 개편안 — 3가지 시나리오

> 현 구조를 **베이스라인(그대로 운영 가능)** 으로 유지하고, 아래는 선택 옵션이다.

### 안 A — 보수(현행 유지 + 표기 개선) · 리스크 최저
- 가격 변경 없음. **연간을 "2개월 무료"로 시각화**(월 ₩5,500 × 10 = 연 ₩55,000), 월간 대비 절약액 강조.
- 교차 혜택을 모든 접점에 명시(§3 앵커).
- 전자책은 ₩22,000 유지.

### 안 B — 균형(번들 + 라이브러리 패스 신설) · **추천**
- **신규 번들 SKU**: "전자책 #1 + moa365 6개월" 을 단일 LS 번들로. 교차 부여 인프라가 자동 처리.
- **전자책 라이브러리 패스**(`atmbook:all` 유료판): 전자책이 2권 이상 되는 시점에 "전체 열람 패스"를 개별 합산가보다 저렴하게(예: 개별 합 대비 20~30%↓) 출시 → AOV·번들 효과.
- moa365 연간 "2개월 무료" 표기 + 기존 30일 트라이얼 유지.
- 가격 사다리(예시):

  | 상품 | 제안가 | 비고 |
  |------|--------|------|
  | moa365 월 | ₩5,500 | 유지 |
  | moa365 연 | ₩55,000 | "2개월 무료" 앵커 |
  | 전자책 #1 단건 | ₩22,000 | 유지(+moa365 6개월 comp) |
  | **번들: 전자책#1 + moa365 6개월** | ₩22,000 | 사실상 현 단건과 동일 구성을 '번들'로 명시 노출 |
  | (향후) 라이브러리 패스 | 개별 합 −25% | 전자책 N권 시점 |

### 안 C — 공격(런칭 프로모션 + 가격 실험) · 활성화 우선
- 한정 프로모: 전자책 구매 시 moa365 **6개월 → 12개월** 한시 상향(초기 사용자 확보).
- moa365 연간 **첫 해 할인**(예: ₩55,000 → ₩44,000) 도입 후 A/B로 전환율 측정.
- 무료체험을 30일 유지하되 **카드 등록형 트라이얼** 실험(전환율↑ 가능, 단 마찰↑ — 측정 필수).
- 리스크: 할인 앵커 고착, 수익 희석. **기간/수량 한정**으로 운용.

---

## 5. 추천 & 실행 순서

1. **즉시(코드 변경 0)**: 안 A의 표기 개선 + 교차 혜택 메시지 노출.
2. **번들 출시(안 B)**: 교차 부여 인프라(D2/D3) 배포 후 LS에 번들/라이브러리 패스 SKU 추가. variant→sku 매핑만 설정하면 됨(`LEMONSQUEEZY_VARIANT_SKU_MAP`).
3. **측정 후 안 C 실험**: 전환·유지·AOV 지표를 보고 한정 프로모/연간 할인 A/B.

핵심 지표: 전자책→구독 전환율, 구독 월→연 전환율, comp 6개월 만료 후 유료 잔존율(retention), 번들 AOV.

> comp 6개월 만료 시점에 "유료 전환 유도" 이메일/배너를 띄우는 것이 활성화의 분기점. (만료일 = `entitlements.expires_at` 으로 추적 가능 → 자동 캠페인 트리거 가능)

---

## 6. 참고문헌

- [Micro-SaaS Pricing Pages: What Converts Under 1,000 Users — Freemius](https://freemius.com/blog/micro-saas-pricing-pages-that-convert/)
- [SaaS Freemium Conversion Rates: 2026 Report — First Page Sage](https://firstpagesage.com/seo-blog/saas-freemium-conversion-rates/)
- [Freemium vs Trial Models in SaaS — SaaSFactor](https://www.saasfactor.co/blogs/freemium-vs-trial-models-in-saas-what-really-boosts-conversions)
- [How to Price Bundles for SaaS Products — PayPro Global](https://payproglobal.com/how-to/price-bundles-for-saas/)
- [SaaS Product Bundling: Collections, Cross-Sells, and AOV Lift — Dodo Payments](https://dodopayments.com/blogs/saas-product-bundling-collections)
- [Docs: Subscriptions — Lemon Squeezy](https://docs.lemonsqueezy.com/help/products/subscriptions)
- [Docs: Webhook Event Types — Lemon Squeezy](https://docs.lemonsqueezy.com/help/webhooks/event-types)

> 수치(이탈 30%↓·LTV 27%↑·전환 15–30% vs 3.7%·2개월 무료 16% 등)는 위 2025 업계 리포트의 일반 벤치마크다. moa365·atmbook 실제 데이터로 검증·보정 필요.
