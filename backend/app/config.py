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


settings = Settings()