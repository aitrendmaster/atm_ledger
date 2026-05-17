"""사진 업로드 스토리지. local | r2 (S3 호환) 백엔드 지원."""
import uuid
from pathlib import Path
from typing import Protocol

import boto3
from botocore.config import Config

from ..config import get_settings

settings = get_settings()


class Storage(Protocol):
    async def put(self, data: bytes, content_type: str, prefix: str = "photos") -> str: ...


class LocalStorage:
    def __init__(self, root: str) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    async def put(self, data: bytes, content_type: str, prefix: str = "photos") -> str:
        ext = _ext_for(content_type)
        name = f"{uuid.uuid4().hex}{ext}"
        sub = self.root / prefix
        sub.mkdir(parents=True, exist_ok=True)
        path = sub / name
        path.write_bytes(data)
        return f"/files/{prefix}/{name}"


class R2Storage:
    def __init__(self) -> None:
        self.bucket = settings.r2_bucket
        self.public_base = settings.r2_public_base_url.rstrip("/")
        self.client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )

    async def put(self, data: bytes, content_type: str, prefix: str = "photos") -> str:
        ext = _ext_for(content_type)
        key = f"{prefix}/{uuid.uuid4().hex}{ext}"
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)
        return f"{self.public_base}/{key}"


def _ext_for(content_type: str) -> str:
    return {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }.get(content_type.lower(), ".bin")


def get_storage() -> Storage:
    if settings.storage_backend == "r2":
        return R2Storage()
    return LocalStorage(settings.local_upload_dir)
