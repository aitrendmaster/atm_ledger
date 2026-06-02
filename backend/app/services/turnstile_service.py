"""Cloudflare Turnstile (무료 CAPTCHA) 서버측 검증.

가입 폼에서 받은 토큰을 Cloudflare siteverify 로 검증해 자동 가입(봇)을 차단한다.

설정:
  TURNSTILE_SECRET_KEY  — Cloudflare 대시보드 Turnstile 위젯의 Secret Key
  TURNSTILE_SITE_KEY    — 프론트 위젯용 (참고용으로만 보관, 백엔드 미사용)

미설정(빈 secret) 이면 verify() 가 항상 True 를 반환 — 점진 적용/개발 환경에서 가입이 막히지 않게.
설정된 상태에서 Cloudflare 호출이 실패하면 fail-closed(False) — 남용 차단 우선.
"""
from __future__ import annotations

import httpx
from loguru import logger

from ..config import get_settings

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def configured() -> bool:
    return bool(get_settings().turnstile_secret_key)


async def verify(token: str | None, remote_ip: str | None = None) -> bool:
    """Turnstile 토큰 검증. 미설정이면 통과(True). 설정됐는데 토큰 없거나 실패면 False."""
    secret = get_settings().turnstile_secret_key
    if not secret:
        return True  # 미설정 — 우회(점진 적용)
    if not token:
        return False
    data = {"secret": secret, "response": token}
    if remote_ip:
        data["remoteip"] = remote_ip
    try:
        async with httpx.AsyncClient(timeout=10) as cx:
            resp = await cx.post(VERIFY_URL, data=data)
        out = resp.json() if resp.status_code == 200 else {}
        ok = bool(out.get("success"))
        if not ok:
            logger.warning(f"Turnstile 검증 실패: {out.get('error-codes')}")
        return ok
    except Exception as e:
        # 검증 서버 장애 시 fail-closed — 봇 통과보다 일시적 가입 차단을 택함.
        logger.warning(f"Turnstile 검증 호출 실패(fail-closed): {e}")
        return False
