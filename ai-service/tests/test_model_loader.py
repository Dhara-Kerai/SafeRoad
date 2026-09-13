import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import unittest
import asyncio
from unittest.mock import patch
from fastapi import HTTPException

from app.core.model_loader import YOLOModelLoader
from main import health

class TestYOLOModelLoader(unittest.TestCase):
    def setUp(self):
        YOLOModelLoader.reset()

    def tearDown(self):
        YOLOModelLoader.reset()

    def test_valid_best_model_loads(self):
        """Test that the custom best.pt model loads successfully."""
        model = YOLOModelLoader.get_model()
        self.assertIsNotNone(model, "Expected custom model best.pt to load")
        self.assertEqual(YOLOModelLoader.get_model_name(), "best.pt")
        self.assertTrue(YOLOModelLoader.is_custom_model_loaded())
        self.assertIsNone(YOLOModelLoader.get_load_error())

    def test_missing_model_causes_failure_and_never_falls_back_to_yolov8n(self):
        """Test that missing model fails closed and never loads generic yolov8n.pt."""
        with patch.dict(os.environ, {"MODEL_PATH": "/nonexistent/path/best.pt"}):
            YOLOModelLoader.reset()
            model = YOLOModelLoader.get_model()
            self.assertIsNone(model, "Model must fail to load when weights are missing")
            self.assertFalse(YOLOModelLoader.is_custom_model_loaded())
            self.assertNotEqual(YOLOModelLoader.get_model_name(), "yolov8n.pt", "Generic YOLO weights must NEVER be used as fallback")
            self.assertIn("not found", (YOLOModelLoader.get_load_error() or "").lower())

    def test_health_reports_healthy_when_custom_model_is_loaded(self):
        """Test that health() reports healthy when custom model is loaded."""
        data = asyncio.run(health())
        self.assertEqual(data["status"], "healthy")
        self.assertTrue(data["model_loaded"])
        self.assertEqual(data["model"], "best.pt")

    def test_health_reports_unhealthy_when_custom_model_is_unavailable(self):
        """Test that health() raises 503 when custom model cannot load."""
        with patch.dict(os.environ, {"MODEL_PATH": "/nonexistent/path/best.pt"}):
            YOLOModelLoader.reset()
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(health())
            self.assertEqual(ctx.exception.status_code, 503)
            detail = ctx.exception.detail
            self.assertEqual(detail.get("status"), "unhealthy")
            self.assertFalse(detail.get("model_loaded"))

if __name__ == "__main__":
    unittest.main()
