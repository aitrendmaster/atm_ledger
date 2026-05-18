"""IP 기반 위치 추정 서비스.

무료 ipapi.co (HTTPS, JSON, 가입 불필요, ~1000 req/day) 사용. 실패 시 None 반환.
사용자의 옵트인 동의(`User.allow_location_metadata=True`) 가 있을 때만 호출하도록 라우터에서 제어.

응답 캐시: User 모델의 last_geo_* 컬럼에 저장 — 매 요청 호출 대신 1시간 TTL.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from loguru import logger

from ..models.user import User

GEO_CACHE_TTL = timedelta(hours=1)
IPAPI_URL = "https://ipapi.co/{ip}/json/"
# 호출 식별용 (ipapi.co 권장: User-Agent 식별 가능 문자열)
UA = "moa-ai-ledger/1.0 (+https://moa.atm.ai.kr)"


def _is_private_ip(ip: str) -> bool:
    """RFC1918/loopback IP 는 위치 조회 의미 없음."""
    if not ip:
        return True
    if ip in ("127.0.0.1", "::1", "0.0.0.0"):
        return True
    parts = ip.split(".")
    if len(parts) == 4:
        try:
            a, b = int(parts[0]), int(parts[1])
        except ValueError:
            return False
        # 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
        if a == 10 or a == 127 or (a == 172 and 16 <= b <= 31) or (a == 192 and b == 168) or (a == 169 and b == 254):
            return True
    return False


def client_ip_from_request(headers: dict[str, str], fallback: str | None = None) -> str | None:
    """프록시(Railway/Vercel/CloudFront)를 거친 클라이언트 IP 추출.

    우선순위: X-Forwarded-For 첫 토큰 → X-Real-IP → fallback(스타라이트 client.host).
    """
    xff = headers.get("x-forwarded-for") or headers.get("X-Forwarded-For")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    real = headers.get("x-real-ip") or headers.get("X-Real-IP")
    if real:
        return real.strip()
    return fallback


async def lookup_ip_geo(ip: str) -> dict[str, Any] | None:
    """ipapi.co 로 위치 조회. 실패 시 None."""
    if not ip or _is_private_ip(ip):
        return None
    try:
        async with httpx.AsyncClient(timeout=4.0, headers={"User-Agent": UA}) as cli:
            r = await cli.get(IPAPI_URL.format(ip=ip))
            if r.status_code != 200:
                return None
            data = r.json()
        if data.get("error"):
            return None
        return {
            "ip": ip,
            "country": data.get("country_name") or data.get("country"),
            "region": data.get("region"),
            "city": data.get("city"),
            "lat": data.get("latitude"),
            "lng": data.get("longitude"),
        }
    except Exception:
        logger.exception(f"ipapi.co 호출 실패 ip={ip}")
        return None


def cached_geo_is_fresh(user: User) -> bool:
    return (
        user.last_geo_at is not None
        and user.last_geo_lat is not None
        and user.last_geo_lng is not None
        and datetime.now(timezone.utc) - user.last_geo_at < GEO_CACHE_TTL
    )


def apply_geo_to_user(user: User, geo: dict[str, Any]) -> None:
    user.last_ip = geo.get("ip")
    user.last_geo_country = geo.get("country")
    user.last_geo_region = geo.get("region")
    user.last_geo_city = geo.get("city")
    user.last_geo_lat = geo.get("lat")
    user.last_geo_lng = geo.get("lng")
    user.last_geo_at = datetime.now(timezone.utc)
