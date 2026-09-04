"""CivicFix Hyderabad backend - FastAPI entry point.

Run from the backend/ directory with:
    uvicorn app.main:app --reload --port 8000

Routes live in app/routes/ and are registered here so the app stays
organized as the project grows.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import complaints, health

app = FastAPI(
    title="CivicFix Hyderabad Backend",
    description="REST API behind the CivicFix Hyderabad civic issue reporting platform.",
    version="0.1.0",
)

# CORS: lets the Next.js dev server (http://localhost:3000) call this API
# from the browser. Origins can be changed via CIVICFIX_CORS_ORIGINS in .env.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the route modules. Add new routers here as the API grows.
app.include_router(health.router)
app.include_router(complaints.router)


@app.get("/")
def root() -> dict[str, str]:
    """Friendly pointer when someone opens http://localhost:8000 in a browser."""
    return {
        "service": settings.SERVICE_NAME,
        "message": "See /health for the health check and /docs for API docs.",
    }
