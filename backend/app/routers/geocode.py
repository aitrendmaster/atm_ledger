"""Nominatim 지오코딩 프록시. 브라우저에서 직접 호출하지 않고 백엔드 경유 (UA, 캐시, 레이트리밋 통제).

사용자 위치(lat/lng) 가 전달되면 viewbox 로 주변 검색 우선. 결과는 최대 limit 개 반환.
폴백 좌표는 절대 부여하지 않는다 — 결과가 없으면 빈 배열을 그대로 돌려준다 (지도 핀 표시는 호출 측이 결정).
"""
from math import asin, cos, radians, sin, sqrt
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Query
from loguru import logger

from ..deps import get_current_user
from ..models.user import User

router = APIRouter(prefix="/geocode", tags=["geocode"])

NOMINATIM = "https://nominatim.openstreetmap.org/search"
UA = "moa-ai-ledger/1.0 (contact: master@aitrend.kr)"

# 사용자 위치 주변 검색 시 사용할 viewbox 반경 (도 단위). 위도 1도 ≈ 111km.
# 0.18 ≈ 약 ±20km 박스. 도시 단위 검색에 적합.
DEFAULT_VIEWBOX_DELTA = 0.18


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(a))


@router.get("")
async def search(
    q: str = Query(min_length=1, max_length=200),
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    limit: int = Query(default=5, ge=1, le=10),
    _: User = Depends(get_current_user),
):
    """장소 검색.

    - lat/lng 가 있으면 그 주변(viewbox bounded=1)에서 검색하고, 결과를 거리 순으로 정렬한다.
    - 없으면 일반 검색 (한국어 q + " 한국" 힌트). 검색 실패/결과 없음은 모두 빈 배열.
    - **자동 폴백 좌표 부여 금지** — 호출 측이 빈 배열을 받으면 "사용자가 직접 지정해 주세요" UX 로 전환.
    """
    params: dict[str, str | int] = {
        "q": q if lat is not None else f"{q} 한국",
        "format": "json",
        "limit": limit,
        "addressdetails": 1,
    }

    if lat is not None and lng is not None:
        # viewbox: left,top,right,bottom = west_lng, north_lat, east_lng, south_lat
        west = lng - DEFAULT_VIEWBOX_DELTA
        east = lng + DEFAULT_VIEWBOX_DELTA
        north = lat + DEFAULT_VIEWBOX_DELTA
        south = lat - DEFAULT_VIEWBOX_DELTA
        params["viewbox"] = f"{west},{north},{east},{south}"
        params["bounded"] = 1

    url = f"{NOMINATIM}?{urlencode(params, safe=',')}"

    try:
        async with httpx.AsyncClient(timeout=8.0, headers={"User-Agent": UA}) as cli:
            r = await cli.get(url)
            data = r.json() or []
    except Exception:
        logger.exception(f"Nominatim 호출 실패 q={q!r} lat={lat} lng={lng}")
        return {"results": [], "user_lat": lat, "user_lng": lng}

    results = []
    for item in data:
        try:
            lat_v = float(item["lat"])
            lng_v = float(item["lon"])
        except (KeyError, ValueError, TypeError):
            continue
        addr = item.get("display_name")
        name = (item.get("namedetails") or {}).get("name") or item.get("name") or addr
        entry: dict[str, object] = {
            "name": name,
            "lat": lat_v,
            "lng": lng_v,
            "address": addr,
            "type": item.get("type"),
        }
        if lat is not None and lng is not None:
            entry["distance_km"] = round(_haversine_km(lat, lng, lat_v, lng_v), 2)
        results.append(entry)

    # 사용자 좌표가 있으면 가까운 순. 없으면 Nominatim 자체 랭킹 유지.
    if lat is not None and lng is not None:
        results.sort(key=lambda x: x.get("distance_km", 9999))

    return {"results": results, "user_lat": lat, "user_lng": lng}
