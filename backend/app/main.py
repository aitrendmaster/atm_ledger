from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger

from .config import get_settings
from .database import Base, engine
from .routers import ai, auth, entries, geocode, photos, planned, reflections

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 개발 환경에선 테이블 자동 생성. 프로덕션에선 Alembic 사용.
    if settings.env != "production":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("DB 테이블 자동 생성 (dev mode)")
    yield


app = FastAPI(title="ATM 가계부 API", version="0.1.0", lifespan=lifespan)

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


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.env}
