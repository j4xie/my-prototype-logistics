#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 53
Focus: DASHBOARD & OVERVIEW queries.
       Covers general overview, production/quality/inventory/equipment/
       financial/HR/alert dashboards, and custom dashboard requests.
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

# Round 53 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. General Overview (6 cases) =====
    ("总览",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "REPORT_PRODUCTION", None],
     "general_overview"),
    ("概况",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "REPORT_TRENDS", None],
     "general_overview"),
    ("整体情况",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "REPORT_TRENDS", None],
     "general_overview"),
    ("全局视图",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None],
     "general_overview"),
    ("运营概览",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "REPORT_TRENDS", "REPORT_FINANCE", None],
     "general_overview"),
    ("一目了然",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None],
     "general_overview"),

    # ===== 2. Production Dashboard (6 cases) =====
    ("生产看板",
     ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "REPORT_KPI", "PROCESSING_BATCH_LIST", None],
     "production_dashboard"),
    ("车间看板",
     ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None],
     "production_dashboard"),
    ("产线大屏",
     ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None],
     "production_dashboard"),
    ("实时生产数据",
     ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None],
     "production_dashboard"),
    ("生产仪表盘",
     ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "REPORT_KPI", "PROCESSING_BATCH_LIST", None],
     "production_dashboard"),
    ("产能总览",
     ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", None],
     "production_dashboard"),

    # ===== 3. Quality Dashboard (5 cases) =====
    ("质量看板",
     ["REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_STATS", "QUALITY_CHECK_QUERY", None],
     "quality_dashboard"),
    ("质量总览",
     ["REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_STATS", "QUALITY_CHECK_QUERY", None],
     "quality_dashboard"),
    ("合格率看板",
     ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None],
     "quality_dashboard"),
    ("质量仪表盘",
     ["REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_STATS", "REPORT_KPI", "QUALITY_CHECK_QUERY", None],
     "quality_dashboard"),
    ("质量大屏",
     ["REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_STATS", "QUALITY_CHECK_QUERY", None],
     "quality_dashboard"),

    # ===== 4. Inventory Dashboard (6 cases) =====
    ("库存看板",
     ["REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None],
     "inventory_dashboard"),
    ("仓储总览",
     ["REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None],
     "inventory_dashboard"),
    ("库存概况",
     ["REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None],
     "inventory_dashboard"),
    ("出入库看板",
     ["REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None],
     "inventory_dashboard"),
    ("物料看板",
     ["REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "MATERIAL_BATCH_QUERY", None],
     "inventory_dashboard"),
    ("库存大屏",
     ["REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None],
     "inventory_dashboard"),

    # ===== 5. Equipment Dashboard (5 cases) =====
    ("设备看板",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_LIST", None],
     "equipment_dashboard"),
    ("设备总览",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", None],
     "equipment_dashboard"),
    ("设备运行看板",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", None],
     "equipment_dashboard"),
    ("设备状态大屏",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", None],
     "equipment_dashboard"),
    ("车间设备一览",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "EQUIPMENT_LIST", None],
     "equipment_dashboard"),

    # ===== 6. Financial Dashboard (6 cases) =====
    ("财务看板",
     ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None],
     "financial_dashboard"),
    ("经营看板",
     ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "REPORT_TRENDS", None],
     "financial_dashboard"),
    ("收支总览",
     ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None],
     "financial_dashboard"),
    ("利润看板",
     ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None],
     "financial_dashboard"),
    ("成本看板",
     ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "COST_QUERY", None],
     "financial_dashboard"),
    ("财务大屏",
     ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None],
     "financial_dashboard"),

    # ===== 7. HR Dashboard (5 cases) =====
    ("人员看板",
     ["ATTENDANCE_STATS", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None],
     "hr_dashboard"),
    ("出勤看板",
     ["ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", None],
     "hr_dashboard"),
    ("人效看板",
     ["REPORT_EFFICIENCY", "ATTENDANCE_STATS", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None],
     "hr_dashboard"),
    ("人员总览",
     ["ATTENDANCE_STATS", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None],
     "hr_dashboard"),
    ("考勤大屏",
     ["ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", "ATTENDANCE_TODAY", None],
     "hr_dashboard"),

    # ===== 8. Alert Dashboard (5 cases) =====
    ("告警看板",
     ["ALERT_LIST", "ALERT_STATS", "REPORT_DASHBOARD_OVERVIEW", None],
     "alert_dashboard"),
    ("预警总览",
     ["ALERT_LIST", "ALERT_STATS", "REPORT_DASHBOARD_OVERVIEW", None],
     "alert_dashboard"),
    ("告警统计看板",
     ["ALERT_STATS", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None],
     "alert_dashboard"),
    ("异常总览",
     ["ALERT_LIST", "ALERT_STATS", "REPORT_DASHBOARD_OVERVIEW", None],
     "alert_dashboard"),
    ("风险看板",
     ["ALERT_LIST", "ALERT_STATS", "REPORT_DASHBOARD_OVERVIEW", None],
     "alert_dashboard"),

    # ===== 9. Custom Dashboard (6 cases) =====
    ("我的看板",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None],
     "custom_dashboard"),
    ("自定义面板",
     ["REPORT_DASHBOARD_OVERVIEW", None],
     "custom_dashboard"),
    ("收藏的看板",
     ["REPORT_DASHBOARD_OVERVIEW", None],
     "custom_dashboard"),
    ("常用面板",
     ["REPORT_DASHBOARD_OVERVIEW", None],
     "custom_dashboard"),
    ("首页配置",
     ["REPORT_DASHBOARD_OVERVIEW", None],
     "custom_dashboard"),
    ("个人工作台",
     ["REPORT_DASHBOARD_OVERVIEW", None],
     "custom_dashboard"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 53 ===")
    print(f"Focus: DASHBOARD & OVERVIEW queries")
    print(f"       (general overview, production/quality/inventory/equipment/")
    print(f"        financial/HR/alert dashboards, custom dashboard)")
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
        'test': 'v5_round53_dashboard_overview',
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
    report_path = f'tests/ai-intent/reports/v5_round53_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
