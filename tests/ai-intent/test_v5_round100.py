#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 100
Focus: FINAL MILESTONE COMPREHENSIVE MIX #7 (50 cases, 10 categories x 5)
       The ultimate stress test mixing ultra_short, natural_conversation,
       technical_jargon, emotional_context, multi_language, context_dependent,
       permission_check, data_specific, complex_filter, and stress_test.
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

# Round 100 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Ultra Short (5 cases) =====
    ("查", [
        "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY",
        "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "ORDER_LIST",
        "PROCESSING_BATCH_LIST", "ALERT_LIST", "REPORT_TRENDS", "EQUIPMENT_LIST", "REPORT_QUALITY",
        "REPORT_KPI", None
    ], "ultra_short"),
    ("看", [
        "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY",
        "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "ORDER_LIST",
        "PROCESSING_BATCH_LIST", "ALERT_LIST", "REPORT_TRENDS", "EQUIPMENT_LIST", "REPORT_QUALITY",
        "REPORT_KPI", None
    ], "ultra_short"),
    ("报", [
        "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "REPORT_EFFICIENCY",
        "REPORT_FINANCE", "REPORT_INVENTORY", "REPORT_QUALITY", "REPORT_KPI",
        "PRODUCTION_STATUS_QUERY", None
    ], "ultra_short"),
    ("审", [
        "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "ORDER_LIST",
        "PROCESSING_BATCH_LIST", "ALERT_LIST", "SUPPLIER_LIST", None
    ], "ultra_short"),
    ("问", [
        "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "INVENTORY_QUERY",
        "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", None
    ], "ultra_short"),

    # ===== 2. Natural Conversation (5 cases) =====
    ("早上好帮我看看今天的情况", [
        "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW",
        "ATTENDANCE_TODAY", "PROCESSING_BATCH_LIST", "ALERT_LIST", "REPORT_TRENDS",
        "REPORT_KPI", None
    ], "natural_conversation"),
    ("下班前再查一下库存吧", [
        "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY",
        "REPORT_DASHBOARD_OVERVIEW", None
    ], "natural_conversation"),
    ("老板问产量你帮我查查", [
        "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW",
        "REPORT_EFFICIENCY", "REPORT_TRENDS", "PROCESSING_BATCH_LIST", None
    ], "natural_conversation"),
    ("客户催货了赶紧看看", [
        "ORDER_LIST", "SHIPMENT_QUERY", "INVENTORY_QUERY", "PRODUCTION_STATUS_QUERY",
        "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_LIST", "CUSTOMER_SEARCH", None
    ], "natural_conversation"),
    ("质检那边有什么问题没", [
        "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "ALERT_LIST",
        "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_LIST", None
    ], "natural_conversation"),

    # ===== 3. Technical Jargon (5 cases) =====
    ("CPK不达标", [
        "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW",
        "PRODUCTION_STATUS_QUERY", "REPORT_KPI", "REPORT_EFFICIENCY", None
    ], "technical_jargon"),
    ("OEE偏低", [
        "EQUIPMENT_STATUS_QUERY", "REPORT_EFFICIENCY", "REPORT_PRODUCTION",
        "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI",
        "EQUIPMENT_LIST", "ALERT_LIST", None
    ], "technical_jargon"),
    ("FIFO执行情况", [
        "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY",
        "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_LIST", "TRACE_BATCH",
        "MATERIAL_FIFO_RECOMMEND", None
    ], "technical_jargon"),
    ("BOM展开", [
        "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "PRODUCTION_STATUS_QUERY",
        "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL",
        "MRP_CALCULATION", None
    ], "technical_jargon"),
    ("MRP运算结果", [
        "MRP_CALCULATION", "PRODUCTION_STATUS_QUERY", "INVENTORY_QUERY",
        "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION",
        "PROCESSING_BATCH_LIST", "ORDER_LIST", None
    ], "technical_jargon"),

    # ===== 4. Emotional Context (5 cases) =====
    ("产量太低了怎么办", [
        "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_EFFICIENCY",
        "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "REPORT_KPI",
        "PROCESSING_BATCH_LIST", "ALERT_LIST", None
    ], "emotional_context"),
    ("质量问题太多了", [
        "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "ALERT_LIST",
        "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "REPORT_TRENDS",
        "PROCESSING_BATCH_LIST", None
    ], "emotional_context"),
    ("设备总是坏太烦了", [
        "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "ALERT_LIST",
        "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", "REPORT_KPI", None
    ], "emotional_context"),
    ("库存积压严重啊", [
        "INVENTORY_QUERY", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY",
        "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "REPORT_TRENDS",
        "REPORT_FINANCE", "MATERIAL_LOW_STOCK_ALERT", None
    ], "emotional_context"),
    ("成本控制不住了", [
        "COST_QUERY", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW",
        "REPORT_TRENDS", "REPORT_KPI", "REPORT_EFFICIENCY",
        "PRODUCTION_STATUS_QUERY", None
    ], "emotional_context"),

    # ===== 5. Multi Language (5 cases) =====
    ("看一下production status", [
        "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW",
        "PROCESSING_BATCH_LIST", "REPORT_EFFICIENCY", "REPORT_TRENDS", None
    ], "multi_language"),
    ("check the inventory level", [
        "INVENTORY_QUERY", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY",
        "REPORT_DASHBOARD_OVERVIEW", None
    ], "multi_language"),
    ("质量report", [
        "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW",
        "REPORT_KPI", "REPORT_PRODUCTION", None
    ], "multi_language"),
    ("order tracking查询", [
        "ORDER_LIST", "SHIPMENT_QUERY", "REPORT_DASHBOARD_OVERVIEW",
        "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "CUSTOMER_SEARCH", None
    ], "multi_language"),
    ("equipment maintenance记录", [
        "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "REPORT_DASHBOARD_OVERVIEW",
        "REPORT_EFFICIENCY", "ALERT_LIST", None
    ], "multi_language"),

    # ===== 6. Context Dependent (5 cases) =====
    ("刚才那个再查一下", [
        "CONTINUE_LAST_OPERATION", "QUERY_RETRY_LAST", "REPORT_DASHBOARD_OVERVIEW",
        "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", None
    ], "context_dependent"),
    ("另一个呢", [
        "CONTINUE_LAST_OPERATION", "EXECUTE_SWITCH", "CONDITION_SWITCH",
        "QUERY_RETRY_LAST", "REPORT_DASHBOARD_OVERVIEW", None
    ], "context_dependent"),
    ("这个月的呢", [
        "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS",
        "PRODUCTION_STATUS_QUERY", "REPORT_FINANCE", "REPORT_EFFICIENCY",
        "REPORT_KPI", "CONTINUE_LAST_OPERATION", "CONDITION_SWITCH",
        "ATTENDANCE_MONTHLY", None
    ], "context_dependent"),
    ("和上面一样", [
        "CONTINUE_LAST_OPERATION", "QUERY_RETRY_LAST", "EXECUTE_SWITCH",
        "REPORT_DASHBOARD_OVERVIEW", None
    ], "context_dependent"),
    ("换一个看看", [
        "EXECUTE_SWITCH", "CONDITION_SWITCH", "CONTINUE_LAST_OPERATION",
        "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None
    ], "context_dependent"),

    # ===== 7. Permission Check (5 cases) =====
    ("我能看什么数据", [
        "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "INVENTORY_QUERY",
        "CONFIG_RESET", "HR_EMPLOYEE_LIST", None
    ], "permission_check"),
    ("这个我有权限吗", [
        "REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "PRODUCTION_STATUS_QUERY",
        "HR_EMPLOYEE_LIST", "USER_ROLE_ASSIGN", None
    ], "permission_check"),
    ("切换到管理员视角", [
        "EXECUTE_SWITCH", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW",
        "CONDITION_SWITCH", None
    ], "permission_check"),
    ("查看我的权限", [
        "REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "HR_EMPLOYEE_LIST",
        "PRODUCTION_STATUS_QUERY", "USER_ROLE_ASSIGN", None
    ], "permission_check"),
    ("其他工厂的数据", [
        "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "EXECUTE_SWITCH",
        "CONDITION_SWITCH", "CONFIG_RESET", "REPORT_TRENDS", None
    ], "permission_check"),

    # ===== 8. Data Specific (5 cases) =====
    ("查FA-2026-0001批次", [
        "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "TRACE_BATCH",
        "MATERIAL_BATCH_QUERY", "PRODUCTION_STATUS_QUERY",
        "REPORT_DASHBOARD_OVERVIEW", None
    ], "data_specific"),
    ("设备E005的状态", [
        "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "ALERT_LIST",
        "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", None
    ], "data_specific"),
    ("订单PO-20260210", [
        "ORDER_LIST", "SHIPMENT_QUERY", "REPORT_DASHBOARD_OVERVIEW",
        "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST",
        "PROCESSING_BATCH_DETAIL", None
    ], "data_specific"),
    ("物料编码RM-001", [
        "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_INVENTORY",
        "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_LIST",
        "TRACE_BATCH", None
    ], "data_specific"),
    ("供应商S003", [
        "SUPPLIER_LIST", "REPORT_DASHBOARD_OVERVIEW", "ORDER_LIST",
        "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "QUALITY_CHECK_QUERY", None
    ], "data_specific"),

    # ===== 9. Complex Filter (5 cases) =====
    ("查上个月A车间不合格率大于5%的批次", [
        "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "PROCESSING_BATCH_LIST",
        "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW",
        "REPORT_KPI", "REPORT_TRENDS", "ALERT_LIST", "QUALITY_STATS", None
    ], "complex_filter"),
    ("找出库存低于安全库存的物料", [
        "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY",
        "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_LOW_STOCK_ALERT", None
    ], "complex_filter"),
    ("最近一周产量最高的产线", [
        "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_EFFICIENCY",
        "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI",
        "PROCESSING_BATCH_LIST", None
    ], "complex_filter"),
    ("本月退货最多的客户", [
        "CUSTOMER_SEARCH", "ORDER_LIST", "SHIPMENT_QUERY", "REPORT_QUALITY",
        "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "QUALITY_CHECK_QUERY",
        "REPORT_FINANCE", None
    ], "complex_filter"),
    ("查质检不合格的供应商", [
        "SUPPLIER_LIST", "QUALITY_CHECK_QUERY", "REPORT_QUALITY",
        "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "MATERIAL_BATCH_QUERY", None
    ], "complex_filter"),

    # ===== 10. Stress Test (5 cases) =====
    ("啊啊啊啊啊", [None, "REPORT_DASHBOARD_OVERVIEW"], "stress_test"),
    ("1234567890", [None, "REPORT_DASHBOARD_OVERVIEW"], "stress_test"),
    ("！@#￥%……&*", [None, "REPORT_DASHBOARD_OVERVIEW"], "stress_test"),
    ("查查查查查查查查查查", [None, "REPORT_DASHBOARD_OVERVIEW"], "stress_test"),
    ("空空空空空", [None, "REPORT_DASHBOARD_OVERVIEW"], "stress_test"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 100 ===")
    print(f"Focus: FINAL MILESTONE COMPREHENSIVE MIX #7")
    print(f"       (ultra_short, natural_conversation, technical_jargon,")
    print(f"        emotional_context, multi_language, context_dependent,")
    print(f"        permission_check, data_specific, complex_filter, stress_test)")
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
        'test': 'v5_round100_final_milestone_comprehensive_mix_7',
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
    report_path = f'tests/ai-intent/reports/v5_round100_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
