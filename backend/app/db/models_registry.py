"""Central model registry — imports all models so Alembic can detect them."""

# This file must be imported by alembic/env.py so that all models
# are registered with Base.metadata before autogenerate runs.

from app.db.base import Base  # noqa: F401
from app.modules.audit.models import AuditLog  # noqa: F401
from app.modules.auth.models import PasswordResetToken  # noqa: F401
from app.modules.communications.models import (  # noqa: F401
    CommunicationMessage,
    CommunicationThread,
)
from app.modules.evidence.models import EvidenceBatch, EvidenceFile  # noqa: F401
from app.modules.notifications.models import DeviceToken, Notification  # noqa: F401

# Import every model module to register them with SQLAlchemy
from app.modules.users.models import Profile, User  # noqa: F401
from app.modules.vaccination_scheme.models import StudentVaccine, StudentVaccineDose  # noqa: F401
from app.modules.vaccines.models import Vaccine, VaccineDoseConfig, VaccineRule  # noqa: F401
