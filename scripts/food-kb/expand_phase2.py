#!/usr/bin/env python3
"""
食品知识库 Phase 2 扩充脚本 — 63篇新文档批量入库
Expand the food knowledge base from 120 to ~183 documents.

New categories: infant_food, catering, prefab_food, ecommerce, health_food,
contact_material, organic, case_study, novel_food, grain, risk_method
+ standard_update (appended to existing "standard" category)

Usage:
  python expand_phase2.py --server http://47.100.235.168:8083
  python expand_phase2.py --server http://47.100.235.168:8083 --dry-run
  python expand_phase2.py --server http://47.100.235.168:8083 --categories infant_food,catering
"""

import argparse
import json
import logging
import sys
import time

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("expand_kb_p2")

BATCH_SIZE = 20

# Import Phase 2 document lists
from _docs_infant_food import DOCS_INFANT_FOOD
from _docs_catering import DOCS_CATERING
from _docs_prefab_food import DOCS_PREFAB_FOOD
from _docs_ecommerce import DOCS_ECOMMERCE
from _docs_health_food import DOCS_HEALTH_FOOD
from _docs_contact_material import DOCS_CONTACT_MATERIAL
from _docs_organic import DOCS_ORGANIC
from _docs_standard_update import DOCS_STANDARD_UPDATE
from _docs_case_study import DOCS_CASE_STUDY
from _docs_novel_food import DOCS_NOVEL_FOOD
from _docs_grain import DOCS_GRAIN
from _docs_risk_method import DOCS_RISK_METHOD

ALL_CATEGORIES = {
    "infant_food": DOCS_INFANT_FOOD,
    "catering": DOCS_CATERING,
    "prefab_food": DOCS_PREFAB_FOOD,
    "ecommerce": DOCS_ECOMMERCE,
    "health_food": DOCS_HEALTH_FOOD,
    "contact_material": DOCS_CONTACT_MATERIAL,
    "organic": DOCS_ORGANIC,
    "standard_update": DOCS_STANDARD_UPDATE,
    "case_study": DOCS_CASE_STUDY,
    "novel_food": DOCS_NOVEL_FOOD,
    "grain": DOCS_GRAIN,
    "risk_method": DOCS_RISK_METHOD,
}

SEARCH_TESTS = [
    ("infant_food", "婴幼儿配方乳粉蛋白质含量标准"),
    ("catering", "餐饮服务中心温度要求"),
    ("prefab_food", "预制菜防腐剂使用规定"),
    ("ecommerce", "直播电商食品安全新规"),
    ("health_food", "保健食品功能声称目录"),
    ("contact_material", "食品接触材料重金属迁移限量"),
    ("organic", "有机食品认证流程"),
    ("standard_update", "GB 2760-2024添加剂新规"),
    ("case_study", "三聚氰胺事件"),
    ("novel_food", "新食品原料审批流程"),
    ("grain", "大米加工精度标准"),
    ("risk_method", "食品安全风险评估方法"),
]


def main():
    parser = argparse.ArgumentParser(description="食品知识库 Phase 2 扩充脚本")
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
            logger.info(f"  [{i:3d}] {cat:20s} | {title}")
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
        batch_cats = set(d.get("category", "?") for d in batch)
        logger.info(f"Ingesting batch {batch_num} ({len(batch)} docs, categories: {batch_cats})...")

        try:
            with httpx.Client(timeout=120) as client:
                resp = client.post(
                    f"{args.server}/api/food-kb/ingest-batch",
                    json={"documents": batch, "operator": "expand_kb_phase2"},
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
    logger.info("Running search tests for new categories...")
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
                logger.info(f"  [{status}] [{cat:20s}] \"{query[:25]}...\" → [{sim:.3f}] {title}")
        except Exception as e:
            fail_count += 1
            logger.warning(f"  [FAIL] [{cat}] search failed: {e}")

    logger.info(f"Search tests: {pass_count} PASS, {fail_count} FAIL")
    logger.info("Done!")


if __name__ == "__main__":
    main()
