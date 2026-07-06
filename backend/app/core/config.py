from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "HostFlow API"
    api_prefix: str = "/api"
    database_url: str = "postgresql+psycopg://hostflow:hostflow@postgres:5432/hostflow"
    jwt_secret_key: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    temp_login_token_expire_minutes: int = 5
    refresh_token_expire_days: int = 30
    license_hash_secret: str = "change-me-license-secret"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    seed_initial_data: bool = True
    seed_admin_email: str = "admin@hostflow.local"
    seed_admin_password: str = "Hostflow123!"
    seed_admin_pin: str = "1234"
    platform_admin_email: str = "admin@hostflow.local"
    google_places_api_key: str | None = None
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_phone_number: str | None = None
    public_app_url: str = "http://localhost:5173"
    whatsapp_phone_number_id: str | None = None
    whatsapp_access_token: str | None = None
    whatsapp_api_version: str = "v21.0"
    whatsapp_verify_token: str | None = None
    whatsapp_app_secret: str | None = None
    whatsapp_reminder_template: str = "reservation_reminder"
    whatsapp_reminder_template_lang: str = "es"
    reminder_timezone: str = "Europe/Madrid"
    run_scheduler: bool = True
    ai_provider: str = "gemini"
    ai_model: str = "gemini-2.5-flash"
    gemini_api_key: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
