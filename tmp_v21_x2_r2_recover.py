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
echo "=== Probing each chunk for mold (download 10MB header)... ==="
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
print("X2 recovery launched (detached). ETA 30-60 min.")
ssh.close()
