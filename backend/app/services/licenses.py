import hashlib
import hmac
import secrets
import string
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.license import License


VALID_PLANS = {"STANDARD", "PREMIUM", "ULTRA"}


def hash_license_key(license_key: str) -> str:
    normalized = license_key.strip().upper()
    return hmac.new(
        settings.license_hash_secret.encode("utf-8"),
        normalized.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def find_license(db: Session, license_key: str) -> License | None:
    return db.query(License).filter(License.license_key_hash == hash_license_key(license_key)).first()


def generate_license_key(plan: str) -> str:
    alphabet = string.ascii_uppercase + string.digits
    chunks = ["".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(3)]
    return f"RESTO-{plan.upper()}-{'-'.join(chunks)}"


def create_license(db: Session, plan: str, expires_at: datetime | None = None) -> tuple[License, str]:
    normalized_plan = plan.upper()
    if normalized_plan not in VALID_PLANS:
        raise ValueError(f"Plan no valido: {plan}")

    for _ in range(10):
        license_key = generate_license_key(normalized_plan)
        license_hash = hash_license_key(license_key)
        if not db.query(License).filter(License.license_key_hash == license_hash).first():
            license_record = License(
                license_key_hash=license_hash,
                plan=normalized_plan,
                status="UNUSED",
                expires_at=expires_at,
            )
            db.add(license_record)
            return license_record, license_key
    raise RuntimeError("No se pudo generar una licencia unica")


def license_is_usable(license_record: License) -> bool:
    if license_record.status != "UNUSED":
        return False
    if license_record.expires_at and license_record.expires_at < datetime.now(timezone.utc):
        return False
    return True
