"""Canonical academic options are exposed to authorized admin clients only."""

import pytest
from app.common.academic import ACADEMIC_PROGRAMS, ACADEMIC_SEMESTERS, CAMPUSES
from app.modules.admin.schemas import CreateStudentRequest
from pydantic import ValidationError

from tests.test_phase1_e2e import login


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["admin", "app_admin"])
async def test_academic_options_returns_canonical_values_for_admin_roles(
    integration_client, integration_accounts, role
):
    headers, _ = await login(integration_client, role, version=2)

    response = await integration_client.get("/api/v1/admin/academic-options", headers=headers)

    assert response.status_code == 200
    assert response.json() == {
        "programs": list(ACADEMIC_PROGRAMS),
        "campuses": list(CAMPUSES),
        "semesters": list(ACADEMIC_SEMESTERS),
    }


def test_canonical_semester_choices_match_flutter_range():
    assert tuple(range(1, 11)) == ACADEMIC_SEMESTERS


def test_new_student_semester_must_be_in_canonical_choices():
    payload = {
        "email": "synthetic.student@example.com",
        "first_name": "Synthetic",
        "last_name": "Student",
        "document_number": "SYNTHETIC-SEMESTER",
        "sex": "female",
    }

    assert CreateStudentRequest(**payload, semester=10).semester == 10
    with pytest.raises(ValidationError):
        CreateStudentRequest(**payload, semester=11)


@pytest.mark.asyncio
async def test_academic_options_denies_student(integration_client, integration_accounts):
    headers, _ = await login(integration_client, "student", version=2)

    response = await integration_client.get("/api/v1/admin/academic-options", headers=headers)

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_academic_options_requires_authentication(integration_client):
    response = await integration_client.get("/api/v1/admin/academic-options")

    assert response.status_code == 401
