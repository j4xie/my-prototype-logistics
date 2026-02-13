#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 42
Focus: KPI & METRICS queries across production, quality, inventory, financial,
       efficiency, HR, dashboards, trend analysis, and target setting.
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

# Round 42 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Production KPI (6 cases) =====
    ("OEE是多少", ["REPORT_KPI", "REPORT_PRODUCTION", "EQUIPMENT_STATS", "PRODUCTION_STATUS_QUERY", "REPORT_EFFICIENCY", None], "production_kpi"),
    ("产线利用率", ["REPORT_KPI", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "EQUIPMENT_STATS", "PRODUCTION_STATUS_QUERY", None], "production_kpi"),
    ("产量完成率", ["REPORT_KPI", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "production_kpi"),
    ("产能利用率", ["REPORT_KPI", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "EQUIPMENT_STATS", "PRODUCTION_STATUS_QUERY", None], "production_kpi"),
    ("直通率", ["REPORT_KPI", "REPORT_PRODUCTION", "REPORT_QUALITY", "QUALITY_STATS", "PRODUCTION_STATUS_QUERY", None], "production_kpi"),
    ("计划达成率", ["REPORT_KPI", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "production_kpi"),

    # ===== 2. Quality KPI (6 cases) =====
    ("合格率", ["REPORT_KPI", "REPORT_QUALITY", "QUALITY_STATS", None], "quality_kpi"),
    ("不良率", ["REPORT_KPI", "REPORT_QUALITY", "QUALITY_STATS", None], "quality_kpi"),
    ("一次通过率", ["REPORT_KPI", "REPORT_QUALITY", "QUALITY_STATS", "REPORT_PRODUCTION", None], "quality_kpi"),
    ("退货率", ["REPORT_KPI", "REPORT_QUALITY", "QUALITY_STATS", "MATERIAL_BATCH_QUERY", None], "quality_kpi"),
    ("客诉率", ["REPORT_KPI", "REPORT_QUALITY", "QUALITY_STATS", None], "quality_kpi"),
    ("质量成本", ["REPORT_KPI", "REPORT_QUALITY", "REPORT_FINANCE", "COST_QUERY", "QUALITY_STATS", "QUALITY_CHECK_QUERY", None], "quality_kpi"),

    # ===== 3. Inventory KPI (5 cases) =====
    ("库存周转率", ["REPORT_KPI", "REPORT_INVENTORY", None], "inventory_kpi"),
    ("库存准确率", ["REPORT_KPI", "REPORT_INVENTORY", None], "inventory_kpi"),
    ("安全库存达标率", ["REPORT_KPI", "REPORT_INVENTORY", "MATERIAL_LOW_STOCK_ALERT", None], "inventory_kpi"),
    ("呆滞料比例", ["REPORT_KPI", "REPORT_INVENTORY", None], "inventory_kpi"),
    ("库存金额", ["REPORT_KPI", "REPORT_INVENTORY", "REPORT_FINANCE", "COST_QUERY", None], "inventory_kpi"),

    # ===== 4. Financial KPI (6 cases) =====
    ("毛利率", ["REPORT_KPI", "REPORT_FINANCE", "COST_QUERY", None], "financial_kpi"),
    ("净利率", ["REPORT_KPI", "REPORT_FINANCE", "COST_QUERY", None], "financial_kpi"),
    ("成本率", ["REPORT_KPI", "REPORT_FINANCE", "COST_QUERY", "COST_TREND_ANALYSIS", None], "financial_kpi"),
    ("费用率", ["REPORT_KPI", "REPORT_FINANCE", "COST_QUERY", "COST_TREND_ANALYSIS", None], "financial_kpi"),
    ("投资回报率", ["REPORT_KPI", "REPORT_FINANCE", None], "financial_kpi"),
    ("应收账款周转", ["REPORT_KPI", "REPORT_FINANCE", None], "financial_kpi"),

    # ===== 5. Efficiency KPI (6 cases) =====
    ("人均产值", ["REPORT_KPI", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", None], "efficiency_kpi"),
    ("工时利用率", ["REPORT_KPI", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", None], "efficiency_kpi"),
    ("设备综合效率", ["REPORT_KPI", "REPORT_EFFICIENCY", "EQUIPMENT_STATS", "REPORT_PRODUCTION", None], "efficiency_kpi"),
    ("能源单耗", ["REPORT_KPI", "REPORT_EFFICIENCY", "REPORT_FINANCE", "COST_QUERY", "MATERIAL_BATCH_CONSUME", None], "efficiency_kpi"),
    ("损耗率", ["REPORT_KPI", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", "COST_QUERY", None], "efficiency_kpi"),
    ("交付准时率", ["REPORT_KPI", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "efficiency_kpi"),

    # ===== 6. HR KPI (5 cases) =====
    ("出勤率", ["REPORT_KPI", "ATTENDANCE_STATS", None], "hr_kpi"),
    ("离职率", ["REPORT_KPI", "ATTENDANCE_STATS", "HR_EMPLOYEE_DELETE", None], "hr_kpi"),
    ("人均工时", ["REPORT_KPI", "ATTENDANCE_STATS", "REPORT_EFFICIENCY", None], "hr_kpi"),
    ("加班率", ["REPORT_KPI", "ATTENDANCE_STATS", None], "hr_kpi"),
    ("培训覆盖率", ["REPORT_KPI", "ATTENDANCE_STATS", None], "hr_kpi"),

    # ===== 7. Dashboard (6 cases) =====
    ("KPI看板", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "dashboard"),
    ("指标汇总", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "dashboard"),
    ("综合评分", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "dashboard"),
    ("红绿灯状态", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "ISAPI_CONFIG_LINE_DETECTION", None], "dashboard"),
    ("预警指标", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "dashboard"),
    ("达标情况", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "dashboard"),

    # ===== 8. Trend Analysis (5 cases) =====
    ("KPI趋势", ["REPORT_KPI", "REPORT_TRENDS", "COST_TREND_ANALYSIS", None], "trend_analysis"),
    ("指标环比", ["REPORT_KPI", "REPORT_TRENDS", "COST_TREND_ANALYSIS", None], "trend_analysis"),
    ("同比变化", ["REPORT_KPI", "REPORT_TRENDS", "COST_TREND_ANALYSIS", None], "trend_analysis"),
    ("改善趋势", ["REPORT_KPI", "REPORT_TRENDS", "COST_TREND_ANALYSIS", None], "trend_analysis"),
    ("下滑指标", ["REPORT_KPI", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "trend_analysis"),

    # ===== 9. Target Setting (5 cases) =====
    ("KPI目标", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "target_setting"),
    ("指标设定", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "target_setting"),
    ("考核标准", ["REPORT_KPI", "ATTENDANCE_STATS", None], "target_setting"),
    ("达标线", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "target_setting"),
    ("目标差距", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "target_setting"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 42 ===")
    print(f"Focus: KPI & METRICS queries across production, quality, inventory,")
    print(f"       financial, efficiency, HR, dashboards, trends, and targets.")
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
        'test': 'v5_round42_kpi_metrics',
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
    report_path = f'tests/ai-intent/reports/v5_round42_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
