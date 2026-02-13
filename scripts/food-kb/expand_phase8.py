#!/usr/bin/env python3
"""
食品知识库 Phase 8 扩充脚本 — P0优化: 60篇关键领域文档批量入库
Expand the food knowledge base from ~681 to ~741 documents.

Priority areas from RAG evaluation:
  additive(+25): GB 2760 detailed limits for 10+ functional categories
  microbe(+20): pathogenic bacteria, detection methods, GB 4789/29921
  standard(+15): contaminants GB 2762/2763/31650, processing contaminants

Usage:
  python expand_phase8.py --server http://47.100.235.168:8083
  python expand_phase8.py --server http://47.100.235.168:8083 --dry-run
  python expand_phase8.py --server http://47.100.235.168:8083 --categories additive,microbe
"""

import argparse
import json
import logging
import sys
import time

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("expand_kb_p8")

BATCH_SIZE = 20

from _docs_phase8_additive import DOCS_PHASE8_ADDITIVE
from _docs_phase8_microbe import DOCS_PHASE8_MICROBE
from _docs_phase8_contaminant import DOCS_PHASE8_CONTAMINANT

ALL_CATEGORIES = {
    "additive": DOCS_PHASE8_ADDITIVE,
    "microbe": DOCS_PHASE8_MICROBE,
    "contaminant": DOCS_PHASE8_CONTAMINANT,
}

SEARCH_TESTS = [
    # Additive - preservatives
    ("additive", "山梨酸在肉制品中的最大使用量"),
    ("additive", "苯甲酸能否用于婴幼儿食品"),
    ("additive", "丙酸钙在面包中的防霉作用"),
    # Additive - sweeteners
    ("additive", "阿斯巴甜对苯丙酮尿症患者的警示"),
    ("additive", "三氯蔗糖甜度是蔗糖的多少倍"),
    ("additive", "甜蜜素在中国和美国的使用差异"),
    ("additive", "甜菊糖苷天然甜味剂使用限量"),
    # Additive - thickeners
    ("additive", "卡拉胶在果冻中的使用量"),
    ("additive", "黄原胶与瓜尔胶的协同增稠效果"),
    ("additive", "果胶在酸性乳饮料中的稳定作用"),
    # Additive - other
    ("additive", "亚硫酸盐漂白剂残留量SO2标准"),
    ("additive", "亚硝酸盐在肉制品中的四重作用"),
    ("additive", "复配食品添加剂GB 26687管理规范"),
    ("additive", "食品酶制剂转谷氨酰胺酶TG酶"),
    ("additive", "GB 14880营养强化剂维生素D限量"),
    # Microbe - pathogens
    ("microbe", "沙门氏菌致病剂量和检测方法"),
    ("microbe", "大肠杆菌O157:H7溶血性尿毒综合征"),
    ("microbe", "金黄色葡萄球菌肠毒素耐热性"),
    ("microbe", "李斯特菌在冷藏温度下的生长"),
    ("microbe", "副溶血性弧菌海产品致病菌"),
    ("microbe", "阪崎克罗诺杆菌婴儿奶粉安全"),
    # Microbe - mycotoxins
    ("microbe", "黄曲霉毒素B1花生限量标准"),
    ("microbe", "脱氧雪腐镰刀菌烯醇DON呕吐毒素"),
    ("microbe", "展青霉素苹果汁限量"),
    # Microbe - methods
    ("microbe", "GB 4789微生物检验方法总则"),
    ("microbe", "GB 29921预包装食品致病菌限量"),
    ("microbe", "食品微生物快速检测PCR方法"),
    # Contaminant - heavy metals
    ("contaminant", "食品中铅的限量标准GB 2762"),
    ("contaminant", "大米镉限量标准"),
    ("contaminant", "甲基汞在水产品中的限量"),
    # Contaminant - pesticides
    ("contaminant", "GB 2763农药残留限量标准体系"),
    ("contaminant", "草甘膦大豆残留限量"),
    ("contaminant", "有机磷农药毒理机制"),
    # Contaminant - veterinary drugs
    ("contaminant", "氯霉素动物性食品不得检出"),
    ("contaminant", "瘦肉精盐酸克伦特罗禁用"),
    # Contaminant - processing
    ("contaminant", "丙烯酰胺薯片咖啡基准值"),
    ("contaminant", "苯并芘熏烤肉限量"),
    ("contaminant", "3-MCPD精炼油脂污染物"),
]


def main():
    parser = argparse.ArgumentParser(description="食品知识库 Phase 8 — P0优化(添加剂/微生物/污染物)")
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
                    json={"documents": batch, "operator": "expand_kb_phase8"},
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
    logger.info("Phase 8 Done!")


if __name__ == "__main__":
    main()
