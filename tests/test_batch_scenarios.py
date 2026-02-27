#!/usr/bin/env python3
"""
Production Batch Scenarios - Speed & Quality Test
Tests various batch-related endpoints for response time and content quality.
"""
import requests
import json
import time
import sys

BASE = "http://47.100.235.168:10010"
FACTORY = "F001"

def login():
    resp = requests.post(f"{BASE}/api/mobile/auth/unified-login",
                         json={"username": "factory_admin1", "password": "123456"})
    return resp.json()["data"]["accessToken"]

def timed_request(method, url, headers, **kwargs):
    start = time.time()
    resp = getattr(requests, method)(url, headers=headers, **kwargs)
    elapsed = time.time() - start
    return resp, elapsed

def print_separator(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def main():
    token = login()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    results = []

    # ────────────────────────────────────────────
    # TEST 1: Direct batch list API (paginated)
    # ────────────────────────────────────────────
    print_separator("TEST 1: 直接批次列表 (page=1, size=20)")
    resp, t = timed_request("get", f"{BASE}/api/mobile/{FACTORY}/processing/batches?page=1&size=20", headers)
    data = resp.json().get("data", {})
    total = data.get("totalElements", 0)
    items = data.get("content", [])
    print(f"  Time: {t:.2f}s | HTTP: {resp.status_code} | Total: {total} | Page items: {len(items)}")
    for i, b in enumerate(items[:3]):
        print(f"    [{i+1}] {b.get('batchNumber','?')} | {b.get('productName','?')} | {b.get('status','?')}")
    results.append(("直接批次列表 API", t, resp.status_code, f"{total} records, page 20"))

    # ────────────────────────────────────────────
    # TEST 2: Direct batch list - full (size=200)
    # ────────────────────────────────────────────
    print_separator("TEST 2: 直接批次列表 (size=200, 全量)")
    resp, t = timed_request("get", f"{BASE}/api/mobile/{FACTORY}/processing/batches?page=1&size=200", headers)
    data = resp.json().get("data", {})
    items = data.get("content", [])
    body_size = len(resp.content)
    print(f"  Time: {t:.2f}s | HTTP: {resp.status_code} | Items: {len(items)} | Body: {body_size/1024:.1f}KB")
    results.append(("批次列表全量 (200)", t, resp.status_code, f"{len(items)} records, {body_size/1024:.1f}KB"))

    # ────────────────────────────────────────────
    # TEST 3: AI Intent - 查看生产批次 (simple)
    # ────────────────────────────────────────────
    print_separator("TEST 3: AI 意图 - '查看今天的生产批次'")
    resp, t = timed_request("post", f"{BASE}/api/mobile/{FACTORY}/ai-intents/execute",
                            headers, json={"userInput": "查看今天的生产批次", "factoryId": FACTORY})
    data = resp.json().get("data", {})
    ft = data.get("formattedText", "") or ""
    msg = data.get("message", "") or ""
    intent = data.get("intentCode", "?")
    status = data.get("status", "?")
    method = data.get("matchMethod", "?")
    print(f"  Time: {t:.2f}s | Intent: {intent} | Status: {status} | Method: {method}")
    print(f"  FormattedText ({len(ft)} chars):")
    print(f"    {ft[:400]}" if ft else f"  Message: {msg[:400]}")
    results.append(("AI: 查看生产批次", t, resp.status_code, f"intent={intent}, ft={len(ft)}chars"))

    # ────────────────────────────────────────────
    # TEST 4: AI Intent - 今天生产情况 (report)
    # ────────────────────────────────────────────
    print_separator("TEST 4: AI 意图 - '今天生产情况怎么样'")
    resp, t = timed_request("post", f"{BASE}/api/mobile/{FACTORY}/ai-intents/execute",
                            headers, json={"userInput": "今天的生产情况怎么样", "factoryId": FACTORY})
    data = resp.json().get("data", {})
    ft = data.get("formattedText", "") or ""
    msg = data.get("message", "") or ""
    intent = data.get("intentCode", "?")
    status = data.get("status", "?")
    method = data.get("matchMethod", "?")
    print(f"  Time: {t:.2f}s | Intent: {intent} | Status: {status} | Method: {method}")
    print(f"  FormattedText ({len(ft)} chars):")
    display = ft if ft else msg
    print(f"    {display[:500]}")
    results.append(("AI: 生产情况报表", t, resp.status_code, f"intent={intent}, ft={len(ft)}chars"))

    # ────────────────────────────────────────────
    # TEST 5: AI Intent - 分析生产效率 (complex)
    # ────────────────────────────────────────────
    print_separator("TEST 5: AI 意图 - '分析一下最近的生产效率和产能利用率'")
    resp, t = timed_request("post", f"{BASE}/api/mobile/{FACTORY}/ai-intents/execute",
                            headers, json={"userInput": "分析一下最近的生产效率和产能利用率", "factoryId": FACTORY})
    data = resp.json().get("data", {})
    ft = data.get("formattedText", "") or ""
    msg = data.get("message", "") or ""
    intent = data.get("intentCode", "?")
    status = data.get("status", "?")
    method = data.get("matchMethod", "?")
    print(f"  Time: {t:.2f}s | Intent: {intent} | Status: {status} | Method: {method}")
    print(f"  FormattedText ({len(ft)} chars):")
    display = ft if ft else msg
    print(f"    {display[:600]}")
    results.append(("AI: 生产效率分析", t, resp.status_code, f"intent={intent}, ft={len(ft)}chars"))

    # ────────────────────────────────────────────
    # TEST 6: Production dashboard report
    # ────────────────────────────────────────────
    print_separator("TEST 6: 生产仪表盘 API (直接)")
    resp, t = timed_request("get", f"{BASE}/api/mobile/{FACTORY}/reports/production-dashboard?period=today", headers)
    if resp.status_code == 200:
        data = resp.json().get("data", {})
        print(f"  Time: {t:.2f}s | HTTP: {resp.status_code}")
        # Print key metrics
        for key in ["totalBatches", "completedBatches", "totalOutput", "averageYieldRate"]:
            if key in data:
                print(f"    {key}: {data[key]}")
    else:
        print(f"  Time: {t:.2f}s | HTTP: {resp.status_code}")
    results.append(("生产仪表盘 API", t, resp.status_code, "dashboard data"))

    # ────────────────────────────────────────────
    # TEST 7: Work reporting list
    # ────────────────────────────────────────────
    print_separator("TEST 7: 工作报告列表")
    resp, t = timed_request("get", f"{BASE}/api/mobile/{FACTORY}/work-reports?page=1&size=20", headers)
    if resp.status_code == 200:
        data = resp.json().get("data", {})
        total = data.get("totalElements", 0)
        items = data.get("content", [])
        print(f"  Time: {t:.2f}s | HTTP: {resp.status_code} | Total: {total} | Page items: {len(items)}")
    else:
        print(f"  Time: {t:.2f}s | HTTP: {resp.status_code}")
        print(f"    Body: {resp.text[:200]}")
    results.append(("工作报告列表", t, resp.status_code, f"total={total if resp.status_code==200 else '?'}"))

    # ────────────────────────────────────────────
    # TEST 8: AI Intent - 简单问候 (baseline)
    # ────────────────────────────────────────────
    print_separator("TEST 8: AI 意图 - '你好' (baseline)")
    resp, t = timed_request("post", f"{BASE}/api/mobile/{FACTORY}/ai-intents/execute",
                            headers, json={"userInput": "你好", "factoryId": FACTORY})
    data = resp.json().get("data", {})
    ft = data.get("formattedText", "") or ""
    msg = data.get("message", "") or ""
    print(f"  Time: {t:.2f}s | Status: {data.get('status','?')}")
    print(f"  Response: {(ft or msg)[:200]}")
    results.append(("AI: 你好 (baseline)", t, resp.status_code, f"ft={len(ft)}chars"))

    # ────────────────────────────────────────────
    # TEST 9: AI Intent - 查询库存 (data intent)
    # ────────────────────────────────────────────
    print_separator("TEST 9: AI 意图 - '查看当前库存' (对比)")
    resp, t = timed_request("post", f"{BASE}/api/mobile/{FACTORY}/ai-intents/execute",
                            headers, json={"userInput": "查看当前库存情况", "factoryId": FACTORY})
    data = resp.json().get("data", {})
    ft = data.get("formattedText", "") or ""
    msg = data.get("message", "") or ""
    intent = data.get("intentCode", "?")
    method = data.get("matchMethod", "?")
    print(f"  Time: {t:.2f}s | Intent: {intent} | Method: {method}")
    display = ft if ft else msg
    print(f"  Response ({len(display)} chars): {display[:300]}")
    results.append(("AI: 查看库存", t, resp.status_code, f"intent={intent}"))

    # ────────────────────────────────────────────
    # SUMMARY
    # ────────────────────────────────────────────
    print_separator("SUMMARY")
    print(f"{'Scenario':<30} {'Time':>8} {'HTTP':>6} {'Details'}")
    print("-" * 80)
    for name, t, http, detail in results:
        color = "✅" if t < 3 else ("⚠️" if t < 8 else "❌")
        print(f"{color} {name:<28} {t:>7.2f}s {http:>5} {detail}")

if __name__ == "__main__":
    main()
