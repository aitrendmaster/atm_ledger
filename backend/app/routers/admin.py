from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..deps import get_admin_user
from ..models.entry import Entry
from ..models.planned import Planned
from ..models.reflection import Reflection
from ..models.user import User
from ..schemas.admin import (
    AdminActionResult,
    AdminMeOut,
    AdminStats,
    AdminUserRow,
    ResetPasswordIn,
    SetAdminIn,
)
from ..security import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])


def _active_users():
    return select(User).where(User.deleted_at.is_(None))


async def _count_active_admins(db: AsyncSession) -> int:
    return (
        await db.execute(
            select(func.count(User.id)).where(
                User.is_admin.is_(True), User.deleted_at.is_(None)
            )
        )
    ).scalar_one()


async def _load_target(db: AsyncSession, user_id: int) -> User:
    res = await db.execute(select(User).where(User.id == user_id))
    target = res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    if target.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="user already deleted")
    return target


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
    users_total = (
        await db.execute(select(func.count(User.id)).where(User.deleted_at.is_(None)))
    ).scalar_one()
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
            select(func.count(User.id)).where(
                User.created_at >= seven_days_ago, User.deleted_at.is_(None)
            )
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
            .where(User.deleted_at.is_(None))
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
            is_admin=bool(u.is_admin),
            created_at=u.created_at,
            entries_count=int(ec or 0),
            planned_count=int(pc or 0),
            reflections_count=int(rc or 0),
        )
        for u, ec, pc, rc in rows
    ]


@router.post("/users/{user_id}/reset-password", response_model=AdminActionResult)
async def admin_reset_password(
    body: ResetPasswordIn,
    user_id: int = Path(..., ge=1),
    me: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _load_target(db, user_id)
    target.password_hash = hash_password(body.new_password)
    target.auth_provider = "password"
    await db.commit()
    logger.info(f"admin_reset_password by={me.email} target={target.email}")
    return AdminActionResult(ok=True, message=f"{target.email} 비밀번호 재설정 완료")


@router.patch("/users/{user_id}/admin", response_model=AdminActionResult)
async def admin_set_admin(
    body: SetAdminIn,
    user_id: int = Path(..., ge=1),
    me: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _load_target(db, user_id)

    # 가드: 자기 자신은 권한 해제 못 함
    if target.id == me.id and body.is_admin is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신의 admin 권한은 해제할 수 없습니다.",
        )

    # 가드: 마지막 남은 admin 은 해제 못 함
    if body.is_admin is False and target.is_admin:
        active_admins = await _count_active_admins(db)
        if active_admins <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="마지막 남은 admin 입니다. 다른 사용자에게 권한을 부여한 뒤 해제하세요.",
            )

    target.is_admin = body.is_admin
    await db.commit()
    logger.info(
        f"admin_set_admin by={me.email} target={target.email} is_admin={body.is_admin}"
    )
    return AdminActionResult(
        ok=True,
        message=f"{target.email} → admin={body.is_admin}",
    )


@router.delete("/users/{user_id}", response_model=AdminActionResult)
async def admin_soft_delete(
    user_id: int = Path(..., ge=1),
    me: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _load_target(db, user_id)

    # 가드: 자기 자신 삭제 금지
    if target.id == me.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신은 삭제할 수 없습니다.",
        )

    # 가드: 마지막 admin 삭제 금지
    if target.is_admin:
        active_admins = await _count_active_admins(db)
        if active_admins <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="마지막 남은 admin 입니다. 다른 사용자에게 권한을 부여한 뒤 삭제하세요.",
            )

    target.deleted_at = datetime.now(timezone.utc)
    target.is_admin = False  # 삭제와 동시에 권한 회수
    await db.commit()
    logger.info(f"admin_soft_delete by={me.email} target={target.email}")
    return AdminActionResult(ok=True, message=f"{target.email} 비활성화 완료 (soft delete)")
