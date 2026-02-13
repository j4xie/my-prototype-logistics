#!/usr/bin/env python3
"""
食品知识库 Phase 7 扩充脚本 — 25篇薄弱领域文档批量入库
Expand the food knowledge base from ~630 to ~655 documents.

New categories (4 weak areas identified in evaluation):
  training(8), emergency(8), traceability(6), gmo_labeling(3)

Usage:
  python expand_phase7.py --server http://47.100.235.168:8083
  python expand_phase7.py --server http://47.100.235.168:8083 --dry-run
  python expand_phase7.py --server http://47.100.235.168:8083 --categories training,emergency
"""

import argparse
import json
import logging
import sys
import time

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("expand_kb_p7")

BATCH_SIZE = 20

from _docs_phase7_training import DOCS_PHASE7_TRAINING
from _docs_phase7_emergency import DOCS_PHASE7_EMERGENCY
from _docs_phase7_traceability import DOCS_PHASE7_TRACEABILITY
from _docs_phase7_gmo import DOCS_PHASE7_GMO

ALL_CATEGORIES = {
    "training": DOCS_PHASE7_TRAINING,
    "emergency": DOCS_PHASE7_EMERGENCY,
    "traceability": DOCS_PHASE7_TRACEABILITY,
    "gmo_labeling": DOCS_PHASE7_GMO,
}

SEARCH_TESTS = [
    # Training
    ("training", "食品安全管理员考核合格分数线"),
    ("training", "食品从业人员健康证体检禁止从业疾病"),
    ("training", "HACCP小组组建七项原理内审员"),
    ("training", "食品安全培训体系40学时年度计划"),
    ("training", "GMP个人卫生洗手消毒工作服GB14881"),
    ("training", "食品安全应急演练桌面推演实战演练"),
    ("training", "食品检验人员CMA CNAS实验室资质"),
    ("training", "新员工入职食品安全培训SOP考核"),
    # Emergency
    ("emergency", "食品安全事故应急预案编制国家要求"),
    ("emergency", "食品安全事件I级II级III级IV级分级响应"),
    ("emergency", "食品召回一级二级三级24小时48小时"),
    ("emergency", "食物中毒调查流行病学调查样品采集"),
    ("emergency", "食品安全舆情监测黄金4小时危机公关"),
    ("emergency", "食品污染物理化学生物应急处置SOP"),
    ("emergency", "食品安全突发事件2小时信息报告"),
    ("emergency", "追溯演练模拟召回4小时物料平衡"),
    # Traceability
    ("traceability", "食品安全追溯体系一品一码GB38155"),
    ("traceability", "GS1编码GTIN条码二维码追溯码"),
    ("traceability", "区块链食品溯源智能合约防篡改"),
    ("traceability", "肉类蔬菜流通追溯商务部试点城市"),
    ("traceability", "婴幼儿配方乳粉全链条追溯监控码"),
    ("traceability", "进口冷链食品集中监管仓首站赋码"),
    # GMO Labeling
    ("gmo_labeling", "转基因食品标识管理5大类17种定性标识"),
    ("gmo_labeling", "转基因安全评价五阶段安全证书"),
    ("gmo_labeling", "转基因检测PCR定性定量GB/T19495"),
]


def main():
    parser = argparse.ArgumentParser(description="食品知识库 Phase 7 — 4个薄弱领域扩充(培训/应急/溯源/GMO)")
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

    # Show category breakdown
    for cat in cats:
        logger.info(f"  {cat:18s}: {len(ALL_CATEGORIES[cat])} docs")

    if args.dry_run:
        for i, doc in enumerate(documents, 1):
            title = doc["title"][:55]
            cat = doc.get("category", "unknown")
            content_len = len(doc.get("content", ""))
            logger.info(f"  [{i:3d}] {cat:18s} | {title} ({content_len} chars)")
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
                    json={"documents": batch, "operator": "expand_kb_phase7"},
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
                logger.info(f"  [{status}] [{cat:18s}] \"{query[:30]}...\" -> [{sim:.3f}] {title}")
        except Exception as e:
            fail_count += 1
            logger.warning(f"  [FAIL] [{cat}] search failed: {e}")

    logger.info(f"Search tests: {pass_count} PASS, {fail_count} FAIL")
    logger.info("Phase 7 Done!")


if __name__ == "__main__":
    main()
