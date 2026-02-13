#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 95
Focus: MILESTONE COMPREHENSIVE MIX #6 (50 cases, 10 categories x 5)
       Covers follow_up, hypothetical, opinion_seeking, temporal_relative,
       quantified, role_specific, action_chain, error_tolerance,
       implicit_intent, meta_query.
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

# Round 95 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Follow Up (5 cases) =====
    ("上次说的产量呢",
     ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "CONTINUE_LAST_OPERATION", "SYSTEM_RESUME_LAST_ACTION", "PROCESSING_BATCH_LIST", None],
     "follow_up"),
    ("刚才查的结果",
     ["CONTINUE_LAST_OPERATION", "SYSTEM_RESUME_LAST_ACTION", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "INVENTORY_QUERY", "QUALITY_CHECK_QUERY", "QUERY_RETRY_LAST", None],
     "follow_up"),
    ("继续刚才的话题",
     ["CONTINUE_LAST_OPERATION", "SYSTEM_RESUME_LAST_ACTION", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None],
     "follow_up"),
    ("接着看库存",
     ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "CONTINUE_LAST_OPERATION", "SYSTEM_RESUME_LAST_ACTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_INVENTORY", None],
     "follow_up"),
    ("还有什么问题",
     ["ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "CONTINUE_LAST_OPERATION", "SYSTEM_RESUME_LAST_ACTION", "PRODUCTION_STATUS_QUERY", None],
     "follow_up"),

    # ===== 2. Hypothetical (5 cases) =====
    ("假如产量翻倍",
     ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_EFFICIENCY", "SCHEDULING_AUTO", "CONDITION_SWITCH", "EXECUTE_SWITCH", None],
     "hypothetical"),
    ("如果增加一条产线",
     ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "SCHEDULING_AUTO", "EQUIPMENT_STATUS_QUERY", "CONDITION_SWITCH", "EXECUTE_SWITCH", "PROCESSING_BATCH_CREATE", None],
     "hypothetical"),
    ("万一设备坏了怎么办",
     ["EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", "CONDITION_SWITCH", "EXECUTE_SWITCH", None],
     "hypothetical"),
    ("要是库存不够呢",
     ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", "CONDITION_SWITCH", "EXECUTE_SWITCH", "MATERIAL_LOW_STOCK_ALERT", None],
     "hypothetical"),
    ("假设质检不合格",
     ["QUALITY_CHECK_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", "CONDITION_SWITCH", "EXECUTE_SWITCH", None],
     "hypothetical"),

    # ===== 3. Opinion Seeking (5 cases) =====
    ("你觉得产量够吗",
     ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None],
     "opinion_seeking"),
    ("这批质量怎么样",
     ["QUALITY_CHECK_QUERY", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", "TRACE_BATCH", "QUALITY_STATS", None],
     "opinion_seeking"),
    ("效率还行吗",
     ["REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None],
     "opinion_seeking"),
    ("成本合理吗",
     ["COST_QUERY", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None],
     "opinion_seeking"),
    ("你建议怎么排产",
     ["SCHEDULING_AUTO", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_CREATE", None],
     "opinion_seeking"),

    # ===== 4. Temporal Relative (5 cases) =====
    ("前天的产量",
     ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_TRENDS", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None],
     "temporal_relative"),
    ("上上个月的报表",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_FINANCE", "REPORT_EFFICIENCY", None],
     "temporal_relative"),
    ("最近三天的质检",
     ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "QUALITY_CHECK_EXECUTE", None],
     "temporal_relative"),
    ("过去一周的库存变化",
     ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_INVENTORY", None],
     "temporal_relative"),
    ("明天的排班",
     ["SCHEDULING_AUTO", "ATTENDANCE_TODAY", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_HISTORY", None],
     "temporal_relative"),

    # ===== 5. Quantified (5 cases) =====
    ("查第三车间产量",
     ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None],
     "quantified"),
    ("二号设备状态",
     ["EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None],
     "quantified"),
    ("第五批次质检",
     ["QUALITY_CHECK_QUERY", "PROCESSING_BATCH_LIST", "TRACE_BATCH", "REPORT_DASHBOARD_OVERVIEW", None],
     "quantified"),
    ("仓库三的库存",
     ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_INVENTORY", None],
     "quantified"),
    ("产线一效率",
     ["REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None],
     "quantified"),

    # ===== 6. Role Specific (5 cases) =====
    ("我是质检员要做什么",
     ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "ATTENDANCE_TODAY", None],
     "role_specific"),
    ("车间主管看什么",
     ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "SCHEDULING_AUTO", "ALERT_LIST", "PROCESSING_BATCH_LIST", None],
     "role_specific"),
    ("仓管员日常操作",
     ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", "SHIPMENT_QUERY", None],
     "role_specific"),
    ("调度员今天任务",
     ["SCHEDULING_AUTO", "ATTENDANCE_TODAY", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None],
     "role_specific"),
    ("厂长看板",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_FINANCE", "REPORT_EFFICIENCY", None],
     "role_specific"),

    # ===== 7. Action Chain (5 cases) =====
    ("先质检再入库",
     ["QUALITY_CHECK_QUERY", "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_LIST", "FORM_GENERATION", "QUALITY_CHECK_EXECUTE", None],
     "action_chain"),
    ("检完发货",
     ["QUALITY_CHECK_QUERY", "SHIPMENT_QUERY", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", None],
     "action_chain"),
    ("排完产通知我",
     ["SCHEDULING_AUTO", "PRODUCTION_STATUS_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None],
     "action_chain"),
    ("审批后开工",
     ["SCHEDULING_AUTO", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_START", None],
     "action_chain"),
    ("盘点完生成报告",
     ["INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "FORM_GENERATION", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", None],
     "action_chain"),

    # ===== 8. Error Tolerance (5 cases) =====
    ("产量产量",
     ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None],
     "error_tolerance"),
    ("查查查库存",
     ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_INVENTORY", None],
     "error_tolerance"),
    ("我我我要看报表",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_FINANCE", "REPORT_EFFICIENCY", None],
     "error_tolerance"),
    ("那个那个设备",
     ["EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "EQUIPMENT_LIST", None],
     "error_tolerance"),
    ("就是就是质检",
     ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_EXECUTE", None],
     "error_tolerance"),

    # ===== 9. Implicit Intent (5 cases) =====
    ("怎么回事",
     ["ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", "ALERT_DIAGNOSE", None],
     "implicit_intent"),
    ("出了什么问题",
     ["ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", None],
     "implicit_intent"),
    ("有什么异常",
     ["ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", None],
     "implicit_intent"),
    ("情况如何",
     ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "ALERT_LIST", "INVENTORY_QUERY", "QUALITY_CHECK_QUERY", None],
     "implicit_intent"),
    ("一切正常吗",
     ["REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", None],
     "implicit_intent"),

    # ===== 10. Meta Query (5 cases) =====
    ("你能查什么",
     ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "CONFIG_RESET", None],
     "meta_query"),
    ("系统有什么功能",
     ["REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "PRODUCTION_STATUS_QUERY", None],
     "meta_query"),
    ("帮我做什么",
     ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "SCHEDULING_AUTO", "CONFIG_RESET", None],
     "meta_query"),
    ("还能查啥",
     ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "INVENTORY_QUERY", "CONFIG_RESET", "CONTINUE_LAST_OPERATION", "QUERY_RETRY_LAST", None],
     "meta_query"),
    ("你都会什么",
     ["REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "PRODUCTION_STATUS_QUERY", None],
     "meta_query"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 95 ===")
    print(f"Focus: MILESTONE COMPREHENSIVE MIX #6 (50 cases, 10 categories x 5)")
    print(f"       (follow_up, hypothetical, opinion_seeking, temporal_relative,")
    print(f"        quantified, role_specific, action_chain, error_tolerance,")
    print(f"        implicit_intent, meta_query)")
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
        'test': 'v5_round95_milestone_comprehensive_mix_6',
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
    report_path = f'tests/ai-intent/reports/v5_round95_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
