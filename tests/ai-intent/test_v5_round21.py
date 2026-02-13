#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 21
Focus: CUSTOMER & ORDER MANAGEMENT - customer queries, order creation/status/tracking,
       complaints, customer profiles, pricing, discounts, contracts, CRM.
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

# Round 21 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Customer Search/Profile (6 cases) =====
    ("查一下客户张三的信息", ["CUSTOMER_SEARCH", "ORDER_LIST", None], "customer-lookup"),
    ("客户列表", ["CUSTOMER_SEARCH", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", "CUSTOMER_LIST"], "customer-list"),
    ("华东食品公司的联系方式", ["CUSTOMER_SEARCH", None], "customer-contact"),
    ("VIP客户有哪些", ["CUSTOMER_SEARCH", "ORDER_LIST", "REPORT_KPI", "CUSTOMER_LIST", None], "customer-vip"),
    ("最近新增了哪些客户", ["CUSTOMER_SEARCH", "CUSTOMER_CREATE", "REPORT_TRENDS", None], "customer-new"),
    ("这个客户的历史订单", ["ORDER_LIST", "ORDER_STATUS", "CUSTOMER_SEARCH", "CUSTOMER_PURCHASE_HISTORY"], "customer-history"),

    # ===== 2. Order Creation (5 cases) =====
    ("创建一个新订单", ["ORDER_CREATE", "ORDER_UPDATE", "ORDER_LIST", None], "order-create"),
    ("帮我下一个订单", ["ORDER_CREATE", None], "order-new"),
    ("华东食品要订500箱牛奶", ["ORDER_CREATE", None], "order-place"),
    ("快速下单", ["ORDER_CREATE", None], "order-quick"),
    ("上次订单再来一单", ["ORDER_CREATE", "ORDER_LIST", None], "order-reorder"),

    # ===== 3. Order Status (6 cases) =====
    ("订单进度怎么样了", ["ORDER_STATUS", "ORDER_LIST", "SHIPMENT_QUERY", "PRODUCTION_STATUS_QUERY"], "order-progress"),
    ("待处理的订单", ["ORDER_LIST", "ORDER_STATUS", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST"], "order-pending"),
    ("今天的订单情况", ["ORDER_LIST", "ORDER_STATUS", "REPORT_DASHBOARD_OVERVIEW", "ORDER_TODAY"], "order-today"),
    ("逾期订单有多少", ["ORDER_LIST", "ORDER_STATUS", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "order-overdue"),
    ("紧急订单", ["ORDER_LIST", "ORDER_STATUS", None], "order-urgent"),
    ("订单ORD-2026-0015的进展", ["ORDER_STATUS", "ORDER_LIST", "SHIPMENT_QUERY"], "order-timeline"),

    # ===== 4. Order Modification (5 cases) =====
    ("修改订单数量", ["ORDER_UPDATE", "ORDER_STATUS", None], "order-modify"),
    ("取消订单ORD-2026-0023", ["ORDER_UPDATE", "ORDER_STATUS", None], "order-cancel"),
    ("把数量改成300箱", ["ORDER_UPDATE", None], "order-change-qty"),
    ("交货日期推迟到下周五", ["ORDER_UPDATE", "SHIPMENT_CREATE", "MATERIAL_LOW_STOCK_ALERT", None], "order-change-date"),
    ("这个订单拆成两批发货", ["ORDER_UPDATE", "SHIPMENT_CREATE", None], "order-split"),

    # ===== 5. Pricing & Quotation (5 cases) =====
    ("纯牛奶的出厂价是多少", ["MATERIAL_BATCH_QUERY", "ORDER_LIST", "REPORT_FINANCE", None], "pricing-query"),
    ("给华东食品做一份报价单", ["ORDER_CREATE", "REPORT_FINANCE", None], "pricing-quotation"),
    ("这个客户有折扣吗", ["CUSTOMER_SEARCH", "ORDER_LIST", "REPORT_FINANCE", None], "pricing-discount"),
    ("产品价格表", ["MATERIAL_BATCH_QUERY", "REPORT_FINANCE", None], "pricing-list"),
    ("大客户特殊定价", ["CUSTOMER_SEARCH", "REPORT_FINANCE", None], "pricing-special"),

    # ===== 6. Complaints & Returns (6 cases) =====
    ("客户投诉了", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "CUSTOMER_SEARCH", None], "complaint-general"),
    ("产品质量问题投诉", ["QUALITY_CHECK_QUERY", "QUALITY_STATS"], "complaint-quality"),
    ("客户反映配送延迟", ["SHIPMENT_QUERY", "SHIPMENT_BY_DATE", "QUALITY_CHECK_QUERY", None], "complaint-delivery"),
    ("客户要求退货", ["ORDER_UPDATE", "QUALITY_CHECK_QUERY", None], "complaint-return"),
    ("退款申请", ["ORDER_UPDATE", "REPORT_FINANCE", None], "complaint-refund"),
    ("需要给客户赔偿", ["ORDER_UPDATE", "REPORT_FINANCE", None], "complaint-compensation"),

    # ===== 7. Contracts (5 cases) =====
    ("查看合同信息", ["ORDER_LIST", "CUSTOMER_SEARCH", None], "contract-query"),
    ("合同快到期了需要续签", ["ORDER_UPDATE", "CUSTOMER_SEARCH", "PROCESSING_WORKER_CHECKOUT", None], "contract-renewal"),
    ("下个月到期的合同", ["ORDER_LIST", "REPORT_TRENDS", "CUSTOMER_SEARCH", "MATERIAL_EXPIRING_ALERT", None], "contract-expiring"),
    ("签一份新合同", ["ORDER_CREATE", "CUSTOMER_CREATE", None], "contract-new"),
    ("合同条款有变更", ["ORDER_UPDATE", None], "contract-terms"),

    # ===== 8. Delivery (6 cases) =====
    ("发货情况", ["SHIPMENT_QUERY", "SHIPMENT_BY_DATE", "ORDER_STATUS"], "delivery-status"),
    ("这周的发货计划", ["SHIPMENT_BY_DATE", "SHIPMENT_QUERY", "ORDER_LIST", "MATERIAL_BATCH_QUERY"], "delivery-schedule"),
    ("客户要求加急发货", ["SHIPMENT_CREATE", "ORDER_UPDATE", None], "delivery-express"),
    ("修改收货地址", ["ORDER_UPDATE", "SHIPMENT_CREATE", "SHIPMENT_UPDATE", None], "delivery-address"),
    ("确认收货", ["SHIPMENT_QUERY", "ORDER_UPDATE", "MATERIAL_BATCH_QUERY", None], "delivery-confirmation"),
    ("物流出了问题", ["SHIPMENT_QUERY", "QUALITY_CHECK_QUERY", None], "delivery-issues"),

    # ===== 9. CRM Analytics (6 cases) =====
    ("客户满意度怎么样", ["REPORT_KPI", "QUALITY_STATS", "REPORT_TRENDS", "CUSTOMER_STATS", None], "crm-satisfaction"),
    ("客户流失率", ["REPORT_KPI", "REPORT_TRENDS", "REPORT_FINANCE", None], "crm-churn"),
    ("前十大客户是哪些", ["CUSTOMER_SEARCH", "REPORT_KPI", "REPORT_FINANCE", "ORDER_LIST", "CUSTOMER_LIST", None], "crm-top-customers"),
    ("按客户统计销售额", ["REPORT_FINANCE", "REPORT_TRENDS", "ORDER_LIST", "REPORT_KPI", "CUSTOMER_STATS"], "crm-sales-by-customer"),
    ("客户分级分析", ["CUSTOMER_SEARCH", "REPORT_KPI", "REPORT_TRENDS", "CUSTOMER_STATS", None], "crm-segment"),
    ("复购率统计", ["REPORT_KPI", "REPORT_TRENDS", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "crm-repeat-purchase"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 21 ===")
    print(f"Focus: CUSTOMER & ORDER MANAGEMENT - customer queries, order creation/status/tracking,")
    print(f"       complaints, pricing, contracts, delivery, CRM analytics")
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
        'test': 'v5_round21_customer_order_management',
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
    report_path = f'tests/ai-intent/reports/v5_round21_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
