#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 92
Focus: COLD CHAIN & TEMPERATURE CONTROL queries for food manufacturing.
       Covers temp_monitor, humidity, cold_storage, transport_temp,
       alarm_threshold, calibration, compliance_temp, energy_cooling, and temp_report.
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

# Round 92 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Temperature Monitor (6 cases) =====
    ("温度监控", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "ALERT_ACTIVE", None], "temp_monitor"),
    ("冷库温度", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "INVENTORY_QUERY", None], "temp_monitor"),
    ("当前温度", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", None], "temp_monitor"),
    ("温度异常", ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_STATUS_QUERY", None], "temp_monitor"),
    ("温度曲线", ["COLD_CHAIN_TEMPERATURE", "REPORT_TRENDS", "EQUIPMENT_STATUS_QUERY", None], "temp_monitor"),
    ("实时温度", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", None], "temp_monitor"),

    # ===== 2. Humidity (5 cases) =====
    ("湿度检测", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", None], "humidity"),
    ("车间湿度", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "REPORT_PRODUCTION", None], "humidity"),
    ("仓库湿度", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "INVENTORY_QUERY", "REPORT_INVENTORY", None], "humidity"),
    ("湿度报警", ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_STATUS_QUERY", None], "humidity"),
    ("温湿度记录", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", None], "humidity"),

    # ===== 3. Cold Storage (6 cases) =====
    ("冷库管理", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "INVENTORY_QUERY", "EQUIPMENT_MAINTENANCE", None], "cold_storage"),
    ("冷库容量", ["COLD_CHAIN_TEMPERATURE", "INVENTORY_QUERY", "EQUIPMENT_STATUS_QUERY", None], "cold_storage"),
    ("冷库使用率", ["COLD_CHAIN_TEMPERATURE", "INVENTORY_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "cold_storage"),
    ("冷库设备", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", None], "cold_storage"),
    ("冷库巡检", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "QUALITY_CHECK_QUERY", None], "cold_storage"),
    ("冷库库存", ["COLD_CHAIN_TEMPERATURE", "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", None], "cold_storage"),

    # ===== 4. Transport Temperature (5 cases) =====
    ("运输温度", ["COLD_CHAIN_TEMPERATURE", "SHIPMENT_QUERY", "EQUIPMENT_STATUS_QUERY", None], "transport_temp"),
    ("冷链物流", ["COLD_CHAIN_TEMPERATURE", "SHIPMENT_QUERY", "EQUIPMENT_STATUS_QUERY", None], "transport_temp"),
    ("运输监控", ["COLD_CHAIN_TEMPERATURE", "SHIPMENT_QUERY", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", None], "transport_temp"),
    ("到货温度", ["COLD_CHAIN_TEMPERATURE", "SHIPMENT_QUERY", "QUALITY_CHECK_QUERY", "MATERIAL_BATCH_QUERY", None], "transport_temp"),
    ("冷链断裂", ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "ALERT_ACTIVE", "SHIPMENT_QUERY", None], "transport_temp"),

    # ===== 5. Alarm Threshold (6 cases) =====
    ("温度阈值", ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG", "EQUIPMENT_STATUS_QUERY", None], "alarm_threshold"),
    ("预警设置", ["FACTORY_NOTIFICATION_CONFIG", "ALERT_LIST", "COLD_CHAIN_TEMPERATURE", None], "alarm_threshold"),
    ("报警上限", ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG", "EQUIPMENT_STATUS_QUERY", None], "alarm_threshold"),
    ("报警下限", ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG", "EQUIPMENT_STATUS_QUERY", None], "alarm_threshold"),
    ("阈值调整", ["FACTORY_NOTIFICATION_CONFIG", "COLD_CHAIN_TEMPERATURE", "ALERT_LIST", None], "alarm_threshold"),
    ("报警规则", ["FACTORY_NOTIFICATION_CONFIG", "ALERT_LIST", "COLD_CHAIN_TEMPERATURE", None], "alarm_threshold"),

    # ===== 6. Calibration (5 cases) =====
    ("温度校准", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", None], "calibration"),
    ("传感器校准", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "COLD_CHAIN_TEMPERATURE", None], "calibration"),
    ("校准记录", ["EQUIPMENT_MAINTENANCE", "COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", None], "calibration"),
    ("校准证书", ["EQUIPMENT_MAINTENANCE", "COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", None], "calibration"),
    ("校准周期", ["EQUIPMENT_MAINTENANCE", "COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", None], "calibration"),

    # ===== 7. Compliance Temperature (6 cases) =====
    ("温控合规", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "REPORT_PRODUCTION", None], "compliance_temp"),
    ("FDA温控要求", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "REPORT_PRODUCTION", None], "compliance_temp"),
    ("HACCP温控", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "REPORT_PRODUCTION", None], "compliance_temp"),
    ("温度偏差处理", ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "ALERT_ACTIVE", "QUALITY_CHECK_QUERY", None], "compliance_temp"),
    ("温控审计", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "compliance_temp"),
    ("温控文档", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "REPORT_PRODUCTION", None], "compliance_temp"),

    # ===== 8. Energy & Cooling (5 cases) =====
    ("制冷能耗", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", "REPORT_PRODUCTION", None], "energy_cooling"),
    ("制冷设备", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "COLD_CHAIN_TEMPERATURE", None], "energy_cooling"),
    ("压缩机状态", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "COLD_CHAIN_TEMPERATURE", None], "energy_cooling"),
    ("制冷效率", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", "REPORT_PRODUCTION", None], "energy_cooling"),
    ("冷媒量", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "COLD_CHAIN_TEMPERATURE", None], "energy_cooling"),

    # ===== 9. Temperature Report (6 cases) =====
    ("温度报表", ["COLD_CHAIN_TEMPERATURE", "REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "temp_report"),
    ("月度温控报告", ["COLD_CHAIN_TEMPERATURE", "REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "temp_report"),
    ("温度趋势", ["COLD_CHAIN_TEMPERATURE", "REPORT_TRENDS", "EQUIPMENT_STATUS_QUERY", None], "temp_report"),
    ("超温统计", ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "temp_report"),
    ("温控改善", ["COLD_CHAIN_TEMPERATURE", "REPORT_TRENDS", "REPORT_PRODUCTION", "QUALITY_CHECK_QUERY", None], "temp_report"),
    ("温控评估", ["COLD_CHAIN_TEMPERATURE", "REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "temp_report"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 92 ===")
    print(f"Focus: COLD CHAIN & TEMPERATURE CONTROL queries")
    print(f"       (temp_monitor, humidity, cold_storage, transport_temp,")
    print(f"        alarm_threshold, calibration, compliance_temp, energy_cooling, temp_report)")
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
        'test': 'v5_round92_cold_chain_temperature_control',
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
    report_path = f'tests/ai-intent/reports/v5_round92_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
