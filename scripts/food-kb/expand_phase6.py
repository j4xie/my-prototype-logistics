#!/usr/bin/env python3
"""
食品知识库 Phase 6 扩充脚本 — 54篇新领域文档批量入库
Expand the food knowledge base from ~516 to ~570 documents.

New categories:
  condiment(6), bakery(6), edible_oil(5), frozen_food(5), canned_food(5),
  functional_food(5), food_incident(6), central_kitchen(5), certification(5), packaging_tech(6)

Usage:
  python expand_phase6.py --server http://47.100.235.168:8083
  python expand_phase6.py --server http://47.100.235.168:8083 --dry-run
  python expand_phase6.py --server http://47.100.235.168:8083 --categories condiment,bakery
"""

import argparse
import json
import logging
import sys
import time

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("expand_kb_p6")

BATCH_SIZE = 20

from _docs_phase6_condiment import DOCS_PHASE6_CONDIMENT
from _docs_phase6_bakery import DOCS_PHASE6_BAKERY
from _docs_phase6_edible_oil import DOCS_PHASE6_EDIBLE_OIL
from _docs_phase6_frozen_food import DOCS_PHASE6_FROZEN_FOOD
from _docs_phase6_canned_food import DOCS_PHASE6_CANNED_FOOD
from _docs_phase6_functional_food import DOCS_PHASE6_FUNCTIONAL_FOOD
from _docs_phase6_food_incident import DOCS_PHASE6_FOOD_INCIDENT
from _docs_phase6_central_kitchen import DOCS_PHASE6_CENTRAL_KITCHEN
from _docs_phase6_certification import DOCS_PHASE6_CERTIFICATION
from _docs_phase6_packaging_tech import DOCS_PHASE6_PACKAGING_TECH

ALL_CATEGORIES = {
    "condiment": DOCS_PHASE6_CONDIMENT,
    "bakery": DOCS_PHASE6_BAKERY,
    "edible_oil": DOCS_PHASE6_EDIBLE_OIL,
    "frozen_food": DOCS_PHASE6_FROZEN_FOOD,
    "canned_food": DOCS_PHASE6_CANNED_FOOD,
    "functional_food": DOCS_PHASE6_FUNCTIONAL_FOOD,
    "food_incident": DOCS_PHASE6_FOOD_INCIDENT,
    "central_kitchen": DOCS_PHASE6_CENTRAL_KITCHEN,
    "certification": DOCS_PHASE6_CERTIFICATION,
    "packaging_tech": DOCS_PHASE6_PACKAGING_TECH,
}

SEARCH_TESTS = [
    ("condiment", "酱油酿造氨基酸态氮分级标准"),
    ("condiment", "食醋总酸含量特级标准"),
    ("condiment", "食盐加碘含量各省标准"),
    ("bakery", "面包发酵温度湿度烘焙工艺"),
    ("bakery", "巧克力精磨调温曲线工艺"),
    ("bakery", "月饼防腐剂限量标准"),
    ("edible_oil", "食用油压榨浸出溶剂残留"),
    ("edible_oil", "反式脂肪酸标识GB 28050"),
    ("frozen_food", "IQF速冻技术冻结速率"),
    ("frozen_food", "速冻水饺微生物限量标准"),
    ("canned_food", "罐头热力杀菌Fo值概念"),
    ("canned_food", "低酸性罐头肉毒梭菌12D"),
    ("functional_food", "益生菌菌种名单活菌数"),
    ("functional_food", "药食同源目录植物提取物"),
    ("food_incident", "三聚氰胺奶粉事件三鹿"),
    ("food_incident", "瘦肉精双汇事件盐酸克伦特罗"),
    ("food_incident", "地沟油检测治理"),
    ("central_kitchen", "中央厨房设计温度分区"),
    ("central_kitchen", "学校食堂明厨亮灶校长负责"),
    ("certification", "BRC全球食品安全标准认证"),
    ("certification", "有机绿色无公害认证对比"),
    ("packaging_tech", "气调包装MAP气体比例"),
    ("packaging_tech", "食品接触材料迁移量GB 4806"),
]


def main():
    parser = argparse.ArgumentParser(description="食品知识库 Phase 6 — 10个新领域扩充")
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
            logger.info(f"  [{i:3d}] {cat:18s} | {title}")
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
        batch_titles = [d["title"][:30] for d in batch[:3]]
        logger.info(f"Ingesting batch {batch_num} ({len(batch)} docs: {batch_titles}...)...")

        try:
            with httpx.Client(timeout=120) as client:
                resp = client.post(
                    f"{args.server}/api/food-kb/ingest-batch",
                    json={"documents": batch, "operator": "expand_kb_phase6"},
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
                logger.info(f"  [{status}] [{cat:18s}] \"{query[:25]}...\" → [{sim:.3f}] {title}")
        except Exception as e:
            fail_count += 1
            logger.warning(f"  [FAIL] [{cat}] search failed: {e}")

    logger.info(f"Search tests: {pass_count} PASS, {fail_count} FAIL")
    logger.info("Phase 6 Done!")


if __name__ == "__main__":
    main()
