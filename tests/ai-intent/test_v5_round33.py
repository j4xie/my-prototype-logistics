#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 33
Focus: IoT & DEVICE MANAGEMENT - scales, cameras, sensors, ISAPI devices,
       device configuration, data collection.
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

# Round 33 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Scale Devices (6 cases) =====
    ("查看电子秤列表", ["SCALE_LIST_DEVICES", "EQUIPMENT_LIST", None], "scale"),
    ("秤的读数是多少", ["SCALE_DEVICE_DETAIL", "EQUIPMENT_STATUS_QUERY", None], "scale"),
    ("今天的称重记录", ["SCALE_DEVICE_DETAIL", "REPORT_PRODUCTION", "SCALE_LIST_DEVICES", None], "scale"),
    ("校准电子秤", ["SCALE_DEVICE_DETAIL", "EQUIPMENT_MAINTENANCE", None], "scale"),
    ("电子秤连接状态", ["SCALE_LIST_DEVICES", "EQUIPMENT_STATUS_QUERY", "SCALE_DEVICE_DETAIL", None], "scale"),
    ("添加一台新的电子秤", ["SCALE_ADD_DEVICE_VISION", "SCALE_ADD_DEVICE", None], "scale"),

    # ===== 2. Camera/ISAPI (6 cases) =====
    ("摄像头列表", ["EQUIPMENT_LIST", None], "camera"),
    ("调出昨天的视频回放", [None, "EQUIPMENT_STATUS_QUERY"], "camera"),
    ("打开实时监控画面", [None, "EQUIPMENT_STATUS_QUERY"], "camera"),
    ("摄像头运行状态", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", None], "camera"),
    ("查询今天上午的录像", [None, "EQUIPMENT_STATUS_QUERY"], "camera"),
    ("抓拍当前画面", [None, "EQUIPMENT_STATUS_QUERY"], "camera"),

    # ===== 3. Temperature Sensors (5 cases) =====
    ("温度传感器读数", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", None], "temperature"),
    ("冷库现在温度多少", ["COLD_CHAIN_TEMPERATURE", "COLD_CHAIN_ALERT", None], "temperature"),
    ("查看温度变化曲线", ["COLD_CHAIN_TEMPERATURE", None], "temperature"),
    ("温度异常报警", ["COLD_CHAIN_ALERT", "EQUIPMENT_ALERT_LIST", "ALERT_LIST", None], "temperature"),
    ("温度探头需要校准", ["EQUIPMENT_MAINTENANCE", "COLD_CHAIN_TEMPERATURE", None], "temperature"),

    # ===== 4. General Sensors (6 cases) =====
    ("传感器状态查询", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", None], "sensor"),
    ("湿度传感器读数", ["EQUIPMENT_STATUS_QUERY", "COLD_CHAIN_TEMPERATURE", None], "sensor"),
    ("压力传感器数据", ["EQUIPMENT_STATUS_QUERY", "COLD_CHAIN_TEMPERATURE", None], "sensor"),
    ("流量计当前读数", ["EQUIPMENT_STATUS_QUERY", None], "sensor"),
    ("液位计报警了", ["EQUIPMENT_ALERT_LIST", "COLD_CHAIN_ALERT", "ALERT_LIST", None], "sensor"),
    ("振动传感器异常", ["EQUIPMENT_ALERT_LIST", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", None], "sensor"),

    # ===== 5. Device Configuration (5 cases) =====
    ("修改设备配置参数", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATUS_UPDATE", None], "config"),
    ("设备参数设置", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATUS_UPDATE", None], "config"),
    ("注册新设备到系统", ["SCALE_ADD_DEVICE_VISION", "EQUIPMENT_LIST", None], "config"),
    ("把传感器绑定到A车间", ["EQUIPMENT_STATUS_QUERY", None], "config"),
    ("删除离线设备", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "EQUIPMENT_STATS", None], "config"),

    # ===== 6. Data Collection (6 cases) =====
    ("数据采集状态", ["EQUIPMENT_STATUS_QUERY", None], "datacollect"),
    ("修改采集频率", ["EQUIPMENT_STATUS_QUERY", None], "datacollect"),
    ("传感器数据上传失败了", ["EQUIPMENT_ALERT_LIST", "EQUIPMENT_STATUS_QUERY", "COLD_CHAIN_TEMPERATURE", None], "datacollect"),
    ("查看实时采集数据", ["EQUIPMENT_STATUS_QUERY", "COLD_CHAIN_TEMPERATURE", "REPORT_DASHBOARD_OVERVIEW", None], "datacollect"),
    ("数据采集断点怎么处理", [None, "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW"], "datacollect"),
    ("手动补录昨天的数据", [None, "EQUIPMENT_STATUS_QUERY"], "datacollect"),

    # ===== 7. Device Maintenance (5 cases) =====
    ("设备巡检计划", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_LIST", None], "maintenance"),
    ("设备保养记录", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", None], "maintenance"),
    ("更换温度传感器", ["EQUIPMENT_MAINTENANCE", None], "maintenance"),
    ("设备维修记录查询", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", None], "maintenance"),
    ("备件更换登记", ["EQUIPMENT_MAINTENANCE", None], "maintenance"),

    # ===== 8. Connectivity (5 cases) =====
    ("设备在线状态", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", None], "connectivity"),
    ("网络连接异常", ["EQUIPMENT_ALERT_LIST", "EQUIPMENT_STATUS_QUERY", None], "connectivity"),
    ("通信故障排查", ["EQUIPMENT_ALERT_LIST", "EQUIPMENT_STATUS_QUERY", None], "connectivity"),
    ("信号强度太弱了", ["EQUIPMENT_STATUS_QUERY", None], "connectivity"),
    ("重新连接设备", ["EQUIPMENT_STATUS_QUERY", None], "connectivity"),

    # ===== 9. Device Analytics (6 cases) =====
    ("设备运行时间统计", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY", None], "analytics"),
    ("各设备利用率排名", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY", None], "analytics"),
    ("设备故障率统计分析", ["EQUIPMENT_STATS", "EQUIPMENT_ALERT_LIST", "REPORT_EFFICIENCY", "EQUIPMENT_MAINTENANCE", None], "analytics"),
    ("设备MTBF是多少", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", None], "analytics"),
    ("设备剩余寿命预测", ["EQUIPMENT_STATS", "EQUIPMENT_STATUS_QUERY", None], "analytics"),
    ("车间设备能耗统计", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "REPORT_INVENTORY", None], "analytics"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 33 ===")
    print(f"Focus: IoT & DEVICE MANAGEMENT - scales, cameras, sensors, ISAPI devices,")
    print(f"       device configuration, data collection")
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
        'test': 'v5_round33_iot_device_management',
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
    report_path = f'tests/ai-intent/reports/v5_round33_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
