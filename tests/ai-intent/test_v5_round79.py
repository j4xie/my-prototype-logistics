#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 79
Focus: VENDOR & CONTRACT MANAGEMENT queries for food manufacturing.
       Covers vendor onboard, vendor eval, vendor query, contract mgmt,
       procurement, price negotiate, delivery track, vendor issue, and spend analysis.
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

# Round 79 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Vendor Onboard (6 cases) =====
    ("供应商入库", ["SUPPLIER_CREATE", "SUPPLIER_LIST", "SUPPLIER_EVALUATE", "REPORT_DASHBOARD_OVERVIEW", None], "vendor_onboard"),
    ("新增供应商", ["SUPPLIER_CREATE", "SUPPLIER_LIST", "SUPPLIER_EVALUATE", "REPORT_DASHBOARD_OVERVIEW", None], "vendor_onboard"),
    ("供应商注册", ["SUPPLIER_CREATE", "SUPPLIER_LIST", "SUPPLIER_EVALUATE", "REPORT_DASHBOARD_OVERVIEW", None], "vendor_onboard"),
    ("供应商审核", ["SUPPLIER_CREATE", "SUPPLIER_LIST", "SUPPLIER_EVALUATE", "REPORT_DASHBOARD_OVERVIEW", None], "vendor_onboard"),
    ("供应商准入", ["SUPPLIER_CREATE", "SUPPLIER_LIST", "SUPPLIER_EVALUATE", "REPORT_DASHBOARD_OVERVIEW", None], "vendor_onboard"),
    ("合格供应商", ["SUPPLIER_CREATE", "SUPPLIER_LIST", "SUPPLIER_EVALUATE", "REPORT_DASHBOARD_OVERVIEW", "SUPPLIER_RANKING", None], "vendor_onboard"),

    # ===== 2. Vendor Eval (6 cases) =====
    ("供应商评价", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", "SUPPLIER_LIST", "REPORT_TRENDS", None], "vendor_eval"),
    ("评分更新", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", "SUPPLIER_LIST", "REPORT_TRENDS", None], "vendor_eval"),
    ("供应商考核", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", "SUPPLIER_LIST", "REPORT_TRENDS", None], "vendor_eval"),
    ("绩效评估", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", "SUPPLIER_LIST", "REPORT_TRENDS", "REPORT_KPI", None], "vendor_eval"),
    ("供应商打分", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", "SUPPLIER_LIST", "REPORT_TRENDS", None], "vendor_eval"),
    ("合格评定", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", "SUPPLIER_LIST", "REPORT_TRENDS", None], "vendor_eval"),

    # ===== 3. Vendor Query (5 cases) =====
    ("供应商查询", ["SUPPLIER_LIST", "SUPPLIER_SEARCH", "FOOD_SAFETY_CERT_QUERY", None], "vendor_query"),
    ("查找供应商", ["SUPPLIER_LIST", "SUPPLIER_SEARCH", "FOOD_SAFETY_CERT_QUERY", None], "vendor_query"),
    ("供应商列表", ["SUPPLIER_LIST", "SUPPLIER_SEARCH", "FOOD_SAFETY_CERT_QUERY", None], "vendor_query"),
    ("供应商信息", ["SUPPLIER_LIST", "SUPPLIER_SEARCH", "FOOD_SAFETY_CERT_QUERY", None], "vendor_query"),
    ("供应商资质", ["SUPPLIER_LIST", "SUPPLIER_SEARCH", "FOOD_SAFETY_CERT_QUERY", "SUPPLIER_EVALUATE", None], "vendor_query"),

    # ===== 4. Contract Mgmt (6 cases) =====
    ("合同管理", ["PLAN_UPDATE", "SUPPLIER_LIST", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_EXPIRING_ALERT", None], "contract_mgmt"),
    ("合同签订", ["PLAN_UPDATE", "SUPPLIER_LIST", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_EXPIRING_ALERT", None], "contract_mgmt"),
    ("合同到期", ["PLAN_UPDATE", "SUPPLIER_LIST", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_EXPIRING_ALERT", None], "contract_mgmt"),
    ("续签合同", ["PLAN_UPDATE", "SUPPLIER_LIST", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_EXPIRING_ALERT", None], "contract_mgmt"),
    ("合同条款", ["PLAN_UPDATE", "SUPPLIER_LIST", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_EXPIRING_ALERT", None], "contract_mgmt"),
    ("合同审批", ["PLAN_UPDATE", "SUPPLIER_LIST", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_EXPIRING_ALERT", None], "contract_mgmt"),

    # ===== 5. Procurement (5 cases) =====
    ("采购下单", ["MRP_CALCULATION", "ORDER_CREATE", "SUPPLIER_LIST", "MATERIAL_LOW_STOCK_ALERT", None], "procurement"),
    ("采购申请", ["MRP_CALCULATION", "ORDER_CREATE", "SUPPLIER_LIST", "MATERIAL_LOW_STOCK_ALERT", None], "procurement"),
    ("采购订单", ["MRP_CALCULATION", "ORDER_CREATE", "SUPPLIER_LIST", "MATERIAL_LOW_STOCK_ALERT", "ORDER_LIST", None], "procurement"),
    ("紧急采购", ["MRP_CALCULATION", "ORDER_CREATE", "SUPPLIER_LIST", "MATERIAL_LOW_STOCK_ALERT", None], "procurement"),
    ("补充采购", ["MRP_CALCULATION", "ORDER_CREATE", "SUPPLIER_LIST", "MATERIAL_LOW_STOCK_ALERT", None], "procurement"),

    # ===== 6. Price Negotiate (6 cases) =====
    ("价格谈判", ["COST_QUERY", "SUPPLIER_EVALUATE", "REPORT_FINANCE", "SUPPLIER_LIST", None], "price_negotiate"),
    ("比价", ["COST_QUERY", "SUPPLIER_EVALUATE", "REPORT_FINANCE", "SUPPLIER_LIST", None], "price_negotiate"),
    ("议价", ["COST_QUERY", "SUPPLIER_EVALUATE", "REPORT_FINANCE", "SUPPLIER_LIST", None], "price_negotiate"),
    ("招标", ["COST_QUERY", "SUPPLIER_EVALUATE", "REPORT_FINANCE", "SUPPLIER_LIST", None], "price_negotiate"),
    ("竞标", ["COST_QUERY", "SUPPLIER_EVALUATE", "REPORT_FINANCE", "SUPPLIER_LIST", None], "price_negotiate"),
    ("报价对比", ["COST_QUERY", "SUPPLIER_EVALUATE", "REPORT_FINANCE", "SUPPLIER_LIST", "REPORT_TRENDS", None], "price_negotiate"),

    # ===== 7. Delivery Track (5 cases) =====
    ("供应商交货", ["SHIPMENT_QUERY", "SUPPLIER_EVALUATE", "ALERT_LIST", "MATERIAL_BATCH_QUERY", "SUPPLIER_RANKING", None], "delivery_track"),
    ("到货跟踪", ["SHIPMENT_QUERY", "SUPPLIER_EVALUATE", "ALERT_LIST", "MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CREATE", None], "delivery_track"),
    ("交期监控", ["SHIPMENT_QUERY", "SUPPLIER_EVALUATE", "ALERT_LIST", "MATERIAL_BATCH_QUERY", "MATERIAL_EXPIRING_ALERT", None], "delivery_track"),
    ("延期预警", ["SHIPMENT_QUERY", "SUPPLIER_EVALUATE", "ALERT_LIST", "MATERIAL_BATCH_QUERY", None], "delivery_track"),
    ("催货", ["SHIPMENT_QUERY", "SUPPLIER_EVALUATE", "ALERT_LIST", "MATERIAL_BATCH_QUERY", None], "delivery_track"),

    # ===== 8. Vendor Issue (6 cases) =====
    ("供应商投诉", ["SUPPLIER_EVALUATE", "QUALITY_DISPOSITION_EXECUTE", "SUPPLIER_LIST", "ALERT_LIST", None], "vendor_issue"),
    ("质量退货", ["SUPPLIER_EVALUATE", "QUALITY_DISPOSITION_EXECUTE", "SUPPLIER_LIST", "ALERT_LIST", "QUALITY_CHECK_QUERY", None], "vendor_issue"),
    ("索赔处理", ["SUPPLIER_EVALUATE", "QUALITY_DISPOSITION_EXECUTE", "SUPPLIER_LIST", "ALERT_LIST", None], "vendor_issue"),
    ("扣款通知", ["SUPPLIER_EVALUATE", "QUALITY_DISPOSITION_EXECUTE", "SUPPLIER_LIST", "ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG", None], "vendor_issue"),
    ("供应商整改", ["SUPPLIER_EVALUATE", "QUALITY_DISPOSITION_EXECUTE", "SUPPLIER_LIST", "ALERT_LIST", None], "vendor_issue"),
    ("黑名单", ["SUPPLIER_EVALUATE", "QUALITY_DISPOSITION_EXECUTE", "SUPPLIER_LIST", "ALERT_LIST", None], "vendor_issue"),

    # ===== 9. Spend Analysis (5 cases) =====
    ("采购分析", ["REPORT_FINANCE", "COST_QUERY", "REPORT_TRENDS", "SUPPLIER_EVALUATE", None], "spend_analysis"),
    ("采购金额", ["REPORT_FINANCE", "COST_QUERY", "REPORT_TRENDS", "SUPPLIER_EVALUATE", None], "spend_analysis"),
    ("供应商占比", ["REPORT_FINANCE", "COST_QUERY", "REPORT_TRENDS", "SUPPLIER_EVALUATE", None], "spend_analysis"),
    ("采购趋势", ["REPORT_FINANCE", "COST_QUERY", "REPORT_TRENDS", "SUPPLIER_EVALUATE", None], "spend_analysis"),
    ("采购预算", ["REPORT_FINANCE", "COST_QUERY", "REPORT_TRENDS", "SUPPLIER_EVALUATE", None], "spend_analysis"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 79 ===")
    print(f"Focus: VENDOR & CONTRACT MANAGEMENT queries")
    print(f"       (onboard, eval, query, contract, procurement, price, delivery, issue, spend)")
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
        'test': 'v5_round79_vendor_contract_management',
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
    report_path = f'tests/ai-intent/reports/v5_round79_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
