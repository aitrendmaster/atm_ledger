"""정기결제 자동 청구 스케줄러.

lifespan 에서 시작되는 백그라운드 asyncio 태스크. 매 INTERVAL 초마다:
  1) subscription_tier='paid' 이고 subscription_expires_at <= now + 1d 인 사용자 SELECT
  2) 각 사용자 toss_billing_key 로 청구 시도 (orderId 는 YYYYMM 결정적 ID)
  3) 성공: expires_at += 30d, status='active', last_billing_error 클리어
  4) 실패: last_billing_error 저장 + (3일 이상 지난 경우) free 다운그레이드 + 이메일

Toss 의 idempotent 동작 덕분에 중복 청구 위험 없음.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..config import get_settings
from ..database import engine
from ..models.user import User
from ..services import toss_service

# 6시간마다 점검. test 모드에서는 환경변수로 조정 가능.
TICK_SECONDS = 6 * 60 * 60
# expires_at - now 가 이 값 이하이면 청구. (D-1)
RENEWAL_WINDOW = timedelta(days=1)
# past_due 가 이 기간 이상이면 free 로 다운그레이드.
GRACE_PERIOD = timedelta(days=3)

_session_factory = async_sessionmaker(engine, expire_on_commit=False)

_task: asyncio.Task | None = None


def start() -> None:
    """lifespan 에서 호출. 백엔드 부팅 후 첫 tick 까지 60초 대기."""
    global _task
    if _task is not None and not _task.done():
        return
    if not toss_service.configured():
        logger.info("Toss 미설정 — 정기결제 스케줄러를 시작하지 않습니다.")
        return
    _task = asyncio.create_task(_loop(), name="subscription_scheduler")
    logger.info("정기결제 스케줄러 시작")


async def _loop() -> None:
    # 부팅 직후 폭주 방지
    await asyncio.sleep(60)
    while True:
        try:
            await _run_once()
        except Exception:
            logger.exception("정기결제 스케줄러 tick 실패")
        await asyncio.sleep(TICK_SECONDS)


async def _run_once() -> None:
    now = datetime.now(timezone.utc)
    threshold = now + RENEWAL_WINDOW

    async with _session_factory() as db:
        rows = (
            await db.execute(
                select(User).where(
                    User.subscription_tier == "paid",
                    User.deleted_at.is_(None),
                    User.toss_billing_key.is_not(None),
                    or_(
                        User.subscription_expires_at.is_(None),
                        User.subscription_expires_at <= threshold,
                    ),
                )
            )
        ).scalars().all()

        if not rows:
            return

        settings = get_settings()
        logger.info(f"정기결제 대상: {len(rows)}명")

        for user in rows:
            period = (user.subscription_expires_at or now).strftime("%Y%m")
            order_id = toss_service.make_order_id(user.id, period)
            try:
                resp = await toss_service.charge(
                    billing_key=user.toss_billing_key,
                    customer_key=user.toss_customer_key or f"moa-{user.id}",
                    amount=settings.toss_monthly_price_krw,
                    order_id=order_id,
                    order_name=settings.toss_monthly_order_name,
                )
                if resp.get("status") == "DONE":
                    base = user.subscription_expires_at or now
                    if base < now:
                        base = now
                    user.subscription_expires_at = base + timedelta(days=30)
                    user.subscription_status = "active"
                    user.last_billing_error = None
                    await db.commit()
                    logger.info(
                        f"정기결제 성공 user_id={user.id} new_expires={user.subscription_expires_at.isoformat()}"
                    )
                else:
                    raise toss_service.TossError(
                        code=str(resp.get("status") or "UNKNOWN"),
                        message="Toss 응답이 DONE 아님",
                    )
            except toss_service.TossError as e:
                await _handle_failure(db, user, now, f"{e.code}: {e.message[:200]}")
            except Exception as e:
                logger.exception(f"정기결제 예외 user_id={user.id}")
                await _handle_failure(db, user, now, str(e)[:200])


async def _handle_failure(db, user: User, now: datetime, reason: str) -> None:
    user.last_billing_error = reason
    user.subscription_status = "past_due"
    grace_until = (user.subscription_expires_at or now) + GRACE_PERIOD
    if now > grace_until:
        # 유예기간 지났음 — free 다운그레이드
        user.subscription_tier = "free"
        user.subscription_status = "canceled"
        logger.warning(f"정기결제 유예 만료 → free 전환 user_id={user.id}")
    await db.commit()
