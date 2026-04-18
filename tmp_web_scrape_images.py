"""Web scrape food defect images via Bing image search HTML parsing."""
import urllib.request, urllib.parse, re, os, json, sys, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}

OUTPUT_DIR = r"C:\Users\Steve\my-prototype-logistics\web_test_images"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 6 类 × 2-3 query each
QUERIES = {
    "mold": [
        "moldy bread food", "fuzzy mold on fruit", "green mold cheese"
    ],
    "insect": [
        "insect in food contamination", "fly in food", "bug in flour"
    ],
    "hair": [
        "hair found in food", "strand of hair in meal", "hair in restaurant food"
    ],
    "bone": [
        "bone fragment in food", "small bone in fish fillet", "chicken bone in meal"
    ],
    "glass": [
        "glass shard in food", "glass in bread", "broken glass in product recall"
    ],
    "color_anomaly": [
        "brown spot on apple", "discolored fruit defect", "browning banana spot"
    ],
}

TARGET_PER_CLASS = 10


def scrape_bing_images(query, max_urls=15):
    """Scrape image URLs from Bing image search HTML."""
    encoded = urllib.parse.quote(query)
    url = f"https://www.bing.com/images/search?q={encoded}&form=HDRSC2&first=1"
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  Bing fetch failed: {e}")
        return []

    # Bing image results clickthrough: mediaurl=<encoded URL>
    hrefs = re.findall(r'mediaurl=([^&"\s]+)', html)
    urls = [urllib.parse.unquote(h) for h in hrefs]
    urls = [u for u in urls if u.startswith('http') and len(u) > 30]
    # Dedup, take top
    seen = set()
    out = []
    for u in urls:
        if u in seen: continue
        seen.add(u)
        out.append(u)
        if len(out) >= max_urls: break
    return out


def download_image(url, out_path, max_size=15 * 1024 * 1024):
    """Download one image URL. Return True if success."""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read(max_size)
        if len(data) < 1024:
            return False  # too small, probably error page
        # Verify it's an image (magic bytes)
        if not (data[:3] == b'\xff\xd8\xff' or data[:4] == b'\x89PNG' or data[:6] in (b'GIF87a', b'GIF89a') or data[:4] == b'RIFF'):
            return False
        with open(out_path, 'wb') as f:
            f.write(data)
        return True
    except Exception:
        return False


all_downloaded = []
for cls, queries in QUERIES.items():
    print(f"\n=== {cls} ===")
    cls_dir = os.path.join(OUTPUT_DIR, cls)
    os.makedirs(cls_dir, exist_ok=True)
    downloaded_this_class = 0
    for q in queries:
        if downloaded_this_class >= TARGET_PER_CLASS: break
        print(f"  Query: {q}")
        urls = scrape_bing_images(q, max_urls=15)
        print(f"    {len(urls)} URLs")
        for i, url in enumerate(urls):
            if downloaded_this_class >= TARGET_PER_CLASS: break
            # Derive filename
            ext = '.jpg'  # force jpg extension
            idx = len(os.listdir(cls_dir)) + 1
            fn = f"{cls}_{idx:03d}{ext}"
            out_path = os.path.join(cls_dir, fn)
            if download_image(url, out_path):
                downloaded_this_class += 1
                all_downloaded.append({"class": cls, "url": url, "file": fn})
                print(f"    ✓ {fn}")
            time.sleep(0.3)  # rate limit
        time.sleep(1)
    print(f"  → {downloaded_this_class} images for {cls}")

with open(os.path.join(OUTPUT_DIR, "_manifest.json"), 'w', encoding='utf-8') as f:
    json.dump(all_downloaded, f, indent=2, ensure_ascii=False)

print(f"\n{'=' * 50}")
print(f"Total downloaded: {len(all_downloaded)}")
for cls in QUERIES:
    cls_dir = os.path.join(OUTPUT_DIR, cls)
    n = len(os.listdir(cls_dir))
    print(f"  {cls}: {n}")
print(f"Saved to: {OUTPUT_DIR}")
