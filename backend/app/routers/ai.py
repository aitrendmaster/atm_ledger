from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..deps import get_current_user, is_admin, is_premium, require_active_plan
from ..models.ai_usage import AIUsage
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


async def _enforce_ai_quota(user: User, db: AsyncSession) -> None:
    """사용자별 AI 일일 호출 상한 초과 시 429. 관리자·한도 None 이면 무제한.

    한도 우선순위: User.ai_daily_limit → 전역 settings.ai_daily_call_limit → None(무제한).
    오늘(UTC) 성공/실패 모든 AIUsage 호출을 카운트(비용·폭주 방어).
    """
    if is_admin(user):
        return
    limit = user.ai_daily_limit
    if limit is None:
        limit = get_settings().ai_daily_call_limit
    if limit is None:
        return
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    used = (
        await db.execute(
            select(func.count(AIUsage.id)).where(
                AIUsage.user_id == user.id, AIUsage.created_at >= today_start
            )
        )
    ).scalar_one()
    if int(used or 0) >= int(limit):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"오늘 AI 사용 한도({limit}회)에 도달했어요. 내일 다시 이용해 주세요.",
        )


@router.post("/parse", response_model=ParseResponse)
async def parse(
    body: ParseRequest,
    user: User = Depends(require_active_plan),
    db: AsyncSession = Depends(get_db),
):
    await _enforce_ai_quota(user, db)
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
    db: AsyncSession = Depends(get_db),
):
    """클라이언트가 집계한 stats 를 받아 인사이트만 생성."""
    await _enforce_ai_quota(user, db)
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
    # 프리미엄 전환 후킹: 비프리미엄(무료·트라이얼)은 1단(요약)만, 2~4단은 서버에서 비움.
    # 클라 블러만이면 우회 가능하므로 반드시 서버에서 미포함.
    if not is_premium(user):
        return InsightResponse(
            summary=out.get("summary", ""),
            praise="",
            concern="",
            suggestion="",
            premium_required=True,
        )
    return InsightResponse(**out)
