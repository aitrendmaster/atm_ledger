"""경량 인메모리 rate limiter — 가입/메일 발송 등 봇 남용 방어용.

슬라이딩 윈도우. 외부 의존성 없음. 단일 인스턴스 기준(멀티 인스턴스면 인스턴스별 카운트)
이라 엣지(Cloudflare)나 Redis 기반이 더 견고하지만, P0 출혈 차단용으로 즉시 적용 가능.

사용:
    from .ratelimit import signup_limiter, limit
    @router.post("/signup", dependencies=[Depends(limit(signup_limiter))])
"""
from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status


class SlidingWindowLimiter:
    def __init__(self, max_calls: int, window_sec: int) -> None:
        self.max_calls = max_calls
        self.window_sec = window_sec
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        cutoff = now - self.window_sec
        with self._lock:
            dq = self._hits[key]
            while dq and dq[0] < cutoff:
                dq.popleft()
            if len(dq) >= self.max_calls:
                return False
            dq.append(now)
            # 메모리 누수 방지: 비어 있는 키는 정리
            if not dq:
                self._hits.pop(key, None)
            return True


# 가입·인증메일 발송 한도 (IP 기준). 봇 가입 폭주 차단 + 정상 사용자엔 충분.
signup_limiter = SlidingWindowLimiter(max_calls=5, window_sec=600)        # 10분당 5회
resend_limiter = SlidingWindowLimiter(max_calls=5, window_sec=600)        # 10분당 5회
password_reset_limiter = SlidingWindowLimiter(max_calls=5, window_sec=600)


def client_ip(request: Request) -> str:
    """프록시(Render/Cloudflare) 뒤의 실제 클라이언트 IP. geo_service 유틸 재사용."""
    from .services.geo_service import client_ip_from_request

    ip = client_ip_from_request(
        {k.lower(): v for k, v in request.headers.items()},
        fallback=request.client.host if request.client else None,
    )
    return ip or "unknown"


def limit(limiter: SlidingWindowLimiter):
    """라우트 dependency 팩토리. 한도 초과 시 429."""

    async def _dep(request: Request) -> None:
        if not limiter.allow(client_ip(request)):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
            )

    return _dep
