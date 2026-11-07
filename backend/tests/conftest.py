"""Shared test fixtures for ImmunoClinic integration tests."""

import asyncio
import hashlib
import io
import os
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["REFRESH_SECRET_KEY"] = "test-refresh-secret-key"
os.environ["DEBUG"] = "true"
os.environ["VACCINE_REMINDER_ENABLED"] = "false"
os.environ["EMAIL_ENABLED"] = "false"
os.environ["FCM_ENABLED"] = "false"

pytest_plugins = ["tests.integration_support"]

import app.db.models_registry  # noqa: F401 — register all models
import pytest
import pytest_asyncio
from app.common.enums import Gender, Role
from app.core.security import hash_password
from app.db.base import Base
from app.modules.certificates.models import CertificateSignature, CertificateSignerAssignment
from app.modules.certificates.service import CertificateService
from app.modules.users.models import Profile, User
from PIL import Image
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# ── In-memory SQLite for fast isolated tests ──────────────────────────

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DB_URL, echo=False)


@event.listens_for(engine.sync_engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
    """Enforce FK constraints in SQLite to mirror PostgreSQL behavior."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture(scope="session")
def event_loop():
    """Use a single event loop for all tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test, drop after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    """Provide a clean database session for each test."""
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def admin_user(db: AsyncSession) -> User:
    """Create a test admin user."""
    user = User(
        id=uuid.uuid4(),
        email="admin@test.com",
        hashed_password=hash_password("Admin123!"),
        role=Role.APP_ADMIN,
        is_active=True,
    )
    db.add(user)
    profile = Profile(
        user_id=user.id,
        first_name="Test",
        last_name="Admin",
        sex=Gender.MALE,
    )
    db.add(profile)
    await db.commit()
    return user


@pytest_asyncio.fixture
async def student_user(db: AsyncSession) -> User:
    """Create a test student user."""
    user = User(
        id=uuid.uuid4(),
        email="student@test.com",
        hashed_password=hash_password("Student123!"),
        role=Role.STUDENT,
        is_active=True,
    )
    db.add(user)
    profile = Profile(
        user_id=user.id,
        first_name="Test",
        last_name="Student",
        sex=Gender.FEMALE,
        document_number="12345678",
        student_id="STU001",
        program="Medicina",
        campus="Principal",
        semester=3,
    )
    db.add(profile)
    await db.commit()
    return user


class MemoryPrivateStorage:
    def __init__(self):
        self.files: dict[str, bytes] = {}

    async def upload(self, file_data: bytes, filename: str, content_type: str) -> str:
        key = f"private/{uuid.uuid4().hex}.png"
        self.files[key] = file_data
        return key

    async def get_url(self, stored_path: str) -> str:
        raise AssertionError("Private signatures must not get public URLs")

    async def delete(self, stored_path: str) -> None:
        self.files.pop(stored_path, None)

    async def download(self, stored_path: str) -> bytes:
        return self.files[stored_path]


@pytest_asyncio.fixture
async def signed_certificate_service(db: AsyncSession, student_user: User):
    """Synthetic scoped normal administrator and private PNG for certificate tests."""
    signer = User(
        email=f"signer-{uuid.uuid4().hex}@test.invalid",
        hashed_password=hash_password("SyntheticOnly123!"),
        role=Role.ADMIN,
        is_active=True,
    )
    db.add(signer)
    await db.flush()
    db.add(
        Profile(
            user_id=signer.id,
            first_name="Synthetic",
            last_name="Signer",
            sex=Gender.MALE,
            program="Medicina",
            campus="Principal",
        )
    )
    assignment_actor = User(
        email=f"assignment-actor-{uuid.uuid4().hex}@test.invalid",
        hashed_password=hash_password("SyntheticOnly123!"),
        role=Role.APP_ADMIN,
        is_active=True,
    )
    db.add(assignment_actor)
    await db.flush()
    db.add(
        Profile(
            user_id=assignment_actor.id,
            first_name="Synthetic",
            last_name="Assignment Actor",
            sex=Gender.MALE,
        )
    )
    await db.flush()
    db.add(
        CertificateSignerAssignment(
            program="Medicina",
            campus="Principal",
            admin_id=signer.id,
            assigned_by_id=assignment_actor.id,
            active=True,
        )
    )
    image = Image.new("RGBA", (64, 24), (10, 40, 80, 255))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    signature_bytes = buffer.getvalue()
    key = f"private/{uuid.uuid4().hex}.png"
    storage = MemoryPrivateStorage()
    storage.files[key] = signature_bytes
    signature = CertificateSignature(
        admin_id=signer.id,
        storage_key=key,
        sha256=hashlib.sha256(signature_bytes).hexdigest(),
        is_active=True,
    )
    db.add(signature)
    await db.commit()
    return CertificateService(db, storage), signer, storage
