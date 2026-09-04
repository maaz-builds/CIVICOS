"""Supabase integration (NOT connected yet).

Future role: the ONLY place in the codebase that talks to Supabase (auth,
database, storage). Services and agents call these helpers instead of using
the SDK directly, so swapping providers later stays easy.

The supabase SDK is intentionally NOT installed yet (see requirements.txt).
"""

from typing import Any


class SupabaseService:
    """Database access wrapper (implement later)."""

    async def insert_complaint(self, record: dict[str, Any]) -> dict[str, Any]:
        """Persist a new complaint and return the stored row.

        TODO(database milestone): use the supabase client once it is installed.
        """
        raise NotImplementedError(
            "SupabaseService.insert_complaint is not implemented yet."
        )

    async def list_complaints(self) -> list[dict[str, Any]]:
        """Return stored complaints.

        TODO(database milestone): used by the GET /complaints endpoint.
        """
        raise NotImplementedError(
            "SupabaseService.list_complaints is not implemented yet."
        )
