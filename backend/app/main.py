import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger
from sqlalchemy import create_engine, inspect, text

from .config import get_settings
from .database import engine
from .routers import (
    admin,
    ai,
    announcements,
    auth,
    entries,
    geocode,
    me,
    oauth,
    photos,
    planned,
    reflections,
    toss_webhook,
)
from .services import subscription_scheduler

settings = get_settings()

ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"


def _sync_db_url(url: str) -> str:
    """Alembic inspect 용 sync URL (asyncpg/aiosqlite 드라이버 표기 제거)."""
    return url.replace("+asyncpg", "").replace("+aiosqlite", "")


def _run_alembic_migrations() -> None:
    """별도 thread 에서 호출. env.py 가 자체 asyncio.run 을 쓰므로 메인 루프와 분리.

    안전 동작: 기존 운영 DB(테이블은 있는데 alembic_version 테이블이 없는 경우)는
    `alembic stamp head` 로 baseline 적용 표시만 하고 종료. 그 외에는 `upgrade head`.
    """
    cfg = Config(str(ALEMBIC_INI))
    sync_eng = create_engine(_sync_db_url(settings.database_url))
    try:
        insp = inspect(sync_eng)
        names = set(insp.get_table_names())
        if "users" in names and "alembic_version" not in names:
            # 베이스라인 스키마는 이미 적용된 상태로 간주하고 베이스라인 revision 만 stamp.
            # 그 이후 누락된 마이그레이션은 아래 upgrade 가 차례로 적용한다.
            logger.warning("기존 DB 감지(alembic_version 없음). 베이스라인 stamp 후 upgrade.")
            command.stamp(cfg, "43a1bec11fce")
        command.upgrade(cfg, "head")
    finally:
        sync_eng.dispose()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # 1) Alembic 마이그레이션 (또는 첫 배포 시 stamp). 별도 thread 에서 sync 실행.
        await asyncio.get_event_loop().run_in_executor(None, _run_alembic_migrations)

        # 2) ADMIN_EMAILS 환경변수 → User.is_admin 부트스트랩 sync (soft-deleted 제외)
        async with engine.begin() as conn:
            admin_emails = sorted(settings.admin_email_set)
            if admin_emails:
                if engine.dialect.name == "postgresql":
                    await conn.execute(
                        text(
                            "UPDATE users SET is_admin = TRUE "
                            "WHERE LOWER(email) = ANY(:emails) AND deleted_at IS NULL"
                        ),
                        {"emails": admin_emails},
                    )
                else:
                    placeholders = ",".join(f":e{i}" for i in range(len(admin_emails)))
                    await conn.execute(
                        text(
                            f"UPDATE users SET is_admin = 1 "
                            f"WHERE LOWER(email) IN ({placeholders}) AND deleted_at IS NULL"
                        ),
                        {f"e{i}": e for i, e in enumerate(admin_emails)},
                    )

            user_count = (
                await conn.execute(text("SELECT COUNT(*) FROM users"))
            ).scalar_one()
            admin_count = (
                await conn.execute(
                    text("SELECT COUNT(*) FROM users WHERE is_admin = TRUE")
                )
            ).scalar_one()

        logger.info(
            f"DB 점검 완료 (env={settings.env}, users={user_count}, admins={admin_count}, "
            f"admin_emails_env={admin_emails})"
        )
    except Exception:
        logger.exception(
            "DB 초기화/마이그레이션 실패 — Railway Variables(DATABASE_URL) 와 Postgres 연결 확인 필요"
        )

    # Toss 정기결제 자동 청구 스케줄러 (Toss 미설정이면 no-op)
    subscription_scheduler.start()

    yield


app = FastAPI(title="Moa AI 가계부 API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 로컬 스토리지 사용 시 /files 로 정적 파일 서빙
if settings.storage_backend == "local":
    upload_root = Path(settings.local_upload_dir)
    upload_root.mkdir(parents=True, exist_ok=True)
    app.mount("/files", StaticFiles(directory=str(upload_root)), name="files")


app.include_router(auth.router)
app.include_router(oauth.router)
app.include_router(me.router)
app.include_router(toss_webhook.router)
app.include_router(entries.router)
app.include_router(planned.router)
app.include_router(reflections.router)
app.include_router(ai.router)
app.include_router(geocode.router)
app.include_router(photos.router)
app.include_router(announcements.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.env}
