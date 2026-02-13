#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 84
Focus: SEASONAL & CALENDAR-BASED queries for food manufacturing.
       Covers holiday_plan, seasonal_demand, year_end, monthly_close,
       weekly_plan, daily_ops, quarter_review, shift_schedule, deadline_track.
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

# Round 84 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Holiday Plan (6 cases) =====
    ("春节排产计划怎么安排", ["SCHEDULING_AUTO", "SCHEDULING_SET_MANUAL", "PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "holiday_plan"),
    ("节假日生产安排查询", ["SCHEDULING_AUTO", "SCHEDULING_SET_MANUAL", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_CREATE", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "holiday_plan"),
    ("发一下放假通知", ["REPORT_DASHBOARD_OVERVIEW", "HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "FACTORY_NOTIFICATION_CONFIG", None], "holiday_plan"),
    ("春节加班怎么安排的", ["SCHEDULING_SET_MANUAL", "SCHEDULING_AUTO", "ATTENDANCE_STATS", "ATTENDANCE_MONTHLY", "REPORT_DASHBOARD_OVERVIEW", None], "holiday_plan"),
    ("节前备货量是多少", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "holiday_plan"),
    ("年终盘点什么时候开始", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "holiday_plan"),

    # ===== 2. Seasonal Demand (5 cases) =====
    ("旺季备货计划", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_CREATE", "SCHEDULING_AUTO", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "seasonal_demand"),
    ("淡季产能怎么调整", ["SCHEDULING_AUTO", "SCHEDULING_SET_MANUAL", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "seasonal_demand"),
    ("季节性产品排产安排", ["SCHEDULING_AUTO", "SCHEDULING_SET_MANUAL", "PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "seasonal_demand"),
    ("应季生产任务有哪些", ["PROCESSING_BATCH_LIST", "SCHEDULING_AUTO", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "seasonal_demand"),
    ("换季清仓库存情况", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "seasonal_demand"),

    # ===== 3. Year End (6 cases) =====
    ("年度生产总结", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "REPORT_KPI", None], "year_end"),
    ("年度报表生成", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_FINANCE", "REPORT_KPI", None], "year_end"),
    ("年终考核数据", ["REPORT_KPI", "ATTENDANCE_STATS", "ATTENDANCE_MONTHLY", "REPORT_DASHBOARD_OVERVIEW", "HR_EMPLOYEE_LIST", None], "year_end"),
    ("明年的年度预算", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "year_end"),
    ("今年年度目标完成了多少", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_TRENDS", None], "year_end"),
    ("来年生产计划怎么定", ["SCHEDULING_AUTO", "SCHEDULING_SET_MANUAL", "PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "year_end"),

    # ===== 4. Monthly Close (5 cases) =====
    ("这个月月结数据出了吗", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_KPI", "ATTENDANCE_MONTHLY", None], "monthly_close"),
    ("月度盘点结果", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "monthly_close"),
    ("月报生成了没", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "REPORT_FINANCE", None], "monthly_close"),
    ("月度考勤汇总数据", ["ATTENDANCE_MONTHLY", "ATTENDANCE_HISTORY", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "HR_EMPLOYEE_LIST", None], "monthly_close"),
    ("月末对账情况", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "monthly_close"),

    # ===== 5. Weekly Plan (6 cases) =====
    ("本周生产周计划", ["SCHEDULING_AUTO", "SCHEDULING_SET_MANUAL", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "weekly_plan"),
    ("本周排产安排是什么", ["SCHEDULING_AUTO", "SCHEDULING_SET_MANUAL", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_CREATE", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "weekly_plan"),
    ("周会安排在什么时候", ["REPORT_DASHBOARD_OVERVIEW", "SCHEDULING_SET_MANUAL", None], "weekly_plan"),
    ("周报提交了吗", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "weekly_plan"),
    ("下周排产计划", ["SCHEDULING_AUTO", "SCHEDULING_SET_MANUAL", "PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "weekly_plan"),
    ("每周例会纪要", ["REPORT_DASHBOARD_OVERVIEW", None], "weekly_plan"),

    # ===== 6. Daily Ops (5 cases) =====
    ("今日生产计划", ["PROCESSING_BATCH_LIST", "SCHEDULING_AUTO", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "daily_ops"),
    ("今天的日报", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "daily_ops"),
    ("早会内容准备", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "daily_ops"),
    ("交班记录查一下", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_STATS", "ATTENDANCE_HISTORY", "ATTENDANCE_TODAY", None], "daily_ops"),
    ("每日巡检情况", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "daily_ops"),

    # ===== 7. Quarter Review (6 cases) =====
    ("季度生产总结", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "REPORT_KPI", None], "quarter_review"),
    ("季度绩效考核", ["REPORT_KPI", "ATTENDANCE_STATS", "ATTENDANCE_MONTHLY", "REPORT_DASHBOARD_OVERVIEW", "HR_EMPLOYEE_LIST", None], "quarter_review"),
    ("Q1业绩数据", ["REPORT_KPI", "REPORT_PRODUCTION", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "quarter_review"),
    ("下季度预测怎么样", ["REPORT_TRENDS", "REPORT_KPI", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "quarter_review"),
    ("季度目标完成率多少", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_TRENDS", None], "quarter_review"),
    ("季度环比数据对比", ["REPORT_TRENDS", "REPORT_KPI", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "quarter_review"),

    # ===== 8. Shift Schedule (5 cases) =====
    ("倒班排班表", ["SCHEDULING_AUTO", "SCHEDULING_SET_MANUAL", "ATTENDANCE_STATS", "ATTENDANCE_HISTORY", "ATTENDANCE_TODAY", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "shift_schedule"),
    ("白班夜班人员安排", ["SCHEDULING_SET_MANUAL", "SCHEDULING_AUTO", "HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "shift_schedule"),
    ("三班倒怎么排的", ["SCHEDULING_AUTO", "SCHEDULING_SET_MANUAL", "HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "shift_schedule"),
    ("加班申请记录", ["ATTENDANCE_STATS", "ATTENDANCE_HISTORY", "ATTENDANCE_MONTHLY", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "shift_schedule"),
    ("调休安排查询", ["ATTENDANCE_STATS", "ATTENDANCE_MONTHLY", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "shift_schedule"),

    # ===== 9. Deadline Track (6 cases) =====
    ("交期跟踪情况", ["SHIPMENT_QUERY", "ORDER_LIST", "MATERIAL_EXPIRING_ALERT", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "deadline_track"),
    ("快到期的提醒有哪些", ["MATERIAL_EXPIRING_ALERT", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "deadline_track"),
    ("截止日期快到了的任务", ["ALERT_LIST", "PROCESSING_BATCH_LIST", "SHIPMENT_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "deadline_track"),
    ("逾期订单有多少", ["ORDER_LIST", "SHIPMENT_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "deadline_track"),
    ("合同到期提醒", ["ALERT_LIST", "MATERIAL_EXPIRING_ALERT", "REPORT_DASHBOARD_OVERVIEW", None], "deadline_track"),
    ("资质到期的供应商", ["MATERIAL_EXPIRING_ALERT", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "deadline_track"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 84 ===")
    print(f"Focus: SEASONAL & CALENDAR-BASED queries for food manufacturing")
    print(f"       (holiday_plan, seasonal_demand, year_end, monthly_close,")
    print(f"        weekly_plan, daily_ops, quarter_review, shift_schedule, deadline_track)")
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
        'test': 'v5_round84_seasonal_calendar_based',
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
    report_path = f'tests/ai-intent/reports/v5_round84_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
