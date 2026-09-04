"""Complaint endpoints (placeholder stage).

Only the read-only placeholder below exists for now. Complaint submission,
tracking IDs, and persistence arrive in later milestones.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/complaints", tags=["complaints"])


@router.get("")
def list_complaints() -> list:
    """Placeholder: return an empty list until complaints are stored."""
    # TODO(database milestone): query complaints from Supabase and return them.
    return []
