import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, is_platform_admin
from app.db.database import get_db
from app.models.entity import EntityRecord
from app.services.authz import has_permission
from app.services.entities import (
    create_entity_record,
    filter_items,
    get_entity_item,
    get_entity_items,
    serialize_record,
    sort_items,
    update_entity_record,
)


router = APIRouter(prefix="/entities", tags=["entities"])


ENTITY_PERMISSIONS = {
    "Customer": "crm",
    "Campaign": "crm",
    "Tag": "crm",
    "Waiter": "crm",
    "ReminderConfig": "crm",
}


def ensure_entity_permission(entity_name: str, current_user) -> None:
    if is_platform_admin(current_user):
        return
    permission = ENTITY_PERMISSIONS.get(entity_name)
    if permission and not has_permission(current_user, permission):
        raise HTTPException(status_code=403, detail="No tienes permiso para esta entidad")


def scope_items_for_user(entity_name: str, items: list[dict], current_user) -> list[dict]:
    if is_platform_admin(current_user):
        return items
    if entity_name == "User":
        return [
            item for item in items
            if item.get("id") == current_user.id
            or (current_user.company_id and item.get("company_id") == current_user.company_id)
        ]
    if entity_name == "Restaurant":
        return [item for item in items if item.get("id") == current_user.restaurant_id]
    scoped = [
        item for item in items
        if item.get("restaurant_id") in {None, current_user.restaurant_id}
    ]
    return scoped


def ensure_platform_admin_for_entity_write(entity_name: str, current_user, item_id: str | None = None) -> None:
    if entity_name not in {"User", "Restaurant"}:
        return
    if is_platform_admin(current_user):
        return
    if entity_name == "User" and item_id == current_user.id:
        return
    if entity_name == "Restaurant" and item_id == current_user.restaurant_id:
        return
    raise HTTPException(status_code=403, detail="No tienes permisos para esta accion")


def ensure_restaurant_scope(payload: dict, current_user) -> dict:
    if is_platform_admin(current_user):
        return payload
    if payload.get("restaurant_id") and payload.get("restaurant_id") != current_user.restaurant_id:
        raise HTTPException(status_code=403, detail="No puedes escribir datos de otro restaurante")
    return {**payload, "restaurant_id": current_user.restaurant_id}


def parse_filters(filters: str | None) -> dict:
    if not filters:
        return {}
    try:
        parsed = json.loads(filters)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


@router.get("/{entity_name}")
def list_entity(
    entity_name: str,
    sort: str | None = None,
    direction: str = "asc",
    limit: int | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> list[dict]:
    ensure_entity_permission(entity_name, current_user)
    items = scope_items_for_user(entity_name, get_entity_items(db, entity_name), current_user)
    items = sort_items(items, sort, direction)
    return items[:limit] if limit else items


@router.get("/{entity_name}/filter")
def filter_entity(
    entity_name: str,
    filters: str | None = None,
    sort: str | None = None,
    direction: str = "asc",
    limit: int | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> list[dict]:
    ensure_entity_permission(entity_name, current_user)
    items = scope_items_for_user(entity_name, get_entity_items(db, entity_name), current_user)
    items = filter_items(items, parse_filters(filters))
    items = sort_items(items, sort, direction)
    return items[:limit] if limit else items


@router.get("/{entity_name}/{item_id}")
def get_entity(
    entity_name: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict:
    ensure_entity_permission(entity_name, current_user)
    item = get_entity_item(db, entity_name, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    if item not in scope_items_for_user(entity_name, [item], current_user):
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return item


@router.post("/{entity_name}")
def create_entity(
    entity_name: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict:
    ensure_entity_permission(entity_name, current_user)
    ensure_platform_admin_for_entity_write(entity_name, current_user)
    if entity_name not in {"User", "Restaurant"}:
        payload = ensure_restaurant_scope(payload, current_user)
    return create_entity_record(db, entity_name, payload)


@router.post("/{entity_name}/bulk")
def bulk_create_entity(
    entity_name: str,
    payload: list[dict],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> list[dict]:
    ensure_entity_permission(entity_name, current_user)
    ensure_platform_admin_for_entity_write(entity_name, current_user)
    if entity_name not in {"User", "Restaurant"}:
        payload = [ensure_restaurant_scope(item, current_user) for item in payload]
    records = [EntityRecord(entity_name=entity_name, data=item) for item in payload]
    db.add_all(records)
    db.commit()
    for record in records:
        db.refresh(record)
    return [serialize_record(record) for record in records]


@router.patch("/{entity_name}/{item_id}")
def update_entity(
    entity_name: str,
    item_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict:
    ensure_entity_permission(entity_name, current_user)
    ensure_platform_admin_for_entity_write(entity_name, current_user, item_id)
    existing = get_entity_item(db, entity_name, item_id)
    if not existing or existing not in scope_items_for_user(entity_name, [existing], current_user):
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    if entity_name not in {"User", "Restaurant"}:
        payload = ensure_restaurant_scope(payload, current_user)
    item = update_entity_record(db, entity_name, item_id, payload)
    if not item:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return item


@router.delete("/{entity_name}/{item_id}")
def delete_entity(
    entity_name: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict:
    ensure_entity_permission(entity_name, current_user)
    ensure_platform_admin_for_entity_write(entity_name, current_user, item_id)
    record = db.get(EntityRecord, item_id)
    if not record or record.entity_name != entity_name:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    item = serialize_record(record)
    if item not in scope_items_for_user(entity_name, [item], current_user):
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    db.delete(record)
    db.commit()
    return {"success": True, "id": item_id}
