#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 71
Focus: PROCESS CONTROL & MONITORING queries for food manufacturing.
       Covers SPC, parameter monitoring, deviation, sampling, in-process inspection,
       yield rate, rework, changeover, and CIP cleaning.
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

# Round 71 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. SPC (6 cases) =====
    ("SPC控制图分析", ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_TRENDS", None], "spc"),
    ("过程能力分析报告", ["QUALITY_STATS", "REPORT_QUALITY", "QUALITY_CHECK_QUERY", None], "spc"),
    ("控制限怎么设定", ["REPORT_QUALITY", "QUALITY_STATS", "QUALITY_CHECK_QUERY", None], "spc"),
    ("Cpk值是多少", ["QUALITY_STATS", "REPORT_QUALITY", "QUALITY_CHECK_QUERY", None], "spc"),
    ("过程稳定性评估", ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_TRENDS", None], "spc"),
    ("控制图出现异常点", ["REPORT_QUALITY", "QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_TRENDS", None], "spc"),

    # ===== 2. Parameter Monitor (6 cases) =====
    ("工艺参数查看", ["EQUIPMENT_STATUS_QUERY", "PROCESSING_BATCH_DETAIL", "COLD_CHAIN_TEMPERATURE", None], "parameter_monitor"),
    ("温度监控数据", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", None], "parameter_monitor"),
    ("当前压力值多少", ["EQUIPMENT_STATUS_QUERY", "COLD_CHAIN_TEMPERATURE", "PROCESSING_BATCH_DETAIL", None], "parameter_monitor"),
    ("转速设定值", ["EQUIPMENT_STATUS_QUERY", "PROCESSING_BATCH_DETAIL", "COLD_CHAIN_TEMPERATURE", None], "parameter_monitor"),
    ("流量监控异常", ["EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "COLD_CHAIN_TEMPERATURE", None], "parameter_monitor"),
    ("参数报警记录", ["ALERT_LIST", "EQUIPMENT_STATUS_QUERY", "COLD_CHAIN_TEMPERATURE", None], "parameter_monitor"),

    # ===== 3. Deviation (5 cases) =====
    ("偏差处理流程", ["ALERT_DIAGNOSE", "ALERT_LIST", "QUALITY_DISPOSITION_EXECUTE", None], "deviation"),
    ("工艺偏差记录", ["ALERT_LIST", "ALERT_DIAGNOSE", "REPORT_TRENDS", None], "deviation"),
    ("参数超标了怎么办", ["ALERT_DIAGNOSE", "ALERT_LIST", "QUALITY_DISPOSITION_EXECUTE", None], "deviation"),
    ("异常波动分析", ["ALERT_DIAGNOSE", "REPORT_TRENDS", "ALERT_LIST", "REPORT_ANOMALY", None], "deviation"),
    ("过程偏移趋势", ["REPORT_TRENDS", "ALERT_LIST", "ALERT_DIAGNOSE", None], "deviation"),

    # ===== 4. Sampling (6 cases) =====
    ("取样检测结果", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "QUALITY_STATS", None], "sampling"),
    ("抽检计划安排", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "PLAN_UPDATE", None], "sampling"),
    ("采样频次设置", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "PLAN_UPDATE", None], "sampling"),
    ("样品编号查询", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_STATS", None], "sampling"),
    ("取样记录查看", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_STATS", None], "sampling"),
    ("抽样方案制定", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "PLAN_UPDATE", "QUALITY_STATS", None], "sampling"),

    # ===== 5. In-Process Inspection (5 cases) =====
    ("在制品检查结果", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "PROCESSING_BATCH_DETAIL", None], "in_process"),
    ("过程检验记录", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "PROCESSING_BATCH_LIST", None], "in_process"),
    ("中间检查合格吗", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "PROCESSING_BATCH_DETAIL", None], "in_process"),
    ("半成品质检报告", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", None], "in_process"),
    ("工序检验数据", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "PROCESSING_BATCH_LIST", "QUALITY_STATS", None], "in_process"),

    # ===== 6. Yield Rate (6 cases) =====
    ("良率统计报告", ["QUALITY_STATS", "REPORT_QUALITY", "REPORT_PRODUCTION", None], "yield_rate"),
    ("今天合格率多少", ["QUALITY_STATS", "REPORT_QUALITY", "REPORT_KPI", "QUALITY_CHECK_QUERY", None], "yield_rate"),
    ("一次合格率趋势", ["QUALITY_STATS", "REPORT_QUALITY", "REPORT_KPI", "REPORT_PRODUCTION", None], "yield_rate"),
    ("直通率下降了", ["QUALITY_STATS", "REPORT_QUALITY", "REPORT_PRODUCTION", "REPORT_KPI", None], "yield_rate"),
    ("成品率分析", ["REPORT_PRODUCTION", "QUALITY_STATS", "REPORT_QUALITY", None], "yield_rate"),
    ("产出率对比", ["REPORT_PRODUCTION", "QUALITY_STATS", "REPORT_KPI", None], "yield_rate"),

    # ===== 7. Rework (5 cases) =====
    ("返工处理单", ["QUALITY_DISPOSITION_EXECUTE", "PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", None], "rework"),
    ("返修记录查看", ["QUALITY_DISPOSITION_EXECUTE", "PROCESSING_BATCH_LIST", "QUALITY_CHECK_EXECUTE", "EQUIPMENT_MAINTENANCE", None], "rework"),
    ("重新加工批次", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", "QUALITY_DISPOSITION_EXECUTE", None], "rework"),
    ("二次检验结果", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE", None], "rework"),
    ("返工批次追踪", ["PROCESSING_BATCH_LIST", "QUALITY_DISPOSITION_EXECUTE", "PROCESSING_BATCH_CREATE", "QUALITY_CHECK_EXECUTE", "TRACE_BATCH", None], "rework"),

    # ===== 8. Changeover (6 cases) =====
    ("换线准备工作", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", "EQUIPMENT_MAINTENANCE", None], "changeover"),
    ("换型时间记录", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_CREATE", "EQUIPMENT_MAINTENANCE", None], "changeover"),
    ("清线检查确认", ["QUALITY_CHECK_EXECUTE", "PROCESSING_BATCH_CREATE", "EQUIPMENT_MAINTENANCE", None], "changeover"),
    ("首件确认结果", ["QUALITY_CHECK_EXECUTE", "PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", None], "changeover"),
    ("产品切换安排", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", "EQUIPMENT_MAINTENANCE", "PRODUCT_UPDATE", None], "changeover"),
    ("换模记录查询", ["EQUIPMENT_MAINTENANCE", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_CREATE", None], "changeover"),

    # ===== 9. CIP Cleaning (5 cases) =====
    ("CIP清洗记录", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "EQUIPMENT_MAINTENANCE", None], "cip"),
    ("在线清洗状态", ["EQUIPMENT_MAINTENANCE", "QUALITY_CHECK_QUERY", "PROCESSING_BATCH_DETAIL", None], "cip"),
    ("清洗验证报告", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "EQUIPMENT_MAINTENANCE", None], "cip"),
    ("消毒记录查看", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "PROCESSING_BATCH_DETAIL", None], "cip"),
    ("清洁确认完成", ["QUALITY_CHECK_EXECUTE", "EQUIPMENT_MAINTENANCE", "PROCESSING_BATCH_DETAIL", None], "cip"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 71 ===")
    print(f"Focus: PROCESS CONTROL & MONITORING queries")
    print(f"       (SPC, parameter monitor, deviation, sampling, in-process, yield rate, rework, changeover, CIP)")
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
        'test': 'v5_round71_process_control_monitoring',
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
    report_path = f'tests/ai-intent/reports/v5_round71_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
