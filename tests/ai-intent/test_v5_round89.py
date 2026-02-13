#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 89
Focus: FINANCIAL DETAIL queries for food manufacturing.
       Covers revenue, expense, profit_loss, budget, tax,
       accounts, cash_flow, depreciation, cost_center.
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

# Round 89 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Revenue (6 cases) =====
    ("收入统计", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "revenue"),
    ("销售收入", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "revenue"),
    ("营收报表", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "revenue"),
    ("收入对比", ["REPORT_FINANCE", "COST_QUERY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "revenue"),
    ("收入趋势", ["REPORT_FINANCE", "REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_DASHBOARD_OVERVIEW", None], "revenue"),
    ("收入明细", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "revenue"),

    # ===== 2. Expense (5 cases) =====
    ("费用报销", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "expense"),
    ("费用审批", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "expense"),
    ("差旅费用", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "expense"),
    ("办公费用", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "expense"),
    ("费用统计", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "expense"),

    # ===== 3. Profit & Loss (6 cases) =====
    ("利润分析", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "profit_loss"),
    ("毛利率", ["REPORT_FINANCE", "COST_QUERY", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "profit_loss"),
    ("净利润", ["REPORT_FINANCE", "COST_QUERY", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "profit_loss"),
    ("利润表", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "profit_loss"),
    ("盈亏分析", ["REPORT_FINANCE", "COST_QUERY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "financial_ratios", None], "profit_loss"),
    ("损益报告", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "profit_loss"),

    # ===== 4. Budget (5 cases) =====
    ("预算管理", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "budget"),
    ("预算执行", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "budget"),
    ("预算对比", ["REPORT_FINANCE", "COST_QUERY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "budget"),
    ("超预算预警", ["REPORT_FINANCE", "COST_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "budget"),
    ("预算调整", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "budget"),

    # ===== 5. Tax (6 cases) =====
    ("税务申报", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "tax"),
    ("发票管理", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "tax"),
    ("增值税", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "tax"),
    ("税负分析", ["REPORT_FINANCE", "COST_QUERY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "tax"),
    ("开票记录", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "tax"),
    ("进项发票", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "tax"),

    # ===== 6. Accounts (5 cases) =====
    ("应收账款", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "accounts"),
    ("应付账款", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "accounts"),
    ("账龄分析", ["REPORT_FINANCE", "COST_QUERY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "accounts"),
    ("催收跟踪", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "accounts"),
    ("对账记录", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "accounts"),

    # ===== 7. Cash Flow (6 cases) =====
    ("现金流", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "cash_flow"),
    ("资金计划", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "cash_flow"),
    ("资金调拨", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "cash_flow"),
    ("银行余额", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "cash_flow"),
    ("资金预测", ["REPORT_FINANCE", "COST_QUERY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "QUERY_LIQUIDITY", None], "cash_flow"),
    ("回款情况", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "cash_flow"),

    # ===== 8. Depreciation (5 cases) =====
    ("设备折旧", ["REPORT_FINANCE", "COST_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "depreciation"),
    ("资产折旧", ["REPORT_FINANCE", "COST_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "depreciation"),
    ("固定资产", ["REPORT_FINANCE", "COST_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "depreciation"),
    ("资产盘点", ["REPORT_FINANCE", "COST_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_INVENTORY", None], "depreciation"),
    ("资产台账", ["REPORT_FINANCE", "COST_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "depreciation"),

    # ===== 9. Cost Center (6 cases) =====
    ("成本中心", ["REPORT_FINANCE", "COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_DASHBOARD_OVERVIEW", None], "cost_center"),
    ("部门费用", ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "cost_center"),
    ("项目成本", ["REPORT_FINANCE", "COST_QUERY", "COST_TREND_ANALYSIS", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "cost_center"),
    ("成本归集", ["REPORT_FINANCE", "COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_DASHBOARD_OVERVIEW", None], "cost_center"),
    ("成本核算", ["REPORT_FINANCE", "COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_DASHBOARD_OVERVIEW", None], "cost_center"),
    ("成本分摊", ["REPORT_FINANCE", "COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_DASHBOARD_OVERVIEW", None], "cost_center"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 89 ===")
    print(f"Focus: FINANCIAL DETAIL queries for food manufacturing")
    print(f"       (revenue, expense, profit_loss, budget, tax,")
    print(f"        accounts, cash_flow, depreciation, cost_center)")
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
        'test': 'v5_round89_financial_detail',
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
    report_path = f'tests/ai-intent/reports/v5_round89_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
