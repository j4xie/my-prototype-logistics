# v21_eval_p1_holdout.py — Eval refine2 on 732 unseen P1 positives
#!/usr/bin/env python3
import json, os, argparse, shutil
from pathlib import Path
from ultralytics import YOLO

ap = argparse.ArgumentParser()
ap.add_argument("--model", required=True)
ap.add_argument("--out", required=True)
args = ap.parse_args()

CLASS_NAMES = ["insect", "color_anomaly", "bone", "glass", "hair", "mold"]

# Build a val-only dataset using P1 positives (auto-labeled bboxes from ULTRA)
EXTENDED_IMG = "/root/data/merged_v5_2_extended/images/train"
EXTENDED_LBL = "/root/data/merged_v5_2_extended/labels/train"
P1_VAL_ROOT = "/root/data/p1_holdout_val"

os.makedirs(f"{P1_VAL_ROOT}/images/val", exist_ok=True)
os.makedirs(f"{P1_VAL_ROOT}/labels/val", exist_ok=True)
# Also need train dir (can be tiny dummy for yolo val to work)
os.makedirs(f"{P1_VAL_ROOT}/images/train", exist_ok=True)
os.makedirs(f"{P1_VAL_ROOT}/labels/train", exist_ok=True)

# Link all p1_s*.jpg/txt to val
for fn in os.listdir(EXTENDED_IMG):
    if fn.startswith("p1_s"):
        src = os.path.join(EXTENDED_IMG, fn)
        dst = os.path.join(f"{P1_VAL_ROOT}/images/val", fn)
        if not os.path.lexists(dst):
            os.symlink(src, dst)
for fn in os.listdir(EXTENDED_LBL):
    if fn.startswith("p1_s"):
        src = os.path.join(EXTENDED_LBL, fn)
        dst = os.path.join(f"{P1_VAL_ROOT}/labels/val", fn)
        if not os.path.lexists(dst):
            os.symlink(src, dst)

# Dummy train: link 1 val image so yolo's check passes
vals = os.listdir(f"{P1_VAL_ROOT}/images/val")
if vals and not os.listdir(f"{P1_VAL_ROOT}/images/train"):
    dummy = vals[0]
    os.symlink(f"{P1_VAL_ROOT}/images/val/{dummy}", f"{P1_VAL_ROOT}/images/train/{dummy}")
    stem = os.path.splitext(dummy)[0]
    os.symlink(f"{P1_VAL_ROOT}/labels/val/{stem}.txt",
                f"{P1_VAL_ROOT}/labels/train/{stem}.txt")

# data.yaml
yaml = f"""path: {P1_VAL_ROOT}
train: images/train
val: images/val
nc: 6
names:
  0: insect
  1: color_anomaly
  2: bone
  3: glass
  4: hair
  5: mold
"""
with open(f"{P1_VAL_ROOT}/data.yaml", "w") as f:
    f.write(yaml)

# Eval
model = YOLO(args.model)
m = model.val(data=f"{P1_VAL_ROOT}/data.yaml", imgsz=1280, batch=8, device=0,
               conf=0.001, iou=0.6, augment=True, verbose=False)
result = {
    "overall_mAP50": float(m.box.map50),
    "overall_mAP50_95": float(m.box.map),
    "per_class_mAP50": {CLASS_NAMES[i]: float(m.box.ap50[i]) for i in range(6)},
    "num_val_imgs": len(vals),
}
with open(args.out, "w") as f:
    json.dump(result, f, indent=2)
print(f"Saved: {args.out}")
print(f"P1 holdout mAP50 (TTA): {result['overall_mAP50']:.4f}")
for c, v in result['per_class_mAP50'].items():
    print(f"  {c}: {v:.4f}")
