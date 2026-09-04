import json
import re

from app.services.featherless_service import FeatherlessService


def _extract_json(text: str) -> dict:
    """Parse the model's reply, tolerating markdown fences and stray text.

    The vision model is instructed to return only JSON, but models
    occasionally wrap it in ```json fences or add a trailing word. Without
    this, every such reply turned into a 502 for the user.
    """
    cleaned = text.strip()
    # Strip ```json ... ``` fences if present.
    fenced = re.search(r"```(?:json)?\s*(.*?)\s*```", cleaned, re.DOTALL)
    if fenced:
        cleaned = fenced.group(1)
    else:
        # Fall back to the first {...} block in the reply.
        first_brace = cleaned.find("{")
        last_brace = cleaned.rfind("}")
        if first_brace != -1 and last_brace > first_brace:
            cleaned = cleaned[first_brace : last_brace + 1]
    return json.loads(cleaned)


class VisionAgent:
    def __init__(self):
        self.ai = FeatherlessService()

    async def analyze(self, image_path: str, content_type: str = "image/jpeg"):
        prompt = """
You are the Vision Agent for CivicFix.

Analyze the uploaded image and identify ONLY one civic issue.

Possible classes:
- Pothole
- Garbage
- Broken Streetlight
- Water Leakage
- Open Manhole
- Fallen Tree
- Other

Return ONLY valid JSON in this exact format:

{
  "issue_type": "",
  "confidence": 0.0,
  "severity": "",
  "description": ""
}

- confidence must be a number between 0.0 and 1.0.
- Severity must be one of: Low, Medium, High, Critical.
"""

        result = await self.ai.analyze_image(image_path, prompt, content_type)

        return _extract_json(result)