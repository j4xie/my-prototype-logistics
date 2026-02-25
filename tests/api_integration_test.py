#!/usr/bin/env python3
"""
Comprehensive API Integration Test against Production Server
Tests: Auth, Health, Intent Recognition, Intent Execution, Restaurant, Reports
Output: Summary table with status, response time, and notes
"""

import requests
import json
import time
import sys
import io
import os
from datetime import datetime

# Fix Windows GBK console encoding for Chinese text
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

BASE_URL = "http://47.100.235.168:10010"
TIMEOUT = 30  # seconds per request

# =============================================
# Result collection
# =============================================
results = []

def record(endpoint, method, status, resp_time, notes="", response_code=None):
    results.append({
        "endpoint": endpoint,
        "method": method,
        "status": status,
        "resp_time": resp_time,
        "notes": notes,
        "http_code": response_code,
    })

def timed_request(method, url, **kwargs):
    """Execute request and return (response, elapsed_seconds)"""
    kwargs.setdefault("timeout", TIMEOUT)
    start = time.time()
    try:
        if method == "GET":
            r = requests.get(url, **kwargs)
        elif method == "POST":
            r = requests.post(url, **kwargs)
        elif method == "PUT":
            r = requests.put(url, **kwargs)
        elif method == "DELETE":
            r = requests.delete(url, **kwargs)
        else:
            raise ValueError(f"Unknown method: {method}")
        elapsed = time.time() - start
        return r, elapsed
    except requests.exceptions.Timeout as e:
        elapsed = time.time() - start
        print(f"    [DEBUG] Timeout: {e}")
        return None, elapsed
    except requests.exceptions.ConnectionError as e:
        elapsed = time.time() - start
        err_str = str(e)[:200]
        print(f"    [DEBUG] ConnectionError: {err_str}")
        return None, elapsed
    except Exception as e:
        elapsed = time.time() - start
        print(f"    [DEBUG] Exception ({type(e).__name__}): {e}")
        return None, elapsed

# =============================================
# 1. HEALTH CHECK
# =============================================
print("=" * 70)
print("SECTION 1: Health Check")
print("=" * 70)

r, t = timed_request("GET", f"{BASE_URL}/api/mobile/health")
if r and r.status_code == 200:
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
    record("/api/mobile/health", "GET", "PASS", t, f"Server healthy", r.status_code)
    print(f"  [PASS] Health check OK ({t:.2f}s)")
else:
    status_code = r.status_code if r else "N/A"
    record("/api/mobile/health", "GET", "FAIL", t, f"HTTP {status_code}", status_code)
    print(f"  [FAIL] Health check failed (HTTP {status_code}, {t:.2f}s)")

# =============================================
# 2. AUTH - Login
# =============================================
print("\n" + "=" * 70)
print("SECTION 2: Authentication")
print("=" * 70)

token = None
factory_id = "F001"

# 2a. factory_admin1 login
r, t = timed_request("POST", f"{BASE_URL}/api/mobile/auth/unified-login",
    json={"username": "factory_admin1", "password": "123456"})
if r and r.status_code == 200:
    body = r.json()
    if body.get("success") and body.get("data", {}).get("token"):
        token = body["data"]["token"]
        user_data = body["data"]
        roles = user_data.get("roles", [])
        fid = user_data.get("factoryId", "?")
        record("/api/mobile/auth/unified-login", "POST", "PASS", t,
               f"Token obtained, factoryId={fid}, roles={roles}", r.status_code)
        print(f"  [PASS] Login factory_admin1 OK ({t:.2f}s) factoryId={fid}")
    else:
        record("/api/mobile/auth/unified-login", "POST", "FAIL", t,
               f"success=false or no token: {body.get('message','?')}", r.status_code)
        print(f"  [FAIL] Login returned but no token: {body.get('message','?')}")
else:
    status_code = r.status_code if r else "N/A"
    record("/api/mobile/auth/unified-login", "POST", "FAIL", t,
           f"HTTP {status_code}", status_code)
    print(f"  [FAIL] Login HTTP {status_code}")

if not token:
    print("\nFATAL: Cannot proceed without auth token. Printing results and exiting.")
    for res in results:
        print(f"  {res['method']:6s} {res['endpoint']:60s} {res['status']:5s} {res['resp_time']:.2f}s  {res['notes']}")
    sys.exit(1)

headers = {"Authorization": f"Bearer {token}"}

# 2b. Invalid login
r, t = timed_request("POST", f"{BASE_URL}/api/mobile/auth/unified-login",
    json={"username": "factory_admin1", "password": "wrongpassword"})
if r:
    body = r.json()
    if not body.get("success"):
        record("/api/mobile/auth/unified-login (bad pwd)", "POST", "PASS", t,
               f"Correctly rejected: {body.get('message','?')}", r.status_code)
        print(f"  [PASS] Bad password correctly rejected ({t:.2f}s)")
    else:
        record("/api/mobile/auth/unified-login (bad pwd)", "POST", "FAIL", t,
               "Should have rejected bad password", r.status_code)
        print(f"  [FAIL] Bad password was accepted!")

# 2c. Token validation (call an endpoint that requires auth)
r, t = timed_request("GET", f"{BASE_URL}/api/mobile/{factory_id}/dashboard/overview",
    headers=headers)
if r:
    record(f"/api/mobile/{factory_id}/dashboard/overview", "GET",
           "PASS" if r.status_code == 200 else "WARN", t,
           f"HTTP {r.status_code}", r.status_code)
    print(f"  [{'PASS' if r.status_code == 200 else 'WARN'}] Dashboard overview ({t:.2f}s) HTTP {r.status_code}")

# =============================================
# 3. INTENT RECOGNITION
# =============================================
print("\n" + "=" * 70)
print("SECTION 3: Intent Recognition (/ai-intents/recognize)")
print("=" * 70)

recognition_tests = [
    # (userInput, expected_category_keywords, description)
    ("查看库存", ["INVENTORY", "MATERIAL"], "Inventory query"),
    ("今天的生产进度怎么样", ["PRODUCTION", "PROCESSING"], "Production status"),
    ("最近的质检记录", ["QUALITY"], "Quality check"),
    ("今天的考勤情况", ["HR", "ATTENDANCE"], "HR attendance"),
    ("设备运行状态查询", ["EQUIPMENT"], "Equipment status"),
    ("最近的订单列表", ["ORDER", "SALES", "CRM"], "Order/sales query"),
    ("帮我查一下发货情况", ["SHIPMENT"], "Shipment query"),
    ("这个月的KPI报告", ["REPORT"], "Report KPI"),
    ("查看成本分析", ["FINANCE", "COST"], "Finance/cost"),
    ("排班表", ["SCHEDULING"], "Scheduling"),
]

for user_input, expected_cats, desc in recognition_tests:
    r, t = timed_request("POST", f"{BASE_URL}/api/mobile/{factory_id}/ai-intents/recognize",
        json={"userInput": user_input}, headers=headers)
    endpoint = f"recognize: '{user_input}'"
    if r and r.status_code == 200:
        body = r.json()
        data = body.get("data") or {}
        matched = data.get("matched", False)
        intent_code = data.get("intentCode", "N/A")
        match_method = data.get("matchMethod", "?")
        confidence = data.get("confidence", 0)
        category = data.get("category", "?")

        # Check structure
        has_required = all(k in data for k in ["matched", "intentCode", "matchMethod", "confidence"])
        status = "PASS" if matched and has_required else "WARN"

        notes = f"intent={intent_code}, method={match_method}, conf={confidence}, cat={category}"
        if t > 5:
            status = "SLOW"
            notes += " [SLOW >5s]"
        record(endpoint, "POST", status, t, notes, r.status_code)
        print(f"  [{status}] {desc:25s} -> {intent_code:35s} ({match_method}, conf={confidence}, {t:.2f}s)")
    else:
        status_code = r.status_code if r else "TIMEOUT"
        record(endpoint, "POST", "FAIL", t, f"HTTP {status_code}", status_code)
        print(f"  [FAIL] {desc:25s} -> HTTP {status_code} ({t:.2f}s)")

# =============================================
# 4. INTENT EXECUTION
# =============================================
print("\n" + "=" * 70)
print("SECTION 4: Intent Execution (/ai-intents/execute)")
print("=" * 70)

execution_tests = [
    # (userInput, expected_intent, description)
    ("查看最近的订单", "ORDER_LIST", "Order list"),
    ("查看原料批次信息", "MATERIAL_BATCH_QUERY", "Material batch query"),
    ("最近的质检记录", "QUALITY_CHECK_QUERY", "Quality check query"),
    ("今天的考勤情况", "ATTENDANCE_TODAY", "Attendance today"),
    ("设备列表", "EQUIPMENT_LIST", "Equipment list"),
    ("生产状态查询", "PRODUCTION_STATUS_QUERY", "Production status"),
    ("查看发货情况", "SHIPMENT_QUERY", "Shipment query"),
    ("这个月的生产报告", "REPORT_PRODUCTION", "Report production"),
    ("库存报告", "REPORT_INVENTORY", "Report inventory"),
    ("客户统计", "CUSTOMER_STATS", "Customer stats"),
]

for user_input, expected_intent, desc in execution_tests:
    r, t = timed_request("POST", f"{BASE_URL}/api/mobile/{factory_id}/ai-intents/execute",
        json={"userInput": user_input}, headers=headers, timeout=90)
    endpoint = f"execute: '{user_input}'"
    if r and r.status_code == 200:
        body = r.json()
        success = body.get("success", False)
        data = body.get("data") or {}

        intent_code = str(data.get("intentCode") or "N/A")
        status_field = str(data.get("status") or "?")
        reply = str(data.get("formattedText") or data.get("replyText") or data.get("reply") or "")
        has_result = data.get("resultData") is not None
        action_type = str(data.get("actionType") or "?")

        # Determine pass/fail
        has_response = bool(reply) or has_result
        status = "PASS" if success and has_response else "WARN"
        if not success:
            status = "FAIL"

        reply_preview = (reply[:80] + "...") if len(reply) > 80 else reply
        reply_preview = reply_preview.replace("\n", " ")
        notes = f"intent={intent_code}, status={status_field}, hasData={has_result}, action={action_type}"
        if t > 5:
            notes += " [SLOW >5s]"
        if t > 10:
            status = "SLOW" if status == "PASS" else status

        record(endpoint, "POST", status, t, notes, r.status_code)
        print(f"  [{status}] {desc:25s} -> {intent_code:35s} ({t:.2f}s) reply={reply_preview[:60]}")
    else:
        status_code = r.status_code if r else "TIMEOUT"
        err_text = ""
        if r:
            try:
                err_text = r.json().get("message", "")[:60]
            except:
                err_text = r.text[:60]
        record(endpoint, "POST", "FAIL", t, f"HTTP {status_code}: {err_text}", status_code)
        print(f"  [FAIL] {desc:25s} -> HTTP {status_code} ({t:.2f}s) {err_text}")

# =============================================
# 5. REPORT INTENT EXECUTION
# =============================================
print("\n" + "=" * 70)
print("SECTION 5: Report Intent Execution")
print("=" * 70)

report_tests = [
    ("给我看看仪表盘概览", "REPORT_DASHBOARD_OVERVIEW", "Dashboard overview"),
    ("KPI报告", "REPORT_KPI", "KPI report"),
    ("生产报表", "REPORT_PRODUCTION", "Production report"),
    ("质量报告", "REPORT_QUALITY", "Quality report"),
    ("财务报告", "REPORT_FINANCE", "Finance report"),
    ("趋势分析报告", "REPORT_TRENDS", "Trends report"),
    ("每日管理简报", "REPORT_EXECUTIVE_DAILY", "Executive daily"),
]

for user_input, expected_intent, desc in report_tests:
    r, t = timed_request("POST", f"{BASE_URL}/api/mobile/{factory_id}/ai-intents/execute",
        json={"userInput": user_input}, headers=headers, timeout=90)
    endpoint = f"report: '{user_input}'"
    if r and r.status_code == 200:
        body = r.json()
        success = body.get("success", False)
        data = body.get("data") or {}
        intent_code = str(data.get("intentCode") or "N/A")
        status_field = str(data.get("status") or "?")
        reply = str(data.get("formattedText") or data.get("replyText") or data.get("reply") or "")
        has_result = data.get("resultData") is not None

        status = "PASS" if success and (bool(reply) or has_result) else "WARN"
        if not success:
            status = "FAIL"

        notes = f"intent={intent_code}, status={status_field}, hasData={has_result}, replyLen={len(reply)}"
        if t > 5:
            notes += " [SLOW >5s]"

        record(endpoint, "POST", status, t, notes, r.status_code)
        print(f"  [{status}] {desc:25s} -> {intent_code:35s} ({t:.2f}s) replyLen={len(reply)}")
    else:
        status_code = r.status_code if r else "TIMEOUT"
        record(endpoint, "POST", "FAIL", t, f"HTTP {status_code}", status_code)
        print(f"  [FAIL] {desc:25s} -> HTTP {status_code} ({t:.2f}s)")

# =============================================
# 6. RESTAURANT APIs (R001)
# =============================================
print("\n" + "=" * 70)
print("SECTION 6: Restaurant APIs (R001)")
print("=" * 70)

# Try recognize with R001 factory
restaurant_tests = [
    ("查看今天的菜品销量", "Restaurant sales"),
    ("餐厅订单列表", "Restaurant orders"),
    ("查看门店营收", "Restaurant revenue"),
]

for user_input, desc in restaurant_tests:
    r, t = timed_request("POST", f"{BASE_URL}/api/mobile/R001/ai-intents/recognize",
        json={"userInput": user_input}, headers=headers, timeout=60)
    endpoint = f"R001 recognize: '{user_input}'"
    if r is not None:
        if r.status_code == 200:
            body = r.json()
            data = body.get("data") or {}
            matched = data.get("matched", False)
            intent_code = str(data.get("intentCode") or "N/A")
            notes = f"matched={matched}, intent={intent_code}"
            status = "PASS" if matched else "WARN"
            record(endpoint, "POST", status, t, notes, r.status_code)
            print(f"  [{status}] {desc:25s} -> matched={matched}, intent={intent_code} ({t:.2f}s)")
        elif r.status_code in [403, 401]:
            record(endpoint, "POST", "INFO", t, f"{r.status_code} - user not authorized for R001", r.status_code)
            print(f"  [INFO] {desc:25s} -> {r.status_code} (user not authorized for R001) ({t:.2f}s)")
        elif r.status_code == 404:
            record(endpoint, "POST", "INFO", t, "404 - R001 endpoints not available", r.status_code)
            print(f"  [INFO] {desc:25s} -> 404 (R001 not found) ({t:.2f}s)")
        else:
            err = ""
            try:
                err = r.json().get("message", "")[:60]
            except:
                err = r.text[:80] if r.text else ""
            record(endpoint, "POST", "WARN", t, f"HTTP {r.status_code}: {err}", r.status_code)
            print(f"  [WARN] {desc:25s} -> HTTP {r.status_code} ({t:.2f}s) {err}")
    else:
        record(endpoint, "POST", "FAIL", t, "Connection/Timeout error", None)
        print(f"  [FAIL] {desc:25s} -> Connection error ({t:.2f}s)")

# Try R001 execute
for user_input, desc in [("查看今天的菜品销量", "Restaurant sales exec")]:
    r, t = timed_request("POST", f"{BASE_URL}/api/mobile/R001/ai-intents/execute",
        json={"userInput": user_input}, headers=headers, timeout=90)
    endpoint = f"R001 execute: '{user_input}'"
    if r is not None:
        if r.status_code == 200:
            body = r.json()
            success = body.get("success", False)
            data = body.get("data") or {}
            intent_code = str(data.get("intentCode") or "N/A")
            reply = str(data.get("formattedText") or data.get("replyText") or data.get("reply") or "")
            notes = f"success={success}, intent={intent_code}, replyLen={len(reply)}"
            status = "PASS" if success else "WARN"
            record(endpoint, "POST", status, t, notes, r.status_code)
            print(f"  [{status}] {desc:25s} -> intent={intent_code} ({t:.2f}s)")
        else:
            err = ""
            try:
                err = r.json().get("message", "")[:60]
            except:
                err = r.text[:80] if r.text else ""
            info_or_fail = "INFO" if r.status_code in [401, 403, 404] else "WARN"
            record(endpoint, "POST", info_or_fail, t, f"HTTP {r.status_code}: {err}", r.status_code)
            print(f"  [{info_or_fail}] {desc:25s} -> HTTP {r.status_code} ({t:.2f}s) {err}")
    else:
        record(endpoint, "POST", "FAIL", t, "Connection/Timeout error", None)
        print(f"  [FAIL] {desc:25s} -> Connection error ({t:.2f}s)")

# =============================================
# 7. DIRECT DATA ENDPOINTS (non-AI)
# =============================================
print("\n" + "=" * 70)
print("SECTION 7: Direct Data Endpoints")
print("=" * 70)

direct_endpoints = [
    ("GET", f"/api/mobile/{factory_id}/material-batches?page=1&size=5", "Material batches"),
    ("GET", f"/api/mobile/{factory_id}/processing/batches?page=1&size=5", "Processing batches"),
    ("GET", f"/api/mobile/{factory_id}/quality-check-items?page=1&size=5", "Quality check items"),
    ("GET", f"/api/mobile/{factory_id}/equipment?page=1&size=5", "Equipment list"),
    ("GET", f"/api/mobile/{factory_id}/sales/orders?page=1&size=5", "Sales orders"),
    ("GET", f"/api/mobile/{factory_id}/shipments?page=0&size=5", "Shipments"),
    ("GET", f"/api/mobile/{factory_id}/reports/dashboard/overview", "Dashboard overview"),
    ("GET", f"/api/mobile/{factory_id}/reports/kpi", "Reports KPI"),
    ("GET", f"/api/mobile/{factory_id}/reports/inventory", "Reports inventory"),
    ("GET", f"/api/mobile/{factory_id}/reports/finance", "Reports finance"),
    ("GET", f"/api/mobile/{factory_id}/personnel/statistics", "Personnel stats"),
    ("GET", f"/api/mobile/{factory_id}/equipment-alerts?page=1&size=5", "Equipment alerts"),
    ("GET", f"/api/mobile/{factory_id}/work-orders?page=1&size=5", "Work orders"),
]

for method, path, desc in direct_endpoints:
    r, t = timed_request(method, f"{BASE_URL}{path}", headers=headers)
    if r:
        body = None
        try:
            body = r.json()
        except:
            pass

        if r.status_code == 200:
            success = body.get("success", True) if body else True
            data = body.get("data") if body else None
            data_type = type(data).__name__ if data is not None else "null"
            count = ""
            if isinstance(data, dict) and "content" in data:
                count = f", items={len(data['content'])}"
            elif isinstance(data, list):
                count = f", items={len(data)}"
            notes = f"dataType={data_type}{count}"
            record(path, method, "PASS", t, notes, r.status_code)
            print(f"  [PASS] {desc:25s} ({t:.2f}s) {notes}")
        elif r.status_code == 404:
            record(path, method, "INFO", t, "404 Not Found - endpoint may not exist", r.status_code)
            print(f"  [INFO] {desc:25s} -> 404 ({t:.2f}s)")
        else:
            msg = body.get("message", "")[:50] if body else r.text[:50]
            record(path, method, "FAIL", t, f"HTTP {r.status_code}: {msg}", r.status_code)
            print(f"  [FAIL] {desc:25s} -> HTTP {r.status_code} ({t:.2f}s) {msg}")
    else:
        record(path, method, "FAIL", t, "Timeout/Connection error", None)
        print(f"  [FAIL] {desc:25s} -> Timeout ({t:.2f}s)")

# =============================================
# 8. EDGE CASES & ERROR HANDLING
# =============================================
print("\n" + "=" * 70)
print("SECTION 8: Edge Cases & Error Handling")
print("=" * 70)

# 8a. Empty input
r, t = timed_request("POST", f"{BASE_URL}/api/mobile/{factory_id}/ai-intents/recognize",
    json={"userInput": ""}, headers=headers)
if r:
    body = r.json()
    data = body.get("data") or {}
    matched = data.get("matched", False)
    status = "PASS" if not matched else "WARN"
    record("recognize: '' (empty)", "POST", status, t,
           f"matched={matched} (expected false)", r.status_code)
    print(f"  [{status}] Empty input recognition -> matched={matched} ({t:.2f}s)")

# 8b. Gibberish input
r, t = timed_request("POST", f"{BASE_URL}/api/mobile/{factory_id}/ai-intents/recognize",
    json={"userInput": "asdfghjkl xyz 12345"}, headers=headers)
if r:
    body = r.json()
    data = body.get("data") or {}
    matched = data.get("matched", False)
    intent = data.get("intentCode", "N/A")
    status = "PASS" if not matched else "WARN"
    record("recognize: gibberish", "POST", status, t,
           f"matched={matched}, intent={intent}", r.status_code)
    print(f"  [{status}] Gibberish input -> matched={matched}, intent={intent} ({t:.2f}s)")

# 8c. No auth header
r, t = timed_request("POST", f"{BASE_URL}/api/mobile/{factory_id}/ai-intents/recognize",
    json={"userInput": "查看库存"})
if r is not None:
    status = "PASS" if r.status_code in [401, 403] else "WARN"
    record("recognize: no auth", "POST", status, t,
           f"HTTP {r.status_code} (expected 401/403)", r.status_code)
    print(f"  [{status}] No auth header -> HTTP {r.status_code} ({t:.2f}s)")
else:
    record("recognize: no auth", "POST", "FAIL", t, "Connection error", None)
    print(f"  [FAIL] No auth header -> Connection error ({t:.2f}s)")

# 8d. Very long input
long_text = "查看库存" * 200  # 800 chars
r, t = timed_request("POST", f"{BASE_URL}/api/mobile/{factory_id}/ai-intents/recognize",
    json={"userInput": long_text}, headers=headers)
if r:
    body = r.json()
    status = "PASS" if r.status_code == 200 else "WARN"
    record("recognize: long input (800 chars)", "POST", status, t,
           f"HTTP {r.status_code}", r.status_code)
    print(f"  [{status}] Long input (800 chars) -> HTTP {r.status_code} ({t:.2f}s)")

# =============================================
# SUMMARY
# =============================================
print("\n" + "=" * 100)
print("COMPREHENSIVE API INTEGRATION TEST SUMMARY")
print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Server: {BASE_URL}")
print("=" * 100)

# Calculate stats
total = len(results)
passes = sum(1 for r in results if r["status"] == "PASS")
warns = sum(1 for r in results if r["status"] == "WARN")
fails = sum(1 for r in results if r["status"] == "FAIL")
infos = sum(1 for r in results if r["status"] == "INFO")
slows = sum(1 for r in results if r["status"] == "SLOW")
avg_time = sum(r["resp_time"] for r in results) / total if total > 0 else 0
max_time = max(r["resp_time"] for r in results) if results else 0
slow_count = sum(1 for r in results if r["resp_time"] > 5)

print(f"\nOverall: {total} tests | {passes} PASS | {warns} WARN | {fails} FAIL | {infos} INFO | {slows} SLOW")
print(f"Timing:  avg={avg_time:.2f}s | max={max_time:.2f}s | slow(>5s)={slow_count}")

print(f"\n{'#':>3} | {'Method':6} | {'Status':5} | {'Time':>6} | {'HTTP':>4} | {'Endpoint':<55} | Notes")
print("-" * 160)

for i, r in enumerate(results, 1):
    status_icon = {
        "PASS": "PASS",
        "WARN": "WARN",
        "FAIL": "FAIL",
        "INFO": "INFO",
        "SLOW": "SLOW",
    }.get(r["status"], "????")

    http_code = str(r["http_code"]) if r["http_code"] else "N/A"
    endpoint_display = r["endpoint"][:55]
    notes_display = r["notes"][:80]
    time_str = f"{r['resp_time']:.2f}s"

    # Flag slow responses
    time_flag = " !!!" if r["resp_time"] > 5 else ""

    print(f"{i:>3} | {r['method']:6} | {status_icon:5} | {time_str:>6}{time_flag} | {http_code:>4} | {endpoint_display:<55} | {notes_display}")

# Print failures separately
failures = [r for r in results if r["status"] == "FAIL"]
if failures:
    print(f"\n{'=' * 80}")
    print(f"FAILURES ({len(failures)}):")
    print(f"{'=' * 80}")
    for r in failures:
        print(f"  FAIL: {r['method']} {r['endpoint']}")
        print(f"        HTTP {r['http_code']} | {r['resp_time']:.2f}s | {r['notes']}")

# Print warnings
warnings = [r for r in results if r["status"] == "WARN"]
if warnings:
    print(f"\n{'=' * 80}")
    print(f"WARNINGS ({len(warnings)}):")
    print(f"{'=' * 80}")
    for r in warnings:
        print(f"  WARN: {r['method']} {r['endpoint']}")
        print(f"        HTTP {r['http_code']} | {r['resp_time']:.2f}s | {r['notes']}")

# Print slow responses
slow_responses = [r for r in results if r["resp_time"] > 5]
if slow_responses:
    print(f"\n{'=' * 80}")
    print(f"SLOW RESPONSES >5s ({len(slow_responses)}):")
    print(f"{'=' * 80}")
    for r in slow_responses:
        print(f"  {r['resp_time']:.2f}s: {r['method']} {r['endpoint']}")

print(f"\n{'=' * 80}")
print(f"TEST COMPLETE: {passes}/{total} passed ({passes/total*100:.1f}%)")
print(f"{'=' * 80}")
