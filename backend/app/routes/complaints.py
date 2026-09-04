from fastapi import APIRouter, UploadFile, File
import os
import shutil
import uuid

from app.agents.vision_agent import VisionAgent

router = APIRouter(prefix="/complaints", tags=["Complaints"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

vision = VisionAgent()


@router.post("/analyze")
async def analyze_civic_issue(file: UploadFile = File(...)):
    # Create unique filename
    extension = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{extension}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    # Save uploaded image
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # AI Analysis
    result = await vision.analyze(filepath)

    return {
        "success": True,
        "analysis": result
    }