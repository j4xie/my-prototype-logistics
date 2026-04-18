"""
V2.1 实际检测效果可视化 — 在 732 张 P1 holdout 图上跑推理, 生成 bbox 叠加图.
目标: 每类抽 5 张 (共 30 张) → 下载本地给用户看.
"""
import paramiko, sys, time, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VIZ_SCRIPT = '''#!/usr/bin/env python3
"""在 P1 holdout 上跑推理, 生成 bbox 可视化."""
import os, json, random
from pathlib import Path
from ultralytics import YOLO
import cv2

random.seed(42)

MODEL_PT = "/root/runs/E_V2_v11l_refine2/weights/best.pt"
P1_JSON = "/root/p1_classified.json"
EXT_IMG = "/root/data/merged_v5_2_extended/images/train"
OUT_DIR = "/root/v21_viz"
os.makedirs(OUT_DIR, exist_ok=True)

# 按类选 5 张 (优先 mold 可能有 6-8 张覆盖 scale 变化)
CLASS_COUNTS = {"mold": 5, "color_anomaly": 5, "insect": 5, "hair": 5, "bone": 4, "glass": 3}

# Load P1 classification to find good candidates
with open(P1_JSON) as f:
    p1 = json.load(f)

# Build stem → class
stem_to_class = {}
for item in p1:
    if not item.get("usable"): continue
    fn = item["file"]
    stem = fn.split("_")[0]
    stem_to_class[stem] = item["class"]

# Sample per class
by_class = {c: [] for c in CLASS_COUNTS}
for stem, cls in stem_to_class.items():
    img_path = f"{EXT_IMG}/p1_{stem}.jpg"
    if os.path.exists(img_path) and cls in by_class:
        by_class[cls].append((stem, img_path))

# Shuffle and pick
selected = []
for cls, n in CLASS_COUNTS.items():
    random.shuffle(by_class[cls])
    for stem, path in by_class[cls][:n]:
        selected.append((cls, stem, path))

print(f"Selected {len(selected)} images across {len(CLASS_COUNTS)} classes")

# Per-class conf thresholds (from V2.1_per_class_conf.json)
PER_CLS_CONF = {
    "insect": 0.25, "color_anomaly": 0.15, "bone": 0.20,
    "glass": 0.05, "hair": 0.25, "mold": 0.03,
}
CLASS_NAMES = ["insect", "color_anomaly", "bone", "glass", "hair", "mold"]
CLASS_COLORS = {
    "insect": (0, 255, 0), "color_anomaly": (255, 100, 0), "bone": (100, 100, 255),
    "glass": (255, 0, 255), "hair": (0, 255, 255), "mold": (0, 0, 255),
}

model = YOLO(MODEL_PT)

summary = []
for cls, stem, img_path in selected:
    # 推理 (TTA + imgsz=1280 as baseline)
    results = model.predict(source=img_path, imgsz=1280, conf=0.01, iou=0.5, augment=True,
                             verbose=False, save=False)

    img = cv2.imread(img_path)
    h, w = img.shape[:2]

    # 画所有超过 per-class conf 的 boxes
    detections = []
    for r in results:
        if r.boxes is None: continue
        for i, box in enumerate(r.boxes):
            cls_idx = int(box.cls.item())
            conf = float(box.conf.item())
            cls_name = CLASS_NAMES[cls_idx]
            if conf < PER_CLS_CONF[cls_name]:
                continue
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
            color = CLASS_COLORS[cls_name]
            cv2.rectangle(img, (x1, y1), (x2, y2), color, 3)
            label = f"{cls_name} {conf:.2f}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
            cv2.rectangle(img, (x1, y1-th-6), (x1+tw+4, y1), color, -1)
            cv2.putText(img, label, (x1+2, y1-4), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2)
            detections.append({"class": cls_name, "conf": round(conf, 3), "box": [x1,y1,x2,y2]})

    # 真实类标注 (左上角)
    cv2.rectangle(img, (0, 0), (400, 35), (0, 0, 0), -1)
    cv2.putText(img, f"GT: {cls}  Detected: {len(detections)}", (5, 25),
                 cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    out_path = f"{OUT_DIR}/{cls}_{stem}.jpg"
    cv2.imwrite(out_path, img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    summary.append({
        "gt_class": cls, "stem": stem, "out": out_path,
        "n_detections": len(detections),
        "detected_classes": list(set(d["class"] for d in detections)),
    })
    detected_cls_list = list(set(d["class"] for d in detections))
    status = "OK" if cls in detected_cls_list else ("MISS" if len(detections) == 0 else "WRONG_CLASS")
    print(f"  {cls:14s} {stem:30s} [{status}] detected={len(detections)} classes={detected_cls_list}")

# 保存摘要 JSON
with open(f"{OUT_DIR}/_summary.json", "w") as f:
    json.dump(summary, f, indent=2)

# 统计
print()
print("=== STATS ===")
gt_hit = sum(1 for s in summary if s["gt_class"] in s["detected_classes"])
gt_miss = sum(1 for s in summary if len(s["detected_classes"]) == 0)
print(f"Total tested: {len(summary)}")
print(f"GT class detected: {gt_hit}/{len(summary)} ({gt_hit*100/len(summary):.0f}%)")
print(f"Zero detections (miss): {gt_miss}")
'''

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)
sftp = ssh.open_sftp()
with sftp.file('/root/v21_viz.py', 'w') as f:
    f.write(VIZ_SCRIPT)
sftp.close()
ssh.exec_command("chmod +x /root/v21_viz.py", timeout=10)

# Run (takes ~30-60s)
stdin, stdout, stderr = ssh.exec_command("cd /root && CUDA_VISIBLE_DEVICES=0 python3 /root/v21_viz.py 2>&1", timeout=180)
print(stdout.read().decode())

# Download all viz images + summary
print("\n=== Downloading visualizations ===")
sftp = ssh.open_sftp()
local_dir = r"C:\Users\Steve\my-prototype-logistics\models\e_final\V2.1\visualization_test"
os.makedirs(local_dir, exist_ok=True)
stdin, stdout, stderr = ssh.exec_command("ls /root/v21_viz/", timeout=10)
files = [f for f in stdout.read().decode().strip().split("\n") if f]
for f in files:
    src = f"/root/v21_viz/{f}"
    dst = os.path.join(local_dir, f)
    sftp.get(src, dst)
sftp.close()
ssh.close()
print(f"Downloaded {len(files)} files to {local_dir}")
