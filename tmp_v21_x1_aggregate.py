import paramiko, json, os, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)
sftp = ssh.open_sftp()

os.makedirs("v21_x1_results", exist_ok=True)
stdin, stdout, stderr = ssh.exec_command("ls /root/v21_x1_results/*.json", timeout=10)
for line in stdout.read().decode().strip().split("\n"):
    if line:
        local = f"v21_x1_results/{os.path.basename(line)}"
        sftp.get(line, local)
sftp.close()
ssh.close()

all_results = {}
for f in sorted(os.listdir("v21_x1_results")):
    if f.endswith(".json") and not f.startswith("_"):
        with open(f"v21_x1_results/{f}", encoding='utf-8') as fh:
            all_results[f] = json.load(fh)

print("="*70)
print("X1 AGGREGATION — V2.1 upgrade evaluation")
print("="*70)

# 1. Multi-scale TTA comparison
print("\n--- 1. Multi-scale TTA (refine2) ---")
print(f"{'Imgsz':<8} {'Std':<8} {'TTA':<8} insect  color   bone    glass   hair    mold")
for sz in [960, 1280, 1536, 1920]:
    key = f"ms_{sz}.json"
    if key in all_results:
        r = all_results[key]
        tta = r['tta']
        pc = tta['per_class']
        print(f"  {sz:<6} {r['standard']['overall']:.4f} {tta['overall']:.4f}  {pc.get('insect',0):.4f}  {pc.get('color_anomaly',0):.4f}  {pc.get('bone',0):.4f}  {pc.get('glass',0):.4f}  {pc.get('hair',0):.4f}  {pc.get('mold',0):.4f}")

# 2. IoU sweep (Soft-NMS proxy)
print("\n--- 2. IoU sweep @ imgsz=1280 TTA (proxy for Soft-NMS) ---")
if "softnms.json" in all_results:
    for iou_key, v in all_results["softnms.json"].items():
        pc = v['per_class']
        print(f"  {iou_key:<12}  overall={v['overall']:.4f}  mold={pc.get('mold',0):.4f}  glass={pc.get('glass',0):.4f}")

# 3. Per-class F1 best conf
print("\n--- 3. Per-class F1-optimal conf (production thresholds) ---")
if "confscan.json" in all_results:
    r = all_results["confscan.json"]
    print(f"Overall mAP50 (TTA): {r['overall_mAP50']:.4f}")
    if 'per_class_best_conf' in r:
        for cls, v in r['per_class_best_conf'].items():
            if isinstance(v, dict):
                print(f"  {cls:14s} conf={v['best_conf']:.3f}  F1={v['f1_at_best']:.3f}  P={v.get('precision_at_best',0):.3f}  R={v.get('recall_at_best',0):.3f}")

# 4. P1 holdout
print("\n--- 4. P1 holdout (unseen Bing/Baidu images, auto-labels) ---")
if "p1_holdout.json" in all_results:
    r = all_results["p1_holdout.json"]
    print(f"Num val imgs: {r.get('num_val_imgs', 'N/A')}")
    print(f"Overall mAP50 (TTA): {r['overall_mAP50']:.4f}")
    print(f"Overall mAP50-95: {r.get('overall_mAP50_95', 0):.4f}")
    for cls, v in r['per_class_mAP50'].items():
        print(f"  {cls:14s} {v:.4f}")

# 5. final_cp reference (1280)
print("\n--- 5. final_cp reference @ 1280 ---")
if "ms_1280_finalcp.json" in all_results:
    r = all_results["ms_1280_finalcp.json"]
    pc = r['tta']['per_class']
    print(f"Std: {r['standard']['overall']:.4f}  TTA: {r['tta']['overall']:.4f}")
    print(f"  TTA per-class: insect={pc.get('insect',0):.4f} color={pc.get('color_anomaly',0):.4f} bone={pc.get('bone',0):.4f} glass={pc.get('glass',0):.4f} hair={pc.get('hair',0):.4f} mold={pc.get('mold',0):.4f}")

# Save aggregate
with open("v21_x1_results/_aggregate.json", "w", encoding='utf-8') as f:
    json.dump(all_results, f, indent=2)
print(f"\nSaved: v21_x1_results/_aggregate.json")

# Decision
best_overall = max(
    (all_results.get(f"ms_{sz}.json", {}).get("tta", {}).get("overall", 0) for sz in [960, 1280, 1536, 1920]),
    default=0
)
best_imgsz = max([960,1280,1536,1920], key=lambda sz: all_results.get(f"ms_{sz}.json", {}).get("tta", {}).get("overall", 0))
p1_holdout = all_results.get("p1_holdout.json", {}).get("overall_mAP50", 0)
# Best per-class
best_per_class = {}
for cls in ["insect", "color_anomaly", "bone", "glass", "hair", "mold"]:
    best = 0
    best_src = ""
    for sz in [960, 1280, 1536, 1920]:
        v = all_results.get(f"ms_{sz}.json", {}).get("tta", {}).get("per_class", {}).get(cls, 0)
        if v > best:
            best = v
            best_src = f"ms_{sz}"
    best_per_class[cls] = (best, best_src)

print("\n" + "="*70)
print("DECISION GATE")
print("="*70)
print(f"Best multi-scale TTA overall: {best_overall:.4f} (imgsz={best_imgsz})")
print(f"P1 holdout mAP50:             {p1_holdout:.4f}")
print("\nBest per-class across scales:")
for cls, (v, src) in best_per_class.items():
    print(f"  {cls:14s} {v:.4f} ({src})")

baseline_refine2_1280_tta = all_results.get("ms_1280.json", {}).get("tta", {}).get("overall", 0)
print(f"\nrefine2 baseline @ 1280 TTA:  {baseline_refine2_1280_tta:.4f}")
print(f"V2.1 best multi-scale:         {best_overall:.4f}  (Δ={best_overall - baseline_refine2_1280_tta:+.4f})")

if best_overall >= 0.73:
    print("\n>>> DECISION: SKIP X3 — X1 inference tricks sufficient. Proceed to X4.")
elif best_overall >= 0.71:
    print("\n>>> DECISION: MARGINAL — user chooses (X3 worth 1.5h risk?).")
else:
    print("\n>>> DECISION: RUN X3 — X1 insufficient, need small-obj retrain.")
