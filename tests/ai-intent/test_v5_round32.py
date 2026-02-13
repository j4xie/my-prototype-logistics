#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 32
Focus: ALERTS & ALARM MANAGEMENT - alert queries, alert handling, alarm configuration,
       escalation, notification, alert analytics.
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

# Round 32 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Active Alerts (6 cases) =====
    ("当前有什么告警", ["ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_ALERT_LIST", None], "active_alerts"),
    ("未处理的告警", ["ALERT_ACTIVE", "ALERT_LIST", None], "active_alerts"),
    ("紧急告警", ["ALERT_ACTIVE", "ALERT_LIST", "EQUIPMENT_ALERT_LIST", None], "active_alerts"),
    ("今天的告警", ["ALERT_LIST", "ALERT_ACTIVE", None], "active_alerts"),
    ("告警总数", ["ALERT_STATS", "ALERT_LIST", None], "active_alerts"),
    ("实时告警", ["ALERT_ACTIVE", "ALERT_LIST", "EQUIPMENT_ALERT_LIST", None], "active_alerts"),

    # ===== 2. Alert History (5 cases) =====
    ("告警历史", ["ALERT_LIST", "ALERT_STATS", "REPORT_TRENDS", None], "alert_history"),
    ("上周告警记录", ["ALERT_LIST", "ALERT_STATS", None], "alert_history"),
    ("告警趋势", ["ALERT_STATS", "REPORT_TRENDS", None], "alert_history"),
    ("月度告警统计", ["ALERT_STATS", "REPORT_TRENDS", None], "alert_history"),
    ("历史告警分析", ["ALERT_STATS", "ALERT_LIST", "REPORT_TRENDS", None], "alert_history"),

    # ===== 3. Alert Types (6 cases) =====
    ("设备告警", ["EQUIPMENT_ALERT_LIST", "ALERT_LIST", "ALERT_ACTIVE", None], "alert_types"),
    ("温度告警", ["COLD_CHAIN_ALERT", "COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "ALERT_ACTIVE", None], "alert_types"),
    ("库存告警", ["MATERIAL_LOW_STOCK_ALERT", "ALERT_LIST", "ALERT_ACTIVE", None], "alert_types"),
    ("质量告警", ["ALERT_LIST", "ALERT_ACTIVE", None], "alert_types"),
    ("安全告警", ["ALERT_LIST", "ALERT_ACTIVE", None], "alert_types"),
    ("过期告警", ["MATERIAL_EXPIRING_ALERT", "ALERT_LIST", "ALERT_ACTIVE", None], "alert_types"),

    # ===== 4. Alert Handling (6 cases) =====
    ("处理这个告警", ["ALERT_ACKNOWLEDGE", None], "alert_handling"),
    ("确认告警", ["ALERT_ACKNOWLEDGE", None], "alert_handling"),
    ("关闭告警", ["ALERT_ACKNOWLEDGE", "ALERT_RESOLVE", None], "alert_handling"),
    ("告警已处理", ["ALERT_ACKNOWLEDGE", None], "alert_handling"),
    ("忽略这个告警", ["ALERT_ACKNOWLEDGE", None], "alert_handling"),
    ("转发告警", [None, "ALERT_ACKNOWLEDGE", "ALERT_LIST"], "alert_handling"),

    # ===== 5. Alert Configuration (5 cases) =====
    ("告警阈值设置", ["RULE_CONFIG", None], "alert_config"),
    ("告警规则配置", ["RULE_CONFIG", None], "alert_config"),
    ("添加告警条件", ["RULE_CONFIG", "ALERT_LIST", None], "alert_config"),
    ("修改告警级别", ["RULE_CONFIG", "ALERT_BY_LEVEL", None], "alert_config"),
    ("告警通知方式", ["RULE_CONFIG", "FACTORY_NOTIFICATION_CONFIG", None], "alert_config"),

    # ===== 6. Escalation (5 cases) =====
    ("告警升级", [None, "ALERT_ACKNOWLEDGE", "ALERT_ACTIVE", "ALERT_LIST"], "escalation"),
    ("通知主管", [None, "ALERT_ACKNOWLEDGE", "FACTORY_NOTIFICATION_CONFIG"], "escalation"),
    ("紧急联系", [None], "escalation"),
    ("升级处理", [None, "ALERT_ACKNOWLEDGE"], "escalation"),
    ("二级响应", [None], "escalation"),

    # ===== 7. Alert Analytics (6 cases) =====
    ("告警频率分析", ["ALERT_STATS", "REPORT_TRENDS", None], "alert_analytics"),
    ("TOP10告警", ["ALERT_STATS", "ALERT_LIST", None], "alert_analytics"),
    ("告警分类统计", ["ALERT_STATS", None], "alert_analytics"),
    ("重复告警", ["ALERT_STATS", "ALERT_LIST", None], "alert_analytics"),
    ("误报率", ["ALERT_STATS", None], "alert_analytics"),
    ("告警响应时间", ["ALERT_STATS", "REPORT_TRENDS", None], "alert_analytics"),

    # ===== 8. Predictive Alerts (5 cases) =====
    ("预测性告警", ["ALERT_DIAGNOSE", "ALERT_LIST", None], "predictive_alerts"),
    ("异常预警", ["ALERT_DIAGNOSE", "ALERT_ACTIVE", "ALERT_LIST", None], "predictive_alerts"),
    ("趋势告警", ["ALERT_STATS", "REPORT_TRENDS", "ALERT_LIST", None], "predictive_alerts"),
    ("提前预警", ["ALERT_DIAGNOSE", "ALERT_LIST", None], "predictive_alerts"),
    ("风险提示", ["ALERT_DIAGNOSE", "ALERT_LIST", None], "predictive_alerts"),

    # ===== 9. Alert Resolution (6 cases) =====
    ("告警解决方案", ["ALERT_DIAGNOSE", None], "alert_resolution"),
    ("根因分析", ["ALERT_DIAGNOSE", None], "alert_resolution"),
    ("纠正措施", ["ALERT_DIAGNOSE", None], "alert_resolution"),
    ("预防措施", ["ALERT_DIAGNOSE", None], "alert_resolution"),
    ("告警闭环", ["ALERT_ACKNOWLEDGE", "ALERT_DIAGNOSE", "ALERT_LIST", None], "alert_resolution"),
    ("复查告警", ["ALERT_LIST", "ALERT_DIAGNOSE", None], "alert_resolution"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 32 ===")
    print(f"Focus: ALERTS & ALARM MANAGEMENT - alert queries, alert handling,")
    print(f"       alarm configuration, escalation, notification, alert analytics")
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
        'test': 'v5_round32_alerts_alarm_management',
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
    report_path = f'tests/ai-intent/reports/v5_round32_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
