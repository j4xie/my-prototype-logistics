#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 86
Focus: R&D AND INNOVATION queries.
       Covers formula_dev, taste_test, shelf_life, packaging_dev,
       pilot_production, nutrition_analysis, patent_ip, market_research,
       tech_transfer.
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

# Round 86 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Formula Development (6 cases) =====
    ("配方开发进度查询", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "PRODUCT_TYPE_QUERY", None], "formula_dev"),
    ("新配方试验结果怎么样", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "PRODUCT_TYPE_QUERY", None], "formula_dev"),
    ("查看配方调整记录", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCT_TYPE_QUERY", "PRODUCT_UPDATE", "PROCESSING_BATCH_LIST", None], "formula_dev"),
    ("配方成本计算一下", ["COST_QUERY", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "formula_dev"),
    ("配方审批流程到哪一步了", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCT_TYPE_QUERY", None], "formula_dev"),
    ("配方保密管理情况", ["REPORT_DASHBOARD_OVERVIEW", None], "formula_dev"),

    # ===== 2. Taste Test (5 cases) =====
    ("口感测试报告出来了吗", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "taste_test"),
    ("感官评价结果汇总", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "taste_test"),
    ("上次品评报告在哪里", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "taste_test"),
    ("试吃反馈收集情况", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "taste_test"),
    ("风味分析数据对比", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "taste_test"),

    # ===== 3. Shelf Life (6 cases) =====
    ("保质期测试进展", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_EXPIRING_ALERT", None], "shelf_life"),
    ("加速老化实验数据", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "shelf_life"),
    ("保质期预测模型结果", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "MATERIAL_EXPIRING_ALERT", None], "shelf_life"),
    ("货架寿命评估报告", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", None], "shelf_life"),
    ("稳定性测试数据查询", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "shelf_life"),
    ("保质期延长方案评估", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "PRODUCT_UPDATE", "MATERIAL_EXPIRING_ALERT", None], "shelf_life"),

    # ===== 4. Packaging Development (5 cases) =====
    ("包装设计方案有几个", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCT_TYPE_QUERY", None], "packaging_dev"),
    ("包装测试通过了吗", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "packaging_dev"),
    ("包装材料评估报告", ["MATERIAL_BATCH_QUERY", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "SUPPLIER_LIST", "QUALITY_DISPOSITION_EVALUATE", None], "packaging_dev"),
    ("包装成本核算情况", ["COST_QUERY", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "packaging_dev"),
    ("包装改进建议汇总", ["REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "PRODUCT_UPDATE", None], "packaging_dev"),

    # ===== 5. Pilot Production (6 cases) =====
    ("中试生产安排情况", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_CREATE", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None], "pilot_production"),
    ("小批量试产结果", ["PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "pilot_production"),
    ("放大试验进展怎么样", ["PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "pilot_production"),
    ("工艺验证报告查看", ["QUALITY_CHECK_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "pilot_production"),
    ("试产报告提交了吗", ["REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "pilot_production"),
    ("量产评估能不能通过", ["REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "pilot_production"),

    # ===== 6. Nutrition Analysis (5 cases) =====
    ("营养成分分析报告", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "nutrition_analysis"),
    ("热量计算结果查询", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "nutrition_analysis"),
    ("营养标签审核通过没", ["QUALITY_CHECK_QUERY", "PRODUCT_TYPE_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "nutrition_analysis"),
    ("成分检测数据汇总", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "nutrition_analysis"),
    ("营养配比优化方案", ["QUALITY_CHECK_QUERY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "nutrition_analysis"),

    # ===== 7. Patent & IP (6 cases) =====
    ("专利申请进度查询", ["REPORT_DASHBOARD_OVERVIEW", None], "patent_ip"),
    ("知识产权保护情况", ["REPORT_DASHBOARD_OVERVIEW", None], "patent_ip"),
    ("技术保密协议签署情况", ["REPORT_DASHBOARD_OVERVIEW", None], "patent_ip"),
    ("专利检索结果反馈", ["REPORT_DASHBOARD_OVERVIEW", None], "patent_ip"),
    ("新发明登记了没有", ["REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_CREATE", None], "patent_ip"),
    ("技术转让协议审批", ["REPORT_DASHBOARD_OVERVIEW", None], "patent_ip"),

    # ===== 8. Market Research (5 cases) =====
    ("市场调研报告出来了吗", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "market_research"),
    ("竞品分析数据对比", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "market_research"),
    ("消费者偏好调查结果", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "market_research"),
    ("新品需求预测分析", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "PRODUCT_TYPE_QUERY", None], "market_research"),
    ("市场趋势分析报告", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "market_research"),

    # ===== 9. Tech Transfer (6 cases) =====
    ("技术转移进度跟踪", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "tech_transfer"),
    ("工艺移交文件准备好了吗", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "tech_transfer"),
    ("配方移交审批流程", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCT_TYPE_QUERY", None], "tech_transfer"),
    ("技术培训计划安排", ["REPORT_DASHBOARD_OVERVIEW", None], "tech_transfer"),
    ("产线验证测试结果", ["REPORT_PRODUCTION", "QUALITY_CHECK_QUERY", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "tech_transfer"),
    ("批量验证通过了没有", ["PROCESSING_BATCH_LIST", "QUALITY_CHECK_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_EXECUTE", None], "tech_transfer"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 86 ===")
    print(f"Focus: R&D AND INNOVATION")
    print(f"       (formula_dev, taste_test, shelf_life, packaging_dev, pilot_production,")
    print(f"        nutrition_analysis, patent_ip, market_research, tech_transfer)")
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
        'test': 'v5_round86_rnd_and_innovation',
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
    report_path = f'tests/ai-intent/reports/v5_round86_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
