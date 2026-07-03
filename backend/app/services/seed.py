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
    "ai_manager": True,
    "cost_intelligence": True,
}


def modules_for_plan(plan: str, role: str = "CEO") -> dict:
    normalized_plan = plan.upper()
    normalized_role = role.upper()
    return {
        **DEFAULT_MODULES,
        "dashboard_principal": True,
        "crm_privado": normalized_role == "CEO" and normalized_plan in {"PREMIUM", "ULTRA"},
        "ai_manager": normalized_role == "CEO" and normalized_plan == "ULTRA",
        "cost_intelligence": normalized_role == "CEO" and normalized_plan == "ULTRA",
        "plan": normalized_plan,
    }


def normalize_module_permissions(db: Session) -> None:
    changed = False

    restaurants = db.query(EntityRecord).filter(EntityRecord.entity_name == "Restaurant").all()
    for restaurant in restaurants:
        data = restaurant.data or {}
        modules = data.get("modulos_activos") or {}
        if any(key not in modules for key in DEFAULT_MODULES):
            restaurant.data = {
                **data,
                "modulos_activos": {
                    **modules,
                    **{key: modules.get(key, value) for key, value in DEFAULT_MODULES.items()},
                },
            }
            changed = True

    users = db.query(User).all()
    for user in users:
        modules = user.modulos_permitidos or {}
        if any(key not in modules for key in DEFAULT_MODULES):
            user.modulos_permitidos = {
                **modules,
                **{key: modules.get(key, value) for key, value in DEFAULT_MODULES.items()},
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

    seed_cost_demo(db, restaurant_id)

    db.commit()
    return restaurant_id


def seed_cost_demo(db: Session, restaurant_id: str) -> None:
    """Datos demo de coste sobre la entidad unificada Ingredient (compartida con Stock)."""
    create_record(db, "Supplier", {
        "restaurant_id": restaurant_id,
        "name": "Proveedor Demo",
        "contact_info": "compras@proveedor.local",
    })
    tomato = create_record(db, "Ingredient", {
        "restaurant_id": restaurant_id,
        "nombre": "Tomate pera",
        "categoria": "verduras",
        "unidad_medida": "kg",
        "stock_actual": 8,
        "stock_minimo": 3,
        "coste_unitario": 2.4,
        "coste_unitario_anterior": 2.0,
        "proveedor": "Proveedor Demo",
        "activo": True,
    })
    burrata = create_record(db, "Ingredient", {
        "restaurant_id": restaurant_id,
        "nombre": "Burrata",
        "categoria": "lacteos",
        "unidad_medida": "unidad",
        "stock_actual": 12,
        "stock_minimo": 6,
        "coste_unitario": 3.1,
        "coste_unitario_anterior": 2.85,
        "proveedor": "Proveedor Demo",
        "activo": True,
    })
    dish = create_record(db, "Dish", {
        "restaurant_id": restaurant_id,
        "name": "Ensalada de burrata",
        "sale_price": 12.5,
        "category": "entrantes",
        "active": True,
        "target_margin": 0.68,
        "estimated_monthly_units": 120,
    })
    create_record(db, "Recipe", {
        "restaurant_id": restaurant_id,
        "dish_id": dish.id,
        "ingredient_id": tomato.id,
        "quantity": 0.18,
        "unit": "kg",
    })
    create_record(db, "Recipe", {
        "restaurant_id": restaurant_id,
        "dish_id": dish.id,
        "ingredient_id": burrata.id,
        "quantity": 1,
        "unit": "unidad",
    })


def ensure_cost_demo_data(db: Session, restaurant_id: str) -> None:
    existing = db.query(EntityRecord).filter(
        EntityRecord.entity_name == "Dish",
        EntityRecord.data["restaurant_id"].astext == restaurant_id,
    ).first()
    if existing:
        return

    seed_cost_demo(db, restaurant_id)
    db.commit()


def migrate_cost_ingredients_to_stock(db: Session) -> None:
    """Unifica los antiguos CostIngredient en la entidad Ingredient de Stock.

    Idempotente: si no quedan registros CostIngredient no hace nada.
    Reasigna las recetas que apuntaban al viejo ingrediente y elimina el legacy.
    """
    from app.services.cost_intelligence import _normalize_name

    legacy = db.query(EntityRecord).filter(EntityRecord.entity_name == "CostIngredient").all()
    if not legacy:
        return

    ingredients = db.query(EntityRecord).filter(EntityRecord.entity_name == "Ingredient").all()
    index: dict[tuple, str] = {}
    for ingredient in ingredients:
        data = ingredient.data or {}
        key = (data.get("restaurant_id"), _normalize_name(data.get("nombre") or data.get("name")))
        index[key] = ingredient.id

    id_map: dict[str, str] = {}
    for record in legacy:
        data = record.data or {}
        restaurant_id = data.get("restaurant_id")
        name = data.get("name") or data.get("nombre") or ""
        key = (restaurant_id, _normalize_name(name))
        target_id = index.get(key)
        if not target_id:
            new_ingredient = create_record(db, "Ingredient", {
                "restaurant_id": restaurant_id,
                "nombre": name,
                "categoria": "otros",
                "unidad_medida": data.get("unit") or "kg",
                "stock_actual": 0,
                "stock_minimo": 0,
                "coste_unitario": data.get("current_cost_per_unit") or 0,
                "coste_unitario_anterior": data.get("previous_cost_per_unit"),
                "proveedor": "",
                "activo": True,
            })
            target_id = new_ingredient.id
            index[key] = target_id
        id_map[record.id] = target_id

    for recipe in db.query(EntityRecord).filter(EntityRecord.entity_name == "Recipe").all():
        data = recipe.data or {}
        old_id = data.get("ingredient_id")
        if old_id in id_map:
            recipe.data = {**data, "ingredient_id": id_map[old_id]}

    for record in legacy:
        db.delete(record)
    db.commit()


def seed_initial_data(db: Session) -> None:
    if not settings.seed_initial_data:
        return

    normalize_module_permissions(db)
    migrate_cost_ingredients_to_stock(db)

    user = db.query(User).filter(User.email == settings.seed_admin_email).first()
    if user:
        user.role = "CEO"
        user.modulos_permitidos = {
            **modules_for_plan("ULTRA", "CEO"),
            **(user.modulos_permitidos or {}),
            "plan": (user.modulos_permitidos or {}).get("plan", "ULTRA"),
        }
        if not user.pin_hash:
            user.pin_hash = hash_password(settings.seed_admin_pin)
        if not getattr(user, "is_active", True):
            user.is_active = True
        db.commit()
        if user.restaurant_id:
            ensure_cost_demo_data(db, user.restaurant_id)
        return

    restaurant_id = create_restaurant_bundle(db, "HostFlow")
    user = User(
        nombre="Administrador HostFlow",
        email=settings.seed_admin_email,
        password_hash=hash_password(settings.seed_admin_password),
        role="CEO",
        restaurant_id=restaurant_id,
        pin_hash=hash_password(settings.seed_admin_pin),
        is_active=True,
        modulos_permitidos=modules_for_plan("ULTRA", "CEO"),
    )
    db.add(user)
    db.commit()
