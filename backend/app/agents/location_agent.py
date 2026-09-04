"""Location agent - pins down where a complaint is (coords + GHMC ward).

GPS comes from the caller, not from parsing text: the browser sends real
coordinates via navigator.geolocation (see the /report page), or they are
embedded in the photo's EXIF metadata.

Coordinates are reverse-geocoded to a street address via OpenStreetMap
(geopy/Nominatim, no API key needed). An LLM cannot turn bare lat/lng
into an address, so the geocoder always supplies the raw text. From that
address, the Featherless chat model (WARD_MODEL, default Qwen 7B) is the
PRIMARY interpreter: it resolves the GHMC zone, the precise ward (e.g.
"Ward 104 Kondapur"), a short area name, and the infrastructure type.

The built-in address parser is only a fallback - it keeps the location
step working when the model is unset, gated, busy, or returns garbage.
The nearby-incident counters are real counts from the Supabase
`complaints` table (within ~2 km), or null when the database is
unreachable - never hardcoded.

Both integrations are synchronous SDK calls, so they run in worker threads
(asyncio.to_thread) - they must not block FastAPI's event loop.
"""

import asyncio
import json
import math
import re
from typing import Any, Dict

from geopy.geocoders import Nominatim

from app.config import settings
from app.services.featherless_service import FeatherlessService
from app.services.supabase_service import SupabaseService

# Well-known GHMC zone / prominent-area names, matched against the address
# by the RULES FALLBACK (the AI is the primary path).
_KNOWN_AREAS = [
    "Charminar",
    "Khairatabad",
    "Secunderabad",
    "Kukatpally",
    "Serilingampally",
    "LB Nagar",
    "L B Nagar",
    "Alwal",
    "Quthbullapur",
    "Rajendranagar",
    "Gachibowli",
    "Madhapur",
    "Ameerpet",
    "Begumpet",
    "Dilsukhnagar",
    "Uppal",
    "Hayathnagar",
    "Patancheru",
    "Kapra",
    "Malkajgiri",
]

# Fallback used when no coordinates are available at all. Hyderabad centre.
_FALLBACK_COORDS = (17.4399, 78.4983)

# Radius (km) used for the "nearby incidents" counter.
_NEARBY_RADIUS_KM = 2.0

# Infrastructure types the AI may return; anything else is ignored so a
# confused model cannot overwrite a sensible value with nonsense.
_ALLOWED_INFRA = {
    "Main Road",
    "Residential",
    "Commercial",
    "Highway",
    "Industrial",
    "Park",
    "Water Body",
    "School",
    "Hospital",
    "Other",
}

# Zone names the model is allowed to claim. Covers the compass circles
# Nominatim puts in addresses ("West Zone") plus the six official GHMC
# zone names and common "X Zone" spellings of them.
_KNOWN_ZONES = {
    "Central Zone",
    "East Zone",
    "West Zone",
    "North Zone",
    "South Zone",
    "Charminar",
    "Khairatabad",
    "Kukatpally",
    "LB Nagar",
    "L B Nagar",
    "Secunderabad",
    "Serilingampally",
    "Alwal",
    "Rajendranagar",
    "Quthbullapur",
}


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _plausible_zone(value: str) -> bool:
    """Accept a zone the model returned only if it looks like a real one."""
    v = value.strip()
    if not v or len(v) > 40:
        return False
    if v.lower() in {z.lower() for z in _KNOWN_ZONES}:
        return True
    # "Serilingampally Zone" / "Kondapur Zone" style spellings are fine too.
    return bool(re.fullmatch(r".+?\s+zone", v, re.IGNORECASE))


def _extract_json(text: str) -> dict[str, Any] | None:
    """Robustly pull a JSON object out of a model reply.

    Handles markdown fences, leading prose, and trailing commentary -
    anything that a plain json.loads would choke on.
    """
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if 0 <= start < end:
        try:
            return json.loads(cleaned[start : end + 1])
        except Exception:
            return None
    return None


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometres between two points."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _ward_from_address(address: str) -> tuple[str, str, str]:
    """RULES FALLBACK - derive (ward, area_name, zone) from an address.

    Only used when the AI model is unset, busy, gated, or returns junk.
    Nominatim addresses for Hyderabad include tokens like 'Ward 104
    Kondapur' and 'West Zone', which is enough for a civic demo.
    """
    ward = ""
    area = ""
    zone = ""

    # "Ward 104 Kondapur" -> ward number 104 + locality "Kondapur".
    m = re.search(
        r"ward\s*(\d+)\s*([^,]*?)(?=\s*,|$)", address, re.IGNORECASE
    )
    if m:
        ward = f"Ward {m.group(1)}"
        locality = m.group(2).strip()
        if locality:
            ward = f"{ward} {locality}"

    zone_m = re.search(r"(\w[\w &-]*?)\s*zone", address, re.IGNORECASE)
    if zone_m:
        zone = zone_m.group(1).strip()
        # Normalise e.g. "Greater Hyderabad Municipal Corporation Central"
        zone = re.sub(
            r"^(greater hyderabad municipal corporation)\s+",
            "",
            zone,
            flags=re.IGNORECASE,
        )
        # Short compass-style zone names read better with the suffix.
        if re.fullmatch(r"(central|east|west|north|south)", zone, re.IGNORECASE):
            zone = f"{zone} Zone"

    for known in _KNOWN_AREAS:
        if re.search(rf"\b{re.escape(known)}\b", address, re.IGNORECASE):
            area = known
            break

    # The most specific part of an address is usually its first component.
    if not area:
        first = address.split(",")[0].strip()
        if first and len(first) > 2:
            area = first

    return ward, area, zone


def _infra_from_address(address: str) -> str:
    """RULES FALLBACK - best-effort infrastructure type from keywords."""
    lower = address.lower()
    if "highway" in lower or "expressway" in lower:
        return "Highway"
    if "residential" in lower or "colony" in lower or "nagar" in lower:
        return "Residential"
    if "market" in lower or "commercial" in lower or "complex" in lower:
        return "Commercial"
    if "road" in lower or "street" in lower or "lane" in lower:
        return "Main Road"
    return "Other"


def _counts_from_rows(
    lat: float, lng: float, rows: list[dict[str, Any]]
) -> tuple[int, int]:
    """Count complaints near (lat, lng) from stored rows.

    Returns (nearby_total, nearby_unresolved). Unresolved = status is
    anything other than 'resolved' (GHMC marks a complaint done with that
    word).
    """
    nearby = 0
    unresolved = 0
    for row in rows:
        r_lat, r_lng = row.get("lat"), row.get("lng")
        if r_lat is None or r_lng is None:
            continue
        if _haversine_km(lat, lng, float(r_lat), float(r_lng)) > _NEARBY_RADIUS_KM:
            continue
        nearby += 1
        if (row.get("status") or "submitted").lower() != "resolved":
            unresolved += 1
    return nearby, unresolved


class LocationAgent:
    """Context-building agent: Maps GPS to real-world infrastructure."""

    def __init__(self):
        # OpenStreetMap reverse geocoding (no API key needed) - always
        # supplies the raw address text the AI then interprets.
        self.geolocator = Nominatim(user_agent="Civicos_HackWave_ContextAgent")
        self.ai = FeatherlessService()

    def _fetch_nearby_rows(self) -> list[dict[str, Any]]:
        """Sync Supabase read - runs inside a worker thread."""
        service = SupabaseService()
        response = (
            service.client.table(service.TABLE)
            .select("lat,lng,status")
            .execute()
        )
        return list(response.data or [])

    async def _ai_map(
        self, exact_address: str, lat: float, lng: float
    ) -> tuple[dict[str, Any] | None, str | None]:
        """Featherless (WARD_MODEL): interpret the address as GHMC context.

        Returns (parsed_data, error). ``None`` data means the model was
        unusable and the caller must fall back to the rules parser.
        """
        system_prompt = f"""
        You are the civic mapping engine for the Greater Hyderabad Municipal
        Corporation (GHMC). A citizen reported an issue at these coordinates:
        {lat:.5f}, {lng:.5f}

        Reverse geocoding produced this exact address:
        {exact_address}

        Interpret the address and return ONLY a raw JSON object (no prose,
        no markdown) with exactly these fields:
        - "zone": the GHMC zone. If the address names one (e.g. "West Zone",
          "Central Zone"), return that exact name. Otherwise map the locality
          to the closest official GHMC zone: Charminar, Khairatabad,
          Kukatpally, LB Nagar, Secunderabad, or Serilingampally.
        - "ward": the precise GHMC ward when the address contains one
          (e.g. "Ward 104 Kondapur"); otherwise your best guess or "".
        - "area_name": one short recognisable locality name (e.g. "Madhapur").
        - "infrastructure_type": one of {sorted(_ALLOWED_INFRA)}.
        """
        try:
            raw = await self.ai.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": (
                            "Return the JSON mapping for this address now."
                        ),
                    },
                ],
                model=settings.WARD_MODEL,
            )
            data = _extract_json(raw)
            if not data:
                return None, "Model returned no parseable JSON"
            return data, None
        except Exception as exc:
            return None, str(exc)

    async def extract_location(
        self,
        description: str,
        lat: float | None = None,
        lng: float | None = None,
        photo_urls: list[str] | None = None,
    ) -> Dict[str, Any]:
        # 1. COORDS: explicit lat/lng win, then a "[GPS: ...]" tag embedded
        #    in the description, then the fallback point.
        if lat is not None and lng is not None:
            pass  # caller supplied genuine coordinates
        else:
            gps_match = re.search(r"\[GPS:\s*([0-9.-]+),\s*([0-9.-]+)\]", description)
            if gps_match:
                lat, lng = float(gps_match.group(1)), float(gps_match.group(2))
            else:
                print("WARNING: No coordinates provided. Defaulting to Hyderabad centre.")
                lat, lng = _FALLBACK_COORDS

        # 2. REVERSE GEOCODE: Get the real street address using Geopy.
        #    Nominatim blocks the event loop, so run the call in a worker thread.
        try:
            location = await asyncio.to_thread(
                self.geolocator.reverse, (lat, lng), exactly_one=True, timeout=5
            )
            exact_address = location.address if location else "Unknown Location"
        except Exception as exc:
            print(f"Geocoding failed: {exc}")
            exact_address = "Address lookup failed"

        # 3. RULES FALLBACK VALUES first (always computed, used only when
        #    the AI cannot answer).
        ward_r, area_r, zone_r = _ward_from_address(exact_address)
        infra = _infra_from_address(exact_address)

        # 4. AI MAPPING (primary): Featherless interprets the address.
        ai_data: dict[str, Any] | None = None
        ai_error: str | None = None
        ai_used = False
        if settings.WARD_MODEL:
            ai_data, ai_error = await self._ai_map(exact_address, lat, lng)

        if ai_data:
            ai_used = True

            ai_zone = _clean(ai_data.get("zone"))
            if ai_zone and _plausible_zone(ai_zone):
                zone = ai_zone
            else:
                zone = zone_r

            ward = _clean(ai_data.get("ward")) or ward_r
            area = _clean(ai_data.get("area_name")) or area_r

            ai_infra = _clean(ai_data.get("infrastructure_type"))
            if ai_infra in _ALLOWED_INFRA:
                infra = ai_infra
        else:
            zone, ward, area = zone_r, ward_r, area_r

        # The GHMC routes on ward numbers, so prefer the precise ward
        # ("Ward 104 Kondapur") over the zone; fall back to zone / area.
        ward_name = ward or zone or area or "Secunderabad"

        # 5. REAL nearby-incident counts from Supabase (best-effort). We
        #    never fabricate these - no database -> null, not a fake number.
        nearby_incidents: int | None = None
        unresolved_incidents: int | None = None
        try:
            rows = await asyncio.to_thread(self._fetch_nearby_rows)
            nearby_incidents, unresolved_incidents = _counts_from_rows(lat, lng, rows)
        except Exception as exc:
            print(f"Nearby-incident lookup skipped: {exc}")

        return {
            "lat": lat,
            "lng": lng,
            "exact_address": exact_address,
            "area_name": area or "Unknown",
            "ward": ward_name,
            "zone": zone,
            "infrastructure_type": infra,
            "nearby_incidents": nearby_incidents,
            "unresolved_incidents": unresolved_incidents,
            "ai_used": ai_used,
            "ai_mapping_error": ai_error,
        }
