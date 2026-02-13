#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 82
Focus: CONTINUOUS IMPROVEMENT & LEAN queries.
       Covers kaizen, waste_reduction, cycle_time, oee_metrics, value_stream,
       standard_work, visual_mgmt, root_cause, benchmark.
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

# Round 82 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Kaizen (6 cases) =====
    ("查看改善提案列表", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", "REPORT_TRENDS", "QUALITY_CHECK_QUERY", None], "kaizen"),
    ("最近有哪些持续改进项目", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", "REPORT_TRENDS", None], "kaizen"),
    ("提交改善建议", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "QUALITY_CHECK_QUERY", "FORM_GENERATION", None], "kaizen"),
    ("车间优化方案执行情况", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "kaizen"),
    ("查看改进记录", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", None], "kaizen"),
    ("改善效果评估报告", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "REPORT_KPI", None], "kaizen"),

    # ===== 2. Waste Reduction (5 cases) =====
    ("如何降低生产浪费", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", "COST_QUERY", "REPORT_COST", "PROCESSING_BATCH_LIST", None], "waste_reduction"),
    ("本月废品率是多少", ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "waste_reduction"),
    ("查看返工率趋势", ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "waste_reduction"),
    ("报废处理流程", ["QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "waste_reduction"),
    ("废料回收统计", ["MATERIAL_BATCH_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "INVENTORY_QUERY", "REPORT_COST", None], "waste_reduction"),

    # ===== 3. Cycle Time (6 cases) =====
    ("查看节拍时间", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "cycle_time"),
    ("各产品生产周期对比", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_TRENDS", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_TIMELINE", "REPORT_DASHBOARD_OVERVIEW", None], "cycle_time"),
    ("换线时间统计", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "cycle_time"),
    ("生产等待时间分析", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_TRENDS", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "cycle_time"),
    ("设备准备时间", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "cycle_time"),
    ("产线平衡率", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "cycle_time"),

    # ===== 4. OEE Metrics (5 cases) =====
    ("查看OEE数据", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "oee_metrics"),
    ("设备综合效率报表", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "oee_metrics"),
    ("设备可用率分析", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "oee_metrics"),
    ("各设备性能率对比", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "oee_metrics"),
    ("产品良品率统计", ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "oee_metrics"),

    # ===== 5. Value Stream (6 cases) =====
    ("价值流分析报告", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "value_stream"),
    ("流程优化建议", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "value_stream"),
    ("哪个工序是瓶颈", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_EFFICIENCY", "REPORT_ANOMALY", "REPORT_DASHBOARD_OVERVIEW", None], "value_stream"),
    ("产能利用率是多少", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "value_stream"),
    ("工序平衡分析", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "value_stream"),
    ("在制品分析", ["PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "value_stream"),

    # ===== 6. Standard Work (5 cases) =====
    ("查看标准作业文件", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "FORM_GENERATION", None], "standard_work"),
    ("SOP更新记录", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "PROCESSING_BATCH_LIST", None], "standard_work"),
    ("作业指导书列表", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "FORM_GENERATION", None], "standard_work"),
    ("操作规范执行情况", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "RULE_CONFIG", None], "standard_work"),
    ("工艺标准更新了吗", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", None], "standard_work"),

    # ===== 7. Visual Management (6 cases) =====
    ("看板管理数据", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "visual_mgmt"),
    ("目视化管理状态", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "visual_mgmt"),
    ("安灯系统告警", ["ALERT_LIST", "EQUIPMENT_STATUS_QUERY", "REPORT_ANOMALY", "REPORT_DASHBOARD_OVERVIEW", None], "visual_mgmt"),
    ("各产线状态显示", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "visual_mgmt"),
    ("信息看板汇总", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "visual_mgmt"),
    ("电子看板数据", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "visual_mgmt"),

    # ===== 8. Root Cause (5 cases) =====
    ("做5WHY分析", ["REPORT_ANOMALY", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "root_cause"),
    ("鱼骨图分析原因", ["REPORT_ANOMALY", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "ALERT_DIAGNOSE", None], "root_cause"),
    ("帕累托分析质量问题", ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_ANOMALY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "root_cause"),
    ("不良品原因分析", ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_ANOMALY", "REPORT_DASHBOARD_OVERVIEW", None], "root_cause"),
    ("问题追溯到哪个环节", ["TRACE_BATCH", "TRACE_FULL", "QUALITY_CHECK_QUERY", "REPORT_ANOMALY", "REPORT_DASHBOARD_OVERVIEW", None], "root_cause"),

    # ===== 9. Benchmark (6 cases) =====
    ("标杆对比分析", ["REPORT_KPI", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", None], "benchmark"),
    ("行业对标数据", ["REPORT_KPI", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", None], "benchmark"),
    ("最佳实践参考", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", "REPORT_TRENDS", None], "benchmark"),
    ("与竞争对手对比分析", ["REPORT_KPI", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", None], "benchmark"),
    ("各工厂绩效对比", ["REPORT_KPI", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "benchmark"),
    ("差距分析报告", ["REPORT_KPI", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", "REPORT_ANOMALY", None], "benchmark"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 82 ===")
    print(f"Focus: CONTINUOUS IMPROVEMENT & LEAN")
    print(f"       (kaizen, waste_reduction, cycle_time, oee_metrics, value_stream,")
    print(f"        standard_work, visual_mgmt, root_cause, benchmark)")
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
        'test': 'v5_round82_continuous_improvement_lean',
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
    report_path = f'tests/ai-intent/reports/v5_round82_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
