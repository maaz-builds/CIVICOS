"""Routing agent - sends each complaint to the right department (NOT implemented yet).

Planned responsibilities (later milestone):
    * Map an issue category to the responsible civic body
      (e.g. GHMC roads division, streetlights, water & sewerage, ...).
    * Optionally draft a short message the department can act on.

No logic yet - this is the future interface.
"""

from typing import Any


class RoutingAgent:
    """Department-routing agent. Interface only - implementation comes later."""

    async def route_to_department(
        self,
        category: str,
        ward: str | None = None,
    ) -> dict[str, Any]:
        """Return routing info, e.g. {"department": "GHMC Roads", "notes": "..."}.

        TODO(routing milestone): build the category -> department rules table.
        """
        raise NotImplementedError(
            "RoutingAgent.route_to_department is not implemented yet."
        )
