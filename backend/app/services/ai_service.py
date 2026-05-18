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


async def parse_expense(
    text: str | None,
    image_b64: str | None,
    media_type: str | None,
    user_id: int | None = None,
) -> list[dict]:
    """자유 텍스트/영수증 이미지를 가계부 항목으로 파싱."""
    today = _date.today().isoformat()
    system = f"""너는 한국어 가계부 분류기야. JSON으로만 답해.
종류: spent (이미 쓴 지출), planned (예정 지출)
카테고리: {', '.join(ALLOWED_CATEGORIES)}
응답: [{{"kind":"spent"|"planned","description":"...","amount":숫자,"category":"...","date":"YYYY-MM-DD","placeName":"상호명 또는 null"}}]
오늘: {today}. 모호하면 []."""

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


async def month_insight(
    month_key: str, current: dict, previous: dict, user_id: int | None = None
) -> dict:
    """월별 인사이트 생성."""
    def _fmt(by_cat: dict) -> str:
        return ", ".join(f"{k} {v:,}원" for k, v in by_cat.items() if v > 0) or "기록 없음"

    prompt = f"""너는 따뜻하고 통찰력 있는 재무 코치야. 한국어 반말로 짧고 임팩트있게.

[이번 달: {month_key}]
총: {current.get('total', 0):,}원
{_fmt(current.get('byCategory', {}))}

[지난 달]
총: {previous.get('total', 0):,}원
{_fmt(previous.get('byCategory', {}))}

JSON만:
{{"summary":"한두 문장","praise":"잘한 점","concern":"주의할 점","suggestion":"다음달 행동 제안"}}"""

    fallback = {"summary": "인사이트를 가져오지 못했어.", "praise": "", "concern": "", "suggestion": ""}
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
