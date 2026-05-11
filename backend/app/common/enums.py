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

    PENDING = "pending"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    DENIED = "denied"


class VaccineStatus(str, enum.Enum):
    """Aggregated review status of a student's vaccine (recalculated from doses)."""

    PENDING = "pending"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    DENIED = "denied"


class EvidenceBatchStatus(str, enum.Enum):
    """Status of an evidence document batch."""

    UPLOADED = "uploaded"
    UNDER_REVIEW = "under_review"
    REVIEWED = "reviewed"


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
    VACCINE_REVIEWED = "vaccine.reviewed"
    EVIDENCE_UPLOADED = "evidence.uploaded"
    EVIDENCE_DELETED = "evidence.deleted"
    PASSWORD_CHANGED = "password.changed"
    PASSWORD_RESET = "password.reset"
    VACCINE_CREATED = "vaccine.created"
    VACCINE_UPDATED = "vaccine.updated"
    VACCINE_DEACTIVATED = "vaccine.deactivated"
    VACCINE_REACTIVATED = "vaccine.reactivated"
