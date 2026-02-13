#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 20
Focus: REPORTING & ANALYTICS - queries about reports, dashboards, KPIs,
       data analysis, trends, efficiency metrics, and data export.
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

# Round 20 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Dashboard Overview (6 cases) =====
    ("看看仪表盘", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_TRENDS"], "dashboard-overview"),
    ("今天概况", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "dashboard-today"),
    ("总体情况怎么样", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_TRENDS"], "dashboard-overall"),
    ("给我看一览表", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_TRENDS", None], "dashboard-summary"),
    ("经营概况", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_FINANCE", "REPORT_TRENDS"], "dashboard-business"),
    ("工厂看板", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "dashboard-factory"),

    # ===== 2. Production Reports (6 cases) =====
    ("生产日报", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_LIST"], "production-daily"),
    ("产量汇总", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY"], "production-summary"),
    ("班次报表", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW"], "production-shift"),
    ("产能利用率", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "EQUIPMENT_STATS", "PRODUCTION_STATUS_QUERY"], "production-capacity"),
    ("良品率报告", ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_PRODUCTION"], "production-yield"),
    ("车间产出", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY"], "production-workshop"),

    # ===== 3. Financial Reports (6 cases) =====
    ("财务报表", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW"], "financial-statement"),
    ("成本分析", ["REPORT_FINANCE", "REPORT_TRENDS", "COST_TREND_ANALYSIS"], "financial-cost"),
    ("利润表", ["REPORT_FINANCE", None], "financial-profit"),
    ("收入报表", ["REPORT_FINANCE", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW"], "financial-revenue"),
    ("费用明细", ["REPORT_FINANCE"], "financial-expense"),
    ("毛利率", ["REPORT_FINANCE", "REPORT_KPI", "REPORT_TRENDS"], "financial-margin"),

    # ===== 4. Quality Reports (5 cases) =====
    ("质检报告", ["REPORT_QUALITY", "QUALITY_CHECK_QUERY", "QUALITY_STATS"], "quality-report"),
    ("不合格率统计", ["QUALITY_STATS", "REPORT_QUALITY", "QUALITY_CHECK_QUERY"], "quality-defect-rate"),
    ("质量趋势", ["REPORT_QUALITY", "REPORT_TRENDS", "QUALITY_STATS", "QUALITY_CHECK_QUERY"], "quality-trend"),
    ("来料检验报告", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "MATERIAL_BATCH_QUERY", None], "quality-incoming"),
    ("质量改善报告", ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_TRENDS"], "quality-improvement"),

    # ===== 5. Trend Analysis (6 cases) =====
    ("月度趋势", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW"], "trend-monthly"),
    ("同比分析", ["REPORT_TRENDS", "REPORT_FINANCE", "REPORT_PRODUCTION"], "trend-yoy"),
    ("环比增长", ["REPORT_TRENDS", "REPORT_FINANCE", "REPORT_PRODUCTION"], "trend-mom"),
    ("走势图", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW"], "trend-chart"),
    ("变化趋势", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_FINANCE"], "trend-change"),
    ("历史对比", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_FINANCE"], "trend-historical"),

    # ===== 6. KPI Queries (5 cases) =====
    ("KPI完成情况", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_TRENDS"], "kpi-completion"),
    ("关键指标", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS"], "kpi-key-metrics"),
    ("目标达成率", ["REPORT_KPI", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW"], "kpi-target-rate"),
    ("绩效指标", ["REPORT_KPI", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW"], "kpi-performance"),
    ("核心指标", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS"], "kpi-core-metrics"),

    # ===== 7. Efficiency Metrics (5 cases) =====
    ("效率报告", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "REPORT_KPI"], "efficiency-report"),
    ("OEE报告", ["REPORT_EFFICIENCY", "EQUIPMENT_STATS", "REPORT_PRODUCTION"], "efficiency-oee"),
    ("设备利用率", ["REPORT_EFFICIENCY", "EQUIPMENT_STATS", "EQUIPMENT_STATUS_QUERY"], "efficiency-equipment"),
    ("人均产出报告", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "ATTENDANCE_STATS"], "efficiency-per-capita"),
    ("产能效率", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "EQUIPMENT_STATS"], "efficiency-capacity"),

    # ===== 8. Custom/Export (5 cases) =====
    ("导出Excel", ["REPORT_PRODUCTION", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "export-excel"),
    ("自定义报表", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "FORM_GENERATION", None], "export-custom"),
    ("打印报表", ["REPORT_PRODUCTION", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "export-print"),
    ("邮件发送报表", [None, "REPORT_PRODUCTION", "REPORT_FINANCE"], "export-email"),
    ("数据导出", ["REPORT_PRODUCTION", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "export-data"),

    # ===== 9. Cross-Functional (6 cases) =====
    ("综合分析", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_FINANCE"], "cross-comprehensive"),
    ("部门报表", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_STATS", "REPORT_FINANCE"], "cross-department"),
    ("全厂数据", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY"], "cross-factory-wide"),
    ("管理层汇报", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "REPORT_FINANCE", "REPORT_TRENDS", None], "cross-management"),
    ("月度总结", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "cross-monthly-summary"),
    ("年度报告", ["REPORT_FINANCE", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "cross-annual"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 20 ===")
    print(f"Focus: REPORTING & ANALYTICS - dashboards, production/financial/quality reports,")
    print(f"       trend analysis, KPIs, efficiency metrics, export, cross-functional")
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
        'test': 'v5_round20_reporting_analytics',
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
    report_path = f'tests/ai-intent/reports/v5_round20_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
