"""Nominatim 지오코딩 프록시. 브라우저에서 직접 호출하지 않고 백엔드 경유 (UA, 캐시, 레이트리밋 통제)."""
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, Query

from ..deps import get_current_user
from ..models.user import User

router = APIRouter(prefix="/geocode", tags=["geocode"])

NOMINATIM = "https://nominatim.openstreetmap.org/search"
UA = "atm-ledger/1.0 (contact: admin@example.com)"


@router.get("")
async def search(
    q: str = Query(min_length=1, max_length=200),
    _: User = Depends(get_current_user),
):
    url = f"{NOMINATIM}?q={quote(q + ' 한국')}&format=json&limit=1"
    try:
        async with httpx.AsyncClient(timeout=8.0, headers={"User-Agent": UA}) as cli:
            r = await cli.get(url)
            data = r.json()
        if not data:
            return {"lat": None, "lng": None, "address": None}
        return {
            "lat": float(data[0]["lat"]),
            "lng": float(data[0]["lon"]),
            "address": data[0].get("display_name"),
        }
    except Exception:
        return {"lat": None, "lng": None, "address": None}
