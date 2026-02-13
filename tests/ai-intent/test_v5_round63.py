#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 63
Focus: COMPARISON & RANKING queries for food manufacturing.
       Covers production compare, quality compare, cost compare, employee rank,
       supplier rank, equipment compare, period compare, benchmark, and best/worst.
"""

import requests
import json
import sys
import time
from datetime import datetime

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SERVER = 'http://47.100.235.168:10010'
FACTORY_ID = 'F001'

def get_token():
    r = requests.post(f'{SERVER}/api/mobile/auth/unified-login', json={
        'username': 'factory_admin1', 'password': '123456'
    })
    data = r.json()
    if data.get('success'):
        return data['data']['accessToken']
    raise Exception(f"Login failed: {data}")

# Round 63 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Production Compare (6 cases) =====
    ("A线和B线产量对比", ["REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_EFFICIENCY", "REPORT_KPI", None], "production_compare"),
    ("两个车间产量对比", ["REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_EFFICIENCY", "REPORT_KPI", None], "production_compare"),
    ("产量排名", ["REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_EFFICIENCY", "REPORT_KPI", None], "production_compare"),
    ("哪条线效率高", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_KPI", None], "production_compare"),
    ("班组产量比较", ["REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_EFFICIENCY", "REPORT_KPI", None], "production_compare"),
    ("各线体产量对比", ["REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_EFFICIENCY", "REPORT_KPI", None], "production_compare"),

    # ===== 2. Quality Compare (6 cases) =====
    ("各批次合格率对比", ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_TRENDS", None], "quality_compare"),
    ("质量排名", ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_TRENDS", "QUALITY_CHECK_QUERY", None], "quality_compare"),
    ("哪个产品质量好", ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_TRENDS", None], "quality_compare"),
    ("不良率对比", ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_TRENDS", None], "quality_compare"),
    ("各线质检对比", ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_TRENDS", None], "quality_compare"),
    ("质量趋势对比", ["REPORT_TRENDS", "REPORT_QUALITY", "QUALITY_STATS", None], "quality_compare"),

    # ===== 3. Cost Compare (5 cases) =====
    ("成本对比", ["COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_FINANCE", "REPORT_TRENDS", None], "cost_compare"),
    ("各产品成本比较", ["COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_FINANCE", "REPORT_TRENDS", None], "cost_compare"),
    ("月度成本变化", ["COST_TREND_ANALYSIS", "COST_QUERY", "REPORT_TRENDS", "REPORT_FINANCE", None], "cost_compare"),
    ("哪个产品便宜", ["COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_FINANCE", "REPORT_TRENDS", None], "cost_compare"),
    ("费用对比", ["COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_FINANCE", "REPORT_TRENDS", None], "cost_compare"),

    # ===== 4. Employee Rank (6 cases) =====
    ("员工绩效排名", ["REPORT_EFFICIENCY", "HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_KPI", None], "employee_rank"),
    ("谁效率最高", ["REPORT_EFFICIENCY", "HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_KPI", None], "employee_rank"),
    ("产量前十员工", ["REPORT_EFFICIENCY", "HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_KPI", "REPORT_PRODUCTION", None], "employee_rank"),
    ("出勤排名", ["ATTENDANCE_STATS", "REPORT_EFFICIENCY", "HR_EMPLOYEE_LIST", "REPORT_KPI", None], "employee_rank"),
    ("技能评分排名", ["REPORT_EFFICIENCY", "HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_KPI", None], "employee_rank"),
    ("最佳员工", ["REPORT_EFFICIENCY", "HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_KPI", None], "employee_rank"),

    # ===== 5. Supplier Rank (5 cases) =====
    ("供应商评分排名", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", "SUPPLIER_RANKING", "REPORT_TRENDS", None], "supplier_rank"),
    ("哪家供应商最好", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", "SUPPLIER_RANKING", "REPORT_TRENDS", None], "supplier_rank"),
    ("供应商对比", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", "SUPPLIER_RANKING", "REPORT_TRENDS", None], "supplier_rank"),
    ("交货准时率排名", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", "SUPPLIER_RANKING", "REPORT_TRENDS", None], "supplier_rank"),
    ("供应商综合评价", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", "SUPPLIER_RANKING", "REPORT_TRENDS", None], "supplier_rank"),

    # ===== 6. Equipment Compare (5 cases) =====
    ("设备效率对比", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", None], "equipment_compare"),
    ("哪台设备故障多", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", "EQUIPMENT_ALERT_LIST", None], "equipment_compare"),
    ("OEE排名", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", None], "equipment_compare"),
    ("设备利用率对比", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", None], "equipment_compare"),
    ("各设备运行时间比较", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", None], "equipment_compare"),

    # ===== 7. Period Compare (6 cases) =====
    ("同比增长多少", ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "period_compare"),
    ("环比变化", ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "period_compare"),
    ("上月对比情况", ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "period_compare"),
    ("去年同期对比", ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "period_compare"),
    ("季度环比分析", ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "period_compare"),
    ("年度同比分析", ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "period_compare"),

    # ===== 8. Benchmark (6 cases) =====
    ("达标率是多少", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_QUALITY", "QUALITY_STATS", None], "benchmark"),
    ("产量是否达标", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_QUALITY", None], "benchmark"),
    ("目标完成度", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_QUALITY", None], "benchmark"),
    ("KPI达成情况", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_QUALITY", None], "benchmark"),
    ("指标对比分析", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_QUALITY", None], "benchmark"),
    ("与标准对比", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_QUALITY", "REPORT_TRENDS", None], "benchmark"),

    # ===== 9. Best/Worst (5 cases) =====
    ("最差的批次是哪个", ["REPORT_PRODUCTION", "REPORT_QUALITY", "QUALITY_STATS", "EQUIPMENT_STATS", "REPORT_TRENDS", None], "best_worst"),
    ("最好的产品是哪个", ["REPORT_PRODUCTION", "REPORT_QUALITY", "QUALITY_STATS", "EQUIPMENT_STATS", "REPORT_TRENDS", None], "best_worst"),
    ("最高产量是多少", ["REPORT_PRODUCTION", "REPORT_QUALITY", "QUALITY_STATS", "EQUIPMENT_STATS", "REPORT_TRENDS", "PRODUCTION_STATUS_QUERY", None], "best_worst"),
    ("最低合格率是多少", ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_PRODUCTION", "EQUIPMENT_STATS", "REPORT_TRENDS", None], "best_worst"),
    ("最多故障的设备", ["EQUIPMENT_STATS", "REPORT_QUALITY", "QUALITY_STATS", "REPORT_PRODUCTION", "REPORT_TRENDS", "EQUIPMENT_ALERT_STATS", None], "best_worst"),
]

def test_intent(token, query, expected_intents, category):
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    start_time = time.time()
    try:
        r = requests.post(
            f'{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/recognize',
            headers=headers,
            json={'userInput': query},
            timeout=25
        )
        latency = time.time() - start_time
        data = r.json()
        if not data.get('success'):
            return query, 'ERROR', None, None, category, data.get('message', 'unknown'), latency

        intent_data = data.get('data', {})
        intent = intent_data.get('intentCode', 'NONE')
        confidence = intent_data.get('confidence', 0)
        method = intent_data.get('matchMethod', 'unknown')

        passed = intent in expected_intents
        status = 'PASS' if passed else 'FAIL'
        return query, status, intent, confidence, category, method, latency
    except requests.exceptions.Timeout:
        latency = time.time() - start_time
        return query, 'ERROR', None, None, category, 'TIMEOUT', latency
    except Exception as e:
        latency = time.time() - start_time
        return query, 'ERROR', None, None, category, str(e), latency

def main():
    print(f"=== v5 Intent Pipeline E2E Test - Round 63 ===")
    print(f"Focus: COMPARISON & RANKING queries")
    print(f"       (production, quality, cost, employee, supplier, equipment, period, benchmark, best/worst)")
    print(f"Server: {SERVER}")
    print(f"Time: {datetime.now().isoformat()}")
    print(f"Total queries: {len(TEST_CASES)}")
    print()

    token = get_token()
    print(f"Token acquired.\n")

    results = []
    pass_count = 0
    fail_count = 0
    error_count = 0
    categories = {}

    for i, (query, expected, category) in enumerate(TEST_CASES):
        q, status, intent, conf, cat, method, latency = test_intent(token, query, expected, category)
        results.append({
            'query': q, 'status': status, 'intent': intent,
            'confidence': conf, 'expected': expected, 'category': cat,
            'method': method, 'latency_ms': round(latency * 1000)
        })

        cat_group = cat.split('-')[0]
        if cat_group not in categories:
            categories[cat_group] = {'pass': 0, 'fail': 0, 'error': 0}

        if status == 'PASS':
            pass_count += 1
            categories[cat_group]['pass'] += 1
            icon = 'OK'
        elif status == 'FAIL':
            fail_count += 1
            categories[cat_group]['fail'] += 1
            icon = 'FAIL'
        else:
            error_count += 1
            categories[cat_group]['error'] += 1
            icon = 'ERR'

        conf_str = f"{conf:.2f}" if conf is not None else "N/A"
        lat_str = f"{latency*1000:.0f}ms"
        print(f"  [{icon}] [{cat}] \"{q}\" => {intent} ({conf_str}) via {method} [{lat_str}]" +
              (f"  (expected: {expected})" if status != 'PASS' else ""))
        time.sleep(0.1)

    print(f"\n{'='*60}")
    print(f"Results: {pass_count} PASS / {fail_count} FAIL / {error_count} ERROR out of {len(TEST_CASES)}")
    print(f"Pass rate: {pass_count/len(TEST_CASES)*100:.1f}%")

    print(f"\n--- Category breakdown ---")
    for cat, counts in sorted(categories.items()):
        total = counts['pass'] + counts['fail'] + counts['error']
        pct = counts['pass']/total*100 if total > 0 else 0
        status_icon = "[OK]" if pct == 100 else "[WEAK]" if pct >= 60 else "[CRITICAL]"
        print(f"  {status_icon} {cat}: {counts['pass']}/{total} ({pct:.0f}%)")

    if fail_count > 0:
        print(f"\n--- Failed queries ---")
        for r in results:
            if r['status'] == 'FAIL':
                print(f"  \"{r['query']}\" => {r['intent']} (expected {r['expected']}) [{r['category']}] via {r['method']} [{r['latency_ms']}ms]")

    methods = {}
    for r in results:
        m = r.get('method') or 'NONE'
        methods[m] = methods.get(m, 0) + 1
    print(f"\n--- Match method distribution ---")
    for m, c in sorted(methods.items(), key=lambda x: -x[1]):
        print(f"  {m}: {c}")

    latencies = [r['latency_ms'] for r in results]
    latencies.sort()
    avg_lat = sum(latencies) / len(latencies)
    p50 = latencies[len(latencies) // 2]
    p90 = latencies[int(len(latencies) * 0.9)]
    p99 = latencies[int(len(latencies) * 0.99)]
    print(f"\n--- Latency stats ---")
    print(f"  Avg: {avg_lat:.0f}ms | P50: {p50}ms | P90: {p90}ms | P99: {p99}ms")

    report = {
        'timestamp': datetime.now().isoformat(),
        'test': 'v5_round63_comparison_ranking',
        'total': len(TEST_CASES),
        'pass': pass_count,
        'fail': fail_count,
        'error': error_count,
        'pass_rate': pass_count/len(TEST_CASES)*100,
        'category_breakdown': categories,
        'method_distribution': methods,
        'results': results
    }
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_path = f'tests/ai-intent/reports/v5_round63_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
