from datetime import date, timedelta
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.entity import EntityRecord
from app.models.user import User


DEFAULT_MODULES = {
    "dashboard_principal": True,
    "crm_privado": True,
}


def normalize_module_permissions(db: Session) -> None:
    changed = False

    restaurants = db.query(EntityRecord).filter(EntityRecord.entity_name == "Restaurant").all()
    for restaurant in restaurants:
        data = restaurant.data or {}
        modules = data.get("modulos_activos") or {}
        if "dashboard_principal" not in modules or "crm_privado" not in modules:
            restaurant.data = {
                **data,
                "modulos_activos": {
                    **modules,
                    "dashboard_principal": modules.get("dashboard_principal", True),
                    "crm_privado": modules.get("crm_privado", True),
                },
            }
            changed = True

    users = db.query(User).all()
    for user in users:
        modules = user.modulos_permitidos or {}
        if "dashboard_principal" not in modules or "crm_privado" not in modules:
            user.modulos_permitidos = {
                **modules,
                "dashboard_principal": modules.get("dashboard_principal", True),
                "crm_privado": modules.get("crm_privado", True),
            }
            changed = True

    if changed:
        db.commit()


def create_record(db: Session, entity_name: str, data: dict) -> EntityRecord:
    record = EntityRecord(entity_name=entity_name, data=data)
    db.add(record)
    db.flush()
    return record


def create_restaurant_bundle(db: Session, owner_name: str, slug: str = "demo-hostflow") -> str:
    existing = db.query(EntityRecord).filter(
        EntityRecord.entity_name == "Restaurant",
        EntityRecord.data["slug"].astext == slug,
    ).first()
    if existing:
        return existing.id

    restaurant = create_record(db, "Restaurant", {
        "nombre": f"Restaurante {owner_name}",
        "slug": slug,
        "direccion": "Calle Mayor 12, Madrid",
        "telefono": "+34 612 345 678",
        "email": "reservas@hostflow.local",
        "website": "https://hostflow.local",
        "descripcion": "Restaurante de demostracion para entorno local.",
        "activo": True,
        "fecha_registro": date.today().isoformat(),
        "plan": "premium",
        "modulos_activos": DEFAULT_MODULES,
    })
    restaurant_id = restaurant.id

    create_record(db, "RestaurantConfig", {
        "restaurant_id": restaurant_id,
        "nombre_restaurante": f"Restaurante {owner_name}",
        "duracion_reserva_default": 90,
        "max_comensales_reserva": 12,
        "idioma": "es",
        "formato_fecha": "DD/MM/YYYY",
        "formato_hora": "24h",
        "moneda": "EUR",
        "simbolo_moneda": "€",
        "color_primario": "#1e3a8a",
        "color_acento": "#f59e0b",
        "allow_table_joining": True,
        "require_table_zone_selection": False,
        "available_zones": ["Salon", "Terraza"],
    })

    for day in ["lunes", "martes", "miercoles", "miércoles", "jueves", "viernes", "sábado", "domingo"]:
        create_record(db, "Schedule", {
            "restaurant_id": restaurant_id,
            "day_of_week": day,
            "is_open": True,
            "slots": [
                {"opening_time": "13:00", "closing_time": "16:00"},
                {"opening_time": "20:00", "closing_time": "23:30"},
            ],
            "duracion_reserva_default": 90,
        })

    tables = [
        {"numero": "1", "capacidad": 2, "posicion_x": 120, "posicion_y": 120, "sala": "Salon"},
        {"numero": "2", "capacidad": 4, "posicion_x": 260, "posicion_y": 120, "sala": "Salon", "join_group_ids": ["salon-a"]},
        {"numero": "3", "capacidad": 4, "posicion_x": 400, "posicion_y": 120, "sala": "Salon", "join_group_ids": ["salon-a"]},
        {"numero": "4", "capacidad": 6, "posicion_x": 180, "posicion_y": 280, "sala": "Terraza"},
    ]
    table_records = []
    for table in tables:
        table_records.append(create_record(db, "Table", {
            "restaurant_id": restaurant_id,
            "activa": True,
            "forma": "cuadrada",
            **table,
        }))

    customer = create_record(db, "Customer", {
        "restaurant_id": restaurant_id,
        "nombre": "Laura",
        "apellidos": "Garcia",
        "email": "laura@example.com",
        "telefono": "+34 600 111 222",
        "tags": ["VIP"],
        "total_visitas": 3,
        "gasto_total": 180,
        "gasto_medio": 60,
        "ultima_visita": date.today().isoformat(),
        "estado": "activo",
    })

    reservation_date = (date.today() + timedelta(days=1)).isoformat()
    create_record(db, "Reservation", {
        "restaurant_id": restaurant_id,
        "reservation_id": f"R-{date.today().year}-0001",
        "cliente_id": customer.id,
        "cliente_nombre": "Laura",
        "cliente_apellidos": "Garcia",
        "cliente_email": "laura@example.com",
        "cliente_telefono": "+34 600 111 222",
        "fecha": reservation_date,
        "hora": "20:30",
        "comensales": 2,
        "mesa_id": table_records[0].id,
        "mesa_numero": "1",
        "mesas_unidas": [],
        "mesas_numeros": ["1"],
        "estado": "confirmada",
        "origen": "admin",
        "confirmation_token": str(uuid4()),
        "duracion_estimada": 90,
    })

    for status in [
        ("confirmada", "Confirmada", "#22c55e"),
        ("pendiente", "Pendiente", "#f59e0b"),
        ("sentada", "Sentada", "#3b82f6"),
        ("completada", "Completada", "#64748b"),
        ("cancelada", "Cancelada", "#ef4444"),
        ("no_show", "No show", "#991b1b"),
    ]:
        create_record(db, "ReservationStatus", {
            "restaurant_id": restaurant_id,
            "key": status[0],
            "label": status[1],
            "color": status[2],
            "is_system": True,
            "active": True,
            "order": len(status[0]),
        })

    create_record(db, "Tag", {"restaurant_id": restaurant_id, "nombre": "VIP", "color": "#f59e0b"})
    create_record(db, "Waiter", {"restaurant_id": restaurant_id, "nombre": "Sofia", "apellidos": "Martin", "color": "#3498db"})
    create_record(db, "Review", {
        "restaurant_id": restaurant_id,
        "cliente_id": customer.id,
        "cliente_nombre": "Laura Garcia",
        "calificacion": 5,
        "comentario": "Servicio excelente.",
        "fecha_visita": reservation_date,
        "recomendaria": True,
        "estado": "publicada",
    })
    create_record(db, "ReminderConfig", {"restaurant_id": restaurant_id, "enabled": True, "hours_before": 24})

    db.commit()
    return restaurant_id


def seed_initial_data(db: Session) -> None:
    if not settings.seed_initial_data:
        return

    normalize_module_permissions(db)

    user = db.query(User).filter(User.email == settings.seed_admin_email).first()
    if user:
        return

    restaurant_id = create_restaurant_bundle(db, "HostFlow")
    user = User(
        nombre="Administrador HostFlow",
        email=settings.seed_admin_email,
        password_hash=hash_password(settings.seed_admin_password),
        role="admin",
        restaurant_id=restaurant_id,
        modulos_permitidos=DEFAULT_MODULES,
    )
    db.add(user)
    db.commit()
