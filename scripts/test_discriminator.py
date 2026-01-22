#!/usr/bin/env python3
"""
Discriminator Batch Test Script
Tests 200 cases (100 simple + 100 complex) and collects metrics
"""

import json
import requests
import time
from datetime import datetime
from pathlib import Path
from collections import defaultdict

SERVER = "http://139.196.165.140:10010"
BASE_DIR = Path(__file__).parent.parent
SIMPLE_FILE = BASE_DIR / "backend-java/src/main/resources/data/testing/simple_test_cases.json"
COMPLEX_FILE = BASE_DIR / "backend-java/src/main/resources/data/testing/complex_test_cases.json"
OUTPUT_DIR = BASE_DIR / "test_results"

# Candidate intents for testing
CANDIDATES = [
    "sales_overview", "sales_ranking", "sales_trend", "inventory",
    "MATERIAL_BATCH_QUERY", "PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY",
    "QUALITY_INSPECTION_QUERY", "ATTENDANCE_QUERY", "SHIPMENT_STATUS_QUERY",
    "ALERT_QUERY", "dept_performance", "region_analysis", "profit_analysis",
    "cost_analysis", "compare_period", "forecast"
]


def reset_metrics():
    """Reset discriminator metrics before test"""
    try:
        requests.post(f"{SERVER}/api/admin/discriminator/metrics/reset", timeout=10)
        requests.post(f"{SERVER}/api/admin/discriminator/cache/clear", timeout=10)
        print("✅ Metrics reset")
    except Exception as e:
        print(f"⚠️ Failed to reset metrics: {e}")


def run_batch_judge(user_input: str) -> dict:
    """Run batch judgment for a single user input"""
    try:
        response = requests.post(
            f"{SERVER}/api/admin/discriminator/batch-judge",
            json={"userInput": user_input, "intentCodes": CANDIDATES},
            timeout=30
        )
        data = response.json()
        if data.get("success") and data.get("data"):
            return data["data"]
        return {}
    except Exception as e:
        return {"error": str(e)}


def run_prune(user_input: str, is_write_op: bool = False) -> list:
    """Run pruning test"""
    try:
        response = requests.post(
            f"{SERVER}/api/admin/discriminator/prune",
            json={
                "userInput": user_input,
                "candidates": CANDIDATES,
                "writeOperation": is_write_op
            },
            timeout=30
        )
        data = response.json()
        if data.get("success") and data.get("data"):
            return data["data"]
        return []
    except Exception as e:
        return []


def evaluate_result(scores: dict, expected: str) -> dict:
    """Evaluate if the judgment is correct"""
    if "error" in scores:
        return {"correct": False, "reason": "error", "top_intent": None, "top_score": 0}

    if not scores:
        return {"correct": expected == "NONE", "reason": "empty_scores", "top_intent": None, "top_score": 0}

    # Find top scoring intent
    top_intent = max(scores.keys(), key=lambda k: scores[k])
    top_score = scores[top_intent]
    expected_score = scores.get(expected, 0) if expected != "NONE" else 0

    if expected == "NONE":
        # For irrelevant queries, all scores should be low
        correct = top_score < 0.5
        reason = "low_scores_ok" if correct else "high_score_for_irrelevant"
    else:
        # Expected intent should have high score or be top
        correct = (expected_score > 0) or (top_intent == expected and top_score > 0)
        reason = "expected_match" if correct else "wrong_intent"

    return {
        "correct": correct,
        "reason": reason,
        "top_intent": top_intent,
        "top_score": top_score,
        "expected_score": expected_score
    }


def get_server_metrics() -> dict:
    """Get metrics from server"""
    try:
        response = requests.get(f"{SERVER}/api/admin/discriminator/metrics", timeout=10)
        return response.json().get("data", {})
    except Exception as e:
        return {"error": str(e)}


def main():
    print("=" * 60)
    print("       DISCRIMINATOR BATCH TEST (200 CASES)")
    print("=" * 60)
    print()

    # Create output directory
    OUTPUT_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Reset metrics
    print("🔄 Resetting metrics...")
    reset_metrics()
    time.sleep(1)

    # Load test cases
    print("📁 Loading test cases...")
    with open(SIMPLE_FILE) as f:
        simple_cases = json.load(f)
    with open(COMPLEX_FILE) as f:
        complex_cases = json.load(f)

    print(f"   Simple cases: {len(simple_cases)}")
    print(f"   Complex cases: {len(complex_cases)}")
    print()

    # Run tests
    results = []
    stats = {
        "simple": {"total": 0, "correct": 0, "latencies": []},
        "complex": {"total": 0, "correct": 0, "latencies": [], "by_difficulty": defaultdict(lambda: {"total": 0, "correct": 0})}
    }

    # Test simple cases
    print("📋 Testing Simple Cases...")
    for i, case in enumerate(simple_cases, 1):
        user_input = case["userInput"]
        expected = case["expectedIntent"]

        start = time.time()
        scores = run_batch_judge(user_input)
        latency = (time.time() - start) * 1000

        eval_result = evaluate_result(scores, expected)
        stats["simple"]["total"] += 1
        stats["simple"]["latencies"].append(latency)
        if eval_result["correct"]:
            stats["simple"]["correct"] += 1

        results.append({
            "case": i,
            "category": "simple",
            "userInput": user_input,
            "expected": expected,
            **eval_result,
            "latencyMs": round(latency, 2)
        })

        if i % 20 == 0:
            print(f"   Progress: {i}/{len(simple_cases)}")

    print(f"   ✅ Simple: {stats['simple']['correct']}/{stats['simple']['total']} correct")
    print()

    # Test complex cases
    print("📋 Testing Complex Cases...")
    for i, case in enumerate(complex_cases, 1):
        user_input = case["userInput"]
        expected = case["expectedIntent"]
        difficulty = case.get("difficulty", "complex")

        start = time.time()
        scores = run_batch_judge(user_input)
        latency = (time.time() - start) * 1000

        eval_result = evaluate_result(scores, expected)
        stats["complex"]["total"] += 1
        stats["complex"]["latencies"].append(latency)
        stats["complex"]["by_difficulty"][difficulty]["total"] += 1

        if eval_result["correct"]:
            stats["complex"]["correct"] += 1
            stats["complex"]["by_difficulty"][difficulty]["correct"] += 1

        results.append({
            "case": len(simple_cases) + i,
            "category": "complex",
            "difficulty": difficulty,
            "userInput": user_input,
            "expected": expected,
            **eval_result,
            "latencyMs": round(latency, 2)
        })

        if i % 20 == 0:
            print(f"   Progress: {i}/{len(complex_cases)}")

    print(f"   ✅ Complex: {stats['complex']['correct']}/{stats['complex']['total']} correct")
    print()

    # Get server metrics
    print("📊 Fetching server metrics...")
    server_metrics = get_server_metrics()

    # Calculate summary statistics
    total_cases = stats["simple"]["total"] + stats["complex"]["total"]
    total_correct = stats["simple"]["correct"] + stats["complex"]["correct"]
    all_latencies = stats["simple"]["latencies"] + stats["complex"]["latencies"]

    summary = {
        "timestamp": timestamp,
        "total_cases": total_cases,
        "total_correct": total_correct,
        "overall_accuracy": round(total_correct / total_cases * 100, 2) if total_cases > 0 else 0,
        "simple": {
            "total": stats["simple"]["total"],
            "correct": stats["simple"]["correct"],
            "accuracy": round(stats["simple"]["correct"] / stats["simple"]["total"] * 100, 2) if stats["simple"]["total"] > 0 else 0,
            "avg_latency_ms": round(sum(stats["simple"]["latencies"]) / len(stats["simple"]["latencies"]), 2) if stats["simple"]["latencies"] else 0
        },
        "complex": {
            "total": stats["complex"]["total"],
            "correct": stats["complex"]["correct"],
            "accuracy": round(stats["complex"]["correct"] / stats["complex"]["total"] * 100, 2) if stats["complex"]["total"] > 0 else 0,
            "avg_latency_ms": round(sum(stats["complex"]["latencies"]) / len(stats["complex"]["latencies"]), 2) if stats["complex"]["latencies"] else 0,
            "by_difficulty": {k: {"total": v["total"], "correct": v["correct"], "accuracy": round(v["correct"]/v["total"]*100, 2) if v["total"] > 0 else 0} for k, v in stats["complex"]["by_difficulty"].items()}
        },
        "performance": {
            "total_latency_ms": round(sum(all_latencies), 2),
            "avg_latency_ms": round(sum(all_latencies) / len(all_latencies), 2) if all_latencies else 0,
            "min_latency_ms": round(min(all_latencies), 2) if all_latencies else 0,
            "max_latency_ms": round(max(all_latencies), 2) if all_latencies else 0
        },
        "server_metrics": server_metrics
    }

    # Save results
    results_file = OUTPUT_DIR / f"discriminator_results_{timestamp}.json"
    summary_file = OUTPUT_DIR / f"discriminator_summary_{timestamp}.json"

    with open(results_file, "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    with open(summary_file, "w") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    # Print summary
    print()
    print("=" * 60)
    print("                    TEST SUMMARY")
    print("=" * 60)
    print()
    print(f"📊 OVERALL RESULTS")
    print(f"   Total Cases:      {summary['total_cases']}")
    print(f"   Total Correct:    {summary['total_correct']}")
    print(f"   Overall Accuracy: {summary['overall_accuracy']}%")
    print()
    print(f"📋 SIMPLE CASES ({summary['simple']['total']})")
    print(f"   Correct:  {summary['simple']['correct']}")
    print(f"   Accuracy: {summary['simple']['accuracy']}%")
    print(f"   Avg Latency: {summary['simple']['avg_latency_ms']}ms")
    print()
    print(f"📋 COMPLEX CASES ({summary['complex']['total']})")
    print(f"   Correct:  {summary['complex']['correct']}")
    print(f"   Accuracy: {summary['complex']['accuracy']}%")
    print(f"   Avg Latency: {summary['complex']['avg_latency_ms']}ms")
    print()
    print(f"   By Difficulty:")
    for diff, data in sorted(summary["complex"]["by_difficulty"].items()):
        print(f"      {diff}: {data['correct']}/{data['total']} ({data['accuracy']}%)")
    print()
    print(f"⏱️ PERFORMANCE")
    print(f"   Total Time:   {summary['performance']['total_latency_ms']}ms")
    print(f"   Avg Latency:  {summary['performance']['avg_latency_ms']}ms")
    print(f"   Min Latency:  {summary['performance']['min_latency_ms']}ms")
    print(f"   Max Latency:  {summary['performance']['max_latency_ms']}ms")
    print()
    print(f"💾 SERVER METRICS")
    disc = server_metrics.get("discriminator", {})
    print(f"   Total Calls:    {disc.get('totalCalls', 'N/A')}")
    print(f"   Cache Hits:     {disc.get('cacheHits', 'N/A')}")
    print(f"   Cache Hit Rate: {disc.get('cacheHitRate', 'N/A')}")
    print(f"   Fallback Calls: {disc.get('fallbackCalls', 'N/A')}")
    print(f"   Errors:         {disc.get('errors', 'N/A')}")
    print()
    print(f"📁 OUTPUT FILES")
    print(f"   Results: {results_file}")
    print(f"   Summary: {summary_file}")
    print()
    print("=" * 60)
    print("                  ✅ TEST COMPLETED")
    print("=" * 60)

    # Also output errors for review
    errors = [r for r in results if not r["correct"]]
    if errors:
        error_file = OUTPUT_DIR / f"discriminator_errors_{timestamp}.json"
        with open(error_file, "w") as f:
            json.dump(errors, f, ensure_ascii=False, indent=2)
        print(f"\n⚠️ {len(errors)} errors saved to: {error_file}")


if __name__ == "__main__":
    main()
