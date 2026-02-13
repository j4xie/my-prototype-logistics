#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 54
Focus: FOOD MANUFACTURING SPECIFIC OPERATIONS.
       Covers ingredient management, processing, packaging, storage,
       hygiene, allergen, shelf life, nutrition, certification.
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

# Round 54 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Ingredient Management (6 cases) =====
    ("原料配比",
     ["MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_DETAIL", "REPORT_PRODUCTION", None],
     "ingredient_mgmt"),
    ("配料表",
     ["MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_DETAIL", "PRODUCT_UPDATE", None],
     "ingredient_mgmt"),
    ("添加剂用量",
     ["MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CONSUME", "QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", None],
     "ingredient_mgmt"),
    ("辅料清单",
     ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", None],
     "ingredient_mgmt"),
    ("原料替换",
     ["MATERIAL_ADJUST_QUANTITY", "MATERIAL_BATCH_QUERY", "PRODUCT_UPDATE", None],
     "ingredient_mgmt"),
    ("配方调整",
     ["PRODUCT_UPDATE", "MATERIAL_ADJUST_QUANTITY", "MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_DETAIL", None],
     "ingredient_mgmt"),

    # ===== 2. Processing (6 cases) =====
    ("杀菌记录",
     ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", None],
     "processing"),
    ("发酵监控",
     ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "COLD_CHAIN_TEMPERATURE", None],
     "processing"),
    ("烘焙参数",
     ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", None],
     "processing"),
    ("蒸煮记录",
     ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "QUALITY_CHECK_QUERY", None],
     "processing"),
    ("冷冻记录",
     ["COLD_CHAIN_TEMPERATURE", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", None],
     "processing"),
    ("干燥参数",
     ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "COLD_CHAIN_TEMPERATURE", None],
     "processing"),

    # ===== 3. Packaging (6 cases) =====
    ("包装规格",
     ["PRODUCT_UPDATE", "MATERIAL_BATCH_QUERY", "LABEL_PRINT", "PROCESSING_BATCH_DETAIL", None],
     "packaging"),
    ("内包装检查",
     ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "PROCESSING_BATCH_DETAIL", None],
     "packaging"),
    ("外包装确认",
     ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "LABEL_PRINT", None],
     "packaging"),
    ("真空度检测",
     ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "PROCESSING_BATCH_DETAIL", "COLD_CHAIN_TEMPERATURE", None],
     "packaging"),
    ("封口检查",
     ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "PROCESSING_BATCH_DETAIL", None],
     "packaging"),
    ("计量装袋",
     ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "QUALITY_CHECK_EXECUTE", None],
     "packaging"),

    # ===== 4. Storage (5 cases) =====
    ("成品入库",
     ["MATERIAL_BATCH_CREATE", "REPORT_INVENTORY", "PROCESSING_BATCH_LIST", None],
     "storage"),
    ("半成品暂存",
     ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "PROCESSING_BATCH_LIST", None],
     "storage"),
    ("常温存储",
     ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "COLD_CHAIN_TEMPERATURE", None],
     "storage"),
    ("冷藏存储",
     ["COLD_CHAIN_TEMPERATURE", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", None],
     "storage"),
    ("冷冻存储",
     ["COLD_CHAIN_TEMPERATURE", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", None],
     "storage"),

    # ===== 5. Hygiene (6 cases) =====
    ("卫生检查",
     ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "FOOD_SAFETY_CERT_QUERY", None],
     "hygiene"),
    ("清洗记录",
     ["QUALITY_CHECK_QUERY", "PROCESSING_BATCH_DETAIL", "FOOD_SAFETY_CERT_QUERY", "DATA_BATCH_DELETE", None],
     "hygiene"),
    ("消毒记录",
     ["QUALITY_CHECK_QUERY", "PROCESSING_BATCH_DETAIL", "FOOD_SAFETY_CERT_QUERY", None],
     "hygiene"),
    ("环境监测",
     ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", None],
     "hygiene"),
    ("虫害控制",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", None],
     "hygiene"),
    ("人员卫生",
     ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "FOOD_SAFETY_CERT_QUERY", None],
     "hygiene"),

    # ===== 6. Allergen (5 cases) =====
    ("过敏原管理",
     ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "PRODUCT_UPDATE", "MATERIAL_BATCH_QUERY", None],
     "allergen"),
    ("过敏原标识",
     ["LABEL_PRINT", "FOOD_SAFETY_CERT_QUERY", "PRODUCT_UPDATE", "MATERIAL_BATCH_QUERY", None],
     "allergen"),
    ("交叉污染防控",
     ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None],
     "allergen"),
    ("过敏原清洗",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "PROCESSING_BATCH_DETAIL", "MATERIAL_BATCH_QUERY", None],
     "allergen"),
    ("过敏原声明",
     ["FOOD_SAFETY_CERT_QUERY", "LABEL_PRINT", "PRODUCT_UPDATE", "MATERIAL_BATCH_QUERY", None],
     "allergen"),

    # ===== 7. Shelf Life (6 cases) =====
    ("保质期管理",
     ["MATERIAL_EXPIRING_ALERT", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", None],
     "shelf_life"),
    ("效期预警",
     ["MATERIAL_EXPIRING_ALERT", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "ALERT_LIST", None],
     "shelf_life"),
    ("开封后保质期",
     ["MATERIAL_EXPIRING_ALERT", "MATERIAL_BATCH_QUERY", "PRODUCT_UPDATE", None],
     "shelf_life"),
    ("加速试验结果",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "REPORT_QUALITY", None],
     "shelf_life"),
    ("稳定性测试",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "REPORT_QUALITY", None],
     "shelf_life"),
    ("货架期评估",
     ["MATERIAL_EXPIRING_ALERT", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "MATERIAL_BATCH_QUERY", None],
     "shelf_life"),

    # ===== 8. Nutrition (5 cases) =====
    ("营养成分",
     ["PRODUCT_UPDATE", "FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "LABEL_PRINT", None],
     "nutrition"),
    ("热量计算",
     ["PRODUCT_UPDATE", "FOOD_SAFETY_CERT_QUERY", "REPORT_PRODUCTION", None],
     "nutrition"),
    ("营养标签",
     ["LABEL_PRINT", "PRODUCT_UPDATE", "FOOD_SAFETY_CERT_QUERY", None],
     "nutrition"),
    ("配料占比",
     ["MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CONSUME", "PRODUCT_UPDATE", "REPORT_PRODUCTION", None],
     "nutrition"),
    ("营养声称",
     ["FOOD_SAFETY_CERT_QUERY", "PRODUCT_UPDATE", "LABEL_PRINT", None],
     "nutrition"),

    # ===== 9. Certification (5 cases) =====
    ("ISO22000审核",
     ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None],
     "certification"),
    ("BRC认证",
     ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None],
     "certification"),
    ("有机认证",
     ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "QUALITY_CHECK_EXECUTE", None],
     "certification"),
    ("清真认证",
     ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None],
     "certification"),
    ("犹太认证",
     ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None],
     "certification"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 54 ===")
    print(f"Focus: FOOD MANUFACTURING SPECIFIC OPERATIONS")
    print(f"       (ingredient mgmt, processing, packaging, storage,")
    print(f"        hygiene, allergen, shelf life, nutrition, certification)")
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
        'test': 'v5_round54_food_manufacturing_ops',
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
    report_path = f'tests/ai-intent/reports/v5_round54_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
