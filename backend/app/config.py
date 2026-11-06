import os
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env when present (no-op if the file does not exist).
_BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_DIR / ".env")


def _parse_csv(value: str | None) -> list[str]:
    """Turn 'a, b,c' into ['a', 'b', 'c'] (empty string -> [])."""
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    """App settings with beginner-friendly defaults."""

    # Name reported by GET /health.
    SERVICE_NAME: str = os.getenv(
        "CIVICFIX_SERVICE_NAME",
        "civicfix-backend"
    )

    # Browser origins allowed to call this API (CORS).
    CORS_ORIGINS: list[str] = _parse_csv(
        os.getenv(
            "CIVICFIX_CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        )
    )

    # Gemini API key. Keep the legacy name as a fallback for existing local
    # environments; deployments should use GEMINI_API_KEY.
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY") or os.getenv(
        "FEATHERLESS_API_KEY", ""
    )

    # Supabase (project URL + anon key from Project Settings -> API)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")

    # Supabase Storage bucket for complaint photos (created by
    # backend/supabase/schema.sql; must be a public bucket so the returned
    # image_url is readable without auth).
    SUPABASE_STORAGE_BUCKET: str = os.getenv(
        "SUPABASE_STORAGE_BUCKET",
        "complaint-photos",
    )

    # Gemini models used for vision and text tasks.
    VISION_MODEL: str = os.getenv(
        "VISION_MODEL",
        "gemini-2.5-flash",
    )

    # Chat model used by the Location Agent. Set WARD_MODEL to an empty
    # string to disable AI for this step and use the parser only.
    WARD_MODEL: str = os.getenv(
        "WARD_MODEL",
        "gemini-2.5-flash",
    )

    # Chat model used by the Routing Agent. Routing falls back to built-in
    # keyword rules when the model is unavailable.
    ROUTING_MODEL: str = os.getenv(
        "ROUTING_MODEL",
        "gemini-2.5-flash",
    )

    # GHMC's official WhatsApp number for grievances (MyCUREApp accepts
    # complaints via WhatsApp), digits only WITH the country code, e.g.
    # 919000000000. When set, every saved complaint response gains a
    # ``whatsapp_link`` - a wa.me deep link with the grievance text
    # pre-filled - so the citizen can send it to GHMC in one tap. Leave
    # empty to omit the button.
    WHATSAPP_NUMBER: str = os.getenv("WHATSAPP_NUMBER", "")


settings = Settings()