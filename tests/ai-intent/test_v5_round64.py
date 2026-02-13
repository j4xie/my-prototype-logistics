#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 64
Focus: NOTIFICATION & MESSAGING queries for food manufacturing.
       Covers alert notify, message send, notification query, approval notify,
       schedule notify, system notify, reminder set, escalation, and feedback.
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

# Round 64 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Alert Notify (6 cases) =====
    ("发送告警通知", ["FACTORY_NOTIFICATION_CONFIG", "ALERT_LIST", "ALERT_ACTIVE", None], "alert_notify"),
    ("推送预警", ["FACTORY_NOTIFICATION_CONFIG", "ALERT_LIST", "ALERT_ACTIVE", None], "alert_notify"),
    ("告警通知谁", ["FACTORY_NOTIFICATION_CONFIG", "ALERT_LIST", "ALERT_ACTIVE", None], "alert_notify"),
    ("通知相关人员", ["FACTORY_NOTIFICATION_CONFIG", "ALERT_LIST", "ALERT_ACTIVE", None], "alert_notify"),
    ("群发告警", ["FACTORY_NOTIFICATION_CONFIG", "ALERT_LIST", "ALERT_ACTIVE", None], "alert_notify"),
    ("紧急通知", ["FACTORY_NOTIFICATION_CONFIG", "ALERT_LIST", "ALERT_ACTIVE", None], "alert_notify"),

    # ===== 2. Message Send (6 cases) =====
    ("发消息给车间", ["FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "message_send"),
    ("通知张三", ["FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "message_send"),
    ("给主管发信息", ["FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "message_send"),
    ("发通知", ["FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "message_send"),
    ("群发消息", ["FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "message_send"),
    ("短信提醒", ["FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "message_send"),

    # ===== 3. Notification Query (5 cases) =====
    ("查看通知", ["ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "notification_query"),
    ("未读消息", ["ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "notification_query"),
    ("最近通知", ["ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "notification_query"),
    ("消息列表", ["ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "notification_query"),
    ("通知记录", ["ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "notification_query"),

    # ===== 4. Approval Notify (6 cases) =====
    ("审批提醒", ["PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "approval_notify"),
    ("待审批", ["PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "approval_notify"),
    ("审批通知", ["PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG", None], "approval_notify"),
    ("催办审批", ["PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "approval_notify"),
    ("审批超时", ["PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "approval_notify"),
    ("审批结果通知", ["PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "approval_notify"),

    # ===== 5. Schedule Notify (5 cases) =====
    ("排班通知", ["SCHEDULING_SET_MANUAL", "FACTORY_NOTIFICATION_CONFIG", "PLAN_UPDATE", "MATERIAL_EXPIRING_ALERT", "ATTENDANCE_STATS", None], "schedule_notify"),
    ("调班提醒", ["SCHEDULING_SET_MANUAL", "FACTORY_NOTIFICATION_CONFIG", "PLAN_UPDATE", "MATERIAL_EXPIRING_ALERT", None], "schedule_notify"),
    ("排产通知", ["SCHEDULING_SET_MANUAL", "FACTORY_NOTIFICATION_CONFIG", "PLAN_UPDATE", "MATERIAL_EXPIRING_ALERT", "PROCESSING_BATCH_CREATE", None], "schedule_notify"),
    ("计划变更通知", ["SCHEDULING_SET_MANUAL", "FACTORY_NOTIFICATION_CONFIG", "PLAN_UPDATE", "MATERIAL_EXPIRING_ALERT", None], "schedule_notify"),
    ("交期提醒", ["SCHEDULING_SET_MANUAL", "FACTORY_NOTIFICATION_CONFIG", "PLAN_UPDATE", "MATERIAL_EXPIRING_ALERT", None], "schedule_notify"),

    # ===== 6. System Notify (6 cases) =====
    ("系统公告", ["FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STOP", None], "system_notify"),
    ("维护通知", ["FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STOP", "EQUIPMENT_MAINTENANCE", None], "system_notify"),
    ("版本更新", ["FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STOP", None], "system_notify"),
    ("停机通知", ["FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STOP", None], "system_notify"),
    ("系统消息", ["FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STOP", None], "system_notify"),
    ("平台公告", ["FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STOP", None], "system_notify"),

    # ===== 7. Reminder Set (5 cases) =====
    ("设置提醒", ["FACTORY_NOTIFICATION_CONFIG", "MATERIAL_EXPIRING_ALERT", "MATERIAL_LOW_STOCK_ALERT", "ALERT_LIST", None], "reminder_set"),
    ("定时提醒", ["FACTORY_NOTIFICATION_CONFIG", "MATERIAL_EXPIRING_ALERT", "MATERIAL_LOW_STOCK_ALERT", "ALERT_LIST", None], "reminder_set"),
    ("每日提醒", ["FACTORY_NOTIFICATION_CONFIG", "MATERIAL_EXPIRING_ALERT", "MATERIAL_LOW_STOCK_ALERT", "ALERT_LIST", None], "reminder_set"),
    ("到期提醒", ["FACTORY_NOTIFICATION_CONFIG", "MATERIAL_EXPIRING_ALERT", "MATERIAL_LOW_STOCK_ALERT", "ALERT_LIST", None], "reminder_set"),
    ("库存提醒", ["FACTORY_NOTIFICATION_CONFIG", "MATERIAL_EXPIRING_ALERT", "MATERIAL_LOW_STOCK_ALERT", "ALERT_LIST", "REPORT_INVENTORY", None], "reminder_set"),

    # ===== 8. Escalation (6 cases) =====
    ("升级处理", ["ALERT_DIAGNOSE", "ALERT_LIST", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "escalation"),
    ("上报问题", ["ALERT_DIAGNOSE", "ALERT_LIST", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "escalation"),
    ("转交处理", ["ALERT_DIAGNOSE", "ALERT_LIST", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "escalation"),
    ("升级告警", ["ALERT_DIAGNOSE", "ALERT_LIST", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "escalation"),
    ("上级审批", ["ALERT_DIAGNOSE", "ALERT_LIST", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "escalation"),
    ("跨部门通知", ["ALERT_DIAGNOSE", "ALERT_LIST", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "escalation"),

    # ===== 9. Feedback (5 cases) =====
    ("反馈意见", ["REPORT_DASHBOARD_OVERVIEW", "QUALITY_DISPOSITION_EXECUTE", "CUSTOMER_STATS", None], "feedback"),
    ("提交建议", ["REPORT_DASHBOARD_OVERVIEW", "QUALITY_DISPOSITION_EXECUTE", "CUSTOMER_STATS", "MRP_CALCULATION", None], "feedback"),
    ("用户反馈", ["REPORT_DASHBOARD_OVERVIEW", "QUALITY_DISPOSITION_EXECUTE", "CUSTOMER_STATS", None], "feedback"),
    ("问题反馈", ["REPORT_DASHBOARD_OVERVIEW", "QUALITY_DISPOSITION_EXECUTE", "CUSTOMER_STATS", "REPORT_ANOMALY", None], "feedback"),
    ("改进建议", ["REPORT_DASHBOARD_OVERVIEW", "QUALITY_DISPOSITION_EXECUTE", "CUSTOMER_STATS", None], "feedback"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 64 ===")
    print(f"Focus: NOTIFICATION & MESSAGING queries")
    print(f"       (alert notify, message send, notification query, approval notify,")
    print(f"        schedule notify, system notify, reminder set, escalation, feedback)")
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
        'test': 'v5_round64_notification_messaging',
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
    report_path = f'tests/ai-intent/reports/v5_round64_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
