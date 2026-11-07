"""Shared enumerations used across the entire domain."""

import enum


class Role(str, enum.Enum):
    """User roles in the system."""

    APP_ADMIN = "app_admin"
    ADMIN = "admin"
    STUDENT = "student"


class Gender(str, enum.Enum):
    """Biological sex — drives vaccine dose rules."""

    MALE = "male"
    FEMALE = "female"


class DoseStatus(str, enum.Enum):
    """Review status of an individual vaccine dose."""

    IN_REVIEW = "in_review"
    # Compatibility name only: PENDING is not a separate clinical status.
    PENDING = "in_review"
    APPROVED = "approved"
    DENIED = "denied"


class VaccineStatus(str, enum.Enum):
    """Aggregated review status of a student's vaccine (recalculated from doses)."""

    IN_REVIEW = "in_review"
    # Compatibility name only: report consumers may call this PENDING.
    PENDING = "in_review"
    APPROVED = "approved"
    DENIED = "denied"


class EvidenceBatchStatus(str, enum.Enum):
    """Status of an evidence document batch."""

    IN_REVIEW = "in_review"
    APPROVED = "approved"
    DENIED = "denied"
    # Legacy values are retained for historical row decoding during transition.
    UPLOADED = "uploaded"
    UNDER_REVIEW = "under_review"
    REVIEWED = "reviewed"


class EvidenceReviewStatus(str, enum.Enum):
    """Current evidence review decisions accepted by the API."""

    IN_REVIEW = "in_review"
    APPROVED = "approved"
    DENIED = "denied"


class ConversationStatus(str, enum.Enum):
    """Status of an admin-student communication thread."""

    OPEN = "open"
    CLOSED = "closed"


class AppliesTo(str, enum.Enum):
    """Gender applicability for vaccines and dose configs."""

    ALL = "all"
    MALE = "male"
    FEMALE = "female"


class DoseType(str, enum.Enum):
    """Type of dose within a vaccine configuration."""

    STANDARD = "standard"
    BOOSTER = "booster"
    TITER = "titer"


class AuditAction(str, enum.Enum):
    """Tracked audit actions."""

    STUDENT_CREATED = "student.created"
    ADMIN_CREATED = "admin.created"
    ADMIN_DELETED = "admin.deleted"
    STUDENT_DEACTIVATED = "student.deactivated"
    STUDENT_REACTIVATED = "student.reactivated"
    STUDENT_DELETED = "student.deleted"
    PROFILE_UPDATED = "profile.updated"
    SEX_CHANGED = "sex.changed"
    SCHEME_REGENERATED = "scheme.regenerated"
    DOSE_UPDATED = "dose.updated"
    DOSE_REVIEWED = "dose.reviewed"
    DOSE_COMMENT_UPDATED = "dose.comment_updated"
    VACCINE_REVIEWED = "vaccine.reviewed"
    EVIDENCE_UPLOADED = "evidence.uploaded"
    EVIDENCE_REVIEWED = "evidence.reviewed"
    EVIDENCE_DELETED = "evidence.deleted"
    PASSWORD_CHANGED = "password.changed"
    PASSWORD_RESET = "password.reset"
    SIGNATURE_UPLOADED = "SIGNATURE_UPLOADED"
    SIGNATURE_REPLACED = "SIGNATURE_REPLACED"
    VACCINE_CREATED = "vaccine.created"
    VACCINE_UPDATED = "vaccine.updated"
    VACCINE_DEACTIVATED = "vaccine.deactivated"
    VACCINE_REACTIVATED = "vaccine.reactivated"
