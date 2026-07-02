import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class EntityRecord(Base):
    __tablename__ = "entity_records"
    __table_args__ = (
        Index("ix_entity_records_entity_created", "entity_name", "created_date"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    entity_name: Mapped[str] = mapped_column(String, index=True, nullable=False)
    data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)
