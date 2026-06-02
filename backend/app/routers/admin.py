import csv
import io
import json
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..deps import get_admin_user
from ..models.admin_audit import AdminAudit
from ..models.ai_usage import AIUsage
from ..models.announcement import Announcement
from ..models.entry import Entry, EntryPhoto
from ..models.planned import Planned
from ..models.reflection import Reflection
from ..models.user import User
from ..schemas.admin import (
    AdminActionResult,
    AdminAuditRow,
    AdminEntrySummary,
    AdminMeOut,
    AdminStats,
    AdminUserDetail,
    AdminUserRow,
    AIUsageBucket,
    AIUsageModelRow,
    AIUsageSummary,
    ResetPasswordIn,
    SetAdminIn,
)
from ..schemas.announcement import (
    AnnouncementCreate,
    AnnouncementOut,
    AnnouncementUpdate,
)
from ..security import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])

UserSort = Literal["created_at_desc", "created_at_asc", "email", "entries_desc"]


async def _audit(
    db: AsyncSession,
    admin: User,
    action: str,
    target: User | None = None,
    payload: dict | None = None,
) -> None:
    """관리자 액션 감사 로그 기록. 호출 측이 동일 트랜잭션 commit 시 함께 영속화."""
    db.add(
        AdminAudit(
            admin_id=admin.id,
            admin_email=admin.email,
            action=action,
            target_user_id=target.id if target else None,
            target_email=target.email if target else None,
            payload=json.dumps(payload, ensure_ascii=False) if payload else None,
        )
    )


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


# ---------- 기본 ----------


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


# ---------- 사용자 목록 (검색/정렬/필터) ----------


@router.get("/users", response_model=list[AdminUserRow])
async def admin_users(
    q: str | None = Query(default=None, max_length=120, description="이메일·닉네임 부분일치"),
    sort: UserSort = Query(default="created_at_desc"),
    has_data: bool = Query(default=False, description="True 면 entries 1건 이상인 회원만"),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    entries_count_col = func.count(func.distinct(Entry.id)).label("entries_count")
    stmt = (
        select(
            User,
            entries_count_col,
            func.count(func.distinct(Planned.id)).label("planned_count"),
            func.count(func.distinct(Reflection.id)).label("reflections_count"),
        )
        .outerjoin(Entry, Entry.user_id == User.id)
        .outerjoin(Planned, Planned.user_id == User.id)
        .outerjoin(Reflection, Reflection.user_id == User.id)
        .where(User.deleted_at.is_(None))
        .group_by(User.id)
    )

    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(func.lower(User.email).like(like), func.lower(User.display_name).like(like))
        )

    if has_data:
        stmt = stmt.having(entries_count_col > 0)

    if sort == "created_at_desc":
        stmt = stmt.order_by(User.created_at.desc())
    elif sort == "created_at_asc":
        stmt = stmt.order_by(User.created_at.asc())
    elif sort == "email":
        stmt = stmt.order_by(User.email.asc())
    elif sort == "entries_desc":
        stmt = stmt.order_by(desc(entries_count_col), User.created_at.desc())

    stmt = stmt.limit(limit).offset(offset)

    rows = (await db.execute(stmt)).all()
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


# ---------- 회원 상세 ----------


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def admin_user_detail(
    user_id: int = Path(..., ge=1),
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(User).where(User.id == user_id))
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="user not found")

    entries_count = (
        await db.execute(select(func.count(Entry.id)).where(Entry.user_id == user_id))
    ).scalar_one()
    planned_count = (
        await db.execute(select(func.count(Planned.id)).where(Planned.user_id == user_id))
    ).scalar_one()
    reflections_count = (
        await db.execute(
            select(func.count(Reflection.id)).where(Reflection.user_id == user_id)
        )
    ).scalar_one()
    photos_count = (
        await db.execute(
            select(func.count(EntryPhoto.id))
            .join(Entry, EntryPhoto.entry_id == Entry.id)
            .where(Entry.user_id == user_id)
        )
    ).scalar_one()
    amount_total = (
        await db.execute(
            select(func.coalesce(func.sum(Entry.amount), 0)).where(Entry.user_id == user_id)
        )
    ).scalar_one()
    by_cat_rows = (
        await db.execute(
            select(Entry.category, func.sum(Entry.amount))
            .where(Entry.user_id == user_id)
            .group_by(Entry.category)
        )
    ).all()
    by_category = {cat: int(total or 0) for cat, total in by_cat_rows}

    recent_rows = (
        await db.execute(
            select(Entry)
            .where(Entry.user_id == user_id)
            .order_by(Entry.created_at.desc())
            .limit(10)
        )
    ).scalars().all()
    recent_entries = [
        AdminEntrySummary(
            id=e.id,
            description=e.description,
            amount=e.amount,
            category=e.category,
            date=e.date,
            place_name=e.place_name,
        )
        for e in recent_rows
    ]

    return AdminUserDetail(
        id=u.id,
        email=u.email,
        display_name=u.display_name,
        monthly_income=u.monthly_income,
        monthly_budget=u.monthly_budget,
        is_admin=bool(u.is_admin),
        auth_provider=u.auth_provider,
        created_at=u.created_at,
        deleted_at=u.deleted_at,
        entries_count=int(entries_count or 0),
        planned_count=int(planned_count or 0),
        reflections_count=int(reflections_count or 0),
        photos_count=int(photos_count or 0),
        entries_amount_total=int(amount_total or 0),
        entries_by_category=by_category,
        recent_entries=recent_entries,
    )


# ---------- 액션 ----------


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
    await _audit(db, me, "reset_password", target=target)
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

    if target.id == me.id and body.is_admin is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신의 admin 권한은 해제할 수 없습니다.",
        )

    if body.is_admin is False and target.is_admin:
        active_admins = await _count_active_admins(db)
        if active_admins <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="마지막 남은 admin 입니다. 다른 사용자에게 권한을 부여한 뒤 해제하세요.",
            )

    prev_value = bool(target.is_admin)
    target.is_admin = body.is_admin
    await _audit(
        db,
        me,
        "set_admin",
        target=target,
        payload={"from": prev_value, "to": body.is_admin},
    )
    await db.commit()
    logger.info(
        f"admin_set_admin by={me.email} target={target.email} is_admin={body.is_admin}"
    )
    return AdminActionResult(
        ok=True, message=f"{target.email} → admin={body.is_admin}"
    )


@router.delete("/users/{user_id}", response_model=AdminActionResult)
async def admin_soft_delete(
    user_id: int = Path(..., ge=1),
    me: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _load_target(db, user_id)

    if target.id == me.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신은 삭제할 수 없습니다.",
        )

    if target.is_admin:
        active_admins = await _count_active_admins(db)
        if active_admins <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="마지막 남은 admin 입니다. 다른 사용자에게 권한을 부여한 뒤 삭제하세요.",
            )

    target.deleted_at = datetime.now(timezone.utc)
    target.is_admin = False
    await _audit(db, me, "soft_delete", target=target)
    await db.commit()
    logger.info(f"admin_soft_delete by={me.email} target={target.email}")
    return AdminActionResult(ok=True, message=f"{target.email} 비활성화 완료 (soft delete)")


# ---------- GDPR: Hard delete + 사용자 데이터 익스포트 ----------


async def _build_user_export(db: AsyncSession, target: User) -> dict:
    """Right to data portability (GDPR Art. 20). 사용자의 모든 도메인 데이터를 JSON 객체로 반환."""
    entries = (
        await db.execute(
            select(Entry).where(Entry.user_id == target.id).order_by(Entry.date.desc())
        )
    ).scalars().all()
    entry_ids = [e.id for e in entries]
    photos = (
        (
            await db.execute(
                select(EntryPhoto).where(EntryPhoto.entry_id.in_(entry_ids))
            )
        ).scalars().all()
        if entry_ids
        else []
    )
    planned = (
        await db.execute(
            select(Planned).where(Planned.user_id == target.id).order_by(Planned.date.desc())
        )
    ).scalars().all()
    reflections = (
        await db.execute(
            select(Reflection)
            .where(Reflection.user_id == target.id)
            .order_by(Reflection.month.desc())
        )
    ).scalars().all()

    def _entry(e: Entry) -> dict:
        return {
            "id": e.id,
            "description": e.description,
            "amount": e.amount,
            "category": e.category,
            "date": e.date,
            "place_name": e.place_name,
            "place_lat": e.place_lat,
            "place_lng": e.place_lng,
            "place_address": e.place_address,
            "rating": e.rating,
            "review": e.review,
            "mood": e.mood,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }

    return {
        "schema": "moa-ai-user-export/1",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": {
            "id": target.id,
            "email": target.email,
            "display_name": target.display_name,
            "auth_provider": target.auth_provider,
            "monthly_income": target.monthly_income,
            "monthly_budget": target.monthly_budget,
            "is_admin": bool(target.is_admin),
            "created_at": target.created_at.isoformat() if target.created_at else None,
            "deleted_at": target.deleted_at.isoformat() if target.deleted_at else None,
        },
        "entries": [_entry(e) for e in entries],
        "entry_photos": [
            {"id": p.id, "entry_id": p.entry_id, "url": p.url, "created_at": p.created_at.isoformat() if p.created_at else None}
            for p in photos
        ],
        "planned": [
            {
                "id": p.id,
                "description": p.description,
                "amount": p.amount,
                "category": p.category,
                "date": p.date,
                "type": p.type,
                "note": p.note,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in planned
        ],
        "reflections": [
            {
                "id": r.id,
                "month": r.month,
                "type": r.type,
                "text": r.text,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in reflections
        ],
    }


@router.get("/users/{user_id}/export")
async def admin_user_export(
    user_id: int = Path(..., ge=1),
    me: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """GDPR Article 20 — 회원의 모든 도메인 데이터를 JSON 파일로 다운로드."""
    res = await db.execute(select(User).where(User.id == user_id))
    target = res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="user not found")

    bundle = await _build_user_export(db, target)
    await _audit(
        db,
        me,
        "user_export",
        target=target,
        payload={"entries": len(bundle["entries"]), "planned": len(bundle["planned"])},
    )
    await db.commit()

    body = json.dumps(bundle, ensure_ascii=False, indent=2)
    filename = f"moa-ai-user-{target.id}-{datetime.utcnow().strftime('%Y%m%d-%H%M')}.json"
    return StreamingResponse(
        iter([body]),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/users/{user_id}/hard", response_model=AdminActionResult)
async def admin_hard_delete(
    user_id: int = Path(..., ge=1),
    confirm: str = Query(..., description="확인 문구. 대상 이메일을 그대로 입력해야 통과"),
    me: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """GDPR Article 17 — 영구 삭제. entries/planned/reflections/photos 모두 cascade 삭제.

    안전 가드:
    - 자기 자신 삭제 금지
    - 마지막 admin 삭제 금지
    - confirm 쿼리에 대상 이메일을 정확히 입력해야 통과 (실수 방지)
    """
    res = await db.execute(select(User).where(User.id == user_id))
    target = res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="user not found")

    if target.id == me.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신은 영구 삭제할 수 없습니다.",
        )

    if confirm.strip().lower() != target.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="confirm 쿼리에 대상 이메일을 정확히 입력해야 합니다.",
        )

    if target.is_admin:
        active_admins = await _count_active_admins(db)
        if active_admins <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="마지막 남은 admin 입니다. 다른 사용자에게 권한을 부여한 뒤 삭제하세요.",
            )

    snapshot_email = target.email
    snapshot_id = target.id

    # 명시적 cascade: FK ondelete=CASCADE 가 SET 되어 있어 .delete(user) 만으로도
    # entries/planned/reflections + entry_photos(entry CASCADE) 가 정리된다.
    # admin_audit.target_user_id 는 SET NULL.
    await db.delete(target)
    await _audit(
        db,
        me,
        "hard_delete",
        target=None,
        payload={"email": snapshot_email, "user_id": snapshot_id},
    )
    await db.commit()
    logger.warning(f"admin_hard_delete by={me.email} target={snapshot_email}")
    return AdminActionResult(
        ok=True, message=f"{snapshot_email} 영구 삭제 완료 (GDPR Art.17)"
    )


# ---------- 봇/미인증 계정 일괄 정리 ----------


@router.post("/cleanup-unverified")
async def admin_cleanup_unverified(
    days: int = Query(default=7, ge=1, le=365, description="가입 후 N일 경과한 미인증 계정만 대상"),
    dry_run: bool = Query(default=True, description="True 면 삭제하지 않고 대상 개수·샘플만 반환"),
    me: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """봇 추정 미인증 계정을 안전하게 일괄 하드삭제.

    대상 조건(모두 충족):
      - email_verified = False  (인증 안 됨 → 로그인 불가 = 활동 0)
      - auth_provider = 'password'  (Google 가입은 자동 인증되므로 제외)
      - created_at < now - days  (최근 가입자는 보호)
      - deleted_at IS NULL
    안전장치:
      - dry_run 기본 True — 먼저 개수/샘플 확인 후 dry_run=false 로 실제 삭제.
      - entries 가 1건이라도 있으면 제외(이론상 없지만 방어).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    entries_subq = (
        select(func.count(Entry.id)).where(Entry.user_id == User.id).scalar_subquery()
    )
    stmt = (
        select(User)
        .where(
            User.email_verified.is_(False),
            User.auth_provider == "password",
            User.deleted_at.is_(None),
            User.created_at < cutoff,
            User.is_admin.is_(False),
            entries_subq == 0,
        )
        .order_by(User.created_at.asc())
    )
    targets = (await db.execute(stmt)).scalars().all()
    count = len(targets)
    sample = [t.email for t in targets[:20]]

    if dry_run:
        return {
            "dry_run": True,
            "days": days,
            "would_delete": count,
            "sample": sample,
            "message": f"미인증 {days}일 경과 계정 {count}건이 삭제 대상입니다. 실제 삭제하려면 dry_run=false 로 다시 호출하세요.",
        }

    deleted = 0
    for t in targets:
        await db.delete(t)
        deleted += 1
    await _audit(db, me, "cleanup_unverified", payload={"days": days, "deleted": deleted})
    await db.commit()
    logger.warning(f"admin_cleanup_unverified by={me.email} days={days} deleted={deleted}")
    return {"dry_run": False, "days": days, "deleted": deleted, "sample": sample}


# ---------- 감사 로그 ----------


@router.get("/audit", response_model=list[AdminAuditRow])
async def admin_audit_logs(
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    action: str | None = Query(default=None, max_length=40),
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AdminAudit).order_by(AdminAudit.created_at.desc())
    if action:
        stmt = stmt.where(AdminAudit.action == action)
    stmt = stmt.limit(limit).offset(offset)
    rows = (await db.execute(stmt)).scalars().all()
    return [
        AdminAuditRow(
            id=r.id,
            admin_email=r.admin_email,
            action=r.action,
            target_user_id=r.target_user_id,
            target_email=r.target_email,
            payload=r.payload,
            created_at=r.created_at,
        )
        for r in rows
    ]


# ---------- CSV export ----------


@router.get("/export/users.csv")
async def admin_export_users(
    me: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(
                User,
                func.count(func.distinct(Entry.id)).label("entries_count"),
                func.coalesce(func.sum(Entry.amount), 0).label("entries_amount"),
            )
            .outerjoin(Entry, Entry.user_id == User.id)
            .where(User.deleted_at.is_(None))
            .group_by(User.id)
            .order_by(User.created_at.asc())
        )
    ).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "id",
            "email",
            "display_name",
            "is_admin",
            "auth_provider",
            "monthly_income",
            "monthly_budget",
            "entries_count",
            "entries_amount_total",
            "created_at",
        ]
    )
    for u, ec, amt in rows:
        writer.writerow(
            [
                u.id,
                u.email,
                u.display_name or "",
                "TRUE" if u.is_admin else "FALSE",
                u.auth_provider,
                u.monthly_income,
                u.monthly_budget,
                int(ec or 0),
                int(amt or 0),
                u.created_at.isoformat() if u.created_at else "",
            ]
        )

    await _audit(db, me, "export_users_csv", payload={"rows": len(rows)})
    await db.commit()

    body = buffer.getvalue()
    filename = f"moa-ai-users-{datetime.utcnow().strftime('%Y%m%d-%H%M')}.csv"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
    }
    # BOM 추가로 엑셀 한글 깨짐 방지
    return StreamingResponse(
        iter(["﻿" + body]),
        media_type="text/csv; charset=utf-8",
        headers=headers,
    )


# ---------- 공지 (Announcements) ----------


@router.get("/announcements", response_model=list[AnnouncementOut])
async def admin_announcements_list(
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(select(Announcement).order_by(Announcement.created_at.desc()))
    ).scalars().all()
    return [AnnouncementOut.model_validate(r, from_attributes=True) for r in rows]


@router.post(
    "/announcements", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED
)
async def admin_announcement_create(
    body: AnnouncementCreate,
    me: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    row = Announcement(
        title=body.title,
        body=body.body,
        level=body.level,
        active=body.active,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        created_by_id=me.id,
        created_by_email=me.email,
    )
    db.add(row)
    await db.flush()
    await _audit(
        db,
        me,
        "announcement_create",
        payload={"id": row.id, "title": row.title, "level": row.level},
    )
    await db.commit()
    await db.refresh(row)
    return AnnouncementOut.model_validate(row, from_attributes=True)


@router.patch("/announcements/{announcement_id}", response_model=AnnouncementOut)
async def admin_announcement_update(
    body: AnnouncementUpdate,
    announcement_id: int = Path(..., ge=1),
    me: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Announcement).where(Announcement.id == announcement_id))
    row = res.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="announcement not found")

    patch = body.model_dump(exclude_unset=True)
    for k, v in patch.items():
        setattr(row, k, v)

    await _audit(
        db,
        me,
        "announcement_update",
        payload={"id": row.id, "changed": list(patch.keys())},
    )
    await db.commit()
    await db.refresh(row)
    return AnnouncementOut.model_validate(row, from_attributes=True)


@router.delete("/announcements/{announcement_id}", response_model=AdminActionResult)
async def admin_announcement_delete(
    announcement_id: int = Path(..., ge=1),
    me: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Announcement).where(Announcement.id == announcement_id))
    row = res.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="announcement not found")
    title = row.title
    await db.delete(row)
    await _audit(
        db,
        me,
        "announcement_delete",
        payload={"id": announcement_id, "title": title},
    )
    await db.commit()
    return AdminActionResult(ok=True, message=f"공지 삭제 완료: {title}")


# ---------- AI 사용량 ----------


async def _bucket(db: AsyncSession, label: str, since: datetime) -> AIUsageBucket:
    row = (
        await db.execute(
            select(
                func.count(AIUsage.id),
                func.coalesce(func.sum(AIUsage.input_tokens), 0),
                func.coalesce(func.sum(AIUsage.output_tokens), 0),
                func.coalesce(func.sum(AIUsage.estimated_cost_mc), 0),
                func.coalesce(
                    func.sum(
                        func.case((AIUsage.status == "error", 1), else_=0)
                        if hasattr(func, "case")
                        else 0
                    ),
                    0,
                ),
            ).where(AIUsage.created_at >= since)
        )
    ).one()
    calls, in_tok, out_tok, cost_mc, _ = row
    # Error count via simpler query (cross-DB safe).
    errors = (
        await db.execute(
            select(func.count(AIUsage.id)).where(
                AIUsage.created_at >= since, AIUsage.status == "error"
            )
        )
    ).scalar_one()
    return AIUsageBucket(
        label=label,
        calls=int(calls or 0),
        errors=int(errors or 0),
        input_tokens=int(in_tok or 0),
        output_tokens=int(out_tok or 0),
        estimated_cost_usd=round(int(cost_mc or 0) / 100000.0, 4),
    )


@router.get("/ai-usage/summary", response_model=AIUsageSummary)
async def admin_ai_usage_summary(
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    last7 = now - timedelta(days=7)
    last30 = now - timedelta(days=30)

    today_b = await _bucket(db, "today", today_start)
    week_b = await _bucket(db, "last_7d", last7)
    month_b = await _bucket(db, "last_30d", last30)

    by_model_rows = (
        await db.execute(
            select(
                AIUsage.model,
                func.count(AIUsage.id),
                func.coalesce(func.sum(AIUsage.input_tokens), 0),
                func.coalesce(func.sum(AIUsage.output_tokens), 0),
                func.coalesce(func.sum(AIUsage.estimated_cost_mc), 0),
            )
            .where(AIUsage.created_at >= last30)
            .group_by(AIUsage.model)
            .order_by(desc(func.count(AIUsage.id)))
        )
    ).all()
    by_model = [
        AIUsageModelRow(
            model=m,
            calls=int(c or 0),
            input_tokens=int(it or 0),
            output_tokens=int(ot or 0),
            estimated_cost_usd=round(int(cost or 0) / 100000.0, 4),
        )
        for m, c, it, ot, cost in by_model_rows
    ]

    recent_errors = (
        await db.execute(
            select(AIUsage.error)
            .where(AIUsage.status == "error")
            .where(AIUsage.error.isnot(None))
            .order_by(AIUsage.created_at.desc())
            .limit(5)
        )
    ).scalars().all()

    return AIUsageSummary(
        today=today_b,
        last_7d=week_b,
        last_30d=month_b,
        by_model=by_model,
        recent_errors=[e for e in recent_errors if e],
    )
