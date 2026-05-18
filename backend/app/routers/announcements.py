"""공개 + 운영 공지 라우터.

공개: GET /announcements/active — Landing/Ledger 상단 배너용. 인증 불필요.
운영: /admin/announcements/* — admin 전용 CRUD (어드민 라우터에 별도 마운트).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.announcement import Announcement
from ..schemas.announcement import AnnouncementOut

router = APIRouter(prefix="/announcements", tags=["announcements"])


@router.get("/active", response_model=list[AnnouncementOut])
async def list_active(db: AsyncSession = Depends(get_db)):
    """현재 노출되어야 할 공지. active=True 이면서 시간 범위 충족."""
    now = datetime.now(timezone.utc)
    stmt = (
        select(Announcement)
        .where(Announcement.active.is_(True))
        .where(or_(Announcement.starts_at.is_(None), Announcement.starts_at <= now))
        .where(or_(Announcement.ends_at.is_(None), Announcement.ends_at > now))
        .order_by(Announcement.created_at.desc())
        .limit(5)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [AnnouncementOut.model_validate(r, from_attributes=True) for r in rows]
