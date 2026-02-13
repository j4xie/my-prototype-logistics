#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 27
Focus: TIME-BASED & SCHEDULING QUERIES - queries with various time expressions,
       scheduling, planning, deadlines, forecasting, recurring/periodic reports.
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

# Round 27 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Today Queries (6 cases) =====
    ("今天的产量是多少", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None], "today-production"),
    ("今天有没有人缺勤", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", "ATTENDANCE_ANOMALY", None], "today-attendance"),
    ("今天到货的物料有哪些", ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", None], "today-arrival"),
    ("今天有哪些发货单", ["SHIPMENT_QUERY", "ORDER_LIST", "ORDER_STATUS", "SHIPMENT_BY_DATE", None], "today-shipment"),
    ("今天质检情况怎么样", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "today-quality"),
    ("今天的订单数量", ["ORDER_LIST", "ORDER_STATUS", "REPORT_FINANCE", "ORDER_TODAY", None], "today-orders"),

    # ===== 2. This Week/Month (6 cases) =====
    ("本周的产量统计", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_TRENDS", None], "thisperiod-week-production"),
    ("这个月销售额多少", ["REPORT_FINANCE", "REPORT_KPI", "ORDER_LIST", None], "thisperiod-month-sales"),
    ("这周的排班表", ["ATTENDANCE_STATS", "ATTENDANCE_MONTHLY", "ATTENDANCE_HISTORY", None], "thisperiod-week-schedule"),
    ("本月质量合格率", ["QUALITY_STATS", "REPORT_QUALITY", "QUALITY_CHECK_QUERY", None], "thisperiod-month-quality"),
    ("本周库存变动", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", None], "thisperiod-week-inventory"),
    ("本月的生产成本", ["REPORT_FINANCE", "REPORT_KPI", "REPORT_PRODUCTION", "COST_QUERY", None], "thisperiod-month-cost"),

    # ===== 3. Yesterday/Last Period (5 cases) =====
    ("昨天的产量数据", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None], "lastperiod-yesterday-production"),
    ("上周的报表给我看下", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_TRENDS", None], "lastperiod-last-week-report"),
    ("上个月的质量报告", ["REPORT_QUALITY", "QUALITY_STATS", None], "lastperiod-last-month-quality"),
    ("昨天有什么告警", ["ALERT_LIST", None], "lastperiod-yesterday-alerts"),
    ("去年同期的产量对比", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_KPI", None], "lastperiod-yoy"),

    # ===== 4. Future Planning (6 cases) =====
    ("明天的生产计划是什么", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", None], "future-tomorrow-plan"),
    ("下周的排产安排", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_CREATE", None], "future-next-week-schedule"),
    ("下个月的销售目标", ["REPORT_FINANCE", "REPORT_KPI", None], "future-next-month-target"),
    ("明天有哪些要发货的", ["SHIPMENT_QUERY", "ORDER_LIST", "ORDER_STATUS", "SHIPMENT_BY_DATE", None], "future-tomorrow-shipment"),
    ("下周设备维护计划", ["EQUIPMENT_MAINTENANCE", None], "future-next-week-maintenance"),
    ("下个月的采购计划", ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", None], "future-next-month-procurement"),

    # ===== 5. Specific Dates (5 cases) =====
    ("2月1号的数据", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_TRENDS", None], "specificdate-feb1"),
    ("春节前后的出勤率", ["ATTENDANCE_STATS", "ATTENDANCE_MONTHLY", None], "specificdate-spring-festival"),
    ("月底之前要完成的订单", ["ORDER_LIST", "ORDER_STATUS", "ORDER_UPDATE", None], "specificdate-month-end"),
    ("年初到现在的总产量", ["REPORT_PRODUCTION", "REPORT_TRENDS", "PRODUCTION_STATUS_QUERY", None], "specificdate-ytd"),
    ("第一季度的财务数据", ["REPORT_FINANCE", "REPORT_KPI", "REPORT_TRENDS", None], "specificdate-q1"),

    # ===== 6. Duration Queries (5 cases) =====
    ("最近一周的质检记录", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", None], "duration-recent-week"),
    ("过去三天的异常情况", ["ALERT_LIST", "QUALITY_CHECK_QUERY", None], "duration-past-3days"),
    ("近30天的销售趋势", ["REPORT_TRENDS", "REPORT_FINANCE", "REPORT_KPI", None], "duration-30days"),
    ("半年内的设备故障记录", ["EQUIPMENT_MAINTENANCE", "ALERT_LIST", "EQUIPMENT_ALERT_LIST", None], "duration-half-year"),
    ("最近一个月的库存周转", ["REPORT_INVENTORY", "REPORT_TRENDS", "MATERIAL_BATCH_QUERY", None], "duration-month-turnover"),

    # ===== 7. Deadline/Urgency (6 cases) =====
    ("有哪些物料快到期了", ["MATERIAL_EXPIRING_ALERT", "MATERIAL_BATCH_QUERY", "ALERT_LIST", None], "deadline-expiring"),
    ("马上要发货的订单", ["SHIPMENT_QUERY", "ORDER_LIST", "ORDER_STATUS", None], "deadline-urgent-shipment"),
    ("赶紧处理一下告警", ["ALERT_LIST", "ALERT_ACKNOWLEDGE", None], "deadline-handle-alert"),
    ("紧急的质检问题", ["QUALITY_CHECK_QUERY", "ALERT_LIST", None], "deadline-urgent-quality"),
    ("今天必须完成的生产任务", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_COMPLETE", None], "deadline-today-must-finish"),
    ("快到交期的订单有哪些", ["ORDER_LIST", "ORDER_STATUS", "SHIPMENT_QUERY", None], "deadline-approaching"),

    # ===== 8. Comparison Time (5 cases) =====
    ("今天比昨天产量怎么样", ["REPORT_TRENDS", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None], "comparison-today-vs-yesterday"),
    ("本月销售额同比增长多少", ["REPORT_TRENDS", "REPORT_FINANCE", "REPORT_KPI", None], "comparison-yoy-sales"),
    ("产量环比变化", ["REPORT_TRENDS", "REPORT_PRODUCTION", None], "comparison-mom"),
    ("和去年同期比质量合格率", ["REPORT_TRENDS", "REPORT_QUALITY", "QUALITY_STATS", None], "comparison-yoy-quality"),
    ("上半年和下半年的成本对比", ["REPORT_TRENDS", "REPORT_FINANCE", "REPORT_KPI", None], "comparison-h1-vs-h2"),

    # ===== 9. Recurring/Periodic (6 cases) =====
    ("每天的产量汇总", ["REPORT_PRODUCTION", "REPORT_TRENDS", "PRODUCTION_STATUS_QUERY", None], "recurring-daily-production"),
    ("每周的工作总结", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "REPORT_KPI", None], "recurring-weekly-summary"),
    ("每月盘点情况", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", None], "recurring-monthly-inventory"),
    ("给我生成今天的日报", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "recurring-daily-report"),
    ("本周的周报数据", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "REPORT_PRODUCTION", None], "recurring-weekly-report"),
    ("本月的月报汇总", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "REPORT_FINANCE", None], "recurring-monthly-report"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 27 ===")
    print(f"Focus: TIME-BASED & SCHEDULING QUERIES - time expressions, scheduling,")
    print(f"       planning, deadlines, forecasting, recurring/periodic reports")
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
        'test': 'v5_round27_time_based_scheduling',
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
    report_path = f'tests/ai-intent/reports/v5_round27_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
