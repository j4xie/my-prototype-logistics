#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 29
Focus: ROLE-SPECIFIC QUERIES - queries typical for specific factory roles
       (factory admin, workshop supervisor, warehouse manager, quality inspector,
        HR admin, dispatcher, procurement, finance, management).
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

# Round 29 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Factory Admin (6 cases) =====
    ("全厂运营数据汇总", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_TRENDS"], "factoryadmin-operations"),
    ("工厂KPI完成得怎么样", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_TRENDS"], "factoryadmin-kpi"),
    ("各部门绩效排名", ["REPORT_KPI", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_STATS", "REPORT_TRENDS"], "factoryadmin-dept-performance"),
    ("生成本月运营报告", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_FINANCE", "REPORT_TRENDS"], "factoryadmin-report"),
    ("成本控制情况怎么样", ["REPORT_FINANCE", "COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_KPI", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW"], "factoryadmin-cost-control"),
    ("下个月产能规划", ["PRODUCTION_PLAN_QUERY", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", None], "factoryadmin-capacity"),

    # ===== 2. Workshop Supervisor (6 cases) =====
    ("我车间今天产量多少", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST"], "workshop-output"),
    ("工人出勤情况怎么样", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", "ATTENDANCE_QUERY", "ATTENDANCE_STATUS", "ATTENDANCE_HISTORY", "REPORT_DASHBOARD_OVERVIEW"], "workshop-attendance"),
    ("设备状态正常吗", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATUS", "EQUIPMENT_STATS", "EQUIPMENT_LIST"], "workshop-equipment"),
    ("目前在产批次有哪些", ["PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_DETAIL"], "workshop-active-batches"),
    ("物料够不够用到下班", ["MATERIAL_BATCH_QUERY", "MATERIAL_LOW_STOCK_ALERT", "REPORT_INVENTORY", "INVENTORY_QUERY"], "workshop-material"),
    ("交接班需要注意什么", ["PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "ATTENDANCE_HISTORY", None], "workshop-handover"),

    # ===== 3. Warehouse Manager (6 cases) =====
    ("库存总览看一下", ["REPORT_INVENTORY", "INVENTORY_QUERY", "INVENTORY_STATS", "MATERIAL_BATCH_QUERY"], "warehouse-overview"),
    ("今天入库了多少", ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "INVENTORY_QUERY", "MATERIAL_BATCH_LIST", "MATERIAL_BATCH_CREATE"], "warehouse-inbound"),
    ("出库单查一下", ["SHIPMENT_QUERY", "SHIPMENT_LIST", "ORDER_LIST", "REPORT_INVENTORY", "SHIPMENT_CREATE"], "warehouse-outbound"),
    ("A3库位还有什么货", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_INVENTORY", None], "warehouse-location"),
    ("哪些物料库存预警了", ["MATERIAL_LOW_STOCK_ALERT", "MATERIAL_EXPIRY_ALERT", "ALERT_ACTIVE", "ALERT_LIST", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "warehouse-alert"),
    ("安排一下月底盘点", ["INVENTORY_CHECK", "INVENTORY_QUERY", "REPORT_INVENTORY", None], "warehouse-stocktake"),

    # ===== 4. Quality Inspector (6 cases) =====
    ("今天有哪些待检清单", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "QUALITY_CHECK_EXECUTE", "QUALITY_STATS", None], "quality-pending"),
    ("最近的质检结果怎么样", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", "QUALITY_RESULT"], "quality-results"),
    ("不合格品怎么处理", ["QUALITY_DISPOSITION_EXECUTE", "DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "quality-nonconforming"),
    ("这个产品检验标准是什么", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "FOOD_SAFETY_CERT_QUERY", None], "quality-standard"),
    ("取样检测做一下", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY"], "quality-sampling"),
    ("质量趋势最近有变化吗", ["REPORT_QUALITY", "QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_TRENDS"], "quality-trend"),

    # ===== 5. HR Admin (5 cases) =====
    ("员工出勤率统计", ["ATTENDANCE_STATS", "ATTENDANCE_TODAY", "ATTENDANCE_HISTORY", "REPORT_EFFICIENCY"], "hr-attendance-rate"),
    ("请假审批有几个待处理", ["ATTENDANCE_QUERY", "ATTENDANCE_STATS", "ATTENDANCE_ANOMALY", None], "hr-leave-approval"),
    ("这个月加班统计", ["ATTENDANCE_STATS", "ATTENDANCE_HISTORY", "REPORT_EFFICIENCY", "ATTENDANCE_MONTHLY", None], "hr-overtime"),
    ("最近人员变动情况", ["ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "hr-personnel-change"),
    ("绩效考核结果出来了吗", ["REPORT_KPI", "REPORT_EFFICIENCY", "ATTENDANCE_STATS", None], "hr-performance-review"),

    # ===== 6. Dispatcher (6 cases) =====
    ("今天的排产计划", ["PRODUCTION_PLAN_QUERY", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_CREATE"], "dispatch-today-schedule"),
    ("订单排期查一下", ["ORDER_LIST", "ORDER_STATS", "PRODUCTION_PLAN_QUERY", "SHIPMENT_QUERY"], "dispatch-order-schedule"),
    ("各产线怎么安排的", ["PRODUCTION_PLAN_QUERY", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", "PROCESSING_BATCH_CREATE"], "dispatch-line-arrange"),
    ("有个紧急插单需要安排", ["PRODUCTION_PLAN_QUERY", "PROCESSING_BATCH_CREATE", "ORDER_LIST", None], "dispatch-rush-order"),
    ("客户要的交期能赶上吗", ["ORDER_STATUS", "ORDER_LIST", "SHIPMENT_QUERY", "PRODUCTION_PLAN_QUERY", None, "PRODUCTION_STATUS_QUERY"], "dispatch-delivery-confirm"),
    ("当前产能还能接多少单", ["REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PRODUCTION_PLAN_QUERY", None], "dispatch-capacity"),

    # ===== 7. Procurement (5 cases) =====
    ("采购订单进度", ["ORDER_LIST", "ORDER_STATUS", "SUPPLIER_QUERY", "MATERIAL_BATCH_QUERY"], "procurement-order"),
    ("供应商评价怎么样", ["SUPPLIER_EVALUATE", "SUPPLIER_QUERY", "SUPPLIER_RANKING", "SUPPLIER_STATS"], "procurement-supplier"),
    ("这批原料各家价格对比", ["SUPPLIER_QUERY", "SUPPLIER_EVALUATE", "SUPPLIER_RANKING", "MATERIAL_BATCH_QUERY", "SUPPLIER_COMPARISON", None], "procurement-price-compare"),
    ("到货情况核实一下", ["MATERIAL_BATCH_QUERY", "SHIPMENT_QUERY", "ORDER_STATUS", "MATERIAL_BATCH_LIST", "MATERIAL_BATCH_CREATE"], "procurement-arrival"),
    ("供应商付款进度", ["SUPPLIER_QUERY", "ORDER_STATUS", "ORDER_LIST", "REPORT_FINANCE", None], "procurement-payment"),

    # ===== 8. Finance (5 cases) =====
    ("这个月财务报表", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS"], "finance-statement"),
    ("成本分析报告", ["REPORT_FINANCE", "COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_TRENDS"], "finance-cost-analysis"),
    ("产品利润率是多少", ["REPORT_FINANCE", "REPORT_KPI", "REPORT_TRENDS", None], "finance-profit-margin"),
    ("各部门费用统计", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "finance-expense"),
    ("预算执行情况", ["REPORT_FINANCE", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "finance-budget"),

    # ===== 9. Management (5 cases) =====
    ("经营分析数据", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_FINANCE", "REPORT_TRENDS", "REPORT_KPI"], "management-business-analysis"),
    ("决策支持报告", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "REPORT_FINANCE", "REPORT_TRENDS", None], "management-decision-support"),
    ("风险预警有哪些", ["ALERT_LIST", "ALERT_ACTIVE", "ALERT_STATS", "MATERIAL_LOW_STOCK_ALERT", "REPORT_DASHBOARD_OVERVIEW", None], "management-risk-alert"),
    ("市场分析情况", ["REPORT_TRENDS", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "management-market"),
    ("竞争对手动态", [None], "management-competitor"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 29 ===")
    print(f"Focus: ROLE-SPECIFIC QUERIES - factory admin, workshop supervisor,")
    print(f"       warehouse manager, quality inspector, HR admin, dispatcher,")
    print(f"       procurement, finance, management")
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
        'test': 'v5_round29_role_specific_queries',
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
    report_path = f'tests/ai-intent/reports/v5_round29_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
