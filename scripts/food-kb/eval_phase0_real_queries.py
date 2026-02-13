#!/usr/bin/env python3
"""
Phase 0: 真实用户风格查询基线验证

验证MRR=1.0是否可泛化到真实用户查询场景。
使用模拟工厂管理员/质检员/采购员/车间主管的自然语言风格。

对比维度:
  1. 口语化/非标准表述（"那个防腐的东西" vs "山梨酸钾"）
  2. 实际操作场景（"冷库温度设多少" vs "冷链运输温度控制"）
  3. 模糊/不完整查询（"肉里加什么不变色" vs "亚硝酸盐护色作用"）
  4. 错别字/简称（"食品按全法" vs "食品安全法"）
  5. 多意图混合（"我们厂要办SC证需要什么条件，HACCP也要吗"）
  6. 否定式/反向提问（"哪些添加剂不能用在饮料里"）

Usage:
  python eval_phase0_real_queries.py --server http://47.100.235.168:8083
  python eval_phase0_real_queries.py --server http://47.100.235.168:8083 --verbose
"""

import argparse
import json
import logging
import math
import sys
import time
from dataclasses import dataclass
from typing import List

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("eval_phase0")


@dataclass
class RealQuery:
    """A realistic user query with evaluation criteria."""
    query: str
    persona: str  # who would ask this: 工厂管理员/质检员/采购员/车间主管/普通员工
    style: str  # 口语化/场景化/模糊/错别字/多意图/否定式/追问式
    expected_title_keywords: List[str]  # ANY of these in title+content = relevant
    notes: str  # why this tests something different from developer queries


REAL_QUERIES: List[RealQuery] = [
    # ─── 口语化/非标准表述 ───
    RealQuery(
        query="我们做火腿肠的，那个防腐用的东西最多能放多少",
        persona="车间主管",
        style="口语化",
        expected_title_keywords=["防腐剂", "山梨酸", "亚硝酸", "肉制品"],
        notes="不说'山梨酸'而说'防腐的东西'，测试语义理解能力",
    ),
    RealQuery(
        query="酸奶里面可以加什么让它变稠一点",
        persona="车间主管",
        style="口语化",
        expected_title_keywords=["增稠剂", "卡拉胶", "黄原胶", "乳制品"],
        notes="不用专业术语'增稠剂'，用口语'变稠一点'",
    ),
    RealQuery(
        query="做饼干用的那种膨松的粉有没有限量要求",
        persona="普通员工",
        style="口语化",
        expected_title_keywords=["膨松剂", "泡打粉", "烘焙", "碳酸氢钠"],
        notes="'膨松的粉'=泡打粉/膨松剂，完全口语化",
    ),

    # ─── 实际操作场景 ───
    RealQuery(
        query="冷库温度到底设多少度合适，肉类和蔬菜一样吗",
        persona="仓储主管",
        style="场景化",
        expected_title_keywords=["冷链", "冷藏", "温度", "冷库"],
        notes="实际操作问题，不是'冷链运输温度控制'这种教科书表述",
    ),
    RealQuery(
        query="车间工人手上有伤口还能不能上班",
        persona="车间主管",
        style="场景化",
        expected_title_keywords=["从业人员", "健康", "人员卫生", "培训"],
        notes="日常管理场景，涉及从业人员健康管理",
    ),
    RealQuery(
        query="客户投诉说吃了我们的东西拉肚子怎么处理",
        persona="工厂管理员",
        style="场景化",
        expected_title_keywords=["应急", "召回", "安全事件", "事故", "投诉"],
        notes="食品安全事件的实际应对场景",
    ),
    RealQuery(
        query="供应商送来的原料怎么验收才算合格",
        persona="采购员",
        style="场景化",
        expected_title_keywords=["供应商", "验收", "原料", "进货查验", "检验"],
        notes="日常采购验收场景",
    ),

    # ─── 模糊/不完整查询 ───
    RealQuery(
        query="肉里面加什么能保持红色",
        persona="车间主管",
        style="模糊",
        expected_title_keywords=["亚硝酸", "护色", "发色", "肉制品"],
        notes="不知道'亚硝酸盐护色'这个概念，只描述效果",
    ),
    RealQuery(
        query="食品上面要贴什么标签",
        persona="普通员工",
        style="模糊",
        expected_title_keywords=["标签", "GB 7718", "预包装", "标注"],
        notes="极度模糊的查询，只知道要贴标签但不知道具体要求",
    ),
    RealQuery(
        query="过期的标准还能用吗",
        persona="质检员",
        style="模糊",
        expected_title_keywords=["标准", "废止", "更新", "版本", "有效"],
        notes="问的是标准更新/废止问题但表述极度模糊",
    ),

    # ─── 错别字/简称 ───
    RealQuery(
        query="食品安全法对添加剂有什么规定",
        persona="工厂管理员",
        style="简称",
        expected_title_keywords=["食品安全法", "添加剂", "法规", "GB 2760"],
        notes="正常查询但可能匹配法规或添加剂标准",
    ),
    RealQuery(
        query="苯甲酸纳能不能放在酱油里面",
        persona="车间主管",
        style="错别字",
        expected_title_keywords=["苯甲酸", "防腐剂", "调味品", "酱油"],
        notes="'苯甲酸纳'是常见错误写法(正确:苯甲酸钠)，测试容错",
    ),

    # ─── 多意图/复合查询 ───
    RealQuery(
        query="我们要办SC证需要哪些材料，是不是还得做HACCP",
        persona="工厂管理员",
        style="多意图",
        expected_title_keywords=["生产许可", "SC", "HACCP"],
        notes="两个问题混在一起：SC证申请+HACCP关系",
    ),
    RealQuery(
        query="出口到日本的水产品重金属和农药残留限量分别是多少",
        persona="采购员",
        style="多意图",
        expected_title_keywords=["出口", "水产", "重金属", "农药", "进口"],
        notes="跨多个维度: 出口+水产+重金属+农残",
    ),

    # ─── 否定式/反向提问 ───
    RealQuery(
        query="哪些防腐剂是不允许在婴儿食品里用的",
        persona="质检员",
        style="否定式",
        expected_title_keywords=["防腐剂", "婴幼儿", "婴儿", "苯甲酸"],
        notes="反向提问'不允许'，而非'允许使用哪些'",
    ),
    RealQuery(
        query="生产车间不能使用什么材质的设备",
        persona="车间主管",
        style="否定式",
        expected_title_keywords=["设备", "材质", "不锈钢", "食品接触", "GMP"],
        notes="否定式查询，实际想知道设备材质要求",
    ),

    # ─── 追问式/上下文依赖 ───
    RealQuery(
        query="除了温度还有什么办法能控制细菌",
        persona="质检员",
        style="追问式",
        expected_title_keywords=["微生物", "控制", "杀菌", "消毒", "细菌"],
        notes="像是对话中的追问，缺少上下文(哪种细菌/哪种食品)",
    ),
    RealQuery(
        query="有机蔬菜和普通蔬菜在农残标准上有区别吗",
        persona="采购员",
        style="对比式",
        expected_title_keywords=["有机", "农药", "农残", "蔬菜"],
        notes="对比类查询，需要综合有机认证+农残标准两个领域",
    ),

    # ─── 长尾/冷门分类 ───
    RealQuery(
        query="网上卖食品需要什么资质",
        persona="工厂管理员",
        style="场景化",
        expected_title_keywords=["电商", "网络食品", "电子商务", "网购", "经营许可"],
        notes="电商食品冷门分类，知识库可能覆盖薄弱",
    ),
    RealQuery(
        query="转基因的食品是不是必须标出来",
        persona="普通员工",
        style="口语化",
        expected_title_keywords=["转基因", "GMO", "标识", "标签"],
        notes="GMO标签法规，冷门但重要的话题",
    ),
]


def check_relevant(result_title: str, result_content: str, expected_keywords: List[str]) -> bool:
    """Check if a result matches any expected keyword in title or content."""
    combined = (result_title + " " + result_content[:300]).lower()
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


def run_eval(server: str, top_k: int, threshold: float, verbose: bool) -> dict:
    results = []
    style_stats = {}

    logger.info(f"Phase 0: Running {len(REAL_QUERIES)} real-style queries against {server}")

    for i, rq in enumerate(REAL_QUERIES, 1):
        start = time.time()
        try:
            with httpx.Client(timeout=30) as client:
                resp = client.post(
                    f"{server}/api/food-kb/query",
                    json={"query": rq.query, "top_k": top_k, "similarity_threshold": threshold},
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.error(f"  [{i:2d}] ERROR: {e}")
            results.append({
                "query": rq.query, "persona": rq.persona, "style": rq.style,
                "hit": False, "relevant_found": False, "relevant_rank": 0,
                "top1_sim": 0.0, "top1_title": "ERROR", "latency_ms": (time.time() - start) * 1000,
            })
            continue

        latency = (time.time() - start) * 1000
        docs = data.get("data", [])
        hit = len(docs) > 0
        top1_sim = docs[0].get("similarity", 0.0) if docs else 0.0
        top1_title = docs[0].get("title", "N/A") if docs else "N/A"

        relevant_rank = 0
        relevant_found = False
        for rank, doc in enumerate(docs, 1):
            title = doc.get("title", "")
            content = doc.get("content", "")
            if check_relevant(title, content, rq.expected_title_keywords):
                relevant_rank = rank
                relevant_found = True
                break

        r = {
            "query": rq.query, "persona": rq.persona, "style": rq.style,
            "hit": hit, "relevant_found": relevant_found, "relevant_rank": relevant_rank,
            "top1_sim": round(top1_sim, 4), "top1_title": top1_title,
            "latency_ms": round(latency, 1), "notes": rq.notes,
        }
        results.append(r)

        mark = "✓" if relevant_found else ("△ rank>k" if hit else "✗")
        rank_str = f"rank={relevant_rank}" if relevant_found else "NOT_FOUND"
        if verbose:
            logger.info(
                f"  [{i:2d}] {mark:8s} sim={top1_sim:.3f} {rank_str:12s} "
                f"[{rq.style:5s}] \"{rq.query[:30]}\" → \"{top1_title[:35]}\""
            )
        else:
            logger.info(f"  [{i:2d}] {mark} {rq.query[:45]}")

    # Compute metrics
    total = len(results)
    hits = sum(1 for r in results if r["hit"])
    relevant_hits = sum(1 for r in results if r["relevant_found"])
    hit_rate = hits / total if total else 0
    recall = relevant_hits / total if total else 0

    rr_list = [1.0 / r["relevant_rank"] if r["relevant_rank"] > 0 else 0.0 for r in results]
    mrr = sum(rr_list) / total if total else 0

    ndcg_scores = []
    for r in results:
        rels = [1.0 if rank == r["relevant_rank"] else 0.0 for rank in range(1, top_k + 1)]
        ndcg_scores.append(compute_ndcg(rels, top_k))
    avg_ndcg = sum(ndcg_scores) / total if total else 0

    avg_sim = sum(r["top1_sim"] for r in results) / total if total else 0
    avg_latency = sum(r["latency_ms"] for r in results) / total if total else 0

    # Per-style breakdown
    styles = sorted(set(r["style"] for r in results))
    for style in styles:
        sr = [r for r in results if r["style"] == style]
        s_total = len(sr)
        s_recall = sum(1 for r in sr if r["relevant_found"]) / s_total
        s_mrr_vals = [1.0 / r["relevant_rank"] if r["relevant_rank"] > 0 else 0.0 for r in sr]
        s_mrr = sum(s_mrr_vals) / s_total
        s_sim = sum(r["top1_sim"] for r in sr) / s_total
        style_stats[style] = {
            "total": s_total, "recall": round(s_recall, 4),
            "mrr": round(s_mrr, 4), "avg_sim": round(s_sim, 4),
        }

    missed = [r for r in results if not r["relevant_found"]]

    summary = {
        "test_type": "Phase 0 — Real User Style Baseline Verification",
        "total_queries": total,
        "top_k": top_k,
        "threshold": threshold,
        "hit_rate": round(hit_rate, 4),
        "recall@k": round(recall, 4),
        "mrr": round(mrr, 4),
        "ndcg@k": round(avg_ndcg, 4),
        "avg_top1_similarity": round(avg_sim, 4),
        "avg_latency_ms": round(avg_latency, 1),
        "style_breakdown": style_stats,
        "comparison_with_dev_queries": {
            "dev_mrr": 1.0,
            "dev_ndcg": 1.0,
            "dev_queries": 60,
            "real_mrr": round(mrr, 4),
            "real_ndcg": round(avg_ndcg, 4),
            "real_queries": total,
            "mrr_gap": round(1.0 - mrr, 4),
            "verdict": "ALIGNED" if mrr >= 0.95 else ("MODERATE_GAP" if mrr >= 0.80 else "SIGNIFICANT_GAP"),
        },
        "missed_queries": [
            {"query": r["query"], "style": r["style"], "top1_title": r["top1_title"],
             "top1_sim": r["top1_sim"], "notes": r["notes"]}
            for r in missed
        ],
        "all_results": results,
    }

    return summary


def print_report(s: dict):
    comp = s["comparison_with_dev_queries"]
    print("\n" + "=" * 72)
    print("  Phase 0: 真实用户风格查询 — 基线验证报告")
    print("=" * 72)

    print(f"\n  总查询数:    {s['total_queries']}")
    print(f"  top_k:       {s['top_k']}")
    print(f"\n  {'─' * 54}")
    print(f"  命中率 (Hit Rate):     {s['hit_rate']:.1%}")
    print(f"  召回率 (Recall@5):     {s['recall@k']:.1%}")
    print(f"  MRR:                   {s['mrr']:.4f}")
    print(f"  nDCG@5:                {s['ndcg@k']:.4f}")
    print(f"  平均Top1相似度:        {s['avg_top1_similarity']:.4f}")
    print(f"  平均延迟:              {s['avg_latency_ms']:.0f}ms")

    print(f"\n  {'─' * 54}")
    print(f"  与开发者风格查询对比:")
    print(f"    开发者MRR:   {comp['dev_mrr']:.4f}  ({comp['dev_queries']}条)")
    print(f"    真实MRR:     {comp['real_mrr']:.4f}  ({comp['real_queries']}条)")
    print(f"    MRR差距:     {comp['mrr_gap']:.4f}")
    print(f"    判定:        {comp['verdict']}")

    print(f"\n  {'─' * 54}")
    print(f"  按查询风格分类:")
    print(f"  {'风格':8s} {'数量':>4s} {'Recall':>8s} {'MRR':>8s} {'Avg Sim':>8s}")
    for style, stats in sorted(s["style_breakdown"].items()):
        print(f"  {style:8s} {stats['total']:4d} {stats['recall']:8.1%} {stats['mrr']:8.4f} {stats['avg_sim']:8.4f}")

    missed = s.get("missed_queries", [])
    if missed:
        print(f"\n  {'─' * 54}")
        print(f"  未命中查询 ({len(missed)}/{s['total_queries']}):")
        for m in missed:
            print(f"    [{m['style']:5s}] \"{m['query'][:35]}\"")
            print(f"           → top1: \"{m['top1_title'][:40]}\" (sim={m['top1_sim']:.3f})")
            print(f"           原因: {m['notes']}")
    else:
        print(f"\n  所有查询均命中! ✓")

    print(f"\n  {'─' * 54}")
    if comp["verdict"] == "ALIGNED":
        print("  ✅ 结论: MRR基线稳定, 真实查询与开发者查询表现一致")
        print("     → 可继续Phase 1评测集扩展")
    elif comp["verdict"] == "MODERATE_GAP":
        print("  ⚠️  结论: MRR有中等差距, 某些查询风格检索效果下降")
        print("     → 建议先分析missed queries, 优化query rewriter后再扩展评测集")
    else:
        print("  ❌ 结论: MRR显著下降, 检索能力在真实场景下不足")
        print("     → 必须优先优化检索(知识库覆盖+查询改写), 暂缓Phase 1-3")

    print("\n" + "=" * 72)


def main():
    parser = argparse.ArgumentParser(description="Phase 0: 真实用户风格查询基线验证")
    parser.add_argument("--server", "-s", default="http://47.100.235.168:8083")
    parser.add_argument("--top-k", "-k", type=int, default=5)
    parser.add_argument("--threshold", "-t", type=float, default=0.50)
    parser.add_argument("--verbose", "-v", action="store_true")
    parser.add_argument("--output", "-o", default=None)
    args = parser.parse_args()

    logger.info(f"Checking server: {args.server}")
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(f"{args.server}/api/food-kb/health")
            health = resp.json()
            logger.info(f"Health: OK (components: {len(health.get('components', {}))})")
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
