#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 78
Focus: PRODUCT LIFECYCLE queries for food manufacturing.
       Covers new product, product query, recipe management, SKU,
       product testing, product launch, product retire, packaging, and labeling.
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

# Round 78 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. New Product (6 cases) =====
    ("新产品开发流程", ["PRODUCT_UPDATE", "PROCESSING_BATCH_CREATE", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "new_product"),
    ("新品立项申请", ["PRODUCT_UPDATE", "PROCESSING_BATCH_CREATE", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "new_product"),
    ("配方研发进度", ["PRODUCT_UPDATE", "PROCESSING_BATCH_CREATE", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "new_product"),
    ("新品试产安排", ["PROCESSING_BATCH_CREATE", "PRODUCT_UPDATE", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "new_product"),
    ("产品设计方案", ["PRODUCT_UPDATE", "PROCESSING_BATCH_CREATE", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "new_product"),
    ("新品注册备案", ["PRODUCT_UPDATE", "PROCESSING_BATCH_CREATE", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "new_product"),

    # ===== 2. Product Query (6 cases) =====
    ("产品信息查询", ["PRODUCT_TYPE_QUERY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", None], "product_query"),
    ("产品列表", ["PRODUCT_TYPE_QUERY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "product_query"),
    ("查看产品详情", ["PRODUCT_TYPE_QUERY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", None], "product_query"),
    ("产品规格信息", ["PRODUCT_TYPE_QUERY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", None], "product_query"),
    ("产品编码查询", ["PRODUCT_TYPE_QUERY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "product_query"),
    ("搜索产品", ["PRODUCT_TYPE_QUERY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "product_query"),

    # ===== 3. Recipe Management (5 cases) =====
    ("配方管理", ["PRODUCTION_STATUS_QUERY", "PRODUCT_UPDATE", "PLAN_UPDATE", "COST_QUERY", None], "recipe_mgmt"),
    ("配方调整记录", ["PRODUCTION_STATUS_QUERY", "PRODUCT_UPDATE", "PLAN_UPDATE", "COST_QUERY", None], "recipe_mgmt"),
    ("配方版本对比", ["PRODUCTION_STATUS_QUERY", "PRODUCT_UPDATE", "PLAN_UPDATE", "COST_QUERY", None], "recipe_mgmt"),
    ("配方审批流程", ["PLAN_UPDATE", "PRODUCTION_STATUS_QUERY", "PRODUCT_UPDATE", "COST_QUERY", None], "recipe_mgmt"),
    ("配方成本核算", ["COST_QUERY", "PRODUCTION_STATUS_QUERY", "PRODUCT_UPDATE", "PLAN_UPDATE", "REPORT_FINANCE", None], "recipe_mgmt"),

    # ===== 4. SKU (6 cases) =====
    ("SKU管理", ["PRODUCT_TYPE_QUERY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", None], "sku"),
    ("规格管理列表", ["PRODUCT_TYPE_QUERY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", None], "sku"),
    ("包装规格查询", ["PRODUCT_TYPE_QUERY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", None], "sku"),
    ("产品规格维护", ["PRODUCT_TYPE_QUERY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", "EQUIPMENT_MAINTENANCE", None], "sku"),
    ("SKU列表导出", ["PRODUCT_TYPE_QUERY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", None], "sku"),
    ("新增产品规格", ["PRODUCT_UPDATE", "PRODUCT_TYPE_QUERY", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", None], "sku"),

    # ===== 5. Product Test (5 cases) =====
    ("产品测试报告", ["PROCESSING_BATCH_CREATE", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "product_test"),
    ("试生产安排", ["PROCESSING_BATCH_CREATE", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "PROCESSING_BATCH_LIST", None], "product_test"),
    ("小批量试产记录", ["PROCESSING_BATCH_CREATE", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "product_test"),
    ("中试报告查看", ["QUALITY_CHECK_QUERY", "PROCESSING_BATCH_CREATE", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", None], "product_test"),
    ("样品评估结果", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "PROCESSING_BATCH_CREATE", "REPORT_QUALITY", "QUALITY_DISPOSITION_EVALUATE", None], "product_test"),

    # ===== 6. Product Launch (6 cases) =====
    ("产品上市计划", ["PROCESSING_BATCH_CREATE", "PRODUCTION_STATUS_QUERY", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "product_launch"),
    ("上架准备清单", ["PROCESSING_BATCH_CREATE", "PRODUCTION_STATUS_QUERY", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "product_launch"),
    ("量产转移方案", ["PROCESSING_BATCH_CREATE", "PRODUCTION_STATUS_QUERY", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "CONVERSION_RATE_UPDATE", None], "product_launch"),
    ("正式投产通知", ["PROCESSING_BATCH_CREATE", "PRODUCTION_STATUS_QUERY", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_START", None], "product_launch"),
    ("市场推广配合", ["PLAN_UPDATE", "PROCESSING_BATCH_CREATE", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "product_launch"),
    ("上市清单检查", ["REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_CREATE", "PRODUCTION_STATUS_QUERY", "PLAN_UPDATE", None], "product_launch"),

    # ===== 7. Product Retire (5 cases) =====
    ("产品下架通知", ["PRODUCT_UPDATE", "PROCESSING_BATCH_CANCEL", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "product_retire"),
    ("停产通知发布", ["PRODUCT_UPDATE", "PROCESSING_BATCH_CANCEL", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "product_retire"),
    ("淘汰产品清理", ["PRODUCT_UPDATE", "PROCESSING_BATCH_CANCEL", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "product_retire"),
    ("停止生产指令", ["PROCESSING_BATCH_CANCEL", "PRODUCT_UPDATE", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "product_retire"),
    ("产品退市流程", ["PRODUCT_UPDATE", "PROCESSING_BATCH_CANCEL", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "product_retire"),

    # ===== 8. Packaging (6 cases) =====
    ("包装设计审核", ["PRODUCT_UPDATE", "MATERIAL_BATCH_QUERY", "LABEL_PRINT", "REPORT_DASHBOARD_OVERVIEW", None], "packaging"),
    ("包装材料采购", ["MATERIAL_BATCH_QUERY", "PRODUCT_UPDATE", "LABEL_PRINT", "REPORT_DASHBOARD_OVERVIEW", None], "packaging"),
    ("包装方式选择", ["PRODUCT_UPDATE", "MATERIAL_BATCH_QUERY", "LABEL_PRINT", "REPORT_DASHBOARD_OVERVIEW", None], "packaging"),
    ("包装规范查看", ["PRODUCT_UPDATE", "MATERIAL_BATCH_QUERY", "LABEL_PRINT", "REPORT_DASHBOARD_OVERVIEW", None], "packaging"),
    ("外包装要求", ["PRODUCT_UPDATE", "MATERIAL_BATCH_QUERY", "LABEL_PRINT", "REPORT_DASHBOARD_OVERVIEW", None], "packaging"),
    ("内包装材料", ["MATERIAL_BATCH_QUERY", "PRODUCT_UPDATE", "LABEL_PRINT", "REPORT_DASHBOARD_OVERVIEW", None], "packaging"),

    # ===== 9. Labeling (5 cases) =====
    ("产品标签打印", ["LABEL_PRINT", "LABEL_TEMPLATE_QUERY", "PRODUCT_UPDATE", "FOOD_SAFETY_CERT_QUERY", None], "labeling"),
    ("营养标签生成", ["LABEL_PRINT", "LABEL_TEMPLATE_QUERY", "PRODUCT_UPDATE", "FOOD_SAFETY_CERT_QUERY", None], "labeling"),
    ("标签合规检查", ["LABEL_PRINT", "LABEL_TEMPLATE_QUERY", "PRODUCT_UPDATE", "FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", None], "labeling"),
    ("标签设计模板", ["LABEL_TEMPLATE_QUERY", "LABEL_PRINT", "PRODUCT_UPDATE", "FOOD_SAFETY_CERT_QUERY", None], "labeling"),
    ("标签审核记录", ["LABEL_PRINT", "LABEL_TEMPLATE_QUERY", "PRODUCT_UPDATE", "FOOD_SAFETY_CERT_QUERY", None], "labeling"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 78 ===")
    print(f"Focus: PRODUCT LIFECYCLE queries")
    print(f"       (new product, product query, recipe, SKU, testing, launch, retire, packaging, labeling)")
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
        'test': 'v5_round78_product_lifecycle',
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
    report_path = f'tests/ai-intent/reports/v5_round78_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
