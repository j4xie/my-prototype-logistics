#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 28
Focus: ACTION VERB VARIATIONS - testing different action verbs with the same object,
       and same verb with different objects.
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

# Round 28 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. "查" Variations (6 cases) =====
    ("查产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", "PROCESSING_STATS"], "cha-production"),
    ("查库存", ["INVENTORY_QUERY", "INVENTORY_CHECK", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "INVENTORY_STATS"], "cha-inventory"),
    ("查设备", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATUS", "EQUIPMENT_LIST", "EQUIPMENT_STATS"], "cha-equipment"),
    ("查订单", ["ORDER_LIST", "ORDER_STATS", "ORDER_FILTER"], "cha-order"),
    ("查质检", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "QUALITY_CHECK_LIST", "REPORT_QUALITY"], "cha-quality"),
    ("查考勤", ["ATTENDANCE_QUERY", "ATTENDANCE_STATUS", "ATTENDANCE_TODAY", "ATTENDANCE_HISTORY", "ATTENDANCE_STATS"], "cha-attendance"),

    # ===== 2. "看" Variations (6 cases) =====
    ("看报表", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_INVENTORY", "REPORT_QUALITY", "REPORT_KPI"], "kan-report"),
    ("看数据", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "REPORT_PRODUCTION", None], "kan-data"),
    ("看趋势", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "kan-trend"),
    ("看告警", ["ALERT_LIST", "ALERT_ACTIVE", "ALERT_STATS"], "kan-alert"),
    ("看批次", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL", "MATERIAL_BATCH_QUERY"], "kan-batch"),
    ("看排班", ["SCHEDULE_QUERY", "ATTENDANCE_QUERY", "ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "kan-schedule"),

    # ===== 3. "做/执行" Variations (5 cases) =====
    ("做质检", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST"], "zuo-quality"),
    ("做盘点", ["INVENTORY_CHECK", "INVENTORY_QUERY", "INVENTORY_STATS", "REPORT_INVENTORY"], "zuo-inventory"),
    ("做维护", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_UPDATE", None], "zuo-maintenance"),
    ("执行出库", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", "SHIPMENT_UPDATE", "MATERIAL_BATCH_QUERY", None], "zuo-outbound"),
    ("做报表", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_KPI", None], "zuo-report"),

    # ===== 4. "创建/新建" Variations (6 cases) =====
    ("新建订单", ["ORDER_CREATE", "ORDER_LIST", None], "create-order"),
    ("创建批次", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_START", "MATERIAL_BATCH_CREATE", None], "create-batch"),
    ("新增供应商", ["SUPPLIER_CREATE", "SUPPLIER_QUERY", "SUPPLIER_SEARCH", None], "create-supplier"),
    ("新建用户", ["USER_CREATE", "USER_LIST", None], "create-user"),
    ("创建计划", ["SCHEDULE_CREATE", "PROCESSING_BATCH_CREATE", "PRODUCTION_STATUS_QUERY", None], "create-plan"),
    ("新建工单", ["ORDER_CREATE", "PROCESSING_BATCH_CREATE", "EQUIPMENT_MAINTENANCE", None], "create-workorder"),

    # ===== 5. "修改/更新" Variations (5 cases) =====
    ("修改订单", ["ORDER_UPDATE", "ORDER_LIST", "ORDER_STATS", "ORDER_STATUS", None], "modify-order"),
    ("更新库存", ["MATERIAL_ADJUST_QUANTITY", "INVENTORY_QUERY", "INVENTORY_CHECK", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", None], "modify-inventory"),
    ("改配方", ["PRODUCT_UPDATE", "PROCESSING_BATCH_DETAIL", None], "modify-recipe"),
    ("调整参数", ["EQUIPMENT_STATUS_UPDATE", "EQUIPMENT_CONTROL", "PRODUCT_UPDATE", "FACTORY_SETTINGS", None], "modify-params"),
    ("修改排班", ["SCHEDULE_UPDATE", "SCHEDULE_QUERY", "ATTENDANCE_QUERY", "ATTENDANCE_STATS", None], "modify-schedule"),

    # ===== 6. "删除/取消" Variations (5 cases) =====
    ("取消订单", ["ORDER_CANCEL", "ORDER_DELETE", "ORDER_LIST"], "delete-cancel-order"),
    ("删除记录", ["DATA_BATCH_DELETE", "MATERIAL_BATCH_DELETE", "BATCH_DELETE", None], "delete-record"),
    ("撤销操作", ["ORDER_CANCEL", "PROCESSING_BATCH_CANCEL", "OPERATION_UNDO_OR_RECALL", None], "delete-undo"),
    ("退货", ["ORDER_CANCEL", "SHIPMENT_QUERY", "QUALITY_DISPOSITION_EXECUTE", None], "delete-return"),
    ("报废", ["QUALITY_DISPOSITION_EXECUTE", "MATERIAL_BATCH_DELETE", "MATERIAL_ADJUST_QUANTITY", None], "delete-scrap"),

    # ===== 7. "导出/打印" Variations (5 cases) =====
    ("导出报表", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_KPI", None], "export-report"),
    ("打印标签", ["LABEL_PRINT", "LABEL_QUERY", None], "export-label"),
    ("下载数据", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "export-download"),
    ("导出Excel", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_KPI", None], "export-excel"),
    ("打印质检单", ["LABEL_PRINT", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "export-qc-print"),

    # ===== 8. "审批/确认" Variations (6 cases) =====
    ("审批请假", ["ATTENDANCE_QUERY", "ATTENDANCE_HISTORY", "ATTENDANCE_ANOMALY", None], "approve-leave"),
    ("确认收货", ["MATERIAL_BATCH_CREATE", "MATERIAL_BATCH_QUERY", "SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", None], "approve-receive"),
    ("审核订单", ["ORDER_LIST", "ORDER_STATS", "ORDER_UPDATE", None], "approve-order"),
    ("批准出库", ["SHIPMENT_CREATE", "SHIPMENT_QUERY", "MATERIAL_BATCH_QUERY", None], "approve-outbound"),
    ("确认发货", ["SHIPMENT_CREATE", "SHIPMENT_STATUS_UPDATE", "SHIPMENT_QUERY"], "approve-ship"),
    ("审批报废", ["QUALITY_DISPOSITION_EXECUTE", "MATERIAL_ADJUST_QUANTITY", None], "approve-scrap"),

    # ===== 9. "统计/汇总" Variations (6 cases) =====
    ("统计产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_STATS", "PROCESSING_BATCH_LIST"], "stats-production"),
    ("汇总成本", ["REPORT_FINANCE", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "COST_QUERY", None], "stats-cost"),
    ("统计质量", ["QUALITY_STATS", "REPORT_QUALITY", "QUALITY_CHECK_QUERY", "QUALITY_COMPARISON"], "stats-quality"),
    ("汇总销售", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "ORDER_STATS", "SHIPMENT_STATS", None], "stats-sales"),
    ("统计库存", ["INVENTORY_STATS", "INVENTORY_QUERY", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "stats-inventory"),
    ("汇总考勤", ["ATTENDANCE_STATS", "ATTENDANCE_HISTORY", "ATTENDANCE_MONTHLY", "ATTENDANCE_STATS_BY_DEPT", "ATTENDANCE_TODAY"], "stats-attendance"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 28 ===")
    print(f"Focus: ACTION VERB VARIATIONS - different verbs with same object,")
    print(f"       same verb with different objects")
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
        'test': 'v5_round28_action_verb_variations',
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
    report_path = f'tests/ai-intent/reports/v5_round28_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
