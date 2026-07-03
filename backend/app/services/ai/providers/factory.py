from app.core.config import settings
from app.services.ai.providers.base import AIConfigurationError, AIProvider
from app.services.ai.providers.gemini import GeminiProvider


def get_ai_provider() -> AIProvider:
    provider = settings.ai_provider.lower().strip()
    if provider == "gemini":
        return GeminiProvider()
    raise AIConfigurationError(
        f"Proveedor IA no soportado: {settings.ai_provider}. Usa AI_PROVIDER=gemini o anade un proveedor nuevo."
    )
