from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_current_user, require_active_plan
from ..models.entry import Entry, EntryPhoto
from ..models.user import User
from ..schemas.entry import PhotoOut
from ..services.storage import get_storage

router = APIRouter(prefix="/entries", tags=["photos"])

MAX_BYTES = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


@router.post("/{entry_id}/photos", response_model=PhotoOut, status_code=201)
async def upload_photo(
    entry_id: int,
    file: UploadFile = File(...),
    user: User = Depends(require_active_plan),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Entry).where(Entry.id == entry_id, Entry.user_id == user.id))
    entry = res.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="entry not found")
    ct = (file.content_type or "").lower()
    if ct not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail=f"unsupported type: {ct}")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="file too large (max 10MB)")
    storage = get_storage()
    url = await storage.put(data, ct, prefix=f"u{user.id}")
    photo = EntryPhoto(entry_id=entry.id, url=url)
    db.add(photo)
    await db.commit()
    await db.refresh(photo)
    return photo


@router.delete("/{entry_id}/photos/{photo_id}", status_code=204)
async def delete_photo(
    entry_id: int,
    photo_id: int,
    user: User = Depends(require_active_plan),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(EntryPhoto)
        .join(Entry, Entry.id == EntryPhoto.entry_id)
        .where(EntryPhoto.id == photo_id, Entry.id == entry_id, Entry.user_id == user.id)
    )
    photo = res.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="not found")
    await db.delete(photo)
    await db.commit()
