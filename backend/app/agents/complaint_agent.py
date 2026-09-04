"""Complaint agent - assembles a validated complaint record (NOT implemented yet).

Planned responsibilities (later milestone):
    * Merge the outputs of the vision + location + routing agents into one
      complaint record.
    * Validate required fields before the record is saved.
    * Keep the record shape stable (see app/schemas/complaint_schema.py).

No logic yet - this is the future interface.
"""


class ComplaintAgent:
    """Complaint builder. Interface only - implementation comes later."""

    async def build_complaint(self, raw_input: dict) -> dict:
        """Return a validated, ready-to-save complaint dict.

        TODO(complaint milestone): combine agent outputs, validate, and return.
        """
        raise NotImplementedError(
            "ComplaintAgent.build_complaint is not implemented yet."
        )
