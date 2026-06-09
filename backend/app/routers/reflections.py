from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_current_user, require_active_plan
from ..models.reflection import Reflection
from ..models.user import User
from ..schemas.reflection import ReflectionCreate, ReflectionOut

router = APIRouter(prefix="/reflections", tags=["reflections"])


@router.get("", response_model=list[ReflectionOut])
async def list_reflections(
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Reflection).where(Reflection.user_id == user.id)
    if month:
        stmt = stmt.where(Reflection.month == month)
    stmt = stmt.order_by(Reflection.created_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("", response_model=ReflectionOut, status_code=201)
async def create_reflection(
    body: ReflectionCreate,
    user: User = Depends(require_active_plan),
    db: AsyncSession = Depends(get_db),
):
    r = Reflection(user_id=user.id, **body.model_dump())
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return r


@router.delete("/{reflection_id}", status_code=204)
async def delete_reflection(
    reflection_id: int,
    user: User = Depends(require_active_plan),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Reflection).where(Reflection.id == reflection_id, Reflection.user_id == user.id)
    )
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="not found")
    await db.delete(r)
    await db.commit()
