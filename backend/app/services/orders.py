from typing import Any

from sqlalchemy.orm import Session

from app.models.entity import EntityRecord
from app.services.cost_intelligence import _to_float, _unit_factor
from app.services.entities import create_entity_record, serialize_record, update_entity_record


def _records(db: Session, entity_name: str, restaurant_id: str) -> list[dict[str, Any]]:
    return [
        serialize_record(record)
        for record in db.query(EntityRecord).filter(EntityRecord.entity_name == entity_name).all()
        if (record.data or {}).get("restaurant_id") == restaurant_id
    ]


def _deduct_stock(db: Session, restaurant_id: str, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Descuenta ingredientes del stock segun la receta de cada producto pedido."""
    products = {product["id"]: product for product in _records(db, "Product", restaurant_id)}
    ingredients = {ingredient["id"]: ingredient for ingredient in _records(db, "Ingredient", restaurant_id)}

    consumption: dict[str, float] = {}
    for item in items:
        product = products.get(item.get("product_id"))
        if not product:
            continue
        receta = product.get("receta") or []
        cantidad = _to_float(item.get("cantidad"), 1)
        for line in receta:
            ingredient = ingredients.get(line.get("ingredient_id"))
            if not ingredient:
                continue
            ingredient_unit = ingredient.get("unidad_medida") or ingredient.get("unit")
            factor = _unit_factor(line.get("unit"), ingredient_unit)
            qty = _to_float(line.get("quantity")) * factor * cantidad
            consumption[ingredient["id"]] = consumption.get(ingredient["id"], 0.0) + qty

    warnings: list[dict[str, Any]] = []
    for ingredient_id, qty in consumption.items():
        ingredient = ingredients[ingredient_id]
        current = _to_float(ingredient.get("stock_actual"))
        new_stock = round(current - qty, 4)
        update_entity_record(db, "Ingredient", ingredient_id, {"stock_actual": new_stock})
        minimo = _to_float(ingredient.get("stock_minimo"))
        if new_stock < 0:
            warnings.append({"ingredient": ingredient.get("nombre"), "stock_actual": new_stock, "level": "negative"})
        elif minimo > 0 and new_stock <= minimo:
            warnings.append({"ingredient": ingredient.get("nombre"), "stock_actual": new_stock, "level": "low"})
    return warnings


def create_order(db: Session, restaurant_id: str, order_data: dict[str, Any]) -> dict[str, Any]:
    items = order_data.get("items") or []
    order = create_entity_record(db, "Order", {**order_data, "restaurant_id": restaurant_id})
    warnings = _deduct_stock(db, restaurant_id, items)
    return {"order": order, "stock_warnings": warnings}
