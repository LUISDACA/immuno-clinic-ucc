"""Shared test fixtures for ImmunoClinic integration tests."""

import asyncio
import os
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["REFRESH_SECRET_KEY"] = "test-refresh-secret-key"
os.environ["DEBUG"] = "true"
os.environ["VACCINE_REMINDER_ENABLED"] = "false"

import app.db.models_registry  # noqa: F401 — register all models
import pytest
import pytest_asyncio
from app.common.enums import Gender, Role
from app.core.security import hash_password
from app.db.base import Base
from app.modules.users.models import Profile, User
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
