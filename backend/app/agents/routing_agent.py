"""Routing agent - sends each complaint to the right GHMC department.

Primary path uses a Featherless chat model (ROUTING_MODEL, default
Qwen/Qwen2.5-7B-Instruct) to map the vision category + ward to a GHMC
department, a priority, and a short actionable note. Routing must never
fail, so when no API key is set - or the model is busy, gated, or returns
garbage - a deterministic keyword-rules table takes over.

The Featherless call is synchronous, so it runs in a worker thread
(asyncio.to_thread) - it must not block FastAPI's event loop.
"""

import asyncio
import json
import re
from typing import Any, Dict

from app.config import settings
from app.services.featherless_service import FeatherlessService

# Deterministic fallback: keyword pattern -> (department, action note).
# Used when the model is unavailable so routing always returns a useful
# answer. Ordered most-specific first.
_ROUTING_RULES: list[tuple[re.Pattern, str, str]] = [
    (
        re.compile(r"pothole|damaged road|road (damage|repair|crack)|broken pavement", re.I),
        "GHMC Roads & Infrastructure",
        "Inspect the stretch and schedule a patch/repair.",
    ),
    (
        re.compile(r"street ?light|lighting|lamppost|street lamp", re.I),
        "GHMC Street Lighting",
        "Check the pole and circuit, then restore lighting.",
    ),
    (
        re.compile(r"garbage|trash|waste|dumping|litter|debris", re.I),
        "GHMC Solid Waste Management",
        "Clear the dumped waste and schedule a pickup.",
    ),
    (
        re.compile(r"sewage|sewer|drain(age)?|manhole|water ?logg|flood", re.I),
        "HMWSSB Water & Sewerage",
        "Clear the blockage and inspect the sewer line.",
    ),
    (
        re.compile(r"water (leak|pipe|supply)|leakage|burst pipe", re.I),
        "HMWSSB Water & Sewerage",
        "Repair the leak and restore the water supply.",
    ),
    (
        re.compile(r"tree|horticulture|garden|park", re.I),
        "GHMC Parks & Horticulture",
        "Inspect the planting/horticulture and take action.",
    ),
    (
        re.compile(r"stray|animal|cattle|dog", re.I),
        "GHMC Veterinary & Animal Care",
        "Dispatch the animal care team to the area.",
    ),
    (
        re.compile(r"construction|encroach|illegal (build|structure)|unauthorised", re.I),
        "GHMC Town Planning",
        "Verify site approvals and survey the location.",
    ),
    (
        re.compile(r"rat|roden|pest|mosquito|vector", re.I),
        "GHMC Public Health",
        "Schedule pest/vector control for the ward.",
    ),
]
_DEFAULT_DEPARTMENT = "GHMC Customer Care"
_DEFAULT_NOTE = "Forwarded for triage to the responsible department."

_PRIORITY_BY_SEVERITY = {
    "critical": "P1",
    "high": "P2",
    "medium": "P3",
    "low": "P4",
}


class RoutingAgent:
    """Department-routing agent: decides which civic body handles an issue."""

    def __init__(self):
        self.ai = FeatherlessService()

    def _rule_route(self, category: str, description: str) -> tuple[str, str]:
        """Keyword fallback. Returns (department, note)."""
        text = f"{category} {description or ''}"
        for pattern, department, note in _ROUTING_RULES:
            if pattern.search(text):
                return department, note
        return _DEFAULT_DEPARTMENT, _DEFAULT_NOTE

    async def _ai_route(
        self,
        category: str,
        ward: str | None,
        severity: str | None,
        description: str,
    ) -> dict[str, Any] | None:
        """Ask a Featherless model for the department mapping. None on failure."""
        if not settings.FEATHERLESS_API_KEY:
            return None

        system_prompt = (
            "You are the GHMC routing engine for Hyderabad. Given an issue "
            "category detected from a photo, decide which civic department "
            "must handle it. Use official Hyderabad bodies: GHMC Roads & "
            "Infrastructure, GHMC Street Lighting, GHMC Solid Waste "
            "Management, GHMC Parks & Horticulture, GHMC Veterinary & Animal "
            "Care, GHMC Town Planning, GHMC Public Health, HMWSSB Water & "
            "Sewerage, or GHMC Customer Care as a last resort. "
            "Return ONLY a raw JSON object with keys: "
            '"department" (string), "priority" (one of P1, P2, P3, P4), '
            '"notes" (one short sentence with the action for the department).'
        )
        user_prompt = json.dumps(
            {
                "issue_category": category,
                "ward": ward,
                "severity": severity,
                "photo_description": description,
            }
        )

        try:
            raw = await self.ai.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                model=settings.ROUTING_MODEL or None,
            )
            cleaned = (raw or "").replace("```json", "").replace("```", "").strip()
            data = json.loads(cleaned)
            if not data.get("department"):
                return None
            return data
        except Exception as exc:  # noqa: BLE001 - best-effort by design
            print(f"Routing AI call failed, using rules: {exc}")
            return None

    async def route_to_department(
        self,
        category: str,
        ward: str | None = None,
        severity: str | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        """Return routing info, e.g. {"department": "GHMC Roads", ...}.

        The AI path is attempted first; any failure falls back to the
        keyword rules, so a busy/gated model can never break complaint
        creation.
        """
        rules_department, rules_note = self._rule_route(category, description or "")

        ai_data = await self._ai_route(
            category=category or "",
            ward=ward,
            severity=severity,
            description=description or "",
        )

        if ai_data:
            department = ai_data.get("department") or rules_department
            note = ai_data.get("notes") or rules_note
            priority = ai_data.get("priority")
            ai_used = True
            error = None
        else:
            department, note = rules_department, rules_note
            priority = _PRIORITY_BY_SEVERITY.get((severity or "").lower())
            ai_used = False
            error = "AI model unavailable - used built-in routing rules."

        return {
            "department": department,
            "priority": priority,
            "notes": note,
            "ai_used": ai_used,
            "error": error,
        }