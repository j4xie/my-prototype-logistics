#!/usr/bin/env python3
"""
Embedding Model Benchmark: GTE-base-zh vs BGE-M3 vs Qwen3-Embedding-0.6B

Tests:
1. Single-query latency (100 iterations, mean + p95)
2. Batch throughput (batch=32, 1000 queries)
3. Memory footprint (RSS delta)
4. Chinese semantic quality (intent keyword similarity gap)

Usage:
    pip install sentence-transformers psutil numpy
    python scripts/benchmark_embeddings.py
"""

import gc
import json
import os
import sys
import time
from pathlib import Path

import numpy as np
import psutil

# Candidates to benchmark
CANDIDATES = [
    {
        "name": "GTE-base-zh (current)",
        "model_id": "thenlper/gte-base-zh",
        "dim": 768,
        "params": "~110M",
    },
    {
        "name": "BGE-M3",
        "model_id": "BAAI/bge-m3",
        "dim": 1024,
        "params": "~568M",
    },
    {
        "name": "Qwen3-Embedding-0.6B",
        "model_id": "Qwen/Qwen3-Embedding-0.6B",
        "dim": 1024,
        "params": "~600M",
    },
]

# Chinese intent test pairs for semantic quality evaluation
# Format: (query, positive_match, negative_match)
SEMANTIC_TEST_PAIRS = [
    # Production domain
    ("查看今天的生产批次", "今日生产进度", "员工出勤记录"),
    ("设备运行状态", "机器工作情况", "财务报表分析"),
    ("原料库存查询", "物料剩余数量", "客户订单详情"),
    ("质检报告", "产品检测结果", "调度计划安排"),
    # HR domain
    ("员工考勤统计", "出勤打卡记录", "设备维修保养"),
    ("请假审批", "休假申请处理", "仓库盘点清单"),
    ("工资发放查询", "薪资结算明细", "生产排程计划"),
    # Logistics
    ("发货单", "出库物流单据", "产品质量检验"),
    ("客户订单列表", "买家购买记录", "人力资源报表"),
    ("采购单审批", "进货申请处理", "生产线维护"),
    # Finance
    ("本月利润率", "当月盈利情况", "仓库温度监控"),
    ("成本趋势分析", "费用变化走势", "员工排班表"),
    ("应收账款", "客户欠款统计", "设备故障记录"),
    # SmartBI / Analytics
    ("数据分析报告", "智能BI图表", "物料入库登记"),
    ("销售趋势", "营收增长曲线", "考勤异常提醒"),
    # Equipment
    ("设备维修记录", "机器保养历史", "销售回款统计"),
    ("告警诊断", "异常报警分析", "请假审批流程"),
    # Navigation
    ("返回上一页", "页面导航后退", "原料批次追溯"),
    ("切换到中文", "语言设置修改", "库存预警提醒"),
    # Mixed
    ("帮我查一下最近的订单", "近期购买记录", "设备校准报告"),
]


def get_process_memory_mb():
    """Get current process RSS in MB."""
    return psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)


def cosine_similarity(a, b):
    """Compute cosine similarity between two vectors."""
    a, b = np.array(a), np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))


def benchmark_model(candidate):
    """Run full benchmark for a single model."""
    from sentence_transformers import SentenceTransformer

    name = candidate["name"]
    model_id = candidate["model_id"]
    expected_dim = candidate["dim"]

    print(f"\n{'='*60}")
    print(f"  Benchmarking: {name}")
    print(f"  Model: {model_id} (expected dim={expected_dim})")
    print(f"{'='*60}")

    results = {"name": name, "model_id": model_id}

    # --- Memory before loading ---
    gc.collect()
    mem_before = get_process_memory_mb()

    # --- Load model ---
    t0 = time.time()
    try:
        model = SentenceTransformer(model_id, trust_remote_code=True)
    except Exception as e:
        print(f"  FAILED to load model: {e}")
        results["error"] = str(e)
        return results

    load_time = time.time() - t0
    mem_after = get_process_memory_mb()
    results["load_time_s"] = round(load_time, 2)
    results["memory_mb"] = round(mem_after - mem_before, 1)
    print(f"  Loaded in {load_time:.1f}s, memory delta: {mem_after - mem_before:.0f}MB")

    # --- Verify dimension ---
    test_vec = model.encode("测试")
    actual_dim = len(test_vec)
    results["actual_dim"] = actual_dim
    print(f"  Output dimension: {actual_dim}")

    # --- Single-query latency (100 iterations) ---
    test_queries = [
        "查看今天的生产批次",
        "设备运行状态查询",
        "本月利润率是多少",
        "员工出勤统计",
        "原料库存不足提醒",
    ]
    latencies = []
    for _ in range(20):  # 20 rounds * 5 queries = 100 inferences
        for q in test_queries:
            t0 = time.perf_counter()
            model.encode(q)
            latencies.append((time.perf_counter() - t0) * 1000)

    results["latency_mean_ms"] = round(np.mean(latencies), 2)
    results["latency_p95_ms"] = round(np.percentile(latencies, 95), 2)
    results["latency_p99_ms"] = round(np.percentile(latencies, 99), 2)
    print(f"  Single-query latency: mean={results['latency_mean_ms']:.1f}ms, "
          f"p95={results['latency_p95_ms']:.1f}ms, p99={results['latency_p99_ms']:.1f}ms")

    # --- Batch throughput (batch=32, 1000 queries) ---
    batch_queries = test_queries * 200  # 1000 queries
    t0 = time.time()
    model.encode(batch_queries, batch_size=32, show_progress_bar=False)
    batch_time = time.time() - t0
    results["batch_1000_time_s"] = round(batch_time, 2)
    results["throughput_qps"] = round(1000 / batch_time, 1)
    print(f"  Batch throughput: {1000/batch_time:.0f} queries/s ({batch_time:.1f}s for 1000)")

    # --- Semantic quality test ---
    pos_sims = []
    neg_sims = []
    for query, positive, negative in SEMANTIC_TEST_PAIRS:
        q_vec = model.encode(query)
        p_vec = model.encode(positive)
        n_vec = model.encode(negative)
        pos_sims.append(cosine_similarity(q_vec, p_vec))
        neg_sims.append(cosine_similarity(q_vec, n_vec))

    avg_pos = np.mean(pos_sims)
    avg_neg = np.mean(neg_sims)
    gap = avg_pos - avg_neg
    results["semantic_pos_sim"] = round(float(avg_pos), 4)
    results["semantic_neg_sim"] = round(float(avg_neg), 4)
    results["semantic_gap"] = round(float(gap), 4)
    results["semantic_pairs"] = len(SEMANTIC_TEST_PAIRS)

    print(f"  Semantic quality ({len(SEMANTIC_TEST_PAIRS)} pairs):")
    print(f"    Positive sim: {avg_pos:.4f}")
    print(f"    Negative sim: {avg_neg:.4f}")
    print(f"    Gap (higher=better): {gap:.4f}")

    # --- Cleanup ---
    del model
    gc.collect()

    return results


def print_comparison_table(all_results):
    """Print formatted comparison table."""
    print(f"\n{'='*80}")
    print("  BENCHMARK COMPARISON TABLE")
    print(f"{'='*80}")

    # Header
    metrics = [
        ("Model", "name", "{}"),
        ("Dim", "actual_dim", "{}"),
        ("Load(s)", "load_time_s", "{:.1f}"),
        ("Mem(MB)", "memory_mb", "{:.0f}"),
        ("Latency(ms)", "latency_mean_ms", "{:.1f}"),
        ("P95(ms)", "latency_p95_ms", "{:.1f}"),
        ("QPS", "throughput_qps", "{:.0f}"),
        ("+Sim", "semantic_pos_sim", "{:.4f}"),
        ("-Sim", "semantic_neg_sim", "{:.4f}"),
        ("Gap", "semantic_gap", "{:.4f}"),
    ]

    # Print header
    header = " | ".join(f"{m[0]:>12}" for m in metrics)
    print(f"  {header}")
    print(f"  {'-'*len(header)}")

    # Print each row
    for r in all_results:
        if "error" in r:
            print(f"  {r['name']:>12} | FAILED: {r['error']}")
            continue
        row = []
        for _, key, fmt in metrics:
            val = r.get(key, "N/A")
            if val == "N/A":
                row.append(f"{'N/A':>12}")
            elif isinstance(val, str):
                row.append(f"{val:>12}")
            else:
                row.append(f"{fmt.format(val):>12}")
        print(f"  {' | '.join(row)}")

    print(f"{'='*80}")

    # Find best model by semantic gap
    valid = [r for r in all_results if "error" not in r and "semantic_gap" in r]
    if valid:
        best = max(valid, key=lambda x: x["semantic_gap"])
        fastest = min(valid, key=lambda x: x["latency_mean_ms"])
        print(f"\n  Best semantic quality: {best['name']} (gap={best['semantic_gap']:.4f})")
        print(f"  Fastest latency: {fastest['name']} ({fastest['latency_mean_ms']:.1f}ms)")

        # Recommendation
        print(f"\n  RECOMMENDATION:")
        if best["name"] == fastest["name"]:
            print(f"  -> {best['name']} wins on both quality and speed")
        else:
            # Check if quality improvement justifies speed loss
            gap_improvement = (best["semantic_gap"] - fastest["semantic_gap"]) / fastest["semantic_gap"] * 100
            speed_loss = (best["latency_mean_ms"] - fastest["latency_mean_ms"]) / fastest["latency_mean_ms"] * 100
            print(f"  -> Quality winner ({best['name']}): +{gap_improvement:.0f}% better gap, "
                  f"+{speed_loss:.0f}% slower")
            if gap_improvement > 10 and speed_loss < 200:
                print(f"  -> Recommend: {best['name']} (significant quality gain, acceptable speed)")
            elif gap_improvement < 5:
                print(f"  -> Recommend: {fastest['name']} (minimal quality difference, faster)")
            else:
                print(f"  -> Recommend: Depends on use case (quality vs latency tradeoff)")


def main():
    print("=" * 60)
    print("  Embedding Model Benchmark")
    print(f"  Candidates: {len(CANDIDATES)}")
    print(f"  Semantic test pairs: {len(SEMANTIC_TEST_PAIRS)}")
    print(f"  CPU: {os.cpu_count()} cores")
    print("=" * 60)

    all_results = []
    for candidate in CANDIDATES:
        result = benchmark_model(candidate)
        all_results.append(result)

    # Print comparison table
    print_comparison_table(all_results)

    # Save results to JSON
    output_path = Path(__file__).parent / "benchmark_embedding_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"\n  Results saved to: {output_path}")


if __name__ == "__main__":
    main()
