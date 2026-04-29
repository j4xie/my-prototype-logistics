# v21_eval_multiscale.py (runs on remote, 1 GPU)
#!/usr/bin/env python3
import sys, json, os, argparse
from ultralytics import YOLO

ap = argparse.ArgumentParser()
ap.add_argument("--model", required=True)
ap.add_argument("--data", default="/root/data/merged_v5_1_ultra/data.yaml")
ap.add_argument("--imgsz", type=int, required=True)
ap.add_argument("--out", required=True)
args = ap.parse_args()

CLASS_NAMES = ["insect", "color_anomaly", "bone", "glass", "hair", "mold"]

model = YOLO(args.model)

# Standard eval (reference)
print(f"=== Standard @ imgsz={args.imgsz} ===")
metrics_std = model.val(data=args.data, imgsz=args.imgsz, batch=8,
                          conf=0.001, iou=0.6, augment=False, verbose=False)

# TTA eval
print(f"=== TTA @ imgsz={args.imgsz} ===")
metrics_tta = model.val(data=args.data, imgsz=args.imgsz, batch=4,
                          conf=0.001, iou=0.6, augment=True, verbose=False)

result = {
    "imgsz": args.imgsz,
    "standard": {
        "overall": float(metrics_std.box.map50),
        "per_class": {CLASS_NAMES[i]: float(metrics_std.box.ap50[i]) for i in range(6)},
    },
    "tta": {
        "overall": float(metrics_tta.box.map50),
        "per_class": {CLASS_NAMES[i]: float(metrics_tta.box.ap50[i]) for i in range(6)},
    },
}
with open(args.out, "w") as f:
    json.dump(result, f, indent=2)
print(f"Saved: {args.out}")
print(f"Standard mAP50: {result['standard']['overall']:.4f}")
print(f"TTA mAP50: {result['tta']['overall']:.4f}")
