"""예정 지출 / 반복 지출 라우터.

반복 규칙 (recurrence!='none') 은 한 행으로 DB 에 저장하고, ?month=YYYY-MM 으로 조회 시
backend 가 그 달의 가상 occurrence (is_recurring_instance=True) 를 자동 생성해서 반환한다.

가상 occurrence 의 id 는 음수 (원본 row id 의 -base) 로 부여 — 프론트가 "원본인지 가상인지"
구분 가능. 가상 occurrence 의 수정/삭제는 원본 row 를 통해야 함.
"""
from calendar import monthrange
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_current_user
from ..models.planned import Planned
from ..models.user import User
from ..schemas.planned import PlannedCreate, PlannedOut, PlannedUpdate

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


@router.get("", response_model=list[PlannedOut])
async def list_planned(
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    include_rules: bool = Query(default=False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """예정 지출 목록.

    - 기본: 모든 행 반환 (legacy 호환). 반복 행도 원본 1개씩만.
    - `?month=YYYY-MM`: 그 달에 해당하는 일회성 + 모든 반복 occurrence (가상) 반환.
    - `?include_rules=1`: 반복 규칙 마스터 (recurrence!='none') 만 반환. RecurringExpenses 페이지용.
    """
    res = await db.execute(
        select(Planned).where(Planned.user_id == user.id).order_by(Planned.date.asc())
    )
    rows = list(res.scalars().all())

    if include_rules:
        return [_to_out(p) for p in rows if p.recurrence != "none"]

    if not month:
        return [_to_out(p) for p in rows]

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
    user: User = Depends(get_current_user),
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
    user: User = Depends(get_current_user),
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
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Planned).where(Planned.id == planned_id, Planned.user_id == user.id))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return _to_out(p)


@router.delete("/{planned_id}", status_code=204)
async def delete_planned(
    planned_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Planned).where(Planned.id == planned_id, Planned.user_id == user.id))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="not found")
    await db.delete(p)
    await db.commit()
