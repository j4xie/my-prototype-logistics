#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 60
Focus: CROSS-DOMAIN COMPREHENSIVE MIX (milestone)
       Covers production_quality, cost_efficiency, inventory_production,
       equipment_quality, hr_production, supply_chain, traceability_safety,
       alert_action, report_export, ai_analysis across 10 domains.
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

# Round 60 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Production Quality (5 cases) =====
    ("生产质量怎么样", ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "production_quality"),
    ("加工合格率", ["QUALITY_STATS", "REPORT_QUALITY", "REPORT_PRODUCTION", None], "production_quality"),
    ("次品率统计", ["REPORT_PRODUCTION", "QUALITY_STATS", "REPORT_QUALITY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "production_quality"),
    ("产品良率", ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_PRODUCTION", "REPORT_TRENDS", None], "production_quality"),
    ("废品分析", ["REPORT_TRENDS", "REPORT_QUALITY", "REPORT_PRODUCTION", "QUALITY_STATS", None], "production_quality"),

    # ===== 2. Cost Efficiency (5 cases) =====
    ("人工成本效率", ["COST_QUERY", "REPORT_EFFICIENCY", "REPORT_FINANCE", "COST_TREND_ANALYSIS", None], "cost_efficiency"),
    ("单位成本分析", ["COST_QUERY", "REPORT_FINANCE", "COST_TREND_ANALYSIS", "REPORT_TRENDS", None], "cost_efficiency"),
    ("生产效率和成本", ["REPORT_EFFICIENCY", "COST_QUERY", "REPORT_FINANCE", "REPORT_TRENDS", None], "cost_efficiency"),
    ("降本增效", ["COST_TREND_ANALYSIS", "REPORT_EFFICIENCY", "COST_QUERY", "REPORT_TRENDS", None], "cost_efficiency"),
    ("成本优化", ["COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_FINANCE", "REPORT_TRENDS", None], "cost_efficiency"),

    # ===== 3. Inventory Production (5 cases) =====
    ("原料够不够生产", ["MATERIAL_LOW_STOCK_ALERT", "MRP_CALCULATION", "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", None], "inventory_production"),
    ("物料和排产", ["MRP_CALCULATION", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "PRODUCTION_STATUS_QUERY", None], "inventory_production"),
    ("缺料预警", ["MATERIAL_LOW_STOCK_ALERT", "INVENTORY_QUERY", "MRP_CALCULATION", "MATERIAL_BATCH_QUERY", "ALERT_LIST", None], "inventory_production"),
    ("物料需求", ["MRP_CALCULATION", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "MATERIAL_LOW_STOCK_ALERT", None], "inventory_production"),
    ("生产物料消耗", ["MATERIAL_BATCH_CONSUME", "REPORT_INVENTORY", "REPORT_PRODUCTION", "MATERIAL_BATCH_QUERY", None], "inventory_production"),

    # ===== 4. Equipment Quality (5 cases) =====
    ("设备对质量的影响", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "equipment_quality"),
    ("设备精度检查", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "EQUIPMENT_LIST", None], "equipment_quality"),
    ("设备校准", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_EXECUTE", None], "equipment_quality"),
    ("维修后质检", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", None], "equipment_quality"),
    ("设备合格证", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "QUALITY_CHECK_QUERY", None], "equipment_quality"),

    # ===== 5. HR Production (5 cases) =====
    ("工人产量排名", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "PROCESSING_BATCH_WORKERS", "HR_EMPLOYEE_LIST", None], "hr_production"),
    ("班组效率", ["REPORT_EFFICIENCY", "PROCESSING_BATCH_WORKERS", "REPORT_PRODUCTION", "ATTENDANCE_STATS", None], "hr_production"),
    ("人员利用率", ["REPORT_EFFICIENCY", "ATTENDANCE_STATS", "HR_EMPLOYEE_LIST", "REPORT_PRODUCTION", None], "hr_production"),
    ("技能匹配", ["HR_EMPLOYEE_LIST", "PROCESSING_BATCH_WORKERS", "REPORT_EFFICIENCY", None], "hr_production"),
    ("工时统计", ["ATTENDANCE_STATS", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", "HR_EMPLOYEE_LIST", None], "hr_production"),

    # ===== 6. Supply Chain (5 cases) =====
    ("供应链状况", ["SUPPLIER_LIST", "REPORT_DASHBOARD_OVERVIEW", "SUPPLIER_EVALUATE", "SHIPMENT_QUERY", None], "supply_chain"),
    ("采购到货", ["SHIPMENT_QUERY", "MATERIAL_BATCH_QUERY", "SUPPLIER_LIST", "SUPPLIER_EVALUATE", "MATERIAL_BATCH_CREATE", None], "supply_chain"),
    ("供应商交期", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", "SHIPMENT_QUERY", None], "supply_chain"),
    ("原料供应", ["MATERIAL_BATCH_QUERY", "SUPPLIER_LIST", "SUPPLIER_EVALUATE", "SHIPMENT_QUERY", None], "supply_chain"),
    ("供应风险", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", "REPORT_DASHBOARD_OVERVIEW", "SHIPMENT_QUERY", None], "supply_chain"),

    # ===== 7. Traceability Safety (5 cases) =====
    ("溯源查询", ["TRACE_BATCH", "TRACE_FULL", "TRACE_PUBLIC", "PROCESSING_BATCH_DETAIL", None], "traceability_safety"),
    ("批次追溯", ["TRACE_BATCH", "TRACE_FULL", "PROCESSING_BATCH_DETAIL", None], "traceability_safety"),
    ("产品追踪", ["TRACE_FULL", "TRACE_BATCH", "TRACE_PUBLIC", "PROCESSING_BATCH_DETAIL", None], "traceability_safety"),
    ("食品安全追溯", ["TRACE_PUBLIC", "TRACE_FULL", "TRACE_BATCH", "PROCESSING_BATCH_DETAIL", None], "traceability_safety"),
    ("全链路追踪", ["TRACE_FULL", "TRACE_BATCH", "TRACE_PUBLIC", "PROCESSING_BATCH_DETAIL", None], "traceability_safety"),

    # ===== 8. Alert Action (5 cases) =====
    ("处理告警", ["ALERT_RESOLVE", "ALERT_LIST", "ALERT_ACTIVE", "QUALITY_DISPOSITION_EXECUTE", "ALERT_ACKNOWLEDGE", None], "alert_action"),
    ("解决异常", ["ALERT_RESOLVE", "ALERT_LIST", "ALERT_ACTIVE", "QUALITY_DISPOSITION_EXECUTE", None], "alert_action"),
    ("消除预警", ["ALERT_RESOLVE", "ALERT_LIST", "ALERT_ACTIVE", None], "alert_action"),
    ("确认告警", ["ALERT_RESOLVE", "ALERT_ACTIVE", "ALERT_LIST", "ALERT_ACKNOWLEDGE", None], "alert_action"),
    ("关闭报警", ["ALERT_RESOLVE", "ALERT_LIST", "ALERT_ACTIVE", "QUALITY_DISPOSITION_EXECUTE", None], "alert_action"),

    # ===== 9. Report Export (5 cases) =====
    ("导出报表", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_FINANCE", "LABEL_PRINT", None], "report_export"),
    ("下载数据", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_FINANCE", None], "report_export"),
    ("打印报告", ["LABEL_PRINT", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_FINANCE", None], "report_export"),
    ("生成PDF", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_FINANCE", "LABEL_PRINT", None], "report_export"),
    ("邮件报表", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_FINANCE", None], "report_export"),

    # ===== 10. AI Analysis (5 cases) =====
    ("AI分析", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "COST_TREND_ANALYSIS", "REPORT_KPI", None], "ai_analysis"),
    ("智能建议", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "REPORT_KPI", "COST_TREND_ANALYSIS", None], "ai_analysis"),
    ("数据洞察", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "COST_TREND_ANALYSIS", None], "ai_analysis"),
    ("预测分析", ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "ai_analysis"),
    ("趋势预测", ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "ai_analysis"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 60 ===")
    print(f"Focus: CROSS-DOMAIN COMPREHENSIVE MIX (milestone)")
    print(f"       (production_quality, cost_efficiency, inventory_production, equipment_quality,")
    print(f"        hr_production, supply_chain, traceability_safety, alert_action, report_export, ai_analysis)")
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
        'test': 'v5_round60_cross_domain_comprehensive_mix',
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
    report_path = f'tests/ai-intent/reports/v5_round60_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
