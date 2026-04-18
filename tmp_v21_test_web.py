"""Upload 60 web images to server + run V2.1 inference + download bbox visualizations."""
import paramiko, sys, os, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

LOCAL_SRC = r"C:\Users\Steve\my-prototype-logistics\web_test_images"
REMOTE_DIR = "/root/web_test_images"
OUT_DIR = "/root/web_test_viz"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)
sftp = ssh.open_sftp()

def ensure_remote_dir(path):
    try: sftp.mkdir(path)
    except IOError: pass

# Upload
ensure_remote_dir(REMOTE_DIR)
classes = ["insect", "color_anomaly", "bone", "glass", "hair", "mold"]
for cls in classes:
    src_cls = os.path.join(LOCAL_SRC, cls)
    if not os.path.isdir(src_cls): continue
    ensure_remote_dir(f"{REMOTE_DIR}/{cls}")
    for fn in sorted(os.listdir(src_cls)):
        src = os.path.join(src_cls, fn)
        dst = f"{REMOTE_DIR}/{cls}/{fn}"
        sftp.put(src, dst)
    print(f"Uploaded {cls}: {len(os.listdir(src_cls))} files")

sftp.close()

# Run V2.1 inference on all web images
VIZ_SCRIPT = '''#!/usr/bin/env python3
import os, json
from pathlib import Path
from ultralytics import YOLO
import cv2

MODEL_PT = "/root/runs/E_V2_v11l_refine2/weights/best.pt"
SRC = "/root/web_test_images"
OUT = "/root/web_test_viz"
os.makedirs(OUT, exist_ok=True)

PER_CLS_CONF = {
    "insect": 0.25, "color_anomaly": 0.15, "bone": 0.20,
    "glass": 0.05, "hair": 0.25, "mold": 0.03,
}
CLASS_NAMES = ["insect", "color_anomaly", "bone", "glass", "hair", "mold"]
COLORS = {
    "insect": (0, 255, 0), "color_anomaly": (255, 100, 0), "bone": (100, 100, 255),
    "glass": (255, 0, 255), "hair": (0, 255, 255), "mold": (0, 0, 255),
}

model = YOLO(MODEL_PT)

summary = []
for cls in CLASS_NAMES:
    cls_src = os.path.join(SRC, cls)
    if not os.path.isdir(cls_src): continue
    for fn in sorted(os.listdir(cls_src)):
        img_path = os.path.join(cls_src, fn)
        results = model.predict(source=img_path, imgsz=1280, conf=0.01, iou=0.5,
                                 augment=True, verbose=False, save=False)
        img = cv2.imread(img_path)
        if img is None:
            print(f"SKIP: {fn}")
            continue
        detections = []
        for r in results:
            if r.boxes is None: continue
            for box in r.boxes:
                ci = int(box.cls.item())
                conf = float(box.conf.item())
                cn = CLASS_NAMES[ci]
                if conf < PER_CLS_CONF[cn]: continue
                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                color = COLORS[cn]
                cv2.rectangle(img, (x1, y1), (x2, y2), color, 3)
                label = f"{cn} {conf:.2f}"
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
                cv2.rectangle(img, (x1, y1-th-6), (x1+tw+4, y1), color, -1)
                cv2.putText(img, label, (x1+2, y1-4), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2)
                detections.append({"class": cn, "conf": round(conf, 3)})
        # Header
        header = f"GT: {cls} | Detected: {len(detections)}"
        cv2.rectangle(img, (0, 0), (len(header)*14, 35), (0, 0, 0), -1)
        cv2.putText(img, header, (5, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.imwrite(f"{OUT}/{cls}_{fn}", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        detected_classes = sorted(set(d["class"] for d in detections))
        status = "OK" if cls in detected_classes else ("MISS" if not detected_classes else "WRONG")
        summary.append({"gt": cls, "file": fn, "status": status, "detected": detected_classes, "n_det": len(detections)})
        print(f"  {cls}/{fn}: {status} {detected_classes}")

with open(f"{OUT}/_summary.json", "w") as f:
    json.dump(summary, f, indent=2)

# Stats
print()
print("==========" * 6)
from collections import Counter
by_cls_status = {}
for s in summary:
    by_cls_status.setdefault(s["gt"], Counter())[s["status"]] += 1
print(f"{'class':<14} OK  MISS  WRONG  total")
for cls in CLASS_NAMES:
    c = by_cls_status.get(cls, Counter())
    total = sum(c.values())
    print(f"  {cls:<14} {c['OK']:3d}  {c['MISS']:3d}   {c['WRONG']:3d}    {total}")
total_ok = sum(1 for s in summary if s["status"] == "OK")
total_miss = sum(1 for s in summary if s["status"] == "MISS")
total_wrong = sum(1 for s in summary if s["status"] == "WRONG")
n = len(summary)
print(f"\\nTotal: {n} | OK: {total_ok} ({total_ok*100/n:.0f}%) | MISS: {total_miss} | WRONG: {total_wrong}")
'''

sftp = ssh.open_sftp()
with sftp.file('/root/web_test_viz.py', 'w') as f:
    f.write(VIZ_SCRIPT)
sftp.close()

print("\nRunning V2.1 inference on 60 web images...")
stdin, stdout, stderr = ssh.exec_command("cd /root && CUDA_VISIBLE_DEVICES=0 python3 /root/web_test_viz.py 2>&1", timeout=600)
print(stdout.read().decode('utf-8', errors='replace'))

# Download viz
LOCAL_VIZ = r"C:\Users\Steve\my-prototype-logistics\models\e_final\V2.1\web_test_viz"
os.makedirs(LOCAL_VIZ, exist_ok=True)
sftp = ssh.open_sftp()
stdin, stdout, stderr = ssh.exec_command(f"ls {OUT_DIR}/", timeout=10)
files = [f for f in stdout.read().decode().strip().split("\n") if f]
for f in files:
    sftp.get(f"{OUT_DIR}/{f}", os.path.join(LOCAL_VIZ, f))
sftp.close()
ssh.close()
print(f"Downloaded {len(files)} files to {LOCAL_VIZ}")
