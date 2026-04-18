# v21_eval_conf_scan.py — Run model.val at multiple conf, record PR at each
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

# Eval once at conf=0.001 with save_json to get all predictions
# Then we compute F1 at various thresholds post-hoc
# Ultralytics val returns curves directly:
m = model.val(data=args.data, imgsz=1280, batch=8, device=0,
               conf=0.001, iou=0.6, augment=True, verbose=False,
               save_json=False)

# m.box has: p (precision per class), r (recall per class), f1 per class across conf curve
# We find max-F1 conf per class from curves
# F1 curve in m.curves (a list of 4: P-curve, R-curve, F1-curve, PR-curve)
# m.curves[2] is F1 curve, shape (6 classes, N_conf_points)
# m.curves_results = [("precision", P), ("recall", R), ("f1", F1), ("pr", PR)]

# Access: model.val returns DetMetrics object with
#   box.f1_curve shape (nc, N) - F1 values across conf thresholds
#   box.x shape (N,) - conf thresholds array

box = m.box
# box.f1_curve (6, 1000), box.x (1000,)
if hasattr(box, 'f1_curve') and hasattr(box, 'x'):
    import numpy as np
    f1_curves = box.f1_curve  # (nc, N)
    confs = box.x  # (N,)
    per_class_best = {}
    for i in range(6):
        f1s = f1_curves[i]
        best_idx = int(np.argmax(f1s))
        per_class_best[CLASS_NAMES[i]] = {
            "best_conf": float(confs[best_idx]),
            "f1_at_best": float(f1s[best_idx]),
            "precision_at_best": float(box.p_curve[i][best_idx]) if hasattr(box, 'p_curve') else None,
            "recall_at_best": float(box.r_curve[i][best_idx]) if hasattr(box, 'r_curve') else None,
        }
else:
    per_class_best = {"error": "f1_curve not available, Ultralytics version incompatible"}

result = {
    "overall_mAP50": float(box.map50),
    "per_class_mAP50": {CLASS_NAMES[i]: float(box.ap50[i]) for i in range(6)},
    "per_class_best_conf": per_class_best,
}
with open(args.out, "w") as f:
    json.dump(result, f, indent=2)
print(f"Saved: {args.out}")
for c, v in per_class_best.items():
    if isinstance(v, dict):
        print(f"  {c:14s} best conf={v['best_conf']:.3f} F1={v['f1_at_best']:.3f}")
