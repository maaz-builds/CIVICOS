"""Vercel entrypoint for the CivicFix backend.

Vercel forwards the ORIGINAL request path to a service, so a request to
/api/backend/health arrives here as /api/backend/health (the rewrite prefix
is not stripped). Mounting the FastAPI app under that same prefix makes the
paths line up: the mount strips /api/backend and the inner app sees /health.

Local development is unaffected - run the app directly as before:
    uvicorn app.main:app --reload --port 8000
"""

from fastapi import FastAPI

from app.main import app as civicfix_app

# Public prefix used by the top-level rewrite in vercel.json.
API_PREFIX = "/api/backend"

app = FastAPI(
    title="CivicFix Vercel entrypoint",
    description="Mounts the CivicFix FastAPI app under the /api/backend rewrite prefix.",
    version="0.1.0",
)

app.mount(API_PREFIX, civicfix_app)