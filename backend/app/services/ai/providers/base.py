from abc import ABC, abstractmethod
from typing import Any


class AIConfigurationError(RuntimeError):
    pass


class AIProvider(ABC):
    @abstractmethod
    def generate_json(self, system_prompt: str, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    def generate_json_with_image(
        self,
        system_prompt: str,
        user_text: str,
        image_base64: str,
        mime_type: str = "image/jpeg",
    ) -> dict[str, Any]:
        raise AIConfigurationError("El proveedor de IA configurado no soporta imagenes.")
