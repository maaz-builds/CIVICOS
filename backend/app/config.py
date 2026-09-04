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

    # Vision model served by Featherless. The default is a 72B model - slow
    # but accurate. For faster demos, switch to a smaller model, e.g.:
    #   VISION_MODEL=Qwen/Qwen2.5-VL-7B-Instruct
    VISION_MODEL: str = os.getenv(
        "VISION_MODEL",
        "Qwen/Qwen2.5-VL-72B-Instruct",
    )

    # Optional chat model used by the Location Agent to refine the
    # address -> GHMC ward mapping. Leave empty to use the built-in
    # address parser (works without any model). If you enable it, pick an
    # ungated Featherless instruct model, e.g.:
    #   WARD_MODEL=Qwen/Qwen2.5-7B-Instruct
    WARD_MODEL: str = os.getenv("WARD_MODEL", "")


settings = Settings()