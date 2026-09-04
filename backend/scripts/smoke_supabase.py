"""Live Supabase smoke test.

Inserts a sample complaint through SupabaseService, reads it back to verify
the round-trip, then deletes the test row.

Prereqs (run from the backend/ directory):
  1. backend/.env exists with SUPABASE_URL + SUPABASE_ANON_KEY
     (copy .env.example, then paste your dashboard values).
  2. backend/supabase/schema.sql has been run once in the SQL editor
     (creates the `complaints` table + anon insert/select policies).

Usage:  .venv/Scripts/python scripts/smoke_supabase.py
"""

import asyncio
import sys
from pathlib import Path

# Allow running as a plain script:  python scripts/smoke_supabase.py
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.agents.tracking_agent import TrackingAgent
from app.config import settings
from app.services.supabase_service import SupabaseService


async def main() -> int:
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        print(
            "Missing credentials: create backend/.env with SUPABASE_URL and\n"
            "SUPABASE_ANON_KEY (copy backend/.env.example first)."
        )
        return 1

    svc = SupabaseService()
    tracking_id = await TrackingAgent().create_tracking_id(complaint_id="smoke-test")

    sample = {
        "tracking_id": tracking_id,
        "issue_type": "Pothole",
        "confidence": 0.97,
        "severity": "High",
        "description": "Smoke-test row - safe to delete.",
        "ward": "Madhapur",
        "department": "Roads & Infrastructure",
        "status": "submitted",
    }

    try:
        inserted = await svc.insert_complaint(sample)
        print(f"INSERT ok       -> id={inserted['id']} tracking={inserted['tracking_id']}")

        rows = await svc.list_complaints(limit=10)
        found = next((r for r in rows if r["tracking_id"] == tracking_id), None)
        if not found:
            print("READ failed     -> row not found in latest 10 complaints")
            return 1
        print(
            f"READ ok         -> {found['issue_type']} / {found['severity']} / "
            f"{found['status']} / {found['created_at']}"
        )
        print("ROUND-TRIP PASS")
    except Exception as exc:  # noqa: BLE001 - surface the real failure
        print(f"FAILED          -> {type(exc).__name__}: {exc}")
        print(
            "\nIf the table is missing: run backend/supabase/schema.sql in the "
            "Supabase SQL editor.\nIf RLS blocks writes: check the anon policies "
            "at the end of that file."
        )
        return 1
    finally:
        # Cleanup: delete the test row so the table stays pristine.
        # Note: the anon key has no DELETE policy (RLS allows insert/select
        # only), so this typically can't remove the row - that's expected.
        try:
            deleted = (
                svc.client.table(svc.TABLE)
                .delete()
                .eq("tracking_id", tracking_id)
                .execute()
            )
            if deleted.data:
                print(f"CLEANUP ok      -> removed test row {tracking_id}")
            else:
                print(
                    f"CLEANUP note    -> row {tracking_id} left in place (anon key has "
                    "no DELETE policy). Remove it from the dashboard if you want:"
                )
                print(
                    "    delete from public.complaints "
                    f"where tracking_id = '{tracking_id}';"
                )
        except Exception as exc:  # noqa: BLE001
            print(f"CLEANUP skipped -> {type(exc).__name__}: {exc}")

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
