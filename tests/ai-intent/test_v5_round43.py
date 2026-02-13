#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 43
Focus: MATERIAL MANAGEMENT queries for food manufacturing.
       Covers material query, receive, issue, tracking, expiry management,
       stock levels, adjustments, material analysis, and BOM/recipe.
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

# Round 43 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Material Query (6 cases) =====
    ("原材料库存", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_INVENTORY", None], "material_query"),
    ("查一下面粉库存", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "INVENTORY_CHECK", None], "material_query"),
    ("大豆还有多少", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "INVENTORY_CHECK", "REPORT_INVENTORY", None], "material_query"),
    ("辅料够不够", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "MATERIAL_LOW_STOCK_ALERT", None], "material_query"),
    ("包装材料查一下", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "INVENTORY_CHECK", None], "material_query"),
    ("调味料库存", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "INVENTORY_CHECK", "REPORT_INVENTORY", None], "material_query"),

    # ===== 2. Material Receive (6 cases) =====
    ("物料到货了", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", None], "material_receive"),
    ("入库登记", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", None], "material_receive"),
    ("签收物料", ["MATERIAL_BATCH_CREATE", "MATERIAL_BATCH_QUERY", None], "material_receive"),
    ("到货数量确认", ["MATERIAL_BATCH_CREATE", "INVENTORY_CHECK", "QUALITY_CHECK_EXECUTE", None], "material_receive"),
    ("收货质检", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "MATERIAL_BATCH_CREATE", None], "material_receive"),
    ("入库上架", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", None], "material_receive"),

    # ===== 3. Material Issue (6 cases) =====
    ("领料申请", ["MATERIAL_BATCH_CONSUME", "MATERIAL_BATCH_QUERY", None], "material_issue"),
    ("出库一批面粉", ["MATERIAL_BATCH_CONSUME", "MATERIAL_ADJUST_QUANTITY", "MATERIAL_BATCH_QUERY", None], "material_issue"),
    ("车间要料", ["MATERIAL_BATCH_CONSUME", "PRODUCTION_STATUS_QUERY", None], "material_issue"),
    ("投料记录", ["MATERIAL_BATCH_CONSUME", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", None], "material_issue"),
    ("发料确认", ["MATERIAL_BATCH_CONSUME", None], "material_issue"),
    ("退料处理", ["MATERIAL_BATCH_CONSUME", "MATERIAL_ADJUST_QUANTITY", None], "material_issue"),

    # ===== 4. Material Tracking (5 cases) =====
    ("物料批次追踪", ["TRACE_BATCH", "TRACE_FULL", "MATERIAL_BATCH_QUERY", None], "material_tracking"),
    ("原料来源", ["TRACE_BATCH", "TRACE_FULL", "MATERIAL_BATCH_QUERY", None], "material_tracking"),
    ("物料去向", ["TRACE_BATCH", "TRACE_FULL", "MATERIAL_BATCH_CONSUME", "MATERIAL_BATCH_QUERY", None], "material_tracking"),
    ("批次信息查看", ["TRACE_BATCH", "MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL", None], "material_tracking"),
    ("物料使用记录", ["MATERIAL_BATCH_CONSUME", "TRACE_BATCH", "TRACE_FULL", "REPORT_INVENTORY", None], "material_tracking"),

    # ===== 5. Expiry Management (6 cases) =====
    ("快到期的物料", ["MATERIAL_EXPIRING_ALERT", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", None], "expiry_management"),
    ("过期物料处理", ["MATERIAL_EXPIRING_ALERT", "MATERIAL_ADJUST_QUANTITY", "QUALITY_CHECK_EXECUTE", "MATERIAL_EXPIRED_QUERY", None], "expiry_management"),
    ("保质期查看", ["MATERIAL_EXPIRING_ALERT", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "expiry_management"),
    ("先进先出检查", ["MATERIAL_FIFO_RECOMMEND", "MATERIAL_EXPIRING_ALERT", "INVENTORY_CHECK", None], "expiry_management"),
    ("临期预警", ["MATERIAL_EXPIRING_ALERT", "MATERIAL_LOW_STOCK_ALERT", None], "expiry_management"),
    ("效期管理", ["MATERIAL_EXPIRING_ALERT", "MATERIAL_FIFO_RECOMMEND", "INVENTORY_QUERY", None], "expiry_management"),

    # ===== 6. Stock Level (5 cases) =====
    ("安全库存", ["MATERIAL_LOW_STOCK_ALERT", "INVENTORY_QUERY", "INVENTORY_CHECK", "REPORT_INVENTORY", None], "stock_level"),
    ("库存预警", ["MATERIAL_LOW_STOCK_ALERT", "MATERIAL_EXPIRING_ALERT", "INVENTORY_CHECK", "REPORT_INVENTORY", None], "stock_level"),
    ("补货提醒", ["MATERIAL_LOW_STOCK_ALERT", "INVENTORY_QUERY", None], "stock_level"),
    ("低库存物料", ["MATERIAL_LOW_STOCK_ALERT", "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", None], "stock_level"),
    ("库存不足", ["MATERIAL_LOW_STOCK_ALERT", "INVENTORY_QUERY", "INVENTORY_CHECK", None], "stock_level"),

    # ===== 7. Material Adjust (6 cases) =====
    ("库存调整", ["MATERIAL_ADJUST_QUANTITY", "INVENTORY_QUERY", "REPORT_INVENTORY", None], "material_adjust"),
    ("盘点差异", ["MATERIAL_ADJUST_QUANTITY", "INVENTORY_CHECK", "REPORT_INVENTORY", None], "material_adjust"),
    ("损耗登记", ["MATERIAL_ADJUST_QUANTITY", "MATERIAL_BATCH_CONSUME", None], "material_adjust"),
    ("报废处理", ["MATERIAL_ADJUST_QUANTITY", "QUALITY_CHECK_EXECUTE", "QUALITY_DISPOSITION_EXECUTE", None], "material_adjust"),
    ("库存冲销", ["MATERIAL_ADJUST_QUANTITY", "REPORT_INVENTORY", None], "material_adjust"),
    ("数量修正", ["MATERIAL_ADJUST_QUANTITY", "PRODUCT_UPDATE", None], "material_adjust"),

    # ===== 8. Material Analysis (5 cases) =====
    ("物料消耗分析", ["REPORT_INVENTORY", "REPORT_TRENDS", "COST_QUERY", "MATERIAL_BATCH_CONSUME", None], "material_analysis"),
    ("用料趋势", ["REPORT_TRENDS", "REPORT_INVENTORY", "REPORT_PRODUCTION", None], "material_analysis"),
    ("原料成本变化", ["COST_QUERY", "REPORT_TRENDS", "REPORT_INVENTORY", None], "material_analysis"),
    ("物料利用率", ["REPORT_PRODUCTION", "REPORT_INVENTORY", "REPORT_TRENDS", "MATERIAL_BATCH_QUERY", None], "material_analysis"),
    ("损耗率分析", ["REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_INVENTORY", "COST_QUERY", None], "material_analysis"),

    # ===== 9. BOM/Recipe (5 cases) =====
    ("配方查看", ["PRODUCTION_STATUS_QUERY", "MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "bom_recipe"),
    ("BOM清单", ["PRODUCTION_STATUS_QUERY", "MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_LIST", None], "bom_recipe"),
    ("用料标准", ["PRODUCTION_STATUS_QUERY", "MATERIAL_BATCH_QUERY", "QUALITY_CHECK_QUERY", None], "bom_recipe"),
    ("配比调整", ["PRODUCTION_STATUS_QUERY", "PRODUCT_UPDATE", "MATERIAL_BATCH_QUERY", None], "bom_recipe"),
    ("替代料方案", ["MATERIAL_BATCH_QUERY", "PRODUCTION_STATUS_QUERY", None], "bom_recipe"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 43 ===")
    print(f"Focus: MATERIAL MANAGEMENT queries")
    print(f"       (query, receive, issue, tracking, expiry, stock, adjust, analysis, BOM/recipe)")
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
        'test': 'v5_round43_material_management',
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
    report_path = f'tests/ai-intent/reports/v5_round43_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
