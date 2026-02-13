#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 47
Focus: ATTENDANCE & WORKFORCE DETAIL queries.
       Covers clock in/out, leave management, overtime, shift schedule,
       department stats, performance, training, worker assignment, and payroll.
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

# Round 47 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Clock In/Out (6 cases) =====
    ("打卡记录", ["ATTENDANCE_TODAY", "ATTENDANCE_HISTORY", "ATTENDANCE_STATS", None], "clock_in_out"),
    ("今天谁没打卡", ["ATTENDANCE_TODAY", "ATTENDANCE_ANOMALY", "ATTENDANCE_DEPARTMENT", None], "clock_in_out"),
    ("迟到了谁", ["ATTENDANCE_ANOMALY", "ATTENDANCE_TODAY", "ATTENDANCE_STATS", "ATTENDANCE_HISTORY", None], "clock_in_out"),
    ("早退记录", ["ATTENDANCE_ANOMALY", "ATTENDANCE_HISTORY", "ATTENDANCE_STATS", None], "clock_in_out"),
    ("补卡申请", ["ATTENDANCE_ANOMALY", "ATTENDANCE_TODAY", None], "clock_in_out"),
    ("打卡异常", ["ATTENDANCE_ANOMALY", "ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "clock_in_out"),

    # ===== 2. Leave Management (6 cases) =====
    ("请假申请", ["ATTENDANCE_TODAY", "ATTENDANCE_ANOMALY", None], "leave_management"),
    ("请假审批", ["ATTENDANCE_TODAY", "ATTENDANCE_ANOMALY", None], "leave_management"),
    ("年假余额", ["ATTENDANCE_STATS", "ATTENDANCE_HISTORY", None], "leave_management"),
    ("病假记录", ["ATTENDANCE_HISTORY", "ATTENDANCE_STATS", None], "leave_management"),
    ("事假统计", ["ATTENDANCE_STATS", "ATTENDANCE_HISTORY", "ATTENDANCE_MONTHLY", "REPORT_DASHBOARD_OVERVIEW", None], "leave_management"),
    ("调休申请", ["ATTENDANCE_TODAY", "ATTENDANCE_ANOMALY", None], "leave_management"),

    # ===== 3. Overtime (5 cases) =====
    ("加班申请", ["ATTENDANCE_TODAY", "ATTENDANCE_HISTORY", None], "overtime"),
    ("加班统计", ["ATTENDANCE_STATS", "ATTENDANCE_MONTHLY", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "overtime"),
    ("加班费计算", ["REPORT_FINANCE", "ATTENDANCE_STATS", None], "overtime"),
    ("加班审批", ["ATTENDANCE_TODAY", None], "overtime"),
    ("强制加班提醒", ["ATTENDANCE_ANOMALY", "ATTENDANCE_TODAY", None], "overtime"),

    # ===== 4. Shift Schedule (6 cases) =====
    ("排班表", ["ATTENDANCE_TODAY", "ATTENDANCE_DEPARTMENT", "PROCESSING_WORKER_ASSIGN", "ATTENDANCE_HISTORY", None], "shift_schedule"),
    ("换班申请", ["ATTENDANCE_TODAY", "PROCESSING_WORKER_ASSIGN", None], "shift_schedule"),
    ("值班安排", ["ATTENDANCE_TODAY", "ATTENDANCE_DEPARTMENT", "PROCESSING_WORKER_ASSIGN", None], "shift_schedule"),
    ("夜班人员", ["ATTENDANCE_TODAY", "ATTENDANCE_DEPARTMENT", "PROCESSING_WORKER_ASSIGN", None], "shift_schedule"),
    ("轮班制度", ["ATTENDANCE_STATS", "ATTENDANCE_DEPARTMENT", None], "shift_schedule"),
    ("倒班记录", ["ATTENDANCE_HISTORY", "ATTENDANCE_STATS", "PROCESSING_WORKER_ASSIGN", None], "shift_schedule"),

    # ===== 5. Department Stats (6 cases) =====
    ("部门出勤率", ["ATTENDANCE_DEPARTMENT", "ATTENDANCE_STATS", "ATTENDANCE_MONTHLY", None], "department_stats"),
    ("各车间人员", ["ATTENDANCE_DEPARTMENT", "PRODUCTION_STATUS_QUERY", "PROCESSING_WORKER_ASSIGN", "PROCESSING_BATCH_WORKERS", None], "department_stats"),
    ("班组人数", ["ATTENDANCE_DEPARTMENT", "ATTENDANCE_TODAY", "PROCESSING_WORKER_ASSIGN", None], "department_stats"),
    ("岗位分布", ["ATTENDANCE_DEPARTMENT", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "department_stats"),
    ("人员配置", ["ATTENDANCE_DEPARTMENT", "PROCESSING_WORKER_ASSIGN", "PRODUCTION_STATUS_QUERY", None], "department_stats"),
    ("缺员情况", ["ATTENDANCE_DEPARTMENT", "ATTENDANCE_ANOMALY", "ATTENDANCE_TODAY", None], "department_stats"),

    # ===== 6. Performance (5 cases) =====
    ("绩效评价", ["REPORT_KPI", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", None], "performance"),
    ("工作量统计", ["REPORT_EFFICIENCY", "ATTENDANCE_STATS", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "performance"),
    ("产量考核", ["REPORT_KPI", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None], "performance"),
    ("技能评级", ["REPORT_KPI", "ATTENDANCE_STATS", None], "performance"),
    ("优秀员工", ["REPORT_KPI", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", None], "performance"),

    # ===== 7. Training (5 cases) =====
    ("培训计划", ["ATTENDANCE_STATS", "ATTENDANCE_DEPARTMENT", None], "training"),
    ("培训记录", ["ATTENDANCE_HISTORY", "ATTENDANCE_STATS", None], "training"),
    ("新人培训", ["ATTENDANCE_STATS", "PROCESSING_WORKER_ASSIGN", None], "training"),
    ("技能培训", ["ATTENDANCE_STATS", None], "training"),
    ("安全培训", ["ATTENDANCE_STATS", None], "training"),

    # ===== 8. Worker Assignment (6 cases) =====
    ("人员调配", ["PROCESSING_WORKER_ASSIGN", "ATTENDANCE_DEPARTMENT", None], "worker_assignment"),
    ("临时借调", ["PROCESSING_WORKER_ASSIGN", "ATTENDANCE_DEPARTMENT", None], "worker_assignment"),
    ("岗位调整", ["PROCESSING_WORKER_ASSIGN", "ATTENDANCE_DEPARTMENT", None], "worker_assignment"),
    ("新员工分配", ["PROCESSING_WORKER_ASSIGN", "ATTENDANCE_DEPARTMENT", "PROCESSING_WORKER_CHECKOUT", None], "worker_assignment"),
    ("产线人员安排", ["PROCESSING_WORKER_ASSIGN", "PRODUCTION_STATUS_QUERY", "ATTENDANCE_DEPARTMENT", "PROCESSING_BATCH_CREATE", None], "worker_assignment"),
    ("支援其他车间", ["PROCESSING_WORKER_ASSIGN", "PROCESSING_WORKER_CHECKOUT", "ATTENDANCE_DEPARTMENT", None], "worker_assignment"),

    # ===== 9. Payroll (5 cases) =====
    ("工资计算", ["REPORT_FINANCE", "ATTENDANCE_STATS", None], "payroll"),
    ("计件工资", ["REPORT_FINANCE", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", None], "payroll"),
    ("绩效奖金", ["REPORT_FINANCE", "REPORT_KPI", "ATTENDANCE_STATS", None], "payroll"),
    ("工时统计", ["ATTENDANCE_STATS", "ATTENDANCE_MONTHLY", "REPORT_EFFICIENCY", None], "payroll"),
    ("薪资报表", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_STATS", None], "payroll"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 47 ===")
    print(f"Focus: ATTENDANCE & WORKFORCE DETAIL queries")
    print(f"       (clock in/out, leave, overtime, shift schedule,")
    print(f"        department stats, performance, training, worker assignment, payroll)")
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
        'test': 'v5_round47_attendance_workforce',
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
    report_path = f'tests/ai-intent/reports/v5_round47_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
