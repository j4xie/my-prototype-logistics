#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 66
Focus: INVENTORY & WAREHOUSE DETAIL queries for food manufacturing.
       Covers inventory check, stock in, stock out, location management,
       stock transfer, warehouse report, cold chain, ABC analysis, and safety stock.
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

# Round 66 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Inventory Check (6 cases) =====
    ("盘点库存", ["INVENTORY_CHECK", "INVENTORY_QUERY", "REPORT_INVENTORY", "MATERIAL_ADJUST_QUANTITY", "MATERIAL_BATCH_QUERY", None], "inventory_check"),
    ("清点数量", ["INVENTORY_CHECK", "INVENTORY_QUERY", "REPORT_INVENTORY", "MATERIAL_ADJUST_QUANTITY", None], "inventory_check"),
    ("实物盘点", ["INVENTORY_CHECK", "INVENTORY_QUERY", "REPORT_INVENTORY", "MATERIAL_ADJUST_QUANTITY", None], "inventory_check"),
    ("库存核对", ["INVENTORY_CHECK", "INVENTORY_QUERY", "REPORT_INVENTORY", "MATERIAL_ADJUST_QUANTITY", None], "inventory_check"),
    ("盘亏盘盈", ["INVENTORY_CHECK", "INVENTORY_QUERY", "REPORT_INVENTORY", "MATERIAL_ADJUST_QUANTITY", None], "inventory_check"),
    ("期末盘点", ["INVENTORY_CHECK", "INVENTORY_QUERY", "REPORT_INVENTORY", "MATERIAL_ADJUST_QUANTITY", None], "inventory_check"),

    # ===== 2. Stock In (6 cases) =====
    ("入库操作", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "SHIPMENT_STATUS_UPDATE", None], "stock_in"),
    ("上架存放", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "SHIPMENT_STATUS_UPDATE", None], "stock_in"),
    ("收货入库", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "SHIPMENT_STATUS_UPDATE", None], "stock_in"),
    ("退货入库", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "SHIPMENT_STATUS_UPDATE", None], "stock_in"),
    ("调拨入库", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "SHIPMENT_STATUS_UPDATE", None], "stock_in"),
    ("生产入库", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "SHIPMENT_STATUS_UPDATE", "PROCESSING_BATCH_LIST", None], "stock_in"),

    # ===== 3. Stock Out (5 cases) =====
    ("出库操作", ["MATERIAL_BATCH_CONSUME", "SHIPMENT_CREATE", "MATERIAL_ADJUST_QUANTITY", None], "stock_out"),
    ("拣货发货", ["MATERIAL_BATCH_CONSUME", "SHIPMENT_CREATE", "MATERIAL_ADJUST_QUANTITY", None], "stock_out"),
    ("领料出库", ["MATERIAL_BATCH_CONSUME", "SHIPMENT_CREATE", "MATERIAL_ADJUST_QUANTITY", "MATERIAL_BATCH_USE", None], "stock_out"),
    ("调拨出库", ["MATERIAL_BATCH_CONSUME", "SHIPMENT_CREATE", "MATERIAL_ADJUST_QUANTITY", None], "stock_out"),
    ("报废出库", ["MATERIAL_BATCH_CONSUME", "SHIPMENT_CREATE", "MATERIAL_ADJUST_QUANTITY", None], "stock_out"),

    # ===== 4. Location Management (6 cases) =====
    ("库位管理", ["INVENTORY_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", None], "location_mgmt"),
    ("货架编号", ["INVENTORY_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", None], "location_mgmt"),
    ("存放位置", ["INVENTORY_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "location_mgmt"),
    ("库位分配", ["INVENTORY_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "location_mgmt"),
    ("仓位查询", ["INVENTORY_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", None], "location_mgmt"),
    ("储位规划", ["INVENTORY_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "location_mgmt"),

    # ===== 5. Stock Transfer (5 cases) =====
    ("库存调拨", ["MATERIAL_ADJUST_QUANTITY", "SHIPMENT_CREATE", "INVENTORY_QUERY", "REPORT_INVENTORY", None], "stock_transfer"),
    ("仓间转移", ["MATERIAL_ADJUST_QUANTITY", "SHIPMENT_CREATE", "INVENTORY_QUERY", None], "stock_transfer"),
    ("调拨单", ["MATERIAL_ADJUST_QUANTITY", "SHIPMENT_CREATE", "INVENTORY_QUERY", None], "stock_transfer"),
    ("物资调配", ["MATERIAL_ADJUST_QUANTITY", "SHIPMENT_CREATE", "INVENTORY_QUERY", None], "stock_transfer"),
    ("跨仓调拨", ["MATERIAL_ADJUST_QUANTITY", "SHIPMENT_CREATE", "INVENTORY_QUERY", None], "stock_transfer"),

    # ===== 6. Warehouse Report (6 cases) =====
    ("仓库报表", ["REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "warehouse_report"),
    ("库存报告", ["REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "warehouse_report"),
    ("出入库汇总", ["REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "warehouse_report"),
    ("库存月报", ["REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "warehouse_report"),
    ("仓储统计", ["REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "warehouse_report"),
    ("库存分析", ["REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "warehouse_report"),

    # ===== 7. Cold Chain (5 cases) =====
    ("冷库温度", ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "EQUIPMENT_STATUS_QUERY", None], "cold_chain"),
    ("冷链监控", ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "EQUIPMENT_STATUS_QUERY", None], "cold_chain"),
    ("温度异常", ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "EQUIPMENT_STATUS_QUERY", None], "cold_chain"),
    ("冷藏温度", ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "EQUIPMENT_STATUS_QUERY", None], "cold_chain"),
    ("冻库状态", ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "EQUIPMENT_STATUS_QUERY", None], "cold_chain"),

    # ===== 8. ABC Analysis (6 cases) =====
    ("ABC分类", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_TRENDS", None], "abc_analysis"),
    ("库存分级", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_TRENDS", None], "abc_analysis"),
    ("重点物料", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_TRENDS", None], "abc_analysis"),
    ("高价值库存", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_TRENDS", None], "abc_analysis"),
    ("慢动库存", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_TRENDS", None], "abc_analysis"),
    ("呆滞物料", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_TRENDS", None], "abc_analysis"),

    # ===== 9. Safety Stock (5 cases) =====
    ("安全库存设置", ["MATERIAL_LOW_STOCK_ALERT", "INVENTORY_QUERY", "CONFIG_RESET", "REPORT_INVENTORY", None], "safety_stock"),
    ("最低库存", ["MATERIAL_LOW_STOCK_ALERT", "INVENTORY_QUERY", "CONFIG_RESET", "REPORT_INVENTORY", None], "safety_stock"),
    ("补货点", ["MATERIAL_LOW_STOCK_ALERT", "INVENTORY_QUERY", "CONFIG_RESET", "REPORT_INVENTORY", None], "safety_stock"),
    ("库存上下限", ["MATERIAL_LOW_STOCK_ALERT", "INVENTORY_QUERY", "CONFIG_RESET", "REPORT_INVENTORY", None], "safety_stock"),
    ("库存警戒线", ["MATERIAL_LOW_STOCK_ALERT", "INVENTORY_QUERY", "CONFIG_RESET", "REPORT_INVENTORY", "ISAPI_CONFIG_LINE_DETECTION", None], "safety_stock"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 66 ===")
    print(f"Focus: INVENTORY & WAREHOUSE DETAIL queries")
    print(f"       (inventory check, stock in/out, location, transfer, report, cold chain, ABC, safety stock)")
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
        'test': 'v5_round66_inventory_warehouse_detail',
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
    report_path = f'tests/ai-intent/reports/v5_round66_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
