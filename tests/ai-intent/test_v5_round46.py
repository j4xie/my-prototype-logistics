#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 46
Focus: SHIPMENT & DELIVERY queries.
       Covers shipment create, shipment query, delivery confirm, logistics,
       return/exchange, packing, shipping docs, delivery schedule,
       and shipping alerts.
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

# Round 46 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Shipment Create (6 cases) =====
    ("安排发货", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", "ORDER_STATUS", None], "shipment_create"),
    ("创建发货单", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", "ORDER_LIST", None], "shipment_create"),
    ("发一批货", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", "MATERIAL_BATCH_CREATE", None], "shipment_create"),
    ("出库发货", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", "REPORT_INVENTORY", None], "shipment_create"),
    ("打包发货", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", None], "shipment_create"),
    ("准备装车", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", None], "shipment_create"),

    # ===== 2. Shipment Query (6 cases) =====
    ("发货记录", ["SHIPMENT_QUERY", "SHIPMENT_BY_DATE", "ORDER_LIST", None], "shipment_query"),
    ("今天发了几单", ["SHIPMENT_BY_DATE", "SHIPMENT_QUERY", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "shipment_query"),
    ("待发货订单", ["ORDER_LIST", "ORDER_STATUS", "SHIPMENT_QUERY", None], "shipment_query"),
    ("发货状态", ["SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", "ORDER_STATUS", None], "shipment_query"),
    ("物流跟踪", ["SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", "ORDER_STATUS", None], "shipment_query"),
    ("运输进度", ["SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", "ORDER_STATUS", None], "shipment_query"),

    # ===== 3. Delivery Confirm (5 cases) =====
    ("签收确认", ["SHIPMENT_STATUS_UPDATE", "SHIPMENT_QUERY", "ORDER_STATUS", None], "delivery_confirm"),
    ("到货确认", ["SHIPMENT_STATUS_UPDATE", "SHIPMENT_QUERY", "MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CREATE", None], "delivery_confirm"),
    ("收货验收", ["SHIPMENT_STATUS_UPDATE", "QUALITY_CHECK_EXECUTE", "MATERIAL_BATCH_QUERY", None], "delivery_confirm"),
    ("客户已签收", ["SHIPMENT_STATUS_UPDATE", "SHIPMENT_QUERY", "ORDER_STATUS", None], "delivery_confirm"),
    ("配送完成", ["SHIPMENT_STATUS_UPDATE", "SHIPMENT_QUERY", "ORDER_STATUS", None], "delivery_confirm"),

    # ===== 4. Logistics (6 cases) =====
    ("物流费用", ["SHIPMENT_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "logistics"),
    ("运费计算", ["SHIPMENT_QUERY", "SHIPMENT_CREATE", "COST_QUERY", None], "logistics"),
    ("配送路线", ["SHIPMENT_QUERY", "SHIPMENT_CREATE", None], "logistics"),
    ("物流商选择", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", None], "logistics"),
    ("装车清单", ["SHIPMENT_QUERY", "SHIPMENT_CREATE", "ORDER_LIST", None], "logistics"),
    ("车辆安排", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", None], "logistics"),

    # ===== 5. Return/Exchange (5 cases) =====
    ("退货申请", ["SHIPMENT_STATUS_UPDATE", "SHIPMENT_QUERY", "ORDER_STATUS", "QUALITY_CHECK_QUERY", "MATERIAL_BATCH_QUERY", None], "return_exchange"),
    ("换货处理", ["SHIPMENT_STATUS_UPDATE", "SHIPMENT_CREATE", "ORDER_STATUS", "MATERIAL_BATCH_QUERY", None], "return_exchange"),
    ("退回入库", ["MATERIAL_BATCH_CREATE", "SHIPMENT_STATUS_UPDATE", "REPORT_INVENTORY", None], "return_exchange"),
    ("退货原因", ["SHIPMENT_QUERY", "QUALITY_CHECK_QUERY", "ALERT_LIST", "ALERT_DIAGNOSE", None], "return_exchange"),
    ("退款处理", ["ORDER_STATUS", "SHIPMENT_STATUS_UPDATE", None], "return_exchange"),

    # ===== 6. Packing (6 cases) =====
    ("包装方式", ["SHIPMENT_QUERY", "MATERIAL_BATCH_QUERY", "QUALITY_CHECK_QUERY", None], "packing"),
    ("装箱清单", ["SHIPMENT_QUERY", "SHIPMENT_CREATE", "ORDER_LIST", None], "packing"),
    ("包装材料", ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", None], "packing"),
    ("外箱标识", ["LABEL_PRINT", "SHIPMENT_CREATE", None], "packing"),
    ("托盘码放", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", "MATERIAL_BATCH_QUERY", None], "packing"),
    ("包装检查", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "SHIPMENT_QUERY", None], "packing"),

    # ===== 7. Shipping Doc (5 cases) =====
    ("发货单打印", ["LABEL_PRINT", "SHIPMENT_QUERY", "SHIPMENT_CREATE", None], "shipping_doc"),
    ("送货单", ["SHIPMENT_QUERY", "SHIPMENT_CREATE", "LABEL_PRINT", None], "shipping_doc"),
    ("装箱单", ["SHIPMENT_QUERY", "LABEL_PRINT", "ORDER_LIST", None], "shipping_doc"),
    ("提货单", ["SHIPMENT_QUERY", "SHIPMENT_CREATE", "ORDER_LIST", None], "shipping_doc"),
    ("运输单据", ["SHIPMENT_QUERY", "LABEL_PRINT", None], "shipping_doc"),

    # ===== 8. Delivery Schedule (6 cases) =====
    ("发货排期", ["SHIPMENT_QUERY", "SHIPMENT_BY_DATE", "SHIPMENT_CREATE", "ORDER_LIST", "MATERIAL_BATCH_QUERY", None], "delivery_schedule"),
    ("配送计划", ["SHIPMENT_QUERY", "SHIPMENT_CREATE", "ORDER_LIST", None], "delivery_schedule"),
    ("到货时间", ["SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", "ORDER_STATUS", "MATERIAL_BATCH_QUERY", None], "delivery_schedule"),
    ("预计送达", ["SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", "ORDER_STATUS", None], "delivery_schedule"),
    ("运输时效", ["SHIPMENT_QUERY", "SHIPMENT_BY_DATE", "REPORT_DASHBOARD_OVERVIEW", None], "delivery_schedule"),
    ("紧急配送", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", "ALERT_LIST", None], "delivery_schedule"),

    # ===== 9. Shipping Alert (5 cases) =====
    ("延迟发货", ["ALERT_LIST", "SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", "MATERIAL_BATCH_QUERY", None], "shipping_alert"),
    ("配送异常", ["ALERT_LIST", "SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", None], "shipping_alert"),
    ("温度超标", ["COLD_CHAIN_ALERT", "COLD_CHAIN_TEMPERATURE", "ALERT_LIST", None], "shipping_alert"),
    ("货损报告", ["ALERT_LIST", "SHIPMENT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", None], "shipping_alert"),
    ("丢件处理", ["ALERT_LIST", "SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", "QUALITY_DISPOSITION_EXECUTE", None], "shipping_alert"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 46 ===")
    print(f"Focus: SHIPMENT & DELIVERY queries")
    print(f"       (shipment create, shipment query, delivery confirm, logistics,")
    print(f"        return/exchange, packing, shipping docs, delivery schedule, shipping alerts)")
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
        'test': 'v5_round46_shipment_delivery',
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
    report_path = f'tests/ai-intent/reports/v5_round46_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
