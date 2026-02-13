#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 18
Focus: WAREHOUSE & LOGISTICS - inventory management, inbound/outbound,
       shipping, storage conditions, material handling, location tracking,
       order fulfillment, returns/disposal, transport & delivery.
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

# Round 18 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Inbound / Receiving (6 cases) =====
    ("今天到货了哪些原料",
     ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "ORDER_STATUS", "MATERIAL_BATCH_CREATE"],
     "inbound-arrival-today"),

    ("收货确认单还有几个没处理",
     ["ORDER_STATUS", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "SHIPMENT_QUERY"],
     "inbound-receiving-confirm"),

    ("来料检验结果怎么样",
     ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "MATERIAL_BATCH_QUERY"],
     "inbound-incoming-inspection"),

    ("新到的猪肉入库登记了吗",
     ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "ORDER_STATUS"],
     "inbound-registration"),

    ("供应商到货通知看一下",
     ["SUPPLIER_LIST", "ORDER_STATUS", "MATERIAL_BATCH_QUERY", "SHIPMENT_QUERY", None],
     "inbound-arrival-notice"),

    ("卸货进度到哪了",
     ["SHIPMENT_QUERY", "ORDER_STATUS", "PRODUCTION_STATUS_QUERY", None],
     "inbound-unloading-progress"),

    # ===== 2. Outbound / Shipping (6 cases) =====
    ("今天的发货计划",
     ["SHIPMENT_QUERY", "ORDER_LIST", "ORDER_STATUS", "REPORT_INVENTORY", "SHIPMENT_BY_DATE"],
     "outbound-shipping-plan"),

    ("出库单打印一下",
     ["SHIPMENT_QUERY", "ORDER_STATUS", "REPORT_INVENTORY", "FORM_GENERATION", "SHIPMENT_CREATE"],
     "outbound-delivery-note"),

    ("装车完了没有",
     ["SHIPMENT_QUERY", "ORDER_STATUS", None],
     "outbound-loading"),

    ("下午发运的是哪几单",
     ["SHIPMENT_QUERY", "ORDER_LIST", "ORDER_STATUS", "SHIPMENT_BY_DATE"],
     "outbound-dispatch"),

    ("客户来提货了",
     ["ORDER_STATUS", "SHIPMENT_QUERY", "CUSTOMER_SEARCH", None],
     "outbound-pickup"),

    ("城西店的配送安排好了吗",
     ["SHIPMENT_QUERY", "ORDER_STATUS", "ORDER_LIST", "PROCESSING_BATCH_LIST", None],
     "outbound-delivery-schedule"),

    # ===== 3. Inventory Queries (6 cases) =====
    ("库存盘点结果出来了吗",
     ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"],
     "inventory-stocktake"),

    ("安全库存线以下的有哪些",
     ["MATERIAL_LOW_STOCK_ALERT", "REPORT_INVENTORY", "ALERT_LIST"],
     "inventory-safety-stock"),

    ("库存预警看一下",
     ["MATERIAL_LOW_STOCK_ALERT", "ALERT_LIST", "REPORT_INVENTORY", "MATERIAL_EXPIRING_ALERT"],
     "inventory-stock-alert"),

    ("库龄超过90天的有多少",
     ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "MATERIAL_EXPIRING_ALERT"],
     "inventory-aging-analysis"),

    ("滞销品清单拉出来",
     ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "MATERIAL_EXPIRING_ALERT", None],
     "inventory-slow-moving"),

    ("库存周转率怎么样",
     ["REPORT_INVENTORY", "REPORT_EFFICIENCY", "REPORT_KPI"],
     "inventory-turnover"),

    # ===== 4. Storage Conditions (5 cases) =====
    ("仓库温湿度正常吗",
     ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "EQUIPMENT_STATUS_QUERY", "REPORT_INVENTORY"],
     "storage-temp-humidity"),

    ("冷藏库温度是多少",
     ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY"],
     "storage-cold-room-temp"),

    ("干燥剂该换了吧",
     ["MATERIAL_BATCH_QUERY", "EQUIPMENT_MAINTENANCE", "REPORT_INVENTORY", None],
     "storage-desiccant"),

    ("原料库防潮措施到位了吗",
     ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", None],
     "storage-moisture-proof"),

    ("存储条件合规检查",
     ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", None],
     "storage-compliance"),

    # ===== 5. Material Management (6 cases) =====
    ("领料单审批了没",
     ["MATERIAL_BATCH_QUERY", "ORDER_STATUS", "MATERIAL_CONSUME", None],
     "material-requisition"),

    ("车间退料记录查一下",
     ["MATERIAL_BATCH_QUERY", "MATERIAL_CONSUME", "REPORT_INVENTORY", None],
     "material-return"),

    ("A线差料要补",
     ["MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY", "MATERIAL_CONSUME", None],
     "material-replenish"),

    ("今天的原料消耗汇总",
     ["MATERIAL_CONSUME", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "REPORT_PRODUCTION", "MATERIAL_BATCH_CONSUME"],
     "material-consumption"),

    ("把这批面粉从2号库转到车间",
     ["MATERIAL_BATCH_QUERY", "MATERIAL_CONSUME", "REPORT_INVENTORY", None],
     "material-transfer"),

    ("余料回收了多少公斤",
     ["MATERIAL_BATCH_QUERY", "MATERIAL_CONSUME", "REPORT_INVENTORY", None],
     "material-scrap-recovery"),

    # ===== 6. Location & Placement (5 cases) =====
    ("B-03-02库位放的是什么",
     ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", None],
     "location-query"),

    ("货架使用率看一下",
     ["REPORT_INVENTORY", "REPORT_EFFICIENCY", "MATERIAL_BATCH_QUERY", None],
     "location-shelf-utilization"),

    ("新到的食用油上架了吗",
     ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "ORDER_STATUS", None],
     "location-putaway"),

    ("把3号库区的调味料移到1号库",
     ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", None],
     "location-relocation"),

    ("库区规划方案",
     ["REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None],
     "location-zone-planning"),

    # ===== 7. Order Fulfillment (5 cases) =====
    ("订单拣货完成了几个",
     ["ORDER_STATUS", "ORDER_LIST", "SHIPMENT_QUERY", "ORDER_UPDATE"],
     "fulfillment-picking"),

    ("拣货进度怎么样了",
     ["ORDER_STATUS", "SHIPMENT_QUERY", "PRODUCTION_STATUS_QUERY"],
     "fulfillment-picking-progress"),

    ("打包好了的放在哪里",
     ["ORDER_STATUS", "SHIPMENT_QUERY", "REPORT_INVENTORY", None],
     "fulfillment-packing"),

    ("出货前称重数据对一下",
     ["QUALITY_CHECK_QUERY", "SHIPMENT_QUERY", "ORDER_STATUS", "SCALE_LIST_DEVICES", None],
     "fulfillment-weighing"),

    ("贴标机正常吗还是要手动贴",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", None],
     "fulfillment-labeling"),

    # ===== 8. Returns & Disposal (5 cases) =====
    ("昨天的退货处理好了吗",
     ["ORDER_STATUS", "QUALITY_CHECK_QUERY", "SHIPMENT_QUERY", "MATERIAL_BATCH_QUERY"],
     "returns-processing"),

    ("过期品报废清单",
     ["MATERIAL_EXPIRING_ALERT", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "DISPOSITION_EXECUTE", "MATERIAL_EXPIRED_QUERY"],
     "returns-disposal-list"),

    ("不良品隔离区有多少",
     ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_INVENTORY", "DISPOSITION_EXECUTE", None],
     "returns-defective-isolation"),

    ("废料回收公司什么时候来拉",
     ["SUPPLIER_LIST", None],
     "returns-waste-pickup"),

    ("退货的重新入库了吗",
     ["ORDER_STATUS", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "SHIPMENT_QUERY"],
     "returns-restock"),

    # ===== 9. Transport & Delivery (6 cases) =====
    ("物流跟踪看一下这个单号",
     ["SHIPMENT_QUERY", "ORDER_STATUS", "TRACE_BATCH"],
     "transport-tracking"),

    ("配送路线优化了没",
     ["SHIPMENT_QUERY", "SHIPMENT_STATS", "REPORT_EFFICIENCY", None],
     "transport-route-optimize"),

    ("运输车辆今天安排了几台",
     ["SHIPMENT_QUERY", "SHIPMENT_STATS", "ORDER_LIST", None],
     "transport-vehicle-schedule"),

    ("客户那边预计几点到货",
     ["SHIPMENT_QUERY", "ORDER_STATUS", "MATERIAL_BATCH_CREATE", None],
     "transport-eta"),

    ("这个月运费花了多少",
     ["REPORT_FINANCE", "SHIPMENT_STATS", "REPORT_INVENTORY", "COST_QUERY"],
     "transport-freight-cost"),

    ("客户签收了吗",
     ["SHIPMENT_QUERY", "ORDER_STATUS", None],
     "transport-delivery-confirm"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 18 ===")
    print(f"Focus: WAREHOUSE & LOGISTICS - inbound/outbound, inventory, storage,")
    print(f"       material handling, location, fulfillment, returns, transport")
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
        'test': 'v5_round18_warehouse_logistics',
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
    report_path = f'tests/ai-intent/reports/v5_round18_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
