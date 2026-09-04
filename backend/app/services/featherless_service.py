"""Featherless AI client (OpenAI-compatible API).

The OpenAI client is created lazily on first use so the app boots fine
without FEATHERLESS_API_KEY set (health checks etc. keep working). Calls
that need AI raise a clear error naming the missing setting.
"""

import base64

from openai import OpenAI

from app.config import settings


class FeatherlessService:
    """Wrapper around Featherless AI (OpenAI-compatible)."""

    VISION_MODEL = "Qwen/Qwen2.5-VL-72B-Instruct"

    def __init__(self):
        self._client: OpenAI | None = None

    @property
    def client(self) -> OpenAI:
        """Build (once) and return the OpenAI client."""
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
            )
        return self._client

    async def chat_completion(
        self,
        messages: list,
        model: str = "Qwen/Qwen2.5-VL-72B-Instruct",
    ):
        response = self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0,
        )

        return response.choices[0].message.content

    async def analyze_image(self, image_path: str, prompt: str):
        with open(image_path, "rb") as img:
            image_b64 = base64.b64encode(img.read()).decode()

        response = self.client.chat.completions.create(
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
                                "url": f"data:image/jpeg;base64,{image_b64}"
                            },
                        },
                    ],
                },
            ],
        )

        return response.choices[0].message.content
    # --- EXPORT BRIDGE FOR AGENTS ---
featherless_service = FeatherlessService()
ai_client = featherless_service.client