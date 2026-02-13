#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 62
Focus: SEARCH & FILTER QUERIES for food manufacturing.
       Covers batch search, material search, order search, employee search,
       equipment search, supplier search, quality search, date filter, and condition filter.
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

# Round 62 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Batch Search (6 cases) =====
    ("查找批次B001", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "TRACE_BATCH", None], "batch_search"),
    ("搜索批次号", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL", "TRACE_BATCH", "MATERIAL_BATCH_QUERY", None], "batch_search"),
    ("按批次查", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL", "TRACE_BATCH", None], "batch_search"),
    ("批次筛选", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL", "TRACE_BATCH", None], "batch_search"),
    ("定位批次", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "TRACE_BATCH", None], "batch_search"),
    ("找到这个批次", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "TRACE_BATCH", None], "batch_search"),

    # ===== 2. Material Search (6 cases) =====
    ("搜索原料", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", None], "material_search"),
    ("查找面粉", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", None], "material_search"),
    ("按名称查物料", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", None], "material_search"),
    ("物料编码搜索", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", None], "material_search"),
    ("筛选原材料", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", None], "material_search"),
    ("找到大豆", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", None], "material_search"),

    # ===== 3. Order Search (5 cases) =====
    ("查找订单", ["ORDER_LIST", "ORDER_FILTER", "ORDER_STATUS", "CUSTOMER_PURCHASE_HISTORY", None], "order_search"),
    ("按日期筛选订单", ["ORDER_FILTER", "ORDER_LIST", "ORDER_STATUS", "CUSTOMER_PURCHASE_HISTORY", None], "order_search"),
    ("搜索客户订单", ["ORDER_LIST", "ORDER_FILTER", "CUSTOMER_PURCHASE_HISTORY", None], "order_search"),
    ("订单编号查询", ["ORDER_LIST", "ORDER_FILTER", "ORDER_STATUS", "CUSTOMER_PURCHASE_HISTORY", None], "order_search"),
    ("筛选未完成订单", ["ORDER_FILTER", "ORDER_LIST", "ORDER_STATUS", "CUSTOMER_PURCHASE_HISTORY", None], "order_search"),

    # ===== 4. Employee Search (6 cases) =====
    ("查找员工", ["HR_EMPLOYEE_LIST", "HR_EMPLOYEE_SEARCH", "ATTENDANCE_TODAY", "PROCESSING_BATCH_WORKERS", None], "employee_search"),
    ("搜索张三", ["HR_EMPLOYEE_SEARCH", "HR_EMPLOYEE_LIST", "ATTENDANCE_TODAY", "PROCESSING_BATCH_WORKERS", None], "employee_search"),
    ("按部门筛选", ["HR_EMPLOYEE_LIST", "HR_EMPLOYEE_SEARCH", "ATTENDANCE_TODAY", "PROCESSING_BATCH_WORKERS", "ATTENDANCE_DEPARTMENT", None], "employee_search"),
    ("工号查询", ["HR_EMPLOYEE_SEARCH", "HR_EMPLOYEE_LIST", "ATTENDANCE_TODAY", "PROCESSING_BATCH_WORKERS", None], "employee_search"),
    ("人员搜索", ["HR_EMPLOYEE_SEARCH", "HR_EMPLOYEE_LIST", "ATTENDANCE_TODAY", "PROCESSING_BATCH_WORKERS", None], "employee_search"),
    ("谁在车间A", ["PROCESSING_BATCH_WORKERS", "HR_EMPLOYEE_LIST", "HR_EMPLOYEE_SEARCH", "ATTENDANCE_TODAY", None], "employee_search"),

    # ===== 5. Equipment Search (5 cases) =====
    ("查找设备", ["EQUIPMENT_LIST", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", None], "equipment_search"),
    ("设备编号搜索", ["EQUIPMENT_LIST", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", None], "equipment_search"),
    ("筛选离线设备", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "EQUIPMENT_DETAIL", "EQUIPMENT_STATS", None], "equipment_search"),
    ("找到搅拌机", ["EQUIPMENT_LIST", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", None], "equipment_search"),
    ("定位设备", ["EQUIPMENT_LIST", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", None], "equipment_search"),

    # ===== 6. Supplier Search (6 cases) =====
    ("搜索供应商", ["SUPPLIER_LIST", "SUPPLIER_SEARCH", "SUPPLIER_EVALUATE", None], "supplier_search"),
    ("查找A公司", ["SUPPLIER_SEARCH", "SUPPLIER_LIST", "SUPPLIER_EVALUATE", None], "supplier_search"),
    ("筛选合格供应商", ["SUPPLIER_LIST", "SUPPLIER_SEARCH", "SUPPLIER_EVALUATE", None], "supplier_search"),
    ("供应商编码查询", ["SUPPLIER_SEARCH", "SUPPLIER_LIST", "SUPPLIER_EVALUATE", None], "supplier_search"),
    ("按地区查供应商", ["SUPPLIER_LIST", "SUPPLIER_SEARCH", "SUPPLIER_EVALUATE", None], "supplier_search"),
    ("供应商模糊搜索", ["SUPPLIER_SEARCH", "SUPPLIER_LIST", "SUPPLIER_EVALUATE", None], "supplier_search"),

    # ===== 7. Quality Search (5 cases) =====
    ("查找质检记录", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", None], "quality_search"),
    ("搜索不合格项", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", None], "quality_search"),
    ("按日期查质检", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", None], "quality_search"),
    ("质检单号查询", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", None], "quality_search"),
    ("筛选异常质检", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "ALERT_LIST", None], "quality_search"),

    # ===== 8. Date Filter (6 cases) =====
    ("按日期筛选", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "ORDER_FILTER", "CONDITION_SWITCH", None], "date_filter"),
    ("最近7天", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "ORDER_FILTER", "CONDITION_SWITCH", None], "date_filter"),
    ("上个月数据", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "ORDER_FILTER", "CONDITION_SWITCH", None], "date_filter"),
    ("按时间范围查", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "ORDER_FILTER", "CONDITION_SWITCH", None], "date_filter"),
    ("日期区间筛选", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "ORDER_FILTER", "CONDITION_SWITCH", None], "date_filter"),
    ("今年的记录", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "ORDER_FILTER", "CONDITION_SWITCH", None], "date_filter"),

    # ===== 9. Condition Filter (5 cases) =====
    ("按状态筛选", ["CONDITION_SWITCH", "ORDER_FILTER", "REPORT_DASHBOARD_OVERVIEW", None], "condition_filter"),
    ("只看异常", ["CONDITION_SWITCH", "ORDER_FILTER", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "condition_filter"),
    ("筛选条件设置", ["CONDITION_SWITCH", "ORDER_FILTER", "REPORT_DASHBOARD_OVERVIEW", None], "condition_filter"),
    ("过滤已完成", ["CONDITION_SWITCH", "ORDER_FILTER", "REPORT_DASHBOARD_OVERVIEW", None], "condition_filter"),
    ("条件查询", ["CONDITION_SWITCH", "ORDER_FILTER", "REPORT_DASHBOARD_OVERVIEW", None], "condition_filter"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 62 ===")
    print(f"Focus: SEARCH & FILTER QUERIES")
    print(f"       (batch, material, order, employee, equipment, supplier, quality, date filter, condition filter)")
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
        'test': 'v5_round62_search_and_filter',
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
    report_path = f'tests/ai-intent/reports/v5_round62_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
