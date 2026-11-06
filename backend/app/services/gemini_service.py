"""Google Gemini client used by CivicFix AI agents."""

import asyncio
import time

from google import genai
from google.genai import types

from app.config import settings


_MAX_ATTEMPTS = 4
_BACKOFF_SECONDS = [2.0, 4.0, 8.0]
_TRANSIENT_STATUS_CODES = (429, 500, 502, 503, 504)
_TRANSIENT_MESSAGE_TOKENS = ("busy", "overloaded", "capacity", "rate limit", "try again")


def _is_transient(exc: Exception) -> bool:
    status = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if status in _TRANSIENT_STATUS_CODES:
        return True
    text = str(exc).lower()
    return any(token in text for token in _TRANSIENT_MESSAGE_TOKENS)


def _call_with_retry(fn):
    last_error = None
    for attempt in range(_MAX_ATTEMPTS):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 - retry transient provider errors
            if not _is_transient(exc):
                raise
            last_error = exc
            if attempt < _MAX_ATTEMPTS - 1:
                time.sleep(_BACKOFF_SECONDS[min(attempt, len(_BACKOFF_SECONDS) - 1)])
    raise last_error


class GeminiService:
    """Wrapper around Google's Gemini API."""

    VISION_MODEL: str = settings.VISION_MODEL

    def __init__(self):
        self._client: genai.Client | None = None

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            if not settings.GEMINI_API_KEY:
                raise RuntimeError(
                    "GEMINI_API_KEY is not set. Add it to backend/.env "
                    "(or the Vercel project's environment variables) to use AI features."
                )
            self._client = genai.Client(
                api_key=settings.GEMINI_API_KEY,
                http_options=types.HttpOptions(timeout=120_000),
            )
        return self._client

    async def chat_completion(self, messages: list, model: str | None = None):
        system_instruction = "\n\n".join(
            str(message.get("content", ""))
            for message in messages
            if message.get("role") == "system"
        )
        contents = [
            {
                "role": "model" if message.get("role") == "assistant" else "user",
                "parts": [{"text": str(message.get("content", ""))}],
            }
            for message in messages
            if message.get("role") != "system"
        ]

        def _call():
            return _call_with_retry(
                lambda: self.client.models.generate_content(
                    model=model or settings.ROUTING_MODEL,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction or None,
                        temperature=0,
                    ),
                )
            )

        response = await asyncio.to_thread(_call)
        return response.text or ""

    async def analyze_image(
        self,
        image_path: str,
        prompt: str,
        content_type: str = "image/jpeg",
    ):
        with open(image_path, "rb") as image_file:
            image_data = image_file.read()

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                    types.Part.from_bytes(data=image_data, mime_type=content_type),
                ],
            )
        ]

        def _call():
            return _call_with_retry(
                lambda: self.client.models.generate_content(
                    model=self.VISION_MODEL,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction="You are CivicFix Vision Agent. Return only JSON.",
                        temperature=0,
                        response_mime_type="application/json",
                    ),
                )
            )

        response = await asyncio.to_thread(_call)
        return response.text or ""