#!/usr/bin/env python3
"""
食品知识库扩充脚本 — 100篇文档批量入库
Expand the food knowledge base from 20 to 120+ documents.

Usage:
  python expand_knowledge_base.py --server http://47.100.235.168:8083
  python expand_knowledge_base.py --server http://47.100.235.168:8083 --dry-run
  python expand_knowledge_base.py --server http://47.100.235.168:8083 --categories standard,regulation
"""

import argparse
import json
import logging
import sys
import time

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("expand_kb")

BATCH_SIZE = 20

# Import document lists from sub-modules
from _docs_standard import DOCS_STANDARD
from _docs_regulation import DOCS_REGULATION
from _docs_process import DOCS_PROCESS
from _docs_haccp import DOCS_HACCP
from _docs_sop import DOCS_SOP
from _docs_additive import DOCS_ADDITIVE
from _docs_microbe import DOCS_MICROBE

ALL_CATEGORIES = {
    "standard": DOCS_STANDARD,
    "regulation": DOCS_REGULATION,
    "process": DOCS_PROCESS,
    "haccp": DOCS_HACCP,
    "sop": DOCS_SOP,
    "additive": DOCS_ADDITIVE,
    "microbe": DOCS_MICROBE,
}

SEARCH_TESTS = [
    ("standard", "黄曲霉毒素B1在花生中的限量"),
    ("regulation", "食品生产许可SC证条件"),
    ("process", "巴氏杀菌HTST温度时间"),
    ("haccp", "ISO 22000和FSSC区别"),
    ("sop", "虫害管理IPM操作步骤"),
    ("additive", "合成着色剂日落黄限量"),
    ("microbe", "肉毒梭菌控制温度"),
]


def main():
    parser = argparse.ArgumentParser(description="食品知识库扩充脚本")
    parser.add_argument("--server", "-s", default="http://47.100.235.168:8083")
    parser.add_argument("--dry-run", action="store_true", help="只打印文档，不实际入库")
    parser.add_argument("--categories", "-c", default=None, help="逗号分隔的分类名，如 standard,regulation")
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
            logger.info(f"  [{i:3d}] {doc['category']:12s} | {title}")
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

    # Batch ingest
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
                    json={"documents": batch, "operator": "expand_kb_script"},
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
    logger.info("Verifying knowledge base stats...")
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(f"{args.server}/api/food-kb/stats")
            stats = resp.json()
            logger.info(f"Stats: {json.dumps(stats, indent=2, ensure_ascii=False)}")
    except Exception as e:
        logger.warning(f"Stats check failed: {e}")

    # Search tests
    logger.info("Running search tests...")
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
                logger.info(f"  [{cat:10s}] \"{query[:20]}...\" → [{sim:.3f}] {title}")
        except Exception as e:
            logger.warning(f"  [{cat}] search failed: {e}")

    logger.info("Done!")


if __name__ == "__main__":
    main()
