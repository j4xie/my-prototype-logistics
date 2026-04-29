"""X4: Parallel ONNX export (GPU 0) + corrected conf scan (GPU 1)."""
import paramiko, sys, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

REFINE2 = "/root/runs/E_V2_v11l_refine2/weights/best.pt"

# 1. ONNX export script (GPU 0)
EXPORT_SH = f'''#!/bin/bash
export CUDA_VISIBLE_DEVICES=0
cd /root
python3 << 'PYEOF'
import shutil, os
from ultralytics import YOLO
PT = "{REFINE2}"

# FP32
m = YOLO(PT)
m.export(format="onnx", imgsz=1280, half=False, simplify=True, opset=17)
shutil.move(PT.replace(".pt", ".onnx"), "/root/V21_refine2_fp32.onnx")
print(f"FP32: {{os.path.getsize('/root/V21_refine2_fp32.onnx')/1024/1024:.1f}} MB")

# FP16
m = YOLO(PT)
m.export(format="onnx", imgsz=1280, half=True, simplify=True, opset=17)
shutil.move(PT.replace(".pt", ".onnx"), "/root/V21_refine2_fp16.onnx")
print(f"FP16: {{os.path.getsize('/root/V21_refine2_fp16.onnx')/1024/1024:.1f}} MB")
print("ONNX export DONE.")
PYEOF
'''

# 2. Corrected conf scan (GPU 1): runs val at 9 confs, records P/R per class per conf
CONF_SH = f'''#!/bin/bash
export CUDA_VISIBLE_DEVICES=1
cd /root
python3 << 'PYEOF'
import json
from ultralytics import YOLO
CLASS_NAMES = ["insect", "color_anomaly", "bone", "glass", "hair", "mold"]
model = YOLO("{REFINE2}")
CONFS = [0.01, 0.03, 0.05, 0.10, 0.15, 0.20, 0.25, 0.35, 0.50]
results = {{}}
for conf in CONFS:
    print(f"Eval conf={{conf}}...")
    m = model.val(data="/root/data/merged_v5_1_ultra/data.yaml", imgsz=1280, batch=8,
                    conf=conf, iou=0.5, augment=True, verbose=False)
    # Per-class precision / recall / map50
    per_cls = {{}}
    for i in range(6):
        p = float(m.box.p[i]) if i < len(m.box.p) else 0
        r = float(m.box.r[i]) if i < len(m.box.r) else 0
        f1 = 2*p*r/(p+r) if (p+r) > 0 else 0
        per_cls[CLASS_NAMES[i]] = {{"precision": p, "recall": r, "f1": f1,
                                    "mAP50": float(m.box.ap50[i]) if i < len(m.box.ap50) else 0}}
    results[str(conf)] = {{
        "overall_mAP50": float(m.box.map50),
        "per_class": per_cls
    }}
with open("/root/v21_x1_results/confscan_v2.json", "w") as f:
    json.dump(results, f, indent=2)
print("DONE conf scan v2.")
# Print F1-optimal per class
print("\\n=== F1-optimal conf per class ===")
best_conf_per_cls = {{}}
for cls_name in CLASS_NAMES:
    best_f1 = 0
    best_conf = 0.01
    for conf_str, v in results.items():
        f1 = v["per_class"][cls_name]["f1"]
        if f1 > best_f1:
            best_f1 = f1
            best_conf = float(conf_str)
    best_conf_per_cls[cls_name] = {{"conf": best_conf, "f1": best_f1}}
    print(f"  {{cls_name:14s}} conf={{best_conf:.2f}} F1={{best_f1:.3f}}")
with open("/root/v21_x1_results/best_conf_per_class.json", "w") as f:
    json.dump(best_conf_per_cls, f, indent=2)
PYEOF
'''

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)
sftp = ssh.open_sftp()
with sftp.file('/root/x4_export.sh', 'w') as f:
    f.write(EXPORT_SH)
with sftp.file('/root/x4_confscan.sh', 'w') as f:
    f.write(CONF_SH)
sftp.close()
ssh.exec_command("chmod +x /root/x4_export.sh /root/x4_confscan.sh", timeout=10)

# Launch both in parallel (detached)
print("=== Launch ONNX export (GPU 0) ===")
ssh.exec_command("setsid bash /root/x4_export.sh > /root/x4_export.log 2>&1 < /dev/null &", timeout=10)
print("=== Launch conf scan (GPU 1) ===")
ssh.exec_command("setsid bash /root/x4_confscan.sh > /root/x4_confscan.log 2>&1 < /dev/null &", timeout=10)

time.sleep(30)
stdin, stdout, stderr = ssh.exec_command("ps -ef | grep -E 'x4_export|x4_confscan|onnx|val' | grep -v grep | head -6", timeout=10)
print("\n=== Procs ===")
print(stdout.read().decode())
stdin, stdout, stderr = ssh.exec_command("nvidia-smi --query-gpu=index,utilization.gpu,memory.used --format=csv,noheader", timeout=10)
print("=== GPU ===")
print(stdout.read().decode())
ssh.close()
print("\nRunning parallel. ETA export ~2min, conf scan ~10min.")
