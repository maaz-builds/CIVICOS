"""Tracking agent - tracking IDs and status updates.

Tracking-ID generation is implemented; the complaint lifecycle (status
lookups) is still pending because it needs a persisted complaint store
(in-memory or Supabase), which arrives in a later milestone.
"""

import secrets
from datetime import datetime

# Unambiguous alphabet - no 0/O/1/I/L, so IDs are easy to read out loud
# and type from a printed slip.
_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_SUFFIX_LEN = 6

# Every ID handed out in this process. Collisions are astronomically
# unlikely with a 6-char random suffix (32^6 ~ 1 billion), but the registry
# makes it a guarantee rather than a probability.
_issued: set[str] = set()


def _generate_tracking_id() -> str:
    """Build a fresh, never-before-issued ID like CF-2026-XK7M2Q."""
    year = datetime.now().year
    while True:
        suffix = "".join(
            secrets.choice(_ALPHABET) for _ in range(_SUFFIX_LEN)
        )
        tracking_id = f"CF-{year}-{suffix}"
        if tracking_id not in _issued:
            _issued.add(tracking_id)
            return tracking_id


class TrackingAgent:
    """Tracking/status agent."""

    async def create_tracking_id(self, complaint_id: str) -> str:
        """Return a collision-safe tracking ID such as \"CF-2026-XK7M2Q\".

        ``complaint_id`` is reserved for linking the ID to a stored
        complaint once persistence lands; the ID itself is unique whether
        or not the complaint has been saved yet.
        """
        return _generate_tracking_id()

    async def get_status(self, tracking_id: str) -> dict:
        """Return the current status for a tracking ID.

        TODO(tracking milestone): read the latest status. Needs a persisted
        complaint store first (in-memory or Supabase).
        """
        raise NotImplementedError(
            "TrackingAgent.get_status is not implemented yet - it needs the "
            "complaint store (next milestone)."
        )
