"""Real HTTP/database integration fixtures; only isolated synthetic data."""

import asyncio
import os
import uuid
from email import policy
from email.parser import BytesParser

import pytest_asyncio
from app.common.enums import Gender, Role
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.modules.certificates.models import CertificateSignerAssignment
from app.modules.users.models import Profile, User
from app.storage.base import LocalStorageService, get_storage_service
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


@pytest_asyncio.fixture
async def integration_engine(tmp_path):
    url = os.environ.get("PHASE1_INTEGRATION_URL")
    schema = "phase1_" + uuid.uuid4().hex
    if url:
        parsed = make_url(url)
        assert (parsed.database or "").startswith("immuno_phase1_")
        assert parsed.host in (None, "localhost", "127.0.0.1")
        engine = create_async_engine(url, connect_args={"server_settings": {"search_path": schema}})
        async with engine.begin() as conn:
            await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    else:
        # A file-backed pool gives each concurrent request its own connection.
        # StaticPool on :memory: shares one connection across transactions.
        engine = create_async_engine(
            f"sqlite+aiosqlite:///{tmp_path / 'http.db'}", pool_pre_ping=True
        )
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        yield engine
    finally:
        if url:
            async with engine.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        await engine.dispose()


@pytest_asyncio.fixture
async def integration_client(integration_engine, tmp_path):
    sessions = async_sessionmaker(integration_engine, expire_on_commit=False)

    async def database():
        async with sessions() as session:
            yield session

    storage = LocalStorageService(str(tmp_path / "uploads"))
    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_storage_service] = lambda: storage
    limiter._storage.reset()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


@pytest_asyncio.fixture
async def integration_accounts(integration_engine):
    sessions = async_sessionmaker(integration_engine, expire_on_commit=False)
    accounts = {}
    async with sessions() as db:
        for name, role, campus in (
            ("student", Role.STUDENT, "Bogotá"),
            ("other", Role.STUDENT, "Bogotá"),
            ("admin", Role.ADMIN, "Bogotá"),
            ("outside", Role.ADMIN, "Cali"),
            ("app_admin", Role.APP_ADMIN, "Bogotá"),
        ):
            user = User(
                email=f"{name}@example.com",
                hashed_password=hash_password("SyntheticOnly123!"),
                role=role,
                is_active=True,
            )
            db.add(user)
            await db.flush()
            db.add(
                Profile(
                    user_id=user.id,
                    first_name="Synthetic",
                    last_name=name,
                    sex=Gender.FEMALE,
                    program="Medicina",
                    campus=campus,
                )
            )
            accounts[name] = user.id
        db.add(
            CertificateSignerAssignment(
                program="Medicina",
                campus="Bogotá",
                admin_id=accounts["admin"],
                assigned_by_id=accounts["app_admin"],
                active=True,
            )
        )
        await db.commit()
    return accounts


class SMTPInbox:
    """Minimal local SMTP peer exercising aiosmtplib over a real socket."""

    def __init__(self):
        self.messages = []
        self.reject = False

    async def handle(self, reader, writer):
        async def reply(value):
            writer.write(value + b"\r\n")
            await writer.drain()

        try:
            await reply(b"220 localhost synthetic SMTP")
            while line := await reader.readline():
                command = line.split(b" ", 1)[0].strip().upper()
                if command in (b"EHLO", b"HELO"):
                    await reply(b"250 localhost")
                elif command == b"RCPT" and self.reject:
                    await reply(b"550 synthetic rejection")
                elif command == b"DATA":
                    await reply(b"354 send message")
                    data = bytearray()
                    while (part := await reader.readline()) not in (b".\r\n", b""):
                        data.extend(part[1:] if part.startswith(b"..") else part)
                    self.messages.append(BytesParser(policy=policy.default).parsebytes(bytes(data)))
                    await reply(b"250 accepted")
                elif command == b"QUIT":
                    await reply(b"221 bye")
                    break
                else:
                    await reply(b"250 ok")
        finally:
            writer.close()
            await writer.wait_closed()


@pytest_asyncio.fixture
async def smtp_inbox(monkeypatch):
    inbox = SMTPInbox()
    server = await asyncio.start_server(inbox.handle, "127.0.0.1", 0)
    for name, value in {
        "EMAIL_ENABLED": True,
        "SENDGRID_API_KEY": None,
        "SMTP_HOST": "127.0.0.1",
        "SMTP_PORT": server.sockets[0].getsockname()[1],
        "SMTP_USER": "",
        "SMTP_PASSWORD": "",
        "SMTP_FROM": "noreply@example.com",
        "FRONTEND_URL": "https://app.example.com",
        "PASSWORD_RESET_URL_BASE": None,
    }.items():
        monkeypatch.setattr(settings, name, value)
    async with server:
        yield inbox
