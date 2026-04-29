"""
P2: Build merged_v5_2_extended from ULTRA base + P1 positives.

Handles filename truncation on remote (some files lost .jpg extension due to FS limits).
Matches JSON entries to remote files via unique s#### prefix.
"""
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

REMOTE_SCRIPT = '''
# -*- coding: utf-8 -*-
import os, json, shutil, glob, re
from pathlib import Path
from collections import Counter

SRC = "/root/data/merged_v5_1_clean"
DST = "/root/data/merged_v5_2_extended"

# Step 0: Clean if exists (reuse is messy), then create dirs
if os.path.exists(DST):
    print(f"DST {DST} exists, removing for clean rebuild")
    shutil.rmtree(DST)
for sub in ["images/train", "images/val", "labels/train", "labels/val"]:
    os.makedirs(f"{DST}/{sub}", exist_ok=True)

# Step 1: Link/copy ULTRA base into new dataset
# Images: symlink to save space; Labels: copy (we'll add new labels anyway)
print("Copying ULTRA base...")
for split in ["train", "val"]:
    # Images as symlinks
    src_imgs = f"{SRC}/images/{split}"
    img_count = 0
    for f in os.listdir(src_imgs):
        src_path = os.path.realpath(f"{src_imgs}/{f}")
        dst_path = f"{DST}/images/{split}/{f}"
        try:
            os.symlink(src_path, dst_path)
            img_count += 1
        except FileExistsError:
            pass
    print(f"  {split} images linked: {img_count}")

    # Labels as real copies (so we can add without touching src)
    src_lbls = f"{SRC}/labels/{split}"
    lbl_count = 0
    for f in os.listdir(src_lbls):
        if not f.endswith(".txt"):
            continue
        shutil.copy(f"{src_lbls}/{f}", f"{DST}/labels/{split}/{f}")
        lbl_count += 1
    print(f"  {split} labels copied: {lbl_count}")

# Step 2: Load P1 classified positives
with open("/root/p1_classified.json") as f:
    new_positives = json.load(f)
print(f"\\nP1 classified positives: {len(new_positives)}")

# Build index of p1_samples files by s#### stem prefix (handles truncation)
p1_dir = "/root/p1_samples"
p1_files = os.listdir(p1_dir)
print(f"p1_samples total files: {len(p1_files)}")

# Map: "s####" -> actual filename on disk
stem_to_file = {}
for fn in p1_files:
    m = re.match(r"^(s\\d{4})_", fn)
    if m:
        stem = m.group(1)
        stem_to_file[stem] = fn  # Last wins; should be unique per stem
print(f"Unique s#### stems indexed: {len(stem_to_file)}")

CLASS_MAP = {
    "insect": 0,
    "color_anomaly": 1,
    "bone": 2,
    "glass": 3,
    "hair": 4,
    "mold": 5,
}
# bbox_hint -> (xc, yc, w, h) in normalized YOLO coords
BBOX_HINT_MAP = {
    "center":       (0.5, 0.5, 0.4, 0.4),
    "top-left":     (0.25, 0.25, 0.4, 0.4),
    "top-right":    (0.75, 0.25, 0.4, 0.4),
    "bottom-left":  (0.25, 0.75, 0.4, 0.4),
    "bottom-right": (0.75, 0.75, 0.4, 0.4),
    "full":         (0.5, 0.5, 0.9, 0.9),
    None:           (0.5, 0.5, 0.5, 0.5),
}

added = 0
skipped_no_file = 0
skipped_bad_class = 0
skipped_dup = 0
class_added = Counter()

for entry in new_positives:
    fname_json = entry.get("file", "")
    cls = entry.get("class")
    hint = entry.get("bbox_hint") or "center"

    if cls not in CLASS_MAP:
        skipped_bad_class += 1
        continue

    # Find actual file via s#### stem match
    m = re.match(r"^(s\\d{4})_", fname_json)
    if not m:
        skipped_no_file += 1
        continue
    stem = m.group(1)
    actual_fname = stem_to_file.get(stem)
    if actual_fname is None:
        skipped_no_file += 1
        continue

    src_img = f"{p1_dir}/{actual_fname}"
    if not os.path.exists(src_img):
        skipped_no_file += 1
        continue

    cid = CLASS_MAP[cls]
    bb = BBOX_HINT_MAP.get(hint, BBOX_HINT_MAP["center"])
    xc, yc, w, h = bb

    # Use stem-based dst name (guaranteed unique, no truncation risk, no odd chars)
    # e.g. "p1_s0007.jpg"
    new_stem = f"p1_{stem}"
    dst_img = f"{DST}/images/train/{new_stem}.jpg"
    dst_lbl = f"{DST}/labels/train/{new_stem}.txt"

    if os.path.exists(dst_img):
        skipped_dup += 1
        continue

    try:
        os.symlink(src_img, dst_img)
    except Exception as e:
        skipped_no_file += 1
        continue

    with open(dst_lbl, "w") as f:
        f.write(f"{cid} {xc:.6f} {yc:.6f} {w:.6f} {h:.6f}\\n")
    added += 1
    class_added[cls] += 1

print(f"\\nP1 new positives added: {added}")
print(f"  skipped (no file): {skipped_no_file}")
print(f"  skipped (bad class): {skipped_bad_class}")
print(f"  skipped (duplicate): {skipped_dup}")
print(f"Added by class:")
for cls, n in class_added.most_common():
    print(f"  {cls}: {n}")

# Step 3: data.yaml
with open(f"{DST}/data.yaml", "w") as f:
    f.write(f"""path: {DST}
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
""")

# Step 4: clear any stale cache
for c in ["train.cache", "val.cache"]:
    p = f"{DST}/labels/{c}"
    if os.path.exists(p):
        os.remove(p)

# Step 5: Final stats (per-split, per-class instances)
CLS = ["insect","color_anomaly","bone","glass","hair","mold"]
print("\\n=== Final Dataset Stats ===")
for split in ["train", "val"]:
    inst_counts = Counter()
    for lp in glob.glob(f"{DST}/labels/{split}/*.txt"):
        try:
            with open(lp) as f:
                for line in f:
                    parts = line.strip().split()
                    if len(parts) >= 5:
                        inst_counts[int(parts[0])] += 1
        except Exception:
            pass
    total_imgs = len(os.listdir(f"{DST}/images/{split}"))
    total_lbls = len(glob.glob(f"{DST}/labels/{split}/*.txt"))
    parts = [f"{CLS[i]}={inst_counts.get(i, 0)}" for i in range(6)]
    print(f"{split}: imgs={total_imgs} lbls={total_lbls} | " + " ".join(parts))

print("\\n=== P2 Done ===")
'''

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print("Connecting to remote...")
ssh.connect('180.97.68.228', port=46325, username='root', password='Cretas2026!', timeout=15)
sftp = ssh.open_sftp()

# Upload p1_classified.json
local_json = r'C:\Users\Steve\my-prototype-logistics\models\e_final\p1_classified.json'
print(f"Uploading {local_json} -> /root/p1_classified.json")
sftp.put(local_json, '/root/p1_classified.json')
print("Uploaded p1_classified.json")

# Upload remote script
with sftp.file('/root/p2_extend.py', 'w') as f:
    f.write(REMOTE_SCRIPT)
print("Uploaded p2_extend.py")

# Execute
print("\nRunning p2_extend.py on remote...\n")
stdin, stdout, stderr = ssh.exec_command("python3 /root/p2_extend.py 2>&1", timeout=900)
for line in iter(stdout.readline, ""):
    print(line, end='', flush=True)
err = stderr.read().decode('utf-8', errors='replace')
if err:
    print(f"\nSTDERR:\n{err}")

sftp.close()
ssh.close()
print("\n=== done ===")
