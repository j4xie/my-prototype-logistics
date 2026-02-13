#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 99
Focus: WORKFLOW & APPROVAL queries for food manufacturing.
       Covers approval_flow, work_order_flow, change_mgmt, purchase_approval,
       quality_approval, production_approval, hr_approval, finance_approval,
       and escalation.
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

# Round 99 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Approval Flow (6 cases) =====
    ("审批流程", ["PLAN_UPDATE", "ORDER_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "approval_flow"),
    ("待审批", ["PLAN_UPDATE", "ORDER_UPDATE", "ORDER_LIST", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "approval_flow"),
    ("我的审批", ["PLAN_UPDATE", "ORDER_UPDATE", "ORDER_LIST", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "approval_flow"),
    ("审批记录", ["PLAN_UPDATE", "ORDER_UPDATE", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "approval_flow"),
    ("审批通过", ["PLAN_UPDATE", "ORDER_UPDATE", "QUALITY_DISPOSITION_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "approval_flow"),
    ("审批驳回", ["PLAN_UPDATE", "ORDER_UPDATE", "QUALITY_DISPOSITION_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "approval_flow"),

    # ===== 2. Work Order Flow (5 cases) =====
    ("工单流转", ["ORDER_UPDATE", "ORDER_LIST", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "work_order_flow"),
    ("工单状态", ["ORDER_LIST", "ORDER_UPDATE", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "work_order_flow"),
    ("工单审批", ["ORDER_UPDATE", "ORDER_LIST", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "work_order_flow"),
    ("工单关闭", ["ORDER_UPDATE", "PROCESSING_BATCH_COMPLETE", "REPORT_DASHBOARD_OVERVIEW", None], "work_order_flow"),
    ("工单挂起", ["ORDER_UPDATE", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "work_order_flow"),

    # ===== 3. Change Management (6 cases) =====
    ("变更申请", ["PLAN_UPDATE", "ORDER_UPDATE", "ORDER_CREATE", "REPORT_DASHBOARD_OVERVIEW", None], "change_mgmt"),
    ("变更审批", ["PLAN_UPDATE", "ORDER_UPDATE", "QUALITY_DISPOSITION_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "change_mgmt"),
    ("工艺变更", ["PLAN_UPDATE", "ORDER_UPDATE", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "change_mgmt"),
    ("配方变更", ["PLAN_UPDATE", "ORDER_UPDATE", "PROCESSING_BATCH_CREATE", "REPORT_DASHBOARD_OVERVIEW", None], "change_mgmt"),
    ("规格变更", ["PLAN_UPDATE", "ORDER_UPDATE", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "change_mgmt"),
    ("变更记录", ["PLAN_UPDATE", "ORDER_LIST", "ORDER_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "change_mgmt"),

    # ===== 4. Purchase Approval (5 cases) =====
    ("采购审批", ["ORDER_UPDATE", "ORDER_LIST", "ORDER_CREATE", "MRP_CALCULATION", "REPORT_DASHBOARD_OVERVIEW", None], "purchase_approval"),
    ("采购申请", ["ORDER_CREATE", "ORDER_LIST", "MRP_CALCULATION", "REPORT_DASHBOARD_OVERVIEW", None], "purchase_approval"),
    ("采购确认", ["ORDER_UPDATE", "ORDER_LIST", "ORDER_CREATE", "REPORT_DASHBOARD_OVERVIEW", None], "purchase_approval"),
    ("采购驳回", ["ORDER_UPDATE", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "purchase_approval"),
    ("采购流程", ["ORDER_LIST", "ORDER_CREATE", "ORDER_UPDATE", "MRP_CALCULATION", "REPORT_DASHBOARD_OVERVIEW", None], "purchase_approval"),

    # ===== 5. Quality Approval (6 cases) =====
    ("质检审批", ["QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_DISPOSITION_EVALUATE", "REPORT_DASHBOARD_OVERVIEW", None], "quality_approval"),
    ("放行审批", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_DISPOSITION_EVALUATE", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "quality_approval"),
    ("偏差审批", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_DISPOSITION_EVALUATE", "QUALITY_CHECK_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "quality_approval"),
    ("不合格品处理审批", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_DISPOSITION_EVALUATE", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "quality_approval"),
    ("让步接收", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_DISPOSITION_EVALUATE", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "quality_approval"),
    ("质量评审", ["QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EVALUATE", "QUALITY_DISPOSITION_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "quality_approval"),

    # ===== 6. Production Approval (5 cases) =====
    ("生产审批", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", "SCHEDULING_AUTO", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "production_approval"),
    ("排产确认", ["SCHEDULING_AUTO", "PROCESSING_BATCH_CREATE", "PLAN_UPDATE", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "production_approval"),
    ("开工审批", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", "SCHEDULING_AUTO", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_START", None], "production_approval"),
    ("完工确认", ["PROCESSING_BATCH_COMPLETE", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "production_approval"),
    ("产量确认", ["PROCESSING_BATCH_COMPLETE", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", "COST_QUERY", "REPORT_PRODUCTION", None], "production_approval"),

    # ===== 7. HR Approval (6 cases) =====
    ("请假审批", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "hr_approval"),
    ("加班审批", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "hr_approval"),
    ("调岗审批", ["HR_EMPLOYEE_LIST", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "hr_approval"),
    ("离职审批", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "HR_EMPLOYEE_DELETE", None], "hr_approval"),
    ("转正审批", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "hr_approval"),
    ("薪资审批", ["HR_EMPLOYEE_LIST", "COST_QUERY", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "hr_approval"),

    # ===== 8. Finance Approval (5 cases) =====
    ("费用审批", ["COST_QUERY", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "finance_approval"),
    ("报销审批", ["COST_QUERY", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "finance_approval"),
    ("付款审批", ["COST_QUERY", "REPORT_FINANCE", "ORDER_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "finance_approval"),
    ("预算审批", ["COST_QUERY", "REPORT_FINANCE", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "finance_approval"),
    ("合同审批", ["ORDER_UPDATE", "ORDER_LIST", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "finance_approval"),

    # ===== 9. Escalation (6 cases) =====
    ("升级处理", ["ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "escalation"),
    ("催办", ["ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG", "ORDER_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "escalation"),
    ("超时提醒", ["ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "escalation"),
    ("自动升级", ["ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "escalation"),
    ("紧急审批", ["ALERT_LIST", "PLAN_UPDATE", "ORDER_UPDATE", "QUALITY_DISPOSITION_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "escalation"),
    ("特批", ["PLAN_UPDATE", "ORDER_UPDATE", "QUALITY_DISPOSITION_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "escalation"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 99 ===")
    print(f"Focus: WORKFLOW & APPROVAL queries")
    print(f"       (approval_flow, work_order_flow, change_mgmt, purchase_approval,")
    print(f"        quality_approval, production_approval, hr_approval, finance_approval,")
    print(f"        escalation)")
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
        'test': 'v5_round99_workflow_approval',
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
    report_path = f'tests/ai-intent/reports/v5_round99_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
