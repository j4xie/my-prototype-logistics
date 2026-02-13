#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 81
Focus: SAFETY INCIDENT & EMERGENCY queries for food manufacturing.
       Covers fire_emergency, chemical_spill, workplace_injury, equipment_accident,
       food_contamination, evacuation, incident_report, safety_training, and ppe_management.
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

# Round 81 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Fire Emergency (6 cases) =====
    ("火灾报警", ["ALERT_LIST", "ALERT_ACTIVE", "ALERT_ACKNOWLEDGE", "FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "fire_emergency"),
    ("消防演练", ["ALERT_LIST", "ALERT_ACTIVE", "REPORT_DASHBOARD_OVERVIEW", "HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", None], "fire_emergency"),
    ("灭火器检查", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_DETAIL", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "fire_emergency"),
    ("火灾应急预案", ["ALERT_LIST", "ALERT_ACTIVE", "REPORT_DASHBOARD_OVERVIEW", "FACTORY_NOTIFICATION_CONFIG", None], "fire_emergency"),
    ("消防通道检查", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "fire_emergency"),
    ("烟雾报警", ["ALERT_LIST", "ALERT_ACTIVE", "ALERT_ACKNOWLEDGE", "FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "fire_emergency"),

    # ===== 2. Chemical Spill (5 cases) =====
    ("化学品泄漏", ["ALERT_LIST", "ALERT_ACTIVE", "ALERT_ACKNOWLEDGE", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "chemical_spill"),
    ("危化品处理", ["MATERIAL_BATCH_QUERY", "ALERT_LIST", "ALERT_ACTIVE", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_DISPOSITION_EXECUTE", None], "chemical_spill"),
    ("化学品清单", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "chemical_spill"),
    ("化学品存储", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "chemical_spill"),
    ("MSDS查询", ["MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "chemical_spill"),

    # ===== 3. Workplace Injury (6 cases) =====
    ("工伤报告", ["ALERT_LIST", "ALERT_ACTIVE", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "workplace_injury"),
    ("工伤统计", ["ATTENDANCE_STATS", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "workplace_injury"),
    ("安全事故记录", ["ALERT_LIST", "ALERT_ACTIVE", "REPORT_DASHBOARD_OVERVIEW", None], "workplace_injury"),
    ("工伤处理流程", ["HR_EMPLOYEE_LIST", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "workplace_injury"),
    ("急救处理", ["ALERT_LIST", "ALERT_ACTIVE", "REPORT_DASHBOARD_OVERVIEW", None], "workplace_injury"),
    ("伤员转移", ["ALERT_LIST", "ALERT_ACTIVE", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "workplace_injury"),

    # ===== 4. Equipment Accident (5 cases) =====
    ("设备事故", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_DETAIL", "ALERT_LIST", "ALERT_ACTIVE", "REPORT_DASHBOARD_OVERVIEW", "ALERT_BY_EQUIPMENT", None], "equipment_accident"),
    ("设备安全检查", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_DETAIL", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_LIST", None], "equipment_accident"),
    ("安全锁定", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "equipment_accident"),
    ("设备紧急停机", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_DETAIL", "ALERT_LIST", "ALERT_ACTIVE", "REPORT_DASHBOARD_OVERVIEW", None], "equipment_accident"),
    ("安全阀检查", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_DETAIL", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "equipment_accident"),

    # ===== 5. Food Contamination (6 cases) =====
    ("食品污染", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "ALERT_LIST", "ALERT_ACTIVE", "REPORT_DASHBOARD_OVERVIEW", None], "food_contamination"),
    ("交叉污染检查", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "food_contamination"),
    ("异物检测", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "food_contamination"),
    ("微生物超标", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "ALERT_LIST", "ALERT_ACTIVE", "REPORT_DASHBOARD_OVERVIEW", None], "food_contamination"),
    ("农残超标", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "ALERT_LIST", "ALERT_ACTIVE", "REPORT_DASHBOARD_OVERVIEW", None], "food_contamination"),
    ("重金属检测", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "food_contamination"),

    # ===== 6. Evacuation (5 cases) =====
    ("紧急疏散", ["ALERT_LIST", "ALERT_ACTIVE", "ALERT_ACKNOWLEDGE", "FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "evacuation"),
    ("应急集合", ["ALERT_LIST", "ALERT_ACTIVE", "HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "evacuation"),
    ("疏散路线", ["ALERT_LIST", "ALERT_ACTIVE", "REPORT_DASHBOARD_OVERVIEW", None], "evacuation"),
    ("人员清点", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "evacuation"),
    ("安全出口检查", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "evacuation"),

    # ===== 7. Incident Report (6 cases) =====
    ("事故报告", ["ALERT_LIST", "ALERT_ACTIVE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_ANOMALY", None], "incident_report"),
    ("事故调查", ["ALERT_LIST", "ALERT_ACTIVE", "REPORT_DASHBOARD_OVERVIEW", None], "incident_report"),
    ("根因分析", ["REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "QUALITY_CHECK_QUERY", "ALERT_DIAGNOSE", None], "incident_report"),
    ("纠正措施", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "incident_report"),
    ("预防措施", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "ALERT_DIAGNOSE", None], "incident_report"),
    ("事故复盘", ["ALERT_LIST", "ALERT_ACTIVE", "REPORT_DASHBOARD_OVERVIEW", None], "incident_report"),

    # ===== 8. Safety Training (5 cases) =====
    ("安全培训", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "safety_training"),
    ("安全意识教育", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "safety_training"),
    ("安全考试", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "safety_training"),
    ("持证上岗", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "CLOCK_IN", None], "safety_training"),
    ("安全资质", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "safety_training"),

    # ===== 9. PPE Management (6 cases) =====
    ("防护用品", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "ppe_management"),
    ("安全帽", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "ppe_management"),
    ("防护手套", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "ppe_management"),
    ("工作服管理", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "ppe_management"),
    ("劳保用品领取", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "ppe_management"),
    ("防护装备检查", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_MAINTENANCE", None], "ppe_management"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 81 ===")
    print(f"Focus: SAFETY INCIDENT & EMERGENCY queries")
    print(f"       (fire_emergency, chemical_spill, workplace_injury, equipment_accident,")
    print(f"        food_contamination, evacuation, incident_report, safety_training, ppe_management)")
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
        'test': 'v5_round81_safety_incident_emergency',
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
    report_path = f'tests/ai-intent/reports/v5_round81_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
