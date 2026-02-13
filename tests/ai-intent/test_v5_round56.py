#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 56
Focus: CUSTOMER & ORDER MANAGEMENT queries for food manufacturing.
       Covers order create, order query, order update, order cancel,
       customer management, customer analysis, pricing, delivery, and after-sales.
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

# Round 56 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Order Create (6 cases) =====
    ("帮我下一个订单", ["ORDER_CREATE", "ORDER_LIST", "CUSTOMER_PURCHASE_HISTORY", None], "order_create"),
    ("新建一个客户订单", ["ORDER_CREATE", "ORDER_LIST", "CUSTOMER_PURCHASE_HISTORY", None], "order_create"),
    ("客户要下单买豆腐", ["ORDER_CREATE", "ORDER_LIST", "CUSTOMER_PURCHASE_HISTORY", None], "order_create"),
    ("紧急订单录入", ["ORDER_CREATE", "ORDER_LIST", "CUSTOMER_PURCHASE_HISTORY", None], "order_create"),
    ("补一个上次漏的单", ["ORDER_CREATE", "ORDER_LIST", "CUSTOMER_PURCHASE_HISTORY", None], "order_create"),
    ("追加50箱酱油订单", ["ORDER_CREATE", "ORDER_LIST", "CUSTOMER_PURCHASE_HISTORY", None], "order_create"),

    # ===== 2. Order Query (6 cases) =====
    ("查一下订单", ["ORDER_LIST", "ORDER_FILTER", "ORDER_STATUS", "REPORT_DASHBOARD_OVERVIEW", None], "order_query"),
    ("订单详情看看", ["ORDER_LIST", "ORDER_FILTER", "ORDER_STATUS", "REPORT_DASHBOARD_OVERVIEW", None], "order_query"),
    ("查看最近的订单", ["ORDER_LIST", "ORDER_FILTER", "ORDER_STATUS", "REPORT_DASHBOARD_OVERVIEW", None], "order_query"),
    ("订单状态是什么", ["ORDER_LIST", "ORDER_FILTER", "ORDER_STATUS", "REPORT_DASHBOARD_OVERVIEW", None], "order_query"),
    ("今天的订单列表", ["ORDER_LIST", "ORDER_FILTER", "ORDER_STATUS", "REPORT_DASHBOARD_OVERVIEW", "ORDER_TODAY", None], "order_query"),
    ("还有哪些未完成订单", ["ORDER_LIST", "ORDER_FILTER", "ORDER_STATUS", "REPORT_DASHBOARD_OVERVIEW", None], "order_query"),

    # ===== 3. Order Update (5 cases) =====
    ("修改订单数量", ["ORDER_UPDATE", "ORDER_LIST", "PRODUCT_UPDATE", "ORDER_STATUS", None], "order_update"),
    ("订单变更一下交期", ["ORDER_UPDATE", "ORDER_LIST", "PRODUCT_UPDATE", None], "order_update"),
    ("调整订单里的数量", ["ORDER_UPDATE", "ORDER_LIST", "PRODUCT_UPDATE", None], "order_update"),
    ("更改一下交货日期", ["ORDER_UPDATE", "ORDER_LIST", "PRODUCT_UPDATE", "MATERIAL_BATCH_QUERY", None], "order_update"),
    ("给订单加个备注", ["ORDER_UPDATE", "ORDER_LIST", "PRODUCT_UPDATE", None], "order_update"),

    # ===== 4. Order Cancel (5 cases) =====
    ("取消那个订单", ["ORDER_DELETE", "ORDER_CANCEL", "ORDER_UPDATE", None], "order_cancel"),
    ("这个订单作废", ["ORDER_DELETE", "ORDER_CANCEL", "ORDER_UPDATE", None], "order_cancel"),
    ("退单处理一下", ["ORDER_DELETE", "ORDER_CANCEL", "ORDER_UPDATE", None], "order_cancel"),
    ("撤回刚才的订单", ["ORDER_DELETE", "ORDER_CANCEL", "ORDER_UPDATE", None], "order_cancel"),
    ("关闭这个订单吧", ["ORDER_DELETE", "ORDER_CANCEL", "ORDER_UPDATE", None], "order_cancel"),

    # ===== 5. Customer Management (6 cases) =====
    ("看看客户列表", ["CUSTOMER_LIST", "CUSTOMER_CREATE", "CUSTOMER_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "customer_mgmt"),
    ("新增一个客户", ["CUSTOMER_LIST", "CUSTOMER_CREATE", "CUSTOMER_STATS", "REPORT_DASHBOARD_OVERVIEW", "CUSTOMER_SEARCH", None], "customer_mgmt"),
    ("客户信息查一下", ["CUSTOMER_LIST", "CUSTOMER_CREATE", "CUSTOMER_STATS", "REPORT_DASHBOARD_OVERVIEW", "CUSTOMER_SEARCH", None], "customer_mgmt"),
    ("客户分类管理", ["CUSTOMER_LIST", "CUSTOMER_CREATE", "CUSTOMER_STATS", "REPORT_DASHBOARD_OVERVIEW", "CUSTOMER_BY_TYPE", None], "customer_mgmt"),
    ("VIP客户有哪些", ["CUSTOMER_LIST", "CUSTOMER_CREATE", "CUSTOMER_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "customer_mgmt"),
    ("查看客户档案", ["CUSTOMER_LIST", "CUSTOMER_CREATE", "CUSTOMER_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "customer_mgmt"),

    # ===== 6. Customer Analysis (5 cases) =====
    ("做个客户分析", ["CUSTOMER_STATS", "CUSTOMER_PURCHASE_HISTORY", "REPORT_TRENDS", "REPORT_FINANCE", None], "customer_analysis"),
    ("客户购买频次统计", ["CUSTOMER_STATS", "CUSTOMER_PURCHASE_HISTORY", "REPORT_TRENDS", "REPORT_FINANCE", None], "customer_analysis"),
    ("客户画像看看", ["CUSTOMER_STATS", "CUSTOMER_PURCHASE_HISTORY", "REPORT_TRENDS", "REPORT_FINANCE", None], "customer_analysis"),
    ("复购率怎么样", ["CUSTOMER_STATS", "CUSTOMER_PURCHASE_HISTORY", "REPORT_TRENDS", "REPORT_FINANCE", None], "customer_analysis"),
    ("客户流失情况分析", ["CUSTOMER_STATS", "CUSTOMER_PURCHASE_HISTORY", "REPORT_TRENDS", "REPORT_FINANCE", None], "customer_analysis"),

    # ===== 7. Pricing (6 cases) =====
    ("查一下豆腐的价格", ["COST_QUERY", "REPORT_FINANCE", "ORDER_LIST", "PRODUCT_UPDATE", None], "pricing"),
    ("给客户出个报价单", ["COST_QUERY", "REPORT_FINANCE", "ORDER_LIST", "PRODUCT_UPDATE", None], "pricing"),
    ("调价通知发一下", ["COST_QUERY", "REPORT_FINANCE", "ORDER_LIST", "PRODUCT_UPDATE", "MATERIAL_ADJUST_QUANTITY", None], "pricing"),
    ("最近价格变动情况", ["COST_QUERY", "REPORT_FINANCE", "ORDER_LIST", "PRODUCT_UPDATE", "REPORT_TRENDS", None], "pricing"),
    ("客户申请折扣", ["COST_QUERY", "REPORT_FINANCE", "ORDER_LIST", "PRODUCT_UPDATE", None], "pricing"),
    ("优惠策略怎么定", ["COST_QUERY", "REPORT_FINANCE", "ORDER_LIST", "PRODUCT_UPDATE", None], "pricing"),

    # ===== 8. Delivery (6 cases) =====
    ("安排发货", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", "COST_QUERY", None], "delivery"),
    ("配送计划看看", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", "COST_QUERY", None], "delivery"),
    ("物流到哪里了", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", "COST_QUERY", None], "delivery"),
    ("客户确认到货了", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", "COST_QUERY", "MATERIAL_BATCH_CREATE", None], "delivery"),
    ("签收记录查看", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", "COST_QUERY", None], "delivery"),
    ("这批货运费多少", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", "COST_QUERY", None], "delivery"),

    # ===== 9. After-Sales (5 cases) =====
    ("客户要退货", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "CUSTOMER_STATS", "ALERT_LIST", None], "after_sales"),
    ("记录一下客户投诉", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "CUSTOMER_STATS", "ALERT_LIST", None], "after_sales"),
    ("售后跟踪进度", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "CUSTOMER_STATS", "ALERT_LIST", None], "after_sales"),
    ("客户要换货处理", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "CUSTOMER_STATS", "ALERT_LIST", None], "after_sales"),
    ("产品质量投诉", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "CUSTOMER_STATS", "ALERT_LIST", None], "after_sales"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 56 ===")
    print(f"Focus: CUSTOMER & ORDER MANAGEMENT queries")
    print(f"       (order create, query, update, cancel, customer mgmt, analysis, pricing, delivery, after-sales)")
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
        'test': 'v5_round56_customer_order_management',
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
    report_path = f'tests/ai-intent/reports/v5_round56_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
