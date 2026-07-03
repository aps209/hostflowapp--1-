from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.security import hash_password
from app.db.database import get_db
from app.models.user import User
from app.schemas.users import WorkerCreateRequest, WorkerUpdateRequest
from app.services.authz import plan_permissions, user_plan
from app.services.entities import serialize_user


router = APIRouter(prefix="/users", tags=["users"])


def ensure_can_manage_users(current_user: User) -> None:
    plan = user_plan(current_user)
    if (current_user.role or "").upper() not in {"CEO", "ADMIN"} or plan not in {"PREMIUM", "ULTRA"}:
        raise HTTPException(status_code=403, detail="Tu plan no permite gestionar trabajadores")


@router.get("")
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user_management")),
) -> list[dict]:
    ensure_can_manage_users(current_user)
    query = db.query(User)
    if current_user.company_id:
        query = query.filter(User.company_id == current_user.company_id)
    else:
        query = query.filter(User.restaurant_id == current_user.restaurant_id)
    return [serialize_user(user) for user in query.order_by(User.created_date.desc()).all()]


@router.post("")
def create_worker(
    payload: WorkerCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user_management")),
) -> dict:
    ensure_can_manage_users(current_user)
    if payload.role.upper() != "WORKER":
        raise HTTPException(status_code=400, detail="Solo se pueden crear usuarios WORKER desde el dashboard")
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="El email ya esta registrado")

    modules = {
        "dashboard_principal": True,
        "crm_privado": False,
        "ai_manager": False,
        "cost_intelligence": False,
        "plan": user_plan(current_user),
        "permissions": plan_permissions(user_plan(current_user), "WORKER"),
    }
    user = User(
        nombre=payload.full_name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        pin_hash=hash_password(payload.pin),
        role="WORKER",
        company_id=current_user.company_id,
        restaurant_id=current_user.restaurant_id,
        is_active=True,
        modulos_permitidos=modules,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@router.patch("/{user_id}")
def update_worker(
    user_id: str,
    payload: WorkerUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user_management")),
) -> dict:
    ensure_can_manage_users(current_user)
    user = db.get(User, user_id)
    if not user or user.company_id != current_user.company_id or user.id == current_user.id:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if (user.role or "").upper() == "CEO":
        raise HTTPException(status_code=400, detail="No se puede modificar el CEO desde esta pantalla")
    if payload.full_name is not None:
        user.nombre = payload.full_name
    if payload.is_active is not None:
        user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@router.delete("/{user_id}")
def deactivate_worker(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user_management")),
) -> dict:
    ensure_can_manage_users(current_user)
    user = db.get(User, user_id)
    if not user or user.company_id != current_user.company_id or user.id == current_user.id:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if (user.role or "").upper() == "CEO":
        raise HTTPException(status_code=400, detail="No se puede desactivar el CEO")
    user.is_active = False
    db.commit()
    return {"success": True, "id": user_id}
