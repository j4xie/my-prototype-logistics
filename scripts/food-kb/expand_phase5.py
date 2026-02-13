#!/usr/bin/env python3
"""
食品知识库 Phase 5 扩充脚本 — 55篇新领域文档批量入库
Expand the food knowledge base from ~391 to ~446 documents.

New categories:
  dairy(6), aquatic(6), beverage(6), cold_chain(6), testing(6),
  factory_design(5), allergen(5), labeling(5), import_export(5), fraud_detection(5)

Usage:
  python expand_phase5.py --server http://47.100.235.168:8083
  python expand_phase5.py --server http://47.100.235.168:8083 --dry-run
  python expand_phase5.py --server http://47.100.235.168:8083 --categories dairy,aquatic
"""

import argparse
import json
import logging
import sys
import time

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("expand_kb_p5")

BATCH_SIZE = 20

from _docs_phase5_dairy import DOCS_PHASE5_DAIRY
from _docs_phase5_aquatic import DOCS_PHASE5_AQUATIC
from _docs_phase5_beverage import DOCS_PHASE5_BEVERAGE
from _docs_phase5_cold_chain import DOCS_PHASE5_COLD_CHAIN
from _docs_phase5_testing import DOCS_PHASE5_TESTING
from _docs_phase5_factory import DOCS_PHASE5_FACTORY
from _docs_phase5_allergen import DOCS_PHASE5_ALLERGEN
from _docs_phase5_labeling import DOCS_PHASE5_LABELING
from _docs_phase5_import_export import DOCS_PHASE5_IMPORT_EXPORT
from _docs_phase5_fraud import DOCS_PHASE5_FRAUD

ALL_CATEGORIES = {
    "dairy": DOCS_PHASE5_DAIRY,
    "aquatic": DOCS_PHASE5_AQUATIC,
    "beverage": DOCS_PHASE5_BEVERAGE,
    "cold_chain": DOCS_PHASE5_COLD_CHAIN,
    "testing": DOCS_PHASE5_TESTING,
    "factory_design": DOCS_PHASE5_FACTORY,
    "allergen": DOCS_PHASE5_ALLERGEN,
    "labeling": DOCS_PHASE5_LABELING,
    "import_export": DOCS_PHASE5_IMPORT_EXPORT,
    "fraud_detection": DOCS_PHASE5_FRAUD,
}

SEARCH_TESTS = [
    ("dairy", "生乳收购蛋白质含量标准"),
    ("dairy", "婴幼儿配方乳粉阪崎肠杆菌控制"),
    ("aquatic", "淡水鱼K值新鲜度判定"),
    ("aquatic", "贝类净化脱毒PSP限量"),
    ("beverage", "茶叶加工杀青温度工艺"),
    ("beverage", "白酒酿造甲醇限量标准"),
    ("cold_chain", "食品冷库温度分区设计"),
    ("cold_chain", "冷链断链应急处置评估"),
    ("testing", "PCR检测转基因食品方法"),
    ("testing", "农药残留QuEChERS前处理"),
    ("factory_design", "食品车间HVAC洁净度等级"),
    ("factory_design", "食品工厂废水处理COD标准"),
    ("allergen", "中国食品过敏原标识八大类"),
    ("allergen", "过敏原清洁验证ELISA检测"),
    ("labeling", "GB 7718预包装食品标签通则"),
    ("labeling", "GB 28050营养标签NRV计算"),
    ("import_export", "进口食品检验检疫248号令"),
    ("import_export", "美国FSMA预防性控制措施"),
    ("fraud_detection", "肉类掺假DNA检测qPCR"),
    ("fraud_detection", "蜂蜜掺假C4糖检测方法"),
]


def main():
    parser = argparse.ArgumentParser(description="食品知识库 Phase 5 — 10个新领域扩充")
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
            logger.info(f"  [{i:3d}] {cat:15s} | {title}")
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
                    json={"documents": batch, "operator": "expand_kb_phase5"},
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
                logger.info(f"  [{status}] [{cat:15s}] \"{query[:25]}...\" → [{sim:.3f}] {title}")
        except Exception as e:
            fail_count += 1
            logger.warning(f"  [FAIL] [{cat}] search failed: {e}")

    logger.info(f"Search tests: {pass_count} PASS, {fail_count} FAIL")
    logger.info("Phase 5 Done!")


if __name__ == "__main__":
    main()
