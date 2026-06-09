from fastapi import APIRouter, Depends

from ..deps import get_current_user, require_active_plan
from ..models.user import User
from ..schemas.ai import (
    InsightRequest,
    InsightResponse,
    ParseRequest,
    ParseResponse,
    ParsedItem,
)
from ..services import ai_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/parse", response_model=ParseResponse)
async def parse(body: ParseRequest, user: User = Depends(require_active_plan)):
    result = await ai_service.parse_expense(
        body.text,
        body.image.data if body.image else None,
        body.image.media_type if body.image else None,
        user_id=user.id,
        user_locale=user.locale or "ko",
    )
    return ParseResponse(
        items=[ParsedItem(**i) for i in result.get("items", [])],
        follow_up=result.get("follow_up"),
    )


@router.post("/insight", response_model=InsightResponse)
async def insight(body: InsightRequest, _: User = Depends(get_current_user)):
    # 실제 통계는 프론트에서 계산 후 보내는 게 더 단순. 여기서는 클라이언트 제공값을 신뢰.
    # 추후 backend 에서 직접 집계하도록 확장 가능.
    raise NotImplementedError("Use POST /ai/insight-from-stats instead")


@router.post("/insight-from-stats", response_model=InsightResponse)
async def insight_from_stats(
    payload: dict,
    user: User = Depends(require_active_plan),
):
    """클라이언트가 집계한 stats 를 받아 인사이트만 생성."""
    month = payload.get("month", "")
    current = payload.get("current", {"total": 0, "byCategory": {}})
    previous = payload.get("previous", {"total": 0, "byCategory": {}})
    out = await ai_service.month_insight(
        month,
        current,
        previous,
        user_id=user.id,
        user_locale=user.locale or "ko",
        currency_code=user.currency_code or "KRW",
    )
    return InsightResponse(**out)
