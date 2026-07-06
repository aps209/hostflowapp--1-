from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.ai_manager import router as ai_manager_router
from app.api.cost_intelligence import router as cost_intelligence_router
from app.api.entities import router as entities_router
from app.api.functions import router as functions_router
from app.api.menu import router as menu_router
from app.api.orders import router as orders_router
from app.api.users import router as users_router
from app.api.webhooks import router as webhooks_router
from app.core.config import settings
from app.db.database import Base, SessionLocal, engine
from app.models import entity, license, user  # noqa: F401
from app.services.schema import ensure_runtime_schema
from app.services.scheduler import start_scheduler
from app.services.seed import seed_initial_data


app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_runtime_schema()
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    start_scheduler()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(entities_router, prefix=settings.api_prefix)
app.include_router(functions_router, prefix=settings.api_prefix)
app.include_router(ai_manager_router, prefix=settings.api_prefix)
app.include_router(cost_intelligence_router, prefix=settings.api_prefix)
app.include_router(menu_router, prefix=settings.api_prefix)
app.include_router(orders_router, prefix=settings.api_prefix)
app.include_router(users_router, prefix=settings.api_prefix)
app.include_router(webhooks_router, prefix=settings.api_prefix)
