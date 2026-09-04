"""Featherless AI client (OpenAI-compatible API).

The OpenAI client is created lazily on first use so the app boots fine
without FEATHERLESS_API_KEY set (health checks etc. keep working). Calls
that need AI raise a clear error naming the missing setting.
"""

import asyncio
import base64
import time

from openai import APIConnectionError, APIStatusError, OpenAI

from app.config import settings


# Featherless' shared GPUs frequently answer with transient congestion
# errors - "model is busy" (400), "temporarily at capacity" (503,
# capacity_exhausted), "overloaded", rate limits, and network blips.
# Retry those a few times with backoff before giving up.
_MAX_ATTEMPTS = 4
_BACKOFF_SECONDS = [2.0, 4.0, 8.0]

# HTTP statuses that mean "try again later", not "your request is wrong".
_TRANSIENT_STATUS_CODES = (429, 502, 503, 504)
_TRANSIENT_MESSAGE_TOKENS = ("busy", "overloaded", "capacity", "rate limit", "try again")


def _is_transient(exc: Exception) -> bool:
    """True for errors that are worth a retry (congestion / blips).

    Decides by exception type and HTTP status first, then falls back to
    scanning the message, because providers word the same failure
    differently over time ("busy", "capacity exhausted", "overloaded").
    """
    if isinstance(exc, APIConnectionError):
        return True  # timeout or network blip
    if isinstance(exc, APIStatusError) and exc.status_code in _TRANSIENT_STATUS_CODES:
        return True
    text = str(exc).lower()
    return any(token in text for token in _TRANSIENT_MESSAGE_TOKENS)


def _call_with_retry(fn):
    """Run fn, retrying while the model reports transient congestion."""
    last_error = None
    for attempt in range(_MAX_ATTEMPTS):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 - decide via _is_transient
            if not _is_transient(exc):
                raise
            last_error = exc
            if attempt < _MAX_ATTEMPTS - 1:
                time.sleep(_BACKOFF_SECONDS[min(attempt, len(_BACKOFF_SECONDS) - 1)])
    raise last_error


class FeatherlessService:
    """Wrapper around Featherless AI (OpenAI-compatible)."""

    VISION_MODEL: str = settings.VISION_MODEL

    def __init__(self):
        self._client: OpenAI | None = None

    @property
    def client(self) -> OpenAI:
        """Build (once) and return the OpenAI client.

        The timeout keeps a hung model call from stalling the request for
        the SDK's default 10 minutes - it fails cleanly after 2.
        """
        if self._client is None:
            if not settings.FEATHERLESS_API_KEY:
                raise RuntimeError(
                    "FEATHERLESS_API_KEY is not set. Add it to backend/.env "
                    "(or the Vercel project's environment variables) to use "
                    "AI features."
                )
            self._client = OpenAI(
                api_key=settings.FEATHERLESS_API_KEY,
                base_url="https://api.featherless.ai/v1",
                timeout=120.0,
            )
        return self._client

    async def chat_completion(
        self,
        messages: list,
        model: str = "Qwen/Qwen2.5-VL-72B-Instruct",
    ):
        def _call():
            return _call_with_retry(
                lambda: self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0,
                )
            )

        response = await asyncio.to_thread(_call)
        return response.choices[0].message.content

    async def analyze_image(
        self,
        image_path: str,
        prompt: str,
        content_type: str = "image/jpeg",
    ):
        """Send an image to the vision model and return the raw response.

        The OpenAI SDK is synchronous, so the blocking call runs in a
        worker thread - it must not block FastAPI's event loop.
        """
        with open(image_path, "rb") as img:
            image_b64 = base64.b64encode(img.read()).decode()

        def _call():
            return _call_with_retry(
                lambda: self.client.chat.completions.create(
                    model=self.VISION_MODEL,
                    temperature=0,
                    response_format={"type": "json_object"},
                    messages=[
                        {
                            "role": "system",
                            "content": "You are CivicFix Vision Agent. Return only JSON."
                        },
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:{content_type};base64,{image_b64}"
                                    },
                                },
                            ],
                        },
                    ],
                )
            )

        response = await asyncio.to_thread(_call)
        return response.choices[0].message.content