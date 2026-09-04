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

    # Featherless AI
    FEATHERLESS_API_KEY: str = os.getenv(
        "FEATHERLESS_API_KEY",
        ""
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

    # Vision model served by Featherless. The default is a 72B model - slow
    # but accurate. For faster demos, switch to a smaller model, e.g.:
    #   VISION_MODEL=Qwen/Qwen2.5-VL-7B-Instruct
    VISION_MODEL: str = os.getenv(
        "VISION_MODEL",
        "Qwen/Qwen2.5-VL-72B-Instruct",
    )

    # Chat model used by the Location Agent to refine the address -> GHMC
    # ward/zone mapping and guess the infrastructure type. Defaults to an
    # ungated, fast Featherless instruct model; the built-in address parser
    # stays as the fallback. Set WARD_MODEL to an empty string to disable
    # AI for this step entirely (parser-only mode).
    WARD_MODEL: str = os.getenv(
        "WARD_MODEL",
        "Qwen/Qwen2.5-7B-Instruct",
    )

    # Chat model used by the Routing Agent to map an issue category to the
    # responsible GHMC department. The default is ungated and fast; set it
    # to any ungated Featherless instruct model. Routing falls back to
    # built-in keyword rules when the model is busy/gated/unset.
    ROUTING_MODEL: str = os.getenv(
        "ROUTING_MODEL",
        "Qwen/Qwen2.5-7B-Instruct",
    )


settings = Settings()