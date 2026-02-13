#!/usr/bin/env python3
"""
食品知识库 RAG 扩展评测基准 — 180+ 查询覆盖全部 42 分类

Phase 1: 从 60 条开发者查询扩展到 180+ 条，覆盖:
  - 42 个 DB 分类 (每类 4+ 条)
  - 3 个难度等级 (easy/medium/hard)
  - 10 种查询风格 (标准/口语化/场景化/模糊/否定式/多意图/对比式/错别字/追问式/对抗性)
  - 6 条对抗性查询 (超范围/极度模糊/错误假设)

Metrics: Hit Rate, Recall@5, MRR, nDCG@5, per-category/per-style/per-difficulty breakdowns

Usage:
  python eval_expanded.py --server http://localhost:8083
  python eval_expanded.py --server http://localhost:8083 --verbose --output eval_expanded_results.json
  python eval_expanded.py --server http://localhost:8083 --category additive  # test single category
  python eval_expanded.py --server http://localhost:8083 --style 口语化       # test single style
"""

import argparse
import json
import logging
import math
import sys
import time
from typing import List, Dict, Any, Optional

import httpx

# Import query groups
from eval_queries_group_a import QUERIES as QUERIES_A
from eval_queries_group_b import QUERIES as QUERIES_B
from eval_queries_group_c import QUERIES as QUERIES_C
from eval_queries_group_d import QUERIES as QUERIES_D

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("eval_expanded")


# ─── Merge all queries ────────────────────────────────────────────────────────

ALL_QUERIES: List[Dict[str, Any]] = QUERIES_A + QUERIES_B + QUERIES_C + QUERIES_D


# ─── Metrics ──────────────────────────────────────────────────────────────────

def check_relevant(result_title: str, result_content: str, expected_keywords: List[str]) -> bool:
    """Check if a result matches any expected keyword in title or content prefix."""
    if "__NONE__" in expected_keywords:
        return False  # adversarial query — nothing should match
    combined = (result_title + " " + result_content[:200]).lower()
    for kw in expected_keywords:
        if kw.lower() in combined:
            return True
    return False


def compute_dcg(relevances: List[float], k: int) -> float:
    dcg = 0.0
    for i in range(min(k, len(relevances))):
        dcg += relevances[i] / math.log2(i + 2)
    return dcg


def compute_ndcg(relevances: List[float], k: int) -> float:
    dcg = compute_dcg(relevances, k)
    ideal = compute_dcg(sorted(relevances, reverse=True), k)
    return dcg / ideal if ideal > 0 else 0.0


# ─── Runner ───────────────────────────────────────────────────────────────────

def run_eval(
    server: str,
    queries: List[Dict],
    top_k: int = 5,
    threshold: float = 0.50,
    verbose: bool = False,
) -> Dict:
    """Run evaluation on given queries and compute metrics."""
    results = []

    logger.info(f"Running {len(queries)} queries against {server}")

    for i, q in enumerate(queries, 1):
        query_text = q["query"]
        expected_kw = q["expected_title_keywords"]
        category = q.get("category", "unknown")
        difficulty = q.get("difficulty", "easy")
        style = q.get("style", "标准")
        is_adversarial = "__NONE__" in expected_kw

        start = time.time()
        try:
            with httpx.Client(timeout=30) as client:
                resp = client.post(
                    f"{server}/api/food-kb/query",
                    json={"query": query_text, "top_k": top_k, "similarity_threshold": threshold},
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.error(f"  [{i:3d}] ERROR: {e}")
            results.append({
                "query": query_text, "category": category, "difficulty": difficulty,
                "style": style, "hit": False, "relevant_found": False, "relevant_rank": 0,
                "top1_sim": 0.0, "top1_title": "ERROR", "latency_ms": (time.time() - start) * 1000,
                "is_adversarial": is_adversarial,
            })
            continue

        latency = (time.time() - start) * 1000
        docs = data.get("data", [])
        hit = len(docs) > 0
        top1_sim = docs[0].get("similarity", 0.0) if docs else 0.0
        top1_title = docs[0].get("title", "N/A") if docs else "N/A"

        # Find rank of first relevant result
        relevant_rank = 0
        relevant_found = False
        if not is_adversarial:
            for rank, doc in enumerate(docs, 1):
                title = doc.get("title", "")
                content = doc.get("content", "")
                if check_relevant(title, content, expected_kw):
                    relevant_rank = rank
                    relevant_found = True
                    break

        result = {
            "query": query_text, "category": category, "difficulty": difficulty,
            "style": style, "hit": hit, "relevant_found": relevant_found,
            "relevant_rank": relevant_rank, "top1_sim": round(top1_sim, 4),
            "top1_title": top1_title, "latency_ms": round(latency, 1),
            "is_adversarial": is_adversarial,
        }
        results.append(result)

        # Log
        if is_adversarial:
            mark = "ADV"
            logger.info(
                f"  [{i:3d}] [{mark:4s}]  sim={top1_sim:.3f}  "
                f"[{style:4s}] \"{query_text[:40]}\" → \"{top1_title[:35]}\""
            )
        elif verbose:
            mark = "✓" if relevant_found else "△"
            logger.info(
                f"  [{i:3d}] {mark}        sim={top1_sim:.3f} rank={relevant_rank:<3d}  "
                f"[{style:4s}] \"{query_text[:40]}\" → \"{top1_title[:35]}\""
            )
        else:
            mark = "✓" if relevant_found else "✗"
            logger.info(f"  [{i:3d}] {mark} [{category:16s}] {query_text[:55]}")

    # ── Compute metrics (excluding adversarial) ──
    non_adv = [r for r in results if not r["is_adversarial"]]
    total = len(non_adv)
    hits = sum(1 for r in non_adv if r["hit"])
    relevant_hits = sum(1 for r in non_adv if r["relevant_found"])
    hit_rate = hits / total if total > 0 else 0
    recall_at_k = relevant_hits / total if total > 0 else 0

    # MRR
    rr = [1.0 / r["relevant_rank"] if r["relevant_rank"] > 0 else 0.0 for r in non_adv]
    mrr = sum(rr) / total if total > 0 else 0

    # nDCG@k
    ndcg_scores = []
    for r in non_adv:
        rels = [1.0 if rank == r["relevant_rank"] else 0.0 for rank in range(1, top_k + 1)]
        ndcg_scores.append(compute_ndcg(rels, top_k))
    avg_ndcg = sum(ndcg_scores) / total if total > 0 else 0

    avg_sim = sum(r["top1_sim"] for r in non_adv) / total if total > 0 else 0
    avg_latency = sum(r["latency_ms"] for r in results) / len(results) if results else 0

    # ── Per-category breakdown ──
    category_stats = {}
    categories = sorted(set(r["category"] for r in non_adv))
    for cat in categories:
        cat_results = [r for r in non_adv if r["category"] == cat]
        ct = len(cat_results)
        c_recall = sum(1 for r in cat_results if r["relevant_found"]) / ct
        c_rr = [1.0 / r["relevant_rank"] if r["relevant_rank"] > 0 else 0.0 for r in cat_results]
        c_mrr = sum(c_rr) / ct
        c_sim = sum(r["top1_sim"] for r in cat_results) / ct
        category_stats[cat] = {
            "total": ct,
            "recall": round(c_recall, 4),
            "mrr": round(c_mrr, 4),
            "avg_sim": round(c_sim, 4),
        }

    # ── Per-style breakdown ──
    style_stats = {}
    styles = sorted(set(r["style"] for r in non_adv))
    for st in styles:
        st_results = [r for r in non_adv if r["style"] == st]
        st_total = len(st_results)
        s_recall = sum(1 for r in st_results if r["relevant_found"]) / st_total
        s_rr = [1.0 / r["relevant_rank"] if r["relevant_rank"] > 0 else 0.0 for r in st_results]
        s_mrr = sum(s_rr) / st_total
        s_sim = sum(r["top1_sim"] for r in st_results) / st_total
        style_stats[st] = {
            "total": st_total,
            "recall": round(s_recall, 4),
            "mrr": round(s_mrr, 4),
            "avg_sim": round(s_sim, 4),
        }

    # ── Per-difficulty breakdown ──
    diff_stats = {}
    diffs = sorted(set(r["difficulty"] for r in non_adv))
    for diff in diffs:
        d_results = [r for r in non_adv if r["difficulty"] == diff]
        dt = len(d_results)
        d_recall = sum(1 for r in d_results if r["relevant_found"]) / dt
        d_rr = [1.0 / r["relevant_rank"] if r["relevant_rank"] > 0 else 0.0 for r in d_results]
        d_mrr = sum(d_rr) / dt
        diff_stats[diff] = {
            "total": dt,
            "recall": round(d_recall, 4),
            "mrr": round(d_mrr, 4),
        }

    # ── Missed queries ──
    missed = [
        {"query": r["query"], "category": r["category"], "style": r["style"],
         "difficulty": r["difficulty"], "top1_title": r["top1_title"], "top1_sim": r["top1_sim"]}
        for r in non_adv if not r["relevant_found"]
    ]

    # ── Adversarial results ──
    adv_results = [r for r in results if r["is_adversarial"]]

    summary = {
        "test_type": "Phase 1 — Expanded Eval (180+ queries, 42 categories)",
        "total_queries": len(results),
        "non_adversarial": total,
        "adversarial": len(adv_results),
        "top_k": top_k,
        "threshold": threshold,
        "hit_rate": round(hit_rate, 4),
        "recall@k": round(recall_at_k, 4),
        "mrr": round(mrr, 4),
        "ndcg@k": round(avg_ndcg, 4),
        "avg_top1_similarity": round(avg_sim, 4),
        "avg_latency_ms": round(avg_latency, 1),
        "category_breakdown": category_stats,
        "style_breakdown": style_stats,
        "difficulty_breakdown": diff_stats,
        "missed_queries": missed,
        "adversarial_results": [
            {"query": r["query"], "top1_title": r["top1_title"], "top1_sim": r["top1_sim"]}
            for r in adv_results
        ],
        "all_results": results,
    }
    return summary


# ─── Report ───────────────────────────────────────────────────────────────────

def print_report(summary: Dict):
    print("\n" + "=" * 72)
    print("  食品知识库 RAG 扩展评测报告 — Phase 1")
    print("=" * 72)

    print(f"\n  总查询数:       {summary['total_queries']}  (非对抗: {summary['non_adversarial']}, 对抗: {summary['adversarial']})")
    print(f"  top_k:          {summary['top_k']}")

    print(f"\n  {'─' * 54}")
    print(f"  命中率 (Hit Rate):     {summary['hit_rate']:.1%}")
    print(f"  召回率 (Recall@{summary['top_k']}):    {summary['recall@k']:.1%}")
    print(f"  MRR:                   {summary['mrr']:.4f}")
    print(f"  nDCG@{summary['top_k']}:               {summary['ndcg@k']:.4f}")
    print(f"  平均Top1相似度:        {summary['avg_top1_similarity']:.4f}")
    print(f"  平均延迟:              {summary['avg_latency_ms']:.0f}ms")

    # Compare with baseline
    print(f"\n  {'─' * 54}")
    print(f"  与基线对比:")
    print(f"    开发者60条 MRR:   1.0000")
    print(f"    真实20条 MRR:     0.9417")
    print(f"    扩展{summary['non_adversarial']}条 MRR:  {summary['mrr']:.4f}")

    # Per-category
    print(f"\n  {'─' * 54}")
    print(f"  按分类 ({len(summary['category_breakdown'])} categories):")
    print(f"  {'Category':20s} {'#':>3s} {'Recall':>8s} {'MRR':>8s} {'Sim':>6s}")
    for cat, stats in sorted(summary["category_breakdown"].items(), key=lambda x: x[1]["mrr"]):
        flag = " ⚠" if stats["mrr"] < 0.9 else ""
        print(f"  {cat:20s} {stats['total']:3d} {stats['recall']:.1%}  {stats['mrr']:.4f} {stats['avg_sim']:.3f}{flag}")

    # Per-style
    print(f"\n  {'─' * 54}")
    print(f"  按风格:")
    print(f"  {'Style':10s} {'#':>3s} {'Recall':>8s} {'MRR':>8s} {'Sim':>6s}")
    for st, stats in sorted(summary["style_breakdown"].items(), key=lambda x: x[1]["mrr"]):
        flag = " ⚠" if stats["mrr"] < 0.9 else ""
        print(f"  {st:10s} {stats['total']:3d} {stats['recall']:.1%}  {stats['mrr']:.4f} {stats['avg_sim']:.3f}{flag}")

    # Per-difficulty
    print(f"\n  {'─' * 54}")
    print(f"  按难度:")
    for diff, stats in sorted(summary["difficulty_breakdown"].items()):
        print(f"  {diff:10s}  {stats['total']:3d} queries, recall={stats['recall']:.1%}, mrr={stats['mrr']:.4f}")

    # Missed queries
    missed = summary.get("missed_queries", [])
    if missed:
        print(f"\n  {'─' * 54}")
        print(f"  未命中查询 ({len(missed)}):")
        for m in missed:
            print(f"    [{m['category']:16s}] [{m['style']:4s}] \"{m['query'][:40]}\"")
            print(f"       → got: \"{m['top1_title'][:40]}\" (sim={m['top1_sim']:.3f})")
    else:
        print(f"\n  所有非对抗查询均命中! ✓")

    # Adversarial
    adv = summary.get("adversarial_results", [])
    if adv:
        print(f"\n  {'─' * 54}")
        print(f"  对抗性查询 ({len(adv)}):")
        for a in adv:
            print(f"    \"{a['query'][:45]}\" → \"{a['top1_title'][:30]}\" (sim={a['top1_sim']:.3f})")

    # Weak categories (MRR < 0.9)
    weak = [(cat, s) for cat, s in summary["category_breakdown"].items() if s["mrr"] < 0.9]
    if weak:
        print(f"\n  {'─' * 54}")
        print(f"  ⚠ 薄弱分类 (MRR < 0.9):")
        for cat, s in sorted(weak, key=lambda x: x[1]["mrr"]):
            print(f"    {cat}: MRR={s['mrr']:.4f}, Recall={s['recall']:.1%}")

    print("\n" + "=" * 72)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="食品知识库 RAG 扩展评测")
    parser.add_argument("--server", "-s", default="http://47.100.235.168:8083")
    parser.add_argument("--top-k", "-k", type=int, default=5)
    parser.add_argument("--threshold", "-t", type=float, default=0.50)
    parser.add_argument("--verbose", "-v", action="store_true")
    parser.add_argument("--output", "-o", default=None, help="Save results as JSON")
    parser.add_argument("--category", "-c", default=None, help="Filter by category")
    parser.add_argument("--style", default=None, help="Filter by style")
    parser.add_argument("--difficulty", "-d", default=None, help="Filter by difficulty")
    args = parser.parse_args()

    # Health check
    logger.info(f"Checking server: {args.server}")
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(f"{args.server}/api/food-kb/health")
            health = resp.json()
            components = len(health) if isinstance(health, dict) else 0
            logger.info(f"Health: OK (components: {components})")
    except Exception as e:
        logger.error(f"Server unreachable: {e}")
        sys.exit(1)

    # Filter queries
    queries = ALL_QUERIES
    if args.category:
        queries = [q for q in queries if q.get("category") == args.category]
        logger.info(f"Filtered to category={args.category}: {len(queries)} queries")
    if args.style:
        queries = [q for q in queries if q.get("style") == args.style]
        logger.info(f"Filtered to style={args.style}: {len(queries)} queries")
    if args.difficulty:
        queries = [q for q in queries if q.get("difficulty") == args.difficulty]
        logger.info(f"Filtered to difficulty={args.difficulty}: {len(queries)} queries")

    if not queries:
        logger.error("No queries match the filter criteria")
        sys.exit(1)

    # Validate query format
    required_fields = {"query", "expected_title_keywords", "category", "difficulty", "style"}
    for i, q in enumerate(queries):
        missing = required_fields - set(q.keys())
        if missing:
            logger.error(f"Query #{i+1} missing fields: {missing} — {q.get('query', '?')[:40]}")
            sys.exit(1)

    logger.info(f"Total queries loaded: {len(ALL_QUERIES)} (A:{len(QUERIES_A)} B:{len(QUERIES_B)} C:{len(QUERIES_C)} D:{len(QUERIES_D)})")

    summary = run_eval(args.server, queries, args.top_k, args.threshold, args.verbose)
    print_report(summary)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        logger.info(f"Results saved to {args.output}")


if __name__ == "__main__":
    main()
