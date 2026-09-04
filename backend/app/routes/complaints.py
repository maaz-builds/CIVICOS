"""Complaint endpoints.

- POST /complaints/analyze   upload a photo -> vision analysis (AI)
- POST /complaints           create a complaint record (Supabase)
- GET  /complaints           list recent complaints (newest first)
- GET  /complaints/{tracking_id}  look up one complaint by its CF- ID

Uploaded photos are written to the OS temp directory instead of a
repo-local folder: locally that keeps the working tree clean, and on Vercel
it is required, because the serverless filesystem is read-only except for
the /tmp area.
"""

import os
import shutil
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.agents.location_agent import LocationAgent
from app.agents.tracking_agent import TrackingAgent
from app.agents.vision_agent import VisionAgent
from app.schemas.complaint_schema import ComplaintCreate
from app.services.supabase_service import SupabaseService

router = APIRouter(prefix="/complaints", tags=["Complaints"])

# Reject huge uploads early: a giant image means a giant base64 payload and
# far more vision tokens, which slows the model call dramatically.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

vision = VisionAgent()
location = LocationAgent()
tracking = TrackingAgent()
db = SupabaseService()


@router.post("/analyze")
async def analyze_civic_issue(
    file: UploadFile = File(...),
    lat: float | None = Form(None, description="GPS latitude (optional)"),
    lng: float | None = Form(None, description="GPS longitude (optional)"),
):
    """Upload a photo and get the vision agent's analysis of the issue.

    Optional lat/lng come from the browser's geolocation on the /report
    page; when present, the location agent reverse-geocodes them, maps the
    address to a GHMC ward, and attaches that to the response. Location is
    best-effort: if it fails, the analysis is still returned.
    """
    if file.size is not None and file.size > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Image too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB). "
                "Resize it and try again."
            ),
        )

    # Derive a safe extension from the upload name (default to .jpg).
    suffix = os.path.splitext(file.filename or "")[1].lower()
    if not suffix.startswith("."):
        suffix = ".jpg"

    tmp_path = None
    try:
        # Write the upload to a temporary file, then analyze it.
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as buffer:
            tmp_path = buffer.name
            shutil.copyfileobj(file.file, buffer)

        analysis = await vision.analyze(
            tmp_path,
            content_type=file.content_type or "image/jpeg",
        )
    except Exception as exc:
        # AI providers fail for many reasons (missing key, quota, bad
        # model output) - surface a clean error instead of a traceback.
        raise HTTPException(
            status_code=502,
            detail=f"AI analysis failed: {exc}",
        ) from exc
    finally:
        if tmp_path is not None:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    # 2b. LOCATION (best-effort): only when the caller supplied real coords.
    #     A hiccup here must not fail the vision analysis - the photo was
    #     already understood, and location can be added at save time later.
    location_data = None
    if lat is not None and lng is not None:
        try:
            location_data = await location.extract_location(
                description=analysis.get("description", ""),
                lat=lat,
                lng=lng,
            )
        except Exception as exc:  # noqa: BLE001 - best-effort enrichment
            print(f"Location agent failed: {exc}")
            location_data = None

    return {"success": True, "analysis": analysis, "location": location_data}


@router.post("", status_code=201)
async def create_complaint(payload: ComplaintCreate):
    """Persist a new complaint and return the stored row with its tracking ID."""
    try:
        tracking_id = await tracking.create_tracking_id(complaint_id="pending")
        record = payload.model_dump()
        record["tracking_id"] = tracking_id
        return await db.insert_complaint(record)
    except RuntimeError as exc:
        # Supabase not configured - clear setup message, not a traceback.
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface real Supabase errors
        raise HTTPException(
            status_code=502,
            detail=f"Could not save complaint: {exc}",
        ) from exc


@router.get("")
async def list_complaints(limit: int = 20):
    """Return the most recent complaints, newest first."""
    try:
        return await db.list_complaints(limit=limit)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"Could not list complaints: {exc}",
        ) from exc


@router.get("/{tracking_id}")
async def get_complaint(tracking_id: str):
    """Look up one complaint by its CF- tracking ID."""
    try:
        row = await db.get_complaint_by_tracking_id(tracking_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"Could not look up complaint: {exc}",
        ) from exc

    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"No complaint found with tracking ID '{tracking_id}'.",
        )
    return row
