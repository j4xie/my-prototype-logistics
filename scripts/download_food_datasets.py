"""
Food Defect Detection Dataset Downloader
=========================================
Downloads free food defect detection datasets for YOLO training.

Requirements:
    pip install roboflow kagglehub requests tqdm

Usage:
    # Set API keys as environment variables (recommended)
    export ROBOFLOW_API_KEY="your_key_here"
    export KAGGLE_USERNAME="your_username"
    export KAGGLE_KEY="your_key"

    python scripts/download_food_datasets.py

    # Or pass Roboflow key interactively (will prompt if not set)
    python scripts/download_food_datasets.py
"""

import os
import sys
import json
import shutil
import textwrap
from pathlib import Path

# ── Output directory ──────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATASETS_ROOT = PROJECT_ROOT / "datasets" / "food-defect-detection"

# ── Colour helpers (ANSI, gracefully disabled on Windows if no ANSI support) ──
def _ansi(code: str) -> str:
    if sys.platform == "win32" and not os.environ.get("FORCE_COLOR"):
        try:
            import ctypes
            kernel = ctypes.windll.kernel32
            kernel.SetConsoleMode(kernel.GetStdHandle(-11), 7)
        except Exception:
            return ""
    return f"\033[{code}m"

RESET = _ansi("0")
BOLD  = _ansi("1")
GREEN = _ansi("32")
CYAN  = _ansi("36")
YELLOW = _ansi("33")
RED   = _ansi("31")

def info(msg: str)    -> None: print(f"{CYAN}[INFO]{RESET}  {msg}")
def ok(msg: str)      -> None: print(f"{GREEN}[OK]{RESET}    {msg}")
def warn(msg: str)    -> None: print(f"{YELLOW}[WARN]{RESET}  {msg}")
def error(msg: str)   -> None: print(f"{RED}[ERROR]{RESET} {msg}")
def header(msg: str)  -> None: print(f"\n{BOLD}{CYAN}{'='*60}{RESET}\n{BOLD}{msg}{RESET}\n{'='*60}")

# ── Summary tracking ──────────────────────────────────────────────────────────
results: list[dict] = []

def record(name: str, status: str, path: str | None, note: str = "") -> None:
    results.append({"name": name, "status": status, "path": path, "note": note})

# ─────────────────────────────────────────────────────────────────────────────
# 1. Get / validate Roboflow API key
# ─────────────────────────────────────────────────────────────────────────────

def get_roboflow_key() -> str | None:
    key = os.environ.get("ROBOFLOW_API_KEY", "").strip()
    if key:
        info(f"Roboflow API key found in environment (length={len(key)})")
        return key
    print()
    warn("ROBOFLOW_API_KEY environment variable not set.")
    print(textwrap.dedent("""
        To get a free Roboflow API key:
          1. Go to https://app.roboflow.com/
          2. Create a free account (or log in)
          3. Click your avatar → Settings → Roboflow API
          4. Copy the Private API key

        Then either:
          • Set it once:  export ROBOFLOW_API_KEY=your_key_here
          • Or enter it below (not saved to disk)
    """))
    key = input("Enter Roboflow API key (or press Enter to skip Roboflow datasets): ").strip()
    return key if key else None


# ─────────────────────────────────────────────────────────────────────────────
# 2. Roboflow helper
# ─────────────────────────────────────────────────────────────────────────────

def download_roboflow(
    api_key: str,
    workspace: str,
    project_slug: str,
    version: int,
    dataset_name: str,
    expected_images: int,
) -> None:
    dest = DATASETS_ROOT / dataset_name
    dest.mkdir(parents=True, exist_ok=True)

    header(f"Dataset: {dataset_name}  (~{expected_images:,} images)")

    try:
        from roboflow import Roboflow  # type: ignore
    except ImportError:
        error("roboflow package not installed.  Run:  pip install roboflow")
        record(dataset_name, "FAILED", None, "pip install roboflow required")
        return

    try:
        info(f"Connecting to Roboflow workspace '{workspace}', project '{project_slug}' v{version} …")
        rf = Roboflow(api_key=api_key)
        project = rf.workspace(workspace).project(project_slug)
        dataset = project.version(version).download("yolov8", location=str(dest))
        ok(f"Downloaded to: {dest}")
        record(dataset_name, "OK", str(dest), f"YOLOv8 format, ~{expected_images:,} images")
    except Exception as exc:
        error(f"Roboflow download failed: {exc}")
        record(dataset_name, "FAILED", None, str(exc))


# ─────────────────────────────────────────────────────────────────────────────
# 3. Individual dataset downloaders
# ─────────────────────────────────────────────────────────────────────────────

def download_canned_food_defect(api_key: str) -> None:
    """
    Canned Food Surface Defect Classification
    Roboflow: canned-food-surface-defect-classification / canned-food-surface-defect
    ~8,046 images, YOLOv8 format
    """
    download_roboflow(
        api_key=api_key,
        workspace="canned-food-surface-defect-classification",
        project_slug="canned-food-surface-defect",
        version=1,
        dataset_name="01_canned_food_surface_defect",
        expected_images=8046,
    )


def download_food_waste_detection(api_key: str) -> None:
    """
    Food Waste Detection YOLOv8
    Roboflow: abrars-models / food-waste-detection-yolo-v8
    ~7,622 images, YOLOv8 format
    """
    download_roboflow(
        api_key=api_key,
        workspace="abrars-models",
        project_slug="food-waste-detection-yolo-v8",
        version=1,
        dataset_name="02_food_waste_detection",
        expected_images=7622,
    )


def download_microplastic(api_key: str) -> None:
    """
    Microplastic Dataset
    Roboflow: panats-mp-project / microplastic-dataset
    ~963 images, YOLO format
    """
    download_roboflow(
        api_key=api_key,
        workspace="panats-mp-project",
        project_slug="microplastic-dataset",
        version=1,
        dataset_name="03_microplastic_dataset",
        expected_images=963,
    )


def download_food_mold_instructions() -> None:
    """
    Food Mold Detection (PMC paper dataset, ~2,050 images)
    No direct programmatic download — print instructions.
    """
    name = "04_food_mold_detection"
    dest = DATASETS_ROOT / name
    dest.mkdir(parents=True, exist_ok=True)

    header(f"Dataset: {name}  (~2,050 images)  [MANUAL DOWNLOAD REQUIRED]")

    instructions = textwrap.dedent(f"""
    Food Mold Detection Dataset (from PMC paper DOI 10.3390/foods12010195)
    -----------------------------------------------------------------------
    The original dataset accompanies the paper:
      "Detection and Classification of Mold Contamination in Food Using
       Deep Learning Methods" (Foods, MDPI, 2023)

    Option A — Roboflow community fork (easiest):
      1. Search "food mold" at https://universe.roboflow.com/
      2. Look for forks of the original dataset in YOLOv8 format
      3. Download via Roboflow SDK (same pattern as above datasets)

    Option B — Mendeley Data (original):
      1. Go to https://data.mendeley.com/datasets/wkgprmn5tz
      2. Click "Download All" (~120 MB ZIP)
      3. Unzip into:  {dest}
      4. Convert annotations to YOLO format if needed

    Option C — Use a pre-labelled Roboflow version:
      Set ROBOFLOW_API_KEY, then update this script with the exact
      workspace/project slug found on Roboflow Universe.

    Saved placeholder readme at: {dest / 'DOWNLOAD_INSTRUCTIONS.txt'}
    """)

    readme_path = dest / "DOWNLOAD_INSTRUCTIONS.txt"
    readme_path.write_text(instructions.strip(), encoding="utf-8")

    print(instructions)
    record(name, "MANUAL", str(dest), "See DOWNLOAD_INSTRUCTIONS.txt")


def download_meat_quality_kaggle() -> None:
    """
    Meat Quality Assessment Based on Deep Learning
    Kaggle: crowww/meat-quality-assessment-based-on-deep-learning
    ~2,313 images
    """
    name = "05_meat_quality_assessment"
    dest = DATASETS_ROOT / name
    dest.mkdir(parents=True, exist_ok=True)

    header(f"Dataset: {name}  (~2,313 images)")

    # Try kagglehub first
    try:
        import kagglehub  # type: ignore
        info("kagglehub found — attempting download …")
        info("(Kaggle credentials required: KAGGLE_USERNAME + KAGGLE_KEY env vars,")
        info(" or ~/.kaggle/kaggle.json)")
        path = kagglehub.dataset_download(
            "crowww/meat-quality-assessment-based-on-deep-learning"
        )
        # kagglehub downloads to a cache dir; copy to our dest
        src = Path(path)
        if src != dest:
            info(f"Copying from kagglehub cache {src} → {dest} …")
            if dest.exists():
                shutil.rmtree(dest)
            shutil.copytree(str(src), str(dest))
        ok(f"Downloaded to: {dest}")
        record(name, "OK", str(dest), "~2,313 images (classification format)")
        return
    except ImportError:
        warn("kagglehub not installed.  Attempting fallback instructions …")
    except Exception as exc:
        warn(f"kagglehub download failed: {exc}")

    # Fallback: print manual instructions
    instructions = textwrap.dedent(f"""
    Meat Quality Assessment Dataset — Manual Download Instructions
    ---------------------------------------------------------------
    URL: https://www.kaggle.com/datasets/crowww/meat-quality-assessment-based-on-deep-learning

    Option A — kagglehub (recommended):
      1. pip install kagglehub
      2. Set Kaggle credentials:
           export KAGGLE_USERNAME=your_username
           export KAGGLE_KEY=your_api_key
         (Get key from https://www.kaggle.com/settings → API → Create New Token)
      3. Re-run this script

    Option B — Manual download:
      1. Go to https://www.kaggle.com/datasets/crowww/meat-quality-assessment-based-on-deep-learning
      2. Click "Download" (requires free Kaggle account)
      3. Unzip the archive into:
           {dest}

    Note: The dataset contains ~2,313 images of fresh/half-fresh/spoiled meat
    across 3 classes. Images need re-labelling into YOLO bounding-box format
    (currently provided as classification folders, not detection annotations).

    Saved placeholder readme at: {dest / 'DOWNLOAD_INSTRUCTIONS.txt'}
    """)

    readme_path = dest / "DOWNLOAD_INSTRUCTIONS.txt"
    readme_path.write_text(instructions.strip(), encoding="utf-8")
    print(instructions)
    record(name, "MANUAL", str(dest), "See DOWNLOAD_INSTRUCTIONS.txt (kagglehub or manual)")


def download_mvtec_instructions() -> None:
    """
    MVTec Anomaly Detection Dataset — requires registration, print instructions.
    5,000+ high-resolution images, 15 object/texture categories.
    """
    name = "06_mvtec_ad_industrial"
    dest = DATASETS_ROOT / name
    dest.mkdir(parents=True, exist_ok=True)

    header(f"Dataset: {name}  (~5,000+ images)  [REGISTRATION REQUIRED]")

    instructions = textwrap.dedent(f"""
    MVTec Anomaly Detection (MVTec AD) Dataset
    ------------------------------------------
    URL:    https://www.mvtec.com/company/research/datasets/mvtec-ad
    Paper:  "MVTec AD — A Comprehensive Real-World Dataset for Unsupervised
             Anomaly Detection" (CVPR 2019)
    Size:   ~4.9 GB (5,354 high-res images, 15 categories)
    License: CC BY-NC-SA 4.0 (free for research use, not commercial)

    Relevant food-adjacent categories in this dataset:
      • Bottle, Capsule, Pill, Toothbrush (surface defects)
      • Hazelnut, Wood (natural texture anomalies)
      (Note: not all categories are food — select as needed)

    Download steps:
      1. Go to https://www.mvtec.com/company/research/datasets/mvtec-ad
      2. Click "Download Dataset" — fill in the short registration form
         (name + institution + intended use)
      3. You will receive a download link by email within minutes
      4. Download the .tar.xz archives (full set or individual categories)
      5. Extract into:
           {dest}
         Suggested structure:
           {dest}/hazelnut/   (good + anomaly images)
           {dest}/bottle/
           {dest}/capsule/
           … etc.

    Converting MVTec to YOLO format:
      MVTec uses image-level labels + pixel masks, not bounding boxes.
      A converter script is available at:
        https://github.com/openvinotoolkit/anomalib  (anomalib library)
      Or use the mask_to_bbox utility (see README in this folder).

    Alternative — pretrained anomaly models (no conversion needed):
      https://github.com/openvinotoolkit/anomalib
      Supports EfficientAD, PatchCore, PaDiM out-of-the-box on MVTec.

    Saved placeholder readme at: {dest / 'DOWNLOAD_INSTRUCTIONS.txt'}
    """)

    readme_path = dest / "DOWNLOAD_INSTRUCTIONS.txt"
    readme_path.write_text(instructions.strip(), encoding="utf-8")
    print(instructions)
    record(name, "MANUAL", str(dest), "Registration required — see DOWNLOAD_INSTRUCTIONS.txt")


# ─────────────────────────────────────────────────────────────────────────────
# 4. Print final summary
# ─────────────────────────────────────────────────────────────────────────────

def print_summary() -> None:
    header("Download Summary")

    col_w = 38
    status_ok    = [r for r in results if r["status"] == "OK"]
    status_manual = [r for r in results if r["status"] == "MANUAL"]
    status_failed = [r for r in results if r["status"] == "FAILED"]

    for r in results:
        status = r["status"]
        name   = r["name"]
        note   = r["note"]
        if status == "OK":
            icon = f"{GREEN}✓ OK{RESET}    "
        elif status == "MANUAL":
            icon = f"{YELLOW}⚠ MANUAL{RESET}"
        else:
            icon = f"{RED}✗ FAILED{RESET}"

        print(f"  {icon}  {name:<{col_w}}  {note}")

    print()
    print(f"  {GREEN}Downloaded automatically : {len(status_ok)}{RESET}")
    print(f"  {YELLOW}Manual download needed   : {len(status_manual)}{RESET}")
    print(f"  {RED}Failed                   : {len(status_failed)}{RESET}")
    print()
    print(f"  All datasets → {DATASETS_ROOT}")

    # Write machine-readable summary
    summary_path = DATASETS_ROOT / "download_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    info(f"Summary JSON written to: {summary_path}")


# ─────────────────────────────────────────────────────────────────────────────
# 5. Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    print(f"{BOLD}")
    print("╔══════════════════════════════════════════════════════════╗")
    print("║     Food Defect Detection — Dataset Downloader           ║")
    print("║     Target: datasets/food-defect-detection/              ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print(f"{RESET}")

    DATASETS_ROOT.mkdir(parents=True, exist_ok=True)
    info(f"Output directory: {DATASETS_ROOT}")

    # ── Roboflow datasets ────────────────────────────────────────────────────
    rf_key = get_roboflow_key()

    if rf_key:
        download_canned_food_defect(rf_key)
        download_food_waste_detection(rf_key)
        download_microplastic(rf_key)
    else:
        warn("Skipping all Roboflow datasets (no API key provided).")
        for name, images in [
            ("01_canned_food_surface_defect", 8046),
            ("02_food_waste_detection", 7622),
            ("03_microplastic_dataset", 963),
        ]:
            (DATASETS_ROOT / name).mkdir(parents=True, exist_ok=True)
            record(name, "SKIPPED", None, f"No Roboflow API key — ~{images:,} images available")
            print(f"  {YELLOW}[SKIP]{RESET}  {name}")
        print()
        print("  To download Roboflow datasets, set:")
        print("    export ROBOFLOW_API_KEY=your_key_here")
        print("  then re-run this script.")

    # ── Manual / other datasets ──────────────────────────────────────────────
    download_food_mold_instructions()
    download_meat_quality_kaggle()
    download_mvtec_instructions()

    # ── Summary ──────────────────────────────────────────────────────────────
    print_summary()


if __name__ == "__main__":
    main()
