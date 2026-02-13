#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 76
Focus: MOBILE & FIELD OPERATIONS queries for food manufacturing.
       Covers clock_in, field_report, mobile_inspect, photo_evidence,
       voice_input, offline_ops, location, quick_scan, and mobile_alert.
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

# Round 76 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Clock In (6 cases) =====
    ("打卡上班", ["CLOCK_IN", "ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "clock_in"),
    ("签到", ["CLOCK_IN", "ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "clock_in"),
    ("上班打卡", ["CLOCK_IN", "ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "clock_in"),
    ("到岗签到", ["CLOCK_IN", "ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "clock_in"),
    ("扫码签到", ["CLOCK_IN", "ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "clock_in"),
    ("GPS打卡", ["CLOCK_IN", "ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "clock_in"),

    # ===== 2. Field Report (6 cases) =====
    ("现场报工", ["PROCESSING_BATCH_COMPLETE", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", None], "field_report"),
    ("手机报工", ["PROCESSING_BATCH_COMPLETE", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", None], "field_report"),
    ("拍照报工", ["PROCESSING_BATCH_COMPLETE", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", "SCALE_ADD_DEVICE_VISION", None], "field_report"),
    ("完工报告", ["PROCESSING_BATCH_COMPLETE", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", None], "field_report"),
    ("进度汇报", ["PROCESSING_BATCH_COMPLETE", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", None], "field_report"),
    ("扫码报工", ["PROCESSING_BATCH_COMPLETE", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", None], "field_report"),

    # ===== 3. Mobile Inspect (5 cases) =====
    ("手机质检", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", None], "mobile_inspect"),
    ("现场检验", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", None], "mobile_inspect"),
    ("移动质检", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", None], "mobile_inspect"),
    ("拍照质检", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", None], "mobile_inspect"),
    ("巡检打卡", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", "CLOCK_IN", None], "mobile_inspect"),

    # ===== 4. Photo Evidence (6 cases) =====
    ("拍照取证", ["QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "SCALE_ADD_DEVICE_VISION", None], "photo_evidence"),
    ("现场照片", ["QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "photo_evidence"),
    ("异常拍照", ["QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "photo_evidence"),
    ("设备照片", ["QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "photo_evidence"),
    ("质量拍照", ["QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "QUALITY_CHECK_QUERY", None], "photo_evidence"),
    ("缺陷拍照", ["QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "SCALE_ADD_DEVICE_VISION", None], "photo_evidence"),

    # ===== 5. Voice Input (5 cases) =====
    ("语音录入", ["PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", None], "voice_input"),
    ("语音记录", ["PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", None], "voice_input"),
    ("说一下今天产量", ["PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", None], "voice_input"),
    ("语音输入数据", ["PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", None], "voice_input"),
    ("口述记录", ["PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", None], "voice_input"),

    # ===== 6. Offline Ops (6 cases) =====
    ("离线操作", ["REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_EXECUTE", "CONFIG_RESET", None], "offline_ops"),
    ("无网络操作", ["REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_EXECUTE", "CONFIG_RESET", None], "offline_ops"),
    ("断网提交", ["REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_EXECUTE", "CONFIG_RESET", None], "offline_ops"),
    ("离线记录", ["REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_EXECUTE", "CONFIG_RESET", None], "offline_ops"),
    ("稍后同步", ["REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_EXECUTE", "CONFIG_RESET", None], "offline_ops"),
    ("离线质检", ["REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_EXECUTE", "CONFIG_RESET", "QUALITY_CHECK_QUERY", None], "offline_ops"),

    # ===== 7. Location (5 cases) =====
    ("我在哪个车间", ["REPORT_DASHBOARD_OVERVIEW", "INVENTORY_QUERY", "PRODUCTION_STATUS_QUERY", None], "location"),
    ("定位", ["REPORT_DASHBOARD_OVERVIEW", "INVENTORY_QUERY", "PRODUCTION_STATUS_QUERY", None], "location"),
    ("当前位置", ["REPORT_DASHBOARD_OVERVIEW", "INVENTORY_QUERY", "PRODUCTION_STATUS_QUERY", "NAVIGATE_TO_LOCATION", None], "location"),
    ("车间导航", ["REPORT_DASHBOARD_OVERVIEW", "INVENTORY_QUERY", "PRODUCTION_STATUS_QUERY", None], "location"),
    ("仓库在哪", ["REPORT_DASHBOARD_OVERVIEW", "INVENTORY_QUERY", "PRODUCTION_STATUS_QUERY", "REPORT_INVENTORY", None], "location"),

    # ===== 8. Quick Scan (6 cases) =====
    ("快速扫码", ["TRACE_BATCH", "TRACE_PUBLIC", "MATERIAL_BATCH_CREATE", "MATERIAL_BATCH_CONSUME", "QUALITY_CHECK_EXECUTE", "SCALE_ADD_DEVICE_VISION", None], "quick_scan"),
    ("扫一下", ["TRACE_BATCH", "TRACE_PUBLIC", "MATERIAL_BATCH_CREATE", "MATERIAL_BATCH_CONSUME", "QUALITY_CHECK_EXECUTE", "SCALE_ADD_DEVICE_VISION", None], "quick_scan"),
    ("扫码入库", ["TRACE_BATCH", "TRACE_PUBLIC", "MATERIAL_BATCH_CREATE", "MATERIAL_BATCH_CONSUME", "QUALITY_CHECK_EXECUTE", None], "quick_scan"),
    ("扫码质检", ["TRACE_BATCH", "TRACE_PUBLIC", "MATERIAL_BATCH_CREATE", "MATERIAL_BATCH_CONSUME", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", None], "quick_scan"),
    ("扫码出库", ["TRACE_BATCH", "TRACE_PUBLIC", "MATERIAL_BATCH_CREATE", "MATERIAL_BATCH_CONSUME", "QUALITY_CHECK_EXECUTE", None], "quick_scan"),
    ("扫码追溯", ["TRACE_BATCH", "TRACE_PUBLIC", "MATERIAL_BATCH_CREATE", "MATERIAL_BATCH_CONSUME", "QUALITY_CHECK_EXECUTE", None], "quick_scan"),

    # ===== 9. Mobile Alert (5 cases) =====
    ("手机告警", ["ALERT_LIST", "ALERT_ACTIVE", "FACTORY_NOTIFICATION_CONFIG", None], "mobile_alert"),
    ("收到告警", ["ALERT_LIST", "ALERT_ACTIVE", "FACTORY_NOTIFICATION_CONFIG", None], "mobile_alert"),
    ("推送通知", ["ALERT_LIST", "ALERT_ACTIVE", "FACTORY_NOTIFICATION_CONFIG", None], "mobile_alert"),
    ("告警响了", ["ALERT_LIST", "ALERT_ACTIVE", "FACTORY_NOTIFICATION_CONFIG", None], "mobile_alert"),
    ("手机收到预警", ["ALERT_LIST", "ALERT_ACTIVE", "FACTORY_NOTIFICATION_CONFIG", None], "mobile_alert"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 76 ===")
    print(f"Focus: MOBILE & FIELD OPERATIONS queries")
    print(f"       (clock_in, field_report, mobile_inspect, photo_evidence,")
    print(f"        voice_input, offline_ops, location, quick_scan, mobile_alert)")
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
        'test': 'v5_round76_mobile_field_operations',
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
    report_path = f'tests/ai-intent/reports/v5_round76_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
