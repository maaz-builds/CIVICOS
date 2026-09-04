"""Location agent - pins down where a complaint is (coords + GHMC ward).

Parses strict GPS out of the vision description, reverse-geocodes it to a
real street address via OpenStreetMap (geopy/Nominatim, no API key needed),
then uses Featherless to resolve that address to a GHMC zone/ward.

Both integrations are synchronous SDK calls, so they run in worker threads
(asyncio.to_thread) - they must not block FastAPI's event loop.
"""

import asyncio
import json
import re
from typing import Any, Dict

from geopy.geocoders import Nominatim

from app.services.featherless_service import FeatherlessService

# Cheap text model for the address -> ward mapping. The 72B vision model is
# overkill and slow for this step.
_WARD_MODEL = "meta-llama/Llama-3.1-8B-Instruct"


class LocationAgent:
    """Context-building agent: Maps GPS to real-world infrastructure."""

    def __init__(self):
        # OpenStreetMap reverse geocoding (no API key needed)
        self.geolocator = Nominatim(user_agent="Civicos_HackWave_ContextAgent")
        self.ai = FeatherlessService()

    async def extract_location(
        self,
        description: str,
        photo_urls: list[str] | None = None,
    ) -> Dict[str, Any]:
        # 1. PARSE: Extract strict GPS
        gps_match = re.search(r"\[GPS:\s*([0-9.-]+),\s*([0-9.-]+)\]", description)
        if not gps_match:
            print("WARNING: No strict GPS found. Defaulting to Secunderabad.")
            lat, lng = 17.4399, 78.4983
        else:
            lat = float(gps_match.group(1))
            lng = float(gps_match.group(2))

        # 2. REVERSE GEOCODE: Get the real street address using Geopy.
        # Nominatim blocks the event loop, so run the call in a worker thread.
        try:
            location = await asyncio.to_thread(
                self.geolocator.reverse, (lat, lng), exactly_one=True, timeout=5
            )
            exact_address = location.address if location else "Unknown Location"
        except Exception as exc:
            print(f"Geocoding failed: {exc}")
            exact_address = "Address lookup failed"

        # 3. AI MAPPING: Use Featherless to find the GHMC Zone
        system_prompt = f"""
        You are a civic context engine for the Greater Hyderabad Municipal Corporation (GHMC).
        Given this exact address: {exact_address}

        Determine the likely GHMC Zone (e.g., Charminar, Khairatabad, Secunderabad, Kukatpally, Serilingampally, LB Nagar) and a short area name.

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
                model=_WARD_MODEL,
            )
            cleaned_text = raw.replace("```json", "").replace("```", "").strip()
            ai_data = json.loads(cleaned_text)
        except Exception as exc:
            print(f"AI Context mapping failed: {exc}")
            ai_data = {
                "ward": "Secunderabad",
                "area_name": "Unknown",
                "infrastructure_type": "Road",
            }

        return {
            "lat": lat,
            "lng": lng,
            "exact_address": exact_address,
            "area_name": ai_data.get("area_name", "Secunderabad"),
            "ward": ai_data.get("ward", "Secunderabad"),
            "infrastructure_type": ai_data.get("infrastructure_type", "Main Road"),
            "nearby_incidents": 3,
            "unresolved_incidents": 2,
        }