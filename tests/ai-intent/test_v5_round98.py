#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 98
Focus: KPI & PERFORMANCE METRICS queries for food manufacturing.
       Covers production_kpi, quality_kpi, delivery_kpi, cost_kpi,
       efficiency_kpi, safety_kpi, inventory_kpi, hr_kpi, and environmental_kpi.
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

# Round 98 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Production KPI (6 cases) =====
    ("查看产量达成率", ["REPORT_KPI", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "REPORT_EFFICIENCY", None], "production_kpi"),
    ("本月计划完成率多少", ["REPORT_KPI", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "REPORT_TRENDS", None], "production_kpi"),
    ("日产能是多少", ["REPORT_KPI", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_EFFICIENCY", None], "production_kpi"),
    ("查一下产出率", ["REPORT_KPI", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "CONVERSION_RATE_UPDATE", None], "production_kpi"),
    ("单位时间产量统计", ["REPORT_KPI", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "REPORT_TRENDS", None], "production_kpi"),
    ("产能利用率怎么样", ["REPORT_KPI", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "EQUIPMENT_STATS", "PRODUCTION_STATUS_QUERY", None], "production_kpi"),

    # ===== 2. Quality KPI (5 cases) =====
    ("一次合格率是多少", ["REPORT_KPI", "REPORT_QUALITY", "QUALITY_STATS", "QUALITY_CHECK_QUERY", None], "quality_kpi"),
    ("查看不良率", ["REPORT_KPI", "REPORT_QUALITY", "QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "quality_kpi"),
    ("客诉率统计", ["REPORT_KPI", "REPORT_QUALITY", "QUALITY_STATS", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "quality_kpi"),
    ("质量成本分析", ["REPORT_KPI", "REPORT_QUALITY", "QUALITY_STATS", "COST_QUERY", "REPORT_FINANCE", "COST_TREND_ANALYSIS", None], "quality_kpi"),
    ("CPK值查询", ["REPORT_KPI", "REPORT_QUALITY", "QUALITY_STATS", "QUALITY_CHECK_QUERY", None], "quality_kpi"),

    # ===== 3. Delivery KPI (6 cases) =====
    ("准时交付率多少", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "SHIPMENT_QUERY", "REPORT_TRENDS", None], "delivery_kpi"),
    ("订单满足率查询", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "SHIPMENT_QUERY", "REPORT_TRENDS", "ORDER_LIST", None], "delivery_kpi"),
    ("交付周期是多长", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "SHIPMENT_QUERY", "REPORT_PRODUCTION", None], "delivery_kpi"),
    ("延期率统计", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "SHIPMENT_QUERY", "REPORT_TRENDS", "ALERT_LIST", None], "delivery_kpi"),
    ("发货准确率怎么样", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "SHIPMENT_QUERY", "REPORT_QUALITY", "MATERIAL_BATCH_QUERY", None], "delivery_kpi"),
    ("客户满意度分析", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "QUALITY_STATS", "CUSTOMER_STATS", None], "delivery_kpi"),

    # ===== 4. Cost KPI (5 cases) =====
    ("单位成本是多少", ["REPORT_KPI", "REPORT_FINANCE", "COST_QUERY", "REPORT_TRENDS", None], "cost_kpi"),
    ("成本降低率分析", ["REPORT_KPI", "REPORT_FINANCE", "COST_QUERY", "REPORT_TRENDS", "COST_TREND_ANALYSIS", None], "cost_kpi"),
    ("材料利用率查询", ["REPORT_KPI", "REPORT_FINANCE", "COST_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_EFFICIENCY", None], "cost_kpi"),
    ("能源单耗指标", ["REPORT_KPI", "REPORT_FINANCE", "COST_QUERY", "REPORT_EFFICIENCY", "REPORT_TRENDS", None], "cost_kpi"),
    ("人工成本率多少", ["REPORT_KPI", "REPORT_FINANCE", "COST_QUERY", "ATTENDANCE_STATS", "HR_EMPLOYEE_LIST", None], "cost_kpi"),

    # ===== 5. Efficiency KPI (6 cases) =====
    ("人均产值是多少", ["REPORT_KPI", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", "ATTENDANCE_STATS", "HR_EMPLOYEE_LIST", None], "efficiency_kpi"),
    ("劳动生产率统计", ["REPORT_KPI", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", "ATTENDANCE_STATS", None], "efficiency_kpi"),
    ("工时利用率查询", ["REPORT_KPI", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", "REPORT_TRENDS", None], "efficiency_kpi"),
    ("换线效率怎么样", ["REPORT_KPI", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", "EQUIPMENT_STATS", None], "efficiency_kpi"),
    ("设备利用率多少", ["REPORT_KPI", "REPORT_EFFICIENCY", "EQUIPMENT_STATS", "REPORT_PRODUCTION", None], "efficiency_kpi"),
    ("综合效率OEE分析", ["REPORT_KPI", "REPORT_EFFICIENCY", "EQUIPMENT_STATS", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "efficiency_kpi"),

    # ===== 6. Safety KPI (5 cases) =====
    ("安全事故率查询", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "REPORT_TRENDS", None], "safety_kpi"),
    ("工伤频率统计", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "ATTENDANCE_STATS", "HR_EMPLOYEE_LIST", None], "safety_kpi"),
    ("安全培训率多少", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_STATS", "HR_EMPLOYEE_LIST", None], "safety_kpi"),
    ("安全检查合格率", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_QUALITY", "QUALITY_STATS", "ALERT_LIST", None], "safety_kpi"),
    ("隐患整改率查询", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "REPORT_TRENDS", None], "safety_kpi"),

    # ===== 7. Inventory KPI (6 cases) =====
    ("库存周转率是多少", ["REPORT_KPI", "REPORT_INVENTORY", "REPORT_TRENDS", "REPORT_FINANCE", None], "inventory_kpi"),
    ("库存准确率查询", ["REPORT_KPI", "REPORT_INVENTORY", "QUALITY_STATS", None], "inventory_kpi"),
    ("呆滞库存占比分析", ["REPORT_KPI", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "ALERT_LIST", "REPORT_TRENDS", None], "inventory_kpi"),
    ("缺货率统计", ["REPORT_KPI", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "ALERT_LIST", "REPORT_TRENDS", None], "inventory_kpi"),
    ("安全库存达成情况", ["REPORT_KPI", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "ALERT_LIST", None], "inventory_kpi"),
    ("库龄分析报告", ["REPORT_KPI", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "REPORT_TRENDS", None], "inventory_kpi"),

    # ===== 8. HR KPI (5 cases) =====
    ("出勤率查看", ["REPORT_KPI", "ATTENDANCE_STATS", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "hr_kpi"),
    ("离职率是多少", ["REPORT_KPI", "ATTENDANCE_STATS", "HR_EMPLOYEE_LIST", "REPORT_TRENDS", "HR_EMPLOYEE_DELETE", None], "hr_kpi"),
    ("培训合格率统计", ["REPORT_KPI", "ATTENDANCE_STATS", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_STATS", None], "hr_kpi"),
    ("人员满编率查询", ["REPORT_KPI", "ATTENDANCE_STATS", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "hr_kpi"),
    ("加班率分析", ["REPORT_KPI", "ATTENDANCE_STATS", "HR_EMPLOYEE_LIST", "REPORT_TRENDS", "COST_QUERY", None], "hr_kpi"),

    # ===== 9. Environmental KPI (6 cases) =====
    ("能耗指标查询", ["REPORT_KPI", "REPORT_EFFICIENCY", "COST_QUERY", "REPORT_TRENDS", "REPORT_FINANCE", None], "environmental_kpi"),
    ("水耗指标统计", ["REPORT_KPI", "REPORT_EFFICIENCY", "COST_QUERY", "REPORT_TRENDS", None], "environmental_kpi"),
    ("废弃物产生率分析", ["REPORT_KPI", "REPORT_EFFICIENCY", "REPORT_QUALITY", "REPORT_TRENDS", "ALERT_LIST", None], "environmental_kpi"),
    ("回收利用率多少", ["REPORT_KPI", "REPORT_EFFICIENCY", "REPORT_QUALITY", "MATERIAL_BATCH_QUERY", None], "environmental_kpi"),
    ("碳排放量查询", ["REPORT_KPI", "REPORT_EFFICIENCY", "COST_QUERY", "REPORT_TRENDS", None], "environmental_kpi"),
    ("环保达标率分析", ["REPORT_KPI", "REPORT_EFFICIENCY", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "environmental_kpi"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 98 ===")
    print(f"Focus: KPI & PERFORMANCE METRICS queries")
    print(f"       (production_kpi, quality_kpi, delivery_kpi, cost_kpi,")
    print(f"        efficiency_kpi, safety_kpi, inventory_kpi, hr_kpi, environmental_kpi)")
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
        'test': 'v5_round98_kpi_performance_metrics',
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
    report_path = f'tests/ai-intent/reports/v5_round98_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
