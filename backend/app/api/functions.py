import json
import urllib.error
import urllib.parse
import urllib.request
from base64 import b64encode
from datetime import date, datetime, timedelta, timezone
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models.entity import EntityRecord
from app.services.entities import create_entity_record, serialize_record, update_entity_record
from app.services.reservation_assignment import apply_assignment_to_reservation, find_reservation_assignment
from app.services.whatsapp import send_whatsapp_template


router = APIRouter(prefix="/functions", tags=["functions"])


def all_records(db: Session, entity_name: str) -> list[dict]:
    records = db.query(EntityRecord).filter(EntityRecord.entity_name == entity_name).all()
    return [serialize_record(record) for record in records]


def find_one(db: Session, entity_name: str, **filters) -> dict | None:
    for item in all_records(db, entity_name):
        if all(item.get(key) == value for key, value in filters.items() if value is not None):
            return item
    return None


def next_reservation_id(db: Session, restaurant_id: str) -> str:
    current_year = date.today().year
    reservations = all_records(db, "Reservation")
    max_number = 0
    prefix = f"R-{current_year}-"
    for reservation in reservations:
        if reservation.get("restaurant_id") == restaurant_id and str(reservation.get("reservation_id", "")).startswith(prefix):
            try:
                max_number = max(max_number, int(reservation["reservation_id"].replace(prefix, "")))
            except ValueError:
                continue
    return f"{prefix}{str(max_number + 1).zfill(4)}"


def restaurant_bundle(db: Session, restaurant: dict) -> dict:
    restaurant_id = restaurant["id"]
    return {
        "success": True,
        "restaurant": restaurant,
        "config": find_one(db, "RestaurantConfig", restaurant_id=restaurant_id) or {},
        "schedules": [item for item in all_records(db, "Schedule") if item.get("restaurant_id") == restaurant_id],
        "specialDays": [item for item in all_records(db, "SpecialDay") if item.get("restaurant_id") == restaurant_id],
        "tables": [item for item in all_records(db, "Table") if item.get("restaurant_id") == restaurant_id],
        "reservations": [item for item in all_records(db, "Reservation") if item.get("restaurant_id") == restaurant_id],
        "tableAvailability": [item for item in all_records(db, "TableAvailability") if item.get("restaurant_id") == restaurant_id],
    }


def create_reservation(db: Session, payload: dict) -> dict:
    restaurant_id = payload.get("restaurant_id")
    if not restaurant_id:
        return {"success": False, "error": "Falta restaurant_id"}

    assignment = find_reservation_assignment(db, restaurant_id, payload)
    if not assignment.get("success"):
        return assignment

    customer = None
    for candidate in all_records(db, "Customer"):
        same_restaurant = candidate.get("restaurant_id") == restaurant_id
        same_email = payload.get("cliente_email") and candidate.get("email") == payload.get("cliente_email")
        same_phone = payload.get("cliente_telefono") and candidate.get("telefono") == payload.get("cliente_telefono")
        if same_restaurant and (same_email or same_phone):
            customer = candidate
            break

    if not customer:
        customer = create_entity_record(db, "Customer", {
            "restaurant_id": restaurant_id,
            "nombre": payload.get("cliente_nombre") or payload.get("nombre") or "",
            "apellidos": payload.get("cliente_apellidos") or "",
            "email": payload.get("cliente_email") or payload.get("email"),
            "telefono": payload.get("cliente_telefono") or payload.get("telefono"),
            "total_visitas": 1,
            "ultima_visita": payload.get("fecha"),
            "estado": "activo",
        })

    reservation_data = {
        **payload,
        "restaurant_id": restaurant_id,
        "reservation_id": payload.get("reservation_id") or next_reservation_id(db, restaurant_id),
        "cliente_id": customer["id"],
        "cliente_nombre": payload.get("cliente_nombre") or payload.get("nombre") or customer.get("nombre"),
        "cliente_apellidos": payload.get("cliente_apellidos") or customer.get("apellidos", ""),
        "cliente_email": payload.get("cliente_email") or payload.get("email") or customer.get("email"),
        "cliente_telefono": payload.get("cliente_telefono") or payload.get("telefono") or customer.get("telefono"),
        "estado": payload.get("estado") or "confirmada",
        "origen": payload.get("origen") or "web",
        "confirmation_token": payload.get("confirmation_token") or str(uuid4()),
        "duracion_estimada": payload.get("duracion_estimada") or 90,
    }
    apply_assignment_to_reservation(reservation_data, assignment)

    reservation = create_entity_record(db, "Reservation", reservation_data)
    return {"success": True, "reservation": reservation, "reservation_id": reservation["reservation_id"]}


def fetch_google_place_details(place_id: str) -> dict:
    if not settings.google_places_api_key:
        return {
            "success": False,
            "error": "Falta configurar GOOGLE_PLACES_API_KEY en el backend",
        }

    url = f"https://places.googleapis.com/v1/places/{quote(place_id, safe='')}"
    request = urllib.request.Request(
        url,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": settings.google_places_api_key,
            "X-Goog-FieldMask": "id,displayName,rating,userRatingCount,reviews",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return {"success": True, "data": json.loads(response.read().decode("utf-8"))}
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        return {"success": False, "error": f"Google Places devolvio {error.code}: {body}"}
    except urllib.error.URLError as error:
        return {"success": False, "error": f"No se pudo conectar con Google Places: {error.reason}"}


def sync_google_reviews(db: Session, payload: dict) -> dict:
    restaurant_id = payload.get("restaurantId") or payload.get("restaurant_id")
    if not restaurant_id:
        return {"success": False, "error": "Falta restaurantId"}

    restaurant = find_one(db, "Restaurant", id=restaurant_id)
    if not restaurant:
        return {"success": False, "error": "Restaurante no encontrado"}

    place_id = restaurant.get("google_place_id")
    if not place_id:
        return {"success": False, "error": "El restaurante no tiene google_place_id"}

    place_response = fetch_google_place_details(place_id)
    if not place_response.get("success"):
        return place_response

    place = place_response["data"]
    reviews = place.get("reviews") or []
    existing_reviews = all_records(db, "Review")
    imported = 0
    updated = 0

    for review in reviews:
        author = review.get("authorAttribution") or {}
        text = review.get("text") or review.get("originalText") or {}
        publish_time = review.get("publishTime")
        google_review_name = review.get("name") or f"{place_id}:{author.get('uri', '')}:{publish_time or ''}"

        review_data = {
            "restaurant_id": restaurant_id,
            "cliente_nombre": author.get("displayName") or "Cliente de Google",
            "calificacion": review.get("rating") or 0,
            "comentario": text.get("text") or "",
            "fecha_visita": publish_time[:10] if publish_time else date.today().isoformat(),
            "estado": "publicada",
            "source": "google",
            "google_place_id": place_id,
            "google_review_name": google_review_name,
            "google_author_uri": author.get("uri"),
            "google_author_photo_uri": author.get("photoUri"),
            "google_publish_time": publish_time,
        }

        existing = next(
            (
                item for item in existing_reviews
                if item.get("restaurant_id") == restaurant_id and item.get("google_review_name") == google_review_name
            ),
            None,
        )

        if existing:
            update_entity_record(db, "Review", existing["id"], review_data)
            updated += 1
        else:
            created = create_entity_record(db, "Review", review_data)
            existing_reviews.append(created)
            imported += 1

    update_entity_record(db, "Restaurant", restaurant_id, {
        "google_rating": place.get("rating"),
        "google_user_rating_count": place.get("userRatingCount"),
        "google_reviews_synced_at": datetime.now(timezone.utc).isoformat(),
    })

    place_name = (place.get("displayName") or {}).get("text") or restaurant.get("nombre")
    return {
        "success": True,
        "message": f"Resenas de Google sincronizadas para {place_name}",
        "reviewsImported": imported,
        "reviewsUpdated": updated,
        "googleRating": place.get("rating"),
        "googleUserRatingCount": place.get("userRatingCount"),
    }


def apply_reservation_action(db: Session, token: str | None, action: str | None) -> dict:
    """Logica compartida confirmar/cancelar por token. La usan tanto el dispatcher
    (gestionarReservaPorToken) como el webhook entrante de WhatsApp."""
    if not token:
        return {"success": False, "error": "Token no valido"}
    reservation = find_one(db, "Reservation", confirmation_token=token)
    if not reservation:
        return {"success": False, "error": "Token no valido"}

    if action == "cancelar":
        reservation = update_entity_record(db, "Reservation", reservation["id"], {"estado": "cancelada"})
        return {"success": True, "action": "cancelar", "message": "Reserva cancelada correctamente", "reservation": reservation}
    if action == "confirmar":
        reservation = update_entity_record(db, "Reservation", reservation["id"], {"estado": "confirmada"})
        return {"success": True, "action": "confirmar", "message": "Reserva confirmada correctamente", "reservation": reservation}

    restaurant = find_one(db, "Restaurant", id=reservation.get("restaurant_id"))
    return {"success": True, "reservation": reservation, "restaurant": restaurant}


def format_spanish_date(date_value: str) -> str:
    weekdays = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
    months = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ]
    parsed = datetime.fromisoformat(date_value)
    return f"{weekdays[parsed.weekday()]}, {parsed.day} de {months[parsed.month - 1]}"


def build_reminder_message(config: dict, restaurant: dict, reservation: dict) -> str:
    mesa_info = ", ".join(reservation.get("mesas_numeros") or []) or reservation.get("mesa_numero") or "Por asignar"
    cancel_url = f"{settings.public_app_url.rstrip('/')}/confirmar-reserva?token={reservation.get('confirmation_token')}&action=cancelar"
    template = config.get("sms_message_template") or (
        "Hola {nombre}, te recordamos tu reserva en {restaurante} el {fecha} a las {hora} "
        "para {comensales} personas. Mesa: {mesa}. Cancelar: {link_cancelar}"
    )
    return (
        template
        .replace("{nombre}", reservation.get("cliente_nombre") or "Cliente")
        .replace("{restaurante}", restaurant.get("nombre") or "Restaurante")
        .replace("{fecha}", format_spanish_date(reservation.get("fecha")))
        .replace("{hora}", reservation.get("hora") or "")
        .replace("{mesa}", mesa_info)
        .replace("{comensales}", str(reservation.get("comensales") or ""))
        .replace("{link_cancelar}", cancel_url)
    )


def build_whatsapp_body_params(restaurant: dict, reservation: dict) -> list[str]:
    """Parametros del body de la plantilla WhatsApp, en el orden {{1}}..{{6}}:
    nombre, restaurante, fecha, hora, comensales, mesa."""
    mesa_info = ", ".join(reservation.get("mesas_numeros") or []) or reservation.get("mesa_numero") or "Por asignar"
    return [
        reservation.get("cliente_nombre") or "Cliente",
        restaurant.get("nombre") or "Restaurante",
        format_spanish_date(reservation.get("fecha")),
        reservation.get("hora") or "",
        str(reservation.get("comensales") or ""),
        mesa_info,
    ]


def send_twilio_sms(to: str, body: str) -> dict:
    if not settings.twilio_account_sid or not settings.twilio_auth_token or not settings.twilio_phone_number:
        return {"sent": False, "dry_run": True, "message": "Twilio no configurado"}

    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
    encoded = urllib.parse.urlencode({
        "Body": body,
        "From": settings.twilio_phone_number,
        "To": to,
    }).encode("utf-8")
    credentials = f"{settings.twilio_account_sid}:{settings.twilio_auth_token}".encode("utf-8")
    request = urllib.request.Request(
        url,
        data=encoded,
        headers={
            "Authorization": f"Basic {b64encode(credentials).decode('ascii')}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return {"sent": True, "dry_run": False, "provider_response": json.loads(response.read().decode("utf-8"))}
    except urllib.error.HTTPError as error:
        body_text = error.read().decode("utf-8", errors="replace")
        return {"sent": False, "dry_run": False, "error": f"Twilio devolvio {error.code}: {body_text}"}
    except urllib.error.URLError as error:
        return {"sent": False, "dry_run": False, "error": f"No se pudo conectar con Twilio: {error.reason}"}


def enviar_recordatorios(db: Session, payload: dict) -> dict:
    restaurant_id = payload.get("restaurant_id") or payload.get("restaurantId")
    if not restaurant_id:
        return {"success": False, "error": "restaurant_id es requerido"}

    configs = [item for item in all_records(db, "ReminderConfig") if item.get("restaurant_id") == restaurant_id]
    if not configs or not configs[0].get("enabled"):
        return {
            "success": True,
            "message": "Recordatorios no activados para este restaurante",
            "enviados": 0,
            "errores": 0,
            "total": 0,
            "detalles": [],
        }

    config = configs[0]
    channel = (config.get("channel") or "whatsapp").lower()
    hours_before = int(config.get("hours_before") or 24)
    target_time = datetime.now(timezone.utc) + timedelta(hours=hours_before)
    target_date = payload.get("target_date") or target_time.date().isoformat()
    restaurant = find_one(db, "Restaurant", id=restaurant_id) or {"nombre": "Restaurante"}

    reservations = [
        item for item in all_records(db, "Reservation")
        if item.get("restaurant_id") == restaurant_id and item.get("fecha") == target_date
    ]
    if config.get("only_confirmed"):
        reservations = [item for item in reservations if item.get("estado") == "confirmada"]
    reservations = [item for item in reservations if item.get("cliente_telefono")]
    # Dedup: no reenviar a reservas que ya recibieron el recordatorio.
    reservations = [item for item in reservations if not item.get("recordatorio_enviado_at")]

    enviados = 0
    errores = 0
    dry_run = False
    detalles = []

    for reservation in reservations:
        if channel == "sms":
            message = build_reminder_message(config, restaurant, reservation)
            result = send_twilio_sms(reservation.get("cliente_telefono"), message)
            provider = "Twilio"
        else:
            message = " | ".join(build_whatsapp_body_params(restaurant, reservation))
            result = send_whatsapp_template(
                reservation.get("cliente_telefono"),
                build_whatsapp_body_params(restaurant, reservation),
                token=reservation.get("confirmation_token"),
                template_name=config.get("whatsapp_template_name"),
            )
            provider = "WhatsApp"

        dry_run = dry_run or result.get("dry_run", False)

        if result.get("sent") or result.get("dry_run"):
            enviados += 1
            # Marcar como enviado solo en envio real (permite re-testear en dry_run).
            if result.get("sent"):
                update_entity_record(db, "Reservation", reservation["id"], {
                    "recordatorio_enviado_at": datetime.now(timezone.utc).isoformat(),
                    "recordatorio_canal": channel,
                })
            detalles.append({
                "reserva_id": reservation.get("reservation_id"),
                "cliente": reservation.get("cliente_nombre"),
                "telefono": reservation.get("cliente_telefono"),
                "resultado": f"Dry run - {provider} no configurado" if result.get("dry_run") else "Enviado correctamente",
                "mensaje": message,
            })
        else:
            errores += 1
            detalles.append({
                "reserva_id": reservation.get("reservation_id"),
                "cliente": reservation.get("cliente_nombre"),
                "telefono": reservation.get("cliente_telefono"),
                "resultado": result.get("error") or "Error desconocido",
            })

    return {
        "success": errores == 0,
        "message": "Recordatorios procesados en modo prueba" if dry_run else "Recordatorios procesados",
        "dry_run": dry_run,
        "channel": channel,
        "target_date": target_date,
        "enviados": enviados,
        "errores": errores,
        "total": len(reservations),
        "detalles": detalles,
    }


@router.post("/{function_name}")
def invoke_function(function_name: str, payload: dict, db: Session = Depends(get_db)) -> dict:
    if function_name == "obtenerInfoRestaurante":
        slug = payload.get("slug") or payload.get("restaurant_slug")
        restaurants = all_records(db, "Restaurant")
        restaurant = next((item for item in restaurants if item.get("slug") == slug), None) if slug else None
        restaurant = restaurant or (restaurants[0] if restaurants else None)
        if not restaurant:
            return {"success": False, "error": "Restaurante no encontrado"}
        return restaurant_bundle(db, restaurant)

    if function_name in {"crearReservaPublica", "createReservation", "processReservation"}:
        return create_reservation(db, payload)

    if function_name == "consultarReserva":
        reservation = find_one(db, "Reservation", reservation_id=payload.get("reservation_id"))
        if not reservation:
            return {"success": False, "error": "No se encontro la reserva"}
        if payload.get("cliente_email") and reservation.get("cliente_email") != payload.get("cliente_email"):
            return {"success": False, "error": "El email no coincide con la reserva"}
        if payload.get("action") == "cancelar":
            reservation = update_entity_record(db, "Reservation", reservation["id"], {"estado": "cancelada"})
            return {"success": True, "message": "Reserva cancelada correctamente", "reservation": reservation}
        restaurant = find_one(db, "Restaurant", id=reservation.get("restaurant_id"))
        return {"success": True, "reservation": reservation, "restaurant": restaurant}

    if function_name == "gestionarReservaPorToken":
        return apply_reservation_action(db, payload.get("token"), payload.get("action"))

    if function_name == "getReservationsByDate":
        reservations = [
            item for item in all_records(db, "Reservation")
            if item.get("restaurant_id") == payload.get("restaurant_id") and item.get("fecha") == payload.get("fecha")
        ]
        return {"success": True, "reservations": reservations}

    if function_name == "syncGoogleReviews":
        return sync_google_reviews(db, payload)

    if function_name == "enviarRecordatorios":
        return enviar_recordatorios(db, payload)

    if function_name in {
        "enviarEmailConfirmacion",
        "enviarEmailCancelacion",
        "enviarCampanaEmail",
        "enviarCampanaSMS",
        "enviarCampanaWhatsApp",
        "actualizarDuracionReservas",
        "exportAnalyticsPDF",
        "notificarReservaN8n",
        "sendCancellationWebhook",
    }:
        return {"success": True, "message": f"{function_name} ejecutada en modo local"}

    return {"success": False, "error": f"Funcion no implementada: {function_name}"}
