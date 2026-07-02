from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services.entities import serialize_user
from app.services.seed import DEFAULT_MODULES, create_restaurant_bundle


router = APIRouter(prefix="/auth", tags=["auth"])


def auth_response(user: User) -> dict:
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "user": serialize_user(user),
    }


@router.post("/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> dict:
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El email ya esta registrado")

    slug = payload.email.split("@")[0].lower().replace(".", "-")
    restaurant_id = create_restaurant_bundle(db, payload.nombre, slug=f"{slug}-hostflow")
    user = User(
        nombre=payload.nombre,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role="admin",
        restaurant_id=restaurant_id,
        modulos_permitidos=DEFAULT_MODULES,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return auth_response(user)


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")
    return auth_response(user)


@router.get("/me")
def me(current_user: User = Depends(get_current_user)) -> dict:
    return serialize_user(current_user)


@router.post("/logout")
def logout() -> dict:
    return {"success": True}
