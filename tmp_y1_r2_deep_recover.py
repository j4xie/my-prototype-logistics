"""Y1: Deep R2 recovery — scan ALL 81 chunks for mold content, not just first-probe hits."""
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

echo "=== Deep scan ALL 81 chunks ==="
aws s3 ls $PREFIX $R2_EP | awk '{print $4}' > /tmp/chunks_list.txt

# Probe EACH chunk deeper (first 30 MB, look for ANY mold-related path)
ALL_MOLD_CHUNKS=""
for chunk in $(cat /tmp/chunks_list.txt); do
    if [ -f "$CHUNK_DIR/probe2_$chunk" ]; then continue; fi
    aws s3api get-object --bucket cretas --key "datasets_1280_tar/$chunk" \\
        --range "bytes=0-31457280" $R2_EP "$CHUNK_DIR/probe2_$chunk" > /dev/null 2>&1
    if tar -tf "$CHUNK_DIR/probe2_$chunk" 2>/dev/null | grep -qE "mold|MobileMold"; then
        ALL_MOLD_CHUNKS="$ALL_MOLD_CHUNKS $chunk"
        echo "  $chunk: HAS mold (deep)"
    fi
    rm -f "$CHUNK_DIR/probe2_$chunk"
done
echo "Deep-found mold chunks: $ALL_MOLD_CHUNKS"

# Deduplicate against previously-downloaded
NEW_CHUNKS=""
for chunk in $ALL_MOLD_CHUNKS; do
    if [ ! -f "$CHUNK_DIR/$chunk" ]; then
        NEW_CHUNKS="$NEW_CHUNKS $chunk"
    fi
done
echo "NEW chunks to download: $NEW_CHUNKS"

# Download
for chunk in $NEW_CHUNKS; do
    echo "  Downloading $chunk..."
    aws s3 cp "${PREFIX}$chunk" "$CHUNK_DIR/$chunk" $R2_EP
done

# Extract mold paths from all mold chunks
echo "=== Extract mold subpaths from all chunks ==="
mkdir -p $EXTRACT_DIR
for chunk in $ALL_MOLD_CHUNKS; do
    echo "  Extract $chunk..."
    tar -xf "$CHUNK_DIR/$chunk" -C $EXTRACT_DIR --wildcards 'datasets_1280/collected_v2/mold/*' 2>/dev/null || true
    tar -xf "$CHUNK_DIR/$chunk" -C $EXTRACT_DIR --wildcards '*MobileMold*' 2>/dev/null || true
done

# Verify
echo "=== After recovery ==="
ULTRA_TRAIN="/root/data/merged_v5_1_ultra/images/train"
BROKEN=$(find $ULTRA_TRAIN -type l ! -readable 2>/dev/null | wc -l)
WORKING=$(find $ULTRA_TRAIN -type l -readable | wc -l)
echo "Broken symlinks: $BROKEN (was 4432)"
echo "Working symlinks: $WORKING"

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

echo "=== Y1 DONE ==="
'''

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)
sftp = ssh.open_sftp()
with sftp.file('/root/y1_recover.sh', 'w') as f:
    f.write(RECOVER_SH)
sftp.close()
ssh.exec_command("chmod +x /root/y1_recover.sh", timeout=10)

ssh.exec_command("cd /root && setsid bash /root/y1_recover.sh > /root/y1_recover.log 2>&1 < /dev/null &", timeout=10)
print("Y1 deep recovery launched. ETA 30-60 min.")
ssh.close()
