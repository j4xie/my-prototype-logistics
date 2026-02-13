#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 14
Focus: ADVERSARIAL ROBUSTNESS - injection-style inputs, encoding edge cases,
       extreme repetition, semantic traps, boundary-length inputs, multi-domain
       bleed, instruction-following confusion, numerical overflow.
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

# Round 14 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Repetition Stress (5 cases) =====
    ("产量产量产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "repeat-triple"),
    ("查查查库存", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "repeat-verb"),
    ("设备设备", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST"], "repeat-double"),
    ("快快快查告警", ["ALERT_LIST", "ALERT_ACTIVE"], "repeat-urgent"),
    ("质检质检结果", ["QUALITY_CHECK_QUERY", "QUALITY_STATS"], "repeat-mixed"),

    # ===== 2. Semantic Traps (6 cases) =====
    # Inputs that look like one thing but should be another
    ("设备的质量", ["EQUIPMENT_STATUS_QUERY", "QUALITY_STATS", "EQUIPMENT_LIST", "QUALITY_CHECK_QUERY"], "trap-equip-quality"),
    ("生产的问题", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "ALERT_LIST", "PROCESSING_BATCH_LIST", None], "trap-prod-problem"),
    ("订单的材料", ["MATERIAL_BATCH_QUERY", "ORDER_STATUS", "ORDER_LIST"], "trap-order-material"),
    ("告警的统计", ["ALERT_LIST", "ALERT_STATS", "ALERT_ACTIVE"], "trap-alert-stats"),
    ("考勤的报表", ["ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW"], "trap-attend-report"),
    ("成本的趋势", ["REPORT_FINANCE", "REPORT_TRENDS"], "trap-cost-trend"),

    # ===== 3. Boundary Length Inputs (6 cases) =====
    # Single character, very long, exact threshold
    ("查", [None, "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW"], "boundary-1char"),
    ("看", [None, "REPORT_DASHBOARD_OVERVIEW"], "boundary-1char-look"),
    ("产", [None], "boundary-1char-prod"),
    # 3-char business terms
    ("合格率", ["QUALITY_STATS"], "boundary-3char-rate"),
    ("出勤率", ["ATTENDANCE_STATS"], "boundary-3char-attend"),
    # Very long (100+ chars)
    ("我想要看一下今天上午从八点到十二点之间所有产线的总产量以及每条线各自的产量明细还有质检合格率和不合格的原因分析能帮我整理一下吗",
     ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "boundary-ultralong"),

    # ===== 4. Multi-Domain Bleed (6 cases) =====
    # Queries touching 2+ domains that should pick the primary one
    ("库存和产量的关系", ["REPORT_INVENTORY", "REPORT_PRODUCTION", "REPORT_TRENDS", None], "bleed-inv-prod"),
    ("质检影响了交货", ["QUALITY_CHECK_QUERY", "SHIPMENT_QUERY", "ORDER_STATUS", None], "bleed-qual-ship"),
    ("设备故障导致停产", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "PRODUCTION_STATUS_QUERY", "EQUIPMENT_ALERT_LIST"], "bleed-equip-prod"),
    ("原料问题影响质量", ["MATERIAL_BATCH_QUERY", "QUALITY_CHECK_QUERY", "MATERIAL_LOW_STOCK_ALERT", None], "bleed-mat-qual"),
    ("人员不足产量下降", ["ATTENDANCE_STATS", "REPORT_PRODUCTION", "ATTENDANCE_TODAY", None], "bleed-hr-prod"),
    ("供应商延迟导致缺料", ["SUPPLIER_EVALUATE", "MATERIAL_BATCH_QUERY", "SUPPLIER_LIST", "ORDER_STATUS", None], "bleed-supplier-mat"),

    # ===== 5. Number-Heavy Queries (5 cases) =====
    ("123456", [None, "FORM_GENERATION"], "numeric-pure-number"),
    ("产量超过1000吨了吗", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY"], "numeric-threshold"),
    ("3号设备2号传感器温度", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY"], "numeric-sensor"),
    ("第5批次第3道工序", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", None], "numeric-process-step"),
    ("2026年2月的月报", ["REPORT_FINANCE", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW"], "numeric-date-report"),

    # ===== 6. Instruction-Like Inputs (5 cases) =====
    # Inputs that sound like instructions to the AI rather than business queries
    ("请用中文回答", [None, "FORM_GENERATION"], "instruct-language"),
    ("帮我分析一下", [None, "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS"], "instruct-analyze"),
    ("重新查询", [None, "QUERY_RETRY_LAST"], "instruct-retry"),
    ("显示更多", [None], "instruct-show-more"),
    ("返回上一页", [None], "instruct-go-back"),

    # ===== 7. Seasonal/Contextual Business (5 cases) =====
    ("春节前备货情况", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", None], "seasonal-spring-stock"),
    ("旺季产能规划", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_EFFICIENCY", None], "seasonal-peak-capacity"),
    ("年底盘点进度", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", None], "seasonal-yearend-count"),
    ("节后复工出勤", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "seasonal-post-holiday"),
    ("双十一订单状态", ["ORDER_STATUS", "ORDER_LIST"], "seasonal-1111-orders"),

    # ===== 8. Comparative Queries (6 cases) =====
    ("A线比B线快多少", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "REPORT_TRENDS", None], "compare-line-speed"),
    ("今天比昨天多吗", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_TRENDS", None], "compare-day-over-day"),
    ("哪个仓库最满", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", None], "compare-warehouse-full"),
    ("最差的设备是哪台", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "EQUIPMENT_ALERT_LIST", None], "compare-worst-equip"),
    ("合格率最低的批次", ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_QUALITY"], "compare-worst-batch"),
    ("谁今天干得最多", ["REPORT_PRODUCTION", "ATTENDANCE_STATS", "PRODUCTION_STATUS_QUERY", None], "compare-top-worker"),

    # ===== 9. Edge Case Encoding (6 cases) =====
    ("　产量　", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "encoding-fullwidth-space"),
    ("设备STATUS", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", None], "encoding-mixed-case"),
    ("ＯＥＥ效率", ["REPORT_EFFICIENCY", "EQUIPMENT_STATS"], "encoding-fullwidth-latin"),
    ("库 存 查 询", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", None], "encoding-spaced-chars"),
    ("告.警.列.表", ["ALERT_LIST", "ALERT_ACTIVE", None], "encoding-dotted"),
    ("质检report", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY"], "encoding-mixed-lang"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 14 ===")
    print(f"Focus: ADVERSARIAL ROBUSTNESS - repetition, semantic traps, boundary length,")
    print(f"       multi-domain bleed, numeric-heavy, instruction-like, seasonal,")
    print(f"       comparative, encoding edge cases")
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
        'test': 'v5_round14_adversarial_robustness',
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
    report_path = f'tests/ai-intent/reports/v5_round14_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
