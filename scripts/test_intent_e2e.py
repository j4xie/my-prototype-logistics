#!/usr/bin/env python3
"""E2E Intent Pipeline v6 Validation Test"""
import json, sys, urllib.request

BASE = "http://localhost:10010/api/public/ai-demo/execute"

TESTS = [
    # Core 10
    ("库存报告", "REPORT_INVENTORY"),
    ("本周考勤统计", "ATTENDANCE_STATS"),
    ("客户列表", "CUSTOMER_LIST"),
    ("成本分析", "COST_QUERY"),
    ("排班计划", "SCHEDULING_LIST"),
    ("设备运行状况", "EQUIPMENT_STATUS_QUERY"),
    ("产量报表", "REPORT_PRODUCTION"),
    ("财务报告", "REPORT_FINANCE"),
    ("质量报告", "REPORT_QUALITY"),
    ("效率报告", "REPORT_EFFICIENCY"),
    # Extended 10
    ("今天考勤情况", "ATTENDANCE_TODAY"),
    ("供应商列表", "SUPPLIER_LIST"),
    ("工单状态查询", "WORK_ORDER_STATUS"),
    ("原材料入库", "MATERIAL_INBOUND"),
    ("今天有多少人请假", "ATTENDANCE_ANOMALY"),
    ("工资报表", "WAGE_REPORT"),
    ("设备维护计划", "EQUIPMENT_MAINTENANCE"),
    ("质检记录", "QUALITY_INSPECTION_LIST"),
    ("销售订单", "SALES_ORDER_LIST"),
    ("生产批次查询", "BATCH_QUERY"),
]

def test(query, expected):
    body = json.dumps({"userInput": query, "factoryId": "F001"}).encode()
    req = urllib.request.Request(BASE, data=body, headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        d = json.loads(resp.read())["data"]
    except Exception as e:
        return expected, "ERROR", "N/A", 0, str(e)[:40]

    intent = d.get("intentCode") or "NONE"
    method = d.get("matchMethod") or "N/A"
    text = d.get("formattedText") or d.get("message") or ""
    return intent, method, "OK" if intent == expected else "MISS", len(text), text[:80].replace('\n', '|')

print("=" * 120)
print("  E2E Intent Pipeline v6 Validation")
print("=" * 120)
print(f"{'#':>2} | {'Match':5} | {'Gr':2} | {'Method':14} | {'Expected':28} | {'Actual':28} | {'Len':4} | Preview")
print("-" * 120)

stats = {"OK": 0, "MISS": 0, "A": 0, "B": 0, "C": 0, "F": 0}
for i, (q, exp) in enumerate(TESTS, 1):
    intent, method, match, tlen, preview = test(q, exp)
    grade = "A" if tlen >= 50 else "B" if tlen >= 20 else "C" if tlen > 0 else "F"
    stats[match] += 1
    stats[grade] += 1
    print(f"{i:2} | {match:5} | {grade:2} | {method:14} | {exp:28} | {intent:28} | {tlen:4} | {preview}")

print("=" * 120)
print(f"\nIntent Match: {stats['OK']}/{stats['OK']+stats['MISS']} ({100*stats['OK']/(stats['OK']+stats['MISS']):.0f}%)")
print(f"Grade A: {stats['A']}/20 ({100*stats['A']/20:.0f}%) | B: {stats['B']} | C: {stats['C']} | F: {stats['F']}")
print(f"Target: Intent ≥85%, Grade A ≥70%, Grade F = 0")
