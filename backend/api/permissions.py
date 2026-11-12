"""Role-based permissions (FR-06). Roles stay separate so the person who
films or uploads a sign never approves it, and content uploaders cannot
manage users."""

from rest_framework.permissions import BasePermission

from .models import Role, role_of


def has_role(*roles):
    class _HasRole(BasePermission):
        message = "Your account does not have permission for this."

        def has_permission(self, request, view):
            return role_of(request.user) in roles

    _HasRole.__name__ = "HasRole_" + "_".join(roles)
    return _HasRole


IsTeacher = has_role(Role.TEACHER, Role.ADMIN)
IsReviewer = has_role(Role.REVIEWER)
IsAdmin = has_role(Role.ADMIN)
