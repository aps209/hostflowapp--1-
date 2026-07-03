from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.db.database import get_db
from app.schemas.ai import AIActionConfirmRequest, AIChatRequest, AIChatResponse
from app.services.ai.manager import chat, confirm_action, suggestions


router = APIRouter(prefix="/ai-manager", tags=["ai-manager"])


def require_restaurant_id(current_user) -> str:
    if not current_user.restaurant_id:
        raise HTTPException(status_code=400, detail="El usuario no tiene restaurante asignado")
    return current_user.restaurant_id


@router.post("/chat", response_model=AIChatResponse)
def ai_chat(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("chatbot")),
) -> dict:
    restaurant_id = require_restaurant_id(current_user)
    return chat(db, restaurant_id, payload.message, payload.conversation_id)


@router.get("/suggestions")
def ai_suggestions(current_user=Depends(require_permission("chatbot"))) -> list[str]:
    require_restaurant_id(current_user)
    return suggestions()


@router.post("/action/confirm")
def ai_confirm_action(
    payload: AIActionConfirmRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("chatbot")),
) -> dict:
    restaurant_id = require_restaurant_id(current_user)
    return confirm_action(db, restaurant_id, payload.id, payload.payload)
