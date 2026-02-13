#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 22
Focus: SUPPLIER & PROCUREMENT MANAGEMENT - supplier queries, procurement orders,
       supplier evaluation, raw material sourcing, bidding, contracts,
       supplier audits, payment, and compliance.
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

# Round 22 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Supplier Search/List (6 cases) =====
    ("查看供应商列表", ["SUPPLIER_LIST", "ORDER_LIST"], "supplier-list"),
    ("帮我找一下调味料的供应商", ["SUPPLIER_LIST", "MATERIAL_BATCH_QUERY", "SUPPLIER_BY_CATEGORY"], "supplier-find"),
    ("优选供应商有哪些", ["SUPPLIER_LIST", "SUPPLIER_EVALUATE"], "supplier-preferred"),
    ("新增一个供应商", ["SUPPLIER_CREATE", "ORDER_CREATE", None], "supplier-new"),
    ("查询供应商联系方式", ["SUPPLIER_LIST", "SUPPLIER_SEARCH", None], "supplier-contact"),
    ("哪些供应商能供应面粉", ["SUPPLIER_LIST", "MATERIAL_BATCH_QUERY", "MATERIAL_LOW_STOCK_ALERT"], "supplier-by-material"),

    # ===== 2. Procurement Orders (6 cases) =====
    ("创建采购订单", ["ORDER_CREATE", "SUPPLIER_CREATE", "ORDER_LIST", None], "procurement-create"),
    ("采购单状态查询", ["ORDER_STATUS", "ORDER_LIST"], "procurement-status"),
    ("待审核采购单", ["ORDER_LIST", "ORDER_STATUS"], "procurement-pending"),
    ("审批采购订单", ["ORDER_STATUS", "ORDER_LIST", None], "procurement-approve"),
    ("采购订单到货情况", ["ORDER_STATUS", "ORDER_LIST", "MATERIAL_BATCH_QUERY"], "procurement-delivery"),
    ("上个月采购记录", ["ORDER_LIST", "ORDER_STATUS", "REPORT_TRENDS", "CUSTOMER_PURCHASE_HISTORY"], "procurement-history"),

    # ===== 3. Supplier Evaluation (5 cases) =====
    ("供应商评分", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", "REPORT_KPI", "SUPPLIER_RANKING"], "evaluation-rating"),
    ("供应商绩效评估", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", "REPORT_KPI"], "evaluation-performance"),
    ("比较几家供应商", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST"], "evaluation-comparison"),
    ("供应商审核结果", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", "QUALITY_STATS", None], "evaluation-audit"),
    ("供应商质量记录", ["SUPPLIER_EVALUATE", "QUALITY_CHECK_QUERY", "QUALITY_STATS", None], "evaluation-quality"),

    # ===== 4. Material Sourcing (6 cases) =====
    ("查找原料货源", ["MATERIAL_BATCH_QUERY", "SUPPLIER_LIST", "MATERIAL_LOW_STOCK_ALERT"], "sourcing-find"),
    ("有没有替代原料", ["MATERIAL_BATCH_QUERY", "SUPPLIER_LIST", None], "sourcing-alternative"),
    ("原材料价格对比", ["MATERIAL_BATCH_QUERY", "REPORT_FINANCE", "REPORT_TRENDS", "SUPPLIER_EVALUATE"], "sourcing-price-compare"),
    ("进口原料采购渠道", ["SUPPLIER_LIST", "MATERIAL_BATCH_QUERY", None], "sourcing-import"),
    ("本地供应商推荐", ["SUPPLIER_LIST", None], "sourcing-local"),
    ("有机认证原料供应商", ["SUPPLIER_LIST", "FOOD_SAFETY_CERT_QUERY", None], "sourcing-organic"),

    # ===== 5. Bidding/Tendering (5 cases) =====
    ("发布招标公告", ["ORDER_CREATE", None], "bidding-announce"),
    ("投标情况汇总", ["ORDER_LIST", "ORDER_STATUS", "REPORT_TRENDS", None], "bidding-submission"),
    ("各供应商报价对比", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", "REPORT_FINANCE", None], "bidding-comparison"),
    ("确定中标供应商", ["SUPPLIER_EVALUATE", "ORDER_CREATE", None], "bidding-award"),
    ("招标结果公示", ["ORDER_STATUS", "ORDER_LIST", None], "bidding-results"),

    # ===== 6. Price Negotiation (5 cases) =====
    ("跟供应商谈价格", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", "ORDER_CREATE", None], "price-negotiate"),
    ("批量采购折扣", ["ORDER_CREATE", "REPORT_FINANCE", None], "price-bulk-discount"),
    ("合同价格查询", ["ORDER_STATUS", "ORDER_LIST", "REPORT_FINANCE", None], "price-contract"),
    ("原料价格趋势", ["REPORT_TRENDS", "REPORT_FINANCE", "MATERIAL_BATCH_QUERY"], "price-trend"),
    ("更新采购价格", ["ORDER_CREATE", "ORDER_STATUS", "ORDER_LIST", None], "price-update"),

    # ===== 7. Supplier Quality (5 cases) =====
    ("供应商质量报告", ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "SUPPLIER_EVALUATE", "REPORT_FINANCE", "REPORT_QUALITY"], "quality-supplier-report"),
    ("来料检验记录", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "MATERIAL_BATCH_QUERY"], "quality-incoming-inspect"),
    ("各供应商退货率", ["QUALITY_STATS", "SUPPLIER_EVALUATE", "REPORT_TRENDS", None], "quality-rejection-rate"),
    ("供应商质量改进计划", ["SUPPLIER_EVALUATE", "QUALITY_STATS", None], "quality-improvement"),
    ("供应商纠正措施跟踪", ["SUPPLIER_EVALUATE", "QUALITY_CHECK_QUERY", None], "quality-corrective"),

    # ===== 8. Payment & Finance (6 cases) =====
    ("供应商付款状态", ["ORDER_STATUS", "REPORT_FINANCE", "ORDER_LIST", None], "payment-status"),
    ("采购发票查询", ["ORDER_LIST", "ORDER_STATUS", "REPORT_FINANCE", None], "payment-invoice"),
    ("供应商账户余额", ["REPORT_FINANCE", "ORDER_STATUS", None], "payment-balance"),
    ("逾期未付款项", ["ORDER_STATUS", "REPORT_FINANCE", "ORDER_LIST", None], "payment-overdue"),
    ("付款排期计划", ["ORDER_LIST", "REPORT_FINANCE", "MATERIAL_EXPIRING_ALERT", None], "payment-schedule"),
    ("预付款申请", ["ORDER_CREATE", "REPORT_FINANCE", None], "payment-advance"),

    # ===== 9. Supplier Compliance (6 cases) =====
    ("查看供应商资质证书", ["FOOD_SAFETY_CERT_QUERY", "SUPPLIER_LIST", "SUPPLIER_EVALUATE"], "compliance-certificate"),
    ("供应商审核排期", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", None], "compliance-audit-schedule"),
    ("供应商合规检查", ["SUPPLIER_EVALUATE", "FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", None], "compliance-check"),
    ("供应商黑名单", ["SUPPLIER_LIST", "SUPPLIER_EVALUATE", None], "compliance-blacklist"),
    ("供应商风险评估", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", "REPORT_KPI", None], "compliance-risk"),
    ("供应商HACCP认证查询", ["FOOD_SAFETY_CERT_QUERY", "SUPPLIER_EVALUATE", "SUPPLIER_LIST", None], "compliance-haccp"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 22 ===")
    print(f"Focus: SUPPLIER & PROCUREMENT MANAGEMENT - supplier queries, procurement orders,")
    print(f"       evaluation, material sourcing, bidding, price negotiation, quality, payment, compliance")
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
        'test': 'v5_round22_supplier_procurement',
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
    report_path = f'tests/ai-intent/reports/v5_round22_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
