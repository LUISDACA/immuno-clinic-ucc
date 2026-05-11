"""Authorization helpers for administrator scope."""

from app.common.enums import Role
from app.core.exceptions import ForbiddenException
from app.modules.users.models import User

ADMIN_ROLES = {Role.ADMIN, Role.APP_ADMIN}


def is_admin_role(role: Role) -> bool:
    return role in ADMIN_ROLES


def is_app_admin(user: User) -> bool:
    return user.role == Role.APP_ADMIN


def require_admin_scope(admin: User) -> tuple[str, str]:
    if is_app_admin(admin):
        raise ForbiddenException("El administrador de aplicacion no necesita alcance")

    profile = admin.profile
    program = profile.program if profile else None
    campus = profile.campus if profile else None
    if not program or not campus:
        raise ForbiddenException("Este administrador no tiene programa y campus asignados")
    return program, campus


def student_in_admin_scope(admin: User, student: User) -> bool:
    if is_app_admin(admin):
        return True
    program, campus = require_admin_scope(admin)
    profile = student.profile
    return bool(profile and profile.program == program and profile.campus == campus)


def ensure_student_in_admin_scope(admin: User, student: User) -> None:
    if not student_in_admin_scope(admin, student):
        raise ForbiddenException("Solo puedes administrar estudiantes de tu programa y campus")
