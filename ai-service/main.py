import hmac
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file if present
env_path = Path(__file__).resolve().parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

from fastapi import FastAPI, File, UploadFile, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from app.api.detection import router as detection_router
from app.core.model_loader import YOLOModelLoader
from app.services.detection_service import DetectionService

app = FastAPI(
    title="SafeRoad AI Microservice",
    description="FastAPI AI service for automated road damage diagnostics",
    version="1.0.0"
)

# Configure CORS for React frontend and Node.js backend accessibility
raw_origins = os.getenv("CORS_ORIGIN", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://localhost:8000")
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "service": "SafeRoad AI",
        "status": "running"
    }

@app.get("/health")
async def health():
    model = YOLOModelLoader.get_model()
    if model is None or not YOLOModelLoader.is_custom_model_loaded():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "unhealthy",
                "model_loaded": False,
                "model": YOLOModelLoader.get_model_name(),
                "reason": YOLOModelLoader.get_load_error() or "Required custom pothole model (best.pt) failed to load"
            }
        )
    return {
        "status": "healthy",
        "model_loaded": True,
        "model": YOLOModelLoader.get_model_name()
    }

@app.post("/detect")
async def detect_potholes_legacy(
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
    detected = result.get("total_detections", 0) > 0
    detections = result.get("detections", [])
    primary = detections[0] if detections else None
    return {
        "detected": detected,
        "confidence": primary["confidence"] if primary else 0.0,
        "boundingBox": primary["box"] if primary else [],
        "severity": primary["severity"] if primary else "Low"
    }

# Mount sub-routers under /api prefix
app.include_router(detection_router, prefix="/api")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
