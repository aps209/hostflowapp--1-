import json
import time
import urllib.error
import urllib.request
from typing import Any

from app.core.config import settings
from app.services.ai.providers.base import AIConfigurationError, AIProvider


class GeminiProvider(AIProvider):
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key or settings.gemini_api_key
        self.model = model or settings.ai_model

    def generate_json(self, system_prompt: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._generate(
            system_prompt,
            [{"text": json.dumps(payload, ensure_ascii=False)}],
        )

    def generate_json_with_image(
        self,
        system_prompt: str,
        user_text: str,
        image_base64: str,
        mime_type: str = "image/jpeg",
    ) -> dict[str, Any]:
        return self.generate_json_with_images(
            system_prompt, user_text, [{"data": image_base64, "mime": mime_type}]
        )

    def generate_json_with_images(
        self,
        system_prompt: str,
        user_text: str,
        images: list[dict[str, str]],
    ) -> dict[str, Any]:
        parts: list[dict[str, Any]] = [{"text": user_text}]
        for image in images:
            parts.append({
                "inlineData": {
                    "mimeType": image.get("mime") or "image/jpeg",
                    "data": image["data"],
                }
            })
        return self._generate(system_prompt, parts)

    def _generate(self, system_prompt: str, parts: list[dict[str, Any]]) -> dict[str, Any]:
        if not self.api_key:
            raise AIConfigurationError(
                "Falta configurar GEMINI_API_KEY en el backend. Anade la clave en .env y reinicia el servicio."
            )

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )
        body = {
            "systemInstruction": {
                "parts": [{"text": system_prompt}],
            },
            "contents": [
                {
                    "role": "user",
                    "parts": parts,
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        }
        request = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        data = None
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    data = json.loads(response.read().decode("utf-8"))
                break
            except urllib.error.HTTPError as error:
                details = error.read().decode("utf-8", errors="replace")
                if error.code == 429:
                    # Cuota agotada: no reintentar (cada intento consume mas cuota).
                    raise AIConfigurationError(
                        "Has alcanzado el limite de peticiones de Gemini (429). "
                        "Espera un momento o revisa tu plan y cuota en Google AI Studio."
                    ) from error
                if error.code == 404:
                    raise AIConfigurationError(
                        f"El modelo de IA '{self.model}' no existe o no admite generateContent. "
                        "Revisa AI_MODEL en el backend (por ejemplo gemini-3.5-flash o gemini-2.5-flash)."
                    ) from error
                last_error = AIConfigurationError(f"Gemini devolvio {error.code}: {details}")
                if error.code not in {500, 502, 503, 504} or attempt == 2:
                    raise last_error from error
                time.sleep(1 + attempt)
            except urllib.error.URLError as error:
                last_error = AIConfigurationError(f"No se pudo conectar con Gemini: {error.reason}")
                if attempt == 2:
                    raise last_error from error
                time.sleep(1 + attempt)

        if data is None:
            raise last_error or AIConfigurationError("Gemini no devolvio respuesta")

        text = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )
        if not text:
            return {}

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"answer": text}
