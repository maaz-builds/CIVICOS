"""Complaint agent - assembles a validated complaint record.

Merges the outputs of the vision, location, and routing agents into one
record shaped like ``ComplaintCreate`` (the single source of truth for what
a complaint row contains - see app/schemas/complaint_schema.py).

This is a deterministic merge + validation step, not an AI call: the
intelligence happened upstream (vision understands the photo, location
geocodes it, routing picks the department). Here we only make sure the
final record is well-formed before it is saved.
"""

from typing import Any

from pydantic import ValidationError

from app.schemas.complaint_schema import ComplaintCreate


class ComplaintAgent:
    """Complaint builder: merge + validate agent outputs into one record."""

    async def build_complaint(self, raw_input: dict) -> dict:
        """Return a validated, ready-to-save complaint dict.

        ``raw_input`` is the collected output of the upstream agents::

            {
                "vision":   {"issue_type", "confidence", "severity", "description"},
                "location": {"ward", "lat", "lng"},
                "routing":  {"department", "notes", "priority"},
            }

        Optional fields that are missing default to None; ``issue_type`` is
        required. Raises ``ValueError`` with a readable message when the
        record cannot be validated, so callers can surface it as a clean
        HTTP error instead of a traceback.
        """
        vision = raw_input.get("vision") or {}
        location = raw_input.get("location") or {}
        routing = raw_input.get("routing") or {}

        issue_type = (vision.get("issue_type") or "").strip()
        if not issue_type:
            raise ValueError(
                "Complaint is missing a required field: issue_type (the "
                "vision agent did not identify the issue)."
            )

        try:
            # Pydantic enforces the field constraints (confidence 0..1,
            # lat/lng ranges, non-empty issue_type) at construction time.
            payload = ComplaintCreate(
                issue_type=issue_type,
                description=vision.get("description") or "",
                confidence=vision.get("confidence"),
                severity=vision.get("severity"),
                ward=location.get("ward"),
                lat=location.get("lat"),
                lng=location.get("lng"),
                department=routing.get("department"),
                # The RoutingAgent emits the action note under "notes";
                # accept "routing_notes" too for callers that use the DB
                # column name. Either way it lands in routing_notes below.
                routing_notes=routing.get("notes") or routing.get("routing_notes"),
            )
        except ValidationError as exc:
            # Rewrite the first Pydantic error into a short, human-readable
            # message: "Invalid complaint field 'confidence': ...".
            errors = exc.errors()
            first = errors[0] if errors else {}
            field = ".".join(str(part) for part in first.get("loc", ())) or "?"
            message = first.get("msg", "invalid value")
            raise ValueError(
                f"Invalid complaint field '{field}': {message}"
            ) from exc

        # model_dump() returns a plain dict that matches the complaints
        # table columns, so the tracking node / Supabase insert can consume
        # it unchanged. image_url is intentionally absent here - the caller
        # (route/workflow) attaches it after the photo is uploaded.
        return payload.model_dump()