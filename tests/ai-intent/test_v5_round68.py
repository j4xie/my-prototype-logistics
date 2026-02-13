#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 68
Focus: ENERGY & ENVIRONMENT queries for food manufacturing.
       Covers energy usage, energy cost, temperature, humidity, waste management,
       carbon emissions, equipment energy, air quality, and noise.
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

# Round 68 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Energy Usage (6 cases) =====
    ("能耗统计", ["REPORT_PRODUCTION", "REPORT_TRENDS", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "energy_usage"),
    ("用电量", ["REPORT_PRODUCTION", "REPORT_TRENDS", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", None], "energy_usage"),
    ("水耗数据", ["REPORT_PRODUCTION", "REPORT_TRENDS", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "energy_usage"),
    ("燃气消耗", ["REPORT_PRODUCTION", "REPORT_TRENDS", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_CONSUME", None], "energy_usage"),
    ("蒸汽用量", ["REPORT_PRODUCTION", "REPORT_TRENDS", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "energy_usage"),
    ("能源报表", ["REPORT_PRODUCTION", "REPORT_TRENDS", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "energy_usage"),

    # ===== 2. Energy Cost (6 cases) =====
    ("能源成本", ["COST_QUERY", "REPORT_FINANCE", "COST_TREND_ANALYSIS", "REPORT_TRENDS", None], "energy_cost"),
    ("电费统计", ["COST_QUERY", "REPORT_FINANCE", "COST_TREND_ANALYSIS", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "energy_cost"),
    ("水费", ["COST_QUERY", "REPORT_FINANCE", "COST_TREND_ANALYSIS", "REPORT_TRENDS", None], "energy_cost"),
    ("能耗费用", ["COST_QUERY", "REPORT_FINANCE", "COST_TREND_ANALYSIS", "REPORT_TRENDS", None], "energy_cost"),
    ("单位能耗成本", ["COST_QUERY", "REPORT_FINANCE", "COST_TREND_ANALYSIS", "REPORT_TRENDS", None], "energy_cost"),
    ("能源支出", ["COST_QUERY", "REPORT_FINANCE", "COST_TREND_ANALYSIS", "REPORT_TRENDS", None], "energy_cost"),

    # ===== 3. Temperature (5 cases) =====
    ("车间温度", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", None], "temperature"),
    ("环境温度", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", None], "temperature"),
    ("冷库温度", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", None], "temperature"),
    ("温度记录", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", None], "temperature"),
    ("温度曲线", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", None], "temperature"),

    # ===== 4. Humidity (6 cases) =====
    ("湿度监控", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "humidity"),
    ("车间湿度", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "humidity"),
    ("湿度异常", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "humidity"),
    ("湿度控制", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "humidity"),
    ("除湿运行", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "humidity"),
    ("湿度记录", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "humidity"),

    # ===== 5. Waste Management (5 cases) =====
    ("废弃物处理", ["QUALITY_DISPOSITION_EXECUTE", "MATERIAL_ADJUST_QUANTITY", "REPORT_DASHBOARD_OVERVIEW", None], "waste_mgmt"),
    ("废水排放", ["QUALITY_DISPOSITION_EXECUTE", "MATERIAL_ADJUST_QUANTITY", "REPORT_DASHBOARD_OVERVIEW", None], "waste_mgmt"),
    ("固废处理", ["QUALITY_DISPOSITION_EXECUTE", "MATERIAL_ADJUST_QUANTITY", "REPORT_DASHBOARD_OVERVIEW", None], "waste_mgmt"),
    ("废料回收", ["QUALITY_DISPOSITION_EXECUTE", "MATERIAL_ADJUST_QUANTITY", "REPORT_DASHBOARD_OVERVIEW", None], "waste_mgmt"),
    ("排污记录", ["QUALITY_DISPOSITION_EXECUTE", "MATERIAL_ADJUST_QUANTITY", "REPORT_DASHBOARD_OVERVIEW", None], "waste_mgmt"),

    # ===== 6. Carbon Emissions (6 cases) =====
    ("碳排放", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "carbon"),
    ("碳足迹", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "carbon"),
    ("节能减排", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "carbon"),
    ("环保指标", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "carbon"),
    ("绿色生产", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "PROCESSING_BATCH_LIST", None], "carbon"),
    ("碳达标", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "carbon"),

    # ===== 7. Equipment Energy (5 cases) =====
    ("设备能耗", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "COST_QUERY", "REPORT_TRENDS", None], "equipment_energy"),
    ("高能耗设备", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "COST_QUERY", "REPORT_TRENDS", None], "equipment_energy"),
    ("节能设备", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "COST_QUERY", "REPORT_TRENDS", None], "equipment_energy"),
    ("能效比", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "COST_QUERY", "REPORT_TRENDS", None], "equipment_energy"),
    ("设备功率", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "COST_QUERY", "REPORT_TRENDS", None], "equipment_energy"),

    # ===== 8. Air Quality (6 cases) =====
    ("空气质量", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "air_quality"),
    ("粉尘浓度", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "air_quality"),
    ("通风状况", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "air_quality"),
    ("净化系统", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "air_quality"),
    ("洁净度", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "air_quality"),
    ("PM2.5", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "air_quality"),

    # ===== 9. Noise (5 cases) =====
    ("噪音检测", ["QUALITY_CHECK_QUERY", "COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "noise"),
    ("噪声分贝", ["QUALITY_CHECK_QUERY", "COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "noise"),
    ("降噪措施", ["QUALITY_CHECK_QUERY", "COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "noise"),
    ("噪音超标", ["QUALITY_CHECK_QUERY", "COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "noise"),
    ("环境噪声", ["QUALITY_CHECK_QUERY", "COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "noise"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 68 ===")
    print(f"Focus: ENERGY & ENVIRONMENT queries")
    print(f"       (energy usage, energy cost, temperature, humidity, waste, carbon, equipment energy, air quality, noise)")
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
        'test': 'v5_round68_energy_environment',
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
    report_path = f'tests/ai-intent/reports/v5_round68_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
