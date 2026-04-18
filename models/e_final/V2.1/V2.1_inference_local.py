"""
V2.1 本地推理脚本 — 用于客户在真实产线图上自测 V2.1 性能.

使用方法:
    python V2.1_inference_local.py --input /path/to/folder_with_images --output ./results

输出:
    每张原图配一个 bbox 叠加图 + 一个 summary.json 统计

Dependencies:
    pip install ultralytics opencv-python
"""
import argparse, os, json, sys
from pathlib import Path

try:
    from ultralytics import YOLO
    import cv2
except ImportError:
    print("ERROR: pip install ultralytics opencv-python")
    sys.exit(1)

# V2.1 配置 (per-class conf + iou=0.5 + TTA)
MODEL_PATH = Path(__file__).parent / "V2.1_primary_fp16.onnx"  # 或 .pt / fp32
IMGSZ = 1280
IOU = 0.5
TTA = True

PER_CLASS_CONF = {
    "insect": 0.25,
    "color_anomaly": 0.15,
    "bone": 0.20,
    "glass": 0.05,   # safety: low to catch all glass
    "hair": 0.25,
    "mold": 0.03,    # safety: hardest class, low conf
}

CLASS_NAMES = ["insect", "color_anomaly", "bone", "glass", "hair", "mold"]
CLASS_COLORS_BGR = {
    "insect": (0, 255, 0),
    "color_anomaly": (255, 100, 0),
    "bone": (100, 100, 255),
    "glass": (255, 0, 255),
    "hair": (0, 255, 255),
    "mold": (0, 0, 255),
}


def run_v21_on_folder(input_dir: Path, output_dir: Path, model_path: Path = MODEL_PATH):
    output_dir.mkdir(parents=True, exist_ok=True)
    model = YOLO(str(model_path))

    exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    images = [p for p in input_dir.iterdir() if p.suffix.lower() in exts]
    print(f"Found {len(images)} images in {input_dir}")

    summary = []
    for img_path in images:
        results = model.predict(
            source=str(img_path),
            imgsz=IMGSZ,
            conf=0.01,       # start low, filter by per-class below
            iou=IOU,
            augment=TTA,
            verbose=False,
            save=False,
        )

        img = cv2.imread(str(img_path))
        if img is None:
            print(f"  SKIP (unreadable): {img_path.name}")
            continue

        detections = []
        for r in results:
            if r.boxes is None:
                continue
            for box in r.boxes:
                cls_idx = int(box.cls.item())
                conf = float(box.conf.item())
                cls_name = CLASS_NAMES[cls_idx]
                if conf < PER_CLASS_CONF[cls_name]:
                    continue

                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                color = CLASS_COLORS_BGR[cls_name]
                cv2.rectangle(img, (x1, y1), (x2, y2), color, 3)
                label = f"{cls_name} {conf:.2f}"
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
                cv2.rectangle(img, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
                cv2.putText(img, label, (x1 + 2, y1 - 4),
                             cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                detections.append({
                    "class": cls_name,
                    "conf": round(conf, 3),
                    "box_xyxy": [x1, y1, x2, y2],
                })

        # Header overlay
        header = f"V2.1 | {len(detections)} detections"
        cv2.rectangle(img, (0, 0), (len(header) * 14, 35), (0, 0, 0), -1)
        cv2.putText(img, header, (5, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        out_path = output_dir / img_path.name
        cv2.imwrite(str(out_path), img, [cv2.IMWRITE_JPEG_QUALITY, 90])

        summary.append({
            "input": img_path.name,
            "output": out_path.name,
            "n_detections": len(detections),
            "classes_detected": sorted(set(d["class"] for d in detections)),
            "detections": detections,
        })
        print(f"  {img_path.name}: {len(detections)} detections {sorted(set(d['class'] for d in detections))}")

    with open(output_dir / "_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    # Stats
    n_total = len(summary)
    n_with = sum(1 for s in summary if s["n_detections"] > 0)
    print()
    print("=" * 60)
    print(f"Total images: {n_total}")
    print(f"With any detection: {n_with} ({n_with*100/max(1,n_total):.0f}%)")
    print(f"Zero detections (clean): {n_total - n_with}")
    print(f"Results saved to: {output_dir}")
    print("=" * 60)


def main():
    ap = argparse.ArgumentParser(description="V2.1 local inference")
    ap.add_argument("--input", required=True, help="Folder with images (jpg/png/etc)")
    ap.add_argument("--output", default="./V2.1_results", help="Output folder (default: ./V2.1_results)")
    ap.add_argument("--model", default=str(MODEL_PATH), help="Model path (default: V2.1_primary_fp16.onnx beside this script)")
    args = ap.parse_args()

    input_dir = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output).expanduser().resolve()
    model_path = Path(args.model).expanduser().resolve()

    if not input_dir.is_dir():
        print(f"ERROR: input dir not found: {input_dir}")
        sys.exit(1)
    if not model_path.exists():
        print(f"ERROR: model not found: {model_path}")
        print(f"       Put V2.1_primary_fp16.onnx beside this script, or use --model <path>")
        sys.exit(1)

    run_v21_on_folder(input_dir, output_dir, model_path)


if __name__ == "__main__":
    main()
