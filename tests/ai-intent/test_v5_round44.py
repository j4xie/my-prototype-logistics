#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 44
Focus: EQUIPMENT DETAIL & MAINTENANCE queries.
       Covers equipment status, maintenance requests, maintenance history,
       spare parts, equipment performance, calibration, equipment alerts,
       equipment config, and equipment planning.
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

# Round 44 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Equipment Status (6 cases) =====
    ("设备运行状态", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "EQUIPMENT_LIST", None], "equipment_status"),
    ("1号机状态", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", None], "equipment_status"),
    ("哪台设备停了", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STOP", "EQUIPMENT_ALERT_LIST", "ALERT_ACTIVE", None], "equipment_status"),
    ("设备开机情况", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_START", "EQUIPMENT_STATS", None], "equipment_status"),
    ("设备在线率", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY", None], "equipment_status"),
    ("设备故障状态", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "ALERT_ACTIVE", None], "equipment_status"),

    # ===== 2. Maintenance Request (6 cases) =====
    ("设备报修", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_UPDATE", None], "maintenance_request"),
    ("安排维修", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_UPDATE", None], "maintenance_request"),
    ("维修工单", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", None], "maintenance_request"),
    ("紧急维修", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_UPDATE", "ALERT_ACTIVE", None], "maintenance_request"),
    ("预防性维修", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_UPDATE", None], "maintenance_request"),
    ("设备保养", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_UPDATE", None], "maintenance_request"),

    # ===== 3. Maintenance History (5 cases) =====
    ("维修记录", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", None], "maintenance_history"),
    ("历史故障", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_ALERT_LIST", "EQUIPMENT_STATS", None], "maintenance_history"),
    ("设备维修次数", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", None], "maintenance_history"),
    ("维修费用统计", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "REPORT_EFFICIENCY", None], "maintenance_history"),
    ("上次维修时间", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", None], "maintenance_history"),

    # ===== 4. Spare Parts (6 cases) =====
    ("备件库存", ["MATERIAL_BATCH_QUERY", "EQUIPMENT_MAINTENANCE", "MATERIAL_LOW_STOCK_ALERT", "REPORT_INVENTORY", None], "spare_parts"),
    ("备件申请", ["EQUIPMENT_MAINTENANCE", "MATERIAL_BATCH_QUERY", None], "spare_parts"),
    ("备件使用记录", ["EQUIPMENT_MAINTENANCE", "MATERIAL_BATCH_QUERY", None], "spare_parts"),
    ("备件不够了", ["MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY", "ALERT_ACTIVE", None], "spare_parts"),
    ("备件采购", ["MATERIAL_BATCH_QUERY", "MATERIAL_LOW_STOCK_ALERT", None], "spare_parts"),
    ("备件消耗", ["MATERIAL_BATCH_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", None], "spare_parts"),

    # ===== 5. Equipment Performance (6 cases) =====
    ("设备效率", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY", None], "equipment_performance"),
    ("设备产能", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY", None], "equipment_performance"),
    ("设备利用率", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY", None], "equipment_performance"),
    ("停机时间统计", ["EQUIPMENT_STATS", "EQUIPMENT_STATUS_QUERY", "REPORT_EFFICIENCY", "EQUIPMENT_STOP", None], "equipment_performance"),
    ("故障率分析", ["EQUIPMENT_STATS", "EQUIPMENT_ALERT_LIST", "REPORT_EFFICIENCY", "EQUIPMENT_MAINTENANCE", None], "equipment_performance"),
    ("MTBF", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", None], "equipment_performance"),

    # ===== 6. Calibration (5 cases) =====
    ("设备校准", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_UPDATE", None], "calibration"),
    ("计量检定", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_EXECUTE", None], "calibration"),
    ("精度检查", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", None], "calibration"),
    ("校准记录", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", None], "calibration"),
    ("校准到期", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_ALERT_LIST", "ALERT_ACTIVE", "MATERIAL_EXPIRING_ALERT", None], "calibration"),

    # ===== 7. Equipment Alert (5 cases) =====
    ("设备告警", ["EQUIPMENT_ALERT_LIST", "ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_STATUS_QUERY", None], "equipment_alert"),
    ("设备异常", ["EQUIPMENT_ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", None], "equipment_alert"),
    ("设备温度过高", ["EQUIPMENT_ALERT_LIST", "COLD_CHAIN_TEMPERATURE", "ALERT_ACTIVE", None], "equipment_alert"),
    ("振动异常", ["EQUIPMENT_ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", None], "equipment_alert"),
    ("电流超标", ["EQUIPMENT_ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_STATUS_QUERY", None], "equipment_alert"),

    # ===== 8. Equipment Config (6 cases) =====
    ("设备参数", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "EQUIPMENT_DETAIL", None], "equipment_config"),
    ("设备档案", ["EQUIPMENT_LIST", "EQUIPMENT_STATUS_QUERY", None], "equipment_config"),
    ("设备清单", ["EQUIPMENT_LIST", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", None], "equipment_config"),
    ("设备编号", ["EQUIPMENT_LIST", "EQUIPMENT_STATUS_QUERY", None], "equipment_config"),
    ("设备位置", ["EQUIPMENT_LIST", "EQUIPMENT_STATUS_QUERY", None], "equipment_config"),
    ("设备规格", ["EQUIPMENT_LIST", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", None], "equipment_config"),

    # ===== 9. Equipment Plan (5 cases) =====
    ("设备巡检计划", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", None], "equipment_plan"),
    ("点检计划", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_EXECUTE", None], "equipment_plan"),
    ("保养计划", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_UPDATE", None], "equipment_plan"),
    ("大修计划", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_UPDATE", "PLAN_UPDATE", None], "equipment_plan"),
    ("设备更新计划", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_LIST", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_UPDATE", None], "equipment_plan"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 44 ===")
    print(f"Focus: EQUIPMENT DETAIL & MAINTENANCE queries")
    print(f"       (status, maintenance, spare parts, performance, calibration, alerts, config, plans)")
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
        'test': 'v5_round44_equipment_maintenance',
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
    report_path = f'tests/ai-intent/reports/v5_round44_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
