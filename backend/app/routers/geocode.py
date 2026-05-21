"""지오코딩 프록시.

기본 Google Geocoding API 를 사용하고, 키가 없거나 호출이 실패하면 Nominatim 으로 fallback.
프론트엔드는 동일한 응답 형식(results 배열 + user_lat/user_lng) 만 보면 되므로 백엔드 교체에 따른
프론트 변경 없음.

사용자 위치(lat/lng) 가 전달되면 주변 우선 (Google: bounds, Nominatim: viewbox). 결과는 사용자
좌표 기준 거리순 정렬. 폴백 좌표는 절대 부여하지 않는다 — 결과가 없으면 빈 배열을 그대로 반환.
"""
from math import asin, cos, radians, sin, sqrt
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Query
from loguru import logger

from ..config import get_settings
from ..deps import get_current_user
from ..models.user import User

router = APIRouter(prefix="/geocode", tags=["geocode"])

# Google Geocoding API
GOOGLE_GEOCODE = "https://maps.googleapis.com/maps/api/geocode/json"

# Nominatim fallback
NOMINATIM = "https://nominatim.openstreetmap.org/search"
NOMINATIM_UA = "moa-ai-ledger/1.0 (contact: master@aitrend.kr)"

# 사용자 위치 주변 검색 시 사용할 viewbox 반경 (도 단위). 위도 1도 ≈ 111km.
# 0.18 ≈ 약 ±20km 박스. 도시 단위 검색에 적합.
DEFAULT_VIEWBOX_DELTA = 0.18


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(a))


async def _google_geocode(
    q: str,
    lat: float | None,
    lng: float | None,
    limit: int,
    language: str,
) -> list[dict]:
    """Google Geocoding API 호출. 키 미설정/실패 시 빈 리스트 반환 (호출 측이 fallback 결정)."""
    settings = get_settings()
    api_key = getattr(settings, "google_maps_server_key", "") or ""
    if not api_key:
        return []

    params: dict[str, str] = {
        "address": q,
        "key": api_key,
        "language": language or "ko",
    }
    if lat is not None and lng is not None:
        # bounds: SW|NE  (lat,lng pairs)
        sw = f"{lat - DEFAULT_VIEWBOX_DELTA},{lng - DEFAULT_VIEWBOX_DELTA}"
        ne = f"{lat + DEFAULT_VIEWBOX_DELTA},{lng + DEFAULT_VIEWBOX_DELTA}"
        params["bounds"] = f"{sw}|{ne}"

    try:
        async with httpx.AsyncClient(timeout=8.0) as cli:
            r = await cli.get(GOOGLE_GEOCODE, params=params)
            data = r.json() or {}
    except Exception:
        logger.exception(f"Google Geocoding 호출 실패 q={q!r}")
        return []

    status = data.get("status")
    if status not in ("OK", "ZERO_RESULTS"):
        logger.warning(f"Google Geocoding non-OK status={status} q={q!r}")
        return []

    out: list[dict] = []
    for item in (data.get("results") or [])[:limit]:
        try:
            loc = item["geometry"]["location"]
            lat_v = float(loc["lat"])
            lng_v = float(loc["lng"])
        except (KeyError, ValueError, TypeError):
            continue
        addr = item.get("formatted_address") or ""
        # display name 으로는 첫 address_components 의 long_name 우선, 없으면 formatted_address
        comps = item.get("address_components") or []
        name = comps[0]["long_name"] if comps and comps[0].get("long_name") else addr
        entry: dict[str, object] = {
            "name": name,
            "lat": lat_v,
            "lng": lng_v,
            "address": addr,
            "type": ",".join(item.get("types") or []) or None,
        }
        if lat is not None and lng is not None:
            entry["distance_km"] = round(_haversine_km(lat, lng, lat_v, lng_v), 2)
        out.append(entry)
    return out


async def _nominatim_geocode(
    q: str,
    lat: float | None,
    lng: float | None,
    limit: int,
) -> list[dict]:
    """Nominatim fallback — Google 실패/키 없음 시 그대로 사용."""
    params: dict[str, str | int] = {
        "q": q if lat is not None else f"{q} 한국",
        "format": "json",
        "limit": limit,
        "addressdetails": 1,
    }
    if lat is not None and lng is not None:
        west = lng - DEFAULT_VIEWBOX_DELTA
        east = lng + DEFAULT_VIEWBOX_DELTA
        north = lat + DEFAULT_VIEWBOX_DELTA
        south = lat - DEFAULT_VIEWBOX_DELTA
        params["viewbox"] = f"{west},{north},{east},{south}"
        params["bounded"] = 1
    url = f"{NOMINATIM}?{urlencode(params, safe=',')}"

    try:
        async with httpx.AsyncClient(timeout=8.0, headers={"User-Agent": NOMINATIM_UA}) as cli:
            r = await cli.get(url)
            data = r.json() or []
    except Exception:
        logger.exception(f"Nominatim 호출 실패 q={q!r} lat={lat} lng={lng}")
        return []

    out: list[dict] = []
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
        out.append(entry)
    return out


@router.get("")
async def search(
    q: str = Query(min_length=1, max_length=200),
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    limit: int = Query(default=5, ge=1, le=10),
    user: User = Depends(get_current_user),
):
    """장소 검색.

    1. Google Geocoding API 우선 (서버 키 설정 시 / 한국 PoI 정확도 우위)
    2. Google 결과 없거나 키 미설정 / 호출 실패 시 Nominatim fallback
    3. 사용자 좌표가 있으면 가까운 순 정렬 (Google bounds + Haversine 재정렬)
    4. **자동 폴백 좌표 부여 금지** — 빈 배열 반환 시 호출 측 (프론트) 이 "사용자가 직접 지정" UX 로 전환
    """
    language = (user.locale or "ko")[:2]

    # 1차: Google
    results = await _google_geocode(q, lat, lng, limit, language)

    # 2차: Nominatim fallback (Google 결과 없음 + 키 미설정 모두 포괄)
    if not results:
        results = await _nominatim_geocode(q, lat, lng, limit)

    # 사용자 좌표가 있으면 가까운 순. 없으면 백엔드 자체 랭킹 유지.
    if lat is not None and lng is not None:
        results.sort(key=lambda x: x.get("distance_km", 9999))

    return {"results": results, "user_lat": lat, "user_lng": lng}
