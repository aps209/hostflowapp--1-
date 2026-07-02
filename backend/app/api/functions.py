from datetime import date
from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.entity import EntityRecord
from app.services.entities import create_entity_record, serialize_record, update_entity_record


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

    tables = [item for item in all_records(db, "Table") if item.get("restaurant_id") == restaurant_id and item.get("activa", True)]
    selected_table = None
    requested_table_id = payload.get("mesa_id") or payload.get("table_id")
    if requested_table_id:
        selected_table = next((table for table in tables if table.get("id") == requested_table_id), None)
    if not selected_table and tables:
        selected_table = sorted(tables, key=lambda table: table.get("capacidad", 999))[0]

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
    if selected_table:
        reservation_data.setdefault("mesa_id", selected_table["id"])
        reservation_data.setdefault("mesa_numero", selected_table.get("numero"))
        reservation_data.setdefault("mesas_unidas", [])
        reservation_data.setdefault("mesas_numeros", [selected_table.get("numero")])

    reservation = create_entity_record(db, "Reservation", reservation_data)
    return {"success": True, "reservation": reservation, "reservation_id": reservation["reservation_id"]}


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
        reservation = find_one(db, "Reservation", confirmation_token=payload.get("token"))
        if not reservation:
            return {"success": False, "error": "Token no valido"}
        action = payload.get("action")
        if action == "cancelar":
            reservation = update_entity_record(db, "Reservation", reservation["id"], {"estado": "cancelada"})
            return {"success": True, "message": "Reserva cancelada correctamente", "reservation": reservation}
        if action == "confirmar":
            reservation = update_entity_record(db, "Reservation", reservation["id"], {"estado": "confirmada"})
            return {"success": True, "message": "Reserva confirmada correctamente", "reservation": reservation}
        restaurant = find_one(db, "Restaurant", id=reservation.get("restaurant_id"))
        return {"success": True, "reservation": reservation, "restaurant": restaurant}

    if function_name == "getReservationsByDate":
        reservations = [
            item for item in all_records(db, "Reservation")
            if item.get("restaurant_id") == payload.get("restaurant_id") and item.get("fecha") == payload.get("fecha")
        ]
        return {"success": True, "reservations": reservations}

    if function_name in {
        "enviarEmailConfirmacion",
        "enviarEmailCancelacion",
        "enviarCampanaEmail",
        "enviarCampanaSMS",
        "enviarCampanaWhatsApp",
        "actualizarDuracionReservas",
        "syncGoogleReviews",
        "exportAnalyticsPDF",
        "enviarRecordatorios",
        "notificarReservaN8n",
        "sendCancellationWebhook",
    }:
        return {"success": True, "message": f"{function_name} ejecutada en modo local"}

    return {"success": False, "error": f"Funcion no implementada: {function_name}"}
