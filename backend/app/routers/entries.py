from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_current_user
from ..models.entry import Entry
from ..models.user import User
from ..schemas.entry import EntryCreate, EntryOut, EntryUpdate

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
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entry = Entry(user_id=user.id, **body.model_dump())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.patch("/{entry_id}", response_model=EntryOut)
async def update_entry(
    entry_id: int,
    body: EntryUpdate,
    user: User = Depends(get_current_user),
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
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Entry).where(Entry.id == entry_id, Entry.user_id == user.id))
    entry = res.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="not found")
    await db.delete(entry)
    await db.commit()
