#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 94
Focus: MAINTENANCE & TPM queries for food manufacturing.
       Covers preventive, corrective, spare_parts, work_order,
       mtbf_mttr, lubrication, condition_monitor, maintenance_cost, and tpm_metrics.
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

# Round 94 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Preventive Maintenance (6 cases) =====
    ("预防性维护计划", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "EQUIPMENT_DETAIL", "EQUIPMENT_STATS", None], "preventive"),
    ("保养计划查询", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "EQUIPMENT_DETAIL", "REPORT_DASHBOARD_OVERVIEW", None], "preventive"),
    ("定期保养提醒", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "ALERT_LIST", None], "preventive"),
    ("PM计划执行情况", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "REPORT_PRODUCTION", "PLAN_UPDATE", None], "preventive"),
    ("维护提醒到期设备", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "ALERT_LIST", "EQUIPMENT_LIST", None], "preventive"),
    ("保养到期未执行", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "ALERT_LIST", "EQUIPMENT_LIST", None], "preventive"),

    # ===== 2. Corrective Maintenance (5 cases) =====
    ("故障维修记录", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", "EQUIPMENT_LIST", None], "corrective"),
    ("紧急维修申请", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "ALERT_LIST", None], "corrective"),
    ("维修工单列表", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "EQUIPMENT_DETAIL", None], "corrective"),
    ("查看维修记录", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", "EQUIPMENT_LIST", None], "corrective"),
    ("维修进度跟踪", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", "REPORT_DASHBOARD_OVERVIEW", None], "corrective"),

    # ===== 3. Spare Parts (6 cases) =====
    ("备件管理", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_DETAIL", "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", None], "spare_parts"),
    ("备件库存查询", ["INVENTORY_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_DETAIL", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", None], "spare_parts"),
    ("备件申购审批", ["EQUIPMENT_MAINTENANCE", "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "spare_parts"),
    ("备件使用记录", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_DETAIL", "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", None], "spare_parts"),
    ("备件到货入库", ["INVENTORY_QUERY", "EQUIPMENT_MAINTENANCE", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_CREATE", None], "spare_parts"),
    ("备件消耗统计", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "INVENTORY_QUERY", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "spare_parts"),

    # ===== 4. Work Order (5 cases) =====
    ("工单管理", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "work_order"),
    ("创建维修工单", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", None], "work_order"),
    ("工单分配给张师傅", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "TASK_ASSIGN_EMPLOYEE", None], "work_order"),
    ("工单完成确认", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_LIST", None], "work_order"),
    ("工单统计分析", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", None], "work_order"),

    # ===== 5. MTBF/MTTR (6 cases) =====
    ("MTBF分析报告", ["EQUIPMENT_STATS", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "mtbf_mttr"),
    ("MTTR统计数据", ["EQUIPMENT_STATS", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "mtbf_mttr"),
    ("故障频率分析", ["EQUIPMENT_STATS", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "ALERT_LIST", "REPORT_TRENDS", None], "mtbf_mttr"),
    ("平均修复时间统计", ["EQUIPMENT_STATS", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "mtbf_mttr"),
    ("故障间隔时间", ["EQUIPMENT_STATS", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "mtbf_mttr"),
    ("设备可靠性分析", ["EQUIPMENT_STATS", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "mtbf_mttr"),

    # ===== 6. Lubrication (5 cases) =====
    ("润滑管理计划", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", "EQUIPMENT_LIST", None], "lubrication"),
    ("加油记录查询", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_HISTORY", None], "lubrication"),
    ("润滑计划执行", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", "REPORT_DASHBOARD_OVERVIEW", None], "lubrication"),
    ("润滑油更换记录", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", "INVENTORY_QUERY", None], "lubrication"),
    ("油品管理台账", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "lubrication"),

    # ===== 7. Condition Monitoring (6 cases) =====
    ("设备状态监测", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_DETAIL", "EQUIPMENT_LIST", None], "condition_monitor"),
    ("振动监测数据", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_DETAIL", "COLD_CHAIN_TEMPERATURE", "REPORT_DASHBOARD_OVERVIEW", None], "condition_monitor"),
    ("温度监测异常", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_ALERT_LIST", "ALERT_LIST", None], "condition_monitor"),
    ("电流监测报警", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_ALERT_LIST", "ALERT_LIST", "COLD_CHAIN_TEMPERATURE", None], "condition_monitor"),
    ("噪音检测超标", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_ALERT_LIST", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "condition_monitor"),
    ("在线监测系统", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_LIST", "EQUIPMENT_DETAIL", "REPORT_DASHBOARD_OVERVIEW", None], "condition_monitor"),

    # ===== 8. Maintenance Cost (5 cases) =====
    ("维修费用统计", ["COST_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "maintenance_cost"),
    ("维修预算执行情况", ["COST_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None], "maintenance_cost"),
    ("备件成本分析", ["COST_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", "COST_TREND_ANALYSIS", None], "maintenance_cost"),
    ("维修成本趋势", ["COST_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "maintenance_cost"),
    ("维修ROI评估", ["COST_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "maintenance_cost"),

    # ===== 9. TPM Metrics (6 cases) =====
    ("TPM推进情况", ["EQUIPMENT_STATS", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "tpm_metrics"),
    ("自主保全活动", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "tpm_metrics"),
    ("设备综合效率OEE", ["EQUIPMENT_STATS", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", None], "tpm_metrics"),
    ("零故障目标达成", ["EQUIPMENT_STATS", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "tpm_metrics"),
    ("改善提案提交", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", "PLAN_UPDATE", None], "tpm_metrics"),
    ("技能矩阵评估", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", None], "tpm_metrics"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 94 ===")
    print(f"Focus: MAINTENANCE & TPM queries")
    print(f"       (preventive, corrective, spare_parts, work_order,")
    print(f"        mtbf_mttr, lubrication, condition_monitor, maintenance_cost, tpm_metrics)")
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
        'test': 'v5_round94_maintenance_tpm',
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
    report_path = f'tests/ai-intent/reports/v5_round94_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
