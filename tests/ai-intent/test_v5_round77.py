#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 77
Focus: LEAN MANUFACTURING & CONTINUOUS IMPROVEMENT queries for food manufacturing.
       Covers waste reduction, 5S, kaizen, OEE, TPM, value stream,
       standardization, root cause analysis, and benchmarking/best practices.
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

# Round 77 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Waste Reduction (6 cases) =====
    ("减少浪费的措施有哪些", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "COST_QUERY", "REPORT_TRENDS", None], "waste_reduction"),
    ("消除浪费专项行动进展", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "COST_QUERY", "REPORT_TRENDS", None], "waste_reduction"),
    ("七大浪费识别情况", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "COST_QUERY", "REPORT_TRENDS", "SCALE_ADD_DEVICE_VISION", None], "waste_reduction"),
    ("物料浪费率统计", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "COST_QUERY", "REPORT_TRENDS", "MATERIAL_BATCH_QUERY", None], "waste_reduction"),
    ("时间浪费分析报告", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "COST_QUERY", "REPORT_TRENDS", None], "waste_reduction"),
    ("产能浪费原因排查", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "COST_QUERY", "REPORT_TRENDS", None], "waste_reduction"),

    # ===== 2. 5S (6 cases) =====
    ("5S检查结果", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_QUALITY", None], "5s"),
    ("整理整顿执行情况", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_QUALITY", None], "5s"),
    ("现场管理评估", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_QUALITY", "QUALITY_DISPOSITION_EVALUATE", None], "5s"),
    ("定置管理是否到位", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_QUALITY", None], "5s"),
    ("目视化管理看板更新", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_QUALITY", None], "5s"),
    ("5S评分本月汇总", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_QUALITY", None], "5s"),

    # ===== 3. Kaizen (5 cases) =====
    ("改善提案提交了几个", ["REPORT_TRENDS", "REPORT_EFFICIENCY", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "kaizen"),
    ("持续改善进度怎么样", ["REPORT_TRENDS", "REPORT_EFFICIENCY", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None], "kaizen"),
    ("改善建议落实情况", ["REPORT_TRENDS", "REPORT_EFFICIENCY", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "kaizen"),
    ("PDCA循环执行跟踪", ["REPORT_TRENDS", "REPORT_EFFICIENCY", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "kaizen"),
    ("改善效果评估报告", ["REPORT_TRENDS", "REPORT_EFFICIENCY", "PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "kaizen"),

    # ===== 4. OEE (6 cases) =====
    ("OEE统计数据", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", "REPORT_KPI", None], "oee"),
    ("设备综合效率是多少", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", "REPORT_KPI", None], "oee"),
    ("时间利用率太低了", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", "REPORT_KPI", None], "oee"),
    ("性能效率怎么提升", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", "REPORT_KPI", None], "oee"),
    ("质量效率达标没有", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", "REPORT_KPI", None], "oee"),
    ("OEE提升方案进展", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", "REPORT_KPI", None], "oee"),

    # ===== 5. TPM (5 cases) =====
    ("TPM管理执行情况", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "PLAN_UPDATE", "EQUIPMENT_STATUS_QUERY", None], "tpm"),
    ("自主维护记录查看", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "PLAN_UPDATE", "EQUIPMENT_STATUS_QUERY", None], "tpm"),
    ("设备保养计划", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "PLAN_UPDATE", "EQUIPMENT_STATUS_QUERY", None], "tpm"),
    ("预防保全完成率", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "PLAN_UPDATE", "EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", None], "tpm"),
    ("维护计划排期", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "PLAN_UPDATE", "EQUIPMENT_STATUS_QUERY", None], "tpm"),

    # ===== 6. Value Stream (6 cases) =====
    ("价值流分析结果", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_TRENDS", "PROCESSING_BATCH_TIMELINE", None], "value_stream"),
    ("流程分析哪里有瓶颈", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_TRENDS", "PROCESSING_BATCH_TIMELINE", None], "value_stream"),
    ("瓶颈识别结果", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_TRENDS", "PROCESSING_BATCH_TIMELINE", "SCALE_ADD_DEVICE_VISION", None], "value_stream"),
    ("节拍时间是多少", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_TRENDS", "PROCESSING_BATCH_TIMELINE", None], "value_stream"),
    ("生产周期缩短了吗", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_TRENDS", "PROCESSING_BATCH_TIMELINE", None], "value_stream"),
    ("前置时间统计报告", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_TRENDS", "PROCESSING_BATCH_TIMELINE", "REPORT_DASHBOARD_OVERVIEW", None], "value_stream"),

    # ===== 7. Standardization (5 cases) =====
    ("标准化作业执行情况", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "QUALITY_CHECK_QUERY", "PROCESSING_BATCH_DETAIL", None], "standardization"),
    ("作业标准有没有更新", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "QUALITY_CHECK_QUERY", "PROCESSING_BATCH_DETAIL", None], "standardization"),
    ("工序标准偏差分析", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "QUALITY_CHECK_QUERY", "PROCESSING_BATCH_DETAIL", None], "standardization"),
    ("标准工时对比", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "QUALITY_CHECK_QUERY", "PROCESSING_BATCH_DETAIL", None], "standardization"),
    ("标准用量消耗差异", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "QUALITY_CHECK_QUERY", "PROCESSING_BATCH_DETAIL", None], "standardization"),

    # ===== 8. Root Cause Analysis (6 cases) =====
    ("根因分析做了吗", ["ALERT_DIAGNOSE", "REPORT_TRENDS", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_STATS", None], "root_cause"),
    ("鱼骨图分析结果", ["ALERT_DIAGNOSE", "REPORT_TRENDS", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_STATS", None], "root_cause"),
    ("5WHY分析记录", ["ALERT_DIAGNOSE", "REPORT_TRENDS", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_STATS", None], "root_cause"),
    ("原因排查进展", ["ALERT_DIAGNOSE", "REPORT_TRENDS", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_STATS", None], "root_cause"),
    ("问题根源找到了吗", ["ALERT_DIAGNOSE", "REPORT_TRENDS", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_STATS", None], "root_cause"),
    ("故障根因定位", ["ALERT_DIAGNOSE", "REPORT_TRENDS", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_STATS", None], "root_cause"),

    # ===== 9. Benchmark & Best Practices (5 cases) =====
    ("标杆学习进展", ["REPORT_KPI", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", "ATTENDANCE_HISTORY", None], "benchmark_best"),
    ("最佳实践推广情况", ["REPORT_KPI", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", None], "benchmark_best"),
    ("行业对标数据", ["REPORT_KPI", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", None], "benchmark_best"),
    ("先进水平差距多大", ["REPORT_KPI", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", None], "benchmark_best"),
    ("对标分析报告", ["REPORT_KPI", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", None], "benchmark_best"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 77 ===")
    print(f"Focus: LEAN MANUFACTURING & CONTINUOUS IMPROVEMENT queries")
    print(f"       (waste reduction, 5S, kaizen, OEE, TPM, value stream, standardization, root cause, benchmark)")
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
        'test': 'v5_round77_lean_manufacturing',
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
    report_path = f'tests/ai-intent/reports/v5_round77_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
