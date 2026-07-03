import re
import unicodedata
from datetime import datetime, timezone
from math import ceil
from typing import Any

from sqlalchemy.orm import Session

from app.models.entity import EntityRecord
from app.services.ai.providers.base import AIConfigurationError
from app.services.ai.providers.factory import get_ai_provider
from app.services.entities import create_entity_record, serialize_record, update_entity_record


# La entidad canonica de ingredientes es la misma que usa Stock: "Ingredient".
# Cost Intelligence y Stock comparten ahora una unica fuente de verdad.
COST_INGREDIENT = "Ingredient"
COST_SUPPLIER = "Supplier"
COST_DISH = "Dish"
COST_RECIPE_ITEM = "Recipe"
COST_INVOICE = "PurchaseInvoice"
COST_INVOICE_ITEM = "PurchaseInvoiceItem"
COST_RECOMMENDATION = "CostRecommendation"
COST_TICKET = "PurchaseTicket"

VALID_UNITS = {"kg", "g", "l", "ml", "unidad"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_float(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).replace(",", ".").strip())
    except (TypeError, ValueError):
        return default


def _records(db: Session, entity_name: str, restaurant_id: str) -> list[dict[str, Any]]:
    records = db.query(EntityRecord).filter(EntityRecord.entity_name == entity_name).all()
    return [
        serialize_record(record)
        for record in records
        if (record.data or {}).get("restaurant_id") == restaurant_id
    ]


def _get(records: list[dict[str, Any]], item_id: str | None) -> dict[str, Any] | None:
    return next((item for item in records if item.get("id") == item_id), None)


def _owned_record(db: Session, entity_name: str, restaurant_id: str, item_id: str) -> EntityRecord | None:
    record = db.get(EntityRecord, item_id)
    if not record or record.entity_name != entity_name:
        return None
    if (record.data or {}).get("restaurant_id") != restaurant_id:
        return None
    return record


def _normalize_name(value: str | None) -> str:
    text = unicodedata.normalize("NFKD", str(value or "").lower())
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"[^a-z0-9 ]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _normalize_unit(value: str | None) -> str:
    unit = _normalize_name(value)
    aliases = {
        "kilogramo": "kg", "kilogramos": "kg", "kilo": "kg", "kilos": "kg", "kgs": "kg",
        "gramo": "g", "gramos": "g", "grs": "g", "gr": "g",
        "litro": "l", "litros": "l", "lt": "l", "lts": "l",
        "mililitro": "ml", "mililitros": "ml",
        "unidades": "unidad", "ud": "unidad", "uds": "unidad", "u": "unidad", "pza": "unidad",
    }
    unit = aliases.get(unit, unit)
    return unit if unit in VALID_UNITS else (value or "kg")


def _unit_factor(from_unit: str | None, to_unit: str | None) -> float:
    """Factor para convertir una cantidad expresada en `from_unit` a `to_unit`."""
    normalized = {
        "g": ("mass", 0.001),
        "kg": ("mass", 1.0),
        "ml": ("volume", 0.001),
        "l": ("volume", 1.0),
        "unidad": ("count", 1.0),
    }
    source = normalized.get(_normalize_unit(from_unit))
    target = normalized.get(_normalize_unit(to_unit))
    if source and target and source[0] == target[0]:
        return source[1] / target[1]
    return 1.0


# ---------------------------------------------------------------------------
# Ingredientes (vista unificada sobre la entidad Ingredient)
# ---------------------------------------------------------------------------

def _ingredient_view(record: dict[str, Any]) -> dict[str, Any]:
    unit = record.get("unidad_medida") or record.get("unit") or "kg"
    previous_raw = record.get("coste_unitario_anterior", record.get("previous_cost_per_unit"))
    previous = _to_float(previous_raw) if previous_raw not in (None, "") else None
    return {
        **record,
        "name": record.get("nombre") or record.get("name") or "",
        "unit": unit,
        "current_cost_per_unit": _to_float(record.get("coste_unitario", record.get("current_cost_per_unit"))),
        "previous_cost_per_unit": previous,
        "categoria": record.get("categoria") or "otros",
        "proveedor": record.get("proveedor") or "",
        "stock_actual": _to_float(record.get("stock_actual")),
        "stock_minimo": _to_float(record.get("stock_minimo")),
        "activo": record.get("activo", True),
        "coste_actualizado_en": record.get("coste_actualizado_en"),
    }


def list_ingredients(db: Session, restaurant_id: str) -> list[dict[str, Any]]:
    return [_ingredient_view(record) for record in _records(db, COST_INGREDIENT, restaurant_id)]


def list_suppliers(db: Session, restaurant_id: str) -> list[dict[str, Any]]:
    return _records(db, COST_SUPPLIER, restaurant_id)


def create_ingredient(db: Session, restaurant_id: str, data: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "restaurant_id": restaurant_id,
        "nombre": data.get("name") or data.get("nombre") or "",
        "categoria": data.get("categoria") or "otros",
        "unidad_medida": _normalize_unit(data.get("unit") or data.get("unidad_medida") or "kg"),
        "coste_unitario": _to_float(data.get("current_cost_per_unit", data.get("coste_unitario"))),
        "coste_unitario_anterior": (
            _to_float(data.get("previous_cost_per_unit"))
            if data.get("previous_cost_per_unit") not in (None, "") else None
        ),
        "stock_actual": _to_float(data.get("stock_actual")),
        "stock_minimo": _to_float(data.get("stock_minimo")),
        "proveedor": data.get("proveedor") or "",
        "activo": data.get("activo", True),
        "coste_actualizado_en": _now(),
    }
    record = create_entity_record(db, COST_INGREDIENT, payload)
    return _ingredient_view(record)


def update_ingredient(
    db: Session,
    restaurant_id: str,
    ingredient_id: str,
    data: dict[str, Any],
) -> dict[str, Any] | None:
    record = _owned_record(db, COST_INGREDIENT, restaurant_id, ingredient_id)
    if not record:
        return None
    current = _ingredient_view(serialize_record(record))
    patch: dict[str, Any] = {}

    if "name" in data or "nombre" in data:
        patch["nombre"] = data.get("name") or data.get("nombre") or current["name"]
    if "categoria" in data and data["categoria"]:
        patch["categoria"] = data["categoria"]
    if "unit" in data or "unidad_medida" in data:
        patch["unidad_medida"] = _normalize_unit(data.get("unit") or data.get("unidad_medida"))
    if "stock_actual" in data and data["stock_actual"] is not None:
        patch["stock_actual"] = _to_float(data["stock_actual"])
    if "stock_minimo" in data and data["stock_minimo"] is not None:
        patch["stock_minimo"] = _to_float(data["stock_minimo"])
    if "proveedor" in data and data["proveedor"] is not None:
        patch["proveedor"] = data["proveedor"]
    if "activo" in data and data["activo"] is not None:
        patch["activo"] = bool(data["activo"])

    new_cost_raw = data.get("current_cost_per_unit", data.get("coste_unitario"))
    if new_cost_raw not in (None, ""):
        new_cost = _to_float(new_cost_raw)
        if abs(new_cost - current["current_cost_per_unit"]) > 1e-9:
            patch["coste_unitario_anterior"] = current["current_cost_per_unit"]
            patch["coste_unitario"] = new_cost
            patch["coste_actualizado_en"] = _now()

    if not patch:
        return current
    updated = update_entity_record(db, COST_INGREDIENT, ingredient_id, patch)
    return _ingredient_view(updated) if updated else None


def delete_ingredient(db: Session, restaurant_id: str, ingredient_id: str) -> bool:
    record = _owned_record(db, COST_INGREDIENT, restaurant_id, ingredient_id)
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True


# ---------------------------------------------------------------------------
# Registros genericos de coste (platos, proveedores, recetas)
# ---------------------------------------------------------------------------

def list_dishes(db: Session, restaurant_id: str) -> list[dict[str, Any]]:
    dishes = _records(db, COST_DISH, restaurant_id)
    return [with_dish_cost(db, restaurant_id, dish) for dish in dishes]


def list_recipe_items(db: Session, restaurant_id: str) -> list[dict[str, Any]]:
    return _records(db, COST_RECIPE_ITEM, restaurant_id)


def create_cost_record(db: Session, entity_name: str, restaurant_id: str, data: dict[str, Any]) -> dict[str, Any]:
    if entity_name == COST_INGREDIENT:
        return create_ingredient(db, restaurant_id, data)
    return create_entity_record(db, entity_name, {
        **data,
        "restaurant_id": restaurant_id,
        "updated_at": _now(),
    })


def update_dish(db: Session, restaurant_id: str, dish_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    record = _owned_record(db, COST_DISH, restaurant_id, dish_id)
    if not record:
        return None
    allowed = {"name", "sale_price", "category", "active", "target_margin", "estimated_monthly_units"}
    patch = {key: value for key, value in data.items() if key in allowed and value is not None}
    if not patch:
        return with_dish_cost(db, restaurant_id, serialize_record(record))
    updated = update_entity_record(db, COST_DISH, dish_id, patch)
    return with_dish_cost(db, restaurant_id, updated) if updated else None


def delete_cost_record(db: Session, restaurant_id: str, entity_name: str, item_id: str) -> bool:
    record = _owned_record(db, entity_name, restaurant_id, item_id)
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True


def delete_dish(db: Session, restaurant_id: str, dish_id: str) -> bool:
    recipes = [item for item in list_recipe_items(db, restaurant_id) if item.get("dish_id") == dish_id]
    for recipe in recipes:
        delete_cost_record(db, restaurant_id, COST_RECIPE_ITEM, recipe["id"])
    return delete_cost_record(db, restaurant_id, COST_DISH, dish_id)


def create_invoice(db: Session, restaurant_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Factura rapida manual: actualiza coste y repone stock de cada ingrediente."""
    items = data.pop("items", [])
    invoice = create_entity_record(db, COST_INVOICE, {
        **data,
        "restaurant_id": restaurant_id,
        "updated_at": _now(),
    })
    for item in items:
        create_entity_record(db, COST_INVOICE_ITEM, {
            **item,
            "restaurant_id": restaurant_id,
            "invoice_id": invoice["id"],
        })
        ingredient_id = item.get("ingredient_id")
        if not ingredient_id:
            continue
        current = _get(list_ingredients(db, restaurant_id), ingredient_id)
        if not current:
            continue
        unit_price = _to_float(item.get("unit_price"), current["current_cost_per_unit"])
        quantity = _to_float(item.get("quantity"))
        update_ingredient(db, restaurant_id, ingredient_id, {
            "current_cost_per_unit": unit_price,
            "stock_actual": current["stock_actual"] + quantity,
        })
    return invoice


# ---------------------------------------------------------------------------
# Coste de platos y margenes
# ---------------------------------------------------------------------------

def dish_cost_breakdown(db: Session, restaurant_id: str, dish_id: str) -> dict[str, Any]:
    dishes = _records(db, COST_DISH, restaurant_id)
    ingredients = list_ingredients(db, restaurant_id)
    recipe_items = [
        item for item in list_recipe_items(db, restaurant_id)
        if item.get("dish_id") == dish_id
    ]
    dish = _get(dishes, dish_id)
    if not dish:
        return {"success": False, "error": "Plato no encontrado"}

    rows = []
    total_cost = 0.0
    for item in recipe_items:
        ingredient = _get(ingredients, item.get("ingredient_id"))
        if not ingredient:
            continue
        quantity = _to_float(item.get("quantity"))
        factor = _unit_factor(item.get("unit"), ingredient.get("unit"))
        normalized_quantity = quantity * factor
        unit_cost = _to_float(ingredient.get("current_cost_per_unit"))
        line_cost = normalized_quantity * unit_cost
        total_cost += line_cost
        rows.append({
            "ingredient_id": ingredient["id"],
            "ingredient_name": ingredient.get("name"),
            "quantity": quantity,
            "unit": item.get("unit"),
            "unit_cost": unit_cost,
            "line_cost": round(line_cost, 4),
        })

    sale_price = _to_float(dish.get("sale_price"))
    margin = (sale_price - total_cost) / sale_price if sale_price > 0 else 0
    return {
        "success": True,
        "dish": dish,
        "items": rows,
        "current_cost": round(total_cost, 4),
        "sale_price": sale_price,
        "current_margin": round(margin, 4),
    }


def with_dish_cost(db: Session, restaurant_id: str, dish: dict[str, Any]) -> dict[str, Any]:
    breakdown = dish_cost_breakdown(db, restaurant_id, dish["id"])
    return {
        **dish,
        "current_cost": breakdown.get("current_cost", 0),
        "current_margin": breakdown.get("current_margin", 0),
    }


def _recommended_price(cost: float, target_margin: float) -> float:
    if target_margin >= 1 or cost <= 0:
        return round(cost, 2)
    return ceil(cost / (1 - target_margin) * 10) / 10


def _dish_status(current_margin: float, target_margin: float) -> str:
    if current_margin >= target_margin:
        return "ok"
    if current_margin >= target_margin - 0.10:
        return "ajustado"
    return "subir_precio"


def dish_price_advice(db: Session, restaurant_id: str) -> list[dict[str, Any]]:
    advice = []
    for dish in list_dishes(db, restaurant_id):
        cost = _to_float(dish.get("current_cost"))
        if cost <= 0:
            continue
        sale_price = _to_float(dish.get("sale_price"))
        current_margin = _to_float(dish.get("current_margin"))
        target_margin = _to_float(dish.get("target_margin"), 0.68)
        recommended = _recommended_price(cost, target_margin)
        status = _dish_status(current_margin, target_margin)
        advice.append({
            "dish_id": dish["id"],
            "dish_name": dish.get("name"),
            "sale_price": round(sale_price, 2),
            "current_cost": round(cost, 4),
            "current_margin": round(current_margin, 4),
            "target_margin": round(target_margin, 4),
            "recommended_price": recommended,
            "price_gap": round(recommended - sale_price, 2),
            "status": status,
        })
    order = {"subir_precio": 0, "ajustado": 1, "ok": 2}
    return sorted(advice, key=lambda item: (order[item["status"]], item["current_margin"]))


def simulate_price_change(db: Session, restaurant_id: str, dish_id: str, new_price: float) -> dict[str, Any]:
    breakdown = dish_cost_breakdown(db, restaurant_id, dish_id)
    if not breakdown.get("success"):
        return breakdown

    dish = breakdown["dish"]
    current_price = _to_float(dish.get("sale_price"))
    current_cost = _to_float(breakdown.get("current_cost"))
    current_margin = _to_float(breakdown.get("current_margin"))
    new_margin = (new_price - current_cost) / new_price if new_price > 0 else 0
    monthly_units = int(_to_float(dish.get("estimated_monthly_units")))
    estimated_impact = (new_price - current_price) * monthly_units
    increase_ratio = (new_price - current_price) / current_price if current_price > 0 else 0
    risk_level = "low" if increase_ratio <= 0.08 else "medium" if increase_ratio <= 0.18 else "high"

    return {
        "current_price": round(current_price, 2),
        "new_price": round(new_price, 2),
        "current_margin": round(current_margin, 4),
        "new_margin": round(new_margin, 4),
        "estimated_monthly_impact": round(estimated_impact, 2),
        "risk_level": risk_level,
        "explanation": (
            f"Con un coste actual de {current_cost:.2f}, el margen pasaria de "
            f"{current_margin * 100:.1f}% a {new_margin * 100:.1f}%."
        ),
    }


def generate_recommendations(db: Session, restaurant_id: str, target_margin: float) -> list[dict[str, Any]]:
    recommendations = []
    for dish in list_dishes(db, restaurant_id):
        sale_price = _to_float(dish.get("sale_price"))
        current_cost = _to_float(dish.get("current_cost"))
        current_margin = _to_float(dish.get("current_margin"))
        if sale_price <= 0 or current_cost <= 0 or current_margin >= target_margin:
            continue

        recommended_price = _recommended_price(current_cost, target_margin)
        recommendation = create_entity_record(db, COST_RECOMMENDATION, {
            "restaurant_id": restaurant_id,
            "dish_id": dish["id"],
            "dish_name": dish.get("name"),
            "current_cost": round(current_cost, 4),
            "current_margin": round(current_margin, 4),
            "target_margin": target_margin,
            "recommended_price": round(recommended_price, 2),
            "reason": (
                f"El margen actual es {current_margin * 100:.1f}% y el objetivo es "
                f"{target_margin * 100:.1f}%."
            ),
            "created_at": _now(),
        })
        recommendations.append(recommendation)

    return recommendations


def ingredient_price_changes(db: Session, restaurant_id: str) -> list[dict[str, Any]]:
    changes = []
    for ingredient in list_ingredients(db, restaurant_id):
        current = _to_float(ingredient.get("current_cost_per_unit"))
        previous = _to_float(ingredient.get("previous_cost_per_unit"))
        if previous <= 0:
            continue
        delta = current - previous
        changes.append({
            "ingredient_id": ingredient["id"],
            "name": ingredient.get("name"),
            "previous_cost_per_unit": previous,
            "current_cost_per_unit": current,
            "change_amount": round(delta, 4),
            "change_percent": round(delta / previous, 4),
        })
    return sorted(changes, key=lambda item: abs(item["change_percent"]), reverse=True)


def low_margin_dishes(db: Session, restaurant_id: str, threshold: float = 0.6) -> list[dict[str, Any]]:
    return [
        dish for dish in list_dishes(db, restaurant_id)
        if _to_float(dish.get("current_margin")) < threshold and _to_float(dish.get("current_cost")) > 0
    ]


# ---------------------------------------------------------------------------
# Lector de tickets de compra (vision IA)
# ---------------------------------------------------------------------------

TICKET_SYSTEM_PROMPT = """
Eres un extractor de tickets y facturas de compra de un restaurante.
Recibes la imagen de un ticket de un proveedor de alimentos/bebidas.
Devuelve SOLO JSON valido con este formato exacto:
{
  "supplier": string|null,
  "date": "YYYY-MM-DD"|null,
  "currency": "EUR",
  "items": [
    {"name": string, "quantity": number|null, "unit": "kg"|"g"|"l"|"ml"|"unidad"|null,
     "unit_price": number|null, "line_total": number|null}
  ]
}
Reglas:
- Normaliza cada unidad a una de: kg, g, l, ml, unidad.
- Si falta unit_price pero hay line_total y quantity, calcula unit_price = line_total / quantity.
- Usa punto decimal, nunca coma.
- Ignora lineas que no sean productos (IVA, impuestos, totales, descuentos, cambio, tarjeta).
- No inventes productos ni precios. Si un dato no aparece, ponlo a null.
"""


def _match_ingredient(name: str, catalog: list[dict[str, Any]]) -> dict[str, Any] | None:
    target = _normalize_name(name)
    if not target:
        return None
    target_tokens = set(target.split())
    best: dict[str, Any] | None = None
    best_score = 0.0
    for ingredient in catalog:
        candidate = _normalize_name(ingredient.get("name"))
        if not candidate:
            continue
        if candidate == target:
            return ingredient
        candidate_tokens = set(candidate.split())
        if target in candidate or candidate in target:
            score = 0.85
        else:
            union = target_tokens | candidate_tokens
            score = len(target_tokens & candidate_tokens) / len(union) if union else 0.0
        if score > best_score:
            best_score = score
            best = ingredient
    return best if best_score >= 0.5 else None


def _build_ticket_row(item: dict[str, Any], catalog: list[dict[str, Any]]) -> dict[str, Any] | None:
    name = str(item.get("name") or "").strip()
    if not name:
        return None
    ticket_unit = _normalize_unit(item.get("unit") or "unidad")
    quantity = _to_float(item.get("quantity"))
    unit_price = item.get("unit_price")
    line_total = _to_float(item.get("line_total"))
    if unit_price in (None, "") and quantity > 0 and line_total > 0:
        unit_price = line_total / quantity
    unit_price = _to_float(unit_price)

    match = _match_ingredient(name, catalog)
    if match:
        ing_unit = match["unit"]
        price_in_unit = round(unit_price * _unit_factor(ing_unit, ticket_unit), 4)
        stock_add = round(quantity * _unit_factor(ticket_unit, ing_unit), 4)
        old_cost = match["current_cost_per_unit"]
        delta_pct = round((price_in_unit - old_cost) / old_cost, 4) if old_cost > 0 else None
        return {
            "action": "update",
            "ingredient_id": match["id"],
            "name": match["name"],
            "ticket_name": name,
            "unit": ing_unit,
            "new_cost": price_in_unit,
            "old_cost": round(old_cost, 4),
            "cost_delta_pct": delta_pct,
            "quantity": stock_add,
            "ticket_quantity": quantity,
            "ticket_unit": ticket_unit,
            "stock_actual": match["stock_actual"],
            "stock_after": round(match["stock_actual"] + stock_add, 4),
            "replenish": True,
        }
    return {
        "action": "create",
        "ingredient_id": None,
        "name": name,
        "ticket_name": name,
        "unit": ticket_unit,
        "new_cost": round(unit_price, 4),
        "old_cost": None,
        "cost_delta_pct": None,
        "quantity": quantity,
        "ticket_quantity": quantity,
        "ticket_unit": ticket_unit,
        "stock_actual": 0.0,
        "stock_after": quantity,
        "replenish": True,
    }


def _project_dishes(db: Session, restaurant_id: str, price_map: dict[str, float]) -> list[dict[str, Any]]:
    """Recalcula el coste de los platos aplicando precios nuevos por ingrediente."""
    if not price_map:
        return []
    ingredients = {item["id"]: item for item in list_ingredients(db, restaurant_id)}
    recipes = list_recipe_items(db, restaurant_id)
    results = []
    for dish in _records(db, COST_DISH, restaurant_id):
        dish_recipes = [item for item in recipes if item.get("dish_id") == dish["id"]]
        old_cost = 0.0
        new_cost = 0.0
        touched = False
        for item in dish_recipes:
            ingredient = ingredients.get(item.get("ingredient_id"))
            if not ingredient:
                continue
            factor = _unit_factor(item.get("unit"), ingredient["unit"])
            quantity = _to_float(item.get("quantity")) * factor
            old_unit = ingredient["current_cost_per_unit"]
            new_unit = price_map.get(item["ingredient_id"], old_unit)
            if item["ingredient_id"] in price_map:
                touched = True
            old_cost += quantity * old_unit
            new_cost += quantity * new_unit
        if not touched or abs(new_cost - old_cost) < 1e-9:
            continue
        sale_price = _to_float(dish.get("sale_price"))
        old_margin = (sale_price - old_cost) / sale_price if sale_price > 0 else 0
        new_margin = (sale_price - new_cost) / sale_price if sale_price > 0 else 0
        target_margin = _to_float(dish.get("target_margin"), 0.68)
        results.append({
            "dish_id": dish["id"],
            "dish_name": dish.get("name"),
            "sale_price": round(sale_price, 2),
            "old_cost": round(old_cost, 4),
            "new_cost": round(new_cost, 4),
            "old_margin": round(old_margin, 4),
            "new_margin": round(new_margin, 4),
            "target_margin": round(target_margin, 4),
            "recommended_price": _recommended_price(new_cost, target_margin),
            "below_target": new_margin < target_margin,
        })
    results.sort(key=lambda item: item["new_margin"])
    return results


def scan_ticket(
    db: Session,
    restaurant_id: str,
    image_base64: str,
    mime_type: str = "image/jpeg",
    note: str | None = None,
) -> dict[str, Any]:
    catalog = list_ingredients(db, restaurant_id)
    catalog_names = [ingredient["name"] for ingredient in catalog if ingredient.get("name")]
    user_text = (
        "Extrae las lineas de producto de este ticket de compra. "
        "Ingredientes que ya existen en el sistema (usa el mismo nombre si reconoces alguno): "
        f"{', '.join(catalog_names) if catalog_names else 'ninguno todavia'}."
    )
    if note:
        user_text += f" Nota del usuario: {note}"

    provider = get_ai_provider()
    try:
        extracted = provider.generate_json_with_image(
            TICKET_SYSTEM_PROMPT, user_text, image_base64, mime_type
        )
    except AIConfigurationError as error:
        return {"success": False, "error": str(error)}

    items = extracted.get("items") if isinstance(extracted, dict) else None
    if not isinstance(items, list) or not items:
        return {
            "success": False,
            "error": "No he podido leer productos en la imagen. Prueba con una foto mas nitida del ticket.",
        }

    rows = [row for row in (_build_ticket_row(item, catalog) for item in items) if row]
    if not rows:
        return {"success": False, "error": "No se han detectado lineas de producto validas en el ticket."}

    price_map = {
        row["ingredient_id"]: row["new_cost"]
        for row in rows
        if row["action"] == "update" and row["ingredient_id"]
    }
    affected_dishes = _project_dishes(db, restaurant_id, price_map)

    new_count = sum(1 for row in rows if row["action"] == "create")
    update_count = sum(1 for row in rows if row["action"] == "update")
    total_ticket = round(
        sum(_to_float(row.get("new_cost")) * _to_float(row.get("ticket_quantity")) for row in rows), 2
    )
    return {
        "success": True,
        "supplier": extracted.get("supplier"),
        "date": extracted.get("date"),
        "rows": rows,
        "affected_dishes": affected_dishes,
        "summary": {
            "new_count": new_count,
            "update_count": update_count,
            "dishes_below_target": sum(1 for dish in affected_dishes if dish["below_target"]),
            "estimated_total": total_ticket,
        },
    }


def apply_ticket(
    db: Session,
    restaurant_id: str,
    rows: list[dict[str, Any]],
    supplier: str | None = None,
    ticket_date: str | None = None,
    replenish_stock: bool = True,
) -> dict[str, Any]:
    created = 0
    updated = 0
    applied_rows = []
    for row in rows:
        action = row.get("action")
        name = row.get("name") or row.get("ticket_name")
        new_cost = _to_float(row.get("new_cost"))
        unit = _normalize_unit(row.get("unit"))
        add_stock = _to_float(row.get("quantity")) if (replenish_stock and row.get("replenish", True)) else 0.0

        if action == "create":
            ingredient = create_ingredient(db, restaurant_id, {
                "name": name,
                "unit": unit,
                "current_cost_per_unit": new_cost,
                "stock_actual": add_stock,
                "proveedor": supplier or "",
            })
            created += 1
            applied_rows.append({"ingredient_id": ingredient["id"], "name": name, "action": "create"})
        elif action == "update" and row.get("ingredient_id"):
            current = _get(list_ingredients(db, restaurant_id), row["ingredient_id"])
            if not current:
                continue
            update_ingredient(db, restaurant_id, row["ingredient_id"], {
                "current_cost_per_unit": new_cost,
                "stock_actual": current["stock_actual"] + add_stock,
            })
            updated += 1
            applied_rows.append({"ingredient_id": row["ingredient_id"], "name": name, "action": "update"})

    ticket_record = create_entity_record(db, COST_TICKET, {
        "restaurant_id": restaurant_id,
        "supplier": supplier,
        "date": ticket_date,
        "rows": applied_rows,
        "created_ingredients": created,
        "updated_ingredients": updated,
        "created_at": _now(),
    })

    return {
        "success": True,
        "ticket_id": ticket_record["id"],
        "created": created,
        "updated": updated,
        "price_advice": dish_price_advice(db, restaurant_id),
    }
