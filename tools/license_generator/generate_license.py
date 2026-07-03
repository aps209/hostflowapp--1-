import argparse
import os
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.strip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_env_file(ROOT / ".env")
load_env_file(BACKEND / ".env")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://hostflow:hostflow@localhost:5432/hostflow",
)

from app.db.database import Base, SessionLocal, engine  # noqa: E402
from app.models.license import Company, License  # noqa: F401,E402
from app.models.user import User  # noqa: F401,E402
from app.services.licenses import create_license  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Genera licencias HostFlow y guarda solo hashes.")
    parser.add_argument("--plan", required=True, choices=["STANDARD", "PREMIUM", "ULTRA"])
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument("--expires-at", help="YYYY-MM-DD")
    parser.add_argument("--output", help="Archivo opcional para guardar licencias en claro. Contiene secretos.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    expires_at = datetime.fromisoformat(args.expires_at) if args.expires_at else None
    Base.metadata.create_all(bind=engine)

    plain_keys = []
    db = SessionLocal()
    try:
        for _ in range(args.count):
            _license, plain_key = create_license(db, args.plan, expires_at)
            plain_keys.append(plain_key)
        db.commit()
    finally:
        db.close()

    print("Licencias generadas. Copialas ahora; la base de datos solo guarda hashes.")
    for key in plain_keys:
        print(key)

    if args.output:
        Path(args.output).write_text("\n".join(plain_keys) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
