import json
from app.services.featherless_service import FeatherlessService


class VisionAgent:
    def __init__(self):
        self.ai = FeatherlessService()

    async def analyze(self, image_path: str):
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

Return ONLY valid JSON in this format:

{
  "issue_type": "",
  "confidence": 0,
  "severity": "",
  "description": ""
}

Severity must be one of:
Low, Medium, High, Critical
"""

        result = await self.ai.analyze_image(image_path, prompt)

        return json.loads(result)
