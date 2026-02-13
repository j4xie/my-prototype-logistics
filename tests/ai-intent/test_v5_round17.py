#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 17
Focus: EQUIPMENT & IoT OPERATIONS - queries about machinery, sensors,
       maintenance, calibration, energy, predictive maintenance,
       spare parts, alarms, and production line operations.
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

# Round 17 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Equipment Status Checks (6 cases) =====
    ("所有设备的运行状态",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "EQUIPMENT_STATS"], "status-overview"),
    ("设备OEE是多少",
     ["EQUIPMENT_STATS", "EQUIPMENT_STATUS_QUERY", "REPORT_EFFICIENCY"], "status-oee"),
    ("设备稼动率查询",
     ["EQUIPMENT_STATS", "EQUIPMENT_STATUS_QUERY", "REPORT_EFFICIENCY"], "status-utilization"),
    ("目前有多少设备在线",
     ["EQUIPMENT_LIST", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS"], "status-online"),
    ("哪些设备处于停机状态",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "EQUIPMENT_ALERT_LIST", "EQUIPMENT_MAINTENANCE"], "status-stopped"),
    ("各设备负载情况",
     ["EQUIPMENT_STATS", "EQUIPMENT_STATUS_QUERY", "REPORT_EFFICIENCY", None], "status-load"),

    # ===== 2. Maintenance Queries (6 cases) =====
    ("查看设备维修记录",
     ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY"], "maint-history"),
    ("下周的设备保养计划",
     ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY"], "maint-schedule"),
    ("预防性维护任务清单",
     ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST"], "maint-preventive"),
    ("3号灌装机故障历史",
     ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST"], "maint-fault-history"),
    ("待处理的维修工单有哪些",
     ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_ALERT_LIST", "ALERT_LIST"], "maint-workorders"),
    ("备件库存够不够维修用",
     ["EQUIPMENT_MAINTENANCE", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "MATERIAL_LOW_STOCK_ALERT"], "maint-spares-stock"),

    # ===== 3. Sensor & Monitoring (6 cases) =====
    ("传感器数据汇总",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "COLD_CHAIN_TEMPERATURE"], "sensor-overview"),
    ("冷库温度传感器当前读数",
     ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY"], "sensor-temperature"),
    ("锅炉压力传感器是否正常",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "ALERT_LIST", None], "sensor-pressure"),
    ("电机振动检测数据",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "EQUIPMENT_ALERT_LIST"], "sensor-vibration"),
    ("管道流量计读数多少",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "COLD_CHAIN_TEMPERATURE", None], "sensor-flowmeter"),
    ("储罐液位是否达到警戒线",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "ALERT_LIST", "COLD_CHAIN_TEMPERATURE", None], "sensor-level"),

    # ===== 4. Alarm & Alerts (6 cases) =====
    ("当前设备有什么告警",
     ["EQUIPMENT_ALERT_LIST", "ALERT_LIST", "ALERT_ACTIVE"], "alarm-current"),
    ("过去一周的报警历史",
     ["EQUIPMENT_ALERT_LIST", "ALERT_LIST", "ALERT_STATS"], "alarm-history"),
    ("未处理的设备告警有几条",
     ["EQUIPMENT_ALERT_LIST", "ALERT_ACTIVE", "ALERT_LIST"], "alarm-unhandled"),
    ("告警阈值设置是否合理",
     ["EQUIPMENT_ALERT_LIST", "ALERT_STATS", "EQUIPMENT_STATUS_QUERY", "RULE_CONFIG", None], "alarm-threshold"),
    ("有没有紧急设备告警",
     ["EQUIPMENT_ALERT_LIST", "ALERT_ACTIVE", "ALERT_LIST"], "alarm-urgent"),
    ("本月告警趋势怎么样",
     ["ALERT_STATS", "EQUIPMENT_ALERT_LIST", "REPORT_TRENDS"], "alarm-trend"),

    # ===== 5. Production Line Operations (5 cases) =====
    ("哪条产线在停机",
     ["EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "EQUIPMENT_STOP"], "line-downtime"),
    ("A线换线需要多长时间",
     ["EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", "REPORT_EFFICIENCY", None], "line-changeover"),
    ("各产线效率对比",
     ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "EQUIPMENT_STATS", "PRODUCTION_STATUS_QUERY"], "line-efficiency"),
    ("瓶颈工序在哪里",
     ["REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "EQUIPMENT_STATS", None], "line-bottleneck"),
    ("产线节拍时间是多少",
     ["REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATS", None], "line-takt"),

    # ===== 6. Energy & Utilities (5 cases) =====
    ("今天工厂耗电量多少",
     ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", None], "energy-electricity"),
    ("本月用水量统计",
     ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", None], "energy-water"),
    ("蒸汽用量是否超标",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "EQUIPMENT_STATS", None], "energy-steam"),
    ("各车间能耗统计对比",
     ["REPORT_EFFICIENCY", "EQUIPMENT_STATS", "REPORT_TRENDS", None], "energy-comparison"),
    ("空压机压力是否正常",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "COLD_CHAIN_TEMPERATURE", None], "energy-compressor"),

    # ===== 7. Calibration (5 cases) =====
    ("设备校准到期提醒",
     ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_ALERT_LIST", "EQUIPMENT_STATUS_QUERY", "MATERIAL_EXPIRING_ALERT"], "cal-due"),
    ("电子秤校准记录",
     ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", "SCALE_DEVICE_DETAIL"], "cal-scale"),
    ("温度计校准是否过期",
     ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_ALERT_LIST", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", "MATERIAL_EXPIRING_ALERT"], "cal-thermometer"),
    ("在用计量器具清单",
     ["EQUIPMENT_LIST", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "SCALE_LIST_DEVICES"], "cal-instruments"),
    ("哪些设备校准即将到期",
     ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_ALERT_LIST", "EQUIPMENT_STATUS_QUERY", "MATERIAL_EXPIRING_ALERT"], "cal-expiring"),

    # ===== 8. Predictive Maintenance (5 cases) =====
    ("设备寿命预测分析",
     ["EQUIPMENT_STATS", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", None], "predict-lifespan"),
    ("有没有设备故障预警",
     ["EQUIPMENT_ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_MAINTENANCE", "ALERT_LIST", "EQUIPMENT_STATUS_QUERY"], "predict-early-warning"),
    ("设备健康度评分",
     ["EQUIPMENT_STATS", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", None], "predict-health"),
    ("异常检测结果有哪些",
     ["EQUIPMENT_ALERT_LIST", "ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_STATUS_QUERY"], "predict-anomaly"),
    ("设备运行数据有没有趋势异常",
     ["EQUIPMENT_ALERT_LIST", "EQUIPMENT_STATS", "ALERT_STATS", "REPORT_TRENDS"], "predict-trend-anomaly"),

    # ===== 9. Spare Parts & Tools (6 cases) =====
    ("查询备件库存情况",
     ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "EQUIPMENT_MAINTENANCE", "MATERIAL_LOW_STOCK_ALERT"], "spare-query"),
    ("今天工具领用记录",
     ["EQUIPMENT_MAINTENANCE", "MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CONSUME", None], "spare-tool-checkout"),
    ("上月备件消耗排名",
     ["EQUIPMENT_STATS", "REPORT_INVENTORY", "EQUIPMENT_MAINTENANCE", "MATERIAL_BATCH_QUERY", None], "spare-consumption"),
    ("模具寿命还剩多少",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", None], "spare-mold-life"),
    ("刀具更换记录查询",
     ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", None], "spare-tool-change"),
    ("需要申购哪些备件",
     ["MATERIAL_LOW_STOCK_ALERT", "EQUIPMENT_MAINTENANCE", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", None], "spare-procurement"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 17 ===")
    print(f"Focus: EQUIPMENT & IoT OPERATIONS - machinery status, sensors,")
    print(f"       maintenance, calibration, energy, predictive maintenance,")
    print(f"       alarms, production line ops, spare parts & tools")
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
        'test': 'v5_round17_equipment_iot_operations',
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
    report_path = f'tests/ai-intent/reports/v5_round17_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
