#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 59
Focus: TIME-BASED & PERIOD QUERIES for food manufacturing.
       Covers today, week, month, quarter, year, realtime, shift,
       deadline, and historical queries.
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

# Round 59 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Today Queries (6 cases) =====
    ("今天产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None], "today_queries"),
    ("今日出勤", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "today_queries"),
    ("当天质检", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "today_queries"),
    ("今天发货", ["SHIPMENT_QUERY", "ORDER_LIST", "SHIPMENT_BY_DATE", None], "today_queries"),
    ("今日库存", ["INVENTORY_QUERY", "INVENTORY_CHECK", "REPORT_INVENTORY", None], "today_queries"),
    ("今天订单", ["ORDER_LIST", "SHIPMENT_QUERY", "ORDER_TODAY", None], "today_queries"),

    # ===== 2. Week Queries (6 cases) =====
    ("本周产量", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "week_queries"),
    ("这周排班", ["SCHEDULING_SET_MANUAL", "SCHEDULING_QUERY", "ATTENDANCE_STATS", None], "week_queries"),
    ("本周质量", ["REPORT_QUALITY", "QUALITY_CHECK_QUERY", None], "week_queries"),
    ("周报汇总", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_TRENDS", None], "week_queries"),
    ("本周销售", ["REPORT_FINANCE", "REPORT_TRENDS", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "week_queries"),
    ("一周回顾", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "week_queries"),

    # ===== 3. Month Queries (6 cases) =====
    ("本月统计", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "month_queries"),
    ("月度报告", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_TRENDS", "ATTENDANCE_MONTHLY", None], "month_queries"),
    ("上月对比", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "month_queries"),
    ("月产量", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "month_queries"),
    ("月度考勤", ["ATTENDANCE_STATS", "ATTENDANCE_TODAY", "REPORT_DASHBOARD_OVERVIEW", None], "month_queries"),
    ("月成本", ["COST_QUERY", "REPORT_FINANCE", "REPORT_TRENDS", None], "month_queries"),

    # ===== 4. Quarter Queries (5 cases) =====
    ("季度总结", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "REPORT_PRODUCTION", None], "quarter_queries"),
    ("Q1业绩", ["REPORT_TRENDS", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "quarter_queries"),
    ("季度对比", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_FINANCE", None], "quarter_queries"),
    ("季度分析", ["REPORT_FINANCE", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_MONTHLY", None], "quarter_queries"),
    ("本季度目标", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "quarter_queries"),

    # ===== 5. Year Queries (5 cases) =====
    ("年度报告", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "REPORT_PRODUCTION", None], "year_queries"),
    ("全年汇总", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "year_queries"),
    ("年产量", ["REPORT_PRODUCTION", "REPORT_TRENDS", "PRODUCTION_STATUS_QUERY", None], "year_queries"),
    ("去年同期", ["REPORT_FINANCE", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "year_queries"),
    ("年度目标", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "year_queries"),

    # ===== 6. Realtime (6 cases) =====
    ("实时产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None], "realtime"),
    ("当前状态", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None], "realtime"),
    ("现在库存", ["INVENTORY_QUERY", "INVENTORY_CHECK", "REPORT_INVENTORY", None], "realtime"),
    ("实时告警", ["ALERT_ACTIVE", "ALERT_LIST", None], "realtime"),
    ("在线设备", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "EQUIPMENT_STATS", None], "realtime"),
    ("当前进度", ["PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "realtime"),

    # ===== 7. Shift Queries (5 cases) =====
    ("早班产量", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "shift_queries"),
    ("夜班考勤", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "shift_queries"),
    ("白班质检", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", None], "shift_queries"),
    ("倒班记录", ["ATTENDANCE_STATS", "ATTENDANCE_TODAY", "SCHEDULING_QUERY", None], "shift_queries"),
    ("交接班", ["PRODUCTION_STATUS_QUERY", "ATTENDANCE_TODAY", "SCHEDULING_QUERY", None], "shift_queries"),

    # ===== 8. Deadline (6 cases) =====
    ("截止日期", ["MATERIAL_EXPIRING_ALERT", "ORDER_LIST", "SHIPMENT_QUERY", None], "deadline"),
    ("交货期限", ["ORDER_LIST", "SHIPMENT_QUERY", "MATERIAL_EXPIRING_ALERT", "MATERIAL_BATCH_QUERY", None], "deadline"),
    ("到期提醒", ["MATERIAL_EXPIRING_ALERT", "ALERT_LIST", "ALERT_ACTIVE", None], "deadline"),
    ("超期订单", ["ORDER_LIST", "SHIPMENT_QUERY", "ALERT_LIST", "PROCESSING_BATCH_LIST", None], "deadline"),
    ("逾期处理", ["ALERT_LIST", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "deadline"),
    ("即将到期", ["MATERIAL_EXPIRING_ALERT", "ALERT_LIST", "ALERT_ACTIVE", None], "deadline"),

    # ===== 9. Historical (5 cases) =====
    ("历史记录", ["TRACE_BATCH", "TRACE_FULL", "REPORT_TRENDS", "PROCESSING_BATCH_TIMELINE", None], "historical"),
    ("过往数据", ["TRACE_FULL", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "historical"),
    ("追溯查询", ["TRACE_BATCH", "TRACE_FULL", None], "historical"),
    ("之前的报告", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "REPORT_PRODUCTION", None], "historical"),
    ("往期对比", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_TIMELINE", None], "historical"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 59 ===")
    print(f"Focus: TIME-BASED & PERIOD QUERIES")
    print(f"       (today, week, month, quarter, year, realtime, shift, deadline, historical)")
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
        'test': 'v5_round59_time_based_period',
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
    report_path = f'tests/ai-intent/reports/v5_round59_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
