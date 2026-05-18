"""Moa AI 가계부 — 사용자 비밀번호 직접 재설정 스크립트.

사용 예:
    cd atm-ledger/backend
    python -m scripts.reset_password --email aitrendmarketer@gmail.com --password 'NewPwd1234!'

프로덕션 DB에 적용:
    DATABASE_URL='postgresql+asyncpg://...' python -m scripts.reset_password \
        --email aitrendmarketer@gmail.com --password 'NewPwd1234!'

보안 주의:
- 비밀번호를 인자로만 전달. 채팅/이슈/.env 에 평문 저장 금지.
- Railway 실행 로그/셸 히스토리에서 즉시 정리.
- 실행 후 브라우저 로그인 → 가능하면 즉시 새 비번으로 한 번 더 변경.
"""

import argparse
import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models.user import User
from app.security import hash_password


async def main(email: str, new_password: str) -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        res = await db.execute(select(User).where(User.email == email.lower()))
        user = res.scalar_one_or_none()
        if not user:
            raise SystemExit(f"user not found: {email}")
        user.password_hash = hash_password(new_password)
        user.auth_provider = "password"
        await db.commit()
        print(f"OK: {email} password updated (user_id={user.id})")

    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset a user's password directly in the DB.")
    parser.add_argument("--email", required=True, help="대상 사용자 이메일")
    parser.add_argument("--password", required=True, help="새 비밀번호 (8자 이상 권장)")
    args = parser.parse_args()

    if len(args.password) < 8:
        raise SystemExit("password must be at least 8 characters")

    asyncio.run(main(args.email, args.password))
