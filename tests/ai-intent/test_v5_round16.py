#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 16
Focus: FOOD SAFETY & COMPLIANCE - queries specific to food manufacturing
       regulatory compliance, HACCP, allergens, cold chain, shelf life,
       recalls, testing, labeling, sanitation, and regulatory reporting.
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

# Round 16 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. HACCP / Food Safety Certifications (6 cases) =====
    ("HACCP审核什么时候到期",
     ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "ALERT_LIST"],
     "haccp-audit-expiry"),

    ("查一下GMP检查的最新结果",
     ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_STATS"],
     "haccp-gmp-result"),

    ("食品安全认证还有多久过期",
     ["FOOD_SAFETY_CERT_QUERY", "ALERT_LIST", "MATERIAL_EXPIRING_ALERT", "QUALITY_CHECK_QUERY"],
     "haccp-cert-expiry"),

    ("关键控制点CCP的监控数据",
     ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "COLD_CHAIN_TEMPERATURE", "REPORT_QUALITY"],
     "haccp-ccp-monitor"),

    ("今天的HACCP记录填了吗",
     ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "FORM_GENERATION"],
     "haccp-daily-record"),

    ("CCP关键限值超标了没有",
     ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "ALERT_LIST", "ALERT_ACTIVE", None],
     "haccp-ccp-limit"),

    # ===== 2. Allergen Management (5 cases) =====
    ("过敏原标识检查情况",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "REPORT_QUALITY", None],
     "allergen-label-check"),

    ("这批产品的过敏原检测报告",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "PROCESSING_BATCH_DETAIL"],
     "allergen-test-report"),

    ("产线切换后交叉污染风险评估",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", None],
     "allergen-cross-contamination"),

    ("含有花生成分的产品批次有哪些",
     ["MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_LIST", "TRACE_BATCH", "QUALITY_CHECK_QUERY"],
     "allergen-peanut-batches"),

    ("过敏原清单是否更新到最新版",
     ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", None],
     "allergen-list-update"),

    # ===== 3. Temperature Monitoring (6 cases) =====
    ("冷链运输中间有没有断链",
     ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "ALERT_ACTIVE", "SHIPMENT_QUERY"],
     "temp-cold-chain-break"),

    ("今天冷藏车的运输温度记录",
     ["COLD_CHAIN_TEMPERATURE", "SHIPMENT_QUERY", "REPORT_QUALITY"],
     "temp-transport-log"),

    ("3号冷库当前温度是多少",
     ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY"],
     "temp-warehouse-current"),

    ("温控报警记录查一下",
     ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_ALERT_LIST"],
     "temp-alarm-history"),

    ("解冻间温度是否在合规范围",
     ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY"],
     "temp-thaw-compliance"),

    ("过去24小时冷库温度曲线",
     ["COLD_CHAIN_TEMPERATURE", "REPORT_TRENDS", "EQUIPMENT_STATUS_QUERY"],
     "temp-24h-curve"),

    # ===== 4. Shelf Life & Expiry (5 cases) =====
    ("马上要过期的产品有哪些",
     ["MATERIAL_EXPIRING_ALERT", "MATERIAL_BATCH_QUERY", "ALERT_LIST"],
     "shelf-expiring-products"),

    ("临期产品列表按日期排序",
     ["MATERIAL_EXPIRING_ALERT", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY"],
     "shelf-near-expiry-list"),

    ("仓库先进先出执行情况",
     ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "QUALITY_CHECK_QUERY", "MATERIAL_FIFO_RECOMMEND"],
     "shelf-fifo-status"),

    ("过期原料的处理记录",
     ["MATERIAL_BATCH_QUERY", "DISPOSITION_EXECUTE", "MATERIAL_EXPIRING_ALERT", "QUALITY_CHECK_QUERY", "MATERIAL_EXPIRED_QUERY"],
     "shelf-expired-disposal"),

    ("保质期还剩不到7天的库存",
     ["MATERIAL_EXPIRING_ALERT", "MATERIAL_BATCH_QUERY", "ALERT_LIST", "REPORT_INVENTORY"],
     "shelf-7day-warning"),

    # ===== 5. Recall & Traceability (6 cases) =====
    ("启动产品召回流程",
     ["TRACE_BATCH", "TRACE_FULL", "PROCESSING_BATCH_LIST", "DISPOSITION_EXECUTE", "QUALITY_DISPOSITION_EXECUTE"],
     "recall-initiate"),

    ("批次20260210A的完整追溯链",
     ["TRACE_FULL", "TRACE_BATCH", "PROCESSING_BATCH_DETAIL"],
     "recall-full-trace"),

    ("这个批次用了哪些供应商的原料",
     ["TRACE_BATCH", "SUPPLIER_LIST", "MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST"],
     "recall-supplier-trace"),

    ("溯源码扫描查询产品信息",
     ["TRACE_BATCH", "TRACE_FULL", "PROCESSING_BATCH_DETAIL", "MATERIAL_BATCH_QUERY"],
     "recall-qr-scan"),

    ("召回范围涉及哪些销售渠道",
     ["TRACE_FULL", "TRACE_BATCH", "ORDER_LIST", "SHIPMENT_QUERY", None],
     "recall-scope-channels"),

    ("同一原料批次影响了多少成品",
     ["TRACE_BATCH", "TRACE_FULL", "MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_LIST"],
     "recall-impact-scope"),

    # ===== 6. Microbial & Chemical Testing (5 cases) =====
    ("最新一批的微生物检测结果",
     ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "FOOD_SAFETY_CERT_QUERY"],
     "testing-microbial-result"),

    ("农药残留检测是否达标",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "QUALITY_STATS"],
     "testing-pesticide-residue"),

    ("重金属检测报告出来了吗",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "QUALITY_STATS"],
     "testing-heavy-metal"),

    ("这批产品的理化指标检验数据",
     ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "PROCESSING_BATCH_DETAIL", "REPORT_QUALITY"],
     "testing-physicochemical"),

    ("第三方检测报告什么时候能拿到",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", None],
     "testing-thirdparty-eta"),

    # ===== 7. Labeling & Packaging (5 cases) =====
    ("标签合规性抽查结果",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "QUALITY_STATS", "REPORT_QUALITY"],
     "label-compliance-check"),

    ("营养成分表标注是否正确",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", None],
     "label-nutrition-facts"),

    ("配料表和实际生产配方一致吗",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "PROCESSING_BATCH_DETAIL", None],
     "label-ingredient-match"),

    ("包装完整性检测不合格的有几个",
     ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", None],
     "label-packaging-integrity"),

    ("生产日期和批号打印清晰度检查",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", None],
     "label-date-print-check"),

    # ===== 8. Sanitization & Hygiene (6 cases) =====
    ("今天车间消毒记录填写了吗",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "FORM_GENERATION", None],
     "sanit-workshop-record"),

    ("清洗消毒的ATP检测结果",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "EQUIPMENT_STATUS_QUERY", None],
     "sanit-atp-test"),

    ("进车间人员卫生检查记录",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "ATTENDANCE_TODAY", None],
     "sanit-personnel-hygiene"),

    ("2号车间上次深度消毒是什么时候",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "EQUIPMENT_MAINTENANCE", "PROCESSING_BATCH_LIST", None],
     "sanit-deep-clean-date"),

    ("CIP管道清洗记录查询",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", None],
     "sanit-cip-record"),

    ("更衣室紫外灯消毒时长达标吗",
     ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "EQUIPMENT_STATUS_QUERY", None],
     "sanit-uv-duration"),

    # ===== 9. Regulatory Reporting (6 cases) =====
    ("本月食品安全监管报告生成",
     ["REPORT_QUALITY", "FOOD_SAFETY_CERT_QUERY", "REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", None],
     "regulatory-monthly-report"),

    ("日常巡检记录汇总",
     ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", "FOOD_SAFETY_CERT_QUERY"],
     "regulatory-daily-inspection"),

    ("食品安全自查报告提交了没",
     ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None],
     "regulatory-self-inspection"),

    ("市场监管局抽检结果查询",
     ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "FOOD_SAFETY_CERT_QUERY"],
     "regulatory-sampling-result"),

    ("生产许可证年审材料准备情况",
     ["FOOD_SAFETY_CERT_QUERY", "MATERIAL_BATCH_QUERY", None],
     "regulatory-license-renewal"),

    ("食品经营备案信息更新状态",
     ["FOOD_SAFETY_CERT_QUERY", "SHIPMENT_STATUS_UPDATE", None],
     "regulatory-filing-status"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 16 ===")
    print(f"Focus: FOOD SAFETY & COMPLIANCE - HACCP, allergens, cold chain,")
    print(f"       shelf life, recalls, testing, labeling, sanitation, regulatory")
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
        'test': 'v5_round16_food_safety_compliance',
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
    report_path = f'tests/ai-intent/reports/v5_round16_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
