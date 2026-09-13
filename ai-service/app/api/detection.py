import hmac
import os

from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Header, HTTPException, status
from fastapi.responses import FileResponse
from app.schemas.detection import DetectionResponse
from app.services.detection_service import DetectionService
from app.core.model_loader import YOLOModelLoader

router = APIRouter(prefix="/detection", tags=["detection"])

@router.post(
    "/detect", 
    response_model=DetectionResponse, 
    summary="Perform pothole detection", 
    description="Uploads an image, validates size and format integrity, runs YOLOv8 model inference, labels pothole severity (Low/Medium/High) by relative bounding box surface size, and returns coordinates along with the annotated image URL."
)
async def detect_potholes(
    image: UploadFile = File(..., description="The road image file to analyze"),
    x_internal_api_key: str | None = Header(default=None),
):
    expected_key = os.getenv("AI_INTERNAL_API_KEY")
    if not expected_key or not x_internal_api_key or not hmac.compare_digest(x_internal_api_key, expected_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )

    model = YOLOModelLoader.get_model()
    if model is None or not YOLOModelLoader.is_custom_model_loaded():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Custom pothole model (best.pt) is unavailable",
        )

    result = DetectionService.run_detection(image)
    return result

@router.get("/artifacts/{filename}")
async def get_artifact(
    filename: str,
    x_internal_api_key: str | None = Header(default=None),
):
    expected_key = os.getenv("AI_INTERNAL_API_KEY")
    if not expected_key or not x_internal_api_key or not hmac.compare_digest(x_internal_api_key, expected_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )

    # Prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=404, detail="Artifact not found")

    uploads_dir = Path(__file__).resolve().parents[2] / "uploads"
    safe_path = (uploads_dir / filename).resolve()
    if not str(safe_path).startswith(str(uploads_dir.resolve())) or not safe_path.exists() or not safe_path.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found")

    return FileResponse(str(safe_path))

