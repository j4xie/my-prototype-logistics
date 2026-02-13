#!/usr/bin/env python3
"""
食品知识库 RAG 评测基准脚本
Evaluate RAG retrieval quality with recall@k, MRR, nDCG@5 metrics.

Usage:
  python eval_rag.py --server http://47.100.235.168:8083
  python eval_rag.py --server http://47.100.235.168:8083 --top-k 5 --verbose
  python eval_rag.py --server http://47.100.235.168:8083 --output eval_results.json
"""

import argparse
import json
import logging
import math
import sys
import time
from dataclasses import dataclass, asdict
from typing import List, Optional

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("eval_rag")


@dataclass
class EvalQuery:
    """A single evaluation query with expected answer criteria."""
    query: str
    expected_category: str
    expected_title_keywords: List[str]  # ANY of these in title = relevant
    domain: str  # grouping: additive, microbe, contaminant, process, standard, regulation, etc.
    difficulty: str = "normal"  # easy / normal / hard


@dataclass
class EvalResult:
    """Result for a single query."""
    query: str
    domain: str
    difficulty: str
    expected_category: str
    hit: bool  # any result returned
    relevant_found: bool  # expected doc in top-k
    relevant_rank: int  # 1-indexed rank of first relevant result, 0 if not found
    top1_similarity: float
    top1_title: str
    top1_category: str
    num_results: int
    latency_ms: float


# ─── EVALUATION SET: 60 queries across all domains ─────────────────────────

EVAL_SET: List[EvalQuery] = [
    # ══════════════════════════════════════════════
    # ADDITIVE (12 queries)
    # ══════════════════════════════════════════════
    EvalQuery(
        query="山梨酸在肉制品中的最大使用量是多少",
        expected_category="additive",
        expected_title_keywords=["山梨酸", "防腐剂"],
        domain="additive",
    ),
    EvalQuery(
        query="苯甲酸能否用于婴幼儿食品",
        expected_category="additive",
        expected_title_keywords=["苯甲酸", "防腐剂"],
        domain="additive",
    ),
    EvalQuery(
        query="阿斯巴甜对苯丙酮尿症患者有什么风险",
        expected_category="additive",
        expected_title_keywords=["阿斯巴甜", "甜味剂"],
        domain="additive",
    ),
    EvalQuery(
        query="三氯蔗糖的甜度是蔗糖的多少倍",
        expected_category="additive",
        expected_title_keywords=["三氯蔗糖", "甜味剂"],
        domain="additive",
    ),
    EvalQuery(
        query="卡拉胶在果冻中的使用量标准",
        expected_category="additive",
        expected_title_keywords=["卡拉胶", "增稠剂"],
        domain="additive",
    ),
    EvalQuery(
        query="亚硝酸盐在腌制肉品中的作用和限量",
        expected_category="additive",
        expected_title_keywords=["亚硝酸", "护色剂"],
        domain="additive",
    ),
    EvalQuery(
        query="复配食品添加剂的管理规范GB 26687",
        expected_category="additive",
        expected_title_keywords=["复配", "GB 26687"],
        domain="additive",
    ),
    EvalQuery(
        query="日落黄在饮料中的最大使用量",
        expected_category="additive",
        expected_title_keywords=["日落黄", "着色剂"],
        domain="additive",
    ),
    EvalQuery(
        query="食品添加剂使用标准GB 2760",
        expected_category="additive",
        expected_title_keywords=["GB 2760", "添加剂"],
        domain="additive",
    ),
    EvalQuery(
        query="维生素D营养强化剂在牛奶中的添加限量",
        expected_category="additive",
        expected_title_keywords=["营养强化", "维生素"],
        domain="additive",
    ),
    EvalQuery(
        query="甜蜜素在中国食品中是否允许使用",
        expected_category="additive",
        expected_title_keywords=["甜蜜素", "环己基氨基磺酸"],
        domain="additive",
    ),
    EvalQuery(
        query="转谷氨酰胺酶TG酶在食品加工中的应用",
        expected_category="additive",
        expected_title_keywords=["酶制剂", "转谷氨酰胺"],
        domain="additive",
    ),

    # ══════════════════════════════════════════════
    # MICROBE (10 queries)
    # ══════════════════════════════════════════════
    EvalQuery(
        query="沙门氏菌的致病剂量和常见感染症状",
        expected_category="microbe",
        expected_title_keywords=["沙门氏菌", "沙门"],
        domain="microbe",
    ),
    EvalQuery(
        query="金黄色葡萄球菌肠毒素的耐热特性",
        expected_category="microbe",
        expected_title_keywords=["金黄色葡萄球菌", "葡萄球菌"],
        domain="microbe",
    ),
    EvalQuery(
        query="李斯特菌在冷藏温度下能否生长",
        expected_category="microbe",
        expected_title_keywords=["李斯特", "单增李斯特"],
        domain="microbe",
    ),
    EvalQuery(
        query="副溶血性弧菌在海产品中的危害",
        expected_category="microbe",
        expected_title_keywords=["副溶血", "弧菌"],
        domain="microbe",
    ),
    EvalQuery(
        query="黄曲霉毒素B1在花生中的限量标准",
        expected_category="microbe",
        expected_title_keywords=["黄曲霉", "真菌毒素"],
        domain="microbe",
    ),
    EvalQuery(
        query="GB 4789食品微生物检验标准体系",
        expected_category="microbe",
        expected_title_keywords=["GB 4789", "微生物检验"],
        domain="microbe",
    ),
    EvalQuery(
        query="GB 29921预包装食品致病菌限量标准",
        expected_category="microbe",
        expected_title_keywords=["GB 29921", "致病菌"],
        domain="microbe",
    ),
    EvalQuery(
        query="脱氧雪腐镰刀菌烯醇DON呕吐毒素限量",
        expected_category="microbe",
        expected_title_keywords=["脱氧雪腐", "DON", "呕吐毒素"],
        domain="microbe",
    ),
    EvalQuery(
        query="PCR快速检测食品微生物的方法",
        expected_category="microbe",
        expected_title_keywords=["快速检测", "PCR"],
        domain="microbe",
    ),
    EvalQuery(
        query="阪崎克罗诺杆菌对婴儿配方奶粉的安全风险",
        expected_category="microbe",
        expected_title_keywords=["阪崎", "克罗诺"],
        domain="microbe",
    ),

    # ══════════════════════════════════════════════
    # CONTAMINANT (8 queries)
    # ══════════════════════════════════════════════
    EvalQuery(
        query="大米中镉的限量标准是多少",
        expected_category="contaminant",
        expected_title_keywords=["镉", "重金属"],
        domain="contaminant",
    ),
    EvalQuery(
        query="GB 2762食品中污染物限量",
        expected_category="contaminant",
        expected_title_keywords=["GB 2762", "污染物"],
        domain="contaminant",
    ),
    EvalQuery(
        query="草甘膦在大豆中的农药残留限量",
        expected_category="contaminant",
        expected_title_keywords=["草甘膦", "农药"],
        domain="contaminant",
    ),
    EvalQuery(
        query="氯霉素为什么在动物性食品中不得检出",
        expected_category="contaminant",
        expected_title_keywords=["氯霉素", "兽药"],
        domain="contaminant",
    ),
    EvalQuery(
        query="丙烯酰胺在薯片和咖啡中的基准限值",
        expected_category="contaminant",
        expected_title_keywords=["丙烯酰胺", "加工污染"],
        domain="contaminant",
    ),
    EvalQuery(
        query="苯并芘在熏烤食品中的限量标准",
        expected_category="contaminant",
        expected_title_keywords=["苯并芘", "加工污染"],
        domain="contaminant",
    ),
    EvalQuery(
        query="瘦肉精盐酸克伦特罗为什么被禁用",
        expected_category="contaminant",
        expected_title_keywords=["瘦肉精", "克伦特罗"],
        domain="contaminant",
    ),
    EvalQuery(
        query="甲基汞在水产品中的限量",
        expected_category="contaminant",
        expected_title_keywords=["汞", "甲基汞", "重金属"],
        domain="contaminant",
    ),

    # ══════════════════════════════════════════════
    # PROCESS (8 queries)
    # ══════════════════════════════════════════════
    EvalQuery(
        query="巴氏杀菌HTST的标准温度和时间",
        expected_category="process",
        expected_title_keywords=["巴氏", "杀菌", "乳制品"],
        domain="process",
    ),
    EvalQuery(
        query="速冻食品的速冻温度和时间要求",
        expected_category="process",
        expected_title_keywords=["速冻", "冷冻"],
        domain="process",
    ),
    EvalQuery(
        query="罐头食品的商业无菌杀菌工艺",
        expected_category="process",
        expected_title_keywords=["罐头", "杀菌", "无菌"],
        domain="process",
    ),
    EvalQuery(
        query="食用油精炼脱酸脱色脱臭工艺流程",
        expected_category="process",
        expected_title_keywords=["食用油", "精炼"],
        domain="process",
    ),
    EvalQuery(
        query="酱油酿造发酵工艺参数",
        expected_category="process",
        expected_title_keywords=["酱油", "调味品", "发酵"],
        domain="process",
    ),
    EvalQuery(
        query="面包烘焙工艺温度控制",
        expected_category="process",
        expected_title_keywords=["烘焙", "面包"],
        domain="process",
    ),
    EvalQuery(
        query="水产品冷链运输温度控制",
        expected_category="process",
        expected_title_keywords=["冷链", "水产", "温度"],
        domain="process",
    ),
    EvalQuery(
        query="豆腐生产工艺流程和关键控制点",
        expected_category="process",
        expected_title_keywords=["豆腐", "豆制品"],
        domain="process",
    ),

    # ══════════════════════════════════════════════
    # STANDARD (6 queries)
    # ══════════════════════════════════════════════
    EvalQuery(
        query="GB 7718预包装食品标签通则的标注要求",
        expected_category="standard",
        expected_title_keywords=["GB 7718", "标签"],
        domain="standard",
    ),
    EvalQuery(
        query="GB 28050营养标签NRV参考值",
        expected_category="standard",
        expected_title_keywords=["GB 28050", "营养标签"],
        domain="standard",
    ),
    EvalQuery(
        query="GB 14880营养强化剂使用标准",
        expected_category="standard",
        expected_title_keywords=["GB 14880", "营养强化"],
        domain="standard",
    ),
    EvalQuery(
        query="GB 2707鲜冻畜禽产品卫生标准",
        expected_category="standard",
        expected_title_keywords=["GB 2707", "畜禽"],
        domain="standard",
    ),
    EvalQuery(
        query="有机食品认证标准和流程",
        expected_category="organic",
        expected_title_keywords=["有机", "认证"],
        domain="standard",
    ),
    EvalQuery(
        query="食品生产许可SC证申请条件",
        expected_category="regulation",
        expected_title_keywords=["生产许可", "SC"],
        domain="standard",
    ),

    # ══════════════════════════════════════════════
    # HACCP / SOP (6 queries)
    # ══════════════════════════════════════════════
    EvalQuery(
        query="HACCP关键控制点CCP的识别方法",
        expected_category="haccp",
        expected_title_keywords=["HACCP", "CCP", "关键控制"],
        domain="haccp",
    ),
    EvalQuery(
        query="食品工厂虫害综合管理IPM方案",
        expected_category="sop",
        expected_title_keywords=["虫害", "IPM", "有害生物"],
        domain="haccp",
    ),
    EvalQuery(
        query="ISO 22000食品安全管理体系",
        expected_category="haccp",
        expected_title_keywords=["ISO 22000", "食品安全管理"],
        domain="haccp",
    ),
    EvalQuery(
        query="食品安全事故应急预案",
        expected_category="emergency",
        expected_title_keywords=["应急", "事故"],
        domain="haccp",
    ),
    EvalQuery(
        query="食品从业人员健康管理制度",
        expected_category="training",
        expected_title_keywords=["从业人员", "健康", "培训"],
        domain="haccp",
    ),
    EvalQuery(
        query="食品追溯系统一物一码实施方案",
        expected_category="traceability",
        expected_title_keywords=["追溯", "溯源"],
        domain="haccp",
    ),

    # ══════════════════════════════════════════════
    # CROSS-DOMAIN / HARD (10 queries)
    # ══════════════════════════════════════════════
    EvalQuery(
        query="婴幼儿配方奶粉中的微生物限量标准",
        expected_category="microbe",
        expected_title_keywords=["婴幼儿", "配方", "阪崎", "致病菌"],
        domain="cross",
        difficulty="hard",
    ),
    EvalQuery(
        query="冷藏肉制品中李斯特菌和沙门氏菌的控制措施",
        expected_category="microbe",
        expected_title_keywords=["李斯特", "沙门", "肉制品"],
        domain="cross",
        difficulty="hard",
    ),
    EvalQuery(
        query="食品中农药残留的快速检测方法有哪些",
        expected_category="contaminant",
        expected_title_keywords=["农药", "检测", "残留"],
        domain="cross",
        difficulty="hard",
    ),
    EvalQuery(
        query="食品标签上过敏原信息如何标注",
        expected_category="allergen",
        expected_title_keywords=["过敏原", "标签", "标注"],
        domain="cross",
        difficulty="hard",
    ),
    EvalQuery(
        query="进口食品报关检验检疫流程",
        expected_category="import_export",
        expected_title_keywords=["进口", "报关", "检验检疫"],
        domain="cross",
        difficulty="hard",
    ),
    EvalQuery(
        query="保健食品功能声称审批流程",
        expected_category="health_food",
        expected_title_keywords=["保健", "功能", "声称"],
        domain="cross",
        difficulty="hard",
    ),
    EvalQuery(
        query="食品生产企业如何应对食品安全事件",
        expected_category="emergency",
        expected_title_keywords=["应急", "安全事件", "召回"],
        domain="cross",
        difficulty="hard",
    ),
    EvalQuery(
        query="肉制品加工中亚硝酸盐残留量控制",
        expected_category="additive",
        expected_title_keywords=["亚硝酸", "肉制品", "残留"],
        domain="cross",
        difficulty="hard",
    ),
    EvalQuery(
        query="食品级不锈钢304和316的区别",
        expected_category="contact_material",
        expected_title_keywords=["不锈钢", "食品接触", "接触材料"],
        domain="cross",
        difficulty="hard",
    ),
    EvalQuery(
        query="中央厨房食品安全管理规范",
        expected_category="central_kitchen",
        expected_title_keywords=["中央厨房", "团餐", "配送"],
        domain="cross",
        difficulty="hard",
    ),
]


def check_relevant(result_title: str, expected_keywords: List[str]) -> bool:
    """Check if a result title matches any expected keyword."""
    title_lower = result_title.lower()
    for kw in expected_keywords:
        if kw.lower() in title_lower:
            return True
    return False


def compute_dcg(relevances: List[float], k: int) -> float:
    """Compute Discounted Cumulative Gain @ k."""
    dcg = 0.0
    for i in range(min(k, len(relevances))):
        dcg += relevances[i] / math.log2(i + 2)  # i+2 because log2(1)=0
    return dcg


def compute_ndcg(relevances: List[float], k: int) -> float:
    """Compute Normalized DCG @ k."""
    dcg = compute_dcg(relevances, k)
    ideal = compute_dcg(sorted(relevances, reverse=True), k)
    if ideal == 0:
        return 0.0
    return dcg / ideal


def run_eval(server: str, top_k: int, threshold: float, verbose: bool) -> dict:
    """Run the full evaluation suite."""
    results: List[EvalResult] = []
    domain_stats: dict = {}

    logger.info(f"Running {len(EVAL_SET)} evaluation queries against {server}")
    logger.info(f"Parameters: top_k={top_k}, threshold={threshold}")

    for i, eq in enumerate(EVAL_SET, 1):
        start = time.time()
        try:
            with httpx.Client(timeout=30) as client:
                resp = client.post(
                    f"{server}/api/food-kb/query",
                    json={
                        "query": eq.query,
                        "top_k": top_k,
                        "similarity_threshold": threshold,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.error(f"  [{i:2d}] FAIL: {e}")
            results.append(EvalResult(
                query=eq.query, domain=eq.domain, difficulty=eq.difficulty,
                expected_category=eq.expected_category,
                hit=False, relevant_found=False, relevant_rank=0,
                top1_similarity=0.0, top1_title="ERROR", top1_category="",
                num_results=0, latency_ms=(time.time() - start) * 1000,
            ))
            continue

        latency = (time.time() - start) * 1000
        docs = data.get("data", [])
        num_results = len(docs)
        hit = num_results > 0

        top1_sim = docs[0].get("similarity", 0.0) if docs else 0.0
        top1_title = docs[0].get("title", "N/A") if docs else "N/A"
        top1_cat = docs[0].get("category", "") if docs else ""

        # Find rank of first relevant result
        relevant_rank = 0
        relevant_found = False
        for rank, doc in enumerate(docs, 1):
            title = doc.get("title", "")
            content = doc.get("content", "")
            # Check title OR content for keywords
            combined = title + " " + content[:200]
            if check_relevant(combined, eq.expected_title_keywords):
                relevant_rank = rank
                relevant_found = True
                break

        result = EvalResult(
            query=eq.query, domain=eq.domain, difficulty=eq.difficulty,
            expected_category=eq.expected_category,
            hit=hit, relevant_found=relevant_found, relevant_rank=relevant_rank,
            top1_similarity=top1_sim, top1_title=top1_title, top1_category=top1_cat,
            num_results=num_results, latency_ms=latency,
        )
        results.append(result)

        status = "PASS" if relevant_found else ("MISS" if hit else "FAIL")
        if verbose:
            logger.info(
                f"  [{i:2d}] [{status:4s}] [{eq.domain:12s}] "
                f"sim={top1_sim:.3f} rank={relevant_rank} "
                f"\"{eq.query[:35]}\" → \"{top1_title[:40]}\""
            )
        else:
            mark = "✓" if relevant_found else ("△" if hit else "✗")
            logger.info(f"  [{i:2d}] {mark} {eq.query[:50]}")

    # ── Compute metrics ──
    total = len(results)
    hits = sum(1 for r in results if r.hit)
    relevant_hits = sum(1 for r in results if r.relevant_found)
    hit_rate = hits / total if total > 0 else 0
    recall_at_k = relevant_hits / total if total > 0 else 0

    # MRR (Mean Reciprocal Rank)
    reciprocal_ranks = [1.0 / r.relevant_rank if r.relevant_rank > 0 else 0.0 for r in results]
    mrr = sum(reciprocal_ranks) / total if total > 0 else 0

    # nDCG@k (per query, using binary relevance)
    ndcg_scores = []
    for r in results:
        relevances = []
        # We only know the rank of the first relevant — approximate binary relevance
        for rank in range(1, top_k + 1):
            if rank == r.relevant_rank:
                relevances.append(1.0)
            else:
                relevances.append(0.0)
        ndcg_scores.append(compute_ndcg(relevances, top_k))
    avg_ndcg = sum(ndcg_scores) / total if total > 0 else 0

    avg_sim = sum(r.top1_similarity for r in results) / total if total > 0 else 0
    avg_latency = sum(r.latency_ms for r in results) / total if total > 0 else 0

    # Per-domain breakdown
    domains = set(r.domain for r in results)
    for domain in sorted(domains):
        domain_results = [r for r in results if r.domain == domain]
        d_total = len(domain_results)
        d_recall = sum(1 for r in domain_results if r.relevant_found) / d_total
        d_mrr_vals = [1.0 / r.relevant_rank if r.relevant_rank > 0 else 0.0 for r in domain_results]
        d_mrr = sum(d_mrr_vals) / d_total
        d_sim = sum(r.top1_similarity for r in domain_results) / d_total
        domain_stats[domain] = {
            "total": d_total,
            "recall@k": round(d_recall, 4),
            "mrr": round(d_mrr, 4),
            "avg_similarity": round(d_sim, 4),
        }

    # Difficulty breakdown
    diff_stats = {}
    for diff in ["normal", "hard"]:
        diff_results = [r for r in results if r.difficulty == diff]
        if diff_results:
            d_total = len(diff_results)
            d_recall = sum(1 for r in diff_results if r.relevant_found) / d_total
            diff_stats[diff] = {
                "total": d_total,
                "recall@k": round(d_recall, 4),
            }

    summary = {
        "total_queries": total,
        "top_k": top_k,
        "threshold": threshold,
        "hit_rate": round(hit_rate, 4),
        "recall@k": round(recall_at_k, 4),
        "mrr": round(mrr, 4),
        "ndcg@k": round(avg_ndcg, 4),
        "avg_top1_similarity": round(avg_sim, 4),
        "avg_latency_ms": round(avg_latency, 1),
        "domain_breakdown": domain_stats,
        "difficulty_breakdown": diff_stats,
        "missed_queries": [
            {"query": r.query, "domain": r.domain, "top1_title": r.top1_title, "top1_sim": r.top1_similarity}
            for r in results if not r.relevant_found
        ],
    }

    return summary


def print_report(summary: dict):
    """Print a formatted evaluation report."""
    print("\n" + "=" * 70)
    print("  食品知识库 RAG 评测报告")
    print("=" * 70)

    print(f"\n  总查询数:    {summary['total_queries']}")
    print(f"  top_k:       {summary['top_k']}")
    print(f"  threshold:   {summary['threshold']}")
    print(f"\n  {'─' * 50}")
    print(f"  命中率 (Hit Rate):     {summary['hit_rate']:.1%}")
    print(f"  召回率 (Recall@{summary['top_k']}):    {summary['recall@k']:.1%}")
    print(f"  MRR:                   {summary['mrr']:.4f}")
    print(f"  nDCG@{summary['top_k']}:               {summary['ndcg@k']:.4f}")
    print(f"  平均Top1相似度:        {summary['avg_top1_similarity']:.4f}")
    print(f"  平均延迟:              {summary['avg_latency_ms']:.0f}ms")

    print(f"\n  {'─' * 50}")
    print("  Domain Breakdown:")
    print(f"  {'Domain':15s} {'Queries':>8s} {'Recall@k':>10s} {'MRR':>8s} {'Avg Sim':>8s}")
    for domain, stats in sorted(summary["domain_breakdown"].items()):
        print(f"  {domain:15s} {stats['total']:8d} {stats['recall@k']:10.1%} {stats['mrr']:8.4f} {stats['avg_similarity']:8.4f}")

    if summary.get("difficulty_breakdown"):
        print(f"\n  Difficulty Breakdown:")
        for diff, stats in summary["difficulty_breakdown"].items():
            print(f"  {diff:10s}  {stats['total']} queries, recall@k={stats['recall@k']:.1%}")

    missed = summary.get("missed_queries", [])
    if missed:
        print(f"\n  {'─' * 50}")
        print(f"  Missed Queries ({len(missed)}):")
        for m in missed:
            print(f"    [{m['domain']:12s}] \"{m['query'][:40]}\" → \"{m['top1_title'][:30]}\" (sim={m['top1_sim']:.3f})")

    print("\n" + "=" * 70)


def main():
    parser = argparse.ArgumentParser(description="食品知识库 RAG 评测基准")
    parser.add_argument("--server", "-s", default="http://47.100.235.168:8083")
    parser.add_argument("--top-k", "-k", type=int, default=5)
    parser.add_argument("--threshold", "-t", type=float, default=0.50)
    parser.add_argument("--verbose", "-v", action="store_true")
    parser.add_argument("--output", "-o", default=None, help="Save results as JSON")
    args = parser.parse_args()

    # Health check
    logger.info(f"Checking server: {args.server}")
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(f"{args.server}/api/food-kb/health")
            health = resp.json()
            logger.info(f"Health: {health.get('status', 'unknown')}")
    except Exception as e:
        logger.error(f"Server unreachable: {e}")
        sys.exit(1)

    summary = run_eval(args.server, args.top_k, args.threshold, args.verbose)
    print_report(summary)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        logger.info(f"Results saved to {args.output}")


if __name__ == "__main__":
    main()
