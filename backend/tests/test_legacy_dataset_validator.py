"""Offline migration comparison tests using synthetic-only fixtures."""

import copy
import json
from pathlib import Path

import pytest
from validation.legacy_compare import compare_legacy_exports

FIXTURES = Path(__file__).parent / "fixtures"


def _fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_synthetic_legacy_fixtures_compare_without_changes():
    before = _fixture("t03_legacy_before.json")
    after = _fixture("t03_legacy_after.json")

    report = compare_legacy_exports(before, after)

    assert before["synthetic_only"] and after["synthetic_only"]
    assert report["valid"] is True
    assert report["issue_count"] == 0
    assert report["before_counts"] == {
        "assignments": 2,
        "doses": 3,
        "evidence": 2,
        "eligibility": 1,
    }


@pytest.mark.parametrize(
    ("mutation", "expected"),
    [
        ("loss", "RECORD_LOST"),
        ("status", "STATUS_CHANGED"),
        ("date", "APPLICATION_DATE_CHANGED"),
        ("review", "REVIEWER_CHANGED"),
        ("duplicate", "DUPLICATE_OR_MISSING_ID"),
        ("bad_association", "ASSOCIATION_OWNER_MISMATCH"),
        ("eligibility", "ELIGIBILITY_CHANGED"),
    ],
)
def test_validator_reports_legacy_invariant_breaks_without_values(mutation, expected):
    before = _fixture("t03_legacy_before.json")
    after = copy.deepcopy(before)
    if mutation == "loss":
        after["records"]["doses"].pop(0)
    elif mutation == "status":
        after["records"]["doses"][0]["status"] = "denied"
    elif mutation == "date":
        after["records"]["doses"][0]["applied_date"] = "2014-03-01"
    elif mutation == "review":
        after["records"]["doses"][0]["reviewed_by"] = None
    elif mutation == "duplicate":
        after["records"]["doses"].append(copy.deepcopy(after["records"]["doses"][0]))
    elif mutation == "bad_association":
        after["records"]["evidence"][0]["dose_id"] = "dose-old"
        after["records"]["evidence"][0]["owner_id"] = "student-b"
    elif mutation == "eligibility":
        after["records"]["eligibility"][0]["is_certifiable"] = True

    report = compare_legacy_exports(before, after)

    assert report["valid"] is False
    assert expected in {issue["code"] for issue in report["issues"]}
    serialized = json.dumps(report)
    assert "2014-03-01" not in serialized
    assert "student-a" not in serialized


def test_t02_profile_fixture_has_all_reconciliation_triggers():
    fixture = _fixture("t02_profile_changes.json")
    assert fixture["synthetic_only"] is True
    assert {case["field"] for case in fixture["cases"]} == {"sex", "program", "campus"}
