from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.entity import EntityRecord
from app.services.ai.providers.base import AIConfigurationError
from app.services.ai.providers.factory import get_ai_provider
from app.services.ai.tools import (
    create_campaign_draft,
    create_reminder,
    create_reservation_tool,
    delete_reservation_tool,
    deterministic_insights,
    is_reservation_write_intent,
    parse_reservation_draft,
    recommended_actions,
    reservation_draft_missing_fields,
    run_selected_tools,
    select_tools,
    update_reservation_tool,
)
from app.services.entities import create_entity_record, serialize_record
from app.services.reservation_assignment import apply_assignment_to_reservation, find_reservation_assignment


SYSTEM_PROMPT = """
Eres AI Manager para un SaaS de restaurantes. Responde en espanol, con tono claro y accionable.
Solo puedes basarte en el JSON de herramientas internas que recibes. No inventes datos.
Devuelve exclusivamente JSON con:
answer: string
insights: array de {type: warning|success|info, title, description}
recommended_actions: array de {id, label, requires_confirmation, payload}
Las acciones que modifican datos deben requerir confirmacion.
Tools de reservas disponibles:
- list_reservations: ya recibes su salida cuando el usuario pide consultar o filtrar reservas.
- Para crear una reserva, devuelve recommended_actions con id "create_reservation" y payload:
  {cliente_nombre, cliente_apellidos?, cliente_email?, cliente_telefono?, fecha: YYYY-MM-DD, hora: HH:MM, comensales, notas?, estado?}
- Para modificar una reserva, devuelve recommended_actions con id "update_reservation" y payload:
  {id? o reservation_id, fecha?, hora?, comensales?, estado?, notas?, cliente_nombre?, cliente_telefono?, cliente_email?}
- Para eliminar una reserva, devuelve recommended_actions con id "delete_reservation" y payload:
  {id? o reservation_id}
Si faltan datos para crear/modificar/eliminar, pregunta por ellos en answer y no propongas la accion todavia.
Puedes filtrar reservas por "comida" o "cena"; comida es antes de las 18:00 y cena desde las 18:00.
"""


PENDING_RESERVATION_DRAFTS: dict[str, dict[str, Any]] = {}


def _restaurant(db: Session, restaurant_id: str) -> dict[str, Any] | None:
    record = db.get(EntityRecord, restaurant_id)
    if not record or record.entity_name != "Restaurant":
        return None
    return serialize_record(record)


def log_ai_action(db: Session, restaurant_id: str, event: str, payload: dict[str, Any]) -> None:
    create_entity_record(db, "AIActionLog", {
        "restaurant_id": restaurant_id,
        "event": event,
        "payload": payload,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


def chat(db: Session, restaurant_id: str, message: str, conversation_id: str | None = None) -> dict[str, Any]:
    draft_key = f"{restaurant_id}:{conversation_id or 'default'}"
    parsed_draft = parse_reservation_draft(message)
    pending_draft = PENDING_RESERVATION_DRAFTS.get(draft_key)
    if pending_draft or is_reservation_write_intent(message):
        merged_draft = {**(pending_draft or {}), **parsed_draft}
        missing = reservation_draft_missing_fields(merged_draft)
        if missing:
            PENDING_RESERVATION_DRAFTS[draft_key] = merged_draft
            response = {
                "answer": (
                    "Para crear la reserva necesito: "
                    f"{', '.join(missing)}. "
                    "Puedes responder solo con el dato que falta."
                ),
                "insights": [],
                "recommended_actions": [],
            }
            log_ai_action(db, restaurant_id, "reservation_draft_pending", {
                "message": message,
                "draft": merged_draft,
                "missing": missing,
            })
            return response

        assignment = find_reservation_assignment(db, restaurant_id, merged_draft)
        if not assignment.get("success"):
            PENDING_RESERVATION_DRAFTS.pop(draft_key, None)
            response = {
                "answer": assignment.get("error") or "No hay mesas disponibles para esa reserva.",
                "insights": [
                    {
                        "type": "warning",
                        "title": "Reserva no disponible",
                        "description": assignment.get("error") or "Revisa fecha, hora y comensales antes de intentarlo otra vez.",
                    }
                ],
                "recommended_actions": [],
            }
            log_ai_action(db, restaurant_id, "reservation_draft_unavailable", {
                "message": message,
                "draft": merged_draft,
                "response": response,
            })
            return response

        apply_assignment_to_reservation(merged_draft, assignment)
        PENDING_RESERVATION_DRAFTS.pop(draft_key, None)
        response = {
            "answer": (
                "Tengo los datos para crear la reserva. Revisa y confirma la accion antes de guardarla."
            ),
            "insights": [
                {
                    "type": "info",
                    "title": "Reserva preparada",
                    "description": (
                        f"{merged_draft.get('cliente_nombre')} - {merged_draft.get('comensales')} comensales "
                        f"el {merged_draft.get('fecha')} a las {merged_draft.get('hora')}."
                    ),
                }
            ],
            "recommended_actions": [
                {
                    "id": "create_reservation",
                    "label": "Crear reserva",
                    "requires_confirmation": True,
                    "payload": merged_draft,
                }
            ],
        }
        log_ai_action(db, restaurant_id, "reservation_draft_ready", {
            "message": message,
            "draft": merged_draft,
            "response": response,
        })
        return response

    tool_names = select_tools(message)
    tool_output = run_selected_tools(db, restaurant_id, tool_names, message)
    fallback_insights = deterministic_insights(tool_output)
    fallback_actions = recommended_actions(tool_output)
    restaurant = _restaurant(db, restaurant_id)

    try:
        provider = get_ai_provider()
        ai_response = provider.generate_json(SYSTEM_PROMPT, {
            "user_message": message,
            "conversation_id": conversation_id,
            "restaurant": {
                "id": restaurant_id,
                "nombre": (restaurant or {}).get("nombre"),
                "plan": (restaurant or {}).get("plan"),
            },
            "tools_used": tool_names,
            "tool_output": tool_output,
            "safe_recommended_actions": fallback_actions,
        })
    except AIConfigurationError as error:
        if "Falta configurar GEMINI_API_KEY" not in str(error):
            is_quota = "429" in str(error) or "limite de peticiones" in str(error)
            answer = (
                "Has alcanzado el limite de peticiones gratuitas de Gemini. "
                "Espera un minuto o revisa tu cuota; mientras, te dejo un resumen con las herramientas internas."
                if is_quota else
                "Gemini no esta disponible ahora mismo, pero he analizado los datos con las "
                "herramientas internas y te dejo un resumen operativo."
            )
            response = {
                "answer": answer,
                "insights": fallback_insights,
                "recommended_actions": fallback_actions,
            }
            log_ai_action(db, restaurant_id, "chat_provider_fallback", {
                "message": message,
                "tools_used": tool_names,
                "error": str(error),
                "response": response,
            })
            return response
        log_ai_action(db, restaurant_id, "chat_error", {"message": message, "error": str(error)})
        raise HTTPException(status_code=503, detail=str(error)) from error

    response = {
        "answer": ai_response.get("answer") or "He revisado los datos disponibles y he preparado recomendaciones.",
        "insights": ai_response.get("insights") or fallback_insights,
        "recommended_actions": ai_response.get("recommended_actions") or fallback_actions,
    }
    log_ai_action(db, restaurant_id, "chat", {
        "message": message,
        "tools_used": tool_names,
        "response": response,
    })
    return response


def suggestions() -> list[str]:
    return [
        "Resume el estado del restaurante hoy.",
        "Donde estoy perdiendo dinero?",
        "Que plato deberia subir de precio?",
        "Que clientes llevan tiempo sin venir?",
        "Que stock esta en riesgo?",
        "Que campana deberia lanzar esta semana?",
        "Que reservas tengo hoy para la comida?",
        "Que reservas tengo manana para la cena?",
        "Crea una reserva para Ana Garcia manana a las 21:00 para 4 personas.",
    ]


def confirm_action(db: Session, restaurant_id: str, action_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    if action_id == "create_campaign_draft":
        result = create_campaign_draft(db, restaurant_id, payload)
    elif action_id == "create_reminder":
        result = create_reminder(db, restaurant_id, payload)
    elif action_id == "create_reservation":
        result = create_reservation_tool(db, restaurant_id, payload)
    elif action_id == "update_reservation":
        result = update_reservation_tool(db, restaurant_id, payload)
    elif action_id == "delete_reservation":
        result = delete_reservation_tool(db, restaurant_id, payload)
    elif action_id == "review_price_recommendations":
        result = {"success": True, "message": "Accion informativa; abre Cost Intelligence para revisar precios."}
    else:
        raise HTTPException(status_code=400, detail=f"Accion no soportada: {action_id}")

    log_ai_action(db, restaurant_id, "action_confirmed", {
        "action_id": action_id,
        "payload": payload,
        "result": result,
    })
    return {"success": result.get("success", True), "action_id": action_id, "result": result}
