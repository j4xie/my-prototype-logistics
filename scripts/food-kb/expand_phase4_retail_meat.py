#!/usr/bin/env python3
"""
食品知识库 Phase 4 扩充脚本 — 12篇零售肉类生产线标准文档
Expand the food knowledge base from ~372 to ~384 documents.

Focus: Retail meat supply chain (Sam's Club, Hema, Costco) + meat production line SOP

Usage:
  python expand_phase4_retail_meat.py --server http://47.100.235.168:8083
  python expand_phase4_retail_meat.py --server http://47.100.235.168:8083 --dry-run
"""

import argparse
import json
import logging
import sys
import time

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("expand_kb_p4")

BATCH_SIZE = 20

from _docs_retail_meat_supply import DOCS_RETAIL_MEAT_SUPPLY
from _docs_meat_production_line import DOCS_MEAT_PRODUCTION_LINE

ALL_CATEGORIES = {
    "retail_meat_supply": DOCS_RETAIL_MEAT_SUPPLY,
    "meat_production_line": DOCS_MEAT_PRODUCTION_LINE,
}

SEARCH_TESTS = [
    ("retail_meat_supply", "山姆会员店牛肉谷饲150天供应商标准"),
    ("retail_meat_supply", "盒马鲜生日日鲜冷鲜肉冷链配送"),
    ("retail_meat_supply", "Costco开市客Kirkland肉类品控审核"),
    ("retail_meat_supply", "生鲜超市肉类入库验收温度检测标准"),
    ("meat_production_line", "肉类加工车间GMP洁净区污染区分区"),
    ("meat_production_line", "屠宰车间致昏放血标准化SOP"),
    ("meat_production_line", "分割包装车间温度控制刀具消毒"),
    ("meat_production_line", "肉制品HACCP关键控制点金属检测"),
    ("meat_production_line", "冷鲜肉出厂检验微生物指标"),
]


def main():
    parser = argparse.ArgumentParser(description="食品知识库 Phase 4 — 零售肉类生产线标准")
    parser.add_argument("--server", "-s", default="http://47.100.235.168:8083")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--categories", "-c", default=None)
    args = parser.parse_args()

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
            if not health.get("success"):
                logger.error("Health check failed")
                sys.exit(1)
            logger.info("Health: OK")
    except Exception as e:
        logger.error(f"Cannot reach server: {e}")
        sys.exit(1)

    # Current stats
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(f"{args.server}/api/food-kb/stats")
            stats = resp.json()
            logger.info(f"Current total: {stats.get('total', '?')} documents")
    except Exception as e:
        logger.warning(f"Stats check failed: {e}")

    # Ingest
    total_success = 0
    total_fail = 0
    start = time.time()

    for batch_idx in range(0, len(documents), BATCH_SIZE):
        batch = documents[batch_idx : batch_idx + BATCH_SIZE]
        batch_num = batch_idx // BATCH_SIZE + 1
        logger.info(f"Ingesting batch {batch_num} ({len(batch)} docs)...")

        try:
            with httpx.Client(timeout=120) as client:
                resp = client.post(
                    f"{args.server}/api/food-kb/ingest-batch",
                    json={"documents": batch, "operator": "expand_kb_phase4"},
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
            time.sleep(2)

    elapsed = time.time() - start
    logger.info(f"Ingestion complete: {total_success} success, {total_fail} failed ({elapsed:.1f}s)")

    # Post-ingestion stats
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(f"{args.server}/api/food-kb/stats")
            stats = resp.json()
            logger.info(f"New total: {stats.get('total', '?')} documents")
    except Exception as e:
        logger.warning(f"Stats check failed: {e}")

    # Search tests
    logger.info("Running search tests...")
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
                logger.info(f"  [{status}] [{sim:.3f}] \"{query[:30]}...\" → {title}")
        except Exception as e:
            fail_count += 1
            logger.warning(f"  [FAIL] search failed: {e}")

    logger.info(f"Search tests: {pass_count} PASS, {fail_count} FAIL")
    logger.info("Phase 4 Done!")


if __name__ == "__main__":
    main()
