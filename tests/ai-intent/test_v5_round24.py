#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 24
Focus: TRACEABILITY & COLD CHAIN - batch tracing, product tracking, recall management,
       cold chain monitoring, label/barcode, chain of custody, origin verification.
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

# Round 24 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Batch Tracing (6 cases) =====
    ("追溯这批货的来源", ["TRACE_BATCH", "TRACE_UPSTREAM", "MATERIAL_BATCH_QUERY"], "batch-trace"),
    ("批次B2026020001的原料来自哪里", ["TRACE_UPSTREAM", "TRACE_BATCH", "MATERIAL_BATCH_QUERY", None], "batch-origin"),
    ("这个批次经过了哪些环节", ["TRACE_BATCH", "TRACE_DOWNSTREAM", "MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_LIST"], "batch-route"),
    ("批次B20260115去了哪里", ["TRACE_DOWNSTREAM", "TRACE_BATCH", "SHIPMENT_QUERY", None], "batch-destination"),
    ("查看批次的原料组成", ["TRACE_UPSTREAM", "MATERIAL_BATCH_QUERY", "TRACE_BATCH"], "batch-components"),
    ("向上追溯这个产品的供应链", ["TRACE_UPSTREAM", "TRACE_BATCH", "MATERIAL_BATCH_QUERY", None], "batch-upstream"),

    # ===== 2. Cold Chain Monitoring (6 cases) =====
    ("冷库现在的温度是多少", ["COLD_CHAIN_TEMPERATURE", "COLD_CHAIN_ALERT", "ALERT_ACTIVE", None], "cold-temperature-now"),
    ("查看过去24小时冷链温度记录", ["COLD_CHAIN_TEMPERATURE", "COLD_CHAIN_ALERT", None], "cold-temperature-history"),
    ("冷链有没有报警", ["COLD_CHAIN_ALERT", "ALERT_ACTIVE", "ALERT_LIST"], "cold-alert"),
    ("温度超标了吗", ["COLD_CHAIN_ALERT", "COLD_CHAIN_TEMPERATURE", "ALERT_ACTIVE"], "cold-breach"),
    ("冷链合规达标情况", ["COLD_CHAIN_TEMPERATURE", "COLD_CHAIN_ALERT", "REPORT_QUALITY", None], "cold-compliance"),
    ("冷藏库的运行状态", ["COLD_CHAIN_TEMPERATURE", "COLD_CHAIN_ALERT", None], "cold-storage-status"),

    # ===== 3. Product Tracking (5 cases) =====
    ("追踪这个产品到了哪里", ["TRACE_DOWNSTREAM", "TRACE_BATCH", "SHIPMENT_QUERY", "ORDER_STATUS", "TRACE_PUBLIC"], "product-track"),
    ("产品现在在什么位置", ["TRACE_DOWNSTREAM", "SHIPMENT_QUERY", "ORDER_STATUS", "PRODUCT_UPDATE", None], "product-location"),
    ("货物流转情况", ["TRACE_BATCH", "TRACE_DOWNSTREAM", "SHIPMENT_QUERY", "MATERIAL_BATCH_QUERY", None], "product-movement"),
    ("物流配送跟踪", ["SHIPMENT_QUERY", "ORDER_STATUS", "TRACE_DOWNSTREAM", None], "product-delivery"),
    ("这个产品的完整历史记录", ["TRACE_BATCH", "TRACE_DOWNSTREAM", "TRACE_UPSTREAM", "MATERIAL_BATCH_QUERY", None], "product-history"),

    # ===== 4. Recall Management (6 cases) =====
    ("发起产品召回", ["TRACE_DOWNSTREAM", "TRACE_BATCH", "MATERIAL_BATCH_QUERY", "QUALITY_DISPOSITION_EXECUTE", None], "recall-initiate"),
    ("召回进度怎么样了", ["TRACE_DOWNSTREAM", "TRACE_BATCH", "ORDER_STATUS", "PRODUCTION_STATUS_QUERY", None], "recall-status"),
    ("哪些批次受到了影响", ["TRACE_DOWNSTREAM", "TRACE_BATCH", "MATERIAL_BATCH_QUERY", None], "recall-affected"),
    ("召回范围有多大", ["TRACE_DOWNSTREAM", "TRACE_BATCH", None], "recall-scope"),
    ("通知下游客户召回信息", ["TRACE_DOWNSTREAM", "SHIPMENT_QUERY", "CUSTOMER_SEARCH", None], "recall-notification"),
    ("召回完成了吗", ["TRACE_DOWNSTREAM", "TRACE_BATCH", "ORDER_STATUS", None], "recall-completion"),

    # ===== 5. Label & Barcode (5 cases) =====
    ("扫描这个条码", ["LABEL_QUERY", "TRACE_BATCH", "MATERIAL_BATCH_QUERY", "SCALE_ADD_DEVICE_VISION", None], "label-scan"),
    ("打印这批货的标签", ["LABEL_PRINT", "MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CREATE", None], "label-print"),
    ("查看标签上的信息", ["LABEL_QUERY", "TRACE_BATCH", "MATERIAL_BATCH_QUERY", None], "label-info"),
    ("生成溯源二维码", ["LABEL_PRINT", "TRACE_BATCH", "LABEL_QUERY", "TRACE_PUBLIC", None], "label-qrcode"),
    ("用条码查一下这个产品", ["LABEL_QUERY", "TRACE_BATCH", "MATERIAL_BATCH_QUERY", None], "label-barcode-lookup"),

    # ===== 6. Chain of Custody (5 cases) =====
    ("转移保管责任给下一个环节", ["TRACE_DOWNSTREAM", "TRACE_BATCH", "SHIPMENT_QUERY", None], "custody-transfer"),
    ("查看这批货的交接记录", ["TRACE_BATCH", "TRACE_DOWNSTREAM", "MATERIAL_BATCH_QUERY", "SHIPMENT_QUERY", None], "custody-log"),
    ("谁经手过这批货", ["TRACE_BATCH", "TRACE_UPSTREAM", "MATERIAL_BATCH_QUERY", None], "custody-who-handled"),
    ("交接班记录有吗", ["TRACE_BATCH", "MATERIAL_BATCH_QUERY", "ATTENDANCE_HISTORY", None], "custody-handoff"),
    ("这批原料的责任链", ["TRACE_BATCH", "TRACE_UPSTREAM", "MATERIAL_BATCH_QUERY", None], "custody-responsibility"),

    # ===== 7. Origin Verification (6 cases) =====
    ("有没有原产地证明", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "TRACE_UPSTREAM", None], "origin-certificate"),
    ("这个原料来自哪个产地", ["TRACE_UPSTREAM", "MATERIAL_BATCH_QUERY", "TRACE_BATCH", None], "origin-country"),
    ("供应商资质认证", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "SUPPLIER_EVALUATE", None], "origin-supplier-cert"),
    ("有机认证查一下", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", None], "origin-organic"),
    ("进口检验证书", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "origin-import-cert"),
    ("产品真伪验证", ["TRACE_BATCH", "LABEL_QUERY", "FOOD_SAFETY_CERT_QUERY", None], "origin-authenticity"),

    # ===== 8. Compliance Audit (5 cases) =====
    ("溯源体系审计", ["TRACE_BATCH", "REPORT_QUALITY", "FOOD_SAFETY_CERT_QUERY", "TRACE_PUBLIC", None], "compliance-audit"),
    ("操作审计日志", ["TRACE_BATCH", "REPORT_QUALITY", "PROCESSING_BATCH_TIMELINE", None], "compliance-audit-trail"),
    ("合规报告", ["REPORT_QUALITY", "FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", None], "compliance-report"),
    ("数据完整性检查", ["REPORT_QUALITY", "TRACE_BATCH", "REPORT_DASHBOARD_OVERVIEW", None], "compliance-completeness"),
    ("监管检查准备情况", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "compliance-regulatory"),

    # ===== 9. Consumer Trace (6 cases) =====
    ("消费者扫码查询", ["TRACE_BATCH", "LABEL_QUERY", "TRACE_DOWNSTREAM", None], "consumer-public-query"),
    ("顾客扫了溯源码看到什么", ["TRACE_BATCH", "LABEL_QUERY", "TRACE_DOWNSTREAM", "TRACE_PUBLIC", None], "consumer-scan"),
    ("溯源结果页面", ["TRACE_BATCH", "TRACE_DOWNSTREAM", "LABEL_QUERY", "TRACE_PUBLIC", None], "consumer-trace-result"),
    ("这个产品的全程追踪", ["TRACE_BATCH", "TRACE_DOWNSTREAM", "TRACE_UPSTREAM", "TRACE_FULL"], "consumer-product-journey"),
    ("从农场到餐桌的追溯", ["TRACE_BATCH", "TRACE_UPSTREAM", "TRACE_DOWNSTREAM", None], "consumer-farm-to-fork"),
    ("产品透明度报告", ["TRACE_BATCH", "REPORT_QUALITY", "TRACE_DOWNSTREAM", "PRODUCT_UPDATE", None], "consumer-transparency"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 24 ===")
    print(f"Focus: TRACEABILITY & COLD CHAIN - batch tracing, product tracking, recall management,")
    print(f"       cold chain monitoring, label/barcode, chain of custody, origin verification")
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
        'test': 'v5_round24_traceability_cold_chain',
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
    report_path = f'tests/ai-intent/reports/v5_round24_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
