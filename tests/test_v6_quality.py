#!/usr/bin/env python3
"""Intent Pipeline v6 Quality Test"""
import requests, json, time, sys, io

# Fix Windows GBK console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE = "http://47.100.235.168:10010/api/mobile"

# Login
r = requests.post(f"{BASE}/auth/unified-login",
    json={"username": "factory_admin1", "password": "123456"}, timeout=10)
token = r.json()["data"]["accessToken"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Clear caches
requests.post(f"{BASE}/F001/ai-intents/cache/clear", headers=headers, timeout=5)
requests.post(f"{BASE}/F001/intent-analysis/semantic-router/refresh-cache", headers=headers, timeout=5)

tests = [
    ("\u5e93\u5b58\u62a5\u544a", "REPORT_INVENTORY"),
    ("\u672c\u5468\u8003\u52e4\u7edf\u8ba1", "ATTENDANCE_STATS"),
    ("\u5ba2\u6237\u5217\u8868", "CUSTOMER_LIST"),
    ("\u6210\u672c\u5206\u6790", "COST_QUERY"),
    ("\u6392\u73ed\u8ba1\u5212", "SCHEDULING_LIST"),
    ("\u8bbe\u5907\u8fd0\u884c\u72b6\u51b5", "EQUIPMENT_STATUS_QUERY"),
    ("\u4ea7\u91cf\u62a5\u8868", "REPORT_PRODUCTION"),
    ("\u8d22\u52a1\u62a5\u544a", "REPORT_FINANCE"),
    ("\u8d28\u91cf\u62a5\u544a", "REPORT_QUALITY"),
    ("\u6548\u7387\u62a5\u544a", "REPORT_EFFICIENCY"),
]

print("=== Intent Pipeline v6 Quality Test ===\n")
a_count, b_count, f_count = 0, 0, 0
results = []
API = f"{BASE}/F001/ai-intents/execute"

for i, (query, expected) in enumerate(tests):
    sid = f"test-v6e-{int(time.time())}-{i}"
    try:
        r = requests.post(API, headers=headers, json={"userInput": query, "sessionId": sid}, timeout=20)
        d = r.json().get("data", {})
        intent = d.get("intentCode", "NONE") or "NONE"
        ft_text = d.get("formattedText", "") or ""
        ft_len = len(ft_text)
        status = d.get("status", "UNKNOWN")

        match_str = "OK" if intent == expected else f"X({intent})"
        if status in ("COMPLETED", "SUCCESS") and ft_len >= 50:
            grade = "A"; a_count += 1
        elif status in ("COMPLETED", "SUCCESS") and ft_len > 0:
            grade = "B"; b_count += 1
        else:
            grade = "F"; f_count += 1

        # Safe preview: replace chars that break GBK
        preview = ft_text[:80].replace("\n", " ").replace("\u00a5", "Y").replace("\u2022", "*")
        print(f"{i+1:2d}. {query:12s} | {expected:24s} {match_str:8s} | ft={ft_len:3d} | {grade} | {preview}")
        results.append({"query": query, "expected": expected, "intent": intent, "ft_len": ft_len, "grade": grade, "status": status})
    except Exception as e:
        print(f"{i+1:2d}. {query:12s} | ERROR: {str(e)[:80]}")
        f_count += 1
        results.append({"query": query, "expected": expected, "intent": "ERROR", "ft_len": 0, "grade": "F", "status": str(e)[:50]})

print(f"\n=== Summary ===")
print(f"A-grade (ft>=50): {a_count}/10")
print(f"B-grade (0<ft<50): {b_count}/10")
print(f"F-grade (fail): {f_count}/10")
print(f"Target: A>=7, F=0")

# Save detailed results
with open("tests/test_v6_results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
print("\nDetailed results saved to tests/test_v6_results.json")
