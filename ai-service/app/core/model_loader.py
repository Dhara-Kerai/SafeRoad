import os
import logging
from pathlib import Path
from ultralytics import YOLO

logger = logging.getLogger("uvicorn.error")

class YOLOModelLoader:
    _model = None
    _is_loaded = False
    _model_name: str | None = None
    _load_error: str | None = None

    @classmethod
    def reset(cls) -> None:
        """Reset cached model state for testing."""
        cls._model = None
        cls._is_loaded = False
        cls._model_name = None
        cls._load_error = None

    @classmethod
    def get_model_path(cls) -> Path:
        env_model_path = os.getenv("MODEL_PATH")
        if env_model_path:
            return Path(env_model_path).resolve()

        ai_service_dir = Path(__file__).resolve().parents[2]
        custom_model_path = ai_service_dir / "models" / "best.pt"
        if not custom_model_path.exists():
            custom_model_path = Path.cwd() / "models" / "best.pt"
        return custom_model_path

    @classmethod
    def get_model(cls) -> YOLO | None:
        if cls._is_loaded:
            return cls._model

        custom_model_path = cls.get_model_path()

        if not custom_model_path.exists():
            cls._model = None
            cls._model_name = None
            cls._is_loaded = True
            cls._load_error = f"Required custom pothole model (best.pt) not found at {custom_model_path}. Generic fallback is strictly disallowed."
            logger.error(f"[AI Service] FAIL-CLOSED: {cls._load_error}")
            return None

        try:
            logger.info(f"[AI Service] Loading custom YOLO model from {custom_model_path}...")
            cls._model = YOLO(str(custom_model_path))
            cls._model_name = "best.pt"
            cls._is_loaded = True
            cls._load_error = None
            logger.info("[AI Service] Custom YOLO model (best.pt) loaded successfully.")
            return cls._model
        except Exception as e:
            cls._model = None
            cls._model_name = None
            cls._is_loaded = True
            cls._load_error = f"Failed to load custom model from {custom_model_path}: {e}"
            logger.error(f"[AI Service] FAIL-CLOSED: {cls._load_error}")
            return None

    @classmethod
    def get_model_name(cls) -> str | None:
        return cls._model_name

    @classmethod
    def get_load_error(cls) -> str | None:
        return cls._load_error

    @classmethod
    def is_custom_model_loaded(cls) -> bool:
        return cls._model is not None and cls._model_name == "best.pt"

