from sqlalchemy import inspect, text

from app.db.database import engine


def ensure_runtime_schema() -> None:
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    statements = []
    if "company_id" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN company_id VARCHAR")
    if "pin_hash" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN pin_hash VARCHAR")
    if "is_active" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
