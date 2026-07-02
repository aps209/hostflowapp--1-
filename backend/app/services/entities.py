from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.entity import EntityRecord
from app.models.user import User
from app.core.config import settings


def iso(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def serialize_record(record: EntityRecord) -> dict[str, Any]:
    return {
        **(record.data or {}),
        "id": record.id,
        "created_date": iso(record.created_date),
        "updated_date": iso(record.updated_date),
    }


def serialize_user(user: User) -> dict[str, Any]:
    is_platform_admin = user.email.lower() == settings.platform_admin_email.lower()
    return {
        "id": user.id,
        "nombre": user.nombre,
        "full_name": user.nombre,
        "email": user.email,
        "role": user.role,
        "is_platform_admin": is_platform_admin,
        "restaurant_id": user.restaurant_id,
        "modulos_permitidos": user.modulos_permitidos or {},
        "created_date": iso(user.created_date),
        "updated_date": iso(user.updated_date),
    }


def filter_items(items: list[dict[str, Any]], filters: dict[str, Any]) -> list[dict[str, Any]]:
    if not filters:
        return items

    def matches(item: dict[str, Any]) -> bool:
        for key, expected in filters.items():
            if expected is None:
                continue
            if item.get(key) != expected:
                return False
        return True

    return [item for item in items if matches(item)]


def sort_items(items: list[dict[str, Any]], sort: str | None, direction: str = "asc") -> list[dict[str, Any]]:
    if not sort:
        return items
    reverse = direction == "desc"
    return sorted(items, key=lambda item: (item.get(sort) is None, item.get(sort)), reverse=reverse)


def get_entity_items(db: Session, entity_name: str) -> list[dict[str, Any]]:
    if entity_name == "User":
        return [serialize_user(user) for user in db.query(User).all()]
    records = db.query(EntityRecord).filter(EntityRecord.entity_name == entity_name).all()
    return [serialize_record(record) for record in records]


def get_entity_item(db: Session, entity_name: str, item_id: str) -> dict[str, Any] | None:
    if entity_name == "User":
        user = db.get(User, item_id)
        return serialize_user(user) if user else None
    record = db.get(EntityRecord, item_id)
    if not record or record.entity_name != entity_name:
        return None
    return serialize_record(record)


def create_entity_record(db: Session, entity_name: str, data: dict[str, Any]) -> dict[str, Any]:
    record = EntityRecord(entity_name=entity_name, data=data)
    db.add(record)
    db.commit()
    db.refresh(record)
    return serialize_record(record)


def update_entity_record(db: Session, entity_name: str, item_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    if entity_name == "User":
        user = db.get(User, item_id)
        if not user:
            return None
        for key, value in data.items():
            if key in {"nombre", "role", "restaurant_id", "modulos_permitidos"}:
                setattr(user, key, value)
            if key == "full_name":
                user.nombre = value
        db.commit()
        db.refresh(user)
        return serialize_user(user)

    record = db.get(EntityRecord, item_id)
    if not record or record.entity_name != entity_name:
        return None
    record.data = {**(record.data or {}), **data}
    db.commit()
    db.refresh(record)
    return serialize_record(record)
