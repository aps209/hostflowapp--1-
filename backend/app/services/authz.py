from app.models.user import User


PLAN_STANDARD = "STANDARD"
PLAN_PREMIUM = "PREMIUM"
PLAN_ULTRA = "ULTRA"
ROLE_CEO = "CEO"
ROLE_WORKER = "WORKER"


def normalize_role(role: str | None) -> str:
    if (role or "").upper() in {ROLE_CEO, "ADMIN"}:
        return ROLE_CEO
    return ROLE_WORKER


def plan_permissions(plan: str | None, role: str | None) -> list[str]:
    normalized_plan = (plan or PLAN_ULTRA).upper()
    normalized_role = normalize_role(role)

    permissions = {"dashboard"}
    if normalized_role == ROLE_CEO and normalized_plan in {PLAN_PREMIUM, PLAN_ULTRA}:
        permissions.add("crm")
        permissions.add("user_management")
    if normalized_role == ROLE_CEO and normalized_plan == PLAN_ULTRA:
        permissions.add("chatbot")
        permissions.add("cost_intelligence")
    return sorted(permissions)


def user_plan(user: User) -> str:
    modules = user.modulos_permitidos or {}
    return str(modules.get("plan") or PLAN_ULTRA).upper()


def user_permissions(user: User) -> list[str]:
    explicit = (user.modulos_permitidos or {}).get("permissions")
    plan_based = plan_permissions(user_plan(user), user.role)
    if isinstance(explicit, list) and explicit:
        return sorted(set(explicit) | set(plan_based))
    return plan_based


def has_permission(user: User, permission: str) -> bool:
    return permission in user_permissions(user)
