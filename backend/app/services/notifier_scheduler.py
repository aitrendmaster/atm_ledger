"""D-1 반복지출 알림 스케줄러.

매일 KST 09:00 시간대에 1회 `notify_recurring_d1` 호출. asyncio 백그라운드 태스크.
같은 패턴: `subscription_scheduler.py`.

비활성 시간대에는 5분마다 시간만 체크 — CPU/네트워크 부담 없음.
하루 1회 실행되도록 `_last_run_date` 로 가드.
"""
from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone

from loguru import logger
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..database import engine
from .notifier import notify_recurring_d1

KST = timezone(timedelta(hours=9))
TICK_SECONDS = 5 * 60  # 5분마다 시간 체크
TARGET_HOUR_KST = 9  # KST 09:00 발송 (전날 저녁 알림이 부담스러울 수 있어 아침 권장)

_session_factory = async_sessionmaker(engine, expire_on_commit=False)
_task: asyncio.Task | None = None
_last_run_date: date | None = None


def start() -> None:
    """lifespan 에서 호출. 무한 루프 시작."""
    global _task
    if _task is not None and not _task.done():
        return
    _task = asyncio.create_task(_loop(), name="notifier_scheduler")
    logger.info(
        f"D-1 반복지출 알림 스케줄러 시작 (매일 KST {TARGET_HOUR_KST:02d}:00, "
        f"tick={TICK_SECONDS}s)"
    )


async def _loop() -> None:
    global _last_run_date
    # 부팅 직후 폭주 방지 + DB / Firebase 워밍업 대기
    await asyncio.sleep(60)
    while True:
        try:
            now_kst = datetime.now(KST)
            if now_kst.hour == TARGET_HOUR_KST and _last_run_date != now_kst.date():
                async with _session_factory() as db:
                    result = await notify_recurring_d1(db)
                    logger.info(f"[notifier_scheduler] tick 완료 {result}")
                _last_run_date = now_kst.date()
        except Exception:
            logger.exception("[notifier_scheduler] tick 실패")
        await asyncio.sleep(TICK_SECONDS)
