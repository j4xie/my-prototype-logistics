"""
Dual-layer detection pipeline: YOLO screening + VL review.

Confidence routing:
  - YOLO confidence > high_threshold  → REJECT (foreign object confirmed)
  - YOLO confidence in [low, high]    → send to VL for review
  - YOLO confidence < low_threshold   → PASS (no foreign object)
  - YOLO detects nothing              → PASS
"""

import logging
import os
import time
from typing import Dict, Any, List, Optional

from .yolo_detector import YOLODetector
from .vl_reviewer import VLReviewer

logger = logging.getLogger(__name__)


class DetectionPipeline:
    """Orchestrates YOLO + VL dual-layer foreign object detection."""

    def __init__(
        self,
        yolo: Optional[YOLODetector] = None,
        vl: Optional[VLReviewer] = None,
        high_threshold: float = 0.7,
        low_threshold: float = 0.3,
    ):
        self.yolo = yolo or YOLODetector()
        self.vl = vl or VLReviewer()
        self.high_threshold = float(
            os.getenv("FOD_HIGH_THRESHOLD", str(high_threshold))
        )
        self.low_threshold = float(
            os.getenv("FOD_LOW_THRESHOLD", str(low_threshold))
        )

        logger.info(
            f"Detection pipeline initialized: "
            f"YOLO={'ready' if self.yolo.is_available else 'no model'}, "
            f"VL={'ready' if self.vl.is_available else 'no key'}, "
            f"thresholds=[{self.low_threshold}, {self.high_threshold}]"
        )

    async def detect(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Run the full detection pipeline on a single image.

        Returns:
            {
                "verdict": "REJECT" | "PASS" | "REVIEW",
                "detected": bool,
                "objects": [...],
                "yolo_result": {...},
                "vl_result": {...} | None,
                "pipeline_ms": float,
                "routing": "yolo_high" | "yolo_pass" | "vl_confirmed" | "vl_cleared" | "yolo_only"
            }
        """
        t0 = time.perf_counter()

        # Step 1: YOLO screening
        yolo_result = self.yolo.detect(image_bytes)

        # If YOLO model not loaded, fall back to VL-only
        if yolo_result.get("error") == "model_not_loaded":
            if self.vl.is_available:
                vl_result = await self.vl.review(image_bytes, [])
                elapsed = (time.perf_counter() - t0) * 1000
                return {
                    "verdict": "REJECT" if vl_result["confirmed"] else "PASS",
                    "detected": vl_result["confirmed"],
                    "objects": vl_result.get("objects", []),
                    "yolo_result": yolo_result,
                    "vl_result": vl_result,
                    "pipeline_ms": round(elapsed, 1),
                    "routing": "vl_fallback",
                }
            else:
                elapsed = (time.perf_counter() - t0) * 1000
                return {
                    "verdict": "PASS",
                    "detected": False,
                    "objects": [],
                    "yolo_result": yolo_result,
                    "vl_result": None,
                    "pipeline_ms": round(elapsed, 1),
                    "routing": "no_model",
                    "error": "Neither YOLO model nor VL API configured",
                }

        # No detections → PASS
        if not yolo_result["detected"]:
            elapsed = (time.perf_counter() - t0) * 1000
            return {
                "verdict": "PASS",
                "detected": False,
                "objects": [],
                "yolo_result": yolo_result,
                "vl_result": None,
                "pipeline_ms": round(elapsed, 1),
                "routing": "yolo_pass",
            }

        # Check max confidence among detections
        max_conf = max(d["confidence"] for d in yolo_result["objects"])

        # High confidence → REJECT directly
        if max_conf >= self.high_threshold:
            elapsed = (time.perf_counter() - t0) * 1000
            return {
                "verdict": "REJECT",
                "detected": True,
                "objects": yolo_result["objects"],
                "yolo_result": yolo_result,
                "vl_result": None,
                "pipeline_ms": round(elapsed, 1),
                "routing": "yolo_high",
            }

        # Low confidence → PASS
        if max_conf < self.low_threshold:
            elapsed = (time.perf_counter() - t0) * 1000
            return {
                "verdict": "PASS",
                "detected": False,
                "objects": [],
                "yolo_result": yolo_result,
                "vl_result": None,
                "pipeline_ms": round(elapsed, 1),
                "routing": "yolo_low",
            }

        # Uncertain range → VL review
        if self.vl.is_available:
            vl_result = await self.vl.review(image_bytes, yolo_result["objects"])
            elapsed = (time.perf_counter() - t0) * 1000

            if vl_result["confirmed"]:
                # Merge VL objects with YOLO objects
                all_objects = yolo_result["objects"] + [
                    {"class": o.get("type", "unknown"), "confidence": 0.5, "source": "vl", **o}
                    for o in vl_result.get("objects", [])
                ]
                return {
                    "verdict": "REJECT",
                    "detected": True,
                    "objects": all_objects,
                    "yolo_result": yolo_result,
                    "vl_result": vl_result,
                    "pipeline_ms": round(elapsed, 1),
                    "routing": "vl_confirmed",
                }
            else:
                return {
                    "verdict": "PASS",
                    "detected": False,
                    "objects": [],
                    "yolo_result": yolo_result,
                    "vl_result": vl_result,
                    "pipeline_ms": round(elapsed, 1),
                    "routing": "vl_cleared",
                }

        # VL not available, treat uncertain as REVIEW
        elapsed = (time.perf_counter() - t0) * 1000
        return {
            "verdict": "REVIEW",
            "detected": True,
            "objects": yolo_result["objects"],
            "yolo_result": yolo_result,
            "vl_result": None,
            "pipeline_ms": round(elapsed, 1),
            "routing": "yolo_uncertain_no_vl",
        }

    async def detect_batch(self, images: List[bytes]) -> Dict[str, Any]:
        """Run pipeline on multiple images, return aggregate result."""
        results = []
        for img in images:
            r = await self.detect(img)
            results.append(r)

        # Batch is REJECT if any image is REJECT
        any_reject = any(r["verdict"] == "REJECT" for r in results)
        any_review = any(r["verdict"] == "REVIEW" for r in results)
        total_ms = sum(r["pipeline_ms"] for r in results)

        all_objects = []
        for i, r in enumerate(results):
            for obj in r.get("objects", []):
                obj["image_index"] = i
                all_objects.append(obj)

        return {
            "verdict": "REJECT" if any_reject else ("REVIEW" if any_review else "PASS"),
            "detected": any_reject or any_review,
            "total_images": len(images),
            "reject_count": sum(1 for r in results if r["verdict"] == "REJECT"),
            "pass_count": sum(1 for r in results if r["verdict"] == "PASS"),
            "review_count": sum(1 for r in results if r["verdict"] == "REVIEW"),
            "objects": all_objects,
            "pipeline_ms": round(total_ms, 1),
            "per_image": results,
        }

    async def close(self):
        await self.vl.close()
