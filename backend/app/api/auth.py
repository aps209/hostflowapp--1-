from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_temp_login_token,
    decode_token_payload,
    hash_password,
    verify_password,
)
from app.db.database import get_db
from app.models.license import Company
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RegisterCompanyRequest,
    RegisterRequest,
    ValidateLicenseRequest,
    VerifyPinRequest,
)
from app.services.authz import plan_permissions, user_permissions, user_plan
from app.services.entities import serialize_user
from app.services.licenses import find_license, license_is_usable
from app.services.seed import DEFAULT_MODULES, create_restaurant_bundle


router = APIRouter(prefix="/auth", tags=["auth"])


def auth_response(user: User) -> dict:
    serialized = serialize_user(user)
    return {
        "access_token": create_access_token(user.id, {
            "company_id": user.company_id,
            "role": user.role,
            "plan": user_plan(user),
            "permissions": user_permissions(user),
        }),
        "token_type": "bearer",
        "user": serialized,
    }


@router.post("/validate-license")
def validate_license(payload: ValidateLicenseRequest, db: Session = Depends(get_db)) -> dict:
    license_record = find_license(db, payload.license_key)
    if not license_record or not license_is_usable(license_record):
        raise HTTPException(status_code=400, detail="Licencia invalida, activa o caducada")
    return {
        "valid": True,
        "plan": license_record.plan,
        "requires_company_creation": True,
    }


@router.post("/register-company")
def register_company(payload: RegisterCompanyRequest, db: Session = Depends(get_db)) -> dict:
    license_record = find_license(db, payload.license_key)
    if not license_record or not license_is_usable(license_record):
        raise HTTPException(status_code=400, detail="Licencia invalida, activa o caducada")

    existing = db.query(User).filter(User.email == payload.ceo_email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="El email ya esta registrado")

    slug = payload.company_name.lower().replace(" ", "-")[:48]
    restaurant_id = create_restaurant_bundle(db, payload.company_name, slug=f"{slug}-hostflow")
    company = Company(
        name=payload.company_name,
        license_id=license_record.id,
        plan=license_record.plan,
        restaurant_id=restaurant_id,
    )
    db.add(company)
    db.flush()

    modules = {
        **DEFAULT_MODULES,
        "dashboard_principal": True,
        "crm_privado": license_record.plan in {"PREMIUM", "ULTRA"},
        "ai_manager": license_record.plan == "ULTRA",
        "cost_intelligence": license_record.plan == "ULTRA",
        "plan": license_record.plan,
        "permissions": plan_permissions(license_record.plan, "CEO"),
    }
    user = User(
        nombre=payload.ceo_full_name,
        email=payload.ceo_email.lower(),
        password_hash=hash_password(payload.ceo_password),
        pin_hash=hash_password(payload.ceo_pin),
        role="CEO",
        company_id=company.id,
        restaurant_id=restaurant_id,
        is_active=True,
        modulos_permitidos=modules,
    )
    db.add(user)
    license_record.status = "ACTIVE"
    license_record.company_id = company.id
    license_record.activated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return auth_response(user)


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
    if not getattr(user, "is_active", True):
        raise HTTPException(status_code=403, detail="Usuario desactivado")
    if not user.pin_hash:
        return auth_response(user)
    return {
        "requires_pin": True,
        "temporary_token": create_temp_login_token(user.id),
    }


@router.post("/verify-pin")
def verify_pin(payload: VerifyPinRequest, db: Session = Depends(get_db)) -> dict:
    token_payload = decode_token_payload(payload.temporary_token)
    if not token_payload or token_payload.get("type") != "temp_login":
        raise HTTPException(status_code=401, detail="Token temporal invalido")
    user = db.get(User, token_payload.get("sub"))
    if not user or not user.pin_hash or not verify_password(payload.pin, user.pin_hash):
        raise HTTPException(status_code=401, detail="PIN incorrecto")
    if not getattr(user, "is_active", True):
        raise HTTPException(status_code=403, detail="Usuario desactivado")
    return auth_response(user)


@router.get("/me")
def me(current_user: User = Depends(get_current_user)) -> dict:
    return serialize_user(current_user)


@router.post("/logout")
def logout() -> dict:
    return {"success": True}
