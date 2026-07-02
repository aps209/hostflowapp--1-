import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.entity import EntityRecord
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
    _current_user=Depends(get_current_user),
) -> list[dict]:
    items = sort_items(get_entity_items(db, entity_name), sort, direction)
    return items[:limit] if limit else items


@router.get("/{entity_name}/filter")
def filter_entity(
    entity_name: str,
    filters: str | None = None,
    sort: str | None = None,
    direction: str = "asc",
    limit: int | None = None,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> list[dict]:
    items = filter_items(get_entity_items(db, entity_name), parse_filters(filters))
    items = sort_items(items, sort, direction)
    return items[:limit] if limit else items


@router.get("/{entity_name}/{item_id}")
def get_entity(
    entity_name: str,
    item_id: str,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict:
    item = get_entity_item(db, entity_name, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return item


@router.post("/{entity_name}")
def create_entity(
    entity_name: str,
    payload: dict,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict:
    return create_entity_record(db, entity_name, payload)


@router.post("/{entity_name}/bulk")
def bulk_create_entity(
    entity_name: str,
    payload: list[dict],
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> list[dict]:
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
    _current_user=Depends(get_current_user),
) -> dict:
    item = update_entity_record(db, entity_name, item_id, payload)
    if not item:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return item


@router.delete("/{entity_name}/{item_id}")
def delete_entity(
    entity_name: str,
    item_id: str,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict:
    record = db.get(EntityRecord, item_id)
    if not record or record.entity_name != entity_name:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    db.delete(record)
    db.commit()
    return {"success": True, "id": item_id}
