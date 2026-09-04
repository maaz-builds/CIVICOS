"""Complaint endpoints.

- POST /complaints/analyze   photo -> LangGraph pipeline: vision analysis
                             (AI) -> location -> routing
- POST /complaints           create a complaint record (Supabase), optionally
                             with the original photo (Supabase Storage)
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

from app.agents.tracking_agent import TrackingAgent
from app.schemas.complaint_schema import ComplaintCreate
from app.services.storage_service import StorageService
from app.services.supabase_service import SupabaseService
from app.workflows.complaint_workflow import get_complaint_workflow

router = APIRouter(prefix="/complaints", tags=["Complaints"])

# Reject huge uploads early: a giant image means a giant base64 payload and
# far more vision tokens, which slows the model call dramatically.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

tracking = TrackingAgent()
db = SupabaseService()
storage = StorageService(db)


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

        # Run the LangGraph pipeline: vision -> location -> routing.
        # Vision is required and raises on failure (mapped below); the
        # location and routing nodes are best-effort and swallow their own
        # errors inside the graph, exactly like the old inline code.
        result = await get_complaint_workflow().ainvoke(
            {
                "image_path": tmp_path,
                "content_type": file.content_type or "image/jpeg",
                "lat": lat,
                "lng": lng,
                "mode": "analyze",
            }
        )
        analysis = result.get("vision")
        location_data = result.get("location")
        routing_data = result.get("routing")
        errors = result.get("errors") or {}
        if errors:
            print(f"Workflow best-effort errors: {errors}")
    except Exception as exc:
        # AI providers fail for many reasons (missing key, quota, bad
        # model output) - surface a clean error instead of a traceback.
        # Heavy congestion gets a 503 with a human message.
        if "capacity" in str(exc).lower() or "overloaded" in str(exc).lower():
            raise HTTPException(
                status_code=503,
                detail=(
                    "The AI analysis service is currently at capacity. "
                    "Please wait a minute and try again."
                ),
            ) from exc
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

    return {
        "success": True,
        "analysis": analysis,
        "location": location_data,
        "routing": routing_data,
    }


@router.post("", status_code=201)
async def create_complaint(
    issue_type: str = Form(..., min_length=1, description="e.g. Pothole"),
    description: str = Form("", description="Free-text description of the issue"),
    confidence: float | None = Form(None, ge=0, le=1),
    severity: str | None = Form(None, description="Low | Medium | High | Critical"),
    ward: str | None = Form(None, description="Ward / zone (from the location agent)"),
    lat: float | None = Form(None, ge=-90, le=90),
    lng: float | None = Form(None, ge=-180, le=180),
    department: str | None = Form(None, description="Assigned GHMC department"),
    routing_notes: str | None = Form(None),
    file: UploadFile | None = File(
        None,
        description=(
            "Original photo - uploaded to Supabase Storage and linked via "
            "image_url (omit to save without a photo)"
        ),
    ),
):
    """Persist a new complaint and return the stored row with its tracking ID.

    Accepts **multipart form data** (matching how the frontend saves after
    analysis): the analysis fields as form values, plus the original photo
    as ``file``. When a photo is included it is uploaded to the public
    Supabase Storage bucket first, and the returned row's ``image_url``
    points at it.
    """
    # Same size cap as /analyze - a giant photo bloats storage + the DB row.
    if file is not None and file.size is not None and file.size > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Image too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB). "
                "Resize it and try again."
            ),
        )

    try:
        tracking_id = await tracking.create_tracking_id(complaint_id="pending")

        # Upload the photo first (if provided) so the row can link to it.
        # StorageService raises RuntimeError with a setup hint when the
        # bucket or credentials are missing.
        image_url = None
        if file is not None:
            file_bytes = await file.read()
            image_url = await storage.upload_image(
                file_bytes,
                file.filename or "photo.jpg",
                file.content_type or "image/jpeg",
            )

        record = ComplaintCreate(
            issue_type=issue_type,
            description=description,
            confidence=confidence,
            severity=severity,
            ward=ward,
            lat=lat,
            lng=lng,
            department=department,
            routing_notes=routing_notes,
        ).model_dump()
        record["tracking_id"] = tracking_id
        record["image_url"] = image_url
        return await db.insert_complaint(record)
    except RuntimeError as exc:
        # Supabase or Storage not configured - clear setup message, not a
        # traceback.
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