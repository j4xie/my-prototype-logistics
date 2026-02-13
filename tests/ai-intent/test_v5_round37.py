#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 37
Focus: MULTI-INTENT & DISAMBIGUATION - compound queries spanning multiple domains,
       sequential actions, conditional logic, comparisons, aggregations,
       negation, implicit intent, and follow-up queries.
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

# Round 37 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Two-Domain Queries (6 cases) =====
    ("产量和质量都查一下", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_QUALITY", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "two_domain"),
    ("库存和订单情况", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "two_domain"),
    ("设备和人员都看看", ["EQUIPMENT_STATUS_QUERY", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "two_domain"),
    ("质检和发货进度", ["QUALITY_CHECK_QUERY", "SHIPMENT_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "two_domain"),
    ("成本和产量对比", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "two_domain"),
    ("出勤和产能关系", ["ATTENDANCE_STATS", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", None], "two_domain"),

    # ===== 2. Sequential Actions (6 cases) =====
    ("先质检再入库", ["QUALITY_CHECK_QUERY", "INVENTORY_QUERY", "PROCESSING_BATCH_LIST", "QUALITY_CHECK_EXECUTE", None], "sequential"),
    ("检查完了再发货", ["QUALITY_CHECK_QUERY", "SHIPMENT_QUERY", None], "sequential"),
    ("盘点后再补货", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "MATERIAL_LOW_STOCK_ALERT", "REPORT_INVENTORY", None], "sequential"),
    ("审批通过后排产", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "sequential"),
    ("采购到货后质检", ["QUALITY_CHECK_QUERY", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "QUALITY_CHECK_EXECUTE", None], "sequential"),
    ("生产完成后贴标", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_COMPLETE", None], "sequential"),

    # ===== 3. Conditional Queries (6 cases) =====
    ("如果库存不够就采购", ["INVENTORY_QUERY", "MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY", None], "conditional"),
    ("产量达标的话安排发货", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "SHIPMENT_QUERY", "SHIPMENT_CREATE", None], "conditional"),
    ("质检合格就入库", ["QUALITY_CHECK_QUERY", "INVENTORY_QUERY", None], "conditional"),
    ("设备正常就开始生产", ["EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_START", None], "conditional"),
    ("到期的物料处理掉", ["MATERIAL_BATCH_QUERY", "MATERIAL_LOW_STOCK_ALERT", "INVENTORY_QUERY", "MATERIAL_EXPIRING_ALERT", None], "conditional"),
    ("超标了就报警", ["ALERT_LIST", "COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", None], "conditional"),

    # ===== 4. Comparative (5 cases) =====
    ("A车间和B车间哪个产量高", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_TRENDS", None], "comparative"),
    ("哪个供应商更便宜", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", "SUPPLIER_LIST", None], "comparative"),
    ("两个批次质量对比", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "PROCESSING_BATCH_LIST", "QUALITY_STATS", None], "comparative"),
    ("上周和这周效率比较", ["REPORT_PRODUCTION", "REPORT_TRENDS", "PRODUCTION_STATUS_QUERY", "ATTENDANCE_STATS", "REPORT_EFFICIENCY", None], "comparative"),
    ("哪条产线利用率最高", ["EQUIPMENT_STATUS_QUERY", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "comparative"),

    # ===== 5. Aggregation (6 cases) =====
    ("所有车间的总产量", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "aggregation"),
    ("各仓库库存汇总", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_INVENTORY", None], "aggregation"),
    ("全厂设备利用率", ["EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATS", None], "aggregation"),
    ("每条线的合格率", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_PRODUCTION", "QUALITY_STATS", None], "aggregation"),
    ("各班组出勤率", ["ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "aggregation"),
    ("所有订单完成率", ["ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "aggregation"),

    # ===== 6. Prioritization (5 cases) =====
    ("最紧急的告警", ["ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "prioritization"),
    ("优先级最高的订单", ["ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "prioritization"),
    ("最需要补货的物料", ["MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", None], "prioritization"),
    ("最近到期的批次", ["MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_LIST", "INVENTORY_QUERY", "MATERIAL_EXPIRING_ALERT", None], "prioritization"),
    ("问题最多的设备", ["EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_ALERT_LIST", None], "prioritization"),

    # ===== 7. Negation Intent (6 cases) =====
    ("不是查产量是查质量", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_PRODUCTION", None], "negation"),
    ("别看库存看订单", ["ORDER_LIST", "MATERIAL_BATCH_QUERY", None], "negation"),
    ("不要统计要明细", ["PROCESSING_BATCH_LIST", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "ORDER_LIST", None], "negation"),
    ("不是今天是昨天的", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "negation"),
    ("取消刚才的操作", [None], "negation"),
    ("不需要打印", [None], "negation"),

    # ===== 8. Implicit Intent (5 cases) =====
    ("原料快用完了", ["MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", None], "implicit"),
    ("温度有点高", ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", None], "implicit"),
    ("这批货颜色不对", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "PROCESSING_BATCH_LIST", None], "implicit"),
    ("客户催了", ["ORDER_LIST", "SHIPMENT_QUERY", None], "implicit"),
    ("又坏了", ["EQUIPMENT_STATUS_QUERY", "ALERT_LIST", None], "implicit"),

    # ===== 9. Follow-up (5 cases) =====
    ("详细看看", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "QUERY_GENERIC_DETAIL", None], "followup"),
    ("展开说说", ["REPORT_DASHBOARD_OVERVIEW", None], "followup"),
    ("有没有图表", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "followup"),
    ("导出这个", [None, "REPORT_DASHBOARD_OVERVIEW"], "followup"),
    ("发给经理", [None, "SHIPMENT_CREATE"], "followup"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 37 ===")
    print(f"Focus: MULTI-INTENT & DISAMBIGUATION - compound queries, sequential actions,")
    print(f"       conditional logic, comparisons, aggregations, negation, implicit intent")
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
        'test': 'v5_round37_multi_intent_disambiguation',
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
    report_path = f'tests/ai-intent/reports/v5_round37_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
