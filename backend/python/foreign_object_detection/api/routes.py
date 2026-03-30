"""
Foreign Object Detection API endpoints.

Routes:
  POST /detect           — Single image detection (dual-layer pipeline)
  POST /detect-batch     — Batch detection (multiple images)
  GET  /status           — Model and pipeline status
  POST /reload-model     — Hot-reload YOLO model
"""

import base64
import logging
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Foreign Object Detection"])

# Lazy-initialized pipeline singleton
_pipeline = None


def get_pipeline():
    global _pipeline
    if _pipeline is None:
        from ..services import YOLODetector, VLReviewer, DetectionPipeline

        yolo = YOLODetector()
        vl = VLReviewer()
        _pipeline = DetectionPipeline(yolo=yolo, vl=vl)
    return _pipeline


# --- Response Models ---


class DetectionObject(BaseModel):
    class_name: str = Field(..., alias="class", description="Object class name")
    confidence: float = Field(..., description="Detection confidence 0-1")
    bbox: Optional[List[float]] = Field(None, description="[x1, y1, x2, y2]")

    class Config:
        populate_by_name = True


class DetectResponse(BaseModel):
    success: bool
    timestamp: str
    verdict: Optional[str] = None  # REJECT / PASS / REVIEW
    detected: Optional[bool] = None
    objects: Optional[list] = None
    pipeline_ms: Optional[float] = None
    routing: Optional[str] = None
    yolo_result: Optional[dict] = None
    vl_result: Optional[dict] = None
    error: Optional[str] = None


class BatchDetectResponse(BaseModel):
    success: bool
    timestamp: str
    verdict: Optional[str] = None
    total_images: Optional[int] = None
    reject_count: Optional[int] = None
    pass_count: Optional[int] = None
    review_count: Optional[int] = None
    objects: Optional[list] = None
    pipeline_ms: Optional[float] = None
    per_image: Optional[list] = None
    error: Optional[str] = None


class StatusResponse(BaseModel):
    success: bool
    timestamp: str
    yolo_available: bool
    yolo_model: Optional[str] = None
    yolo_classes: Optional[List[str]] = None
    vl_available: bool
    vl_model: Optional[str] = None
    high_threshold: float
    low_threshold: float


# --- Endpoints ---


@router.post("/detect", response_model=DetectResponse)
async def detect_foreign_object(
    file: UploadFile = File(..., description="Image file (JPEG/PNG)"),
):
    """
    Detect foreign objects in a single food packaging image.

    Uses YOLO for fast screening, then VL model for uncertain cases.
    Returns verdict: REJECT (foreign object found), PASS (clean), or REVIEW (needs human check).
    """
    pipeline = get_pipeline()

    try:
        image_bytes = await file.read()

        result = await pipeline.detect(image_bytes)

        return DetectResponse(
            success=True,
            timestamp=datetime.now().isoformat(),
            verdict=result["verdict"],
            detected=result["detected"],
            objects=result.get("objects", []),
            pipeline_ms=result["pipeline_ms"],
            routing=result["routing"],
            yolo_result=result.get("yolo_result"),
            vl_result=result.get("vl_result"),
        )
    except Exception as e:
        logger.error(f"Detection failed: {e}", exc_info=True)
        return DetectResponse(
            success=False,
            timestamp=datetime.now().isoformat(),
            error=str(e),
        )


@router.post("/detect-batch", response_model=BatchDetectResponse)
async def detect_foreign_object_batch(
    files: List[UploadFile] = File(..., description="Multiple image files"),
):
    """
    Detect foreign objects in a batch of food packaging images.

    Batch verdict is REJECT if any image contains foreign objects.
    """
    pipeline = get_pipeline()

    try:
        images = [await f.read() for f in files]
        result = await pipeline.detect_batch(images)

        return BatchDetectResponse(
            success=True,
            timestamp=datetime.now().isoformat(),
            verdict=result["verdict"],
            total_images=result["total_images"],
            reject_count=result["reject_count"],
            pass_count=result["pass_count"],
            review_count=result["review_count"],
            objects=result.get("objects", []),
            pipeline_ms=result["pipeline_ms"],
            per_image=result.get("per_image"),
        )
    except Exception as e:
        logger.error(f"Batch detection failed: {e}", exc_info=True)
        return BatchDetectResponse(
            success=False,
            timestamp=datetime.now().isoformat(),
            error=str(e),
        )


@router.post("/detect-base64", response_model=DetectResponse)
async def detect_foreign_object_base64(
    image_base64: str = Form(..., description="Base64-encoded image"),
):
    """Detect foreign objects from a base64-encoded image string."""
    pipeline = get_pipeline()

    try:
        image_bytes = base64.b64decode(image_base64)
        result = await pipeline.detect(image_bytes)

        return DetectResponse(
            success=True,
            timestamp=datetime.now().isoformat(),
            verdict=result["verdict"],
            detected=result["detected"],
            objects=result.get("objects", []),
            pipeline_ms=result["pipeline_ms"],
            routing=result["routing"],
            yolo_result=result.get("yolo_result"),
            vl_result=result.get("vl_result"),
        )
    except Exception as e:
        logger.error(f"Detection failed: {e}", exc_info=True)
        return DetectResponse(
            success=False,
            timestamp=datetime.now().isoformat(),
            error=str(e),
        )


@router.get("/status", response_model=StatusResponse)
async def get_detection_status():
    """Get current status of the detection pipeline."""
    pipeline = get_pipeline()

    return StatusResponse(
        success=True,
        timestamp=datetime.now().isoformat(),
        yolo_available=pipeline.yolo.is_available,
        yolo_model=(
            os.path.basename(pipeline.yolo.model_path)
            if pipeline.yolo.is_available
            else None
        ),
        yolo_classes=pipeline.yolo.class_names if pipeline.yolo.is_available else None,
        vl_available=pipeline.vl.is_available,
        vl_model=pipeline.vl.model if pipeline.vl.is_available else None,
        high_threshold=pipeline.high_threshold,
        low_threshold=pipeline.low_threshold,
    )


@router.post("/reload-model")
async def reload_model(
    model_path: str = Form(..., description="Path to new ONNX model file"),
):
    """Hot-reload a new YOLO model without restarting the service."""
    pipeline = get_pipeline()

    if not os.path.exists(model_path):
        return {
            "success": False,
            "timestamp": datetime.now().isoformat(),
            "error": f"Model file not found: {model_path}",
        }

    pipeline.yolo.reload_model(model_path)

    return {
        "success": pipeline.yolo.is_available,
        "timestamp": datetime.now().isoformat(),
        "model": os.path.basename(model_path),
        "available": pipeline.yolo.is_available,
    }
