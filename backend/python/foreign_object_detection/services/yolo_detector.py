"""
YOLO-based foreign object detector.

Loads an ONNX model and runs inference on food packaging images.
Designed for YOLOv11n exported to ONNX format.
"""

import logging
import os
import time
from pathlib import Path
from typing import Dict, List, Optional, Any

import numpy as np

logger = logging.getLogger(__name__)

# Default class names for food foreign object detection (V1: 6 classes)
DEFAULT_CLASSES = ["insect", "color_anomaly", "bone", "glass", "hair", "mold"]

# Per-class confidence thresholds (optimized via 16_optimize_thresholds.py)
# glass needs higher threshold to suppress false positives from overly-broad V1 labels
PER_CLASS_THRESHOLDS = {
    "insect": 0.40,        # V4-optimized on V2 val: F1=0.847
    "color_anomaly": 0.30,  # V4-optimized: F1=0.902 (+14.3% vs V2)
    "bone": 0.20,           # V4-optimized: F1=0.585
    "glass": 0.35,          # V4-optimized: F1=0.748, real-world needs high threshold
    "hair": 0.45,           # V4-optimized: F1=0.899 (+12.7% vs V2)
    "mold": 0.55,           # V4-optimized: F1=0.982
}

# Per-class IoU thresholds for class-aware NMS
# glass: strict IoU to aggressively suppress overlapping FPs
# hair: relaxed IoU since hair detections rarely overlap
PER_CLASS_NMS_IOU = {
    "insect": 0.45,
    "color_anomaly": 0.45,
    "bone": 0.45,
    "glass": 0.3,         # Strict: suppress overlapping glass FPs
    "hair": 0.6,          # Relaxed: thin objects rarely overlap
    "mold": 0.45,
}


class YOLODetector:
    """YOLO ONNX inference for foreign object detection."""

    def __init__(
        self,
        model_path: Optional[str] = None,
        confidence_threshold: float = 0.3,
        iou_threshold: float = 0.45,
        input_size: int = 640,
        class_names: Optional[List[str]] = None,
    ):
        self.model_path = model_path or os.getenv(
            "FOD_MODEL_PATH",
            str(Path(__file__).parent.parent / "models" / "fod_yolov11n.onnx"),
        )
        self.confidence_threshold = confidence_threshold
        self.iou_threshold = iou_threshold
        self.input_size = input_size
        self.class_names = class_names or DEFAULT_CLASSES
        self._session = None
        self._available = False

        self._try_load_model()

    def _try_load_model(self):
        """Try to load ONNX model. Gracefully handle missing model file."""
        if not os.path.exists(self.model_path):
            logger.warning(
                f"YOLO model not found at {self.model_path}. "
                "Detector will return empty results until a model is provided."
            )
            return

        try:
            import onnxruntime as ort

            # Prefer GPU (CUDA) if available, fall back to CPU
            available_providers = ort.get_available_providers()
            if "CUDAExecutionProvider" in available_providers:
                providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
                provider_label = "CUDA+CPU"
            else:
                providers = ["CPUExecutionProvider"]
                provider_label = "CPU"

            self._session = ort.InferenceSession(
                self.model_path,
                providers=providers,
            )
            self._available = True
            actual_provider = self._session.get_providers()[0]
            logger.info(
                f"YOLO model loaded: {self.model_path} "
                f"({len(self.class_names)} classes, threshold={self.confidence_threshold}, "
                f"provider={actual_provider})"
            )
        except ImportError:
            logger.warning(
                "onnxruntime not installed. Run: "
                "pip install onnxruntime-gpu  (for CUDA) or pip install onnxruntime (CPU only)"
            )
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")

    @property
    def is_available(self) -> bool:
        return self._available

    def detect(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Run YOLO inference on a single image.

        Args:
            image_bytes: Raw image bytes (JPEG/PNG).

        Returns:
            {
                "detected": bool,
                "objects": [{"class": str, "confidence": float, "bbox": [x1,y1,x2,y2]}],
                "inference_ms": float,
                "model": str
            }
        """
        if not self._available:
            return {
                "detected": False,
                "objects": [],
                "inference_ms": 0,
                "model": "none",
                "error": "model_not_loaded",
            }

        t0 = time.perf_counter()

        # Decode image
        img, orig_h, orig_w = self._decode_image(image_bytes)

        # Preprocess: resize + normalize + NCHW
        input_tensor = self._preprocess(img)

        # Run inference
        input_name = self._session.get_inputs()[0].name
        outputs = self._session.run(None, {input_name: input_tensor})

        # Postprocess: NMS + rescale boxes
        detections = self._postprocess(outputs, orig_w, orig_h)

        elapsed_ms = (time.perf_counter() - t0) * 1000

        return {
            "detected": len(detections) > 0,
            "objects": detections,
            "inference_ms": round(elapsed_ms, 1),
            "model": os.path.basename(self.model_path),
        }

    def detect_with_sahi(
        self, image_bytes: bytes, slice_size: int = 640, overlap: float = 0.2
    ) -> Dict[str, Any]:
        """
        Run SAHI (Slicing Aided Hyper Inference) for better small object detection.

        Splits the image into overlapping tiles, runs detection on each,
        then merges results with NMS to remove duplicate detections.
        Particularly useful for hair-class objects which are small.

        Args:
            image_bytes: Raw image bytes
            slice_size: Size of each tile (pixels)
            overlap: Overlap ratio between tiles (0.0-0.5)

        Returns:
            Same format as detect(), with additional "sahi": true field
        """
        if not self._available:
            return {
                "detected": False, "objects": [], "inference_ms": 0,
                "model": "none", "error": "model_not_loaded",
            }

        t0 = time.perf_counter()

        # Decode full image
        img, orig_h, orig_w = self._decode_image(image_bytes)

        # 1. Run standard full-image detection
        full_result = self.detect(image_bytes)
        all_detections = list(full_result.get("objects", []))

        # 2. Run sliced detection
        stride = int(slice_size * (1 - overlap))
        for y0 in range(0, orig_h, stride):
            for x0 in range(0, orig_w, stride):
                y1 = min(y0 + slice_size, orig_h)
                x1 = min(x0 + slice_size, orig_w)

                # Skip tiny edge slices
                if (x1 - x0) < slice_size * 0.5 or (y1 - y0) < slice_size * 0.5:
                    continue

                tile = img[y0:y1, x0:x1]

                # Preprocess tile
                input_tensor = self._preprocess(tile)

                # Run inference on tile
                input_name = self._session.get_inputs()[0].name
                outputs = self._session.run(None, {input_name: input_tensor})

                # Postprocess with tile dimensions
                tile_h, tile_w = tile.shape[:2]
                tile_dets = self._postprocess(outputs, tile_w, tile_h)

                # Offset bboxes back to full image coordinates
                for det in tile_dets:
                    det["bbox"][0] += x0
                    det["bbox"][1] += y0
                    det["bbox"][2] += x0
                    det["bbox"][3] += y0
                    all_detections.append(det)

        # 3. Merge with class-aware NMS across all detections
        if len(all_detections) > 1:
            boxes = np.array([d["bbox"] for d in all_detections])
            scores = np.array([d["confidence"] for d in all_detections])
            class_ids = np.array([d["class_id"] for d in all_detections])
            keep = self._class_aware_nms(boxes, scores, class_ids)
            all_detections = [all_detections[i] for i in keep]

        elapsed_ms = (time.perf_counter() - t0) * 1000

        return {
            "detected": len(all_detections) > 0,
            "objects": all_detections,
            "inference_ms": round(elapsed_ms, 1),
            "model": os.path.basename(self.model_path),
            "sahi": True,
        }

    def detect_batch(self, images: List[bytes]) -> List[Dict[str, Any]]:
        """Run detection on multiple images sequentially."""
        return [self.detect(img) for img in images]

    def _decode_image(self, image_bytes: bytes):
        """Decode image bytes to numpy array (H, W, 3) RGB."""
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        arr = np.array(img)
        return arr, arr.shape[0], arr.shape[1]

    def _preprocess(self, img: np.ndarray) -> np.ndarray:
        """Resize, normalize, transpose to (1, 3, H, W) float32."""
        from PIL import Image

        # Letterbox resize maintaining aspect ratio
        h, w = img.shape[:2]
        scale = min(self.input_size / h, self.input_size / w)
        new_h, new_w = int(h * scale), int(w * scale)

        pil_img = Image.fromarray(img).resize((new_w, new_h), Image.BILINEAR)
        resized = np.array(pil_img)

        # Pad to input_size x input_size
        padded = np.full((self.input_size, self.input_size, 3), 114, dtype=np.uint8)
        padded[:new_h, :new_w, :] = resized

        # Normalize to [0, 1] and transpose to NCHW
        blob = padded.astype(np.float32) / 255.0
        blob = blob.transpose(2, 0, 1)  # HWC -> CHW
        blob = np.expand_dims(blob, 0)  # Add batch dim
        return blob

    def _postprocess(
        self, outputs: list, orig_w: int, orig_h: int
    ) -> List[Dict[str, Any]]:
        """
        Parse YOLO output, apply NMS, rescale to original image coordinates.

        YOLOv8/v11 ONNX output shape: (1, num_classes+4, num_detections)
        - First 4 rows: cx, cy, w, h
        - Remaining rows: class scores
        """
        output = outputs[0]  # (1, 4+num_classes, N)

        if output.ndim == 3:
            output = output[0]  # (4+num_classes, N)

        # Transpose if needed: (4+C, N) -> (N, 4+C)
        if output.shape[0] < output.shape[1]:
            output = output.T

        num_detections = output.shape[0]
        num_classes = output.shape[1] - 4

        boxes_cxcywh = output[:, :4]
        class_scores = output[:, 4:]

        # Get best class per detection
        class_ids = np.argmax(class_scores, axis=1)
        confidences = class_scores[np.arange(num_detections), class_ids]

        # Apply per-class confidence thresholds
        mask = np.zeros(len(confidences), dtype=bool)
        for i in range(len(confidences)):
            cls_id = int(class_ids[i])
            cls_name = (self.class_names[cls_id]
                        if cls_id < len(self.class_names) else f"class_{cls_id}")
            threshold = PER_CLASS_THRESHOLDS.get(cls_name, self.confidence_threshold)
            mask[i] = confidences[i] >= threshold

        boxes_cxcywh = boxes_cxcywh[mask]
        confidences = confidences[mask]
        class_ids = class_ids[mask]

        if len(boxes_cxcywh) == 0:
            return []

        # Convert cx,cy,w,h -> x1,y1,x2,y2
        boxes_xyxy = np.zeros_like(boxes_cxcywh)
        boxes_xyxy[:, 0] = boxes_cxcywh[:, 0] - boxes_cxcywh[:, 2] / 2
        boxes_xyxy[:, 1] = boxes_cxcywh[:, 1] - boxes_cxcywh[:, 3] / 2
        boxes_xyxy[:, 2] = boxes_cxcywh[:, 0] + boxes_cxcywh[:, 2] / 2
        boxes_xyxy[:, 3] = boxes_cxcywh[:, 1] + boxes_cxcywh[:, 3] / 2

        # Class-aware NMS: run NMS independently per class with per-class IoU
        keep = self._class_aware_nms(boxes_xyxy, confidences, class_ids)
        boxes_xyxy = boxes_xyxy[keep]
        confidences = confidences[keep]
        class_ids = class_ids[keep]

        # Rescale from input_size to original image
        scale = min(self.input_size / orig_h, self.input_size / orig_w)
        boxes_xyxy /= scale

        # Clip to image bounds
        boxes_xyxy[:, 0] = np.clip(boxes_xyxy[:, 0], 0, orig_w)
        boxes_xyxy[:, 1] = np.clip(boxes_xyxy[:, 1], 0, orig_h)
        boxes_xyxy[:, 2] = np.clip(boxes_xyxy[:, 2], 0, orig_w)
        boxes_xyxy[:, 3] = np.clip(boxes_xyxy[:, 3], 0, orig_h)

        detections = []
        for i in range(len(boxes_xyxy)):
            cls_id = int(class_ids[i])
            cls_name = (
                self.class_names[cls_id]
                if cls_id < len(self.class_names)
                else f"class_{cls_id}"
            )
            detections.append(
                {
                    "class": cls_name,
                    "class_id": cls_id,
                    "confidence": round(float(confidences[i]), 3),
                    "bbox": [round(float(v), 1) for v in boxes_xyxy[i]],
                }
            )

        # Post-processing: filter out implausible detections
        detections = self._filter_implausible(detections, orig_w, orig_h)

        # Sort by confidence descending
        detections.sort(key=lambda d: d["confidence"], reverse=True)
        return detections

    @staticmethod
    def _filter_implausible(
        detections: List[Dict], img_w: int, img_h: int
    ) -> List[Dict]:
        """Filter out implausible detections based on physical constraints.

        Rules:
        - glass/bone/hair: bbox area > 30% of image → likely FP (real fragments are small)
        - Any class: bbox area > 60% of image → always FP
        - glass: very low aspect ratio boxes (thin horizontal lines) → packaging reflection
        """
        img_area = img_w * img_h
        filtered = []
        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            det_area = (x2 - x1) * (y2 - y1)
            area_ratio = det_area / img_area if img_area > 0 else 0

            cls_name = det["class"]

            # Rule 1: Any detection > 60% of image is FP
            if area_ratio > 0.6:
                continue

            # Rule 2: glass/bone/hair > 30% of image is FP
            if cls_name in ("glass", "bone", "hair") and area_ratio > 0.3:
                continue

            # Rule 3: glass with extreme aspect ratio (likely packaging edge reflection)
            if cls_name == "glass":
                w = x2 - x1
                h = y2 - y1
                aspect = max(w, h) / (min(w, h) + 1e-6)
                if aspect > 10 and det["confidence"] < 0.5:
                    continue

            filtered.append(det)

        return filtered

    def _class_aware_nms(
        self, boxes: np.ndarray, scores: np.ndarray, class_ids: np.ndarray
    ) -> List[int]:
        """Class-aware NMS: run NMS per class with class-specific IoU thresholds."""
        keep = []
        unique_classes = np.unique(class_ids)

        for cls_id in unique_classes:
            cls_mask = class_ids == cls_id
            cls_indices = np.where(cls_mask)[0]

            cls_name = (self.class_names[int(cls_id)]
                        if int(cls_id) < len(self.class_names) else f"class_{int(cls_id)}")
            iou_thresh = PER_CLASS_NMS_IOU.get(cls_name, self.iou_threshold)

            cls_boxes = boxes[cls_indices]
            cls_scores = scores[cls_indices]

            cls_keep = self._nms(cls_boxes, cls_scores, iou_thresh)
            keep.extend(cls_indices[k] for k in cls_keep)

        keep.sort()
        return keep

    @staticmethod
    def _nms(
        boxes: np.ndarray, scores: np.ndarray, iou_threshold: float
    ) -> List[int]:
        """Non-Maximum Suppression."""
        x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
        areas = (x2 - x1) * (y2 - y1)
        order = scores.argsort()[::-1]

        keep = []
        while order.size > 0:
            i = order[0]
            keep.append(i)

            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])

            inter = np.maximum(0, xx2 - xx1) * np.maximum(0, yy2 - yy1)
            iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-6)

            inds = np.where(iou <= iou_threshold)[0]
            order = order[inds + 1]

        return keep

    def reload_model(self, model_path: str):
        """Hot-reload a new model without restarting the service."""
        self.model_path = model_path
        self._session = None
        self._available = False
        self._try_load_model()
