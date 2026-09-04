"""Supabase integration - complaint persistence.

The client is created lazily so the app boots without credentials; database
calls raise a clear error until SUPABASE_URL and SUPABASE_ANON_KEY are set
in backend/.env (or as Vercel environment variables).

Setup once per Supabase project:
  1. Run backend/supabase/schema.sql in the Supabase SQL editor.
  2. Copy SUPABASE_URL + SUPABASE_ANON_KEY from Project Settings -> API.
"""

import math
from typing import Any

from supabase import Client, create_client

from app.config import settings

# A report is treated as a duplicate when the SAME issue type is still open
# within this radius of its GPS position - re-reporting a live problem just
# fragments the record, so the caller points the citizen at the existing one.
DUPLICATE_RADIUS_M = 50.0

# Lifecycle statuses that count as "open". A resolved complaint is NOT a
# duplicate: the issue was fixed, so a fresh report is legitimate.
UNRESOLVED_STATUSES = ("submitted", "assigned", "in progress")

# The proximity scan runs in Python (see find_duplicate_complaint) rather
# than PostGIS, so cap how many rows per issue type we pull back - ample
# for the demo dataset.
_DUPLICATE_SCAN_LIMIT = 500


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two coordinates, in metres."""
    radius = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


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

    async def get_complaint_by_tracking_id(
        self,
        tracking_id: str,
    ) -> dict[str, Any] | None:
        """Return one complaint by its CF- tracking ID, or None if absent."""
        response = (
            self.client.table(self.TABLE)
            .select("*")
            .eq("tracking_id", tracking_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        return rows[0] if rows else None

    async def update_complaint_status(
        self,
        tracking_id: str,
        status: str,
    ) -> dict[str, Any] | None:
        """Set the lifecycle status of a complaint by its CF- tracking ID.

        Returns the updated row, or None when no complaint has that
        tracking ID (an RLS misconfiguration also surfaces as an empty
        update, so the caller's 404 hint mentions the schema policy).
        """
        response = (
            self.client.table(self.TABLE)
            .update({"status": status})
            .eq("tracking_id", tracking_id)
            .execute()
        )
        rows = response.data or []
        return rows[0] if rows else None

    async def find_duplicate_complaint(
        self,
        issue_type: str,
        lat: float | None,
        lng: float | None,
    ) -> dict[str, Any] | None:
        """Return the most recent OPEN complaint of the same type within 50 m.

        Called before a new complaint is inserted: when the same issue_type
        already has an unresolved complaint within DUPLICATE_RADIUS_M, the
        caller refuses to create a second record and returns the existing
        tracking ID instead. Matching rules:

        * issue type is compared case-insensitively (the vision agent's
          categories are stable, e.g. "Pothole");
        * complaints without coordinates can never match - their distance
          to the new report is unknown;
        * resolved complaints are skipped - the issue was already fixed.

        Returns the newest matching row, or None when no duplicate exists.
        """
        # Without a GPS fix for the new report, proximity cannot be judged -
        # skip the check entirely rather than risk a false positive.
        if not issue_type or lat is None or lng is None:
            return None
        response = (
            self.client.table(self.TABLE)
            .select("*")
            .ilike("issue_type", issue_type.strip())
            .in_("status", list(UNRESOLVED_STATUSES))
            .order("created_at", desc=True)
            .limit(_DUPLICATE_SCAN_LIMIT)
            .execute()
        )
        # Newest first: when several open reports of this type exist, match
        # the most recent one within radius - the one a citizen most likely
        # re-ran into.
        for row in response.data or []:
            row_lat, row_lng = row.get("lat"), row.get("lng")
            if row_lat is None or row_lng is None:
                continue
            if (
                _haversine_m(lat, lng, float(row_lat), float(row_lng))
                <= DUPLICATE_RADIUS_M
            ):
                return row
        return None
