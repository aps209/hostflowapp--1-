"""Integracion con WhatsApp Cloud API (Meta / Graph API).

Sigue el mismo patron que send_twilio_sms (functions.py) y el retry loop de
gemini.py: HTTP con urllib de la stdlib, sin dependencias externas. Cuando faltan
credenciales devuelve un stub dry_run para que la app funcione en local sin romper.
"""
import json
import re
import time
import urllib.error
import urllib.request

from app.core.config import settings


CONFIRM_PREFIX = "CONFIRM:"
CANCEL_PREFIX = "CANCEL:"


def _is_configured() -> bool:
    return bool(settings.whatsapp_phone_number_id and settings.whatsapp_access_token)


def normalize_phone(phone: str | None) -> str | None:
    """Normaliza a formato E.164 sin prefijos. Meta espera el numero sin '+'
    ni 'whatsapp:'. Ej: '+34 612 345 678' -> '34612345678'."""
    if not phone:
        return None
    cleaned = re.sub(r"[^\d]", "", phone.replace("whatsapp:", ""))
    return cleaned or None


def _messages_url() -> str:
    return (
        f"https://graph.facebook.com/{settings.whatsapp_api_version}"
        f"/{settings.whatsapp_phone_number_id}/messages"
    )


def _post(payload: dict) -> dict:
    request = urllib.request.Request(
        _messages_url(),
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.whatsapp_access_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    last_error: str | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return {"sent": True, "dry_run": False, "provider_response": json.loads(response.read().decode("utf-8"))}
        except urllib.error.HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")
            last_error = f"WhatsApp devolvio {error.code}: {details}"
            # Reintentar solo en errores transitorios del lado servidor.
            if error.code not in {500, 502, 503, 504} or attempt == 2:
                return {"sent": False, "dry_run": False, "error": last_error}
            time.sleep(1 + attempt)
        except urllib.error.URLError as error:
            last_error = f"No se pudo conectar con WhatsApp: {error.reason}"
            if attempt == 2:
                return {"sent": False, "dry_run": False, "error": last_error}
            time.sleep(1 + attempt)

    return {"sent": False, "dry_run": False, "error": last_error or "Error desconocido de WhatsApp"}


def send_whatsapp_template(
    to: str,
    body_params: list[str],
    token: str | None = None,
    template_name: str | None = None,
    lang: str | None = None,
) -> dict:
    """Envia una plantilla aprobada con dos botones quick_reply (Confirmar/Cancelar).

    Los payload de los botones se devuelven en el webhook: 'CONFIRM:{token}' /
    'CANCEL:{token}'. La plantilla debe estar aprobada en Meta con el body
    variabilizado ({{1}}, {{2}}...) y dos botones Quick Reply en ese orden.
    """
    recipient = normalize_phone(to)
    if not recipient:
        return {"sent": False, "dry_run": False, "error": "Telefono de destino no valido"}
    if not _is_configured():
        return {"sent": False, "dry_run": True, "message": "WhatsApp no configurado"}

    components: list[dict] = [
        {
            "type": "body",
            "parameters": [{"type": "text", "text": str(value)} for value in body_params],
        }
    ]
    if token:
        components.append({
            "type": "button",
            "sub_type": "quick_reply",
            "index": "0",
            "parameters": [{"type": "payload", "payload": f"{CONFIRM_PREFIX}{token}"}],
        })
        components.append({
            "type": "button",
            "sub_type": "quick_reply",
            "index": "1",
            "parameters": [{"type": "payload", "payload": f"{CANCEL_PREFIX}{token}"}],
        })

    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "template",
        "template": {
            "name": template_name or settings.whatsapp_reminder_template,
            "language": {"code": lang or settings.whatsapp_reminder_template_lang},
            "components": components,
        },
    }
    return _post(payload)


def send_whatsapp_text(to: str, body: str) -> dict:
    """Envia texto libre. Solo valido dentro de la ventana de 24h (p.ej. acuse
    tras una respuesta del cliente)."""
    recipient = normalize_phone(to)
    if not recipient:
        return {"sent": False, "dry_run": False, "error": "Telefono de destino no valido"}
    if not _is_configured():
        return {"sent": False, "dry_run": True, "message": "WhatsApp no configurado"}

    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "text",
        "text": {"body": body},
    }
    return _post(payload)
