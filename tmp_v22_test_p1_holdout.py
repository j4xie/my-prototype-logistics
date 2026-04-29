"""Eval V2.2 on P1 holdout dataset (Bing/Baidu unseen images)."""
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SCRIPT = '''#!/usr/bin/env python3
import json
from ultralytics import YOLO

MODELS = {
    "v21_refine2": "/root/runs/E_V2_v11l_refine2/weights/best.pt",
    "v22_real":    "/root/runs/V22_real/weights/best.pt",
}

P1_VAL_YAML = "/root/data/p1_holdout_val/data.yaml"
ULTRA_VAL = "/root/data/merged_v5_1_ultra/data.yaml"
CLASSES = ["insect", "color_anomaly", "bone", "glass", "hair", "mold"]

results = {}
for name, pt in MODELS.items():
    print(f"\\n=== {name} ===")
    model = YOLO(pt)
    # ULTRA val (standard)
    print(f"  Evaluating on ULTRA val (TTA)...")
    m_ultra = model.val(data=ULTRA_VAL, imgsz=1280, batch=8, conf=0.001, iou=0.5,
                         augment=True, verbose=False)
    # P1 holdout
    print(f"  Evaluating on P1 holdout (TTA)...")
    m_p1 = model.val(data=P1_VAL_YAML, imgsz=1280, batch=8, conf=0.001, iou=0.5,
                      augment=True, verbose=False)
    results[name] = {
        "ultra_val": {
            "overall": float(m_ultra.box.map50),
            "per_class": {CLASSES[i]: float(m_ultra.box.ap50[i]) for i in range(6)},
        },
        "p1_holdout": {
            "overall": float(m_p1.box.map50),
            "per_class": {CLASSES[i]: float(m_p1.box.ap50[i]) for i in range(6)},
        },
    }

with open("/root/v22_p1_compare.json", "w") as f:
    json.dump(results, f, indent=2)

# Print comparison
print("\\n" + "=" * 80)
print("COMPARISON: V2.1 refine2 vs V2.2 (fine-tuned with 732 P1 real images)")
print("=" * 80)

for dataset in ["ultra_val", "p1_holdout"]:
    print(f"\\n--- {dataset.upper()} ---")
    print(f"{'class':<15} {'V2.1':<10} {'V2.2':<10} {'Δ':<10}")
    v21_vals = results["v21_refine2"][dataset]
    v22_vals = results["v22_real"][dataset]
    for c in ["overall"] + CLASSES:
        if c == "overall":
            a, b = v21_vals["overall"], v22_vals["overall"]
        else:
            a = v21_vals["per_class"][c]
            b = v22_vals["per_class"][c]
        d = b - a
        arrow = "✅" if d > 0.01 else ("⬇️" if d < -0.01 else "=")
        print(f"  {c:<14} {a:.4f}    {b:.4f}    {d:+.4f}  {arrow}")
'''

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)
sftp = ssh.open_sftp()
with sftp.file('/root/v22_eval.py', 'w') as f:
    f.write(SCRIPT)
sftp.close()

print("Script uploaded. Run after V2.2 training completes.")
ssh.close()
