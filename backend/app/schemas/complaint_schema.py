"""Pydantic request/response models for complaints.

Single source of truth for the complaint shape - routes, agents, and
services all use these models. `ComplaintCreate` matches the columns of the
Supabase `complaints` table (see backend/supabase/schema.sql); the database
adds `id`, `tracking_id`, `status`, and `created_at` server-side.
"""

from typing import Literal

from pydantic import BaseModel, Field

# Lifecycle of a complaint. Stored lowercase in the DB (schema default
# 'submitted'); the GHMC portal advances it and the /track page renders it.
ComplaintStatus = Literal["submitted", "assigned", "in progress", "resolved"]


class ComplaintCreate(BaseModel):
    """Body of POST /complaints - produced by the vision/complaint agents."""

    issue_type: str = Field(..., min_length=1, description="e.g. Pothole")
    description: str = Field("", description="Free-text description of the issue")
    confidence: float | None = Field(None, ge=0, le=1)
    severity: str | None = Field(None, description="Low | Medium | High | Critical")
    ward: str | None = None
    lat: float | None = Field(None, ge=-90, le=90)
    lng: float | None = Field(None, ge=-180, le=180)
    department: str | None = None
    routing_notes: str | None = None
    image_url: str | None = Field(
        None, description="Public photo URL (once Supabase Storage is wired)"
    )


class StatusUpdate(BaseModel):
    """Body of PATCH /complaints/{tracking_id}/status.

    Literal-typed, so FastAPI rejects anything outside the lifecycle with a
    clean 422 before it reaches the database.
    """

    status: ComplaintStatus = Field(
        ...,
        description="submitted | assigned | in progress | resolved",
    )
