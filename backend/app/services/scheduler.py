"""Scheduler in-process para disparar recordatorios automaticos.

Un job cada 10 minutos revisa los ReminderConfig activos y, cuando la hora local
del restaurante alcanza su `send_time`, dispara enviar_recordatorios una sola vez
al dia (marcador `last_reminder_run_date`, idempotente).

Caveat: con varios workers de uvicorn se lanzaria un scheduler por proceso. En dev
usar 1 worker, o RUN_SCHEDULER=1 solo en un proceso. El marcador diario mitiga
envios duplicados aunque coincidan dos procesos.
"""
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.db.database import SessionLocal


logger = logging.getLogger("hostflow.scheduler")

_scheduler = None


def _run_due_reminders() -> None:
    # Imports diferidos para evitar cargar el router en el arranque del modulo.
    from app.api.functions import all_records, enviar_recordatorios
    from app.services.entities import update_entity_record

    try:
        tz = ZoneInfo(settings.reminder_timezone)
    except Exception:
        tz = ZoneInfo("UTC")

    now = datetime.now(tz)
    today_str = now.date().isoformat()
    current_hm = now.strftime("%H:%M")

    db = SessionLocal()
    try:
        configs = [c for c in all_records(db, "ReminderConfig") if c.get("enabled")]
        for config in configs:
            restaurant_id = config.get("restaurant_id")
            if not restaurant_id:
                continue
            send_time = config.get("send_time") or "10:00"
            if current_hm < send_time:
                continue
            if config.get("last_reminder_run_date") == today_str:
                continue

            try:
                result = enviar_recordatorios(db, {"restaurant_id": restaurant_id})
                logger.info(
                    "Recordatorios %s: enviados=%s errores=%s",
                    restaurant_id, result.get("enviados"), result.get("errores"),
                )
            except Exception:
                logger.exception("Fallo enviando recordatorios para %s", restaurant_id)
                continue

            update_entity_record(db, "ReminderConfig", config["id"], {
                "last_reminder_run_date": today_str,
            })
    finally:
        db.close()


def start_scheduler() -> None:
    global _scheduler
    if not settings.run_scheduler or _scheduler is not None:
        return
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
    except ImportError:
        logger.warning("APScheduler no instalado; recordatorios automaticos deshabilitados")
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        _run_due_reminders,
        trigger="interval",
        minutes=10,
        id="due_reminders",
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info("Scheduler de recordatorios iniciado (cada 10 min, tz=%s)", settings.reminder_timezone)
