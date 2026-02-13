#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 73
Focus: TRAINING & SKILLS MANAGEMENT queries for food manufacturing.
       Covers skill query, training plan, training record, certification,
       assessment, onboarding, safety training, promotion, and team building.
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

# Round 73 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Skill Query (6 cases) =====
    ("员工技能查询", ["HR_EMPLOYEE_LIST", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "skill_query"),
    ("技能矩阵", ["HR_EMPLOYEE_LIST", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "skill_query"),
    ("岗位能力要求", ["HR_EMPLOYEE_LIST", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "skill_query"),
    ("技能等级分布", ["HR_EMPLOYEE_LIST", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "skill_query"),
    ("多技能工有哪些", ["HR_EMPLOYEE_LIST", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "skill_query"),
    ("技能考核情况", ["HR_EMPLOYEE_LIST", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "skill_query"),

    # ===== 2. Training Plan (6 cases) =====
    ("培训计划安排", ["PLAN_UPDATE", "HR_EMPLOYEE_LIST", "SCHEDULING_SET_MANUAL", "REPORT_DASHBOARD_OVERVIEW", None], "training_plan"),
    ("本月培训安排", ["PLAN_UPDATE", "HR_EMPLOYEE_LIST", "SCHEDULING_SET_MANUAL", "REPORT_DASHBOARD_OVERVIEW", None], "training_plan"),
    ("新员工培训计划", ["PLAN_UPDATE", "HR_EMPLOYEE_LIST", "SCHEDULING_SET_MANUAL", "REPORT_DASHBOARD_OVERVIEW", None], "training_plan"),
    ("在职培训怎么安排", ["PLAN_UPDATE", "HR_EMPLOYEE_LIST", "SCHEDULING_SET_MANUAL", "REPORT_DASHBOARD_OVERVIEW", None], "training_plan"),
    ("培训日程表", ["PLAN_UPDATE", "HR_EMPLOYEE_LIST", "SCHEDULING_SET_MANUAL", "REPORT_DASHBOARD_OVERVIEW", None], "training_plan"),
    ("预约培训课程", ["PLAN_UPDATE", "HR_EMPLOYEE_LIST", "SCHEDULING_SET_MANUAL", "REPORT_DASHBOARD_OVERVIEW", None], "training_plan"),

    # ===== 3. Training Record (5 cases) =====
    ("培训记录查询", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_HISTORY", None], "training_record"),
    ("培训历史记录", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_HISTORY", None], "training_record"),
    ("已完成的培训", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_HISTORY", None], "training_record"),
    ("员工培训档案", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_HISTORY", None], "training_record"),
    ("培训参与记录查看", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_HISTORY", None], "training_record"),

    # ===== 4. Certification (6 cases) =====
    ("资格证书查询", ["FOOD_SAFETY_CERT_QUERY", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_EXPIRING_ALERT", None], "certification"),
    ("上岗证办理", ["FOOD_SAFETY_CERT_QUERY", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_EXPIRING_ALERT", "CLOCK_IN", None], "certification"),
    ("持证上岗检查", ["FOOD_SAFETY_CERT_QUERY", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_EXPIRING_ALERT", "CLOCK_IN", None], "certification"),
    ("证书快过期了", ["FOOD_SAFETY_CERT_QUERY", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_EXPIRING_ALERT", None], "certification"),
    ("员工资质查询", ["FOOD_SAFETY_CERT_QUERY", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_EXPIRING_ALERT", None], "certification"),
    ("证书管理系统", ["FOOD_SAFETY_CERT_QUERY", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_EXPIRING_ALERT", None], "certification"),

    # ===== 5. Assessment (5 cases) =====
    ("技能评估结果", ["REPORT_KPI", "REPORT_EFFICIENCY", "HR_EMPLOYEE_LIST", "QUALITY_STATS", None], "assessment"),
    ("考核结果查看", ["REPORT_KPI", "REPORT_EFFICIENCY", "HR_EMPLOYEE_LIST", "QUALITY_STATS", None], "assessment"),
    ("绩效评价报告", ["REPORT_KPI", "REPORT_EFFICIENCY", "HR_EMPLOYEE_LIST", "QUALITY_STATS", None], "assessment"),
    ("能力测试成绩", ["REPORT_KPI", "REPORT_EFFICIENCY", "HR_EMPLOYEE_LIST", "QUALITY_STATS", None], "assessment"),
    ("考试成绩查询", ["REPORT_KPI", "REPORT_EFFICIENCY", "HR_EMPLOYEE_LIST", "QUALITY_STATS", None], "assessment"),

    # ===== 6. Onboarding (6 cases) =====
    ("入职培训流程", ["HR_EMPLOYEE_CREATE", "HR_EMPLOYEE_LIST", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "onboarding"),
    ("新人带教安排", ["HR_EMPLOYEE_CREATE", "HR_EMPLOYEE_LIST", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "TASK_ASSIGN_EMPLOYEE", None], "onboarding"),
    ("入职手续办理", ["HR_EMPLOYEE_CREATE", "HR_EMPLOYEE_LIST", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "CLOCK_IN", None], "onboarding"),
    ("试用期评估", ["HR_EMPLOYEE_CREATE", "HR_EMPLOYEE_LIST", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "onboarding"),
    ("转正评估申请", ["HR_EMPLOYEE_CREATE", "HR_EMPLOYEE_LIST", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_DISPOSITION_EVALUATE", None], "onboarding"),
    ("新员工入职流程", ["HR_EMPLOYEE_CREATE", "HR_EMPLOYEE_LIST", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "onboarding"),

    # ===== 7. Safety Training (5 cases) =====
    ("安全培训记录", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "HR_EMPLOYEE_LIST", None], "safety_training"),
    ("安全教育考核", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "HR_EMPLOYEE_LIST", None], "safety_training"),
    ("安全知识培训", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "HR_EMPLOYEE_LIST", None], "safety_training"),
    ("应急演练安排", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "HR_EMPLOYEE_LIST", None], "safety_training"),
    ("消防培训计划", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "HR_EMPLOYEE_LIST", None], "safety_training"),

    # ===== 8. Promotion (6 cases) =====
    ("晋升评审结果", ["HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", "PLAN_UPDATE", "REPORT_KPI", None], "promotion"),
    ("升职条件查看", ["HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", "PLAN_UPDATE", "REPORT_KPI", None], "promotion"),
    ("职级调整申请", ["HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", "PLAN_UPDATE", "REPORT_KPI", None], "promotion"),
    ("岗位晋升流程", ["HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", "PLAN_UPDATE", "REPORT_KPI", None], "promotion"),
    ("薪资调整审批", ["HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", "PLAN_UPDATE", "REPORT_KPI", None], "promotion"),
    ("加薪申请查看", ["HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", "PLAN_UPDATE", "REPORT_KPI", None], "promotion"),

    # ===== 9. Team Building (5 cases) =====
    ("团队建设活动", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_DEPARTMENT", None], "team_building"),
    ("班组管理情况", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_DEPARTMENT", None], "team_building"),
    ("团队协作评估", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_DEPARTMENT", None], "team_building"),
    ("组织架构查看", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_DEPARTMENT", None], "team_building"),
    ("部门人员情况", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_DEPARTMENT", None], "team_building"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 73 ===")
    print(f"Focus: TRAINING & SKILLS MANAGEMENT queries")
    print(f"       (skill query, training plan, training record, certification,")
    print(f"        assessment, onboarding, safety training, promotion, team building)")
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
        'test': 'v5_round73_training_skills_management',
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
    report_path = f'tests/ai-intent/reports/v5_round73_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
