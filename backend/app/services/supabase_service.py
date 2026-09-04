"""Supabase integration - complaint persistence.

The client is created lazily so the app boots without credentials; database
calls raise a clear error until SUPABASE_URL and SUPABASE_ANON_KEY are set
in backend/.env (or as Vercel environment variables).

Setup once per Supabase project:
  1. Run backend/supabase/schema.sql in the Supabase SQL editor.
  2. Copy SUPABASE_URL + SUPABASE_ANON_KEY from Project Settings -> API.
"""

from typing import Any

from supabase import Client, create_client

from app.config import settings


class SupabaseService:
    """Database access wrapper around the `complaints` table."""

    TABLE = "complaints"

    def __init__(self):
        self._client: Client | None = None

    @property
    def client(self) -> Client:
        """Build (once) and return the Supabase client."""
        if self._client is None:
            if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
                raise RuntimeError(
                    "SUPABASE_URL and SUPABASE_ANON_KEY are not set. Add them "
                    "to backend/.env (or the Vercel project's environment "
                    "variables) and run backend/supabase/schema.sql in the "
                    "Supabase SQL editor first."
                )
            self._client = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_ANON_KEY,
            )
        return self._client

    async def insert_complaint(self, record: dict[str, Any]) -> dict[str, Any]:
        """Persist a new complaint and return the stored row.

        ``record`` should already contain tracking_id, issue_type, etc. -
        the complaint/tracking agents produce it.
        """
        response = self.client.table(self.TABLE).insert(record).execute()
        rows = response.data or []
        if not rows:
            raise RuntimeError(
                "Insert returned no rows - is the 'complaints' table created? "
                "Run backend/supabase/schema.sql in the SQL editor."
            )
        return rows[0]

    async def list_complaints(self, limit: int = 100) -> list[dict[str, Any]]:
        """Return the most recent complaints, newest first."""
        response = (
            self.client.table(self.TABLE)
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return list(response.data or [])
