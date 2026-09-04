"""Vision agent - analyzes complaint photos (NOT implemented yet).

Planned responsibilities (later milestone):
    * Accept photos attached to a complaint.
    * Classify the issue (pothole, garbage pile, broken street light, ...).
    * Estimate severity to help prioritize the complaint.
    * Read useful details from the photo (signs, landmarks, ...).

This file intentionally contains NO AI logic. It exists so the module can
grow independently and be imported by the workflow later.
"""

from typing import Any


class VisionAgent:
    """Photo-analysis agent. Interface only - implementation comes later."""

    async def analyze_photos(self, photo_urls: list[str]) -> dict[str, Any]:
        """Return structured analysis (category, severity, details) for photos.

        TODO(AI milestone): call the Featherless vision model through
        app/services/featherless_service.py and map its output to a clean dict.
        """
        raise NotImplementedError(
            "VisionAgent.analyze_photos is not implemented yet "
            "(planned for the Featherless AI milestone)."
        )
