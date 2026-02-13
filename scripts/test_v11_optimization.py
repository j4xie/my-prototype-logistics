#!/usr/bin/env python3
"""
v11.0 Optimization Test Script
Tests SemanticRouter + LongTextHandler integration effects
"""

import json
import requests
import time
from datetime import datetime
from pathlib import Path
from collections import defaultdict

SERVER = "http://139.196.165.140:10010"
BASE_DIR = Path(__file__).parent.parent
COMPLEX_FILE = BASE_DIR / "backend-java/src/main/resources/data/testing/complex_test_cases.json"

# Test configuration
FACTORY_ID = "F001"
USER_ID = 1
SESSION_ID = f"test_v11_{int(time.time())}"
ACCESS_TOKEN = None

def login():
    """Login and get access token"""
    global ACCESS_TOKEN
    try:
        response = requests.post(
            f"{SERVER}/api/mobile/auth/unified-login",
            json={"username": "factory_admin1", "password": "123456"},
            timeout=10
        )
        data = response.json()
        if data.get("success") and data.get("data"):
            ACCESS_TOKEN = data["data"].get("accessToken") or data["data"].get("token")
            print(f"Login successful, token: {ACCESS_TOKEN[:30]}...")
            return True
    except Exception as e:
        print(f"Login failed: {e}")
    return False

def load_test_cases():
    """Load complex test cases"""
    with open(COMPLEX_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def recognize_intent(user_input: str) -> dict:
    """Call intent recognition API"""
    try:
        start = time.time()
        headers = {"Content-Type": "application/json"}
        if ACCESS_TOKEN:
            headers["Authorization"] = f"Bearer {ACCESS_TOKEN}"

        response = requests.post(
            f"{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/recognize",
            json={
                "userInput": user_input,
                "userId": USER_ID,
                "sessionId": SESSION_ID,
                "topN": 5
            },
            headers=headers,
            timeout=60
        )
        latency = (time.time() - start) * 1000

        data = response.json()
        if data.get("success") and data.get("data"):
            result = data["data"]
            result["latency_ms"] = latency
            return result
        return {"error": data.get("message", "Unknown error"), "latency_ms": latency}
    except requests.exceptions.Timeout:
        return {"error": "timeout", "latency_ms": 60000}
    except Exception as e:
        return {"error": str(e), "latency_ms": 0}

def get_router_statistics():
    """Get SemanticRouter statistics"""
    try:
        headers = {}
        if ACCESS_TOKEN:
            headers["Authorization"] = f"Bearer {ACCESS_TOKEN}"
        response = requests.get(
            f"{SERVER}/api/mobile/{FACTORY_ID}/intent-analysis/semantic-router/statistics",
            headers=headers,
            timeout=10
        )
        data = response.json()
        if data.get("success"):
            return data.get("data", {})
        return {}
    except:
        return {}

def evaluate_result(result: dict, expected: str) -> dict:
    """Evaluate if the result matches expected intent"""
    if "error" in result:
        return {
            "correct": False,
            "reason": result["error"],
            "matched_intent": None,
            "confidence": 0
        }

    # Check if matched
    matched = result.get("matched", False)
    matched_intent = result.get("intentCode") if matched else None
    confidence = result.get("confidence", 0)
    match_method = result.get("matchMethod", "UNKNOWN")

    if expected == "NONE":
        # Should not match any intent with high confidence
        correct = matched_intent is None or confidence < 0.5
        reason = "correctly_rejected" if correct else "false_positive"
    else:
        correct = matched_intent == expected
        reason = "correct" if correct else f"expected_{expected}_got_{matched_intent}"

    return {
        "correct": correct,
        "reason": reason,
        "matched_intent": matched_intent,
        "confidence": confidence
    }

def run_tests():
    """Run all tests and collect metrics"""
    print("=" * 60)
    print("v11.0 Optimization Test - SemanticRouter + LongTextHandler")
    print("=" * 60)
    print(f"Server: {SERVER}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # Login first
    if not login():
        print("Failed to login, aborting test")
        return []
    print()

    # Load test cases
    test_cases = load_test_cases()
    print(f"Loaded {len(test_cases)} test cases")
    print()

    # Run tests
    results = []
    categories = defaultdict(lambda: {"total": 0, "correct": 0, "latencies": []})
    route_types = defaultdict(int)

    for i, case in enumerate(test_cases):
        user_input = case["userInput"]
        expected = case["expectedIntent"]
        difficulty = case.get("difficulty", "unknown")

        # Call API
        result = recognize_intent(user_input)
        eval_result = evaluate_result(result, expected)

        # Track route type (matchMethod indicates the routing path)
        route_type = result.get("matchMethod", "UNKNOWN")
        route_types[route_type] += 1

        # Collect metrics
        latency = result.get("latency_ms", 0)
        categories[difficulty]["total"] += 1
        categories[difficulty]["latencies"].append(latency)
        if eval_result["correct"]:
            categories[difficulty]["correct"] += 1

        # Print progress (use ASCII for Windows compatibility)
        status = "[OK]" if eval_result["correct"] else "[FAIL]"
        print(f"[{i+1}/{len(test_cases)}] {status} '{user_input[:30]}' -> {eval_result['matched_intent']} ({latency:.0f}ms) [{route_type}]")

        results.append({
            "input": user_input,
            "expected": expected,
            "difficulty": difficulty,
            "result": result,
            "evaluation": eval_result
        })

        # Rate limiting
        time.sleep(0.1)

    # Print summary
    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)

    total_correct = sum(c["correct"] for c in categories.values())
    total_cases = sum(c["total"] for c in categories.values())
    all_latencies = [l for c in categories.values() for l in c["latencies"]]

    print(f"\nOverall Accuracy: {total_correct}/{total_cases} ({100*total_correct/total_cases:.1f}%)")
    print(f"Average Latency: {sum(all_latencies)/len(all_latencies):.0f}ms")
    print(f"Min/Max Latency: {min(all_latencies):.0f}ms / {max(all_latencies):.0f}ms")

    print("\n--- By Difficulty ---")
    for diff, stats in sorted(categories.items()):
        acc = 100 * stats["correct"] / stats["total"] if stats["total"] > 0 else 0
        avg_lat = sum(stats["latencies"]) / len(stats["latencies"]) if stats["latencies"] else 0
        print(f"  {diff:20s}: {stats['correct']:3d}/{stats['total']:3d} ({acc:5.1f}%) avg={avg_lat:.0f}ms")

    print("\n--- Route Type Distribution ---")
    for route_type, count in sorted(route_types.items(), key=lambda x: (x[0] is None, x[0])):
        pct = 100 * count / total_cases
        route_name = str(route_type) if route_type else "None"
        print(f"  {route_name:20s}: {count:3d} ({pct:5.1f}%)")

    # Get router statistics
    print("\n--- SemanticRouter Statistics ---")
    stats = get_router_statistics()
    if stats:
        for key, value in stats.items():
            print(f"  {key}: {value}")
    else:
        print("  (No statistics available)")

    print("\n" + "=" * 60)
    print("TEST COMPLETED")
    print("=" * 60)

    return results

if __name__ == "__main__":
    run_tests()
