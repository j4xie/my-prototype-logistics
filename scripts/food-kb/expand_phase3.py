#!/usr/bin/env python3
"""
食品知识库 Phase 3 扩充脚本 — 69篇食品加工新文档批量入库
Expand the food knowledge base from ~231 to ~300 documents.

New subcategories (all under "process" category):
  soy, noodle, preserved, egg, fruiveg, mushroom,
  convenience, starch, advanced, plantbased, enzyme,
  honey_seafood, meat_slaughter, meat_products

Usage:
  python expand_phase3.py --server http://47.100.235.168:8083
  python expand_phase3.py --server http://47.100.235.168:8083 --dry-run
  python expand_phase3.py --server http://47.100.235.168:8083 --categories meat_slaughter,meat_products
"""

import argparse
import json
import logging
import sys
import time

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("expand_kb_p3")

BATCH_SIZE = 20

# Import Phase 3 document lists — food processing subcategories
from _docs_process_soy import DOCS_PROCESS_SOY
from _docs_process_noodle import DOCS_PROCESS_NOODLE
from _docs_process_preserved import DOCS_PROCESS_PRESERVED
from _docs_process_egg import DOCS_PROCESS_EGG
from _docs_process_fruiveg import DOCS_PROCESS_FRUIVEG
from _docs_process_mushroom import DOCS_PROCESS_MUSHROOM
from _docs_process_convenience import DOCS_PROCESS_CONVENIENCE
from _docs_process_starch import DOCS_PROCESS_STARCH
from _docs_process_advanced import DOCS_PROCESS_ADVANCED
from _docs_process_plantbased import DOCS_PROCESS_PLANTBASED
from _docs_process_enzyme import DOCS_PROCESS_ENZYME
from _docs_process_honey_seafood import DOCS_PROCESS_HONEY_SEAFOOD
from _docs_process_meat_slaughter import DOCS_PROCESS_MEAT_SLAUGHTER
from _docs_process_meat_products import DOCS_PROCESS_MEAT_PRODUCTS

ALL_CATEGORIES = {
    "soy": DOCS_PROCESS_SOY,
    "noodle": DOCS_PROCESS_NOODLE,
    "preserved": DOCS_PROCESS_PRESERVED,
    "egg": DOCS_PROCESS_EGG,
    "fruiveg": DOCS_PROCESS_FRUIVEG,
    "mushroom": DOCS_PROCESS_MUSHROOM,
    "convenience": DOCS_PROCESS_CONVENIENCE,
    "starch": DOCS_PROCESS_STARCH,
    "advanced": DOCS_PROCESS_ADVANCED,
    "plantbased": DOCS_PROCESS_PLANTBASED,
    "enzyme": DOCS_PROCESS_ENZYME,
    "honey_seafood": DOCS_PROCESS_HONEY_SEAFOOD,
    "meat_slaughter": DOCS_PROCESS_MEAT_SLAUGHTER,
    "meat_products": DOCS_PROCESS_MEAT_PRODUCTS,
}

SEARCH_TESTS = [
    ("soy", "豆腐制作凝固剂用量"),
    ("noodle", "挂面干燥工艺温度"),
    ("preserved", "腊肉腌制亚硝酸盐限量"),
    ("egg", "皮蛋加工碱液配方"),
    ("fruiveg", "果汁浓缩蒸发温度"),
    ("mushroom", "食用菌干燥工艺"),
    ("convenience", "自热食品发热包安全"),
    ("starch", "淀粉糖加工工艺"),
    ("advanced", "超高压杀菌HPP技术"),
    ("plantbased", "植物肉挤压工艺参数"),
    ("enzyme", "食品酶制剂使用标准"),
    ("honey_seafood", "蜂蜜加工水分标准"),
    ("meat_slaughter", "生猪屠宰致昏放血规范"),
    ("meat_products", "亚硝酸钠火腿肠残留限量"),
]


def main():
    parser = argparse.ArgumentParser(description="食品知识库 Phase 3 扩充脚本 (食品加工)")
    parser.add_argument("--server", "-s", default="http://47.100.235.168:8083")
    parser.add_argument("--dry-run", action="store_true", help="只打印文档，不实际入库")
    parser.add_argument("--categories", "-c", default=None, help="逗号分隔的分类名")
    args = parser.parse_args()

    # Build document list
    if args.categories:
        cats = [c.strip() for c in args.categories.split(",")]
    else:
        cats = list(ALL_CATEGORIES.keys())

    documents = []
    for cat in cats:
        if cat not in ALL_CATEGORIES:
            logger.error(f"Unknown category: {cat}. Valid: {list(ALL_CATEGORIES.keys())}")
            sys.exit(1)
        documents.extend(ALL_CATEGORIES[cat])

    logger.info(f"Target server: {args.server}")
    logger.info(f"Categories: {cats}")
    logger.info(f"Documents to ingest: {len(documents)}")

    if args.dry_run:
        for i, doc in enumerate(documents, 1):
            title = doc["title"][:55]
            cat = doc.get("category", "unknown")
            logger.info(f"  [{i:3d}] {cat:10s} | {title}")
        logger.info(f"Dry run complete. {len(documents)} documents ready.")
        return

    # Health check
    logger.info("Checking server health...")
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(f"{args.server}/api/food-kb/health")
            health = resp.json()
            logger.info(f"Health: {json.dumps(health, indent=2)}")
            if not health.get("success"):
                logger.error("Health check failed, aborting")
                sys.exit(1)
    except Exception as e:
        logger.error(f"Cannot reach server: {e}")
        sys.exit(1)

    # Get current stats
    logger.info("Current knowledge base stats:")
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(f"{args.server}/api/food-kb/stats")
            stats = resp.json()
            logger.info(f"  {json.dumps(stats, indent=2, ensure_ascii=False)}")
    except Exception as e:
        logger.warning(f"  Stats check failed: {e}")

    # Batch ingest
    total_success = 0
    total_fail = 0
    start = time.time()

    for batch_idx in range(0, len(documents), BATCH_SIZE):
        batch = documents[batch_idx : batch_idx + BATCH_SIZE]
        batch_num = batch_idx // BATCH_SIZE + 1
        batch_titles = [d["title"][:30] for d in batch[:3]]
        logger.info(f"Ingesting batch {batch_num} ({len(batch)} docs: {batch_titles}...)...")

        try:
            with httpx.Client(timeout=120) as client:
                resp = client.post(
                    f"{args.server}/api/food-kb/ingest-batch",
                    json={"documents": batch, "operator": "expand_kb_phase3"},
                )
                resp.raise_for_status()
                result = resp.json()
                s = result.get("success_count", 0)
                f = result.get("fail_count", 0)
                total_success += s
                total_fail += f
                logger.info(f"  Batch {batch_num}: {s} success, {f} failed")
        except Exception as e:
            logger.error(f"  Batch {batch_num} failed: {e}")
            total_fail += len(batch)

        if batch_idx + BATCH_SIZE < len(documents):
            time.sleep(2)  # Brief pause between batches

    elapsed = time.time() - start
    logger.info(f"Ingestion complete: {total_success} success, {total_fail} failed ({elapsed:.1f}s)")

    # Verify stats
    logger.info("Verifying knowledge base stats after ingestion...")
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(f"{args.server}/api/food-kb/stats")
            stats = resp.json()
            logger.info(f"Stats: {json.dumps(stats, indent=2, ensure_ascii=False)}")
    except Exception as e:
        logger.warning(f"Stats check failed: {e}")

    # Search tests
    logger.info("Running search tests for new process subcategories...")
    pass_count = 0
    fail_count = 0
    for cat, query in SEARCH_TESTS:
        if cat not in cats:
            continue
        try:
            with httpx.Client(timeout=30) as client:
                resp = client.post(
                    f"{args.server}/api/food-kb/query",
                    json={"query": query, "top_k": 3, "similarity_threshold": 0.5},
                )
                r = resp.json()
                top = r.get("data", [{}])[0] if r.get("data") else {}
                sim = top.get("similarity", 0)
                title = top.get("title", "N/A")[:40]
                status = "PASS" if sim > 0.5 else "FAIL"
                if sim > 0.5:
                    pass_count += 1
                else:
                    fail_count += 1
                logger.info(f"  [{status}] [{cat:15s}] \"{query[:25]}...\" → [{sim:.3f}] {title}")
        except Exception as e:
            fail_count += 1
            logger.warning(f"  [FAIL] [{cat}] search failed: {e}")

    logger.info(f"Search tests: {pass_count} PASS, {fail_count} FAIL")
    logger.info("Phase 3 Done!")


if __name__ == "__main__":
    main()
