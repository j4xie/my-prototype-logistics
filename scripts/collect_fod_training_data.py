#!/usr/bin/env python3
"""
Food Foreign Object Detection — Training Data Collector V2
===========================================================
Collects images for 6 defect classes + normal (negative samples).

Categories & targets:
  HIGH:    hair (500+), mold (500+)
  MEDIUM:  color_anomaly (300+), bone (200+), glass (200+), insect (200+)
  NEG:     normal (500+)

Sources:
  1. Existing local datasets (食品标注/datasets/) — copy already-downloaded data
  2. Roboflow Universe (SDK)
  3. Kaggle (API)
  4. Search engine crawling (icrawler: Bing/Baidu)
  5. Direct URL downloads (academic)

Usage:
    pip install roboflow kaggle icrawler requests tqdm pillow

    export ROBOFLOW_API_KEY="your_key"   # https://app.roboflow.com → Settings → API
    export KAGGLE_USERNAME="xxx"
    export KAGGLE_KEY="xxx"              # https://www.kaggle.com/settings → API

    python scripts/collect_fod_training_data.py --all
    python scripts/collect_fod_training_data.py --crawl --category hair
    python scripts/collect_fod_training_data.py --local       # copy from existing datasets
    python scripts/collect_fod_training_data.py --validate
    python scripts/collect_fod_training_data.py --summary
"""

import argparse
import csv
import hashlib
import json
import os
import shutil
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests
from tqdm import tqdm

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_ROOT = PROJECT_ROOT / "食品标注" / "datasets" / "collected_v2"
EXISTING_ROOT = PROJECT_ROOT / "食品标注" / "datasets"

CATEGORIES = ["hair", "mold", "color_anomaly", "bone", "glass", "insect", "normal"]

TARGETS = {
    "hair": 500, "mold": 500, "color_anomaly": 300,
    "bone": 200, "glass": 200, "insect": 200, "normal": 500,
}

# ── Colour helpers ───────────────────────────────────────────────────────────
def _ansi(code: str) -> str:
    if sys.platform == "win32":
        try:
            import ctypes; kernel = ctypes.windll.kernel32
            kernel.SetConsoleMode(kernel.GetStdHandle(-11), 7)
        except Exception: return ""
    return f"\033[{code}m"

R = _ansi("0"); B = _ansi("1"); G = _ansi("32"); C = _ansi("36"); Y = _ansi("33"); RED = _ansi("31")

def info(msg): print(f"{C}[INFO]{R}  {msg}")
def ok(msg):   print(f"{G}[ OK]{R}  {msg}")
def warn(msg): print(f"{Y}[WARN]{R}  {msg}")
def err(msg):  print(f"{RED}[ERR ]{R}  {msg}")
def header(msg): print(f"\n{B}{C}{'='*64}{R}\n{B}  {msg}{R}\n{'='*64}")

# ── Source log (provenance tracking) ─────────────────────────────────────────
def log_source(category: str, filename: str, source: str, url: str = ""):
    log_path = OUTPUT_ROOT / category / "source_log.csv"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    write_header = not log_path.exists()
    with open(log_path, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if write_header:
            w.writerow(["filename", "source", "url", "timestamp"])
        w.writerow([filename, source, url, time.strftime("%Y-%m-%d %H:%M:%S")])

def _count_images(d: Path) -> int:
    if not d.exists(): return 0
    return sum(1 for _ in d.rglob("*") if _.suffix.lower() in (".jpg", ".jpeg", ".png"))


# ═════════════════════════════════════════════════════════════════════════════
# 0. COPY FROM EXISTING LOCAL DATASETS
# ═════════════════════════════════════════════════════════════════════════════

# Map: existing subdirectory → target category
# These are datasets already downloaded in 食品标注/datasets/
LOCAL_COPY_MAP = [
    # ── Already sorted data (highest quality) ──
    ("sorted/defect/hair_fiber",       "hair",          "sorted-v1"),
    ("sorted/defect/mold",             "mold",          "sorted-v1"),
    ("sorted/defect/color_anomaly",    "color_anomaly", "sorted-v1"),
    ("sorted/normal",                  "normal",        "sorted-v1"),

    # ── Roboflow datasets (already downloaded with YOLO labels) ──
    ("roboflow/foreign-matter-2.1-plus",   "hair",     "roboflow-local"),  # has hair class
    ("roboflow/rf100-peanuts-mold",        "mold",     "roboflow-local"),
    ("roboflow/canned-food-surface-defect","color_anomaly","roboflow-local"),
    ("roboflow/bone-finder",               "bone",     "roboflow-local"),
    ("roboflow/cockroach-detection",       "insect",   "roboflow-local"),
    ("roboflow/flying-insect-detection",   "insect",   "roboflow-local"),
    ("roboflow/rice-insect-detection",     "insect",   "roboflow-local"),
    ("roboflow/glass-detection-binary",    "glass",    "roboflow-local"),
    ("roboflow/food-quality-inspection",   "normal",   "roboflow-local"),
    ("roboflow/food-waste-detection",      "bone",     "roboflow-local"),  # extract Bone class
    ("roboflow/foreign-matter-2.1",        "hair",     "roboflow-local"),  # general foreign matter

    # ── Kaggle datasets (already downloaded) ──
    ("kaggle/glass/broken-glass-small",                        "glass",  "kaggle-local"),
    ("kaggle/glass/synthetic-broken-glass-conveyor",           "glass",  "kaggle-local"),

    # ── DMEOI (oil contamination → color_anomaly) ──
    ("dmeoi",                              "color_anomaly", "dmeoi-local"),
]


def copy_local_datasets(categories: list[str] | None = None):
    """Copy images from already-downloaded local datasets into the collection."""
    header("Copy from Existing Local Datasets")

    for rel_path, cat, source_tag in LOCAL_COPY_MAP:
        if categories and cat not in categories:
            continue

        src = EXISTING_ROOT / rel_path
        if not src.exists():
            warn(f"  [SKIP] {rel_path} not found")
            continue

        dest = OUTPUT_ROOT / cat / "local" / rel_path.replace("/", "_")
        if dest.exists() and _count_images(dest) > 0:
            info(f"  [SKIP] {rel_path} → already copied ({_count_images(dest)} images)")
            continue

        dest.mkdir(parents=True, exist_ok=True)
        count = 0
        for img in src.rglob("*"):
            if img.suffix.lower() not in (".jpg", ".jpeg", ".png"):
                continue
            if "_rejected" in str(img):
                continue
            target = dest / img.name
            if not target.exists():
                shutil.copy2(str(img), str(target))
                count += 1

        if count > 0:
            ok(f"  {rel_path} → {cat}/ ({count} images)")
        else:
            info(f"  {rel_path} → 0 new images")


# ═════════════════════════════════════════════════════════════════════════════
# 1. ROBOFLOW UNIVERSE DOWNLOADER
# ═════════════════════════════════════════════════════════════════════════════

# (workspace, project_slug, version, category, expected, description)
ROBOFLOW_DATASETS = [
    # ── hair (SCARCEST CLASS — every source counts) ──
    ("ai-detections",                  "hair-strands-detection-m0iy8", 1, "hair",
     "~796", "Hair strand detection with bboxes — BEST SOURCE"),
    ("foodsafety-5wrjn",              "food-safety-qjyzs",        1, "hair",
     "~219", "Food safety dataset (may contain hair class)"),
    ("fooddefects",                   "food-defects-ouetf",        1, "hair",
     "~180", "Food defects (general contamination)"),
    ("naufalcv",                      "strand-hair",               1, "hair",
     "~34", "Strand hair detection (small supplement)"),

    # ── mold (abundant) ──
    ("mold-bread",                    "mold-bread-b03lw",          1, "mold",
     "~1000", "Mold bread detection with bboxes"),
    ("project-kecerdasan-buatan",     "bread-mold-detection-zbka6", 1, "mold",
     "~924", "Bread mold detection"),
    ("gopletzzz",                     "bread-mold-detection-55dam", 1, "mold",
     "~492", "Bread mold detection"),
    ("kombuczara",                    "mold-bsgon",                9, "mold",
     "~463", "General mold detection (v9)"),
    ("detection-kuktj",               "food-quality-analysis-wnjao", 1, "mold",
     "~500", "Food quality analysis (fresh/rotten)"),

    # ── glass ──
    ("recyclestuff",                  "updated-recycling-dataset",  1, "glass",
     "~4000", "Recycling dataset with glass_shard class"),
    ("waste-detection-gt6wy",         "clear-broken-glass-0fj4v",  1, "glass",
     "~247", "Clear broken glass detection"),

    # ── insect ──
    ("kitchen-hygiene-efuu5",         "kitchenhygiene",            2, "insect",
     "~9400", "Kitchen hygiene — cockroach+rat in food context"),
    ("intelligent-systems",           "fly-detector",              1, "insect",
     "~3000", "Large fly detector dataset"),
    ("roboflow-100",                  "insects-mytwu",             1, "insect",
     "~700", "RF100 insects dataset"),
]


def download_roboflow_datasets(api_key: str, categories: list[str] | None = None):
    """Download Roboflow datasets not already available locally."""
    header("Roboflow Universe Downloads")

    try:
        from roboflow import Roboflow
    except ImportError:
        err("roboflow not installed. Run: pip install roboflow"); return

    rf = Roboflow(api_key=api_key)

    for ws, slug, ver, cat, expected, desc in ROBOFLOW_DATASETS:
        if categories and cat not in categories:
            continue

        dest = OUTPUT_ROOT / cat / "roboflow" / slug
        if dest.exists() and _count_images(dest) > 0:
            info(f"  [SKIP] {slug} already downloaded ({_count_images(dest)} images)")
            continue

        dest.mkdir(parents=True, exist_ok=True)
        info(f"  Downloading {slug} ({expected}) → {cat}/")

        try:
            project = rf.workspace(ws).project(slug)
            project.version(ver).download("yolov8", location=str(dest))
            n = _count_images(dest)
            ok(f"  {slug} → {n} images")
            for img in dest.rglob("*"):
                if img.suffix.lower() in (".jpg", ".jpeg", ".png"):
                    log_source(cat, img.name, f"roboflow/{ws}/{slug}",
                               f"https://universe.roboflow.com/{ws}/{slug}")
        except Exception as e:
            err(f"  {slug}: {e}")


# ═════════════════════════════════════════════════════════════════════════════
# 2. KAGGLE DATASET DOWNLOADER
# ═════════════════════════════════════════════════════════════════════════════

# (kaggle_id, category, expected, description, subfolder_filter)
# subfolder_filter: None = download all, or a list of subdirs to keep
KAGGLE_DATASETS = [
    # ── mold ──
    ("teranekerimova/moldy-bread-image-dataset",       "mold",
     "~200",  "Moldy bread images", None),
    ("swoyam2609/fresh-and-stale-classification",      "mold",
     "~2000", "Fresh vs stale (rotten class → mold)", ["stale"]),
    ("nourabdoun/fruits-quality-fresh-vs-rotten",      "mold",
     "~3000", "Fresh vs rotten fruits", ["rotten"]),
    ("ulnnproject/food-freshness-dataset",             "mold",
     "~1000", "Food freshness dataset", None),
    ("muhammad0subhan/fruit-and-vegetable-disease-healthy-vs-rotten", "mold",
     "~2000", "Fruit & veg disease (rotten class)", ["rotten"]),
    ("maheen00shahid/fresh-and-spoiled-food-image-dataset", "mold",
     "~500",  "Fresh vs spoiled food", ["spoiled"]),
    ("sriramr/fruits-fresh-and-rotten-for-classification", "mold",
     "~6000", "Fruits fresh & rotten classification", None),

    # ── glass ──
    ("burakyasinartiran/brokenglasspiecesdetection",   "glass",
     "~1000", "Broken glass pieces detection (YOLO labels)", None),
    ("ktgiahieu/brokenglass",                          "glass",
     "~500",  "Broken glass dataset", None),
    ("princypatel9/broken-glass",                      "glass",
     "~300",  "Broken glass images", None),

    # ── insect ──
    ("ildaron/tracking-a-cockroach-at-home",           "insect",
     "~500",  "Cockroach tracking video frames", None),
    ("sauraab/dataset-for-ant-bee-cockroach-spider-images", "insect",
     "~2000", "Ant/bee/cockroach/spider images", ["cockroach"]),
    ("tarundalal/dangerous-insects-dataset",           "insect",
     "~3000", "Dangerous farm insects", None),

    # ── bone (very scarce) ──
    ("crowww/meat-quality-assessment-based-on-deep-learning", "bone",
     "~2313", "Meat quality (spoiled class useful)", None),

    # ── mold (additional Kaggle sources) ──
    ("luuken/fresh-moldy-bread",                               "mold",
     "~200",  "Fresh vs moldy bread (MIT license)", None),
    ("namphamdinh/mobilemold",                                 "mold",
     "~4941", "MobileMold: smartphone microscope mold images", None),

    # ── insect (additional Kaggle) ──
    ("leonidkulyk/ip102-yolov5",                               "insect",
     "~19000", "IP102 insect pest recognition (YOLO format)", None),

    # ── normal ──
    ("trolukovich/food11-image-dataset",                       "normal",
     "~16643", "Food-11: 11 food categories", None),
]


def download_kaggle_datasets(categories: list[str] | None = None):
    """Download Kaggle datasets."""
    header("Kaggle Dataset Downloads")

    try:
        from kaggle.api.kaggle_api_extended import KaggleApi
    except ImportError:
        err("kaggle not installed. Run: pip install kaggle"); return

    kaggle_json = Path.home() / ".kaggle" / "kaggle.json"
    has_env = os.environ.get("KAGGLE_USERNAME") and os.environ.get("KAGGLE_KEY")
    if not kaggle_json.exists() and not has_env:
        err("Kaggle credentials not found.")
        print("  Option 1: export KAGGLE_USERNAME=xxx KAGGLE_KEY=xxx")
        print("  Option 2: Create ~/.kaggle/kaggle.json")
        print("  Get key: https://www.kaggle.com/settings → API → Create New Token")
        return

    api = KaggleApi()
    api.authenticate()

    for entry in KAGGLE_DATASETS:
        dataset_id, cat, expected, desc = entry[0], entry[1], entry[2], entry[3]
        subfolder_filter = entry[4] if len(entry) > 4 else None

        if categories and cat not in categories:
            continue

        short_name = dataset_id.split("/")[-1]
        dest = OUTPUT_ROOT / cat / "kaggle" / short_name
        if dest.exists() and _count_images(dest) > 0:
            info(f"  [SKIP] {short_name} ({_count_images(dest)} images)")
            continue

        dest.mkdir(parents=True, exist_ok=True)
        info(f"  {dataset_id} ({expected}) → {cat}/")

        try:
            api.dataset_download_files(dataset_id, path=str(dest), unzip=True)
            n = _count_images(dest)
            ok(f"  {short_name} → {n} images")

            # If filter specified, remove unwanted subdirectories
            if subfolder_filter:
                _filter_subdirs(dest, subfolder_filter)

            for img in dest.rglob("*"):
                if img.suffix.lower() in (".jpg", ".jpeg", ".png"):
                    log_source(cat, img.name, f"kaggle/{dataset_id}",
                               f"https://www.kaggle.com/datasets/{dataset_id}")
        except Exception as e:
            err(f"  {short_name}: {e}")


def _filter_subdirs(root: Path, keep_names: list[str]):
    """Keep only subdirectories whose name contains one of keep_names (case-insensitive)."""
    keep_lower = [k.lower() for k in keep_names]
    for child in list(root.iterdir()):
        if child.is_dir():
            if not any(k in child.name.lower() for k in keep_lower):
                shutil.rmtree(str(child), ignore_errors=True)


# ═════════════════════════════════════════════════════════════════════════════
# 3. IMAGE SEARCH CRAWLER (icrawler: Bing / Baidu)
# ═════════════════════════════════════════════════════════════════════════════

# (query, max_images) per category
# Strategy: diverse keywords × 2 engines = broad coverage
CRAWL_QUERIES = {
    # NOTE: Search engine crawling has ~15-30% relevance (per audit).
    # Queries must be very specific about contamination/complaint/defect
    # to avoid generic food photography noise.
    "hair": [
        # English — "complaint" / "found in" / "contaminated" keywords
        # boost relevance vs generic food closeups
        ('"hair found in food"', 120),
        ('"hair contamination" food complaint', 120),
        ('"foreign body" hair food recall', 80),
        ('"strand of hair" food package complaint', 80),
        ('hair fiber food safety violation FDA', 80),
        ('food recall hair contamination USDA', 60),
        ('"thread in food" contamination', 60),
        # Chinese — consumer complaint forums (黑猫投诉, 小红书)
        ("黑猫投诉 食品异物 头发", 120),
        ("食品毛发异物 投诉 实拍", 120),
        ("外卖吃出头发 照片", 100),
        ("食物里发现头发 投诉", 100),
        ("餐饮异物投诉 毛发", 80),
        ("小红书 食品有头发", 80),
        ("食品安全 毛发污染 检测", 60),
    ],
    "mold": [
        # English
        ("moldy bread green mold closeup", 120),
        ("moldy food contamination spoiled", 120),
        ("mold growth on meat product", 80),
        ("fuzzy mold on fruit vegetable", 80),
        ("white mold cheese bread spoiled", 80),
        ("black mold food package recalled", 60),
        ("moldy canned food expired", 60),
        # Chinese
        ("发霉面包 长毛 特写", 120),
        ("食品发霉 变质 投诉", 120),
        ("水果发霉 霉斑 照片", 80),
        ("肉制品霉变 过期", 80),
        ("冷冻食品发霉 投诉", 60),
        ("食品霉菌 检测 不合格", 60),
    ],
    "color_anomaly": [
        ("food discoloration contamination defect", 80),
        ("meat green discoloration spoiled", 80),
        ("food product color defect inspection", 60),
        ("oxidation brown spot food surface", 60),
        ("食品变色 不合格 检测", 80),
        ("肉制品变色 变绿", 60),
        ("食品颜色异常 投诉", 60),
    ],
    "bone": [
        ('"bone fragment" found in food', 100),
        ('"fish bone" food complaint', 100),
        ('"chicken bone" food contamination', 80),
        ('bone shard meat product recall', 60),
        ("食品异物 骨头碎片 投诉", 100),
        ("吃出骨头 鱼骨 投诉", 100),
        ("肉制品 骨头碎片 照片", 80),
    ],
    "glass": [
        ('"glass fragment" found in food', 100),
        ('"broken glass" food contamination recall', 100),
        ('glass shard food package complaint', 80),
        ('glass contamination food factory conveyor', 60),
        ("食品异物 玻璃碎片 投诉", 100),
        ("瓶装食品 碎玻璃 照片", 80),
        ("食品中发现玻璃 投诉", 80),
    ],
    "insect": [
        ('"cockroach in food" complaint', 100),
        ('"bug in food" contamination photo', 100),
        ('"insect found in food" restaurant', 80),
        ('fly in food complaint', 60),
        ('worm larvae food contamination', 60),
        ("外卖吃出蟑螂 投诉", 100),
        ("食品异物 虫子 实拍", 100),
        ("食品中发现虫子 投诉", 80),
        ("苍蝇 食品污染 照片", 60),
    ],
    "normal": [
        # Conveyor / factory / packaging views (negative samples)
        ("food factory conveyor belt product", 100),
        ("food quality inspection station photo", 80),
        ("packaged food product top view", 80),
        ("meat packaging factory top down", 60),
        ("bakery production line bread", 60),
        ("frozen food package product photo", 60),
        ("canned food product clean", 60),
        # Chinese
        ("食品生产线 传送带 产品", 80),
        ("食品包装 合格产品 照片", 80),
        ("食品工厂 质量检测", 60),
        ("肉制品包装 成品图", 60),
    ],
}


def crawl_images(categories: list[str] | None = None, engines: list[str] | None = None):
    """Crawl images from search engines using icrawler."""
    header("Image Search Crawling (icrawler)")

    if engines is None:
        engines = ["bing", "baidu"]

    try:
        from icrawler.builtin import BingImageCrawler, BaiduImageCrawler, GoogleImageCrawler
    except ImportError:
        err("icrawler not installed. Run: pip install icrawler"); return

    crawler_map = {
        "bing": BingImageCrawler,
        "baidu": BaiduImageCrawler,
        "google": GoogleImageCrawler,
    }

    for cat, queries in CRAWL_QUERIES.items():
        if categories and cat not in categories:
            continue

        info(f"--- Crawling for: {cat} ({len(queries)} queries) ---")

        for query, max_num in queries:
            for engine_name in engines:
                if engine_name not in crawler_map:
                    continue

                dirname = _safe_dirname(query)
                dest = OUTPUT_ROOT / cat / "crawled" / engine_name / dirname
                existing = len(list(dest.glob("*"))) if dest.exists() else 0
                if existing >= max_num * 0.7:
                    continue  # Already mostly downloaded

                dest.mkdir(parents=True, exist_ok=True)
                info(f"  [{engine_name}] '{query}' (max {max_num})")

                try:
                    crawler = crawler_map[engine_name](
                        storage={"root_dir": str(dest)},
                        downloader_threads=4,
                    )
                    crawler.crawl(
                        keyword=query,
                        max_num=max_num,
                        min_size=(200, 200),
                        file_idx_offset="auto",
                    )
                    count = len(list(dest.glob("*")))
                    if count > 0:
                        ok(f"  → {count} images")
                    for img in dest.iterdir():
                        if img.suffix.lower() in (".jpg", ".jpeg", ".png"):
                            log_source(cat, img.name, f"crawl/{engine_name}",
                                       f"search:{engine_name}:{query}")
                except Exception as e:
                    err(f"  {engine_name}/{query[:40]}: {e}")

                time.sleep(1.5)  # Rate limiting


def _safe_dirname(s: str) -> str:
    return "".join(c if c.isalnum() or c in " _-" else "_" for c in s).strip()[:80]


# ═════════════════════════════════════════════════════════════════════════════
# 4. DIRECT URL DOWNLOADS (academic)
# ═════════════════════════════════════════════════════════════════════════════

DIRECT_DOWNLOADS = [
    # Mendeley: Food Mold Dataset (~2050 images, CC BY 4.0)
    ("https://data.mendeley.com/datasets/wkgprmn5tz/1",
     "mold", "Mendeley Food Mold Dataset (~2050 images, DOI:10.3390/foods12010195)", "manual"),

    # MVTec AD — hazelnut/bottle categories (registration required)
    ("https://www.mvtec.com/company/research/datasets/mvtec-ad",
     "color_anomaly", "MVTec AD (hazelnut+bottle anomaly, CC BY-NC-SA 4.0)", "manual"),
]


def download_direct(categories: list[str] | None = None):
    header("Direct / Academic Downloads")
    for url, cat, desc, action in DIRECT_DOWNLOADS:
        if categories and cat not in categories:
            continue
        dest = OUTPUT_ROOT / cat / "direct"
        dest.mkdir(parents=True, exist_ok=True)
        if action == "manual":
            info(f"  [MANUAL] {desc}")
            print(f"    URL: {url}")
            print(f"    Download to: {dest}")
            readme = dest / "DOWNLOAD_INSTRUCTIONS.txt"
            if not readme.exists():
                readme.write_text(f"{desc}\nURL: {url}\nDownload and extract into: {dest}\n",
                                  encoding="utf-8")


# ═════════════════════════════════════════════════════════════════════════════
# 5. VALIDATION & DEDUPLICATION
# ═════════════════════════════════════════════════════════════════════════════

def validate_and_deduplicate(categories: list[str] | None = None, min_size: int = 200):
    """Validate image quality, reject corrupt/tiny/duplicate images."""
    header("Validation & Deduplication")

    try:
        from PIL import Image
    except ImportError:
        err("Pillow not installed. Run: pip install Pillow"); return

    for cat in CATEGORIES:
        if categories and cat not in categories:
            continue
        cat_dir = OUTPUT_ROOT / cat
        if not cat_dir.exists():
            continue

        info(f"  Validating {cat}/...")
        seen_hashes: set[str] = set()
        reject_dir = cat_dir / "_rejected"
        reject_dir.mkdir(exist_ok=True)

        stats = {"total": 0, "valid": 0, "corrupt": 0, "small": 0, "dup": 0}

        for img_path in sorted(cat_dir.rglob("*")):
            if img_path.suffix.lower() not in (".jpg", ".jpeg", ".png", ".bmp", ".webp"):
                continue
            if "_rejected" in str(img_path):
                continue

            stats["total"] += 1

            # Can we open it?
            try:
                with Image.open(img_path) as im:
                    w, h = im.size
            except Exception:
                stats["corrupt"] += 1
                _reject(img_path, reject_dir, "corrupt"); continue

            # Resolution check
            if w < min_size or h < min_size:
                stats["small"] += 1
                _reject(img_path, reject_dir, "too_small"); continue

            # Duplicate check (MD5)
            fhash = _file_md5(img_path)
            if fhash in seen_hashes:
                stats["dup"] += 1
                _reject(img_path, reject_dir, "duplicate"); continue
            seen_hashes.add(fhash)

            stats["valid"] += 1

        target = TARGETS.get(cat, 200)
        status = G + "PASS" + R if stats["valid"] >= target else Y + "LOW" + R
        print(f"    {cat:>15}: {stats['valid']:>5} valid  "
              f"(reject: {stats['corrupt']}c {stats['small']}s {stats['dup']}d)  [{status}]")


def _reject(img_path: Path, reject_dir: Path, reason: str):
    dest = reject_dir / reason
    dest.mkdir(exist_ok=True)
    try: shutil.move(str(img_path), str(dest / img_path.name))
    except Exception: pass

def _file_md5(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""): h.update(chunk)
    return h.hexdigest()


# ═════════════════════════════════════════════════════════════════════════════
# 6. FLATTEN — Copy all valid images into flat category folders
# ═════════════════════════════════════════════════════════════════════════════

def flatten_output(categories: list[str] | None = None):
    """Create flat output folders: output/flat/{category}/ with all valid images."""
    header("Flatten to Category Folders")

    flat_root = OUTPUT_ROOT / "flat"
    flat_root.mkdir(exist_ok=True)

    for cat in CATEGORIES:
        if categories and cat not in categories:
            continue
        cat_dir = OUTPUT_ROOT / cat
        if not cat_dir.exists():
            continue

        flat_dir = flat_root / cat
        flat_dir.mkdir(exist_ok=True)

        idx = len(list(flat_dir.glob("*")))  # Continue numbering
        copied = 0
        seen = set(f.name for f in flat_dir.iterdir())

        for img in cat_dir.rglob("*"):
            if img.suffix.lower() not in (".jpg", ".jpeg", ".png"):
                continue
            if "_rejected" in str(img) or "flat" in str(img):
                continue

            # Rename to avoid collisions: {category}_{index:05d}.jpg
            ext = img.suffix.lower()
            if ext == ".jpeg": ext = ".jpg"
            new_name = f"{cat}_{idx:05d}{ext}"
            while new_name in seen:
                idx += 1
                new_name = f"{cat}_{idx:05d}{ext}"

            shutil.copy2(str(img), str(flat_dir / new_name))
            seen.add(new_name)
            idx += 1
            copied += 1

        target = TARGETS.get(cat, 200)
        total = len(list(flat_dir.glob("*")))
        status = G + "OK" + R if total >= target else Y + str(total) + "/" + str(target) + R
        ok(f"  {cat}: {total} images [{status}]")

    print(f"\n  Flat output: {flat_root}")


# ═════════════════════════════════════════════════════════════════════════════
# 7. SUMMARY
# ═════════════════════════════════════════════════════════════════════════════

def print_summary():
    header("Collection Summary")
    print(f"  {'Category':>15}  {'Collected':>10}  {'Target':>8}  {'Status':>8}")
    print(f"  {'─'*15}  {'─'*10}  {'─'*8}  {'─'*8}")

    total = 0
    for cat in CATEGORIES:
        cat_dir = OUTPUT_ROOT / cat
        if not cat_dir.exists():
            count = 0
        else:
            count = _count_images(cat_dir)
            # Subtract rejected
            rej = cat_dir / "_rejected"
            if rej.exists():
                count -= _count_images(rej)
            # Subtract flat (to avoid double-counting)
            flat = cat_dir.parent / "flat" / cat if (cat_dir.parent / "flat").exists() else None

        target = TARGETS.get(cat, 200)
        if count >= target:
            status = f"{G}  OK{R}"
        elif count >= target * 0.5:
            status = f"{Y} LOW{R}"
        else:
            status = f"{RED}NEED{R}"

        print(f"  {cat:>15}  {count:>10,}  {target:>8}  {status}")
        total += count

    print(f"  {'─'*15}  {'─'*10}  {'─'*8}")
    print(f"  {'TOTAL':>15}  {total:>10,}")

    # Also show flat output if it exists
    flat_root = OUTPUT_ROOT / "flat"
    if flat_root.exists():
        print(f"\n  Flat output ({flat_root}):")
        for cat in CATEGORIES:
            d = flat_root / cat
            if d.exists():
                n = len(list(d.glob("*")))
                print(f"    {cat}: {n}")

    print(f"\n  Output root: {OUTPUT_ROOT}")


# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════

def main():
    p = argparse.ArgumentParser(description="Collect FOD training images")
    p.add_argument("--all",      action="store_true", help="Run all collectors")
    p.add_argument("--local",    action="store_true", help="Copy from existing local datasets")
    p.add_argument("--roboflow", action="store_true", help="Download from Roboflow Universe")
    p.add_argument("--kaggle",   action="store_true", help="Download from Kaggle")
    p.add_argument("--crawl",    action="store_true", help="Crawl search engines (Bing/Baidu)")
    p.add_argument("--direct",   action="store_true", help="Academic/direct URL downloads")
    p.add_argument("--validate", action="store_true", help="Validate & deduplicate")
    p.add_argument("--flatten",  action="store_true", help="Flatten to category folders")
    p.add_argument("--summary",  action="store_true", help="Print summary only")
    p.add_argument("-c", "--category", type=str, help="Limit to one category")
    p.add_argument("--engines",  type=str, default="bing,baidu",
                   help="Crawl engines (comma-separated)")
    p.add_argument("--min-size", type=int, default=200,
                   help="Minimum image dimension for validation (default: 200)")
    args = p.parse_args()

    cats = [args.category] if args.category else None

    if args.summary:
        print_summary(); return

    run_any = any([args.all, args.local, args.roboflow, args.kaggle,
                   args.crawl, args.direct, args.validate, args.flatten])
    if not run_any:
        p.print_help()
        print(f"\n{Y}Tip: --all runs everything. --crawl is fastest to start.{R}")
        print(f"{Y}     --local copies from already-downloaded datasets first.{R}")
        return

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    for cat in CATEGORIES:
        (OUTPUT_ROOT / cat).mkdir(parents=True, exist_ok=True)

    print(f"{B}")
    print("╔════════════════════════════════════════════════════════════════╗")
    print("║  Food Foreign Object Detection — Training Data Collector V2  ║")
    print("╚════════════════════════════════════════════════════════════════╝")
    print(f"{R}")
    info(f"Output: {OUTPUT_ROOT}")
    info(f"Categories: {', '.join(cats or CATEGORIES)}")

    if args.all or args.local:
        copy_local_datasets(cats)

    if args.all or args.roboflow:
        rf_key = os.environ.get("ROBOFLOW_API_KEY", "").strip()
        if not rf_key:
            warn("ROBOFLOW_API_KEY not set — skipping Roboflow.")
        else:
            download_roboflow_datasets(rf_key, cats)

    if args.all or args.kaggle:
        download_kaggle_datasets(cats)

    if args.all or args.crawl:
        crawl_images(cats, args.engines.split(","))

    if args.all or args.direct:
        download_direct(cats)

    if args.all or args.validate:
        validate_and_deduplicate(cats, args.min_size)

    if args.all or args.flatten:
        flatten_output(cats)

    print_summary()


if __name__ == "__main__":
    main()
