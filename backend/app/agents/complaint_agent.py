"""Complaint agent - assembles a validated complaint record.

Deterministic glue: merges the vision + location + routing agent outputs
into the ComplaintCreate shape (the single source of truth in
app/schemas/complaint_schema.py) and validates it before save.

Deliberately NO AI here: building the record is joining known fields, and
the save path must work even when every model is down. The "AI" of this
pipeline lives upstream (vision) and in the routing decision.
"""

from app.schemas.complaint_schema import ComplaintCreate


class ComplaintAgent:
    """Complaint builder: merge + validate agent outputs into a record."""

    async def build_complaint(self, raw_input: dict) -> dict:
        """Return a validated, ready-to-save complaint dict.

        ``raw_input`` carries the upstream agent outputs, e.g.
        {"vision": {...}, "location": {...}, "routing": {...}}.
        Unknown keys are dropped; missing optional fields become None.
        """
        vision = raw_input.get("vision") or {}
        location = raw_input.get("location") or {}
        routing = raw_input.get("routing") or {}

        complaint = ComplaintCreate(
            issue_type=vision.get("issue_type") or "",
            description=vision.get("description") or "",
            confidence=vision.get("confidence"),
            severity=vision.get("severity"),
            ward=location.get("ward") or location.get("area_name"),
            lat=location.get("lat"),
            lng=location.get("lng"),
            department=routing.get("department"),
            routing_notes=routing.get("notes"),
        )
        return complaint.model_dump()