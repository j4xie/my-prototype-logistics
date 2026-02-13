#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 36
Focus: LABEL & PRINTING - label generation, barcode/QR, print management,
       product/shipping/compliance labels, label queries, smart labels, label errors.
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

# Round 36 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Label Generation (6 cases) =====
    ("生成产品标签", ["LABEL_GENERATE", "LABEL_PRINT", "PRODUCT_QUERY", "PRODUCT_UPDATE", None], "label_generation"),
    ("打印批次标签", ["LABEL_PRINT", "LABEL_GENERATE", None], "label_generation"),
    ("标签模板管理", ["LABEL_QUERY", "LABEL_PRINT", None], "label_generation"),
    ("自定义标签格式", ["LABEL_GENERATE", "LABEL_PRINT", None], "label_generation"),
    ("标签内容编辑", ["LABEL_GENERATE", "LABEL_PRINT", "PRODUCT_UPDATE", None], "label_generation"),
    ("二维码标签", ["LABEL_GENERATE", "LABEL_PRINT", "TRACE_QUERY", None], "label_generation"),

    # ===== 2. Barcode/QR (6 cases) =====
    ("扫描条码", ["TRACE_QUERY", "LABEL_QUERY", "PRODUCT_QUERY", "SCALE_ADD_DEVICE_VISION", None], "barcode_qr"),
    ("生成二维码", ["LABEL_GENERATE", "LABEL_PRINT", "TRACE_QUERY", "SCALE_ADD_DEVICE_VISION", None], "barcode_qr"),
    ("条码查询产品", ["PRODUCT_QUERY", "TRACE_QUERY", "LABEL_QUERY", "PRODUCT_TYPE_QUERY", None], "barcode_qr"),
    ("批次条码打印", ["LABEL_PRINT", "LABEL_GENERATE", None], "barcode_qr"),
    ("条码扫描入库", ["TRACE_QUERY", "LABEL_QUERY", "MATERIAL_BATCH_CREATE", None], "barcode_qr"),
    ("二维码溯源", ["TRACE_QUERY", "LABEL_QUERY", "TRACE_BATCH", None], "barcode_qr"),

    # ===== 3. Print Management (6 cases) =====
    ("打印机状态", ["EQUIPMENT_STATUS_QUERY", "SCALE_LIST_DEVICES", None], "print_management"),
    ("打印队列查看", ["LABEL_QUERY", "EQUIPMENT_STATUS_QUERY", None], "print_management"),
    ("取消打印任务", ["LABEL_PRINT", "PROCESSING_BATCH_CANCEL", None], "print_management"),
    ("打印机设置", ["EQUIPMENT_STATUS_QUERY", "SCALE_LIST_DEVICES", None], "print_management"),
    ("批量打印标签", ["LABEL_PRINT", "LABEL_GENERATE", None], "print_management"),
    ("打印历史记录", ["LABEL_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "print_management"),

    # ===== 4. Product Labels (5 cases) =====
    ("营养标签生成", ["LABEL_GENERATE", "LABEL_PRINT", "FOOD_SAFETY_CERT_QUERY", None], "product_labels"),
    ("配料表标签", ["LABEL_GENERATE", "LABEL_PRINT", "PRODUCT_QUERY", None], "product_labels"),
    ("过敏原标签", ["LABEL_GENERATE", "LABEL_PRINT", "FOOD_SAFETY_CERT_QUERY", "MATERIAL_BATCH_QUERY", None], "product_labels"),
    ("保质期标签", ["LABEL_GENERATE", "LABEL_PRINT", "PRODUCT_QUERY", "MATERIAL_EXPIRING_ALERT", None], "product_labels"),
    ("产品规格标签", ["LABEL_GENERATE", "LABEL_PRINT", "PRODUCT_QUERY", "PRODUCT_UPDATE", None], "product_labels"),

    # ===== 5. Shipping Labels (6 cases) =====
    ("发货标签打印", ["LABEL_PRINT", "LABEL_GENERATE", "SHIPMENT_CREATE", "SHIPMENT_QUERY", None], "shipping_labels"),
    ("物流单号标签", ["LABEL_PRINT", "LABEL_GENERATE", "TRACE_QUERY", "SHIPMENT_QUERY", None], "shipping_labels"),
    ("收货地址标签", ["LABEL_PRINT", "LABEL_GENERATE", "SHIPMENT_QUERY", None], "shipping_labels"),
    ("包装箱标签", ["LABEL_PRINT", "LABEL_GENERATE", None], "shipping_labels"),
    ("出库单标签", ["LABEL_PRINT", "LABEL_GENERATE", "SHIPMENT_CREATE", None], "shipping_labels"),
    ("运单打印", ["LABEL_PRINT", "LABEL_GENERATE", "SHIPMENT_CREATE", None], "shipping_labels"),

    # ===== 6. Compliance Labels (5 cases) =====
    ("食品安全认证标签", ["FOOD_SAFETY_CERT_QUERY", "LABEL_GENERATE", "LABEL_PRINT", "QUALITY_CHECK_QUERY", None], "compliance_labels"),
    ("有机认证标签", ["FOOD_SAFETY_CERT_QUERY", "LABEL_GENERATE", "LABEL_PRINT", None], "compliance_labels"),
    ("检验合格标签", ["QUALITY_CHECK_QUERY", "LABEL_GENERATE", "LABEL_PRINT", None], "compliance_labels"),
    ("生产许可标签", ["FOOD_SAFETY_CERT_QUERY", "LABEL_GENERATE", "LABEL_PRINT", None], "compliance_labels"),
    ("追溯码标签", ["TRACE_QUERY", "LABEL_GENERATE", "LABEL_PRINT", "TRACE_BATCH", None], "compliance_labels"),

    # ===== 7. Label Query (6 cases) =====
    ("查看标签详情", ["LABEL_QUERY", "LABEL_PRINT", "PRODUCT_QUERY", None], "label_query"),
    ("标签打印记录", ["LABEL_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "label_query"),
    ("最近打印的标签", ["LABEL_QUERY", "LABEL_PRINT", None], "label_query"),
    ("哪些批次没贴标签", ["LABEL_QUERY", "PROCESSING_BATCH_LIST", None], "label_query"),
    ("标签库存查询", ["LABEL_QUERY", "INVENTORY_QUERY", "INVENTORY_LIST", "REPORT_INVENTORY", None], "label_query"),
    ("标签使用统计", ["LABEL_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "label_query"),

    # ===== 8. Smart Labels (5 cases) =====
    ("NFC标签写入", ["LABEL_GENERATE", "LABEL_PRINT", "SCALE_LIST_DEVICES", None], "smart_labels"),
    ("RFID标签管理", ["LABEL_QUERY", "LABEL_GENERATE", "SCALE_LIST_DEVICES", "EQUIPMENT_STATUS_QUERY", None], "smart_labels"),
    ("电子标签更新", ["LABEL_GENERATE", "LABEL_PRINT", "PRODUCT_UPDATE", None], "smart_labels"),
    ("智能标签读取", ["LABEL_QUERY", "TRACE_QUERY", "SCALE_LIST_DEVICES", None], "smart_labels"),
    ("温度标签监测", ["LABEL_QUERY", "EQUIPMENT_STATUS_QUERY", "SCALE_LIST_DEVICES", "COLD_CHAIN_TEMPERATURE", None], "smart_labels"),

    # ===== 9. Label Errors (5 cases) =====
    ("标签打印错误", ["LABEL_PRINT", "LABEL_QUERY", "EQUIPMENT_STATUS_QUERY", None], "label_errors"),
    ("标签内容有误", ["LABEL_GENERATE", "LABEL_QUERY", "PRODUCT_UPDATE", None], "label_errors"),
    ("重新打印标签", ["LABEL_PRINT", "LABEL_GENERATE", None], "label_errors"),
    ("标签粘贴不上", ["LABEL_PRINT", "EQUIPMENT_STATUS_QUERY", None], "label_errors"),
    ("标签模糊看不清", ["LABEL_PRINT", "LABEL_QUERY", "EQUIPMENT_STATUS_QUERY", None], "label_errors"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 36 ===")
    print(f"Focus: LABEL & PRINTING - label generation, barcode/QR, print management,")
    print(f"       product/shipping/compliance labels, label queries, smart labels, label errors")
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
        'test': 'v5_round36_label_printing',
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
    report_path = f'tests/ai-intent/reports/v5_round36_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
