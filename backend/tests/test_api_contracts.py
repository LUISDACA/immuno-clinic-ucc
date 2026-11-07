"""FastAPI OpenAPI and cross-client drift gates for non-clinical contracts."""

import re
from pathlib import Path

from app.common.api_contracts import PageResponse
from app.common.enums import DoseStatus, EvidenceBatchStatus, VaccineStatus
from app.common.pagination import PaginatedResponse, PaginationParams
from app.main import _api_error, app

ROOT = Path(__file__).resolve().parents[2]
NEXT_TYPES = (ROOT / "frontend-next/src/lib/api/types.ts").read_text()
DART_ENUMS = (ROOT / "frontend/lib/core/models/domain_enums.dart").read_text()
DART_VACCINE = (ROOT / "frontend/lib/features/student/data/models/vaccine_model.dart").read_text()


def _openapi_enum(schema: dict, values: set[str]) -> bool:
    return any(
        isinstance(component, dict) and set(component.get("enum", [])) == values
        for component in schema["components"]["schemas"].values()
    )


def _typescript_enum(name: str) -> set[str]:
    match = re.search(rf"export type {name}\s*=([^;]+);", NEXT_TYPES)
    assert match, f"Missing TypeScript type alias {name}"
    return set(re.findall(r'"([^"\n]+)"', match.group(1)))


def test_backend_status_enums_are_present_in_openapi_and_client_types():
    schema = app.openapi()
    dose_values = {item.value for item in DoseStatus}
    vaccine_values = {item.value for item in VaccineStatus}
    evidence_values = {item.value for item in EvidenceBatchStatus}

    assert _openapi_enum(schema, dose_values)
    assert _openapi_enum(schema, vaccine_values)
    assert _openapi_enum(schema, evidence_values)
    assert dose_values == _typescript_enum("DoseStatus")
    assert vaccine_values == _typescript_enum("VaccineStatus")
    assert evidence_values <= _typescript_enum("EvidenceBatchStatus")
    assert "static DoseStatus fromWire(" in DART_ENUMS
    assert "static VaccineStatus fromWire(" in DART_ENUMS
    assert "final DoseStatus status;" in DART_VACCINE
    assert "final VaccineStatus status;" in DART_VACCINE


def test_openapi_exposes_date_and_datetime_with_nullable_contracts():
    schema = app.openapi()["components"]["schemas"]
    dose = schema["StudentDoseResponse"]["properties"]
    profile = schema["ProfileResponse"]["properties"]

    def members(field):
        shape = field.get("anyOf", [field])
        return [member for member in shape if isinstance(member, dict)]

    assert any(member.get("format") == "date" for member in members(dose["applied_date"]))
    assert "is_overdue" in dose
    assert "is_due_today" in dose
    assert any(member.get("type") == "null" for member in members(dose["applied_date"]))
    assert any(member.get("format") == "date-time" for member in members(dose["reviewed_at"]))
    assert any(member.get("type") == "null" for member in members(profile["birth_date"]))
    assert "applied_date: string | null;" in NEXT_TYPES
    assert "birth_date?: string | null;" in NEXT_TYPES


def test_error_envelope_is_published_and_preserves_legacy_detail_safely():
    schema = app.openapi()
    assert "ApiErrorResponse" in schema["components"]["schemas"]
    error_response = schema["components"]["schemas"]["ApiErrorResponse"]["properties"]
    assert {"code", "message", "details", "detail"}.issubset(error_response)

    payload = _api_error(
        422,
        [{"loc": ["body", "password"], "msg": "invalid", "type": "value_error"}],
        details={"field_errors": [{"loc": ["body", "password"], "type": "value_error"}]},
    )
    assert payload["code"] == "INVALID_REQUEST"
    assert payload["message"] == "La solicitud no es válida."
    assert payload["details"]["field_errors"][0]["type"] == "value_error"
    assert "input" not in str(payload["details"])
    assert "detail" in payload  # compatibility for existing clients


def test_error_status_mapping_is_stable_and_does_not_echo_legacy_details_as_message():
    expected = {
        400: "BAD_REQUEST",
        401: "UNAUTHENTICATED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "INVALID_REQUEST",
        429: "RATE_LIMITED",
        500: "INTERNAL_ERROR",
        503: "SERVICE_UNAVAILABLE",
    }
    for status_code, code in expected.items():
        payload = _api_error(status_code, "legacy value that is not a public message")
        assert payload["code"] == code
        assert payload["message"] != payload["detail"]
        assert payload["details"] is None


def test_page_contract_is_additive_and_handles_empty_results():
    page = PageResponse.create([], total=0, page=1, size=20)
    payload = page.model_dump()

    assert payload == {
        "page": 1,
        "size": 20,
        "total": 0,
        "pages": 0,
        "has_next": False,
        "has_previous": False,
        "page_size": 20,
        "total_pages": 0,
        "items": [],
    }
    assert {"size", "pages", "has_next", "has_previous"}.issubset(
        {
            key
            for component in app.openapi()["components"]["schemas"].values()
            for key in component.get("properties", {})
        }
    )


def test_pagination_accepts_canonical_size_and_legacy_page_size():
    canonical = PaginationParams(page=2, size=10)
    legacy = PaginationParams(page=2, page_size=10)

    assert canonical.offset == legacy.offset == 10
    assert canonical.limit == legacy.limit == 10
    payload = PaginatedResponse.create(["one"], total=11, params=canonical).model_dump()
    assert payload["size"] == payload["page_size"] == 10
    assert payload["pages"] == payload["total_pages"] == 2
    assert payload["has_next"] is False
    assert payload["has_previous"] is True


def test_certificate_verifier_openapi_is_public_and_minimal():
    schema = app.openapi()
    operation = schema["paths"]["/verify/{public_id}"]["get"]
    assert operation.get("security", []) == []
    model = schema["components"]["schemas"]["CertificateVerificationResponse"]
    properties = model["properties"]
    assert set(properties) == {"status", "integrity", "document_sha256", "issued_at", "revoked_at"}
    assert properties["status"]["enum"] == ["VALID", "REVOKED", "NOT_FOUND", "INVALID"]
    assert properties["integrity"]["enum"] == ["NOT_CHECKED", "MATCH", "MISMATCH"]
