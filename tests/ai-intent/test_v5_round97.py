#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 97
Focus: SYSTEM INTEGRATION & API queries for food manufacturing.
       Covers erp_sync, wms_integration, mes_connect, iot_device,
       api_monitor, data_exchange, middleware, third_party, and system_health.
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

# Round 97 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. ERP Sync (6 cases) =====
    ("ERP同步", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", "PRODUCTION_STATUS_QUERY", None], "erp_sync"),
    ("ERP数据", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "FACTORY_NOTIFICATION_CONFIG", "PRODUCTION_STATUS_QUERY", "INVENTORY_QUERY", None], "erp_sync"),
    ("SAP接口", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "ISAPI_QUERY_CAPABILITIES", "CONFIG_RESET", None], "erp_sync"),
    ("系统对接", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", None], "erp_sync"),
    ("数据同步", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", "PRODUCTION_STATUS_QUERY", None], "erp_sync"),
    ("接口状态", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "ISAPI_QUERY_CAPABILITIES", "ALERT_LIST", None], "erp_sync"),

    # ===== 2. WMS Integration (5 cases) =====
    ("WMS对接", ["REPORT_DASHBOARD_OVERVIEW", "INVENTORY_QUERY", "EQUIPMENT_STATUS_QUERY", "CONFIG_RESET", "REPORT_INVENTORY", None], "wms_integration"),
    ("仓储接口", ["REPORT_DASHBOARD_OVERVIEW", "INVENTORY_QUERY", "EQUIPMENT_STATUS_QUERY", "ISAPI_QUERY_CAPABILITIES", "REPORT_INVENTORY", None], "wms_integration"),
    ("库存同步", ["INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", "PRODUCTION_STATUS_QUERY", "REPORT_INVENTORY", None], "wms_integration"),
    ("出入库同步", ["INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_LIST", None], "wms_integration"),
    ("WMS状态", ["INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "REPORT_INVENTORY", None], "wms_integration"),

    # ===== 3. MES Connect (6 cases) =====
    ("MES连接", ["EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "CONFIG_RESET", None], "mes_connect"),
    ("生产数据采集", ["PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "PROCESSING_BATCH_LIST", "SCALE_ADD_DEVICE_VISION", None], "mes_connect"),
    ("实时采集", ["PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "COLD_CHAIN_TEMPERATURE", "SCALE_ADD_DEVICE_VISION", None], "mes_connect"),
    ("数据上传", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", "CONFIG_RESET", None], "mes_connect"),
    ("MES报工", ["PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_LIST", "EQUIPMENT_STATUS_QUERY", None], "mes_connect"),
    ("工序数据", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", None], "mes_connect"),

    # ===== 4. IoT Device (5 cases) =====
    ("IoT设备", ["EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "SCALE_ADD_DEVICE_VISION", "ISAPI_QUERY_CAPABILITIES", "EQUIPMENT_LIST", None], "iot_device"),
    ("传感器数据", ["EQUIPMENT_STATUS_QUERY", "COLD_CHAIN_TEMPERATURE", "REPORT_DASHBOARD_OVERVIEW", "SCALE_ADD_DEVICE_VISION", None], "iot_device"),
    ("设备联网", ["EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", None], "iot_device"),
    ("数据采集器", ["EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "SCALE_ADD_DEVICE_VISION", "PRODUCTION_STATUS_QUERY", None], "iot_device"),
    ("PLC连接", ["EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "PRODUCTION_STATUS_QUERY", None], "iot_device"),

    # ===== 5. API Monitor (6 cases) =====
    ("API监控", ["REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "EQUIPMENT_STATUS_QUERY", "ISAPI_QUERY_CAPABILITIES", None], "api_monitor"),
    ("接口调用", ["REPORT_DASHBOARD_OVERVIEW", "ISAPI_QUERY_CAPABILITIES", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", None], "api_monitor"),
    ("接口错误", ["ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "ISAPI_QUERY_CAPABILITIES", None], "api_monitor"),
    ("响应超时", ["ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "FACTORY_NOTIFICATION_CONFIG", None], "api_monitor"),
    ("调用频率", ["REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "EQUIPMENT_STATUS_QUERY", "ISAPI_QUERY_CAPABILITIES", None], "api_monitor"),
    ("接口日志", ["REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "ISAPI_QUERY_CAPABILITIES", "EQUIPMENT_STATUS_QUERY", None], "api_monitor"),

    # ===== 6. Data Exchange (5 cases) =====
    ("数据交换", ["REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "FACTORY_NOTIFICATION_CONFIG", "EQUIPMENT_STATUS_QUERY", None], "data_exchange"),
    ("数据推送", ["REPORT_DASHBOARD_OVERVIEW", "FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", "ALERT_LIST", None], "data_exchange"),
    ("数据接收", ["REPORT_DASHBOARD_OVERVIEW", "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "PRODUCTION_STATUS_QUERY", None], "data_exchange"),
    ("数据格式", ["REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "FACTORY_NOTIFICATION_CONFIG", "EQUIPMENT_STATUS_QUERY", None], "data_exchange"),
    ("数据映射", ["REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "FACTORY_NOTIFICATION_CONFIG", "EQUIPMENT_STATUS_QUERY", None], "data_exchange"),

    # ===== 7. Middleware (6 cases) =====
    ("中间件", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "CONFIG_RESET", "ALERT_LIST", None], "middleware"),
    ("消息队列", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "FACTORY_NOTIFICATION_CONFIG", "ALERT_LIST", None], "middleware"),
    ("数据总线", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "CONFIG_RESET", "FACTORY_NOTIFICATION_CONFIG", None], "middleware"),
    ("事件驱动", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "CONFIG_RESET", "ALERT_LIST", None], "middleware"),
    ("异步处理", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "CONFIG_RESET", "PRODUCTION_STATUS_QUERY", None], "middleware"),
    ("队列积压", ["ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "FACTORY_NOTIFICATION_CONFIG", None], "middleware"),

    # ===== 8. Third Party (5 cases) =====
    ("第三方系统", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "CONFIG_RESET", "FACTORY_NOTIFICATION_CONFIG", None], "third_party"),
    ("外部接口", ["REPORT_DASHBOARD_OVERVIEW", "ISAPI_QUERY_CAPABILITIES", "EQUIPMENT_STATUS_QUERY", "CONFIG_RESET", None], "third_party"),
    ("合作伙伴接口", ["REPORT_DASHBOARD_OVERVIEW", "ISAPI_QUERY_CAPABILITIES", "CONFIG_RESET", "FACTORY_NOTIFICATION_CONFIG", None], "third_party"),
    ("EDI", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "CONFIG_RESET", "FACTORY_NOTIFICATION_CONFIG", "MRP_CALCULATION", None], "third_party"),
    ("电子数据交换", ["REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "FACTORY_NOTIFICATION_CONFIG", "EQUIPMENT_STATUS_QUERY", None], "third_party"),

    # ===== 9. System Health (6 cases) =====
    ("系统健康", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "CONFIG_RESET", None], "system_health"),
    ("服务状态", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "ISAPI_QUERY_CAPABILITIES", None], "system_health"),
    ("数据库连接", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "CONFIG_RESET", "ALERT_LIST", None], "system_health"),
    ("磁盘空间", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "INVENTORY_QUERY", None], "system_health"),
    ("CPU使用率", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATS", None], "system_health"),
    ("内存占用", ["REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "INVENTORY_QUERY", None], "system_health"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 97 ===")
    print(f"Focus: SYSTEM INTEGRATION & API queries")
    print(f"       (erp_sync, wms_integration, mes_connect, iot_device,")
    print(f"        api_monitor, data_exchange, middleware, third_party, system_health)")
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
        'test': 'v5_round97_system_integration_api',
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
    report_path = f'tests/ai-intent/reports/v5_round97_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
