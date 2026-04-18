"""V2.2 fine-tune: refine2 + ULTRA + 732 P1 positives (real Bing/Baidu) + strong aug."""
import paramiko, sys, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BUILD_SH = '''#!/bin/bash
set -e
BASE=/root/data/merged_v5_1_ultra
EXT=/root/data/merged_v5_2_extended
OUT=/root/data/merged_v5_5_real

mkdir -p $OUT/images/train $OUT/labels/train

# Link ULTRA train
for d in images labels; do
    for f in $BASE/$d/train/*; do
        ln -sf "$f" "$OUT/$d/train/$(basename $f)" 2>/dev/null || true
    done
done

# Link p1_s* from extended (732 real Bing/Baidu)
count=0
for f in $EXT/images/train/p1_s*.jpg; do
    [ -e "$f" ] || continue
    ln -sf "$f" "$OUT/images/train/$(basename $f)"
    stem=$(basename "$f" .jpg)
    if [ -f "$EXT/labels/train/$stem.txt" ]; then
        ln -sf "$EXT/labels/train/$stem.txt" "$OUT/labels/train/$stem.txt"
        count=$((count+1))
    fi
done
echo "Linked $count P1 files into train"

# Use ULTRA val as-is
ln -sfn $BASE/images/val $OUT/images/val
ln -sfn $BASE/labels/val $OUT/labels/val

# Write yaml
cat > $OUT/data.yaml <<EOF
path: $OUT
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
EOF

# Count train
TRAIN_CT=$(find $OUT/images/train -maxdepth 1 -type l | wc -l)
echo "Total train files in merged_v5_5_real: $TRAIN_CT"
'''

TRAIN_SH = '''#!/bin/bash
export CUDA_VISIBLE_DEVICES=0,1,2,3,5,6,7
export NCCL_TIMEOUT=1800
cd /root
exec yolo train \\
    model=/root/runs/E_V2_v11l_refine2/weights/best.pt \\
    data=/root/data/merged_v5_5_real/data.yaml \\
    epochs=5 \\
    imgsz=1280 \\
    batch=28 \\
    device=0,1,2,3,4,5,6 \\
    project=/root/runs \\
    name=V22_real \\
    workers=3 \\
    patience=4 \\
    save_period=2 \\
    exist_ok=true \\
    verbose=true \\
    optimizer=SGD \\
    lr0=0.00012 \\
    lrf=0.01 \\
    momentum=0.937 \\
    weight_decay=0.0005 \\
    warmup_epochs=0 \\
    mosaic=1.0 \\
    mixup=0.15 \\
    scale=0.3 \\
    erasing=0.25 \\
    hsv_h=0.02 \\
    hsv_s=0.75 \\
    hsv_v=0.5 \\
    translate=0.2 \\
    close_mosaic=2 \\
    box=7.5 \\
    cls=0.5 \\
    dfl=1.5
'''

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)
sftp = ssh.open_sftp()
with sftp.file('/root/v22_build.sh', 'w') as f: f.write(BUILD_SH)
with sftp.file('/root/v22_train.sh', 'w') as f: f.write(TRAIN_SH)
sftp.close()
ssh.exec_command("chmod +x /root/v22_*.sh", timeout=10)

def run(cmd, timeout=120):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    return stdout.read().decode('utf-8', errors='replace').strip()

# Build dataset
print("=== Build merged_v5_5_real ===")
print(run("bash /root/v22_build.sh 2>&1 | tail -5", timeout=300))

# Clean stale Ultralytics label cache so new dataset scanned fresh
run("rm -f /root/data/merged_v5_5_real/labels/train.cache /root/data/merged_v5_5_real/labels/val.cache")

# Launch training
print("\n=== Launch V2.2 training ===")
ssh.exec_command("cd /root && setsid bash /root/v22_train.sh > /root/v22_train.log 2>&1 < /dev/null &", timeout=10)

time.sleep(45)
print("\n=== Procs ===")
print(run("ps -ef | grep 'yolo train' | grep -v grep | head -2", timeout=15))
print("\n=== Log ===")
print(run("tail -c 3500 /root/v22_train.log 2>/dev/null | sed 's/\\x1b\\[[0-9;]*m//g' | tr '\\r' '\\n' | grep -vE '_tensor_to_object|_object_to_tensor|^\\s*$' | tail -15", timeout=15))
print("\n=== GPU ===")
print(run('nvidia-smi --query-gpu=index,utilization.gpu,memory.used --format=csv,noheader', timeout=15))

ssh.close()
