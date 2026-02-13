#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 23
Focus: PROCESSING & BATCH OPERATIONS - batch creation, batch tracking, recipe management,
       processing parameters, batch quality, yield tracking, WIP, rework.
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

# Round 23 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Batch Creation (6 cases) =====
    ("创建一个新的生产批次", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST"], "batch_creation-create"),
    ("开始今天的豆腐批次生产", ["PROCESSING_BATCH_CREATE", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_START"], "batch_creation-start"),
    ("新建一批酱油生产批次", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST"], "batch_creation-new"),
    ("给这批货分配批次号", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_DETAIL", "MATERIAL_BATCH_QUERY", None], "batch_creation-assign"),
    ("发起批次生产申请", ["PROCESSING_BATCH_CREATE", "PRODUCTION_PLAN_QUERY", None], "batch_creation-initiate"),
    ("有个加急订单需要立刻开批次", ["PROCESSING_BATCH_CREATE", "PRODUCTION_PLAN_QUERY", None], "batch_creation-rush"),

    # ===== 2. Batch Tracking (6 cases) =====
    ("批次B20260210-001目前状态", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY"], "batch_tracking-status"),
    ("在产批次进度怎么样了", ["PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_DETAIL"], "batch_tracking-progress"),
    ("我的批次到哪个工序了", ["PROCESSING_BATCH_DETAIL", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", None], "batch_tracking-where"),
    ("查看批次时间线", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_TIMELINE"], "batch_tracking-timeline"),
    ("今天有多少批次已经完成", ["PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_COMPLETE"], "batch_tracking-completion"),
    ("哪些批次延期了", ["PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None], "batch_tracking-delay"),

    # ===== 3. Recipe/Formula (5 cases) =====
    ("查一下红烧酱的配方", ["PROCESSING_BATCH_DETAIL", "MATERIAL_BATCH_QUERY", None], "recipe-query"),
    ("这个批次的配方需要调整", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_CREATE", "BATCH_UPDATE", None], "recipe-change"),
    ("原料配比是多少", ["MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_DETAIL", "MATERIAL_CONSUME", None], "recipe-ratio"),
    ("调整糖的用量比例", ["MATERIAL_CONSUME", "PROCESSING_BATCH_DETAIL", "MATERIAL_BATCH_CONSUME", None], "recipe-adjustment"),
    ("当前用的是哪个版本的配方", ["PROCESSING_BATCH_DETAIL", "MATERIAL_BATCH_QUERY", None], "recipe-version"),

    # ===== 4. Processing Parameters (6 cases) =====
    ("把发酵温度设到38度", ["EQUIPMENT_STATUS_QUERY", "PROCESSING_BATCH_DETAIL", "COLD_CHAIN_TEMPERATURE", None], "parameters-temperature"),
    ("搅拌速度调到120转", ["EQUIPMENT_STATUS_QUERY", "PROCESSING_BATCH_DETAIL", None], "parameters-speed"),
    ("检查一下蒸煮压力是否正常", ["EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", "PROCESSING_BATCH_DETAIL", "COLD_CHAIN_TEMPERATURE"], "parameters-pressure"),
    ("当前工艺参数是多少", ["PROCESSING_BATCH_DETAIL", "EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", None], "parameters-current"),
    ("查看参数变更记录", ["PROCESSING_BATCH_DETAIL", "EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", None], "parameters-log"),
    ("温度超标报警了", ["EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", "PROCESSING_BATCH_DETAIL", "COLD_CHAIN_TEMPERATURE", None], "parameters-alarm"),

    # ===== 5. Batch Quality (5 cases) =====
    ("这个批次的质检结果怎么样", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "PROCESSING_BATCH_DETAIL"], "batch_quality-results"),
    ("过程检查该做了吧", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY"], "batch_quality-inprocess"),
    ("做一下抽样检验", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY"], "batch_quality-sampling"),
    ("这批次需要暂扣等待复检", ["DISPOSITION_EXECUTE", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", None], "batch_quality-hold"),
    ("质检合格可以放行了", ["DISPOSITION_EXECUTE", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE"], "batch_quality-release"),

    # ===== 6. Yield & Output (5 cases) =====
    ("这批的产出率是多少", ["REPORT_PRODUCTION", "PROCESSING_BATCH_DETAIL", "PRODUCTION_STATUS_QUERY", "REPORT_EFFICIENCY", "CONVERSION_RATE_UPDATE", None], "yield-batch"),
    ("废品率太高了查一下原因", ["REPORT_QUALITY", "QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_PRODUCTION"], "yield-scrap"),
    ("实际产量和计划差多少", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "PRODUCTION_PLAN_QUERY", "REPORT_EFFICIENCY"], "yield-actual_vs_planned"),
    ("今天的产出报告", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST"], "yield-output"),
    ("哪个批次的损耗最大", ["REPORT_PRODUCTION", "REPORT_QUALITY", "QUALITY_STATS", "PROCESSING_BATCH_LIST", "MATERIAL_BATCH_CONSUME", None], "yield-waste"),

    # ===== 7. WIP Management (5 cases) =====
    ("目前在制品有多少", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", None], "wip-count"),
    ("半成品库存情况", ["MATERIAL_BATCH_QUERY", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_INVENTORY", None], "wip-semifinished"),
    ("缓冲区还剩多少量", ["MATERIAL_BATCH_QUERY", "PRODUCTION_STATUS_QUERY", None], "wip-buffer"),
    ("在制品数量统计", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION"], "wip-stats"),
    ("有没有长期滞留的在制品", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", None], "wip-aging"),

    # ===== 8. Rework & Deviation (6 cases) =====
    ("创建一个返工单", ["PROCESSING_BATCH_CREATE", "DISPOSITION_EXECUTE", None], "rework-order"),
    ("提交偏差报告", ["QUALITY_CHECK_EXECUTE", "DISPOSITION_EXECUTE", "REPORT_QUALITY", "REPORT_ANOMALY", None], "rework-deviation"),
    ("记录不合格品处理", ["DISPOSITION_EXECUTE", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE"], "rework-nonconformance"),
    ("分析这批不良的根本原因", ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "ALERT_DIAGNOSE", None], "rework-rootcause"),
    ("CAPA纠正措施进展", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", None], "rework-capa"),
    ("返工批次已经完成了", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "DISPOSITION_EXECUTE", "PROCESSING_BATCH_COMPLETE", None], "rework-completion"),

    # ===== 9. Multi-line Coordination (6 cases) =====
    ("把这个批次分配到二号线", ["PRODUCTION_PLAN_QUERY", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_CREATE", None], "multiline-allocation"),
    ("批次从一号线转到三号线", ["PROCESSING_BATCH_DETAIL", "PRODUCTION_PLAN_QUERY", None], "multiline-transfer"),
    ("二号线需要换产", ["EQUIPMENT_STATUS_QUERY", "PRODUCTION_PLAN_QUERY", "PRODUCTION_STATUS_QUERY", None], "multiline-changeover"),
    ("调整一下各线的生产顺序", ["PRODUCTION_PLAN_QUERY", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", None], "multiline-sequence"),
    ("有个紧急批次优先安排", ["PRODUCTION_PLAN_QUERY", "PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", None], "multiline-priority"),
    ("各产线负荷均衡吗", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY", None], "multiline-balance"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 23 ===")
    print(f"Focus: PROCESSING & BATCH OPERATIONS - batch creation, batch tracking, recipe,")
    print(f"       processing parameters, batch quality, yield, WIP, rework, multi-line")
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
        'test': 'v5_round23_processing_batch_operations',
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
    report_path = f'tests/ai-intent/reports/v5_round23_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
