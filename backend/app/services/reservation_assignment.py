from __future__ import annotations

from itertools import combinations
from typing import Any

from sqlalchemy.orm import Session

from app.models.entity import EntityRecord
from app.services.entities import serialize_record


def _records(db: Session, entity_name: str, restaurant_id: str) -> list[dict[str, Any]]:
    return [
        serialize_record(record)
        for record in db.query(EntityRecord).filter(EntityRecord.entity_name == entity_name).all()
        if (record.data or {}).get("restaurant_id") == restaurant_id
    ]


def _first_record(db: Session, entity_name: str, restaurant_id: str) -> dict[str, Any]:
    records = _records(db, entity_name, restaurant_id)
    return records[0] if records else {}


def _as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _time_to_minutes(value: str | None) -> int | None:
    if not value:
        return None
    try:
        hour, minute = str(value)[:5].split(":")
        return int(hour) * 60 + int(minute)
    except (TypeError, ValueError):
        return None


def _reservation_table_ids(reservation: dict[str, Any]) -> set[str]:
    table_ids = {reservation.get("mesa_id")}
    table_ids.update(reservation.get("mesas_unidas") or [])
    return {str(table_id) for table_id in table_ids if table_id}


def _overlaps(start_a: int, end_a: int, start_b: int, end_b: int) -> bool:
    return start_a < end_b and start_b < end_a


def find_reservation_assignment(
    db: Session,
    restaurant_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    fecha = payload.get("fecha")
    hora = payload.get("hora")
    comensales = _as_int(payload.get("comensales"))
    if not fecha or not hora or comensales <= 0:
        return {"success": False, "error": "Faltan fecha, hora o comensales validos para comprobar mesas"}

    config = _first_record(db, "RestaurantConfig", restaurant_id)
    duration = _as_int(
        payload.get("duracion_estimada") or config.get("duracion_reserva_default"),
        90,
    )
    start = _time_to_minutes(hora)
    if start is None:
        return {"success": False, "error": "La hora de la reserva no es valida"}
    end = start + duration

    tables = [
        table for table in _records(db, "Table", restaurant_id)
        if table.get("activa", True) and table.get("estado") != "no_disponible"
    ]
    if not tables:
        return {"success": False, "error": "No hay mesas activas configuradas"}

    blocked_table_ids = {
        str(item.get("mesa_id"))
        for item in _records(db, "TableAvailability", restaurant_id)
        if item.get("fecha") == fecha and item.get("mesa_id")
    }
    reservations = [
        reservation for reservation in _records(db, "Reservation", restaurant_id)
        if reservation.get("fecha") == fecha
        and reservation.get("id") != payload.get("id")
        and str(reservation.get("estado") or "").lower() not in {"cancelada", "cancelado", "cancelled"}
    ]

    def is_available(table: dict[str, Any]) -> bool:
        table_id = str(table.get("id"))
        if not table_id or table_id in blocked_table_ids:
            return False
        for reservation in reservations:
            if table_id not in _reservation_table_ids(reservation):
                continue
            reservation_start = _time_to_minutes(reservation.get("hora"))
            if reservation_start is None:
                continue
            reservation_duration = _as_int(reservation.get("duracion_estimada"), duration)
            if _overlaps(start, end, reservation_start, reservation_start + reservation_duration):
                return False
        return True

    def has_capacity(table: dict[str, Any]) -> bool:
        capacity = _as_int(table.get("capacidad"))
        if table.get("exact_capacity_only") is True:
            return capacity == comensales
        return capacity >= comensales

    requested_table_id = payload.get("mesa_id") or payload.get("table_id")
    if requested_table_id:
        selected_table = next((table for table in tables if table.get("id") == requested_table_id), None)
        if not selected_table:
            return {"success": False, "error": "La mesa solicitada no existe o no esta activa"}
        if not has_capacity(selected_table):
            return {
                "success": False,
                "error": f"La mesa {selected_table.get('numero') or requested_table_id} no tiene capacidad para {comensales} comensales",
            }
        if not is_available(selected_table):
            return {
                "success": False,
                "error": f"La mesa {selected_table.get('numero') or requested_table_id} no esta disponible en ese horario",
            }
        return {"success": True, "table": selected_table, "joined_tables": [], "duration": duration}

    direct_candidates = [
        table for table in tables
        if has_capacity(table) and is_available(table)
    ]
    if direct_candidates:
        selected_table = sorted(
            direct_candidates,
            key=lambda table: (_as_int(table.get("capacidad")) - comensales, str(table.get("numero") or "")),
        )[0]
        return {"success": True, "table": selected_table, "joined_tables": [], "duration": duration}

    allow_table_joining = config.get("allow_table_joining") is True
    if allow_table_joining:
        join_groups: dict[str, list[dict[str, Any]]] = {}
        for table in tables:
            if table.get("exact_capacity_only") is True or not is_available(table):
                continue
            group_ids = table.get("join_group_ids") or ([table.get("join_group_id")] if table.get("join_group_id") else [])
            for group_id in group_ids:
                join_groups.setdefault(str(group_id), []).append(table)

        best_combo: tuple[dict[str, Any], ...] | None = None
        best_excess = None
        for group_tables in join_groups.values():
            ordered_tables = sorted(group_tables, key=lambda table: (_as_int(table.get("capacidad")), str(table.get("numero") or "")))
            for size in range(2, len(ordered_tables) + 1):
                for combo in combinations(ordered_tables, size):
                    total_capacity = sum(_as_int(table.get("capacidad")) for table in combo)
                    if total_capacity < comensales:
                        continue
                    excess = total_capacity - comensales
                    if best_excess is None or excess < best_excess:
                        best_combo = combo
                        best_excess = excess
                    if best_excess == 0:
                        break
                if best_excess == 0:
                    break

        if best_combo:
            sorted_combo = sorted(best_combo, key=lambda table: str(table.get("numero") or ""))
            return {
                "success": True,
                "table": sorted_combo[0],
                "joined_tables": sorted_combo[1:],
                "duration": duration,
            }

    max_capacity = max((_as_int(table.get("capacidad")) for table in tables), default=0)
    if max_capacity < comensales and not allow_table_joining:
        return {
            "success": False,
            "error": f"No hay ninguna mesa con capacidad para {comensales} comensales. La mesa mas grande tiene {max_capacity}.",
        }
    return {
        "success": False,
        "error": f"No hay mesas disponibles para {comensales} comensales el {fecha} a las {hora}.",
    }


def apply_assignment_to_reservation(
    reservation_data: dict[str, Any],
    assignment: dict[str, Any],
) -> None:
    table = assignment.get("table")
    if not table:
        return
    joined_tables = assignment.get("joined_tables") or []
    all_tables = [table, *joined_tables]
    reservation_data.setdefault("mesa_id", table["id"])
    reservation_data.setdefault("mesa_numero", table.get("numero"))
    reservation_data.setdefault("mesas_unidas", [joined_table["id"] for joined_table in joined_tables])
    reservation_data.setdefault("mesas_numeros", [item.get("numero") for item in all_tables])
    reservation_data.setdefault("duracion_estimada", assignment.get("duration") or reservation_data.get("duracion_estimada") or 90)
