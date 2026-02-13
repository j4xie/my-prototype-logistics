#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 72
Focus: COST & FINANCIAL DETAIL queries for food manufacturing.
       Covers material cost, labor cost, overhead, unit cost, cost trend,
       budget, profit, cost reduction, and cost allocation.
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

# Round 72 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Material Cost (6 cases) =====
    ("原料成本查询", ["COST_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_FINANCE", "REPORT_INVENTORY", None], "material_cost"),
    ("物料费用汇总", ["COST_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_FINANCE", "REPORT_INVENTORY", "COST_TREND_ANALYSIS", None], "material_cost"),
    ("配料成本多少", ["COST_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_FINANCE", "REPORT_INVENTORY", None], "material_cost"),
    ("包材成本统计", ["COST_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_FINANCE", "REPORT_INVENTORY", "COST_TREND_ANALYSIS", None], "material_cost"),
    ("辅料费用明细", ["COST_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_FINANCE", "REPORT_INVENTORY", None], "material_cost"),
    ("原料价格变动", ["COST_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_FINANCE", "REPORT_INVENTORY", None], "material_cost"),

    # ===== 2. Labor Cost (6 cases) =====
    ("人工成本多少", ["COST_QUERY", "REPORT_FINANCE", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", None], "labor_cost"),
    ("工资支出汇总", ["COST_QUERY", "REPORT_FINANCE", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", None], "labor_cost"),
    ("加班费统计", ["COST_QUERY", "REPORT_FINANCE", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "labor_cost"),
    ("人力成本分析", ["COST_QUERY", "REPORT_FINANCE", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", None], "labor_cost"),
    ("薪资统计报表", ["COST_QUERY", "REPORT_FINANCE", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "labor_cost"),
    ("用工成本查一下", ["COST_QUERY", "REPORT_FINANCE", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", None], "labor_cost"),

    # ===== 3. Overhead (5 cases) =====
    ("制造费用明细", ["COST_QUERY", "REPORT_FINANCE", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "overhead"),
    ("间接成本有多少", ["COST_QUERY", "REPORT_FINANCE", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "overhead"),
    ("管理费用查看", ["COST_QUERY", "REPORT_FINANCE", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "overhead"),
    ("折旧费是多少", ["COST_QUERY", "REPORT_FINANCE", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "overhead"),
    ("水电费统计", ["COST_QUERY", "REPORT_FINANCE", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "overhead"),

    # ===== 4. Unit Cost (6 cases) =====
    ("单位成本查询", ["COST_QUERY", "REPORT_FINANCE", "COST_TREND_ANALYSIS", "REPORT_PRODUCTION", None], "unit_cost"),
    ("每吨成本多少", ["COST_QUERY", "REPORT_FINANCE", "COST_TREND_ANALYSIS", "REPORT_PRODUCTION", None], "unit_cost"),
    ("单件成本分析", ["COST_QUERY", "REPORT_FINANCE", "COST_TREND_ANALYSIS", "REPORT_PRODUCTION", None], "unit_cost"),
    ("产品单价核算", ["COST_QUERY", "REPORT_FINANCE", "COST_TREND_ANALYSIS", "REPORT_PRODUCTION", None], "unit_cost"),
    ("成本单价明细", ["COST_QUERY", "REPORT_FINANCE", "COST_TREND_ANALYSIS", "REPORT_PRODUCTION", None], "unit_cost"),
    ("均摊成本计算", ["COST_QUERY", "REPORT_FINANCE", "COST_TREND_ANALYSIS", "REPORT_PRODUCTION", None], "unit_cost"),

    # ===== 5. Cost Trend (5 cases) =====
    ("成本趋势分析", ["COST_TREND_ANALYSIS", "REPORT_TRENDS", "REPORT_FINANCE", "COST_QUERY", None], "cost_trend"),
    ("成本走势图", ["COST_TREND_ANALYSIS", "REPORT_TRENDS", "REPORT_FINANCE", "COST_QUERY", None], "cost_trend"),
    ("费用变化情况", ["COST_TREND_ANALYSIS", "REPORT_TRENDS", "REPORT_FINANCE", "COST_QUERY", None], "cost_trend"),
    ("成本波动分析", ["COST_TREND_ANALYSIS", "REPORT_TRENDS", "REPORT_FINANCE", "COST_QUERY", None], "cost_trend"),
    ("月度成本对比", ["COST_TREND_ANALYSIS", "REPORT_TRENDS", "REPORT_FINANCE", "COST_QUERY", None], "cost_trend"),

    # ===== 6. Budget (6 cases) =====
    ("预算执行情况", ["REPORT_FINANCE", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "COST_QUERY", "PLAN_UPDATE", None], "budget"),
    ("预算对比分析", ["REPORT_FINANCE", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "COST_QUERY", "PLAN_UPDATE", None], "budget"),
    ("哪些超预算了", ["REPORT_FINANCE", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "COST_QUERY", "PLAN_UPDATE", None], "budget"),
    ("预算余额查询", ["REPORT_FINANCE", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "COST_QUERY", "PLAN_UPDATE", None], "budget"),
    ("费用预算明细", ["REPORT_FINANCE", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "COST_QUERY", "PLAN_UPDATE", None], "budget"),
    ("预算审批流程", ["REPORT_FINANCE", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "COST_QUERY", "PLAN_UPDATE", None], "budget"),

    # ===== 7. Profit (5 cases) =====
    ("利润分析报表", ["REPORT_FINANCE", "REPORT_TRENDS", "COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_DASHBOARD_OVERVIEW", None], "profit"),
    ("毛利率是多少", ["REPORT_FINANCE", "REPORT_TRENDS", "COST_QUERY", "COST_TREND_ANALYSIS", None], "profit"),
    ("净利润查询", ["REPORT_FINANCE", "REPORT_TRENDS", "COST_QUERY", "COST_TREND_ANALYSIS", None], "profit"),
    ("盈亏分析看看", ["REPORT_FINANCE", "REPORT_TRENDS", "COST_QUERY", "COST_TREND_ANALYSIS", "financial_ratios", None], "profit"),
    ("利润趋势图", ["REPORT_FINANCE", "REPORT_TRENDS", "COST_QUERY", "COST_TREND_ANALYSIS", None], "profit"),

    # ===== 8. Cost Reduction (6 cases) =====
    ("降本措施有哪些", ["COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_EFFICIENCY", "REPORT_TRENDS", "REPORT_FINANCE", None], "cost_reduction"),
    ("成本优化方案", ["COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_EFFICIENCY", "REPORT_TRENDS", "REPORT_FINANCE", None], "cost_reduction"),
    ("节约方案建议", ["COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_EFFICIENCY", "REPORT_TRENDS", "REPORT_FINANCE", None], "cost_reduction"),
    ("减少浪费措施", ["COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_EFFICIENCY", "REPORT_TRENDS", "REPORT_FINANCE", None], "cost_reduction"),
    ("提效降本分析", ["COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_EFFICIENCY", "REPORT_TRENDS", "REPORT_FINANCE", None], "cost_reduction"),
    ("成本控制报告", ["COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_EFFICIENCY", "REPORT_TRENDS", "REPORT_FINANCE", None], "cost_reduction"),

    # ===== 9. Cost Allocation (5 cases) =====
    ("成本分摊明细", ["COST_QUERY", "REPORT_FINANCE", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "COST_TREND_ANALYSIS", None], "cost_allocation"),
    ("费用分配表", ["COST_QUERY", "REPORT_FINANCE", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "COST_TREND_ANALYSIS", None], "cost_allocation"),
    ("成本归集报表", ["COST_QUERY", "REPORT_FINANCE", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "COST_TREND_ANALYSIS", None], "cost_allocation"),
    ("工序成本分析", ["COST_QUERY", "REPORT_FINANCE", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "COST_TREND_ANALYSIS", None], "cost_allocation"),
    ("产品成本核算", ["COST_QUERY", "REPORT_FINANCE", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "cost_allocation"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 72 ===")
    print(f"Focus: COST & FINANCIAL DETAIL queries")
    print(f"       (material cost, labor cost, overhead, unit cost, cost trend, budget, profit, cost reduction, cost allocation)")
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
        'test': 'v5_round72_cost_financial_detail',
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
    report_path = f'tests/ai-intent/reports/v5_round72_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
