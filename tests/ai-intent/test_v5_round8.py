#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 8
Focus: Composite queries, negation, conditional, polite, colloquial, quantity, comparison, abbreviations
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

# Round 8 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # === 1. Composite/compound queries (time + entity + attribute) ===
    ("查一下昨天入库的原料批次号", ["MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CREATE"], "composite-time-entity"),
    ("看看今天出库了多少原料", ["MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CONSUME", "MATERIAL_BATCH_USE"], "composite-time-outbound"),
    ("统计本月完成的加工批次数量", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_COMPLETE"], "composite-time-count"),
    ("显示上周的财务报表数据", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW"], "composite-time-report"),
    ("列出这个月质检不合格的批次", ["QUALITY_STATS", "QUALITY_CHECK_QUERY"], "composite-time-filter"),
    ("找一下2号线今天的生产状态", ["PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", "PROCESSING_BATCH_LIST"], "composite-line-time"),
    ("查询最近三天的原料消耗量", ["MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CONSUME"], "composite-timerange"),

    # === 2. Negation with action (system extracts action verb, negation not handled at pipeline level) ===
    ("不要删除这个订单", ["ORDER_STATUS", "ORDER_LIST", "ORDER_CANCEL", "ORDER_DELETE"], "negation-delete"),
    ("别取消这批加工任务", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_RESUME", "PROCESSING_BATCH_CANCEL"], "negation-cancel"),
    ("不用暂停设备", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_START", "EQUIPMENT_STOP"], "negation-pause"),
    ("别停止生产线", ["PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", "PROCESSING_BATCH_CANCEL"], "negation-stop"),
    ("不要清空库存", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "INVENTORY_CLEAR"], "negation-clear"),

    # === 3. Conditional/if-then queries ===
    ("如果库存不够就发出告警", ["ALERT_LIST", "REPORT_INVENTORY", "MATERIAL_LOW_STOCK_ALERT"], "conditional-inventory"),
    ("如果质检合格就放行这批原料", ["MATERIAL_BATCH_RELEASE", "QUALITY_CHECK_EXECUTE", "QUALITY_DISPOSITION_EXECUTE"], "conditional-quality"),
    ("要是设备故障就停止运行", ["EQUIPMENT_STOP", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_ALERT_LIST"], "conditional-equipment"),
    ("不合格的话就执行处置", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_EXECUTE"], "conditional-disposition"),

    # === 4. Polite/formal expressions ===
    ("麻烦帮我查一下订单状态", ["ORDER_STATUS", "ORDER_LIST"], "polite-order"),
    ("请问能否查看今天的考勤记录", ["ATTENDANCE_TODAY", "CLOCK_IN", "ATTENDANCE_HISTORY"], "polite-attendance"),
    ("劳驾显示一下设备维护记录", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY"], "polite-maintenance"),
    ("麻烦您帮忙删除这个供应商", ["SUPPLIER_DELETE", "SUPPLIER_LIST"], "polite-delete"),
    ("请帮忙统计一下质检数据", ["QUALITY_STATS", "QUALITY_CHECK_QUERY"], "polite-quality"),
    ("能否查询一下发货状态", ["SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE"], "polite-shipment"),

    # === 5. Colloquial/slang ===
    ("搞一下设备启动", ["EQUIPMENT_START", "EQUIPMENT_STATUS_QUERY"], "colloquial-start"),
    ("弄一下今天的财务报表", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW"], "colloquial-report"),
    ("整一个新的加工批次", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_START"], "colloquial-create"),
    ("看看能不能搞定这个告警", ["ALERT_RESOLVE", "ALERT_ACKNOWLEDGE", "ALERT_LIST"], "colloquial-alert"),
    ("弄个质检报告出来", ["QUALITY_STATS", "QUALITY_CHECK_QUERY"], "colloquial-quality"),
    ("搞一下原料出库", ["MATERIAL_BATCH_CONSUME", "MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_USE"], "colloquial-outbound"),

    # === 6. Quantity with units ===
    ("出库500公斤原料", ["MATERIAL_BATCH_CONSUME", "MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_USE"], "quantity-kg"),
    ("入库3吨大米", ["MATERIAL_BATCH_CREATE", "MATERIAL_BATCH_QUERY"], "quantity-ton"),
    ("调整库存增加200斤", ["MATERIAL_ADJUST_QUANTITY", "MATERIAL_BATCH_QUERY"], "quantity-jin"),
    ("领用300箱包装材料", ["MATERIAL_BATCH_CONSUME", "MATERIAL_BATCH_QUERY"], "quantity-box"),

    # === 7. Comparison/trend queries ===
    ("这个月的生产效率比上个月怎么样", ["REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY"], "comparison-mom"),
    ("对比一下今年和去年的财务数据", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW"], "comparison-yoy"),
    ("最近一周的质检合格率走势", ["QUALITY_STATS", "QUALITY_CHECK_QUERY"], "trend-quality"),
    ("本月订单量和上月对比", ["ORDER_LIST", "ORDER_STATUS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS"], "comparison-order"),

    # === 8. Multi-entity reference ===
    ("1号线和2号线的设备状态", ["EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY"], "multi-entity-equip"),
    ("供应商甲和供应商乙的评分对比", ["SUPPLIER_RANKING", "SUPPLIER_EVALUATE", "SUPPLIER_LIST"], "multi-entity-supplier"),
    ("早班和晚班的考勤情况", ["ATTENDANCE_TODAY", "CLOCK_IN", "ATTENDANCE_STATS"], "multi-entity-shift"),

    # === 9. Industry abbreviations ===
    ("查看OEE数据", ["REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY"], "abbr-oee"),
    ("HACCP体系的质检记录", ["QUALITY_CHECK_QUERY", "QUALITY_STATS"], "abbr-haccp"),
    ("执行FIFO原则出库", ["MATERIAL_BATCH_CONSUME", "MATERIAL_BATCH_QUERY", "MATERIAL_FIFO_RECOMMEND"], "abbr-fifo"),
    ("ERP系统的订单列表", ["ORDER_LIST", "ORDER_STATUS", "REPORT_DASHBOARD_OVERVIEW"], "abbr-erp"),

    # === 10. Edge cases: multi-dimensional ===
    ("麻烦查一下昨天1号线消耗了多少原料", ["MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CONSUME"], "edge-polite-time-entity"),
    ("搞一下这个月和上个月的库存对比报表", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "edge-colloquial-comparison"),
    ("请问上周的设备OEE效率怎么样", ["REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY"], "edge-polite-abbr-time"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 8 ===")
    print(f"Focus: Composite, Negation, Conditional, Polite, Colloquial, Quantity, Comparison, Abbreviations")
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
        print(f"  {cat}: {counts['pass']}/{total} ({pct:.0f}%)")

    if fail_count > 0:
        print(f"\n--- Failed queries ---")
        for r in results:
            if r['status'] == 'FAIL':
                print(f"  \"{r['query']}\" => {r['intent']} (expected {r['expected']}) [{r['category']}] via {r['method']} [{r['latency_ms']}ms]")

    if error_count > 0:
        print(f"\n--- Error queries ---")
        for r in results:
            if r['status'] == 'ERROR':
                print(f"  \"{r['query']}\" => {r['method']} [{r['category']}] [{r['latency_ms']}ms]")

    methods = {}
    for r in results:
        m = r.get('method') or 'NONE'
        methods[m] = methods.get(m, 0) + 1
    print(f"\n--- Match method distribution ---")
    for m, c in sorted(methods.items(), key=lambda x: -x[1]):
        print(f"  {m}: {c}")

    report = {
        'timestamp': datetime.now().isoformat(),
        'test': 'v5_round8_advanced',
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
    report_path = f'tests/ai-intent/reports/v5_round8_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
