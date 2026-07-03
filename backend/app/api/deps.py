from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from app.services.authz import has_permission


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")

    user_id = decode_access_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    if not getattr(user, "is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario desactivado")

    return user


def is_platform_admin(user: User) -> bool:
    return user.email.lower() == settings.platform_admin_email.lower()


def require_permission(permission: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if is_platform_admin(current_user):
            return current_user
        if not has_permission(current_user, permission):
            raise HTTPException(status_code=403, detail="No tienes permiso para este modulo")
        return current_user

    return dependency


def require_role(role: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if is_platform_admin(current_user):
            return current_user
        if (current_user.role or "").upper() != role.upper():
            raise HTTPException(status_code=403, detail="Rol no autorizado")
        return current_user

    return dependency
