from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..deps import get_admin_user, is_admin_email
from ..models.entry import Entry
from ..models.planned import Planned
from ..models.reflection import Reflection
from ..models.user import User
from ..schemas.admin import AdminMeOut, AdminStats, AdminUserRow

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/me", response_model=AdminMeOut)
async def admin_me(user: User = Depends(get_admin_user)):
    return AdminMeOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        is_admin=True,
        support_email=get_settings().support_email,
    )


@router.get("/stats", response_model=AdminStats)
async def admin_stats(
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    users_total = (await db.execute(select(func.count(User.id)))).scalar_one()
    entries_total = (await db.execute(select(func.count(Entry.id)))).scalar_one()
    planned_total = (await db.execute(select(func.count(Planned.id)))).scalar_one()
    refl_total = (await db.execute(select(func.count(Reflection.id)))).scalar_one()

    amount_total = (
        await db.execute(select(func.coalesce(func.sum(Entry.amount), 0)))
    ).scalar_one()

    by_cat_rows = (
        await db.execute(
            select(Entry.category, func.sum(Entry.amount)).group_by(Entry.category)
        )
    ).all()
    by_category = {cat: int(total or 0) for cat, total in by_cat_rows}

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_signups = (
        await db.execute(
            select(func.count(User.id)).where(User.created_at >= seven_days_ago)
        )
    ).scalar_one()

    return AdminStats(
        users_total=users_total,
        entries_total=entries_total,
        planned_total=planned_total,
        reflections_total=refl_total,
        entries_amount_total=int(amount_total or 0),
        entries_by_category=by_category,
        recent_signups_7d=recent_signups,
    )


@router.get("/users", response_model=list[AdminUserRow])
async def admin_users(
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(
                User,
                func.count(func.distinct(Entry.id)).label("entries_count"),
                func.count(func.distinct(Planned.id)).label("planned_count"),
                func.count(func.distinct(Reflection.id)).label("reflections_count"),
            )
            .outerjoin(Entry, Entry.user_id == User.id)
            .outerjoin(Planned, Planned.user_id == User.id)
            .outerjoin(Reflection, Reflection.user_id == User.id)
            .group_by(User.id)
            .order_by(User.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()

    return [
        AdminUserRow(
            id=u.id,
            email=u.email,
            display_name=u.display_name,
            monthly_income=u.monthly_income,
            monthly_budget=u.monthly_budget,
            created_at=u.created_at,
            entries_count=int(ec or 0),
            planned_count=int(pc or 0),
            reflections_count=int(rc or 0),
        )
        for u, ec, pc, rc in rows
    ]
