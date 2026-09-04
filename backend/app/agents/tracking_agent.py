"""Tracking agent - tracking IDs and status updates (NOT implemented yet).

Planned responsibilities (later milestone):
    * Generate a human-friendly tracking ID for each complaint.
    * Maintain the complaint lifecycle
      (submitted -> assigned -> in progress -> resolved).

No logic yet - this is the future interface.
"""


class TrackingAgent:
    """Tracking/status agent. Interface only - implementation comes later."""

    async def create_tracking_id(self, complaint_id: str) -> str:
        """Return a short tracking ID such as "CF-2026-XXXXXX".

        TODO(tracking milestone): define format and collision-safe generation.
        """
        raise NotImplementedError(
            "TrackingAgent.create_tracking_id is not implemented yet."
        )

    async def get_status(self, tracking_id: str) -> dict:
        """Return the current status for a tracking ID.

        TODO(tracking milestone): read the latest status (from Supabase later).
        """
        raise NotImplementedError("TrackingAgent.get_status is not implemented yet.")
