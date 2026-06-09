"""장소-커뮤니티 런타임 연동 (best-effort).

신규 entry 가 장소를 가지면 canonical Place 로 매칭/생성하고 집계를 갱신한다.
백필 마이그레이션(b2e4f6a80a02)과 동일한 dedup 기준(좌표 round4 / 이름)을 쓴다.
실패해도 entry 저장은 막지 않는다(호출 측 try/except).

주의: 현재는 entry CREATE 시점만 연동. PATCH 로 나중에 추가된 rating/review 는
집계에 반영되지 않는다(예비 범위). 필요 시 admin recompute 로 재계산.
"""
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.entry import Entry
from ..models.place import Place, PlaceReview

# 좌표 매칭 허용 오차 (≈ round(4) 수준, 약 5m).
_COORD_EPS = 5e-5


async def _find_place(db: AsyncSession, entry: Entry) -> Place | None:
    if entry.place_lat is not None and entry.place_lng is not None:
        lat, lng = float(entry.place_lat), float(entry.place_lng)
        res = await db.execute(
            select(Place).where(
                Place.lat.is_not(None),
                Place.lng.is_not(None),
                Place.lat >= lat - _COORD_EPS,
                Place.lat <= lat + _COORD_EPS,
                Place.lng >= lng - _COORD_EPS,
                Place.lng <= lng + _COORD_EPS,
            ).limit(1)
        )
        return res.scalar_one_or_none()
    name = (entry.place_name or "").strip()
    if not name:
        return None
    res = await db.execute(
        select(Place).where(
            Place.lat.is_(None), func.lower(Place.name) == name.lower()
        ).limit(1)
    )
    return res.scalar_one_or_none()


async def link_entry_to_place(db: AsyncSession, entry: Entry) -> None:
    """entry 의 장소를 Place 로 매칭/생성하고 place_id·집계 갱신. 자체 commit."""
    if not entry.place_name or not entry.place_name.strip():
        return
    place = await _find_place(db, entry)
    if place is None:
        place = Place(
            name=entry.place_name.strip()[:200],
            lat=entry.place_lat,
            lng=entry.place_lng,
            address=entry.place_address,
            category=entry.category,
            review_count=0,
            rating_sum=0,
            visit_count=0,
        )
        db.add(place)
        await db.flush()  # place.id 확보

    place.visit_count = (place.visit_count or 0) + 1
    entry.place_id = place.id

    has_review = entry.rating is not None or bool(entry.review and entry.review.strip())
    if has_review:
        db.add(PlaceReview(
            place_id=place.id,
            user_id=entry.user_id,
            entry_id=entry.id,
            rating=entry.rating,
            body=entry.review,
            mood=entry.mood,
            visibility="private",
            status="visible",
        ))
        place.review_count = (place.review_count or 0) + 1
        if entry.rating is not None:
            place.rating_sum = (place.rating_sum or 0) + int(entry.rating)

    await db.commit()
