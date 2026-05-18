"""사용자 데이터 JSON 익스포트 헬퍼 — GDPR Art.20 portability.

admin 의 /admin/users/{id}/export 와 본인 /auth/me/export 양쪽에서 재사용.
"""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.entry import Entry, EntryPhoto
from ..models.planned import Planned
from ..models.reflection import Reflection
from ..models.user import User


async def build_user_export(db: AsyncSession, target: User) -> dict:
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
            {
                "id": p.id,
                "entry_id": p.entry_id,
                "url": p.url,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
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
