from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_current_user
from ..models.planned import Planned
from ..models.user import User
from ..schemas.planned import PlannedCreate, PlannedOut, PlannedUpdate

router = APIRouter(prefix="/planned", tags=["planned"])


@router.get("", response_model=list[PlannedOut])
async def list_planned(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Planned).where(Planned.user_id == user.id).order_by(Planned.date.asc())
    )
    return list(res.scalars().all())


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
    return p


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
    return p


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
