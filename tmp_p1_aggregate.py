import os, json
raw_dir = r'C:\Users\Steve\my-prototype-logistics\models\e_final\p1_raw'
out_path = r'C:\Users\Steve\my-prototype-logistics\models\e_final\p1_classified.json'

all_entries = []
for fname in sorted(os.listdir(raw_dir)):
    if not fname.endswith('.json'): continue
    fpath = os.path.join(raw_dir, fname)
    print(f"Reading {fname}...")
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # data could be a list or dict - handle both
        if isinstance(data, list):
            all_entries.extend(data)
            print(f"  +{len(data)} entries (list)")
        elif isinstance(data, dict):
            # Check if it has a wrapper key like "results" or "entries"
            for key in ('results', 'entries', 'data', 'items'):
                if key in data and isinstance(data[key], list):
                    all_entries.extend(data[key])
                    print(f"  +{len(data[key])} entries (dict.{key})")
                    break
            else:
                all_entries.append(data)
                print(f"  +1 entry (dict)")
    except Exception as e:
        print(f"  ERROR parsing {fname}: {e}")
        # Try line-delimited JSON fallback
        with open(fpath, 'r', encoding='utf-8') as f:
            count = 0
            for line in f:
                line = line.strip().rstrip(',')
                if line.startswith('{') and line.endswith('}'):
                    try:
                        all_entries.append(json.loads(line))
                        count += 1
                    except: pass
            print(f"  +{count} entries (line-delimited)")

print(f"\nTotal entries: {len(all_entries)}")
# Filter usable=true
usable = [e for e in all_entries if e.get("usable") is True]
print(f"Usable: {len(usable)}")

from collections import Counter
c = Counter(e.get("class") for e in usable)
print("By class:")
for cls, n in c.most_common():
    print(f"  {cls}: {n}")

# De-duplicate by filename
seen = set()
dedup = []
for e in usable:
    f = e.get("file", "")
    if f and f not in seen:
        seen.add(f)
        dedup.append(e)
print(f"After dedup: {len(dedup)}")

c2 = Counter(e.get("class") for e in dedup)
print("After dedup by class:")
for cls, n in c2.most_common():
    print(f"  {cls}: {n}")

with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(dedup, f, indent=2, ensure_ascii=False)
print(f"\nSaved: {out_path}")
