#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 30
Focus: EDGE CASES & STRESS TEST - unusual inputs, very short/long queries,
       special characters, typos, mixed language, emoji, repeated words.
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

# Round 30 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Ultra-Short Queries (6 cases) =====
    ("产量", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "ultrashort"),
    ("质检", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", None], "ultrashort"),
    ("库存", ["INVENTORY_QUERY", "INVENTORY_LIST", "MATERIAL_LIST", "REPORT_INVENTORY", None], "ultrashort"),
    ("订单", ["ORDER_LIST", "ORDER_DETAIL", None], "ultrashort"),
    ("设备", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", None], "ultrashort"),
    ("排班", ["SCHEDULING_QUERY", "SCHEDULING_LIST", "SHIFT_SCHEDULE_QUERY", "ATTENDANCE_STATS", None], "ultrashort"),

    # ===== 2. Very Long Queries (5 cases) =====
    ("帮我看看上个月A车间二号线的豆腐产品日均产量和合格率对比情况", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "verylong"),
    ("我想查一下最近三个月所有仓库的原材料入库出库记录明细和库存周转率趋势", ["INVENTORY_QUERY", "INVENTORY_LIST", "WAREHOUSE_INBOUND_LIST", "WAREHOUSE_OUTBOUND_LIST", "REPORT_DASHBOARD_OVERVIEW", "REPORT_INVENTORY", None], "verylong"),
    ("请统计一下本季度各个班组的产量排名以及优秀员工推荐名单和绩效评分", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "HR_ATTENDANCE_REPORT", None], "verylong"),
    ("能不能帮我分析一下上周五到这周三期间B车间所有设备的运行时间和故障率", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "REPORT_EQUIPMENT", None], "verylong"),
    ("我需要一份包含原材料采购成本和生产损耗率以及成品合格率的综合分析报告", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_QUALITY", "COST_ANALYSIS_QUERY", None], "verylong"),

    # ===== 3. With Numbers (6 cases) =====
    ("查一下批次20260210-003", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_TIMELINE", "BATCH_DETAIL", "MATERIAL_BATCH_QUERY", None], "numbers"),
    ("B线产了500件了", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None], "numbers"),
    ("仓库3号库区", ["INVENTORY_QUERY", "INVENTORY_LIST", "WAREHOUSE_INBOUND_LIST", "REPORT_INVENTORY", None], "numbers"),
    ("温度是不是超过25度了", ["ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_STATUS_QUERY", "COLD_CHAIN_TEMPERATURE", None], "numbers"),
    ("第3批的质检", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "PROCESSING_BATCH_DETAIL", "QUALITY_CHECK_EXECUTE", None], "numbers"),
    ("还有200公斤没用完", ["INVENTORY_QUERY", "MATERIAL_LIST", "MATERIAL_ADJUST_QUANTITY", None], "numbers"),

    # ===== 4. Typos/Misspellings (5 cases) =====
    ("产晾", [None, "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY"], "typo"),
    ("库寸", [None, "INVENTORY_QUERY", "INVENTORY_LIST"], "typo"),
    ("只检", [None, "QUALITY_CHECK_QUERY"], "typo"),
    ("设贝", [None, "EQUIPMENT_STATUS_QUERY"], "typo"),
    ("发霍", [None], "typo"),

    # ===== 5. Mixed Language (5 cases) =====
    ("check产量", [None, "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY"], "mixedlang"),
    ("quality报告", [None, "REPORT_QUALITY", "QUALITY_CHECK_QUERY"], "mixedlang"),
    ("KPI达标了吗", ["REPORT_DASHBOARD_OVERVIEW", "KPI_QUERY", "REPORT_KPI", None], "mixedlang"),
    ("OEE多少", ["EQUIPMENT_STATUS_QUERY", "REPORT_EQUIPMENT", "OEE_QUERY", "REPORT_EFFICIENCY", None], "mixedlang"),
    ("FIFO执行", [None, "INVENTORY_QUERY", "WAREHOUSE_INBOUND_LIST", "MATERIAL_FIFO_RECOMMEND"], "mixedlang"),

    # ===== 6. Repeated Words (5 cases) =====
    ("产量产量", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "repeated"),
    ("快快快发货", ["ORDER_LIST", "WAREHOUSE_OUTBOUND_LIST", "SHIPMENT_CREATE", None], "repeated"),
    ("查查查", [None], "repeated"),
    ("订单订单查一下", ["ORDER_LIST", "ORDER_DETAIL", None], "repeated"),
    ("急急急", [None], "repeated"),

    # ===== 7. With Punctuation (6 cases) =====
    ("产量？", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "punctuation"),
    ("发货！", ["ORDER_LIST", "WAREHOUSE_OUTBOUND_LIST", "SHIPMENT_CREATE", None], "punctuation"),
    ("这个怎么办...", [None], "punctuation"),
    ("库存，告警，都看看", ["INVENTORY_QUERY", "ALERT_LIST", "ALERT_ACTIVE", "MATERIAL_LOW_STOCK_ALERT", None], "punctuation"),
    ("质检——结果", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", None], "punctuation"),
    ("产量~", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "punctuation"),

    # ===== 8. Conversational (6 cases) =====
    ("你好帮我看一下产量", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "conversational"),
    ("请问库存怎么样", ["INVENTORY_QUERY", "INVENTORY_LIST", "MATERIAL_BATCH_QUERY", None], "conversational"),
    ("麻烦查一下订单", ["ORDER_LIST", "ORDER_DETAIL", None], "conversational"),
    ("谢谢帮看看质量", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "QUALITY_STATS", None], "conversational"),
    ("帮忙统计一下", [None, "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION"], "conversational"),
    ("辛苦查下设备", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", None], "conversational"),

    # ===== 9. Nonsensical/Out-of-scope (6 cases) =====
    ("今天天气怎么样", [None], "nonsensical"),
    ("帮我订个外卖", [None], "nonsensical"),
    ("放首歌听听", [None, "MEDIA_PLAY_MUSIC"], "nonsensical"),
    ("明天股票行情", [None], "nonsensical"),
    ("给我讲个笑话", [None], "nonsensical"),
    ("翻译一下这段话", [None, "FORM_GENERATION"], "nonsensical"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 30 ===")
    print(f"Focus: EDGE CASES & STRESS TEST - unusual inputs, very short/long queries,")
    print(f"       special characters, typos, mixed language, repeated words")
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
        'test': 'v5_round30_edge_cases_stress',
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
    report_path = f'tests/ai-intent/reports/v5_round30_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
