from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_current_user, require_active_plan
from ..models.entry import Entry
from ..models.user import User
from ..schemas.entry import EntryCreate, EntryOut, EntryUpdate
from ..services.notifier import maybe_notify_budget_exceeded

router = APIRouter(prefix="/entries", tags=["entries"])


@router.get("", response_model=list[EntryOut])
async def list_entries(
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Entry).where(Entry.user_id == user.id)
    if month:
        stmt = stmt.where(Entry.date.like(f"{month}-%"))
    stmt = stmt.order_by(Entry.date.desc(), Entry.id.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("", response_model=EntryOut, status_code=201)
async def create_entry(
    body: EntryCreate,
    user: User = Depends(require_active_plan),
    db: AsyncSession = Depends(get_db),
):
    entry = Entry(user_id=user.id, **body.model_dump())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    # 이번 달 누적 지출이 예산을 처음 돌파하면 1회 푸시 알림 (FCM 미설정/토큰 없으면 no-op)
    try:
        await maybe_notify_budget_exceeded(db, user.id)
    except Exception:
        logger.exception("[entries] 예산 초과 알림 트리거 실패 — entry 저장은 정상")
    return entry


@router.patch("/{entry_id}", response_model=EntryOut)
async def update_entry(
    entry_id: int,
    body: EntryUpdate,
    user: User = Depends(require_active_plan),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Entry).where(Entry.id == entry_id, Entry.user_id == user.id))
    entry = res.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
async def delete_entry(
    entry_id: int,
    user: User = Depends(require_active_plan),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Entry).where(Entry.id == entry_id, Entry.user_id == user.id))
    entry = res.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="not found")
    await db.delete(entry)
    await db.commit()
