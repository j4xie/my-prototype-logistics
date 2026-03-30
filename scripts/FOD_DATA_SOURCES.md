# Food Foreign Object Detection — Data Sources Reference

**Created**: 2026-03-14
**Script**: `scripts/collect_fod_training_data.py`
**Output**: `食品标注/datasets/collected_v2/`

---

## Current Inventory (from local datasets)

| Category | Local Images | Target | Status |
|----------|-------------|--------|--------|
| hair | 2,436 | 500 | OK (but quality TBD) |
| mold | 2,752 | 500 | OK |
| color_anomaly | 10,246 | 300 | OK |
| bone | 7,742 | 200 | OK |
| glass | 3,303 | 200 | OK |
| insect | 7,978 | 200 | OK |
| normal | 3,138 | 500 | OK |

> Note: "hair" images from sorted/ may include low-quality images that don't survive labeling review.
> Crawling + Kaggle are for **supplementing diversity and quality**.

---

## 1. Roboflow Universe Datasets

### hair (SCARCEST CLASS — every dataset matters)
| Dataset | Workspace/Slug | Images | Labels | Notes |
|---------|---------------|--------|--------|-------|
| **Hair Strands Detection** | `ai-detections/hair-strands-detection-m0iy8` | **~796** | YOLO bbox | **BEST SOURCE** — actual hair strand detection |
| Foreign Matter 2.1+ | `foreign-matter-2.1-plus` | ~64 | YOLO | **Has `hair` class** — very rare |
| Foreign Matter 2.1 | `foreign-matter-2.1` | ~164 | YOLO | seed/insect/pen_mark/tape |
| Food Safety | `foodsafety-5wrjn/food-safety-qjyzs` | ~219 | YOLO | General contamination |
| Food Defects | `fooddefects/food-defects-ouetf` | ~180 | YOLO | General defects |
| Strand-Hair | `naufalcv/strand-hair` | ~34 | YOLO | Small supplement |
| Hairnet Detection | `sabina-jashir/hairnet-detection` | ~1,250 | YOLO | "no-hairnet" images show exposed hair |

> **CRITICAL**: Hair in food is the hardest class. No dedicated public dataset exists.
> Strategy: AI-Detections (796) + existing sorted (2,208) + crawling + manual annotation.

### mold (abundant)
| Dataset | Workspace/Slug | Images | Labels | Notes |
|---------|---------------|--------|--------|-------|
| Peanuts Mold (RF100) | `rf-100/peanuts-mold` | ~387 | YOLO | Dense annotations (50 ann/img) |
| **Mold Bread** | `mold-bread/mold-bread-b03lw` | **~1,000** | YOLO | Bread mold with bbox |
| **Bread Mold Detection** | `project-kecerdasan-buatan/bread-mold-detection-zbka6` | **~924** | YOLO | Bread mold |
| Bread Mold (gopletzzz) | `gopletzzz/bread-mold-detection-55dam` | ~492 | YOLO | Bread mold |
| Mold (Kombuczara) | `kombuczara/mold-bsgon` v9 | ~463 | YOLO | General mold |
| Food Quality Analysis | `detection-kuktj/food-quality-analysis-wnjao` | ~500 | Classification | Fresh/rotten |
| Food Spoilage Status | `project-rspra/food-spoilage-status` | ~276 | Segmentation | Produce spoilage |

### color_anomaly
| Dataset | Workspace/Slug | Images | Labels | Notes |
|---------|---------------|--------|--------|-------|
| Canned Food Surface Defect | `canned-food-surface-defect-classification/...` | ~5,471 | YOLO | Critical/Major/Minor/NoDefect |
| DMEOI | (local, already downloaded) | ~17,031 | VOC XML | Oil contamination, hair, metal |

### bone
| Dataset | Workspace/Slug | Images | Labels | Notes |
|---------|---------------|--------|--------|-------|
| Bone Finder | `bone-detection-xaawq/bone-finder` | ~121 | YOLO | Small but precise |
| Food Waste Detection | `abrars-models/food-waste-detection-yolo-v8` | ~7,622 | YOLO | Extract `Bone` class only |

### glass
| Dataset | Workspace/Slug | Images | Labels | Notes |
|---------|---------------|--------|--------|-------|
| Glass Detection Binary | `glass-detection-binary` | ~296 | YOLO | glass/no_glass |
| Broken Glass Small | (Kaggle overlap) | ~500+ | YOLO | Broken glass pieces |
| **Updated Recycling** | `recyclestuff/updated-recycling-dataset` | **~4,000** | YOLO | Has `glass_shard` class |
| Clear Broken Glass | `waste-detection-gt6wy/clear-broken-glass-0fj4v` | ~247 | YOLO | Clear glass |
| Glass Defect Detection | `capjamesg/glass-defect-detection-fvbcu` | ~1,728 | YOLO | Glass defects |

### insect
| Dataset | Workspace/Slug | Images | Labels | Notes |
|---------|---------------|--------|--------|-------|
| Cockroach Detection | `cockroach-detection-1amwi` | ~5,608 | YOLO | ~95% usable |
| Flying Insect Detection | `flying-insect-detection` | ~1,335 | YOLO | 100% coverage |
| Rice Insect Detection | `rice-insect-detection` | ~1,039 | YOLO | 11 pest classes |
| **KitchenHygiene** | `kitchen-hygiene-efuu5/kitchenhygiene` | **~9,400** | YOLO | cockroach+rat in kitchen context |
| **Fly Detector** | `intelligent-systems/fly-detector` | **~3,000** | YOLO | Large fly dataset |
| Fly IA Detection | `ia-detection/fly-ia-detection-gypqt` | ~2,837 | YOLO | Fly detection |
| RF100 Insects | `insects-mytwu` | ~700 | YOLO | Supplement |
| IP102 (Kaggle YOLOv5) | `leonidkulyk/ip102-yolov5` | ~19,000 | YOLO | 102 insect species |
| Urban Insect (Figshare) | figshare.com/28280792 | 25K annot | COCO | From food warehouses |

---

## 2. Kaggle Datasets

### mold / spoiled food
| Dataset | Kaggle ID | Images | Notes |
|---------|-----------|--------|-------|
| Moldy Bread | `teranekerimova/moldy-bread-image-dataset` | ~200 | Classification |
| Fresh & Stale | `swoyam2609/fresh-and-stale-classification` | ~2,000 | Filter "stale" class |
| Fruits Quality | `nourabdoun/fruits-quality-fresh-vs-rotten` | ~3,000 | Filter "rotten" class |
| Food Freshness | `ulnnproject/food-freshness-dataset` | ~1,000 | Classification |
| Fruit & Veg Disease | `muhammad0subhan/fruit-and-vegetable-disease-healthy-vs-rotten` | ~2,000 | Filter "rotten" |
| Fresh vs Spoiled | `maheen00shahid/fresh-and-spoiled-food-image-dataset` | ~500 | Filter "spoiled" |
| Fruits Fresh & Rotten | `sriramr/fruits-fresh-and-rotten-for-classification` | ~6,000 | Classification |

### glass
| Dataset | Kaggle ID | Images | Notes |
|---------|-----------|--------|-------|
| Broken Glass Pieces | `burakyasinartiran/brokenglasspiecesdetection` | ~1,000 | YOLO labels |
| Broken Glass | `ktgiahieu/brokenglass` | ~500 | Images only |
| Broken Glass 2 | `princypatel9/broken-glass` | ~300 | Images only |

### insect
| Dataset | Kaggle ID | Images | Notes |
|---------|-----------|--------|-------|
| Cockroach at Home | `ildaron/tracking-a-cockroach-at-home` | ~500 | Video frames |
| Ant/Bee/Cockroach | `sauraab/dataset-for-ant-bee-cockroach-spider-images` | ~2,000 | Filter "cockroach" |
| Dangerous Insects | `tarundalal/dangerous-insects-dataset` | ~3,000 | Farm insects |

### bone
| Dataset | Kaggle ID | Images | Notes |
|---------|-----------|--------|-------|
| Meat Quality | `crowww/meat-quality-assessment-based-on-deep-learning` | ~2,313 | Spoiled class |

---

## 3. Academic / Direct Downloads

| Dataset | URL | Images | License | Category |
|---------|-----|--------|---------|----------|
| Mendeley Food Mold | https://data.mendeley.com/datasets/wkgprmn5tz/1 | ~2,050 | CC BY 4.0 | mold |
| MVTec AD | https://www.mvtec.com/company/research/datasets/mvtec-ad | ~5,354 | CC BY-NC-SA 4.0 | color_anomaly |
| DMEOI | (already downloaded) | ~17,031 | Research | color_anomaly/hair |

---

## 4. Search Engine Crawling (icrawler)

**Engines**: Bing (primary), Baidu (Chinese content)
**Relevance rate**: ~15-30% (requires manual review)

### Best-performing query patterns:
- Quoted phrases: `"hair found in food"` (exact match)
- Complaint context: `投诉 实拍 照片` (complaint + real photo)
- Platform-specific: `黑猫投诉 食品异物` (consumer complaint platform)
- Recall/FDA: `food recall contamination` (regulatory context)

### Worst-performing (avoid):
- Generic: "food close up" → food photography
- Stock photo sites: returns watermarked/irrelevant images
- Platform names without context: "小红书 食品" → lifestyle content

---

## 5. Running the Collector

```bash
# Step 1: Copy from existing local datasets (instant, ~37K images)
python scripts/collect_fod_training_data.py --local

# Step 2: Download from Kaggle (needs credentials, ~10-30 min)
python scripts/collect_fod_training_data.py --kaggle

# Step 3: Crawl search engines (slow, ~1-2 hours, noisy)
python scripts/collect_fod_training_data.py --crawl

# Step 4: Validate and deduplicate
python scripts/collect_fod_training_data.py --validate

# Step 5: Flatten to category folders for labeling
python scripts/collect_fod_training_data.py --flatten

# Or run everything:
python scripts/collect_fod_training_data.py --all
```

---

## 6. Post-Collection Workflow

1. **Manual review**: Browse each category, remove irrelevant images
2. **Labeling**: Use Roboflow or Label Studio for bbox annotation
3. **Quality check**: Verify label accuracy with spot checks
4. **Train**: Add to YOLO training pipeline (see `scripts/06_train.py`)
