"""Webhook entrante de WhatsApp Cloud API (Meta).

- GET  /api/webhooks/whatsapp  -> handshake de verificacion (hub.challenge).
- POST /api/webhooks/whatsapp  -> eventos entrantes (respuestas de botones).

No exige JWT: Meta no envia token de autorizacion. La autenticidad se valida con
la firma X-Hub-Signature-256 (HMAC-SHA256 con el App Secret).
"""
import hashlib
import hmac
import json

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.api.functions import apply_reservation_action
from app.core.config import settings
from app.db.database import get_db
from app.services.whatsapp import CANCEL_PREFIX, CONFIRM_PREFIX, send_whatsapp_text


router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("/whatsapp")
def verify_whatsapp_webhook(request: Request) -> Response:
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and token and token == settings.whatsapp_verify_token:
        return Response(content=challenge or "", media_type="text/plain")
    return Response(content="Forbidden", status_code=403)


def _valid_signature(raw_body: bytes, signature_header: str | None) -> bool:
    # Sin app_secret configurado no validamos (util en local/dev).
    if not settings.whatsapp_app_secret:
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(
        settings.whatsapp_app_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    provided = signature_header.split("=", 1)[1]
    return hmac.compare_digest(expected, provided)


def _extract_actions(body: dict) -> list[tuple[str, str, str]]:
    """Devuelve lista de (accion, token, from_phone) a partir del payload de Meta.

    Soporta botones de plantilla (type=button -> button.payload) y botones
    interactivos (type=interactive -> interactive.button_reply.id)."""
    actions: list[tuple[str, str, str]] = []
    for entry in body.get("entry", []) or []:
        for change in entry.get("changes", []) or []:
            value = change.get("value", {}) or {}
            for message in value.get("messages", []) or []:
                from_phone = message.get("from") or ""
                payload = None
                mtype = message.get("type")
                if mtype == "button":
                    payload = (message.get("button") or {}).get("payload")
                elif mtype == "interactive":
                    interactive = message.get("interactive") or {}
                    reply = interactive.get("button_reply") or interactive.get("list_reply") or {}
                    payload = reply.get("id")
                if not payload:
                    continue
                if payload.startswith(CONFIRM_PREFIX):
                    actions.append(("confirmar", payload[len(CONFIRM_PREFIX):], from_phone))
                elif payload.startswith(CANCEL_PREFIX):
                    actions.append(("cancelar", payload[len(CANCEL_PREFIX):], from_phone))
    return actions


@router.post("/whatsapp")
async def receive_whatsapp_webhook(request: Request, db: Session = Depends(get_db)) -> Response:
    raw_body = await request.body()
    if not _valid_signature(raw_body, request.headers.get("X-Hub-Signature-256")):
        return Response(content="Invalid signature", status_code=403)

    try:
        body = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except json.JSONDecodeError:
        body = {}

    for action, token, from_phone in _extract_actions(body):
        result = apply_reservation_action(db, token, action)
        if from_phone and result.get("success"):
            acuse = (
                "Reserva confirmada. Te esperamos!"
                if action == "confirmar"
                else "Reserva cancelada. Esperamos verte pronto."
            )
            send_whatsapp_text(from_phone, acuse)

    # WhatsApp espera siempre 200 para no reintentar la entrega.
    return Response(content="EVENT_RECEIVED", media_type="text/plain")
