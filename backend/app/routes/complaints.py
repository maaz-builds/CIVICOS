"""Complaint endpoints.

- POST /complaints/analyze   image OR video -> LangGraph pipeline (vision ->
                             location -> routing), streamed as SSE events.
                             Videos are sampled into frames by the vision
                             agent and aggregated into one analysis.
- POST /complaints           create a complaint record (Supabase), optionally
                             with the original photo (Supabase Storage);
                             refuses with a 409 + the existing tracking ID
                             when the same issue is already reported nearby
- GET  /complaints           list recent complaints (newest first)
- GET  /complaints/{tracking_id}  look up one complaint by its CF- ID
- PATCH /complaints/{tracking_id}/status  advance a complaint's lifecycle
                             status (submitted -> assigned -> in progress
                             -> resolved); used by the GHMC demo portal

Uploaded media are written to the OS temp directory instead of a
repo-local folder: locally that keeps the working tree clean, and on Vercel
it is required, because the serverless filesystem is read-only except for
the /tmp area.
"""

import json
import os
import shutil
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.agents.tracking_agent import TrackingAgent
from app.schemas.complaint_schema import ComplaintCreate, StatusUpdate
from app.services.storage_service import StorageService
from app.services.supabase_service import SupabaseService
from app.workflows.complaint_workflow import get_complaint_workflow

router = APIRouter(prefix="/complaints", tags=["Complaints"])

# Reject huge uploads early: a giant image means a giant base64 payload and
# far more vision tokens, which slows the model call dramatically. The cap
# matches Vercel's serverless request-body limit (~4.5 MB) with headroom, so
# uploads work on the deployed site too (the frontend enforces the same cap
# before uploading).
MAX_UPLOAD_BYTES = 4 * 1024 * 1024  # 4 MB

# MIME types accepted by POST /complaints/analyze. Anything else gets a
# friendly 415 instead of a confusing model error.
_ALLOWED_MEDIA_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
}

# Fallback when a client sends no Content-Type header: guess from the
# filename extension.
_EXTENSION_MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
}


def _media_type_of(upload: UploadFile) -> str | None:
    """Return the upload's MIME type (from header, else extension)."""
    content_type = (upload.content_type or "").lower()
    if content_type:
        return content_type
    ext = os.path.splitext(upload.filename or "")[1].lower()
    return _EXTENSION_MEDIA_TYPES.get(ext)

tracking = TrackingAgent()
db = SupabaseService()
storage = StorageService(db)


@router.post("/analyze")
async def analyze_civic_issue(
    file: UploadFile = File(...),
    lat: float | None = Form(None, description="GPS latitude (optional)"),
    lng: float | None = Form(None, description="GPS longitude (optional)"),
):
    """Upload a photo or video and get the vision agent's analysis.

    Accepts images (jpg/png/webp) and videos (mp4/webm/mov) up to 4 MB.
    Videos are sampled into a few evenly spaced frames by the vision agent
    and the per-frame results are aggregated into one unified analysis -
    the response shape is identical for both media types.

    Optional lat/lng come from the browser's geolocation on the /report
    page; when present, the location agent reverse-geocodes them, maps the
    address to a GHMC ward, and attaches that to the response. Location is
    best-effort: if it fails, the analysis is still returned.
    """
    if file.size is not None and file.size > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Media too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB). "
                "Resize it and try again."
            ),
        )

    # Reject anything that is not a supported image/video MIME up front -
    # a clean 415 instead of a confusing model failure.
    media_type = _media_type_of(file)
    if media_type not in _ALLOWED_MEDIA_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                "Unsupported media type. Upload a JPG, PNG, or WEBP image, "
                "or an MP4, MOV, or WEBM video."
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

        # Run the LangGraph pipeline (vision -> location -> routing) as a
        # Server-Sent Events stream so the client can show live stage text:
        # a "stage" event fires as each agent COMPLETES (so the next stage
        # is the one now running), then a "done" event carries the full
        # JSON. If a proxy buffers the whole response, the client still
        # works: it receives every event at once and resolves on "done".
        def sse(event: str, data: dict) -> str:
            return (
                f"event: {event}\n"
                f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
            )

        async def event_stream():
            state: dict = {}
            try:
                # The first real stage is the vision agent - it is the
                # slowest (30-60 s on a real image), so announce it first.
                yield sse("stage", {"stage": "vision"})
                async for update in get_complaint_workflow().astream(
                    {
                        "image_path": tmp_path,
                        "content_type": file.content_type or "image/jpeg",
                        "lat": lat,
                        "lng": lng,
                        "mode": "analyze",
                    },
                    stream_mode="updates",
                ):
                    for node_name, payload in update.items():
                        if isinstance(payload, dict):
                            state.update(payload)
                        # Each node yields when it finishes, so the stage
                        # event announces the NEXT agent as the active one.
                        if node_name == "vision":
                            yield sse("stage", {"stage": "location"})
                        elif node_name == "location":
                            yield sse("stage", {"stage": "routing"})
                        # "routing" is the last node in analyze mode.

                errors = state.get("errors") or {}
                if errors:
                    print(f"Workflow best-effort errors: {errors}")
                yield sse(
                    "done",
                    {
                        "success": True,
                        "analysis": state.get("vision"),
                        "location": state.get("location"),
                        "routing": state.get("routing"),
                    },
                )
            except Exception as exc:
                # AI providers fail for many reasons (missing key, quota,
                # bad model output) - a clean error event mirrors the old
                # 502/503 semantics (the stream status is already 200).
                lowered = str(exc).lower()
                if "capacity" in lowered or "overloaded" in lowered:
                    message = (
                        "The AI analysis service is currently at capacity. "
                        "Please wait a minute and try again."
                    )
                else:
                    message = f"AI analysis failed: {exc}"
                yield sse("error", {"message": message})
            finally:
                if tmp_path is not None:
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception:
        # A failure above (realistically only the upload write) means the
        # request never became a stream - clean up and re-raise. Once the
        # response streams, all failures are handled inside event_stream(),
        # which also removes tmp_path in its finally block.
        if tmp_path is not None:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        raise


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

    Before anything is created the report is checked for duplicates: if the
    same issue type already has an OPEN complaint within 50 m of the given
    coordinates, a ``409 Conflict`` is returned (detail carries the existing
    tracking ID + a message) and no record, tracking ID, or upload is made.
    Reports without a GPS fix skip the check - proximity cannot be judged.
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
        # Validate the full record first (Pydantic), so malformed AI output
        # never uploads media or mints a tracking ID for a row that cannot
        # exist.
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

        # Duplicate detection: before minting an ID or uploading media, check
        # whether this issue was already reported. Same issue type + within
        # 50 m + still open (unresolved) => refuse the second record and hand
        # the citizen the existing tracking ID so they can follow that
        # complaint instead of fragmenting the report. Skipped when the
        # report has no GPS fix (find_duplicate_complaint returns None).
        duplicate = await db.find_duplicate_complaint(
            issue_type=issue_type,
            lat=lat,
            lng=lng,
        )
        if duplicate is not None:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "This issue has already been reported nearby.",
                    "duplicate": {
                        "tracking_id": duplicate.get("tracking_id"),
                        "issue_type": duplicate.get("issue_type"),
                        "severity": duplicate.get("severity"),
                        "status": duplicate.get("status"),
                        "ward": duplicate.get("ward"),
                        "created_at": duplicate.get("created_at"),
                    },
                },
            )

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

        record["tracking_id"] = tracking_id
        record["image_url"] = image_url
        return await db.insert_complaint(record)
    except HTTPException:
        # A deliberate refusal (the 409 duplicate above) must pass through
        # untouched - not be rewritten into a 502 by the generic handler.
        raise
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


@router.patch("/{tracking_id}/status")
async def update_complaint_status(tracking_id: str, body: StatusUpdate):
    """Advance a complaint's lifecycle status (GHMC portal action).

    The citizen's copy of the row on GET /complaints/{tracking_id} (the
    /track page) reflects the new status immediately, which closes the
    loop: file on /report, work it on /ghmc, watch it on /track.
    """
    try:
        row = await db.update_complaint_status(tracking_id, body.status)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - surface real Supabase errors
        raise HTTPException(
            status_code=502,
            detail=f"Could not update complaint: {exc}",
        ) from exc

    if row is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No complaint found with tracking ID '{tracking_id}'. "
                "If it exists, re-run backend/supabase/schema.sql - the "
                "update policy must be created before statuses can change."
            ),
        )
    return row