#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 31
Focus: COST ANALYSIS & FINANCIAL QUERIES - cost breakdown, budget tracking,
       profit analysis, expense categories, ROI, pricing, financial forecasting.
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

# Round 31 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Cost Breakdown (6 cases) =====
    ("原料成本占总成本的比例是多少", ["REPORT_FINANCE", "COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_KPI", None], "cost_breakdown"),
    ("人工成本分析一下最近三个月的变化", ["REPORT_FINANCE", "COST_TREND_ANALYSIS", "COST_QUERY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "cost_breakdown"),
    ("本月制造费用明细帮我列一下", ["REPORT_FINANCE", "COST_QUERY", "COST_TREND_ANALYSIS", None], "cost_breakdown"),
    ("包装成本上升了多少", ["COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_FINANCE", "REPORT_TRENDS", None], "cost_breakdown"),
    ("物流成本跟上个月比怎么样", ["COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_FINANCE", "REPORT_TRENDS", None], "cost_breakdown"),
    ("每单位产品的成本是多少", ["COST_QUERY", "REPORT_FINANCE", "REPORT_PRODUCTION", "REPORT_KPI", None], "cost_breakdown"),

    # ===== 2. Budget Tracking (5 cases) =====
    ("本月预算执行率是多少", ["REPORT_FINANCE", "REPORT_KPI", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "budget_tracking"),
    ("有没有预算超支的部门", ["REPORT_FINANCE", "COST_QUERY", "REPORT_KPI", None], "budget_tracking"),
    ("本季度还剩多少预算", ["REPORT_FINANCE", "COST_QUERY", None], "budget_tracking"),
    ("实际支出和预算对比情况", ["REPORT_FINANCE", "COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_TRENDS", None], "budget_tracking"),
    ("需要追加预算吗", ["REPORT_FINANCE", "COST_QUERY", None], "budget_tracking"),

    # ===== 3. Profit Analysis (6 cases) =====
    ("上个月的毛利分析报告", ["REPORT_FINANCE", "COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_KPI", None], "profit_analysis"),
    ("今年净利润情况怎么样", ["REPORT_FINANCE", "REPORT_KPI", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "profit_analysis"),
    ("利润率趋势看一下", ["REPORT_FINANCE", "REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_KPI", None], "profit_analysis"),
    ("盈亏平衡点分析", ["REPORT_FINANCE", "COST_QUERY", "COST_TREND_ANALYSIS", None], "profit_analysis"),
    ("各产品利润排名", ["REPORT_FINANCE", "COST_QUERY", "REPORT_KPI", "REPORT_PRODUCTION", None], "profit_analysis"),
    ("哪些产品在亏损", ["REPORT_FINANCE", "COST_QUERY", "REPORT_KPI", None], "profit_analysis"),

    # ===== 4. Expense Categories (5 cases) =====
    ("这个月水电费花了多少", ["COST_QUERY", "REPORT_FINANCE", None], "expense_categories"),
    ("设备维修费用统计", ["COST_QUERY", "REPORT_FINANCE", "EQUIPMENT_STATS", "REPORT_EQUIPMENT", "EQUIPMENT_MAINTENANCE", None], "expense_categories"),
    ("上个季度差旅费多少", ["COST_QUERY", "REPORT_FINANCE", None], "expense_categories"),
    ("办公费用有没有超标", ["COST_QUERY", "REPORT_FINANCE", None], "expense_categories"),
    ("固定资产折旧费是多少", ["COST_QUERY", "REPORT_FINANCE", None], "expense_categories"),

    # ===== 5. ROI/Investment (6 cases) =====
    ("上半年的投资回报率", ["REPORT_FINANCE", "REPORT_KPI", "COST_QUERY", None], "roi_investment"),
    ("新设备的ROI怎么样", ["REPORT_FINANCE", "EQUIPMENT_STATS", "REPORT_EQUIPMENT", "REPORT_KPI", None], "roi_investment"),
    ("车间改造项目的收益分析", ["REPORT_FINANCE", "COST_QUERY", "REPORT_EFFICIENCY", None], "roi_investment"),
    ("自动化投入产出比是多少", ["REPORT_FINANCE", "REPORT_EFFICIENCY", "REPORT_KPI", "EQUIPMENT_STATS", None], "roi_investment"),
    ("新产线多久能回收成本", ["REPORT_FINANCE", "COST_QUERY", "REPORT_PRODUCTION", None], "roi_investment"),
    ("技改效果评估一下", ["REPORT_FINANCE", "REPORT_EFFICIENCY", "EQUIPMENT_STATS", "REPORT_EQUIPMENT", None], "roi_investment"),

    # ===== 6. Pricing (5 cases) =====
    ("我们产品的定价合理吗", ["REPORT_FINANCE", "COST_QUERY", None], "pricing"),
    ("成本加成定价法算一下", ["COST_QUERY", "REPORT_FINANCE", "COST_TREND_ANALYSIS", None], "pricing"),
    ("竞品价格对比分析", [None, "REPORT_FINANCE", "COST_QUERY"], "pricing"),
    ("哪些产品需要调价", ["REPORT_FINANCE", "COST_QUERY", "MATERIAL_ADJUST_QUANTITY", None], "pricing"),
    ("价格弹性分析", [None, "REPORT_FINANCE", "COST_QUERY", "REPORT_TRENDS"], "pricing"),

    # ===== 7. Financial Forecasting (6 cases) =====
    ("预测一下下个月的生产成本", ["COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_FINANCE", "REPORT_TRENDS", None], "financial_forecasting"),
    ("明年预算怎么编制比较合理", [None, "REPORT_FINANCE", "COST_QUERY"], "financial_forecasting"),
    ("未来三个月现金流预测", ["REPORT_FINANCE", "REPORT_TRENDS", "COST_TREND_ANALYSIS", None], "financial_forecasting"),
    ("下季度资金需求多少", ["REPORT_FINANCE", "COST_QUERY", None], "financial_forecasting"),
    ("有什么财务风险需要关注的", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "ALERT_LIST", None], "financial_forecasting"),
    ("应收账款情况统计", ["REPORT_FINANCE", "COST_QUERY", None], "financial_forecasting"),

    # ===== 8. Tax & Compliance (5 cases) =====
    ("本月税务申报状态", [None, "REPORT_FINANCE"], "tax_compliance"),
    ("发票管理情况统计一下", [None, "REPORT_FINANCE", "COST_QUERY"], "tax_compliance"),
    ("我们的税负率是多少", [None, "REPORT_FINANCE", "REPORT_KPI"], "tax_compliance"),
    ("退税进度怎样了", [None, "REPORT_FINANCE"], "tax_compliance"),
    ("财务合规检查有什么问题", [None, "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW"], "tax_compliance"),

    # ===== 9. Cost Optimization (6 cases) =====
    ("有什么降本增效的建议", ["REPORT_FINANCE", "REPORT_EFFICIENCY", "COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_TRENDS", None], "cost_optimization"),
    ("目前的成本节约项目进展", ["COST_QUERY", "REPORT_FINANCE", "REPORT_EFFICIENCY", "COST_TREND_ANALYSIS", None], "cost_optimization"),
    ("生产浪费分析报告", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "COST_QUERY", "REPORT_FINANCE", "PROCESSING_BATCH_LIST", None], "cost_optimization"),
    ("能耗成本占比多少", ["COST_QUERY", "REPORT_FINANCE", "REPORT_EFFICIENCY", "REPORT_KPI", None], "cost_optimization"),
    ("原材料采购有没有议价空间", ["COST_QUERY", "REPORT_FINANCE", "MATERIAL_BATCH_QUERY", None], "cost_optimization"),
    ("替代材料成本对比分析", ["COST_QUERY", "REPORT_FINANCE", "MATERIAL_BATCH_QUERY", None], "cost_optimization"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 31 ===")
    print(f"Focus: COST ANALYSIS & FINANCIAL QUERIES - cost breakdown, budget tracking,")
    print(f"       profit analysis, expense categories, ROI, pricing, financial forecasting")
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
        'test': 'v5_round31_cost_analysis_financial',
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
    report_path = f'tests/ai-intent/reports/v5_round31_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
