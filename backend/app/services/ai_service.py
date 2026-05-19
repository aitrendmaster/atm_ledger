"""Claude API 프록시. 프론트에서 직접 호출하지 않고 백엔드 경유.

호출마다 AIUsage 행을 비동기 기록(별도 세션)해 admin 대시보드의 사용량/비용 위젯에 반영한다.
가격은 모델별 PRICING_MC_PER_TOKEN 에 정의 — millicent 단위(1/1000 cent)로 저장.
"""
import json
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
    "건강/뷰티", "여행/이벤트", "경조사/선물", "기타",
}

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


async def parse_expense(
    text: str | None,
    image_b64: str | None,
    media_type: str | None,
    user_id: int | None = None,
    user_locale: str = "ko",
) -> list[dict]:
    """자유 텍스트/영수증 이미지를 가계부 항목으로 파싱.

    user_locale: 응답 description 의 언어 힌트. 카테고리는 ALLOWED_CATEGORIES(한국어) 고정.
    """
    today = _date.today().isoformat()
    intro = _PARSE_SYSTEM_BY_LOCALE.get(user_locale, _PARSE_SYSTEM_BY_LOCALE["ko"])
    system = f"""{intro}
kind: spent (already spent) | planned (will spend)
category (must be one of these Korean keys): {', '.join(ALLOWED_CATEGORIES)}
Response format: [{{"kind":"spent"|"planned","description":"...","amount":<number>,"category":"<Korean key>","date":"YYYY-MM-DD","placeName":"<name or null>"}}]
The "description" field should be in the user's language (locale: {user_locale}); keep "category" as the Korean key from the list above.
Today: {today}. If ambiguous, respond []."""

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
            max_tokens=1000,
            system=system,
            messages=[{"role": "user", "content": user_content}],
        )
        in_tok, out_tok = _usage_from(resp)
        text_block = next((b.text for b in resp.content if b.type == "text"), "[]")
        raw = json.loads(_strip_fence(text_block) or "[]")
        if not isinstance(raw, list):
            await _record_usage(
                user_id=user_id, kind="parse", model=MODEL_PARSE,
                input_tokens=in_tok, output_tokens=out_tok,
            )
            return []
        normalized = []
        for item in raw:
            cat = item.get("category")
            if cat not in ALLOWED_CATEGORIES:
                item["category"] = "기타"
            normalized.append({
                "kind": "planned" if item.get("kind") == "planned" else "spent",
                "description": str(item.get("description", "")).strip()[:255],
                "amount": int(item.get("amount", 0)),
                "category": item["category"],
                "date": str(item.get("date") or today),
                "place_name": item.get("placeName") or None,
            })
        await _record_usage(
            user_id=user_id, kind="parse", model=MODEL_PARSE,
            input_tokens=in_tok, output_tokens=out_tok,
        )
        return normalized
    except Exception as e:
        logger.warning(f"parse_expense 실패: {e}")
        await _record_usage(
            user_id=user_id, kind="parse", model=MODEL_PARSE,
            input_tokens=in_tok, output_tokens=out_tok,
            status="error", error=str(e),
        )
        return []


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
