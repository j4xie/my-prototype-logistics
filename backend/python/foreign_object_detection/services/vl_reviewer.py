"""
VL model reviewer stub.

Uncertain YOLO detections are flagged for manual review via Claude Code
conversation instead of calling any external VL API.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class VLReviewer:
    """Stub reviewer — flags uncertain detections for manual review."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        logger.info("VL Reviewer: manual review mode (no external API)")

    @property
    def is_available(self) -> bool:
        return True

    async def review(
        self,
        image_bytes: bytes,
        yolo_detections: list,
    ) -> Dict[str, Any]:
        """Flag detection for manual review instead of calling an API."""
        return {
            "confirmed": True if yolo_detections else False,
            "objects": [
                {
                    "type": d.get("class", "unknown"),
                    "risk": "MEDIUM",
                    "desc": "需人工复核 (manual review required)",
                }
                for d in (yolo_detections or [])
            ],
            "review_ms": 0,
            "mode": "manual_review",
        }

    async def close(self):
        pass
