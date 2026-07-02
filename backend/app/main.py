from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.entities import router as entities_router
from app.api.functions import router as functions_router
from app.core.config import settings
from app.db.database import Base, SessionLocal, engine
from app.models import entity, user  # noqa: F401
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
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(entities_router, prefix=settings.api_prefix)
app.include_router(functions_router, prefix=settings.api_prefix)
