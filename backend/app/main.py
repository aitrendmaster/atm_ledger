from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger
from sqlalchemy import text

from .config import get_settings
from .database import Base, engine
from .routers import admin, ai, auth, entries, geocode, photos, planned, reflections

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # v0.5: idempotent create_all. SQLAlchemy 는 이미 존재하는 테이블에 컬럼을 추가하지 못하므로
    # 새 컬럼은 ALTER TABLE ... ADD COLUMN IF NOT EXISTS 로 명시적 보강 (SQLite 3.32+ / Postgres 9.6+).
    # v1+ 에서 Alembic 마이그레이션 도입 후 이 블록은 제거 (ROADMAP.md PR-A2).
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

            # 새 운영 컬럼 보강 (재실행 안전)
            await conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )
            await conn.execute(
                text("ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL")
            )

            # ADMIN_EMAILS 부트스트랩 — 환경변수에 등록된 이메일은 is_admin=true 보장 (soft-deleted 제외)
            admin_emails = sorted(settings.admin_email_set)
            if admin_emails:
                await conn.execute(
                    text(
                        "UPDATE users SET is_admin = TRUE "
                        "WHERE LOWER(email) = ANY(:emails) AND deleted_at IS NULL"
                    )
                    if engine.dialect.name == "postgresql"
                    else text(
                        "UPDATE users SET is_admin = 1 "
                        "WHERE LOWER(email) IN ({}) AND deleted_at IS NULL".format(
                            ",".join(f":e{i}" for i in range(len(admin_emails)))
                        )
                    ),
                    (
                        {"emails": admin_emails}
                        if engine.dialect.name == "postgresql"
                        else {f"e{i}": e for i, e in enumerate(admin_emails)}
                    ),
                )

            user_count = (await conn.execute(text("SELECT COUNT(*) FROM users"))).scalar_one()
            admin_count = (
                await conn.execute(text("SELECT COUNT(*) FROM users WHERE is_admin = TRUE"))
            ).scalar_one()

        logger.info(
            f"DB 점검 완료 (env={settings.env}, users={user_count}, admins={admin_count}, "
            f"admin_emails_env={admin_emails})"
        )
    except Exception:
        # 부팅은 계속 진행해 /health 가 살아있게 한다. 원인은 traceback 으로 확인.
        logger.exception("DB 초기화 실패 — Railway Variables(DATABASE_URL) 와 Postgres 연결 확인 필요")
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
app.include_router(entries.router)
app.include_router(planned.router)
app.include_router(reflections.router)
app.include_router(ai.router)
app.include_router(geocode.router)
app.include_router(photos.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.env}
