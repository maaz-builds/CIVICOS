"""Location agent - pins down where a complaint is (coords + GHMC ward).

GPS usually comes from the caller, not from parsing text: the browser sends
real coordinates via navigator.geolocation (see the /report page), or they
are embedded in the photo's EXIF metadata. The description is only parsed
for a "[GPS: lat, lng]" tag as a last resort.

Once coordinates are known, the agent reverse-geocodes them to a street
address via OpenStreetMap (geopy/Nominatim, no API key needed). The GHMC
ward / zone is then derived straight from that address - Nominatim already
returns ward numbers and zone names (e.g. "Ward 98 Ameerpet", "Central
Zone"), so no AI call is required.

Optionally, when WARD_MODEL is configured (backend/.env), a Featherless
chat model can refine the mapping. This is a bonus, not a dependency: if
the model is gated, busy, or unset, the address-derived ward still works.

Both integrations are synchronous SDK calls, so they run in worker threads
(asyncio.to_thread) - they must not block FastAPI's event loop.
"""

import asyncio
import json
import re
from typing import Any, Dict

from geopy.geocoders import Nominatim

from app.config import settings
from app.services.featherless_service import FeatherlessService

# Well-known GHMC zone / prominent-area names, matched against the address.
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


def _ward_from_address(address: str) -> tuple[str, str, str]:
    """Derive (ward, area_name, zone) from a Nominatim address string.

    Pure rules, no network and no AI: Nominatim addresses for Hyderabad
    include tokens like 'Ward 98 Ameerpet' and 'Central Zone', which is
    enough for a civic demo. Returns ('', '', '') when nothing matches.
    """
    ward = ""
    area = ""
    zone = ""

    m = re.search(r"ward\s*(\d+)", address, re.IGNORECASE)
    if m:
        ward = f"Ward {m.group(1)}"

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


class LocationAgent:
    """Context-building agent: Maps GPS to real-world infrastructure."""

    def __init__(self):
        # OpenStreetMap reverse geocoding (no API key needed)
        self.geolocator = Nominatim(user_agent="Civicos_HackWave_ContextAgent")
        self.ai = FeatherlessService()

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
                print("WARNING: No coordinates provided. Defaulting to Secunderabad.")
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

        # 3. WARD: derive it from the address first - this always works.
        ward, area, zone = _ward_from_address(exact_address)

        # 4. AI MAPPING (optional): only if a WARD_MODEL is configured.
        #    A gated/busy/missing model must never break the location step.
        ai_error = None
        if settings.WARD_MODEL:
            system_prompt = f"""
            You are a civic context engine for the Greater Hyderabad Municipal Corporation (GHMC).
            Given this exact address: {exact_address}

            Determine the likely GHMC Zone (e.g., Charminar, Khairatabad, Secunderabad, Kukatpally, Serilingampally, LB Nagar), a short area name, and an infrastructure type.

            Return ONLY a raw JSON object with:
            - "ward" (string)
            - "area_name" (string)
            - "infrastructure_type" (string: e.g., 'Main Road', 'Residential', 'Highway', 'Commercial')
            """

            try:
                raw = await self.ai.chat_completion(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {
                            "role": "user",
                            "content": (
                                "Map this address to a GHMC ward and return the JSON."
                            ),
                        },
                    ],
                    model=settings.WARD_MODEL,
                )
                cleaned_text = raw.replace("```json", "").replace("```", "").strip()
                ai_data = json.loads(cleaned_text)
                ward = ai_data.get("ward") or ward
                area = ai_data.get("area_name") or area
            except Exception as exc:
                ai_error = str(exc)

        # The zone names the GHMC circle; prefer it over a bare ward number.
        ward_name = zone or ward or "Secunderabad"
        infrastructure_type = "Main Road"
        if "residential" in exact_address.lower():
            infrastructure_type = "Residential"
        elif "highway" in exact_address.lower() or "road" in exact_address.lower():
            infrastructure_type = "Main Road"

        return {
            "lat": lat,
            "lng": lng,
            "exact_address": exact_address,
            "area_name": area or "Unknown",
            "ward": ward_name,
            "infrastructure_type": infrastructure_type,
            "nearby_incidents": 3,
            "unresolved_incidents": 2,
            "ai_mapping_error": ai_error,
        }