import os
import time
import uuid
import cv2
from PIL import Image
from pathlib import Path
from fastapi import UploadFile, HTTPException
from app.core.model_loader import YOLOModelLoader
import logging

logger = logging.getLogger("uvicorn.error")


def get_uploads_directory() -> Path:
    configured_directory = os.getenv("UPLOADS_DIR")
    if configured_directory:
        return Path(configured_directory).expanduser().resolve()

    service_directory = Path(__file__).resolve().parents[2]
    native_shared_directory = service_directory.parent / "backend" / "uploads"
    if native_shared_directory.exists():
        return native_shared_directory

    return Path.cwd() / "uploads"

class DetectionService:
    @staticmethod
    def validate_image(file: UploadFile) -> Image.Image:
        # 1. Validate Extension
        allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}
        filename = file.filename or ""
        ext = os.path.splitext(filename)[1].lower()
        if ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file extension '{ext}'. Allowed extensions are: {', '.join(allowed_extensions)}"
            )

        # 2. Validate MIME type
        allowed_mimes = {"image/jpeg", "image/png", "image/webp"}
        if file.content_type not in allowed_mimes:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid MIME type '{file.content_type}'. Supported image formats are JPEG, PNG, and WEBP."
            )

        # 3. Read content and validate size (10 MB limit)
        max_size = 10 * 1024 * 1024
        try:
            content = file.file.read()
            file.file.seek(0)  # Reset file pointer
            if len(content) > max_size:
                raise HTTPException(
                    status_code=400,
                    detail="File too large. Maximum allowed size is 10 MB."
                )
            if len(content) == 0:
                raise HTTPException(status_code=400, detail="The uploaded file is empty.")
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

        # 4. Validate Corruption
        try:
            from io import BytesIO
            img = Image.open(BytesIO(content))
            img.verify()  # Test if corrupt
            
            # Reopen because verify() closes the stream pointer
            img = Image.open(BytesIO(content))
            return img
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Uploaded image is corrupt or invalid: {str(e)}"
            )

    @staticmethod
    def run_detection(file: UploadFile) -> dict:
        start_time = time.time()
        
        # 1. Validate image structure
        pil_img = DetectionService.validate_image(file)
        
        # 2. Save original image temporarily inside uploads folder
        uploads_dir = get_uploads_directory()
        uploads_dir.mkdir(parents=True, exist_ok=True)
            
        file_ext = os.path.splitext(file.filename or "image.jpg")[1]
        unique_id = uuid.uuid4().hex
        orig_filename = f"orig_{unique_id}{file_ext}"
        orig_path = uploads_dir / orig_filename
        
        pil_img.save(orig_path)
        
        width, height = pil_img.size
        img_area = width * height

        # 3. Request YOLO model instance
        model = YOLOModelLoader.get_model()
        if model is None:
            logger.error("[AI Service] YOLO model not loaded.")
            if os.path.exists(orig_path):
                os.remove(orig_path)
            return {
                "success": False,
                "processing_time": round(time.time() - start_time, 4),
                "width": width,
                "height": height,
                "total_detections": 0,
                "detections": [],
                "annotated_image_path": None,
                "error": "YOLO model not loaded or weights missing."
            }

        # 4. Perform Inference & Annotation
        try:
            # conf=0.25 is standard for fine-tuned object detection (prevents false positives)
            results = model(str(orig_path), conf=0.25)
            detections = []


            
            cv_img = cv2.imread(str(orig_path))
            if cv_img is None:
                raise Exception("OpenCV failed to read the saved image file.")
            result = results[0]
            boxes = result.boxes
            
            for box_data in boxes:
                # Bounding box coords [x1, y1, x2, y2]
                xyxy = box_data.xyxy[0].tolist()
                x1, y1, x2, y2 = xyxy
                
                conf = float(box_data.conf[0])
                class_id = int(box_data.cls[0])
                class_name = model.names.get(class_id, "Pothole")

                if class_name == "0":
                    class_name = "Pothole"
                
                # Center coordinates
                cx = (x1 + x2) / 2.0
                cy = (y1 + y2) / 2.0
                
                # Bounding box area relative to image
                box_w = x2 - x1
                box_h = y2 - y1
                box_area = box_w * box_h
                rel_area = box_area / img_area
                
                # Severity estimation based on relative area
                if rel_area < 0.02:
                    severity = "Low"
                    color = (0, 255, 0)  # Green (BGR)
                elif rel_area < 0.05:
                    severity = "Medium"
                    color = (0, 165, 255)  # Orange (BGR)
                else:
                    severity = "High"
                    color = (0, 0, 255)  # Red (BGR)
                    
                detections.append({
                    "class_name": class_name,
                    "confidence": round(conf, 4),
                    "box": [round(x, 1) for x in xyxy],
                    "center": [round(cx, 1), round(cy, 1)],
                    "severity": severity
                })
                
                # Draw box
                cv2.rectangle(
                    cv_img, 
                    (int(x1), int(y1)), 
                    (int(x2), int(y2)), 
                    color, 
                    3
                )
                
                # Draw text banner
                label_text = f"{class_name} ({round(conf * 100, 1)}%, {severity})"
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.6
                font_thickness = 2
                
                (text_w, text_h), baseline = cv2.getTextSize(label_text, font, font_scale, font_thickness)
                
                # Header background box
                cv2.rectangle(
                    cv_img, 
                    (int(x1), int(y1) - text_h - 10), 
                    (int(x1) + text_w + 10, int(y1)), 
                    color, 
                    -1
                )
                
                # Draw white text
                cv2.putText(
                    cv_img, 
                    label_text, 
                    (int(x1) + 5, int(y1) - 5), 
                    font, 
                    font_scale, 
                    (255, 255, 255), 
                    font_thickness
                )

            # Save annotated output if detections found, otherwise return null
            annotated_image_path = None
            if len(detections) > 0:
                annotated_filename = f"annotated_{unique_id}{file_ext}"
                annotated_path = uploads_dir / annotated_filename
                cv2.imwrite(str(annotated_path), cv_img)
                annotated_image_path = f"/uploads/{annotated_filename}"
            
            # Clean up original image to save space
            if os.path.exists(orig_path):
                os.remove(orig_path)
                
            return {
                "success": True,
                "processing_time": round(time.time() - start_time, 4),
                "width": width,
                "height": height,
                "total_detections": len(detections),
                "detections": detections,
                "annotated_image_path": annotated_image_path,
                "error": None
            }
            
        except Exception as e:
            logger.error(f"Detection failed inside service: {e}")
            if os.path.exists(orig_path):
                os.remove(orig_path)
            return {
                "success": False,
                "processing_time": round(time.time() - start_time, 4),
                "width": width,
                "height": height,
                "total_detections": 0,
                "detections": [],
                "annotated_image_path": None,
                "error": f"Inference execution failed: {str(e)}"
            }
