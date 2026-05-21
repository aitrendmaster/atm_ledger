"""Claude API 프록시. 프론트에서 직접 호출하지 않고 백엔드 경유.

호출마다 AIUsage 행을 비동기 기록(별도 세션)해 admin 대시보드의 사용량/비용 위젯에 반영한다.
가격은 모델별 PRICING_MC_PER_TOKEN 에 정의 — millicent 단위(1/1000 cent)로 저장.
"""
import json
import re
from datetime import date as _date

import anthropic
from loguru import logger
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..config import get_settings
from ..database import engine
from ..models.ai_usage import AIUsage

settings = get_settings()

MODEL_PARSE = "claude-haiku-4-5-20251001"
MODEL_INSIGHT = "claude-haiku-4-5-20251001"

ALLOWED_CATEGORIES = {
    "식비", "카페/간식", "쇼핑", "교통", "주거/공과금",
    "건강/뷰티", "여행/이벤트", "경조사/선물", "금융/대출", "기타",
}

ALLOWED_RECURRENCE = {"none", "monthly", "weekly", "yearly"}

# Claude Haiku 4.5 (2025-10-01): input $1/MTok, output $5/MTok
# millicent per token: input 0.0001 / output 0.0005
PRICING_MC_PER_TOKEN: dict[str, dict[str, float]] = {
    "claude-haiku-4-5-20251001": {"input": 0.0001, "output": 0.0005},
}
DEFAULT_PRICING = {"input": 0.0001, "output": 0.0005}

_usage_session = async_sessionmaker(engine, expire_on_commit=False)


def _estimate_cost_mc(model: str, input_tokens: int, output_tokens: int) -> int:
    p = PRICING_MC_PER_TOKEN.get(model, DEFAULT_PRICING)
    return int(round(input_tokens * p["input"] + output_tokens * p["output"]))


async def _record_usage(
    *,
    user_id: int | None,
    kind: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    status: str = "ok",
    error: str | None = None,
) -> None:
    """별도 세션에서 ai_usage 행 기록. 실패해도 호출 측에는 전파하지 않는다."""
    try:
        async with _usage_session() as db:
            db.add(
                AIUsage(
                    user_id=user_id,
                    kind=kind,
                    model=model,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    estimated_cost_mc=_estimate_cost_mc(model, input_tokens, output_tokens),
                    status=status,
                    error=(error or "")[:255] or None,
                )
            )
            await db.commit()
    except Exception:
        logger.exception(f"AI usage 기록 실패 (kind={kind}, user_id={user_id})")


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


def _strip_fence(text: str) -> str:
    return text.replace("```json", "").replace("```", "").strip()


def _to_int_amount(v) -> int:
    """Locale-tolerant amount parser.

    Accepts int/float/string. Strips common thousand separators (",", ".", spaces, NBSP)
    so values like "13.000" (vi-VN, ko-KR shorthand) or "13,000" (en-US) become 13000.
    Returns 0 if unparseable.
    """
    if v is None:
        return 0
    if isinstance(v, bool):
        return 0
    if isinstance(v, (int, float)):
        return int(v)
    s = str(v).strip()
    if not s:
        return 0
    # Keep digits and a leading '-' only. Removes "13.000", "13,000", "13 000", "13,000.50", "₫"
    cleaned = re.sub(r"[^0-9-]", "", s)
    if not cleaned or cleaned == "-":
        return 0
    try:
        return int(cleaned)
    except ValueError:
        return 0


def _usage_from(resp) -> tuple[int, int]:
    u = getattr(resp, "usage", None)
    if not u:
        return 0, 0
    return int(getattr(u, "input_tokens", 0) or 0), int(getattr(u, "output_tokens", 0) or 0)


# locale 별 parse_expense system prompt.
# 카테고리 키는 한국어 그대로 유지 (백엔드 ALLOWED_CATEGORIES 가 한국어). 표시 라벨만 프론트 i18n.
# JSON 응답 포맷 동일. AI 가 사용자 입력 언어를 인식해 description 을 그 언어로 채우게 유도.
_PARSE_SYSTEM_BY_LOCALE: dict[str, str] = {
    "ko": "너는 가계부 분류기야. JSON 으로만 답해.",
    "en": "You are a personal-finance ledger classifier. Respond with JSON only.",
    "ja": "あなたは家計簿の分類器です。JSON のみで応答してください。",
    "zh": "你是个人记账分类器。仅以 JSON 回应。",
    "es": "Eres un clasificador de libro de gastos personal. Responde solo en JSON.",
    "th": "คุณคือผู้จัดประเภทบันทึกค่าใช้จ่ายส่วนตัว ตอบเป็น JSON เท่านั้น",
    "vi": "Bạn là bộ phân loại sổ chi tiêu cá nhân. Chỉ trả lời bằng JSON.",
    "ms": "Anda ialah pengelas lejar kewangan peribadi. Jawab hanya dalam JSON.",
    "hi": "आप एक व्यक्तिगत व्यय बही वर्गीकारक हैं। केवल JSON में उत्तर दें।",
}


# 반복 지출인데 종료일이 누락된 경우, AI 가 follow_up 을 만들지 못했을 때의 fallback 메시지.
# 9개 locale 모두 동일 패턴: 의도 확인 + 종료일 질문 + ISO/duration 예시.
_MISSING_END_FOLLOWUP: dict[str, str] = {
    "ko": "반복 지출로 인식했어요. 언제까지 계속될까요? 예: 2027-12-31 / 24개월 / 5년간",
    "en": "Got it as a recurring expense. When should it end? e.g., 2027-12-31 / 24 months / 5 years",
    "ja": "繰り返し支出として認識しました。いつまで続きますか？ 例: 2027-12-31 / 24ヶ月 / 5年間",
    "zh": "已识别为重复支出。持续到什么时候？例如: 2027-12-31 / 24个月 / 5年",
    "es": "Lo entendí como un gasto recurrente. ¿Hasta cuándo continuará? ej. 2027-12-31 / 24 meses / 5 años",
    "th": "เข้าใจว่าเป็นค่าใช้จ่ายประจำ จะสิ้นสุดเมื่อใด? เช่น 2027-12-31 / 24 เดือน / 5 ปี",
    "vi": "Đã nhận là chi tiêu định kỳ. Kéo dài đến khi nào? vd: 2027-12-31 / 24 tháng / 5 năm",
    "ms": "Difahami sebagai perbelanjaan berulang. Bilakah ia akan berakhir? cth: 2027-12-31 / 24 bulan / 5 tahun",
    "hi": "इसे आवर्ती खर्च के रूप में समझा है। यह कब तक चलेगा? उदा: 2027-12-31 / 24 महीने / 5 साल",
}


async def parse_expense(
    text: str | None,
    image_b64: str | None,
    media_type: str | None,
    user_id: int | None = None,
    user_locale: str = "ko",
) -> dict:
    """자유 텍스트/영수증 이미지를 가계부 항목으로 파싱.

    반환 형태: {"items": [...], "follow_up": "..." | None}
    - items: 정상 파싱된 가계부 항목들 (zero or more)
    - follow_up: 의도는 파악됐지만 필수 정보가 누락된 경우 사용자에게 보여줄
      자연어 안내 메시지 (사용자 locale). 항목과 함께 반환될 수도 있음
      (예: 일부 행은 정상 + 나머지는 모호 — 사용자에게 보완 요청).
    """
    today = _date.today().isoformat()
    intro = _PARSE_SYSTEM_BY_LOCALE.get(user_locale, _PARSE_SYSTEM_BY_LOCALE["ko"])
    system = f"""{intro}

# Output schema (ALWAYS respond with this exact JSON object — never a bare array)

{{
  "items": [<ParsedItem>, ...],
  "follow_up": "<message in user's language>" | null
}}

A ParsedItem is:
{{"kind":"spent"|"planned","description":"...","amount":<number>,"category":"<Korean key>","date":"YYYY-MM-DD","placeName":"<name or null>","recurrence":"none"|"monthly"|"weekly"|"yearly","recurrence_day":<int or null>,"recurrence_until":"YYYY-MM-DD"|null}}

# Field rules

kind: "spent" (already paid) | "planned" (future / upcoming).
**DEFAULT kind="spent"** when the user just describes a purchase without an explicit future signal.
- spent triggers: hôm nay / 오늘 / today / now / 방금 / just / 어제 / yesterday /
  영수증 / receipt / paid / bought / 샀어 / 썼어 / 마트 / mua / past tense / receipt image.
- planned triggers: 내일 / 다음달 / next / will / sẽ / 예정 / upcoming / 계획 /
  future-dated mentions / 매월·매주·매년 (recurring).
- For pure receipt images, ALWAYS kind="spent".

amount: integer in user's currency. Strip thousand separators (".", ",", spaces).
"13.000" or "13,000" → 13000. amount must be positive; otherwise skip the item.

category (must be one of these Korean keys): {', '.join(ALLOWED_CATEGORIES)}
- "이자 / 대출 / 월부금 / 카드값 / loan interest / monthly payment / 주담대" → "금융/대출"

recurrence: "none" | "monthly" | "weekly" | "yearly". Default "none".
- "매월/매달/every month" with day → recurrence="monthly", recurrence_day=<day of month 1-31>
- "매주/every week" with weekday → recurrence="weekly", recurrence_day=<0=Mon..6=Sun>
- "매년/every year" → recurrence="yearly", recurrence_day=null
- IMPORTANT: when the user says "매월" once in a comma-separated list and then lists
  multiple "N일 ... amount" entries, APPLY recurrence="monthly" to ALL items in that list,
  with each item taking its own recurrence_day from the date number.
- For comma-separated lists with shared kind="planned"/"지출 예정" and multiple "N일 ...",
  prefer recurrence="monthly" over one-off (planned recurring expense pattern).

date: YYYY-MM-DD. Default = today ({today}). For recurring items, date = first occurrence
(closest upcoming N-th day from today).

# recurrence_until — REQUIRED for any recurring item

For ANY item with recurrence != "none", `recurrence_until` is **MANDATORY** as ISO date
"YYYY-MM-DD". Parse natural-language end markers in the user's language:
- "8월 말까지", "until end of August" → last day of August in the appropriate year
- "내년까지", "until next year" → 12-31 of next year
- "24개월", "24 months", "for 2 years" → start_date + that duration (last day)
- "5년간", "for 5 years" → start_date + 5 years (last day)
- "2027-06-30" or any explicit ISO date → use as-is

If the user did NOT mention any end marker AND the item is recurring, DO NOT guess.
Instead return items WITHOUT that recurring item (drop it) and emit a follow_up below.
Set recurrence_until=null only for one-off items (recurrence="none").

# Follow-up rule (CRITICAL UX)

When the user's input strongly implies a **recurring expense** (multiple amounts, "매월",
"지출 예정", regular financial transactions like loan/rent) but you cannot confidently
parse it OR critical info is missing — **including a missing recurrence_until** — RETURN:
- items=[] (or items=[partial successes for non-recurring rows])
- follow_up=<a short, friendly natural-language message in the user's language ({user_locale})
  that:
    1. Confirms you understood it as a recurring expense.
    2. Asks for the missing information. If the missing info is the end date, ask:
       "When should this recurring expense end? Examples: 2027-12-31 / 24 months / 5 years"
       — translated naturally to {user_locale}. Always include at least one ISO-date example
       and one duration-phrasing example.
    3. Shows ONE concrete example of how to write it correctly (use the user's currency).

Required information checklist for a recurring expense:
  • 금액 (amount)
  • 반복 주기 (recurrence: monthly/weekly/yearly)
  • 반복일 (recurrence_day: 1-31 for monthly, 0-6 for weekly)
  • 카테고리 (one of ALLOWED_CATEGORIES; 금융/대출 for loan interest)
  • 시작일 (start date, optional → defaults to today)
  • **종료일 (recurrence_until) — REQUIRED, ISO YYYY-MM-DD**

When info IS sufficient, parse normally with items=[...], follow_up=null.
When NOT a transaction at all (greeting, question, etc.), return items=[], follow_up=null."""

    if image_b64 and media_type:
        user_content = [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
            {"type": "text", "text": text or "영수증 분석"},
        ]
    else:
        user_content = text or ""

    in_tok, out_tok = 0, 0
    try:
        client = _client()
        resp = client.messages.create(
            model=MODEL_PARSE,
            max_tokens=1500,
            system=system,
            messages=[{"role": "user", "content": user_content}],
        )
        in_tok, out_tok = _usage_from(resp)
        text_block = next((b.text for b in resp.content if b.type == "text"), "{}")
        raw_resp = json.loads(_strip_fence(text_block) or "{}")

        # 하위 호환: 옛 prompt 시절 응답이 bare list 일 수도 있음.
        if isinstance(raw_resp, list):
            raw_items = raw_resp
            follow_up = None
        elif isinstance(raw_resp, dict):
            raw_items = raw_resp.get("items") or []
            follow_up = raw_resp.get("follow_up") or None
            if not isinstance(raw_items, list):
                raw_items = []
        else:
            raw_items = []
            follow_up = None

        normalized = []
        dropped_for_missing_end = 0
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            cat = item.get("category")
            if cat not in ALLOWED_CATEGORIES:
                item["category"] = "기타"
            rec = item.get("recurrence") or "none"
            if rec not in ALLOWED_RECURRENCE:
                rec = "none"
            rec_day_raw = item.get("recurrence_day")
            try:
                rec_day = int(rec_day_raw) if rec_day_raw is not None else None
            except (TypeError, ValueError):
                rec_day = None
            # recurrence_until: ISO YYYY-MM-DD 만 인정
            rec_until_raw = item.get("recurrence_until")
            rec_until: str | None = None
            if rec_until_raw and re.match(r"^\d{4}-\d{2}-\d{2}$", str(rec_until_raw)):
                rec_until = str(rec_until_raw)
            amt = _to_int_amount(item.get("amount"))
            if amt <= 0:
                continue
            # 반복인데 종료일 없으면 drop — follow_up 으로 사용자에게 질문
            if rec != "none" and not rec_until:
                dropped_for_missing_end += 1
                continue
            normalized.append({
                "kind": "planned" if item.get("kind") == "planned" else "spent",
                "description": str(item.get("description", "")).strip()[:255],
                "amount": amt,
                "category": item["category"],
                "date": str(item.get("date") or today),
                "place_name": item.get("placeName") or None,
                "recurrence": rec,
                "recurrence_day": rec_day,
                "recurrence_until": rec_until,
            })

        # 반복인데 종료일 빠진 item 을 drop 했고, AI 가 follow_up 도 안 만들었으면
        # locale 기본 follow_up 으로 채움 (이중 안전망).
        if dropped_for_missing_end > 0 and not follow_up:
            follow_up = _MISSING_END_FOLLOWUP.get(
                user_locale, _MISSING_END_FOLLOWUP["en"]
            )

        # follow_up 정규화: 비어있는 문자열 → None
        if follow_up is not None:
            fu = str(follow_up).strip()
            follow_up = fu[:1200] if fu else None

        await _record_usage(
            user_id=user_id, kind="parse", model=MODEL_PARSE,
            input_tokens=in_tok, output_tokens=out_tok,
        )
        return {"items": normalized, "follow_up": follow_up}
    except Exception as e:
        logger.warning(f"parse_expense 실패: {e}")
        await _record_usage(
            user_id=user_id, kind="parse", model=MODEL_PARSE,
            input_tokens=in_tok, output_tokens=out_tok,
            status="error", error=str(e),
        )
        return {"items": [], "follow_up": None}


# 인사이트 prompt 의 톤 가이드 (locale 별 1~2 문장)
_INSIGHT_TONE_BY_LOCALE: dict[str, str] = {
    "ko": "너는 따뜻하고 통찰력 있는 재무 코치야. 한국어 반말로 짧고 임팩트있게.",
    "en": "You are a warm, insightful personal-finance coach. Use casual English, short and punchy.",
    "ja": "あなたは温かく洞察力のある家計コーチです。やわらかい日本語で短く印象的に。",
    "zh": "你是温暖且有洞察力的个人理财教练。用简洁有力的中文回答。",
    "es": "Eres un coach financiero cálido y perspicaz. Responde en español casual, breve y con impacto.",
    "th": "คุณคือโค้ชการเงินที่อบอุ่นและมีไหวพริบ ตอบสั้นและกระชับเป็นภาษาไทย",
    "vi": "Bạn là huấn luyện viên tài chính ấm áp và sâu sắc. Trả lời ngắn gọn bằng tiếng Việt.",
    "ms": "Anda ialah jurulatih kewangan peribadi yang mesra dan bijaksana. Jawab ringkas dalam bahasa Melayu.",
    "hi": "आप एक गर्मजोशी भरे और अंतर्दृष्टिपूर्ण वित्तीय कोच हैं। संक्षिप्त हिंदी में उत्तर दें।",
}


async def month_insight(
    month_key: str,
    current: dict,
    previous: dict,
    user_id: int | None = None,
    user_locale: str = "ko",
    currency_code: str = "KRW",
) -> dict:
    """월별 인사이트 생성. locale 별 톤·언어, 사용자 통화로 금액 표시."""
    def _fmt(by_cat: dict) -> str:
        return ", ".join(f"{k} {v:,} {currency_code}" for k, v in by_cat.items() if v > 0) or "-"

    tone = _INSIGHT_TONE_BY_LOCALE.get(user_locale, _INSIGHT_TONE_BY_LOCALE["ko"])
    prompt = f"""{tone}

[This month: {month_key}]
Total: {current.get('total', 0):,} {currency_code}
{_fmt(current.get('byCategory', {}))}

[Last month]
Total: {previous.get('total', 0):,} {currency_code}
{_fmt(previous.get('byCategory', {}))}

Respond JSON only (write all 4 string values in the user's language — locale {user_locale}):
{{"summary":"1-2 sentence overview","praise":"what went well","concern":"what to watch","suggestion":"next month's action"}}"""

    fallback = {"summary": "", "praise": "", "concern": "", "suggestion": ""}
    in_tok, out_tok = 0, 0
    try:
        client = _client()
        resp = client.messages.create(
            model=MODEL_INSIGHT,
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        in_tok, out_tok = _usage_from(resp)
        text_block = next((b.text for b in resp.content if b.type == "text"), "{}")
        result = json.loads(_strip_fence(text_block) or "{}") or fallback
        await _record_usage(
            user_id=user_id, kind="insight", model=MODEL_INSIGHT,
            input_tokens=in_tok, output_tokens=out_tok,
        )
        return result
    except Exception as e:
        logger.warning(f"month_insight 실패: {e}")
        await _record_usage(
            user_id=user_id, kind="insight", model=MODEL_INSIGHT,
            input_tokens=in_tok, output_tokens=out_tok,
            status="error", error=str(e),
        )
        return fallback
