"""Complaint endpoints.

POST /complaints/analyze runs the vision agent over an uploaded photo and
returns structured analysis of the civic issue it shows.

Uploaded images are written to the OS temp directory instead of a
repo-local folder: locally that keeps the working tree clean, and on Vercel
it is required, because the serverless filesystem is read-only except for
the /tmp area.
"""

import os
import shutil
import tempfile

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.agents.vision_agent import VisionAgent

router = APIRouter(prefix="/complaints", tags=["Complaints"])

vision = VisionAgent()


@router.post("/analyze")
async def analyze_civic_issue(file: UploadFile = File(...)):
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

        analysis = await vision.analyze(tmp_path)
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

    return {"success": True, "analysis": analysis}
