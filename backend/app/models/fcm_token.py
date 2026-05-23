"""FCM (Firebase Cloud Messaging) 등록 토큰.

사용자가 모바일 앱에서 로그인 직후 PushNotifications.register() 로 받은
device token 을 저장. 알림 발송 시 user_id 로 토큰 모두 조회 → 각 토큰으로 send.

토큰 수명:
- 앱 재설치 / 데이터 삭제 / 장기 미사용 시 변경됨
- 로그인할 때마다 새 토큰을 받아 upsert (token 컬럼 unique constraint)
- 죽은 토큰은 발송 실패(404 INVALID_ARGUMENT/UNREGISTERED) 시 자동 삭제
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class FCMToken(Base):
    __tablename__ = "fcm_tokens"
    __table_args__ = (UniqueConstraint("token", name="uq_fcm_token"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token: Mapped[str] = mapped_column(String(512), nullable=False)
    # android | ios | web — 향후 분기 발송용
    platform: Mapped[str] = mapped_column(
        String(16), nullable=False, default="android", server_default="android"
    )
    # 사용자 자유 입력 (디바이스 식별용). 예: "Galaxy S25 / Android 16"
    device_info: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
