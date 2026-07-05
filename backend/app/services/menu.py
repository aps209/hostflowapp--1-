import re
import unicodedata
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.entity import EntityRecord
from app.services.ai.providers.base import AIConfigurationError
from app.services.ai.providers.factory import get_ai_provider
from app.services.entities import create_entity_record, serialize_record


PRODUCT = "Product"
VALID_CATEGORIES = {"entrantes", "principales", "postres", "bebidas", "vinos", "cafes", "otros"}


MENU_SYSTEM_PROMPT = """
Eres un extractor de cartas/menus de restaurante. Recibes una o varias imagenes de la carta.
Devuelve SOLO JSON valido con este formato exacto:
{
  "dishes": [
    {"name": string, "price": number, "category": "entrantes"|"principales"|"postres"|"bebidas"|"vinos"|"cafes"|"otros"}
  ]
}
Reglas:
- name: el nombre del plato o bebida, limpio y sin la descripcion larga.
- price: numero en euros con punto decimal. Si un plato muestra varios precios, usa el principal (racion/plato).
- category: clasifica cada elemento en una de las categorias indicadas. Si no esta claro, usa "otros".
- Incluye SOLO elementos que tengan un precio visible.
- Ignora titulos de seccion, alergenos, notas, telefonos y textos que no sean platos con precio.
- No inventes platos ni precios. Usa punto decimal, nunca coma.
"""


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


def _normalize_name(value: str | None) -> str:
    text = unicodedata.normalize("NFKD", str(value or "").lower())
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"[^a-z0-9 ]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _normalize_category(value: str | None) -> str:
    category = _normalize_name(value)
    return category if category in VALID_CATEGORIES else "otros"


def _restaurant_products(db: Session, restaurant_id: str) -> list[dict[str, Any]]:
    records = db.query(EntityRecord).filter(EntityRecord.entity_name == PRODUCT).all()
    return [
        serialize_record(record)
        for record in records
        if (record.data or {}).get("restaurant_id") == restaurant_id
    ]


def scan_menu(db: Session, restaurant_id: str, images: list[dict[str, str]]) -> dict[str, Any]:
    provider = get_ai_provider()
    try:
        extracted = provider.generate_json_with_images(
            MENU_SYSTEM_PROMPT,
            "Extrae todos los platos y bebidas con precio de estas imagenes de la carta.",
            images,
        )
    except AIConfigurationError as error:
        return {"success": False, "error": str(error)}

    raw_dishes = extracted.get("dishes") if isinstance(extracted, dict) else None
    if not isinstance(raw_dishes, list) or not raw_dishes:
        return {
            "success": False,
            "error": "No he podido leer platos en las imagenes. Prueba con fotos mas nitidas de la carta.",
        }

    existing_names = {_normalize_name(product.get("nombre")) for product in _restaurant_products(db, restaurant_id)}

    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for dish in raw_dishes:
        name = str(dish.get("name") or "").strip()
        price = _to_float(dish.get("price"))
        if not name or price <= 0:
            continue
        key = _normalize_name(name)
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            "nombre": name,
            "precio": round(price, 2),
            "categoria": _normalize_category(dish.get("category")),
            "exists": key in existing_names,
        })

    if not rows:
        return {"success": False, "error": "No se han detectado platos con precio validos en las imagenes."}

    return {
        "success": True,
        "rows": rows,
        "summary": {
            "detected": len(rows),
            "new": sum(1 for row in rows if not row["exists"]),
            "existing": sum(1 for row in rows if row["exists"]),
        },
    }


def apply_menu(db: Session, restaurant_id: str, dishes: list[dict[str, Any]]) -> dict[str, Any]:
    existing_names = {_normalize_name(product.get("nombre")) for product in _restaurant_products(db, restaurant_id)}
    created = 0
    skipped = 0
    for dish in dishes:
        name = str(dish.get("nombre") or dish.get("name") or "").strip()
        price = _to_float(dish.get("precio", dish.get("price")))
        if not name or price <= 0:
            continue
        if _normalize_name(name) in existing_names:
            skipped += 1
            continue
        create_entity_record(db, PRODUCT, {
            "restaurant_id": restaurant_id,
            "nombre": name,
            "precio": round(price, 2),
            "categoria": _normalize_category(dish.get("categoria") or dish.get("category")),
            "activo": True,
            "origen": "menu_scan",
            "created_at": _now(),
        })
        existing_names.add(_normalize_name(name))
        created += 1

    return {"success": True, "created": created, "skipped": skipped}
