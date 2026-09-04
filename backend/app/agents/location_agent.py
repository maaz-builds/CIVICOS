import json
import re
from typing import Any, Dict
from geopy.geocoders import Nominatim
from app.services.featherless_service import ai_client

class LocationAgent:
    """Context-building agent: Maps GPS to real-world infrastructure."""

    def __init__(self):
        # OpenStreetMap reverse geocoding (no API key needed)
        self.geolocator = Nominatim(user_agent="Civicos_HackWave_ContextAgent")

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

        # 2. REVERSE GEOCODE: Get the real street address using Geopy
        try:
            location = self.geolocator.reverse((lat, lng), exactly_one=True, timeout=5)
            exact_address = location.address if location else "Unknown Location"
        except Exception as e:
            print(f"Geocoding failed: {e}")
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
            response = ai_client.chat.completions.create(
                model="meta-llama/Llama-3.1-8B-Instruct",
                messages=[{"role": "system", "content": system_prompt}],
                temperature=0.1
            )
            cleaned_text = response.choices[0].message.content.replace("```json", "").replace("```", "").strip()
            ai_data = json.loads(cleaned_text)
        except Exception as e:
            print(f"AI Context mapping failed: {e}")
            ai_data = {"ward": "Secunderabad", "area_name": "Unknown", "infrastructure_type": "Road"}

        return {
            "lat": lat,
            "lng": lng,
            "exact_address": exact_address,
            "area_name": ai_data.get("area_name", "Secunderabad"),
            "ward": ai_data.get("ward", "Secunderabad"),
            "infrastructure_type": ai_data.get("infrastructure_type", "Main Road"),
            "nearby_incidents": 3,
            "unresolved_incidents": 2
        }