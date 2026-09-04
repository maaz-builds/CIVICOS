"""Location agent - figures out where an issue is (NOT implemented yet).

Planned responsibilities (later milestone):
    * Extract location hints from the complaint description or photo.
    * Resolve them to coordinates (latitude / longitude).
    * Map coordinates to a Hyderabad ward / circle for routing.

No logic yet - this is the future interface.
"""

from typing import Any


class LocationAgent:
    """Location-extraction agent. Interface only - implementation comes later."""

    async def extract_location(
        self,
        description: str,
        photo_urls: list[str] | None = None,
    ) -> dict[str, Any]:
        """Return location info, e.g. {"lat": .., "lng": .., "ward": ..}.

        TODO(location milestone): geocoding via a map API; nothing decided yet.
        """
        raise NotImplementedError(
            "LocationAgent.extract_location is not implemented yet."
        )
