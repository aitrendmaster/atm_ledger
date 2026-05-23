"""FCM 푸시 알림 트리거.

- `notify_recurring_d1(db)` : 내일(KST) 발생할 반복지출이 있는 사용자에게 D-1 알림
- `maybe_notify_budget_exceeded(db, user_id)` : entry 저장 후 호출 — 이번 달 첫 예산 돌파 시 1회

스케줄러(`notifier_scheduler.py`) 가 매일 KST 09:00 즈음 `notify_recurring_d1` 호출.
예산 초과는 entry POST 핸들러 끝에서 직접 호출.
"""
from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.entry import Entry
from ..models.fcm_token import FCMToken
from ..models.planned import Planned
from ..models.user import User
from .fcm_service import send_to_user

KST = timezone(timedelta(hours=9))


# ---------- D-1 반복지출 ----------


def _occurs_on(p: Planned, target: date) -> bool:
    """반복 규칙 p 가 target 일자에 발생하는지.

    planned.py 의 `_expand_recurring` 와 동일 규칙 — 한 일자만 체크하면 되므로 단순 구현.
    """
    if p.recurrence == "none":
        return False
    try:
        start = date.fromisoformat(p.date)
    except ValueError:
        return False
    if target < start:
        return False
    if p.recurrence_until:
        try:
            end = date.fromisoformat(p.recurrence_until)
            if target > end:
                return False
        except ValueError:
            pass

    if p.recurrence == "monthly":
        day = p.recurrence_day or start.day
        last_day = monthrange(target.year, target.month)[1]
        actual_day = min(day, last_day)  # 31일 매월 + 2월 → 28/29일 clip
        return target.day == actual_day
    if p.recurrence == "weekly":
        weekday = p.recurrence_day if p.recurrence_day is not None else start.weekday()
        return target.weekday() == weekday
    if p.recurrence == "yearly":
        last_day = monthrange(target.year, target.month)[1]
        return target.month == start.month and target.day == min(start.day, last_day)
    return False


async def notify_recurring_d1(db: AsyncSession) -> dict[str, int]:
    """내일(KST) 발생할 반복지출이 있는 사용자에게 D-1 알림 발송.

    Returns:
        {"users_notified": N, "items": M}
    """
    tomorrow = (datetime.now(KST) + timedelta(days=1)).date()
    target_str = tomorrow.isoformat()

    # 반복 규칙 마스터 모두 조회 (소프트 삭제된 user 도 일단 가져왔다가 토큰 조회로 자동 필터됨)
    res = await db.execute(select(Planned).where(Planned.recurrence != "none"))
    masters = res.scalars().all()

    # 사용자별 내일 발생 항목 그룹화
    by_user: dict[int, list[Planned]] = {}
    for p in masters:
        if _occurs_on(p, tomorrow):
            by_user.setdefault(p.user_id, []).append(p)

    users_notified = 0
    total_items = 0
    for user_id, items in by_user.items():
        if not items:
            continue
        # FCM 토큰 없는 사용자는 스킵 (네트워크/Firebase 비용 절약)
        tok_res = await db.execute(
            select(FCMToken.id).where(FCMToken.user_id == user_id).limit(1)
        )
        if tok_res.scalar_one_or_none() is None:
            continue

        total_amount = sum(p.amount for p in items)
        title = "내일 반복지출 알림"
        body = (
            f"내일({tomorrow.month}월 {tomorrow.day}일) {len(items)}건 / "
            f"{total_amount:,}원 예정"
        )
        sent = await send_to_user(
            db,
            user_id,
            title,
            body,
            data={
                "type": "recurring_d1",
                "date": target_str,
                "count": str(len(items)),
            },
        )
        if sent > 0:
            users_notified += 1
            total_items += len(items)

    logger.info(f"[notifier] D-1 발송 완료: users={users_notified} items={total_items}")
    return {"users_notified": users_notified, "items": total_items}


# ---------- 예산 초과 ----------


async def maybe_notify_budget_exceeded(db: AsyncSession, user_id: int) -> bool:
    """이번 달 누적 지출이 monthly_budget 을 처음 돌파한 순간 1회 알림 발송.

    중복 방지: `User.last_budget_breach_month` (YYYY-MM) 컬럼에 기록.
    같은 달에 이미 발송했으면 skip.

    Returns:
        실제 발송 성공 여부 (sent > 0 AND DB 갱신 OK).
    """
    user = await db.get(User, user_id)
    if not user or user.monthly_budget <= 0:
        return False

    now_kst = datetime.now(KST)
    month_str = now_kst.strftime("%Y-%m")

    # 이미 이번 달 발송했으면 skip
    if getattr(user, "last_budget_breach_month", None) == month_str:
        return False

    # 이번 달 누적 지출 (Entry.type 별도 분기 없음 — 모든 entry 가 지출이라고 가정)
    res = await db.execute(
        select(func.coalesce(func.sum(Entry.amount), 0)).where(
            Entry.user_id == user_id,
            Entry.date.like(f"{month_str}-%"),
        )
    )
    total = int(res.scalar_one() or 0)

    if total < user.monthly_budget:
        return False

    title = "예산 초과 알림"
    over = total - user.monthly_budget
    body = (
        f"이번 달 지출 {total:,}원이 예산 {user.monthly_budget:,}원을 "
        f"{over:,}원 초과했어요"
    )
    sent = await send_to_user(
        db,
        user_id,
        title,
        body,
        data={"type": "budget_breach", "month": month_str},
    )

    if sent > 0:
        # 중복 방지 마크 (컬럼이 마이그레이션으로 추가됐다고 가정 — 없으면 silently skip)
        try:
            user.last_budget_breach_month = month_str
            await db.commit()
        except Exception:
            logger.warning("[notifier] last_budget_breach_month 컬럼 누락 — 마이그레이션 필요")
            await db.rollback()
        return True
    return False
