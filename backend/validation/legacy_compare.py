"""Compare before/after exports without logging clinical field values.

The JSON format is intentionally transport-only. Authorized datasets can be
validated offline later; this module never connects to application databases.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from collections import Counter
from pathlib import Path
from typing import Any

RECORD_GROUPS = ("assignments", "doses", "evidence", "eligibility")
SENSITIVE_FIELDS = {
    "status",
    "applied_date",
    "reviewed_by",
    "reviewed_at",
    "dose_id",
    "is_up_to_date",
    "is_complete",
    "is_certifiable",
}


def _fingerprint(value: Any, salt: bytes) -> str:
    """Produce a per-run opaque identifier; raw IDs and reusable hashes never escape."""
    return hmac.new(salt, str(value).encode("utf-8"), hashlib.sha256).hexdigest()[:12]


def _records(document: dict[str, Any], group: str) -> list[dict[str, Any]]:
    records = document.get("records", {}).get(group, [])
    if not isinstance(records, list) or any(not isinstance(row, dict) for row in records):
        raise ValueError(f"Invalid records group: {group}")
    return records


def _index(
    document: dict[str, Any],
    group: str,
    issues: list[dict[str, str]],
    report_salt: bytes,
) -> dict[str, dict]:
    rows = _records(document, group)
    counts = Counter(str(row.get("id", "")) for row in rows)
    for record_id, count in counts.items():
        if not record_id or count > 1:
            issues.append(
                {
                    "code": "DUPLICATE_OR_MISSING_ID",
                    "group": group,
                    "record": _fingerprint(record_id, report_salt),
                }
            )
    return {str(row["id"]): row for row in rows if row.get("id") is not None}


def compare_legacy_exports(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    """Return invariant violations, omitting source values and raw identifiers."""
    if before.get("format_version") != 1 or after.get("format_version") != 1:
        raise ValueError("Both exports must use format_version 1")

    report_salt = secrets.token_bytes(32)
    issues: list[dict[str, str]] = []
    before_rows = {group: _index(before, group, issues, report_salt) for group in RECORD_GROUPS}
    after_rows = {group: _index(after, group, issues, report_salt) for group in RECORD_GROUPS}

    for group in RECORD_GROUPS:
        old, new = before_rows[group], after_rows[group]
        for record_id in old.keys() - new.keys():
            issues.append(
                {
                    "code": "RECORD_LOST",
                    "group": group,
                    "record": _fingerprint(record_id, report_salt),
                }
            )
        for record_id in new.keys() - old.keys():
            issues.append(
                {
                    "code": "RECORD_ADDED",
                    "group": group,
                    "record": _fingerprint(record_id, report_salt),
                }
            )
        for record_id in old.keys() & new.keys():
            left, right = old[record_id], new[record_id]
            for field in sorted(left.keys() | right.keys()):
                if field in left and field in right and left[field] == right[field]:
                    continue
                code = {
                    "status": "STATUS_CHANGED",
                    "applied_date": "APPLICATION_DATE_CHANGED",
                    "reviewed_by": "REVIEWER_CHANGED",
                    "reviewed_at": "REVIEW_DATE_CHANGED",
                    "dose_id": "ASSOCIATION_CHANGED",
                    "is_up_to_date": "ELIGIBILITY_CHANGED",
                    "is_complete": "ELIGIBILITY_CHANGED",
                    "is_certifiable": "ELIGIBILITY_CHANGED",
                }.get(field, "FIELD_CHANGED")
                if field not in {
                    "status",
                    "applied_date",
                    "reviewed_by",
                    "reviewed_at",
                    "dose_id",
                    "is_up_to_date",
                    "is_complete",
                    "is_certifiable",
                }:
                    if field.endswith("_date"):
                        code = "DATE_CHANGED"
                    elif field.endswith("_at"):
                        code = "TIMESTAMP_CHANGED"
                issues.append(
                    {
                        "code": code,
                        "group": group,
                        "record": _fingerprint(record_id, report_salt),
                        "field": field if field in SENSITIVE_FIELDS else "other",
                    }
                )

    # Validate references against the after-state, where associations are used.
    after_doses = after_rows["doses"]
    after_assignments = after_rows["assignments"]
    owners = {dose_id: row.get("owner_id") for dose_id, row in after_doses.items()}
    assignment_owners = {
        assignment_id: row.get("owner_id") for assignment_id, row in after_assignments.items()
    }
    semantic_dose_keys = Counter(
        (row.get("owner_id"), row.get("assignment_id"), row.get("dose_number"))
        for row in after_doses.values()
    )
    for key, count in semantic_dose_keys.items():
        if count > 1:
            issues.append(
                {
                    "code": "DUPLICATE_DOSE_KEY",
                    "group": "doses",
                    "record": _fingerprint("|".join(str(value) for value in key), report_salt),
                }
            )
    for dose_id, dose in after_doses.items():
        assignment_id = dose.get("assignment_id")
        if assignment_id is not None and str(assignment_id) not in after_assignments:
            issues.append(
                {
                    "code": "ASSOCIATION_TARGET_MISSING",
                    "group": "doses",
                    "record": _fingerprint(dose_id, report_salt),
                }
            )
        elif assignment_id is not None and dose.get("owner_id") != assignment_owners.get(
            str(assignment_id)
        ):
            issues.append(
                {
                    "code": "ASSOCIATION_OWNER_MISMATCH",
                    "group": "doses",
                    "record": _fingerprint(dose_id, report_salt),
                }
            )
    for evidence_id, evidence in after_rows["evidence"].items():
        dose_id = evidence.get("dose_id")
        if dose_id is None:
            continue
        if str(dose_id) not in after_doses:
            issues.append(
                {
                    "code": "ASSOCIATION_TARGET_MISSING",
                    "group": "evidence",
                    "record": _fingerprint(evidence_id, report_salt),
                }
            )
        elif evidence.get("owner_id") != owners[str(dose_id)]:
            issues.append(
                {
                    "code": "ASSOCIATION_OWNER_MISMATCH",
                    "group": "evidence",
                    "record": _fingerprint(evidence_id, report_salt),
                }
            )

    return {
        "valid": not issues,
        "before_counts": {group: len(before_rows[group]) for group in RECORD_GROUPS},
        "after_counts": {group: len(after_rows[group]) for group in RECORD_GROUPS},
        "issue_count": len(issues),
        "issues": issues,
    }


def compare_files(before_path: str | Path, after_path: str | Path) -> dict[str, Any]:
    """Load two UTF-8 JSON exports and compare them without network access."""
    with Path(before_path).open(encoding="utf-8") as before_file:
        before = json.load(before_file)
    with Path(after_path).open(encoding="utf-8") as after_file:
        after = json.load(after_file)
    return compare_legacy_exports(before, after)
