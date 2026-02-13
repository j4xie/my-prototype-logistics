#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 48
Focus: SUPPLIER & PROCUREMENT DETAIL queries.
       Covers supplier query, supplier evaluate, supplier create,
       purchase order, price management, supplier quality, contract,
       supplier risk, and payment.
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

# Round 48 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Supplier Query (6 cases) =====
    ("供应商列表", ["SUPPLIER_LIST", "SUPPLIER_QUERY", "SUPPLIER_SEARCH", None], "supplier_query"),
    ("查找供应商", ["SUPPLIER_SEARCH", "SUPPLIER_QUERY", "SUPPLIER_LIST", None], "supplier_query"),
    ("供应商信息", ["SUPPLIER_QUERY", "SUPPLIER_LIST", "SUPPLIER_SEARCH", None], "supplier_query"),
    ("供应商联系方式", ["SUPPLIER_QUERY", "SUPPLIER_SEARCH", None], "supplier_query"),
    ("合格供应商", ["SUPPLIER_LIST", "SUPPLIER_QUERY", "SUPPLIER_RANKING", None], "supplier_query"),
    ("供应商分类", ["SUPPLIER_BY_CATEGORY", "SUPPLIER_LIST", "SUPPLIER_QUERY", None], "supplier_query"),

    # ===== 2. Supplier Evaluate (6 cases) =====
    ("供应商评分", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", "SUPPLIER_QUERY", None], "supplier_evaluate"),
    ("供应商考核", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", None], "supplier_evaluate"),
    ("供应商绩效", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", "REPORT_DASHBOARD_OVERVIEW", None], "supplier_evaluate"),
    ("质量评价", ["SUPPLIER_EVALUATE", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "supplier_evaluate"),
    ("交期评价", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", None], "supplier_evaluate"),
    ("价格评价", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", None], "supplier_evaluate"),

    # ===== 3. Supplier Create (5 cases) =====
    ("新增供应商", ["SUPPLIER_CREATE", "SUPPLIER_LIST", None], "supplier_create"),
    ("供应商注册", ["SUPPLIER_CREATE", "SUPPLIER_EVALUATE", None], "supplier_create"),
    ("供应商入库", ["SUPPLIER_CREATE", "SUPPLIER_LIST", None], "supplier_create"),
    ("建立供应商档案", ["SUPPLIER_CREATE", "SUPPLIER_QUERY", None], "supplier_create"),
    ("供应商准入", ["SUPPLIER_CREATE", "SUPPLIER_EVALUATE", None], "supplier_create"),

    # ===== 4. Purchase Order (6 cases) =====
    ("采购订单", ["ORDER_LIST", "ORDER_STATUS", "ORDER_CREATE", None], "purchase_order"),
    ("下采购单", ["ORDER_CREATE", "ORDER_LIST", None], "purchase_order"),
    ("采购审批", ["ORDER_STATUS", "ORDER_LIST", None], "purchase_order"),
    ("紧急采购", ["ORDER_CREATE", "ORDER_LIST", None], "purchase_order"),
    ("采购计划", ["ORDER_CREATE", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", "MRP_CALCULATION", None], "purchase_order"),
    ("询价单", ["ORDER_CREATE", "ORDER_LIST", "SUPPLIER_QUERY", None], "purchase_order"),

    # ===== 5. Price Management (5 cases) =====
    ("价格对比", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", "REPORT_FINANCE", "REPORT_TRENDS", None], "price_management"),
    ("报价管理", ["ORDER_LIST", "SUPPLIER_QUERY", None], "price_management"),
    ("价格变动", ["REPORT_FINANCE", "SUPPLIER_EVALUATE", None], "price_management"),
    ("合同价格", ["SUPPLIER_QUERY", "ORDER_LIST", "REPORT_FINANCE", None], "price_management"),
    ("最新报价", ["SUPPLIER_QUERY", "ORDER_LIST", None], "price_management"),

    # ===== 6. Supplier Quality (6 cases) =====
    ("供应商质量", ["SUPPLIER_EVALUATE", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "supplier_quality"),
    ("来料不良率", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "SUPPLIER_EVALUATE", "QUALITY_STATS", None], "supplier_quality"),
    ("供应商退货", ["SUPPLIER_EVALUATE", "QUALITY_CHECK_QUERY", "MATERIAL_BATCH_QUERY", None], "supplier_quality"),
    ("质量整改", ["QUALITY_CHECK_QUERY", "SUPPLIER_EVALUATE", None], "supplier_quality"),
    ("供应商审核", ["SUPPLIER_EVALUATE", "SUPPLIER_QUERY", None], "supplier_quality"),
    ("供应商认证", ["SUPPLIER_EVALUATE", "SUPPLIER_QUERY", None], "supplier_quality"),

    # ===== 7. Contract (5 cases) =====
    ("合同管理", ["SUPPLIER_QUERY", "ORDER_LIST", None], "contract"),
    ("合同到期", ["SUPPLIER_QUERY", "ORDER_STATUS", None], "contract"),
    ("合同续签", ["SUPPLIER_QUERY", "ORDER_CREATE", None], "contract"),
    ("合同条款", ["SUPPLIER_QUERY", None], "contract"),
    ("框架协议", ["SUPPLIER_QUERY", "ORDER_LIST", None], "contract"),

    # ===== 8. Supplier Risk (5 cases) =====
    ("供应商风险", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", None], "supplier_risk"),
    ("供应中断", ["SUPPLIER_EVALUATE", "SUPPLIER_QUERY", "ORDER_STATUS", None], "supplier_risk"),
    ("备选供应商", ["SUPPLIER_LIST", "SUPPLIER_SEARCH", "SUPPLIER_QUERY", None], "supplier_risk"),
    ("供应链风险", ["SUPPLIER_EVALUATE", "REPORT_DASHBOARD_OVERVIEW", None], "supplier_risk"),
    ("单一来源风险", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", "SUPPLIER_RANKING", None], "supplier_risk"),

    # ===== 9. Payment (6 cases) =====
    ("付款计划", ["REPORT_FINANCE", "ORDER_STATUS", None], "payment"),
    ("应付账款", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "payment"),
    ("付款审批", ["ORDER_STATUS", "REPORT_FINANCE", None], "payment"),
    ("发票核对", ["REPORT_FINANCE", "ORDER_STATUS", None], "payment"),
    ("付款进度", ["ORDER_STATUS", "REPORT_FINANCE", None], "payment"),
    ("账期管理", ["REPORT_FINANCE", "SUPPLIER_QUERY", "MATERIAL_EXPIRING_ALERT", None], "payment"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 48 ===")
    print(f"Focus: SUPPLIER & PROCUREMENT DETAIL queries")
    print(f"       (supplier query, evaluate, create, purchase order,")
    print(f"        price management, supplier quality, contract, risk, payment)")
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
        'test': 'v5_round48_supplier_procurement',
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
    report_path = f'tests/ai-intent/reports/v5_round48_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
