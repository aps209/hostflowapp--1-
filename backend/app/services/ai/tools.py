import re
from datetime import date, datetime, timedelta
from uuid import uuid4
from typing import Any

from sqlalchemy.orm import Session

from app.models.entity import EntityRecord
from app.services.cost_intelligence import (
    dish_cost_breakdown,
    generate_recommendations,
    ingredient_price_changes,
    list_dishes,
    list_ingredients,
    low_margin_dishes,
    simulate_price_change,
)
from app.services.entities import create_entity_record, serialize_record, update_entity_record
from app.services.reservation_assignment import apply_assignment_to_reservation, find_reservation_assignment


def records(db: Session, entity_name: str, restaurant_id: str) -> list[dict[str, Any]]:
    return [
        serialize_record(record)
        for record in db.query(EntityRecord).filter(EntityRecord.entity_name == entity_name).all()
        if (record.data or {}).get("restaurant_id") == restaurant_id
    ]


def _record_by_id_or_reservation_id(
    db: Session,
    restaurant_id: str,
    reservation_identifier: str,
) -> dict[str, Any] | None:
    for reservation in records(db, "Reservation", restaurant_id):
        if reservation.get("id") == reservation_identifier or reservation.get("reservation_id") == reservation_identifier:
            return reservation
    return None


def _next_reservation_id(db: Session, restaurant_id: str) -> str:
    current_year = date.today().year
    prefix = f"R-{current_year}-"
    max_number = 0
    for reservation in records(db, "Reservation", restaurant_id):
        value = str(reservation.get("reservation_id") or "")
        if not value.startswith(prefix):
            continue
        try:
            max_number = max(max_number, int(value.replace(prefix, "")))
        except ValueError:
            continue
    return f"{prefix}{str(max_number + 1).zfill(4)}"


def reservation_service(hora: str | None) -> str | None:
    if not hora:
        return None
    try:
        parsed = datetime.strptime(hora[:5], "%H:%M").time()
    except ValueError:
        return None
    if parsed.hour < 18:
        return "comida"
    return "cena"


def infer_reservation_filters(message: str) -> dict[str, Any]:
    text = message.lower()
    filters: dict[str, Any] = {}
    date_match = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", message)
    if date_match:
        filters["fecha"] = date_match.group(1)
    elif "mañana" in text or "manana" in text:
        filters["fecha"] = (date.today() + timedelta(days=1)).isoformat()
    elif "hoy" in text:
        filters["fecha"] = date.today().isoformat()

    reservation_id_match = re.search(r"\bR-\d{4}-\d{4,}\b", message, flags=re.IGNORECASE)
    if reservation_id_match:
        filters["reservation_id"] = reservation_id_match.group(0).upper()

    if any(word in text for word in ["comida", "almuerzo", "mediodia", "mediodía"]):
        filters["service"] = "comida"
    elif any(word in text for word in ["cena", "noche"]):
        filters["service"] = "cena"

    if "cancelada" in text:
        filters["estado"] = "cancelada"
    elif "pendiente" in text:
        filters["estado"] = "pendiente"
    elif "confirmada" in text:
        filters["estado"] = "confirmada"

    return filters


def parse_spanish_date(message: str) -> str | None:
    text = message.lower()
    if "pasado mañana" in text or "pasado manana" in text:
        return (date.today() + timedelta(days=2)).isoformat()
    if "mañana" in text or "manana" in text:
        return (date.today() + timedelta(days=1)).isoformat()
    if "hoy" in text:
        return date.today().isoformat()

    iso_match = re.search(r"\b(20\d{2})-(\d{1,2})-(\d{1,2})\b", message)
    if iso_match:
        year, month, day = map(int, iso_match.groups())
        try:
            return date(year, month, day).isoformat()
        except ValueError:
            return None

    slash_match = re.search(r"\b(\d{1,2})/(\d{1,2})/(20\d{2})\b", message)
    if slash_match:
        day, month, year = map(int, slash_match.groups())
        try:
            return date(year, month, day).isoformat()
        except ValueError:
            return None

    return None


def parse_reservation_draft(message: str) -> dict[str, Any]:
    text = message.strip()
    lower = text.lower()
    draft: dict[str, Any] = {}

    parsed_date = parse_spanish_date(text)
    if parsed_date:
        draft["fecha"] = parsed_date

    time_match = re.search(r"\b(?:a las|alas|sobre las|hora)?\s*(\d{1,2})[:.](\d{2})\b", lower)
    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2))
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            draft["hora"] = f"{hour:02d}:{minute:02d}"
    else:
        hour_match = re.search(r"\b(?:a las|alas|sobre las)\s*(\d{1,2})\b", lower)
        if hour_match:
            hour = int(hour_match.group(1))
            if 0 <= hour <= 23:
                draft["hora"] = f"{hour:02d}:00"

    diners_match = re.search(r"\b(\d{1,2})\s*(?:personas|persona|comensales|pax)\b", lower)
    if diners_match:
        draft["comensales"] = int(diners_match.group(1))

    phone_match = re.search(r"(\+?\d[\d\s-]{7,}\d)", text)
    if phone_match:
        draft["cliente_telefono"] = re.sub(r"\s+", "", phone_match.group(1))

    email_match = re.search(r"[\w.\-+]+@[\w.\-]+\.\w+", text)
    if email_match:
        draft["cliente_email"] = email_match.group(0)

    name_match = re.search(
        r"(?:reserva\s+(?:para|a nombre de)|reservar\s+(?:para|a nombre de)|cliente)\s+([^,.;]+)",
        text,
        flags=re.IGNORECASE,
    )
    if name_match:
        draft["cliente_nombre"] = _clean_candidate_name(name_match.group(1))
    elif "," in text:
        first_part = text.split(",", 1)[0].strip()
        if not parse_spanish_date(first_part) and not re.search(r"\d", first_part):
            draft["cliente_nombre"] = _clean_candidate_name(first_part)

    return {key: value for key, value in draft.items() if value not in {None, ""}}


def _clean_candidate_name(value: str) -> str:
    value = re.split(
        r"\b(?:hoy|mañana|manana|pasado mañana|pasado manana|a las|alas|para \d|con \d|\d{1,2}[:.]\d{2})\b",
        value,
        flags=re.IGNORECASE,
    )[0]
    value = " ".join(value.strip(" ,.;").split())
    value = re.sub(r"\b(?:para|con|de|el|la|los|las)$", "", value, flags=re.IGNORECASE)
    return " ".join(value.strip(" ,.;").split())


def reservation_draft_missing_fields(draft: dict[str, Any]) -> list[str]:
    labels = {
        "cliente_nombre": "nombre del cliente",
        "fecha": "fecha",
        "hora": "hora",
        "comensales": "numero de comensales",
    }
    return [label for field, label in labels.items() if draft.get(field) in {None, ""}]


def is_reservation_write_intent(message: str) -> bool:
    text = message.lower()
    draft = parse_reservation_draft(message)
    create_words = [
        "crear reserva",
        "crea una reserva",
        "crear una reserva",
        "haz una reserva",
        "hacer una reserva",
        "reservar",
        "reserva para",
        "reserva a nombre",
    ]
    if any(word in text for word in create_words):
        return True
    return bool({"cliente_nombre", "hora", "comensales"} & set(draft.keys()))


def list_reservations(
    db: Session,
    restaurant_id: str,
    filters: dict[str, Any] | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    filters = filters or {}
    items = records(db, "Reservation", restaurant_id)
    if filters.get("reservation_id"):
        items = [item for item in items if item.get("reservation_id") == filters["reservation_id"]]
    if filters.get("fecha"):
        items = [item for item in items if item.get("fecha") == filters["fecha"]]
    if filters.get("estado"):
        items = [item for item in items if item.get("estado") == filters["estado"]]
    if filters.get("service"):
        items = [item for item in items if reservation_service(item.get("hora")) == filters["service"]]
    if filters.get("cliente"):
        needle = str(filters["cliente"]).lower()
        items = [
            item for item in items
            if needle in str(item.get("cliente_nombre") or "").lower()
            or needle in str(item.get("cliente_email") or "").lower()
            or needle in str(item.get("cliente_telefono") or "").lower()
        ]
    items = sorted(items, key=lambda item: (item.get("fecha") or "", item.get("hora") or ""), reverse=True)
    return {
        "filters": filters,
        "count": len(items),
        "reservations": items[:limit],
    }


def get_reservation(
    db: Session,
    restaurant_id: str,
    reservation_identifier: str,
) -> dict[str, Any]:
    reservation = _record_by_id_or_reservation_id(db, restaurant_id, reservation_identifier)
    if not reservation:
        return {"success": False, "error": "Reserva no encontrada"}
    return {"success": True, "reservation": reservation}


def create_reservation_tool(db: Session, restaurant_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    missing = [
        field for field in ["cliente_nombre", "fecha", "hora", "comensales"]
        if payload.get(field) in {None, ""}
    ]
    if missing:
        return {"success": False, "error": f"Faltan campos requeridos: {', '.join(missing)}"}

    assignment = find_reservation_assignment(db, restaurant_id, payload)
    if not assignment.get("success"):
        return assignment

    customer = None
    for candidate in records(db, "Customer", restaurant_id):
        same_email = payload.get("cliente_email") and candidate.get("email") == payload.get("cliente_email")
        same_phone = payload.get("cliente_telefono") and candidate.get("telefono") == payload.get("cliente_telefono")
        if same_email or same_phone:
            customer = candidate
            break

    if not customer:
        customer = create_entity_record(db, "Customer", {
            "restaurant_id": restaurant_id,
            "nombre": payload.get("cliente_nombre") or "",
            "apellidos": payload.get("cliente_apellidos") or "",
            "email": payload.get("cliente_email"),
            "telefono": payload.get("cliente_telefono"),
            "total_visitas": 1,
            "ultima_visita": payload.get("fecha"),
            "estado": "activo",
        })

    reservation_data = {
        **payload,
        "restaurant_id": restaurant_id,
        "reservation_id": payload.get("reservation_id") or _next_reservation_id(db, restaurant_id),
        "cliente_id": customer["id"],
        "cliente_nombre": payload.get("cliente_nombre") or customer.get("nombre"),
        "cliente_apellidos": payload.get("cliente_apellidos") or customer.get("apellidos", ""),
        "cliente_email": payload.get("cliente_email") or customer.get("email"),
        "cliente_telefono": payload.get("cliente_telefono") or customer.get("telefono"),
        "estado": payload.get("estado") or "confirmada",
        "origen": payload.get("origen") or "chatbot",
        "confirmation_token": payload.get("confirmation_token") or str(uuid4()),
        "duracion_estimada": payload.get("duracion_estimada") or 90,
    }
    apply_assignment_to_reservation(reservation_data, assignment)

    reservation = create_entity_record(db, "Reservation", reservation_data)
    return {"success": True, "reservation": reservation, "reservation_id": reservation["reservation_id"]}


def update_reservation_tool(db: Session, restaurant_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    identifier = payload.get("id") or payload.get("reservation_id")
    if not identifier:
        return {"success": False, "error": "Falta id o reservation_id"}
    reservation = _record_by_id_or_reservation_id(db, restaurant_id, identifier)
    if not reservation:
        return {"success": False, "error": "Reserva no encontrada"}

    allowed_fields = {
        "cliente_nombre",
        "cliente_apellidos",
        "cliente_email",
        "cliente_telefono",
        "fecha",
        "hora",
        "comensales",
        "mesa_id",
        "mesa_numero",
        "estado",
        "notas",
        "ocasion_especial",
        "duracion_estimada",
        "preferencias",
        "zona_preferida",
        "waiter_id",
        "waiter_name",
    }
    data = {key: value for key, value in payload.items() if key in allowed_fields}
    if not data:
        return {"success": False, "error": "No hay campos validos para actualizar"}
    updated = update_entity_record(db, "Reservation", reservation["id"], data)
    return {"success": True, "reservation": updated}


def delete_reservation_tool(db: Session, restaurant_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    identifier = payload.get("id") or payload.get("reservation_id")
    if not identifier:
        return {"success": False, "error": "Falta id o reservation_id"}
    reservation = _record_by_id_or_reservation_id(db, restaurant_id, identifier)
    if not reservation:
        return {"success": False, "error": "Reserva no encontrada"}
    record = db.get(EntityRecord, reservation["id"])
    if not record or record.entity_name != "Reservation":
        return {"success": False, "error": "Reserva no encontrada"}
    db.delete(record)
    db.commit()
    return {"success": True, "deleted_id": reservation["id"], "reservation_id": reservation.get("reservation_id")}


def get_sales_summary(db: Session, restaurant_id: str) -> dict[str, Any]:
    orders = records(db, "Order", restaurant_id)
    paid_orders = [order for order in orders if order.get("estado") == "pagado"]
    revenue = sum(float(order.get("total") or 0) for order in paid_orders)
    return {
        "orders_total": len(orders),
        "paid_orders": len(paid_orders),
        "revenue": round(revenue, 2),
        "average_ticket": round(revenue / len(paid_orders), 2) if paid_orders else 0,
    }


def get_profit_summary(db: Session, restaurant_id: str) -> dict[str, Any]:
    dishes = list_dishes(db, restaurant_id)
    costed = [dish for dish in dishes if float(dish.get("current_cost") or 0) > 0]
    average_margin = (
        sum(float(dish.get("current_margin") or 0) for dish in costed) / len(costed)
        if costed else 0
    )
    return {
        "costed_dishes": len(costed),
        "average_margin": round(average_margin, 4),
        "low_margin_dishes": low_margin_dishes(db, restaurant_id),
    }


def get_stock_alerts(db: Session, restaurant_id: str) -> dict[str, Any]:
    stock_items = records(db, "Ingredient", restaurant_id)
    cost_items = list_ingredients(db, restaurant_id)
    low_stock = [
        item for item in stock_items
        if float(item.get("stock_actual") or 0) <= float(item.get("stock_minimo") or 0)
    ]
    rising_costs = ingredient_price_changes(db, restaurant_id)[:8]
    return {
        "low_stock_count": len(low_stock),
        "low_stock": low_stock[:8],
        "ingredient_price_changes": rising_costs,
        "cost_ingredients_count": len(cost_items),
    }


def get_top_dishes(db: Session, restaurant_id: str) -> list[dict[str, Any]]:
    orders = records(db, "Order", restaurant_id)
    totals: dict[str, dict[str, Any]] = {}
    for order in orders:
        for item in order.get("items") or []:
            product_id = item.get("product_id") or item.get("dish_id") or item.get("product_name")
            if not product_id:
                continue
            totals.setdefault(product_id, {"name": item.get("product_name"), "quantity": 0, "revenue": 0})
            totals[product_id]["quantity"] += int(item.get("cantidad") or 0)
            totals[product_id]["revenue"] += float(item.get("subtotal") or 0)
    return sorted(totals.values(), key=lambda item: item["quantity"], reverse=True)[:10]


def get_low_margin_dishes(db: Session, restaurant_id: str) -> list[dict[str, Any]]:
    return low_margin_dishes(db, restaurant_id)


def get_customer_segments(db: Session, restaurant_id: str) -> dict[str, Any]:
    customers = records(db, "Customer", restaurant_id)
    cutoff = date.today() - timedelta(days=45)
    inactive = [
        customer for customer in customers
        if customer.get("ultima_visita") and str(customer.get("ultima_visita")) < cutoff.isoformat()
    ]
    vip = [customer for customer in customers if "VIP" in (customer.get("tags") or [])]
    repeat = [customer for customer in customers if int(customer.get("total_visitas") or 0) > 1]
    return {
        "total_customers": len(customers),
        "vip_customers": len(vip),
        "repeat_customers": len(repeat),
        "inactive_customers": len(inactive),
        "inactive_sample": inactive[:8],
    }


def create_campaign_draft(db: Session, restaurant_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    return create_entity_record(db, "Campaign", {
        "restaurant_id": restaurant_id,
        "nombre": payload.get("nombre") or "Campana sugerida por AI Manager",
        "tipo": payload.get("tipo") or "email",
        "estado": "borrador",
        "segmento": payload.get("segmento") or "clientes_inactivos",
        "mensaje": payload.get("mensaje") or "",
        "created_by_ai": True,
    })


def create_reminder(db: Session, restaurant_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    return create_entity_record(db, "ReminderConfig", {
        "restaurant_id": restaurant_id,
        "enabled": bool(payload.get("enabled", True)),
        "hours_before": int(payload.get("hours_before") or 24),
        "only_confirmed": bool(payload.get("only_confirmed", True)),
        "sms_message_template": payload.get("sms_message_template"),
        "created_by_ai": True,
    })


def get_ingredient_price_changes(db: Session, restaurant_id: str) -> list[dict[str, Any]]:
    return ingredient_price_changes(db, restaurant_id)


def get_recipe_cost_breakdown(db: Session, restaurant_id: str, dish_id: str) -> dict[str, Any]:
    return dish_cost_breakdown(db, restaurant_id, dish_id)


def recommend_price_adjustments(db: Session, restaurant_id: str) -> list[dict[str, Any]]:
    return generate_recommendations(db, restaurant_id, 0.68)


def simulate_price_change_tool(db: Session, restaurant_id: str, dish_id: str, new_price: float) -> dict[str, Any]:
    return simulate_price_change(db, restaurant_id, dish_id, new_price)


def select_tools(message: str) -> list[str]:
    text = message.lower()
    selected = {"get_sales_summary", "get_profit_summary", "get_stock_alerts"}
    if any(word in text for word in ["reserva", "reservas", "reservar", "mesa", "comida", "cena", "almuerzo"]):
        selected.add("list_reservations")
    if any(word in text for word in ["dinero", "margen", "precio", "plato", "coste", "subir"]):
        selected.update({"get_low_margin_dishes", "get_ingredient_price_changes", "recommend_price_adjustments"})
    if any(word in text for word in ["cliente", "campana", "venir", "semana"]):
        selected.add("get_customer_segments")
    if any(word in text for word in ["stock", "ingrediente", "proveedor"]):
        selected.add("get_stock_alerts")
    if any(word in text for word in ["vendido", "ventas", "top"]):
        selected.add("get_top_dishes")
    return sorted(selected)


def run_selected_tools(
    db: Session,
    restaurant_id: str,
    tool_names: list[str],
    message: str = "",
) -> dict[str, Any]:
    output: dict[str, Any] = {}
    for name in tool_names:
        if name == "get_sales_summary":
            output[name] = get_sales_summary(db, restaurant_id)
        elif name == "get_profit_summary":
            output[name] = get_profit_summary(db, restaurant_id)
        elif name == "get_stock_alerts":
            output[name] = get_stock_alerts(db, restaurant_id)
        elif name == "get_top_dishes":
            output[name] = get_top_dishes(db, restaurant_id)
        elif name == "get_low_margin_dishes":
            output[name] = get_low_margin_dishes(db, restaurant_id)
        elif name == "get_customer_segments":
            output[name] = get_customer_segments(db, restaurant_id)
        elif name == "get_ingredient_price_changes":
            output[name] = get_ingredient_price_changes(db, restaurant_id)
        elif name == "recommend_price_adjustments":
            output[name] = recommend_price_adjustments(db, restaurant_id)
        elif name == "list_reservations":
            output[name] = list_reservations(db, restaurant_id, infer_reservation_filters(message))
    return output


def deterministic_insights(tool_output: dict[str, Any]) -> list[dict[str, str]]:
    insights = []
    low_margin = tool_output.get("get_low_margin_dishes") or tool_output.get("get_profit_summary", {}).get("low_margin_dishes") or []
    if low_margin:
        insights.append({
            "type": "warning",
            "title": "Platos con margen bajo",
            "description": f"{len(low_margin)} platos tienen margen por debajo del umbral recomendado.",
        })
    stock = tool_output.get("get_stock_alerts", {})
    if stock.get("low_stock_count"):
        insights.append({
            "type": "warning",
            "title": "Stock bajo",
            "description": f"{stock['low_stock_count']} ingredientes estan en nivel bajo.",
        })
    segments = tool_output.get("get_customer_segments", {})
    if segments.get("inactive_customers"):
        insights.append({
            "type": "info",
            "title": "Clientes inactivos",
            "description": f"{segments['inactive_customers']} clientes llevan mas de 45 dias sin venir.",
        })
    sales = tool_output.get("get_sales_summary", {})
    if sales.get("revenue", 0) > 0:
        insights.append({
            "type": "success",
            "title": "Ventas registradas",
            "description": f"Ingresos pagados acumulados: {sales['revenue']:.2f}.",
        })
    reservation_result = tool_output.get("list_reservations", {})
    if reservation_result:
        filters = reservation_result.get("filters") or {}
        service = filters.get("service")
        suffix = f" para {service}" if service else ""
        insights.append({
            "type": "info",
            "title": "Reservas encontradas",
            "description": f"{reservation_result.get('count', 0)} reservas coinciden{suffix}.",
        })
    return insights[:5]


def recommended_actions(tool_output: dict[str, Any]) -> list[dict[str, Any]]:
    actions = []
    if (tool_output.get("get_customer_segments") or {}).get("inactive_customers"):
        actions.append({
            "id": "create_campaign_draft",
            "label": "Crear borrador de campana para clientes inactivos",
            "requires_confirmation": True,
            "payload": {
                "segmento": "clientes_inactivos",
                "tipo": "email",
                "nombre": "Reactivacion de clientes inactivos",
                "mensaje": "Te echamos de menos. Reserva esta semana y disfruta de una propuesta especial.",
            },
        })
    if tool_output.get("recommend_price_adjustments"):
        actions.append({
            "id": "review_price_recommendations",
            "label": "Revisar recomendaciones de precio",
            "requires_confirmation": False,
            "payload": {"route": "/CostIntelligence"},
        })
    if (tool_output.get("get_stock_alerts") or {}).get("low_stock_count"):
        actions.append({
            "id": "create_reminder",
            "label": "Crear recordatorio de revision de stock",
            "requires_confirmation": True,
            "payload": {
                "hours_before": 24,
                "only_confirmed": True,
                "sms_message_template": "Revision interna: comprobar ingredientes con stock bajo antes del servicio.",
            },
        })
    return actions
