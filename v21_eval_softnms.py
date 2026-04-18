# v21_eval_softnms.py — Simpler: IoU threshold sweep (proxy for soft-NMS effect)
#!/usr/bin/env python3
import json, os, argparse
from ultralytics import YOLO

ap = argparse.ArgumentParser()
ap.add_argument("--model", required=True)
ap.add_argument("--data", default="/root/data/merged_v5_1_ultra/data.yaml")
ap.add_argument("--out", required=True)
args = ap.parse_args()

CLASS_NAMES = ["insect", "color_anomaly", "bone", "glass", "hair", "mold"]
model = YOLO(args.model)

results = {}
for iou in [0.5, 0.6, 0.7]:
    print(f"=== IoU={iou} TTA ===")
    m = model.val(data=args.data, imgsz=1280, batch=4, device=0,
                   conf=0.001, iou=iou, augment=True, verbose=False)
    iou_key = f"iou_{iou}"
    results[iou_key] = {
        "overall": float(m.box.map50),
        "per_class": {CLASS_NAMES[i]: float(m.box.ap50[i]) for i in range(6)},
    }
    overall_val = results[iou_key]['overall']
    print(f"  mAP50: {overall_val:.4f}")

with open(args.out, "w") as f:
    json.dump(results, f, indent=2)
print(f"Saved: {args.out}")
