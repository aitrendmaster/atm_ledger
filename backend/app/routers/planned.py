"""예정 지출 / 반복 지출 라우터.

반복 규칙 (recurrence!='none') 은 한 행으로 DB 에 저장하고, 조회 시 backend 가 occurrence
(is_recurring_instance=True) 를 자동 생성해서 반환한다.

- `?month=YYYY-MM`: 그 달의 occurrence 만
- 파라미터 없음: 시작일 ~ 종료일 (또는 today+60개월 fallback) 사이 모든 월 expand
- `?include_rules=1`: 반복 규칙 마스터만 (반복지출 관리 페이지용)

가상 occurrence 는 원본 row 의 id 를 그대로 가지며 `is_recurring_instance=True` 로 표시.
수정/삭제는 원본 row 를 통해야 함.
"""
from calendar import monthrange
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_current_user, require_active_plan
from ..models.planned import Planned
from ..models.user import User
from ..schemas.planned import (
    PlannedCreate,
    PlannedOut,
    PlannedUpdate,
    validate_recurrence_state,
)

# 종료일이 없는 레거시 행 안전망 — 무한 expansion 방지.
_LEGACY_FALLBACK_MONTHS = 60
# 한 규칙당 최대 occurrence 수 (이상 데이터 방어; 정상 종료일 범위에서는 발생 안 함)
_HARD_CAP_PER_RULE = 600

router = APIRouter(prefix="/planned", tags=["planned"])


def _to_out(p: Planned, *, is_instance: bool = False, override_date: str | None = None) -> dict:
    return {
        "id": p.id,
        "description": p.description,
        "amount": p.amount,
        "category": p.category,
        "date": override_date or p.date,
        "type": p.type,
        "note": p.note,
        "recurrence": p.recurrence,
        "recurrence_day": p.recurrence_day,
        "recurrence_until": p.recurrence_until,
        "is_recurring_instance": is_instance,
    }


def _expand_recurring(p: Planned, year: int, month: int) -> list[dict]:
    """반복 규칙 p 를 주어진 (year, month) 안에서 가상 occurrence 로 전개.

    - monthly: recurrence_day 가 그 달에 유효하면 1개. 31 등 큰 값은 그 달 마지막 일로 clip.
    - weekly: recurrence_day(0=Mon..6=Sun) 인 모든 요일.
    - yearly: 원본 date 의 MM-DD 가 (year, month) 와 일치하면 1개.
    """
    out: list[dict] = []
    if p.recurrence == "none":
        return out

    # 시작일 (date) 보다 빠른 달은 제외
    try:
        start = date.fromisoformat(p.date)
    except ValueError:
        return out
    if (year, month) < (start.year, start.month):
        return out

    # 종료일 체크
    if p.recurrence_until:
        try:
            until = date.fromisoformat(p.recurrence_until)
            month_first = date(year, month, 1)
            if month_first > until:
                return out
        except ValueError:
            pass

    last_day = monthrange(year, month)[1]

    if p.recurrence == "monthly":
        day = p.recurrence_day or start.day
        actual_day = min(day, last_day)  # 31일 매월 + 2월 → 28/29일
        occ = date(year, month, actual_day)
        if occ >= start and (not p.recurrence_until or occ <= date.fromisoformat(p.recurrence_until)):
            out.append(_to_out(p, is_instance=True, override_date=occ.isoformat()))

    elif p.recurrence == "weekly":
        target_weekday = p.recurrence_day if p.recurrence_day is not None else start.weekday()
        for d in range(1, last_day + 1):
            occ = date(year, month, d)
            if occ.weekday() == target_weekday and occ >= start:
                if p.recurrence_until and occ > date.fromisoformat(p.recurrence_until):
                    continue
                out.append(_to_out(p, is_instance=True, override_date=occ.isoformat()))

    elif p.recurrence == "yearly":
        if start.month == month:
            actual_day = min(start.day, last_day)
            occ = date(year, month, actual_day)
            if occ >= start and (not p.recurrence_until or occ <= date.fromisoformat(p.recurrence_until)):
                out.append(_to_out(p, is_instance=True, override_date=occ.isoformat()))

    return out


def _expand_recurring_range(p: Planned) -> list[dict]:
    """반복 규칙 p 를 시작일 ~ 종료일 (또는 fallback) 사이 모든 월에 걸쳐 전개.

    종료일이 없는 레거시 행은 today + _LEGACY_FALLBACK_MONTHS 까지 (안전망).
    한 규칙당 _HARD_CAP_PER_RULE 개 초과 시 잘라내고 로깅.
    """
    if p.recurrence == "none":
        return []
    try:
        start = date.fromisoformat(p.date)
    except ValueError:
        return []

    end: date
    if p.recurrence_until:
        try:
            end = date.fromisoformat(p.recurrence_until)
        except ValueError:
            return []
    else:
        today = date.today()
        # today 와 start 중 더 늦은 쪽 기준으로 + N개월 (시작이 미래면 시작 기준)
        anchor = today if today > start else start
        fallback_year = anchor.year + (anchor.month - 1 + _LEGACY_FALLBACK_MONTHS) // 12
        fallback_month = (anchor.month - 1 + _LEGACY_FALLBACK_MONTHS) % 12 + 1
        end = date(fallback_year, fallback_month, monthrange(fallback_year, fallback_month)[1])

    if end < start:
        return []

    out: list[dict] = []
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        out.extend(_expand_recurring(p, year, month))
        if len(out) >= _HARD_CAP_PER_RULE:
            logger.warning(
                f"planned rule id={p.id} expansion exceeded hard cap "
                f"({_HARD_CAP_PER_RULE}); truncating."
            )
            return out[:_HARD_CAP_PER_RULE]
        # 다음 달
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1
    return out


@router.get("", response_model=list[PlannedOut])
async def list_planned(
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    include_rules: bool = Query(default=False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """예정 지출 목록.

    - 기본 (파라미터 없음): 일회성 행 + 반복 규칙의 시작일~종료일 사이 모든 occurrence 를
      전개해서 반환. 캘린더가 한 번에 모든 월을 표시할 수 있도록.
    - `?month=YYYY-MM`: 그 달에 해당하는 일회성 + 반복 occurrence (가상) 만 반환.
    - `?include_rules=1`: 반복 규칙 마스터 (recurrence!='none') 만 반환. RecurringExpenses 페이지용.
    """
    res = await db.execute(
        select(Planned).where(Planned.user_id == user.id).order_by(Planned.date.asc())
    )
    rows = list(res.scalars().all())

    if include_rules:
        return [_to_out(p) for p in rows if p.recurrence != "none"]

    if not month:
        # 자동 expansion 모드 — 일회성은 그대로, 반복은 시작일~종료일 모든 occurrence
        out: list[dict] = []
        for p in rows:
            if p.recurrence == "none":
                out.append(_to_out(p))
            else:
                out.extend(_expand_recurring_range(p))
        out.sort(key=lambda x: x["date"])
        return out

    year, mon = int(month[:4]), int(month[5:7])
    month_prefix = month  # "YYYY-MM"
    out: list[dict] = []
    for p in rows:
        if p.recurrence == "none":
            if p.date.startswith(month_prefix):
                out.append(_to_out(p))
        else:
            out.extend(_expand_recurring(p, year, mon))
    out.sort(key=lambda x: x["date"])
    return out


@router.post("", response_model=PlannedOut, status_code=201)
async def create_planned(
    body: PlannedCreate,
    user: User = Depends(require_active_plan),
    db: AsyncSession = Depends(get_db),
):
    p = Planned(user_id=user.id, **body.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return _to_out(p)


@router.post("/batch", response_model=list[PlannedOut], status_code=201)
async def create_planned_batch(
    body: list[PlannedCreate],
    user: User = Depends(require_active_plan),
    db: AsyncSession = Depends(get_db),
):
    """반복 지출 관리 페이지의 일괄 등록."""
    if not body:
        return []
    if len(body) > 100:
        raise HTTPException(status_code=400, detail="한 번에 최대 100건까지 등록 가능합니다.")
    items = [Planned(user_id=user.id, **p.model_dump()) for p in body]
    db.add_all(items)
    await db.commit()
    for it in items:
        await db.refresh(it)
    return [_to_out(p) for p in items]


@router.patch("/{planned_id}", response_model=PlannedOut)
async def update_planned(
    planned_id: int,
    body: PlannedUpdate,
    user: User = Depends(require_active_plan),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Planned).where(Planned.id == planned_id, Planned.user_id == user.id))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="not found")
    patch = body.model_dump(exclude_unset=True)
    for k, v in patch.items():
        setattr(p, k, v)
    # recurrence 가 'none' 으로 변경되면 종료일 의미 없음 — null 로 정리
    if p.recurrence == "none":
        p.recurrence_until = None
        p.recurrence_day = None
    # merged state 검증 (PATCH 는 부분 업데이트이므로 schema 단에서는 검증 불가)
    try:
        validate_recurrence_state(p.recurrence, p.recurrence_until, p.date)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    await db.commit()
    await db.refresh(p)
    return _to_out(p)


@router.delete("/{planned_id}", status_code=204)
async def delete_planned(
    planned_id: int,
    user: User = Depends(require_active_plan),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Planned).where(Planned.id == planned_id, Planned.user_id == user.id))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="not found")
    await db.delete(p)
    await db.commit()
