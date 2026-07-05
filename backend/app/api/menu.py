from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.schemas.menu import MenuApplyRequest, MenuScanRequest
from app.services.menu import apply_menu, scan_menu


router = APIRouter(prefix="/menu", tags=["menu"])


def require_restaurant_id(current_user) -> str:
    if not current_user.restaurant_id:
        raise HTTPException(status_code=400, detail="El usuario no tiene restaurante asignado")
    return current_user.restaurant_id


@router.post("/scan")
def post_menu_scan(
    payload: MenuScanRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict:
    images = [{"data": image.image_base64, "mime": image.mime_type} for image in payload.images]
    result = scan_menu(db, require_restaurant_id(current_user), images)
    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result.get("error") or "No se pudo leer la carta")
    return result


@router.post("/apply")
def post_menu_apply(
    payload: MenuApplyRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict:
    if not payload.dishes:
        raise HTTPException(status_code=400, detail="No hay platos que anadir")
    return apply_menu(db, require_restaurant_id(current_user), payload.dishes)
