"""Storage service abstractions and implementations."""

import asyncio
import os
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path

import aiofiles

from app.core.config import settings
from app.core.exceptions import BadRequestException


class StorageService(ABC):
    """Abstract file storage interface."""

    @abstractmethod
    async def upload(self, file_data: bytes, filename: str, content_type: str) -> str:
        """Upload a file and return the stored path/key."""
        ...

    @abstractmethod
    async def get_url(self, stored_path: str) -> str:
        """Get a URL or path to access the stored file."""
        ...

    @abstractmethod
    async def delete(self, stored_path: str) -> None:
        """Delete a stored file."""
        ...

    @abstractmethod
    async def download(self, stored_path: str) -> bytes:
        """Read a stored file and return its bytes."""
        ...


class LocalStorageService(StorageService):
    """Stores files on the local filesystem for development."""

    def __init__(self, base_dir: str | None = None):
        self.base_dir = Path(base_dir or settings.UPLOAD_DIR)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    async def upload(self, file_data: bytes, filename: str, content_type: str) -> str:
        ext = Path(filename).suffix
        unique_name = f"{uuid.uuid4().hex}{ext}"
        date_folder = datetime.now(timezone.utc).strftime("%Y/%m")
        folder = self.base_dir / date_folder
        folder.mkdir(parents=True, exist_ok=True)

        file_path = folder / unique_name
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(file_data)

        return str(file_path.relative_to(self.base_dir))

    async def get_url(self, stored_path: str) -> str:
        return stored_path

    async def delete(self, stored_path: str) -> None:
        full_path = (self.base_dir / stored_path).resolve()
        base_path = self.base_dir.resolve()
        if not full_path.is_relative_to(base_path):
            return
        if full_path.exists():
            os.remove(full_path)

    async def download(self, stored_path: str) -> bytes:
        full_path = (self.base_dir / stored_path).resolve()
        base_path = self.base_dir.resolve()
        if not full_path.is_relative_to(base_path) or not full_path.exists():
            raise FileNotFoundError(stored_path)
        async with aiofiles.open(full_path, "rb") as f:
            return await f.read()


class S3StorageService(StorageService):
    """S3/MinIO storage for persistent production uploads."""

    def __init__(self):
        if not settings.S3_BUCKET:
            raise BadRequestException("S3_BUCKET must be configured for S3 storage")
        if not settings.S3_ACCESS_KEY or not settings.S3_SECRET_KEY:
            raise BadRequestException("S3 credentials must be configured for S3 storage")

        import boto3

        self.bucket = settings.S3_BUCKET
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
        )

    async def upload(self, file_data: bytes, filename: str, content_type: str) -> str:
        ext = Path(filename).suffix
        date_folder = datetime.now(timezone.utc).strftime("%Y/%m")
        key = f"{date_folder}/{uuid.uuid4().hex}{ext}"

        await asyncio.to_thread(
            self.client.put_object,
            Bucket=self.bucket,
            Key=key,
            Body=file_data,
            ContentType=content_type,
        )
        return key

    async def get_url(self, stored_path: str) -> str:
        return await asyncio.to_thread(
            self.client.generate_presigned_url,
            "get_object",
            Params={"Bucket": self.bucket, "Key": stored_path},
            ExpiresIn=300,
        )

    async def delete(self, stored_path: str) -> None:
        await asyncio.to_thread(
            self.client.delete_object,
            Bucket=self.bucket,
            Key=stored_path,
        )

    async def download(self, stored_path: str) -> bytes:
        def _download() -> bytes:
            obj = self.client.get_object(Bucket=self.bucket, Key=stored_path)
            return obj["Body"].read()

        return await asyncio.to_thread(_download)


def get_storage_service() -> StorageService:
    """Factory that returns the storage service selected by configuration."""
    if settings.STORAGE_TYPE == "s3":
        return S3StorageService()
    return LocalStorageService()
