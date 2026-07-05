from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.services.orders import create_order


router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("")
def post_order(
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict:
    if not current_user.restaurant_id:
        raise HTTPException(status_code=400, detail="El usuario no tiene restaurante asignado")
    return create_order(db, current_user.restaurant_id, payload)
