"""Tests for evidence permission checks."""

import uuid

import pytest
from app.common.enums import Role
from app.core.exceptions import ForbiddenException
from app.modules.evidence.models import EvidenceBatch, EvidenceFile
from app.modules.evidence.service import EvidenceService
from app.modules.users.models import User


class MockStorage:
    async def download(self, path):
        return b"fake content"


@pytest.mark.asyncio
async def test_student_cannot_download_others_evidence():
    # Setup
    student1_id = uuid.uuid4()
    student2 = User(id=uuid.uuid4(), role=Role.STUDENT)

    student1 = User(id=student1_id, role=Role.STUDENT)
    batch = EvidenceBatch(id=uuid.uuid4(), user_id=student1_id, user=student1)
    file = EvidenceFile(
        id=uuid.uuid4(),
        batch=batch,
        original_filename="test.pdf",
        mime_type="application/pdf",
        stored_path="path/to/file",
    )

    async def mock_get_file(_, fid):
        return file if fid == file.id else None

    mock_repo = type("MockRepo", (), {"get_file_by_id": mock_get_file, "db": None})()

    service = EvidenceService(mock_repo, MockStorage())

    # Execute & Assert
    with pytest.raises(ForbiddenException) as excinfo:
        await service.download_file_for_user(student2, file.id)

    assert "No tienes permiso" in str(excinfo.value.detail)


@pytest.mark.asyncio
async def test_student_can_download_own_evidence():
    # Setup
    student_id = uuid.uuid4()
    student = User(id=student_id, role=Role.STUDENT)

    batch = EvidenceBatch(id=uuid.uuid4(), user_id=student_id, user=student)
    file = EvidenceFile(
        id=uuid.uuid4(),
        batch=batch,
        original_filename="test.pdf",
        mime_type="application/pdf",
        stored_path="path/to/file",
    )

    async def mock_get_file(_, fid):
        return file if fid == file.id else None

    mock_repo = type("MockRepo", (), {"get_file_by_id": mock_get_file, "db": None})()

    service = EvidenceService(mock_repo, MockStorage())

    # Execute
    filename, mime, content = await service.download_file_for_user(student, file.id)

    # Assert
    assert filename == "test.pdf"
    assert content == b"fake content"


@pytest.mark.asyncio
async def test_admin_can_download_student_evidence():
    # Setup
    student_id = uuid.uuid4()
    student = User(id=student_id, role=Role.STUDENT)
    admin = User(id=uuid.uuid4(), role=Role.APP_ADMIN)

    batch = EvidenceBatch(id=uuid.uuid4(), user_id=student_id, user=student)
    file = EvidenceFile(
        id=uuid.uuid4(),
        batch=batch,
        original_filename="test.pdf",
        mime_type="application/pdf",
        stored_path="path/to/file",
    )

    async def mock_get_file(_, fid):
        return file if fid == file.id else None

    mock_repo = type("MockRepo", (), {"get_file_by_id": mock_get_file, "db": None})()

    service = EvidenceService(mock_repo, MockStorage())

    # Execute
    filename, mime, content = await service.download_file_for_user(admin, file.id)

    # Assert
    assert filename == "test.pdf"
    assert content == b"fake content"
