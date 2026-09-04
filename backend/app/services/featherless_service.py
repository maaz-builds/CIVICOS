from openai import OpenAI
from app.config import settings
import base64

class FeatherlessService:
    """Wrapper around Featherless AI (OpenAI-compatible)."""

    def __init__(self):
        self.client = OpenAI(
            api_key=settings.FEATHERLESS_API_KEY,
            base_url="https://api.featherless.ai/v1",
        )

        self.vision_model = "Qwen/Qwen2.5-VL-72B-Instruct"

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
            model=self.vision_model,
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