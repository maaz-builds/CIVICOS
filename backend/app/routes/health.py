"""Health check endpoint.

The frontend "Check Backend" button calls GET /health to verify that the
backend is up and reachable.
"""

from fastapi import APIRouter

from app.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    """Return a simple liveness payload."""
    return {
        "status": "ok",
        "service": settings.SERVICE_NAME,
    }
