from fastapi import Depends
from backend.app.core.constants import UserRole
from backend.app.core.exceptions import ForbiddenException


def require_role(*roles: UserRole):
    def _check(current_user=Depends(_get_current_user())):
        if current_user.role not in roles:
            raise ForbiddenException(
                f"Access restricted to: {', '.join(r.value for r in roles)}"
            )
        return current_user
    return _check


def _get_current_user():
    from backend.app.auth.service import get_current_user
    return get_current_user


def require_patient():
    return require_role(UserRole.PATIENT)


def require_doctor():
    return require_role(UserRole.DOCTOR)


def require_manager():
    return require_role(UserRole.MANAGER)


def require_doctor_or_manager():
    return require_role(UserRole.DOCTOR, UserRole.MANAGER)