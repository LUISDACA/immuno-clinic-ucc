from types import SimpleNamespace
from uuid import uuid4

import pytest
from app.common.enums import Role
from app.core.exceptions import BadRequestException, ForbiddenException
from app.modules.admin.accounts.service import AdminAccountService
from app.modules.admin.schemas import CreateAdminRequest


class _FakeRepo:
    def __init__(self) -> None:
        self.user = None
        self.profile = None

    async def get_by_email(self, _email):
        return None

    async def create_user(self, user):
        user.id = uuid4()
        self.user = user
        return user

    async def create_profile(self, profile):
        self.profile = profile
        self.user.profile = profile
        return profile

    async def get_by_id(self, _user_id):
        return self.user


class _FakeAudit:
    def __init__(self) -> None:
        self.details = None

    async def log(self, **kwargs):
        self.details = kwargs["details"]


class _FakeDb:
    async def commit(self):
        return None


class TestAdminAccountService:
    def test_non_app_admin_is_rejected(self) -> None:
        service = AdminAccountService.__new__(AdminAccountService)
        user = SimpleNamespace(role=Role.ADMIN)

        with pytest.raises(ForbiddenException):
            service._ensure_app_admin(user, "crear administradores")

    @pytest.mark.asyncio
    async def test_app_admin_cannot_delete_own_account(self) -> None:
        service = AdminAccountService.__new__(AdminAccountService)
        service.user_repo = SimpleNamespace()
        service.audit = SimpleNamespace()
        service.db = SimpleNamespace()
        app_admin_id = uuid4()
        app_admin = SimpleNamespace(id=app_admin_id, role=Role.APP_ADMIN)

        with pytest.raises(BadRequestException):
            await service.delete_admin(app_admin, app_admin_id)

    @pytest.mark.asyncio
    async def test_create_admin_stores_job_title(self) -> None:
        service = AdminAccountService.__new__(AdminAccountService)
        service.user_repo = _FakeRepo()
        service.audit = _FakeAudit()
        service.db = _FakeDb()
        app_admin = SimpleNamespace(id=uuid4(), role=Role.APP_ADMIN)

        admin = await service.create_admin(
            app_admin,
            CreateAdminRequest(
                email="normal.admin@test.com",
                password="Admin123!",
                first_name="Ana",
                last_name="Perez",
                job_title="Coordinadora",
                program="Medicina",
                campus="Cali",
            ),
        )

        assert admin.profile.first_name == "Ana"
        assert admin.profile.last_name == "Perez"
        assert admin.profile.job_title == "Coordinadora"
        assert service.audit.details["job_title"] == "Coordinadora"
