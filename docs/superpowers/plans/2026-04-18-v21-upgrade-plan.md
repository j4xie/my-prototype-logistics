# YOLO V2.1 Model Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline execution chosen by user). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade V2.0 refine2 (0.708 TTA mAP50) to V2.1 via inference optimization (multi-scale TTA + Soft-NMS + per-class conf) and conditional small-object retrain after R2 mold data recovery.

**Architecture:** 8-GPU parallel evaluation in X1, parallel R2 download in X2, conditional retrain in X3, delivery in X4. Success = C (production F1) + B (overall mAP50).

**Tech Stack:** Ultralytics 8.4.37 + PyTorch 2.10 + CUDA 13 + 7-8×RTX 4090, paramiko SSH + aws-cli S3, ONNX export.

**Budget:** ~17h until Apr 19 23:59. Buffer ≥ 3h.

---

## File Structure

**Local orchestration scripts** (`C:\Users\Steve\my-prototype-logistics\`):
- `tmp_v21_env_check.py` — Verify 8 GPU + R2 creds
- `tmp_v21_x1_launch.py` — Launch 8-GPU parallel X1 eval
- `tmp_v21_x1_aggregate.py` — Collect X1 results, decide X3 trigger
- `tmp_v21_x2_r2_recover.py` — R2 mold tar download + extract + relink
- `tmp_v21_x3_retrain.py` — Conditional small-obj retrain (only if X1 insufficient)
- `tmp_v21_x4_export.py` — ONNX export + config bundle + delivery download

**Remote scripts** (uploaded to `/root/` via SFTP):
- `v21_eval_multiscale.py` — Single-GPU TTA eval at given imgsz
- `v21_eval_softnms.py` — Soft-NMS sigma sweep on single GPU
- `v21_eval_conf_scan.py` — Per-class conf F1 sweep on single GPU
- `v21_eval_p1_holdout.py` — Stratified eval on P1 unseen positives

**Output artifacts** (`models/e_final/V2.1/`):
- `V2.1_primary_fp32.onnx`, `V2.1_primary_fp16.onnx`
- `V2.1_inference_config.yaml`
- `V2.1_per_class_conf_thresholds.json`
- `V2.1_metrics.json` (std + TTA + multi-scale + soft-nms + stratified)
- `V2.1_DELIVERY_REPORT.md`

---

## Task 1: Environment Check

**Files:**
- Create: `tmp_v21_env_check.py`

- [ ] **Step 1: Write env check script**

```python
# tmp_v21_env_check.py
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)
def run(cmd, timeout=30):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    return stdout.read().decode('utf-8', errors='replace').strip()

print('=== 8 GPU health ===')
print(run('nvidia-smi --query-gpu=index,utilization.gpu,memory.used,memory.free --format=csv,noheader'))
print()
print('=== R2 creds + endpoint ===')
print(run('cat /root/.aws/credentials 2>/dev/null | head -3'))
print(run('aws s3 ls --endpoint-url https://b1251333e5f1465deb7cd31296edeaba.r2.cloudflarestorage.com 2>&1 | head -3'))
print()
print('=== refine2 best.pt exists ===')
print(run('ls -la /root/runs/E_V2_v11l_refine2/weights/best.pt /root/runs/E_V2_FINAL_cp/weights/best.pt 2>/dev/null'))
print()
print('=== Any stale yolo procs? ===')
print(run("ps -ef | grep -E 'yolo train|DDP' | grep -v grep | head -3 || echo CLEAN"))
print()
print('=== P1 holdout data exists (732 positives in extended) ===')
print(run('ls /root/data/merged_v5_2_extended/images/train/ | grep "^p1_s" | wc -l'))
ssh.close()
```

- [ ] **Step 2: Run env check**

Run: `python tmp_v21_env_check.py`
Expected: 8 GPUs healthy (0 MiB used ideally), R2 lists ≥ 3 buckets, best.pt files exist, no stale procs, P1 holdout 732 files.

- [ ] **Step 3: Commit env check**

```bash
git add tmp_v21_env_check.py
git commit -m "chore(yolo-v21): add env check script"
```

---

## Task 2: X1 Multi-scale TTA Eval Scripts (Remote)

**Files:**
- Create: `v21_eval_multiscale.py` (uploaded to remote /root/)

- [ ] **Step 1: Write multi-scale eval script**

```python
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
metrics_std = model.val(data=args.data, imgsz=args.imgsz, batch=8, device=0,
                          conf=0.001, iou=0.6, augment=False, verbose=False)

# TTA eval
print(f"=== TTA @ imgsz={args.imgsz} ===")
metrics_tta = model.val(data=args.data, imgsz=args.imgsz, batch=4, device=0,
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
```

- [ ] **Step 2: Upload to remote**

Run via paramiko SFTP (part of Task 6 launcher).

---

## Task 3: X1 Soft-NMS Sweep Script (Remote)

**Files:**
- Create: `v21_eval_softnms.py`

- [ ] **Step 1: Write Soft-NMS sweep**

Note: Ultralytics doesn't expose Soft-NMS directly in YOLO.val API. We use custom inference loop with soft_nms post-processing via torchvision. Alternative: eval with different IoU thresholds as proxy.

```python
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
    results[f"iou_{iou}"] = {
        "overall": float(m.box.map50),
        "per_class": {CLASS_NAMES[i]: float(m.box.ap50[i]) for i in range(6)},
    }
    print(f"  mAP50: {results[f'iou_{iou}']['overall']:.4f}")

with open(args.out, "w") as f:
    json.dump(results, f, indent=2)
print(f"Saved: {args.out}")
```

- [ ] **Step 2: Upload to remote** (part of Task 6)

---

## Task 4: X1 Per-class Conf F1 Scan Script (Remote)

**Files:**
- Create: `v21_eval_conf_scan.py`

- [ ] **Step 1: Write conf scan script**

```python
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
```

- [ ] **Step 2: Upload to remote** (part of Task 6)

---

## Task 5: X1 P1 Holdout Eval Script (Remote)

**Files:**
- Create: `v21_eval_p1_holdout.py`

- [ ] **Step 1: Write P1 holdout eval**

```python
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
    os.symlink(f"{P1_VAL_ROOT}/labels/val/{os.path.splitext(dummy)[0]}.txt",
                f"{P1_VAL_ROOT}/labels/train/{os.path.splitext(dummy)[0]}.txt")

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
```

- [ ] **Step 2: Upload to remote** (part of Task 6)

---

## Task 6: X1 Launch 8-GPU Parallel (Local Orchestrator)

**Files:**
- Create: `tmp_v21_x1_launch.py`

- [ ] **Step 1: Write launcher**

```python
# tmp_v21_x1_launch.py
import paramiko, sys, time, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

REMOTE_SCRIPTS = {
    "v21_eval_multiscale.py": open("v21_eval_multiscale.py").read() if os.path.exists("v21_eval_multiscale.py") else None,
    "v21_eval_softnms.py": open("v21_eval_softnms.py").read() if os.path.exists("v21_eval_softnms.py") else None,
    "v21_eval_conf_scan.py": open("v21_eval_conf_scan.py").read() if os.path.exists("v21_eval_conf_scan.py") else None,
    "v21_eval_p1_holdout.py": open("v21_eval_p1_holdout.py").read() if os.path.exists("v21_eval_p1_holdout.py") else None,
}

REFINE2 = "/root/runs/E_V2_v11l_refine2/weights/best.pt"
FINAL_CP = "/root/runs/E_V2_FINAL_cp/weights/best.pt"
RESULTS_DIR = "/root/v21_x1_results"

JOBS = [
    # GPU 0-3: multi-scale TTA at different imgsz
    (0, "v21_eval_multiscale.py", f"--model {REFINE2} --imgsz 960  --out {RESULTS_DIR}/ms_960.json"),
    (1, "v21_eval_multiscale.py", f"--model {REFINE2} --imgsz 1280 --out {RESULTS_DIR}/ms_1280.json"),
    (2, "v21_eval_multiscale.py", f"--model {REFINE2} --imgsz 1536 --out {RESULTS_DIR}/ms_1536.json"),
    (3, "v21_eval_multiscale.py", f"--model {REFINE2} --imgsz 1920 --out {RESULTS_DIR}/ms_1920.json"),
    # GPU 4: IoU / soft-nms proxy
    (4, "v21_eval_softnms.py",    f"--model {REFINE2} --out {RESULTS_DIR}/softnms.json"),
    # GPU 5: per-class conf F1 scan
    (5, "v21_eval_conf_scan.py",  f"--model {REFINE2} --out {RESULTS_DIR}/confscan.json"),
    # GPU 6: P1 holdout
    (6, "v21_eval_p1_holdout.py", f"--model {REFINE2} --out {RESULTS_DIR}/p1_holdout.json"),
    # GPU 7: final_cp reference (same as GPU 1 eval but other model)
    (7, "v21_eval_multiscale.py", f"--model {FINAL_CP} --imgsz 1280 --out {RESULTS_DIR}/ms_1280_finalcp.json"),
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)

# Upload scripts
sftp = ssh.open_sftp()
for fname, content in REMOTE_SCRIPTS.items():
    if content is None:
        print(f"ERROR: {fname} not in local dir")
        sys.exit(1)
    with sftp.file(f"/root/{fname}", "w") as f:
        f.write(content)
sftp.close()
ssh.exec_command("chmod +x /root/v21_eval_*.py", timeout=10)
ssh.exec_command(f"mkdir -p {RESULTS_DIR}", timeout=10)
print(f"Uploaded {len(REMOTE_SCRIPTS)} scripts.")

# Launch each job as detached process
for gpu, script, args_str in JOBS:
    logfile = f"/root/v21_x1_gpu{gpu}.log"
    cmd = (f"cd /root && CUDA_VISIBLE_DEVICES={gpu} setsid python3 /root/{script} {args_str} "
           f"> {logfile} 2>&1 < /dev/null &")
    ssh.exec_command(cmd, timeout=10)
    print(f"Launched GPU {gpu}: {script}")

time.sleep(45)

print("\n=== Proc check after 45s ===")
stdin, stdout, stderr = ssh.exec_command("ps -ef | grep v21_eval | grep -v grep | wc -l", timeout=10)
n = int(stdout.read().decode().strip() or 0)
print(f"Active eval procs: {n}")

stdin, stdout, stderr = ssh.exec_command("nvidia-smi --query-gpu=index,utilization.gpu,memory.used --format=csv,noheader", timeout=10)
print(stdout.read().decode())

ssh.close()
print("\n8 parallel X1 evals running. Run tmp_v21_x1_aggregate.py in ~15 min.")
```

- [ ] **Step 2: Write the 4 remote scripts locally first**

Create `v21_eval_multiscale.py`, `v21_eval_softnms.py`, `v21_eval_conf_scan.py`, `v21_eval_p1_holdout.py` in the project root from Tasks 2-5 code blocks.

- [ ] **Step 3: Run launcher**

Run: `python tmp_v21_x1_launch.py`
Expected: "Active eval procs: 8", nvidia-smi shows 8 GPUs at various util (some 100%, some idle depending on job phase).

- [ ] **Step 4: Commit launcher + remote scripts**

```bash
git add tmp_v21_x1_launch.py v21_eval_*.py
git commit -m "feat(yolo-v21): 8-GPU parallel X1 eval launcher + 4 eval scripts"
```

---

## Task 7: X2 R2 Mold Data Recovery (Parallel to X1)

**Files:**
- Create: `tmp_v21_x2_r2_recover.py`

- [ ] **Step 1: Write R2 recover script**

```python
# tmp_v21_x2_r2_recover.py
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

RECOVER_SH = '''#!/bin/bash
set -e
export AWS_EC2_METADATA_DISABLED=true
R2_EP="--endpoint-url https://b1251333e5f1465deb7cd31296edeaba.r2.cloudflarestorage.com"
PREFIX="s3://cretas/datasets_1280_tar/"
CHUNK_DIR="/tmp/r2_chunks"
EXTRACT_DIR="/opt/devmachine"
mkdir -p $CHUNK_DIR

# Step 1: List all chunks
echo "=== List chunks ==="
aws s3 ls $PREFIX $R2_EP | awk '{print $4}' > /tmp/chunks_list.txt
echo "Total chunks: $(wc -l < /tmp/chunks_list.txt)"

# Step 2: Sample each chunk to find mold-containing ones
echo "=== Probing each chunk for mold (download header only)... ==="
MOLD_CHUNKS=""
for chunk in $(cat /tmp/chunks_list.txt); do
    aws s3api get-object --bucket cretas --key "datasets_1280_tar/$chunk" \\
        --range "bytes=0-10485760" $R2_EP "$CHUNK_DIR/probe_$chunk" > /dev/null 2>&1
    # Check if probe file contains mold path entries
    if tar -tf "$CHUNK_DIR/probe_$chunk" 2>/dev/null | head -200 | grep -q "mold"; then
        echo "  $chunk: HAS mold"
        MOLD_CHUNKS="$MOLD_CHUNKS $chunk"
    fi
    rm -f "$CHUNK_DIR/probe_$chunk"
done
echo "Mold chunks identified: $MOLD_CHUNKS"

# Step 3: Download full mold chunks
echo "=== Downloading full mold chunks ==="
for chunk in $MOLD_CHUNKS; do
    if [ ! -f "$CHUNK_DIR/$chunk" ]; then
        aws s3 cp "${PREFIX}$chunk" "$CHUNK_DIR/$chunk" $R2_EP
    fi
done

# Step 4: Extract each chunk selectively (only mold/ subpath)
echo "=== Extracting mold subpath ==="
mkdir -p $EXTRACT_DIR
for chunk in $MOLD_CHUNKS; do
    echo "  Extract $chunk..."
    tar -xf "$CHUNK_DIR/$chunk" -C $EXTRACT_DIR --wildcards 'datasets_1280/collected_v2/mold/*' 2>/dev/null || true
done

# Step 5: Verify broken symlinks recovered
echo "=== Verify recovery ==="
ULTRA_TRAIN="/root/data/merged_v5_1_ultra/images/train"
BEFORE=$(find $ULTRA_TRAIN -type l ! -readable | wc -l)
AFTER=$(find $ULTRA_TRAIN -type l ! -readable 2>/dev/null | wc -l)
WORKING=$(find $ULTRA_TRAIN -type l -readable | wc -l)
echo "Broken symlinks now: $AFTER"
echo "Working symlinks: $WORKING"

# Step 6: Per-class mold accessible count
python3 << 'PYEOF'
import os
lbl_dir = "/root/data/merged_v5_1_ultra/labels/train"
img_dir = "/root/data/merged_v5_1_ultra/images/train"
mold_ok = 0
mold_broken = 0
for fn in os.listdir(img_dir):
    stem = os.path.splitext(fn)[0]
    lp = os.path.join(lbl_dir, stem + ".txt")
    ip = os.path.join(img_dir, fn)
    if os.path.exists(lp) and os.path.getsize(lp) > 0:
        with open(lp) as f:
            cls = int(f.readline().split()[0])
        if cls == 5:  # mold
            try: os.stat(ip); mold_ok += 1
            except: mold_broken += 1
print(f"Mold working: {mold_ok}, broken: {mold_broken}")
PYEOF

echo "=== X2 DONE ==="
'''

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)
sftp = ssh.open_sftp()
with sftp.file('/root/x2_recover.sh', 'w') as f:
    f.write(RECOVER_SH)
sftp.close()
ssh.exec_command("chmod +x /root/x2_recover.sh", timeout=10)

# Launch detached, log to /root/x2_recover.log
ssh.exec_command("cd /root && setsid bash /root/x2_recover.sh > /root/x2_recover.log 2>&1 < /dev/null &", timeout=10)
print("X2 recovery launched (detached). ETA 30-60 min (depends on R2 speed and chunk count).")
print("Check progress: python -c 'see tmp_v21_x2_check.py'")
ssh.close()
```

- [ ] **Step 2: Run recovery launcher**

Run: `python tmp_v21_x2_r2_recover.py`
Expected: "X2 recovery launched" confirmation.

- [ ] **Step 3: Commit X2 launcher**

```bash
git add tmp_v21_x2_r2_recover.py
git commit -m "feat(yolo-v21): R2 mold data recovery script"
```

---

## Task 8: X1 Results Aggregation + Decision

**Files:**
- Create: `tmp_v21_x1_aggregate.py`

- [ ] **Step 1: Wait for X1 completion**

Wait 15 minutes, then check all 8 GPU logs have finished:

```python
# Checkpoint script: check if all 8 result JSONs exist
import paramiko, sys
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)
stdin, stdout, stderr = ssh.exec_command("ls /root/v21_x1_results/*.json 2>/dev/null | wc -l", timeout=10)
n = int(stdout.read().decode().strip() or 0)
print(f"X1 results ready: {n}/8")
stdin, stdout, stderr = ssh.exec_command("ps -ef | grep v21_eval | grep -v grep | wc -l", timeout=10)
print(f"Active procs: {stdout.read().decode().strip()}")
ssh.close()
```

- [ ] **Step 2: Write aggregator**

```python
# tmp_v21_x1_aggregate.py
import paramiko, json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)
sftp = ssh.open_sftp()

# Download all result JSONs
import os
os.makedirs("v21_x1_results", exist_ok=True)
stdin, stdout, stderr = ssh.exec_command("ls /root/v21_x1_results/*.json", timeout=10)
for line in stdout.read().decode().strip().split("\n"):
    if line:
        local = f"v21_x1_results/{os.path.basename(line)}"
        sftp.get(line, local)
        print(f"  Downloaded {os.path.basename(line)}")
sftp.close()
ssh.close()

# Aggregate + analyze
print("\n" + "="*60)
print("X1 AGGREGATION")
print("="*60)

all_results = {}
for f in sorted(os.listdir("v21_x1_results")):
    if f.endswith(".json"):
        with open(f"v21_x1_results/{f}") as fh:
            all_results[f] = json.load(fh)

# Multi-scale comparison
print("\n--- Multi-scale TTA (refine2) ---")
print(f"{'Imgsz':<8} {'Std':<8} {'TTA':<8} mold_TTA")
for sz in [960, 1280, 1536, 1920]:
    key = f"ms_{sz}.json"
    if key in all_results:
        r = all_results[key]
        mold_tta = r['tta']['per_class']['mold']
        print(f"  {sz:<6}  {r['standard']['overall']:.4f}  {r['tta']['overall']:.4f}  {mold_tta:.4f}")

# Soft-NMS / IoU sweep
print("\n--- IoU sweep (proxy for soft-NMS) ---")
if "softnms.json" in all_results:
    for iou_key, v in all_results["softnms.json"].items():
        print(f"  {iou_key}: overall={v['overall']:.4f} mold={v['per_class']['mold']:.4f}")

# Per-class F1 best conf
print("\n--- Per-class F1-optimal conf ---")
if "confscan.json" in all_results:
    r = all_results["confscan.json"]
    print(f"Overall mAP50: {r['overall_mAP50']:.4f}")
    for cls, v in r['per_class_best_conf'].items():
        if isinstance(v, dict):
            print(f"  {cls:14s} conf={v['best_conf']:.3f}  F1={v['f1_at_best']:.3f}")

# P1 holdout
print("\n--- P1 holdout (unseen) ---")
if "p1_holdout.json" in all_results:
    r = all_results["p1_holdout.json"]
    print(f"Num val imgs: {r['num_val_imgs']}")
    print(f"Overall mAP50 (TTA): {r['overall_mAP50']:.4f}")
    print(f"Overall mAP50-95: {r['overall_mAP50_95']:.4f}")
    for cls, v in r['per_class_mAP50'].items():
        print(f"  {cls}: {v:.4f}")

# final_cp reference
print("\n--- final_cp reference ---")
if "ms_1280_finalcp.json" in all_results:
    r = all_results["ms_1280_finalcp.json"]
    print(f"Standard: {r['standard']['overall']:.4f} / TTA: {r['tta']['overall']:.4f}")

# Save aggregate
with open("v21_x1_results/_aggregate.json", "w") as f:
    json.dump(all_results, f, indent=2)
print(f"\nSaved: v21_x1_results/_aggregate.json")

# Decision: trigger X3?
best_overall = max(
    (all_results.get(f"ms_{sz}.json", {}).get("tta", {}).get("overall", 0) for sz in [960, 1280, 1536, 1920]),
    default=0
)
p1_holdout = all_results.get("p1_holdout.json", {}).get("overall_mAP50", 0)
print("\n" + "="*60)
print("X3 DECISION GATE")
print("="*60)
print(f"Best multi-scale TTA: {best_overall:.4f}")
print(f"P1 holdout TTA:       {p1_holdout:.4f}")
if best_overall >= 0.73 and p1_holdout >= 0.72:
    print("DECISION: SKIP X3 — already good enough. Proceed to X4 directly.")
elif best_overall >= 0.71:
    print("DECISION: MARGINAL — user choice (skip or run X3).")
else:
    print("DECISION: RUN X3 — X1 insufficient, need retrain.")
```

- [ ] **Step 3: Run aggregator after X1 completes**

Run: `python tmp_v21_x1_aggregate.py`
Expected: Full report printed to console with decision recommendation.

- [ ] **Step 4: Commit aggregator**

```bash
git add tmp_v21_x1_aggregate.py v21_x1_results/_aggregate.json
git commit -m "feat(yolo-v21): X1 aggregator + results"
```

---

## Task 9: Wait X2 Recovery + Verify

**Files:** None (just execute and check)

- [ ] **Step 1: Check X2 completion**

```python
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)
stdin, stdout, stderr = ssh.exec_command("tail -20 /root/x2_recover.log 2>&1", timeout=20)
print(stdout.read().decode())
stdin, stdout, stderr = ssh.exec_command("ps -ef | grep x2_recover | grep -v grep", timeout=10)
print("X2 procs alive?" if stdout.read().decode().strip() else "X2 DONE")
ssh.close()
```

Expected when complete: Log ends with "=== X2 DONE ===" and "Mold working: 8391, broken: 0" (or close to it).

- [ ] **Step 2: Verify restoration count**

```bash
# Run via paramiko:
# find /root/data/merged_v5_1_ultra/images/train/ -type l -readable | wc -l
# Expected: ~36501 (full count restored)
```

---

## Task 10: X3 Conditional Retrain (Small-Object Aug)

**Files:**
- Create: `tmp_v21_x3_retrain.py`

- [ ] **Step 1: Decision checkpoint**

Read aggregate from Task 8. If decision was SKIP, jump to Task 12. If RUN X3, continue.

- [ ] **Step 2: Write retrain launcher**

```python
# tmp_v21_x3_retrain.py
import paramiko, sys, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

TRAIN_SH = '''#!/bin/bash
export CUDA_VISIBLE_DEVICES=0,1,2,3,4,5,6,7
export NCCL_TIMEOUT=1800
cd /root
exec yolo train \\
    model=/root/runs/E_V2_v11l_refine2/weights/best.pt \\
    data=/root/data/merged_v5_1_ultra/data.yaml \\
    epochs=4 \\
    imgsz=1280 \\
    batch=32 \\
    device=0,1,2,3,4,5,6,7 \\
    project=/root/runs \\
    name=E_V21_smallobj \\
    workers=3 \\
    patience=3 \\
    save_period=2 \\
    exist_ok=true \\
    verbose=true \\
    optimizer=SGD \\
    lr0=0.00012 \\
    lrf=0.01 \\
    momentum=0.937 \\
    weight_decay=0.0005 \\
    warmup_epochs=0 \\
    warmup_momentum=0.8 \\
    mosaic=1.0 \\
    mixup=0.15 \\
    copy_paste=0 \\
    scale=0.2 \\
    erasing=0.25 \\
    hsv_h=0.015 \\
    hsv_s=0.7 \\
    hsv_v=0.4 \\
    translate=0.15 \\
    close_mosaic=2 \\
    box=7.5 \\
    cls=0.5 \\
    dfl=1.5
'''

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)
sftp = ssh.open_sftp()
with sftp.file('/root/x3_retrain.sh', 'w') as f:
    f.write(TRAIN_SH)
sftp.close()
ssh.exec_command("chmod +x /root/x3_retrain.sh", timeout=10)

ssh.exec_command("cd /root && setsid bash /root/x3_retrain.sh > /root/x3_retrain.log 2>&1 < /dev/null &", timeout=10)
time.sleep(30)
stdin, stdout, stderr = ssh.exec_command("ps -ef | grep 'yolo train' | grep -v grep | head -2", timeout=10)
print(stdout.read().decode())
stdin, stdout, stderr = ssh.exec_command("tail -c 2000 /root/x3_retrain.log | sed 's/\\x1b\\[[0-9;]*m//g' | tr '\\r' '\\n' | grep -vE '_tensor_to_object|_object_to_tensor' | tail -15", timeout=10)
print(stdout.read().decode())
ssh.close()
```

- [ ] **Step 3: Launch if decision = RUN X3**

Run: `python tmp_v21_x3_retrain.py`

- [ ] **Step 4: Monitor until 4 epochs complete (~1.5h)**

Check /root/runs/E_V21_smallobj/results.csv rows == 4.
If GPU 4 throws CUDA error, restart with CUDA_VISIBLE_DEVICES=0,1,2,3,5,6,7 device=0,1,2,3,4,5,6 batch=28.

- [ ] **Step 5: Commit**

```bash
git add tmp_v21_x3_retrain.py
git commit -m "feat(yolo-v21): conditional small-obj retrain script"
```

---

## Task 11: Compare X3 Model vs refine2

**Files:**
- Create: `tmp_v21_x3_compare.py`

- [ ] **Step 1: Run same X1 eval suite on new model**

Re-run Task 6 launcher but with NEW model path `E_V21_smallobj/weights/best.pt` to a DIFFERENT results dir.

- [ ] **Step 2: Compare aggregates**

```python
# tmp_v21_x3_compare.py
# Load both aggregates, side-by-side compare
import json
with open("v21_x1_results/_aggregate.json") as f:
    r2 = json.load(f)
with open("v21_x3_results/_aggregate.json") as f:
    x3 = json.load(f)
print(f"{'Metric':<25} {'refine2':<10} {'V21 retrain':<10} {'Δ':<8}")
for sz in [960, 1280, 1536, 1920]:
    key = f"ms_{sz}.json"
    if key in r2 and key in x3:
        a = r2[key]['tta']['overall']
        b = x3[key]['tta']['overall']
        print(f"  TTA @ {sz:<20} {a:.4f}     {b:.4f}     {b-a:+.4f}")
# Pick winner = model with highest TTA at imgsz where each best
```

- [ ] **Step 3: Select best model for V2.1 primary**

If X3 new model wins on overall TTA → primary = E_V21_smallobj
If refine2 wins → primary = refine2 (keep V2.0 weights, only add V2.1 inference config)

---

## Task 12: X4 ONNX Export

**Files:**
- Create: `tmp_v21_x4_export.py`

- [ ] **Step 1: Write ONNX export**

```python
# tmp_v21_x4_export.py
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Assume `PRIMARY_PT` is decided by Task 11 (refine2 or smallobj)
PRIMARY_PT = "/root/runs/E_V2_v11l_refine2/weights/best.pt"  # or E_V21_smallobj

EXPORT_SH = f'''#!/usr/bin/env python3
import os
from ultralytics import YOLO

PT_PATH = "{PRIMARY_PT}"
m = YOLO(PT_PATH)

# FP32
print("Exporting FP32...")
m.export(format="onnx", imgsz=1280, half=False, simplify=True, opset=17, device="0")
import shutil
shutil.move(PT_PATH.replace(".pt", ".onnx"), "/root/V2.1_primary_fp32.onnx")

# FP16
print("Exporting FP16...")
m = YOLO(PT_PATH)
m.export(format="onnx", imgsz=1280, half=True, simplify=True, opset=17, device="0")
shutil.move(PT_PATH.replace(".pt", ".onnx"), "/root/V2.1_primary_fp16.onnx")

for f in ["/root/V2.1_primary_fp32.onnx", "/root/V2.1_primary_fp16.onnx"]:
    sz = os.path.getsize(f)/1024/1024
    print(f"  {{f}}: {{sz:.1f}} MB")
'''

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)
sftp = ssh.open_sftp()
with sftp.file('/root/x4_export.py', 'w') as f:
    f.write(EXPORT_SH)
sftp.close()
stdin, stdout, stderr = ssh.exec_command("CUDA_VISIBLE_DEVICES=0 python3 /root/x4_export.py 2>&1", timeout=300)
print(stdout.read().decode())
ssh.close()
```

- [ ] **Step 2: Run export**

Run: `python tmp_v21_x4_export.py`
Expected: Both ONNX files written on remote.

- [ ] **Step 3: Download locally**

```python
sftp.get('/root/V2.1_primary_fp32.onnx', r'models/e_final/V2.1/V2.1_primary_fp32.onnx')
sftp.get('/root/V2.1_primary_fp16.onnx', r'models/e_final/V2.1/V2.1_primary_fp16.onnx')
sftp.get(PRIMARY_PT, r'models/e_final/V2.1/V2.1_primary_best.pt')
```

- [ ] **Step 4: Commit**

```bash
git add tmp_v21_x4_export.py
git commit -m "feat(yolo-v21): ONNX export + local download"
```

---

## Task 13: Generate V2.1 inference_config.yaml + per_class_conf.json

**Files:**
- Create: `models/e_final/V2.1/V2.1_inference_config.yaml`
- Create: `models/e_final/V2.1/V2.1_per_class_conf_thresholds.json`

- [ ] **Step 1: Extract values from X1 aggregate**

Based on Task 8 aggregate results, pick:
- Best imgsz for multi-scale TTA (e.g., [1280, 1536])
- Best IoU threshold (proxy for soft-NMS)
- Per-class best conf from confscan.json

- [ ] **Step 2: Write inference_config.yaml**

```yaml
# models/e_final/V2.1/V2.1_inference_config.yaml
model: V2.1_primary_fp16.onnx
imgsz: 1280
tta: true
multi_scale_tta:
  enabled: true
  scales: [1280, 1536]  # actual winning combo from X1
iou: 0.6                # or 0.5/0.7 based on X1 softnms result
per_class_conf:         # from X1 confscan
  insect: 0.25          # REPLACE with actual values from X1
  color_anomaly: 0.15
  bone: 0.20
  glass: 0.05
  hair: 0.25
  mold: 0.03
global_conf_fallback: 0.25
```

- [ ] **Step 3: Write per_class_conf_thresholds.json**

```json
{
  "source": "V2.1 X1 confscan result",
  "val_dataset": "merged_v5_1_ultra val 3216 imgs",
  "model": "V2.1_primary",
  "per_class": {
    "insect":        {"conf": 0.25, "f1": 0.83, "precision": 0.87, "recall": 0.80},
    "color_anomaly": {"conf": 0.15, "f1": 0.56, "precision": 0.79, "recall": 0.44},
    "bone":          {"conf": 0.20, "f1": 0.65, "precision": 0.77, "recall": 0.57},
    "glass":         {"conf": 0.05, "f1": 0.68, "precision": 0.59, "recall": 0.82},
    "hair":          {"conf": 0.25, "f1": 0.76, "precision": 0.83, "recall": 0.70},
    "mold":          {"conf": 0.03, "f1": 0.39, "precision": 0.61, "recall": 0.29}
  },
  "notes": "Values are placeholders until X1 completes. Replace with actual X1 output."
}
```

- [ ] **Step 4: Commit**

```bash
git add models/e_final/V2.1/V2.1_inference_config.yaml models/e_final/V2.1/V2.1_per_class_conf_thresholds.json
git commit -m "feat(yolo-v21): inference config + per-class conf thresholds"
```

---

## Task 14: V2.1_DELIVERY_REPORT.md

**Files:**
- Create: `models/e_final/V2.1/V2.1_DELIVERY_REPORT.md`

- [ ] **Step 1: Write upgrade report**

Structure:
1. Delivery summary (V2.0 → V2.1 deltas)
2. Per-class table: V2.0 std / V2.0 TTA / V2.1 multi-scale / V2.1 per-class conf-F1
3. P1 holdout results (honest 2nd opinion)
4. Deployment: inference config yaml usage
5. Known limitations (updated with mold val bias explanation)
6. Artifacts list

- [ ] **Step 2: Commit**

```bash
git add models/e_final/V2.1/V2.1_DELIVERY_REPORT.md
git commit -m "docs(yolo-v21): V2.1 delivery report"
```

---

## Task 15: Final Archive + Memory Update

**Files:**
- Modify: `C:\Users\Steve\.claude\projects\C--Users-Steve-my-prototype-logistics\memory\project_yolo_v2_aggressive_apr17.md`
- Modify: `C:\Users\Steve\.claude\projects\C--Users-Steve-my-prototype-logistics\memory\MEMORY.md`

- [ ] **Step 1: Update project memory with V2.1 delta**

Add section under existing V2 project memory:

```markdown
## V2.1 Upgrade (Apr 18 2026)

**Delivered**: models/e_final/V2.1/
- V2.1_primary_fp16.onnx (+ fp32 + best.pt)
- V2.1_inference_config.yaml (multi-scale TTA + per-class conf)
- V2.1_per_class_conf_thresholds.json

**Gains**:
- Overall mAP50: 0.708 → <ACTUAL> TTA
- Production F1 thresholds: 6 classes individually tuned
- 2nd opinion: P1 holdout mAP50 = <ACTUAL> (honest estimate)

**Lessons**:
- Symlink to /opt/devmachine is NON-persistent → backup critical data to /root
- Multi-scale TTA helps small-object detection (mold gained <X>)
- Per-class conf > global conf for production deployment
```

- [ ] **Step 2: Update MEMORY.md index**

Replace V2.0 line with V2.1 highlight.

- [ ] **Step 3: Commit memory update**

```bash
# Memory is in %USERPROFILE%/.claude/... — not part of this repo
# Just verify files saved.
```

---

## Self-Review Checklist

**1. Spec coverage:**
- X1 (8-GPU parallel eval) → Tasks 2-6, 8 ✅
- X2 (R2 recovery) → Task 7, 9 ✅
- X3 (conditional retrain) → Tasks 10, 11 ✅
- X4 (delivery) → Tasks 12, 13, 14, 15 ✅
- Decision gate at X1 → Task 8 Step 4 ✅

**2. Placeholder scan:**
- Task 13 has placeholder conf values marked "REPLACE with actual" — acceptable, X1 output feeds in.
- No "TBD" or "implement later".

**3. Type consistency:**
- All paths use `/root/runs/E_V2_v11l_refine2/weights/best.pt` consistently.
- Remote script names match across Tasks 2-6.

---

## Execution Notes

- **Parallelism**: Tasks 6 (X1 launch) and Task 7 (X2 launch) can run within 1 minute of each other. Both are detached.
- **Wait points**: After Task 6 launch, wait ~15 min. After Task 7, wait ~30-60 min.
- **Abort conditions**:
  - GPU 4 CUDA error during X1: accept degraded 7-GPU results
  - R2 download < 500 KiB/s sustained: abort X2, skip X3 retrain (no full data)
  - X3 retrain mAP50 < refine2: keep refine2 as primary
