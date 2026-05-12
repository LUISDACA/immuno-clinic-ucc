"""Admin module — dependency container for shared resources.

This replaces the old facade pattern where AdminService was a god-object
delegating every single method. Now it only holds shared dependencies
that sub-services need, while the router calls sub-services directly.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.accounts.service import AdminAccountService
from app.modules.admin.dose_reviews.service import DoseReviewService
from app.modules.admin.reports.repository import AdminStudentReportRepository
from app.modules.admin.reports.service import AdminReportService
from app.modules.admin.students.service import StudentAdminService
from app.modules.admin.vaccines.service import VaccineCatalogService
from app.modules.audit.service import AuditService
from app.modules.notifications.repository import NotificationRepository
from app.modules.notifications.service import NotificationService
from app.modules.users.repository import UserRepository
from app.modules.vaccination_scheme.repository import SchemeRepository, VaccineRepository
from app.modules.vaccination_scheme.service import SchemeService


class AdminDependencies:
    """Shared dependency container for admin sub-services.

    Instead of a facade that proxies every method, this class provides
    lazy-initialised sub-services. The router picks only what it needs.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.scheme_service = SchemeService(SchemeRepository(db), VaccineRepository(db))
        self.audit = AuditService(db)
        self.notifications = NotificationService(NotificationRepository(db))

    @property
    def student_service(self) -> StudentAdminService:
        return StudentAdminService(
            self.db,
            self.user_repo,
            self.scheme_service,
            self.audit,
            self.notifications,
        )

    @property
    def report_service(self) -> AdminReportService:
        return AdminReportService(AdminStudentReportRepository(self.db))

    @property
    def dose_review_service(self) -> DoseReviewService:
        return DoseReviewService(
            self.db,
            self.user_repo,
            self.scheme_service,
            self.audit,
            self.notifications,
        )

    @property
    def account_service(self) -> AdminAccountService:
        return AdminAccountService(self.db, self.user_repo, self.audit)

    @property
    def vaccine_catalog_service(self) -> VaccineCatalogService:
        return VaccineCatalogService(self.db, self.scheme_service, self.audit)
