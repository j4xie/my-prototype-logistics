#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 19
Focus: HR & WORKFORCE MANAGEMENT - attendance tracking, scheduling/shifts,
       labor allocation, performance/output, leave management, training,
       wage/compensation, safety/compliance, team management.
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

# Round 19 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Attendance Tracking (6 cases) =====
    ("今天出勤情况怎么样", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS"], "attendance-today"),
    ("今天有谁迟到了", ["ATTENDANCE_ANOMALY", "ATTENDANCE_TODAY", "ATTENDANCE_STATS"], "attendance-late"),
    ("今天有早退的吗", ["ATTENDANCE_ANOMALY", "ATTENDANCE_TODAY", "ATTENDANCE_STATS"], "attendance-earlyout"),
    ("今天缺勤人员名单", ["ATTENDANCE_ANOMALY", "ATTENDANCE_TODAY", "ATTENDANCE_STATS"], "attendance-absent"),
    ("本月车间出勤率是多少", ["ATTENDANCE_STATS", "ATTENDANCE_MONTHLY", "REPORT_EFFICIENCY"], "attendance-rate"),
    ("查一下今天的打卡记录", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS"], "attendance-clock"),

    # ===== 2. Scheduling / Shifts (6 cases) =====
    ("这周的排班表", ["ATTENDANCE_STATS", "ATTENDANCE_MONTHLY", "REPORT_EFFICIENCY", "ATTENDANCE_HISTORY", None], "scheduling-roster"),
    ("张伟想跟李明换班", ["ATTENDANCE_STATS", "ATTENDANCE_ANOMALY", None], "scheduling-swap"),
    ("有人提交加班申请了吗", ["ATTENDANCE_STATS", "ATTENDANCE_ANOMALY", None], "scheduling-overtime"),
    ("今晚夜班有哪些人", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "scheduling-nightshift"),
    ("春节放假怎么安排的", ["ATTENDANCE_MONTHLY", "ATTENDANCE_STATS", None], "scheduling-holiday"),
    ("调休申请审批进度", ["ATTENDANCE_STATS", "ATTENDANCE_ANOMALY", None], "scheduling-compoff"),

    # ===== 3. Labor Allocation (6 cases) =====
    ("今天各产线人员分配", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "PROCESSING_WORKER_ASSIGN"], "labor-assign"),
    ("A线工位安排情况", ["ATTENDANCE_STATS", "PRODUCTION_STATUS_QUERY", "REPORT_EFFICIENCY", None], "labor-station"),
    ("包装车间临时调配两个人过去", ["ATTENDANCE_STATS", "REPORT_EFFICIENCY", "PROCESSING_BATCH_LIST", None], "labor-temp"),
    ("B线人手不够怎么办", ["ATTENDANCE_STATS", "ATTENDANCE_ANOMALY", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", None], "labor-shortage"),
    ("今天哪些岗位缺人", ["ATTENDANCE_ANOMALY", "ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "labor-vacancy"),
    ("质检岗需要补岗吗", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", "QUALITY_CHECK_QUERY", None], "labor-backfill"),

    # ===== 4. Performance & Output (5 cases) =====
    ("今天计件统计结果", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW"], "perf-piecework"),
    ("各工人今天产量排名", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY"], "perf-worker-output"),
    ("王芳这个月个人绩效怎么样", ["REPORT_EFFICIENCY", "ATTENDANCE_STATS", "REPORT_PRODUCTION", "REPORT_KPI", None], "perf-individual"),
    ("一班组和二班组绩效对比", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_KPI", None], "perf-team"),
    ("本周效率排名前五", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "ATTENDANCE_STATS"], "perf-ranking"),

    # ===== 5. Leave Management (5 cases) =====
    ("有几个请假审批待处理", ["ATTENDANCE_ANOMALY", "ATTENDANCE_STATS", None], "leave-approval"),
    ("我还有多少天年假", ["ATTENDANCE_STATS", "ATTENDANCE_MONTHLY", "REPORT_INVENTORY", None], "leave-annual"),
    ("今天有谁请了病假", ["ATTENDANCE_ANOMALY", "ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "leave-sick"),
    ("这周事假的人多吗", ["ATTENDANCE_STATS", "ATTENDANCE_ANOMALY", "ATTENDANCE_MONTHLY", None], "leave-personal"),
    ("查看本月请假记录汇总", ["ATTENDANCE_MONTHLY", "ATTENDANCE_STATS", "ATTENDANCE_ANOMALY", None], "leave-records"),

    # ===== 6. Training & Certification (5 cases) =====
    ("下周有什么培训计划", ["REPORT_EFFICIENCY", "ATTENDANCE_STATS", None], "training-plan"),
    ("安全培训完成率多少", ["REPORT_EFFICIENCY", "ATTENDANCE_STATS", None], "training-safety"),
    ("有操作证快到期的员工吗", ["REPORT_EFFICIENCY", "ALERT_LIST", "ATTENDANCE_ANOMALY", "MATERIAL_EXPIRING_ALERT", None], "training-cert-expiry"),
    ("新员工入职培训安排", ["REPORT_EFFICIENCY", "ATTENDANCE_STATS", None], "training-onboard"),
    ("上个月技能考核通过率", ["REPORT_EFFICIENCY", "ATTENDANCE_STATS", "REPORT_KPI", None], "training-exam"),

    # ===== 7. Wage & Compensation (5 cases) =====
    ("这个月工资核算好了吗", ["REPORT_FINANCE", "REPORT_EFFICIENCY", None], "wage-calc"),
    ("上个月加班费总额多少", ["REPORT_FINANCE", "ATTENDANCE_STATS", "ATTENDANCE_MONTHLY", None], "wage-overtime"),
    ("计件工资怎么算的", ["REPORT_FINANCE", "REPORT_EFFICIENCY", None], "wage-piecework"),
    ("导出本月薪资报表", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "wage-report"),
    ("社保缴纳情况查询", [None, "REPORT_FINANCE"], "wage-social"),

    # ===== 8. Safety & Compliance (6 cases) =====
    ("今天安全检查有问题吗", ["ALERT_LIST", "ALERT_ACTIVE", "QUALITY_CHECK_QUERY", None], "safety-inspection"),
    ("劳保用品还够不够", ["MATERIAL_BATCH_QUERY", "MATERIAL_LOW_STOCK_ALERT", "REPORT_INVENTORY", None], "safety-ppe-stock"),
    ("这个月有工伤记录吗", ["ALERT_LIST", "ALERT_STATS", "ATTENDANCE_ANOMALY", None], "safety-injury"),
    ("哪些人安全培训快到期了", ["ALERT_LIST", "REPORT_EFFICIENCY", "ATTENDANCE_ANOMALY", None], "safety-training-expiry"),
    ("防护装备领用情况", ["MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CONSUME", "REPORT_INVENTORY", None], "safety-equipment"),
    ("车间有安全隐患需要处理吗", ["ALERT_LIST", "ALERT_ACTIVE", "ALERT_STATS", None], "safety-hazard"),

    # ===== 9. Team Management (6 cases) =====
    ("一班组现在多少人", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "team-headcount"),
    ("今天谁在岗", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW"], "team-whoishere"),
    ("A线组长是谁", ["ATTENDANCE_STATS", "REPORT_EFFICIENCY", None], "team-leader"),
    ("现在该交接班了吗", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", "PRODUCTION_STATUS_QUERY", None], "team-handover"),
    ("帮我看一下今天班组日报", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY"], "team-dailyreport"),
    ("这周新来了几个员工", ["ATTENDANCE_STATS", "ATTENDANCE_MONTHLY", None], "team-newstaff"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 19 ===")
    print(f"Focus: HR & WORKFORCE MANAGEMENT - attendance, scheduling, labor,")
    print(f"       performance, leave, training, wage, safety, team management")
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
        'test': 'v5_round19_hr_workforce_management',
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
    report_path = f'tests/ai-intent/reports/v5_round19_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
