#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 83
Focus: MULTI-FACTORY & CENTRALIZED MANAGEMENT queries.
       Covers factory_compare, central_dashboard, factory_config,
       data_consolidation, resource_sharing, standard_sync,
       perf_ranking, audit_central, supply_network.
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

# Round 83 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Factory Compare (6 cases) =====
    ("工厂对比分析", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_TRENDS", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "factory_compare"),
    ("各厂产量对比", ["REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_KPI", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "factory_compare"),
    ("工厂排名", ["REPORT_KPI", "REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "factory_compare"),
    ("各厂效率对比", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "REPORT_KPI", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "factory_compare"),
    ("跨厂分析报告", ["REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "factory_compare"),
    ("工厂绩效评估", ["REPORT_KPI", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "factory_compare"),

    # ===== 2. Central Dashboard (5 cases) =====
    ("集团总览", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_KPI", None], "central_dashboard"),
    ("全局仪表盘", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "REPORT_PRODUCTION", None], "central_dashboard"),
    ("总部看板数据", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "REPORT_PRODUCTION", "REPORT_TRENDS", None], "central_dashboard"),
    ("集团报表汇总", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_FINANCE", "REPORT_KPI", None], "central_dashboard"),
    ("集团统计数据", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "REPORT_PRODUCTION", "REPORT_TRENDS", None], "central_dashboard"),

    # ===== 3. Factory Config (6 cases) =====
    ("工厂配置信息", ["FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "factory_config"),
    ("新建工厂", ["FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_CREATE", None], "factory_config"),
    ("工厂信息修改", ["FACTORY_NOTIFICATION_CONFIG", "REPORT_DASHBOARD_OVERVIEW", None], "factory_config"),
    ("工厂参数设置", ["FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "factory_config"),
    ("产线配置管理", ["FACTORY_NOTIFICATION_CONFIG", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "factory_config"),
    ("车间设置调整", ["FACTORY_NOTIFICATION_CONFIG", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "factory_config"),

    # ===== 4. Data Consolidation (5 cases) =====
    ("数据汇总报表", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_KPI", "REPORT_TRENDS", None], "data_consolidation"),
    ("合并报表生成", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_FINANCE", "REPORT_PRODUCTION", None], "data_consolidation"),
    ("统一报告导出", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_KPI", None], "data_consolidation"),
    ("数据归集分析", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "REPORT_KPI", "REPORT_PRODUCTION", None], "data_consolidation"),
    ("综合分析报告", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_KPI", None], "data_consolidation"),

    # ===== 5. Resource Sharing (6 cases) =====
    ("资源调配方案", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "resource_sharing"),
    ("跨厂调拨申请", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "SHIPMENT_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "resource_sharing"),
    ("物料共享查询", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "resource_sharing"),
    ("设备借调管理", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", "REPORT_DASHBOARD_OVERVIEW", None], "resource_sharing"),
    ("人员调配计划", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_WORKER_ASSIGN", None], "resource_sharing"),
    ("产能调度优化", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "resource_sharing"),

    # ===== 6. Standard Sync (5 cases) =====
    ("标准同步状态", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "standard_sync"),
    ("统一标准管理", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "standard_sync"),
    ("质量标准下发", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "standard_sync"),
    ("工艺标准推送", ["QUALITY_CHECK_QUERY", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "standard_sync"),
    ("制度统一执行", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "standard_sync"),

    # ===== 7. Perf Ranking (6 cases) =====
    ("绩效排名查看", ["REPORT_KPI", "REPORT_EFFICIENCY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "perf_ranking"),
    ("KPI对比分析", ["REPORT_KPI", "REPORT_TRENDS", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "perf_ranking"),
    ("产能排行榜", ["REPORT_PRODUCTION", "REPORT_KPI", "REPORT_TRENDS", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "perf_ranking"),
    ("质量排名报告", ["QUALITY_CHECK_QUERY", "REPORT_KPI", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_QUALITY", None], "perf_ranking"),
    ("效率排名分析", ["REPORT_EFFICIENCY", "REPORT_KPI", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "perf_ranking"),
    ("成本排名对比", ["REPORT_FINANCE", "REPORT_KPI", "REPORT_TRENDS", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "perf_ranking"),

    # ===== 8. Audit Central (5 cases) =====
    ("集中审计报告", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "QUALITY_CHECK_QUERY", None], "audit_central"),
    ("合规检查状态", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "audit_central"),
    ("统一审批流程", ["REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", None], "audit_central"),
    ("集团巡检安排", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "audit_central"),
    ("远程审核记录", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "audit_central"),

    # ===== 9. Supply Network (6 cases) =====
    ("供应链网络总览", ["SUPPLIER_LIST", "INVENTORY_QUERY", "SHIPMENT_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "supply_network"),
    ("物流协同管理", ["SHIPMENT_QUERY", "SUPPLIER_LIST", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "supply_network"),
    ("配送优化方案", ["SHIPMENT_QUERY", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", "SHIPMENT_UPDATE", None], "supply_network"),
    ("多仓管理查询", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "supply_network"),
    ("区域配送分析", ["SHIPMENT_QUERY", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "supply_network"),
    ("中心仓管理状态", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "SHIPMENT_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "supply_network"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 83 ===")
    print(f"Focus: MULTI-FACTORY & CENTRALIZED MANAGEMENT")
    print(f"       (factory_compare, central_dashboard, factory_config, data_consolidation,")
    print(f"        resource_sharing, standard_sync, perf_ranking, audit_central, supply_network)")
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
        'test': 'v5_round83_multi_factory_centralized_management',
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
    report_path = f'tests/ai-intent/reports/v5_round83_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
