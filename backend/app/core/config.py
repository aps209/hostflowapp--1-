from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "HostFlow API"
    api_prefix: str = "/api"
    database_url: str = "postgresql+psycopg://hostflow:hostflow@postgres:5432/hostflow"
    jwt_secret_key: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    seed_initial_data: bool = True
    seed_admin_email: str = "admin@hostflow.local"
    seed_admin_password: str = "Hostflow123!"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
