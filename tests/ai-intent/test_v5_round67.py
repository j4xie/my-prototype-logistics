#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 67
Focus: SCHEDULING & PLANNING DETAIL queries for food manufacturing.
       Covers production plan, capacity plan, MRP, shift schedule,
       task assign, priority, resource allocation, progress tracking, and bottleneck.
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

# Round 67 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Production Plan (6 cases) =====
    ("查看本周生产计划", ["PLAN_UPDATE", "SCHEDULING_SET_MANUAL", "PROCESSING_BATCH_CREATE", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", None], "production_plan"),
    ("明天的排产安排是什么", ["SCHEDULING_SET_MANUAL", "PLAN_UPDATE", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_CREATE", None], "production_plan"),
    ("下周生产排程", ["SCHEDULING_SET_MANUAL", "PLAN_UPDATE", "PROCESSING_BATCH_CREATE", "PRODUCTION_STATUS_QUERY", None], "production_plan"),
    ("本月产能计划汇总", ["PLAN_UPDATE", "PRODUCTION_STATUS_QUERY", "SCHEDULING_SET_MANUAL", "REPORT_EFFICIENCY", None], "production_plan"),
    ("周生产计划还没排", ["PLAN_UPDATE", "SCHEDULING_SET_MANUAL", "PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", None], "production_plan"),
    ("今天日排产情况", ["PRODUCTION_STATUS_QUERY", "SCHEDULING_SET_MANUAL", "PLAN_UPDATE", None], "production_plan"),

    # ===== 2. Capacity Plan (6 cases) =====
    ("产能评估报告", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "EQUIPMENT_STATS", "PRODUCTION_STATUS_QUERY", None], "capacity_plan"),
    ("目前产能利用率多少", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "capacity_plan"),
    ("产能瓶颈在哪条线", ["REPORT_EFFICIENCY", "EQUIPMENT_STATS", "REPORT_PRODUCTION", None], "capacity_plan"),
    ("设备负荷分析", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "REPORT_PRODUCTION", None], "capacity_plan"),
    ("哪条产线有产能富余", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "EQUIPMENT_STATS", "PRODUCTION_STATUS_QUERY", None], "capacity_plan"),
    ("产能不足怎么调整", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "EQUIPMENT_STATS", "PRODUCTION_STATUS_QUERY", None], "capacity_plan"),

    # ===== 3. MRP (5 cases) =====
    ("物料需求计划生成", ["MRP_CALCULATION", "MATERIAL_LOW_STOCK_ALERT", "REPORT_INVENTORY", "INVENTORY_QUERY", None], "mrp"),
    ("运行MRP运算", ["MRP_CALCULATION", "REPORT_INVENTORY", "INVENTORY_QUERY", None], "mrp"),
    ("下月需求预测", ["MRP_CALCULATION", "REPORT_INVENTORY", "INVENTORY_QUERY", None], "mrp"),
    ("原材料物料计划", ["MRP_CALCULATION", "MATERIAL_LOW_STOCK_ALERT", "INVENTORY_QUERY", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", None], "mrp"),
    ("采购需求汇总", ["MRP_CALCULATION", "MATERIAL_LOW_STOCK_ALERT", "REPORT_INVENTORY", "INVENTORY_QUERY", None], "mrp"),

    # ===== 4. Shift Schedule (6 cases) =====
    ("查看排班表", ["SCHEDULING_SET_MANUAL", "ATTENDANCE_STATS", "ATTENDANCE_TODAY", "ATTENDANCE_HISTORY", None], "shift_schedule"),
    ("三班倒班安排", ["SCHEDULING_SET_MANUAL", "ATTENDANCE_STATS", "ATTENDANCE_TODAY", None], "shift_schedule"),
    ("调整明天班次", ["SCHEDULING_SET_MANUAL", "ATTENDANCE_STATS", None], "shift_schedule"),
    ("加班安排通知", ["SCHEDULING_SET_MANUAL", "ATTENDANCE_STATS", "ATTENDANCE_TODAY", "FACTORY_NOTIFICATION_CONFIG", None], "shift_schedule"),
    ("本周值班表", ["SCHEDULING_SET_MANUAL", "ATTENDANCE_STATS", "ATTENDANCE_TODAY", None], "shift_schedule"),
    ("下月轮班计划", ["SCHEDULING_SET_MANUAL", "ATTENDANCE_STATS", "ATTENDANCE_TODAY", None], "shift_schedule"),

    # ===== 5. Task Assign (5 cases) =====
    ("任务分配给谁了", ["PROCESSING_BATCH_WORKERS", "PROCESSING_BATCH_CREATE", "SCHEDULING_SET_MANUAL", None], "task_assign"),
    ("新工单派发到车间", ["PROCESSING_BATCH_CREATE", "SCHEDULING_SET_MANUAL", "PROCESSING_BATCH_WORKERS", None], "task_assign"),
    ("给张三分配人员", ["PROCESSING_BATCH_WORKERS", "SCHEDULING_SET_MANUAL", None], "task_assign"),
    ("指派任务给二号线", ["SCHEDULING_SET_MANUAL", "PROCESSING_BATCH_WORKERS", "PROCESSING_BATCH_CREATE", "PROCESSING_WORKER_ASSIGN", None], "task_assign"),
    ("今天的工作安排", ["SCHEDULING_SET_MANUAL", "PROCESSING_BATCH_WORKERS", "PROCESSING_BATCH_CREATE", "TASK_ASSIGN_EMPLOYEE", None], "task_assign"),

    # ===== 6. Priority (6 cases) =====
    ("工单优先级排序", ["PLAN_UPDATE", "PROCESSING_BATCH_CREATE", "ORDER_UPDATE", "ORDER_LIST", None], "priority"),
    ("有个紧急任务插进来", ["PLAN_UPDATE", "PROCESSING_BATCH_CREATE", "ORDER_UPDATE", None], "priority"),
    ("插单处理流程", ["PLAN_UPDATE", "PROCESSING_BATCH_CREATE", "ORDER_UPDATE", "ORDER_LIST", None], "priority"),
    ("这批货优先生产", ["PROCESSING_BATCH_CREATE", "PLAN_UPDATE", "ORDER_UPDATE", "MATERIAL_FIFO_RECOMMEND", None], "priority"),
    ("客户加急订单", ["ORDER_UPDATE", "ORDER_LIST", "PLAN_UPDATE", "PROCESSING_BATCH_CREATE", "CUSTOMER_PURCHASE_HISTORY", None], "priority"),
    ("调整优先级到最高", ["PLAN_UPDATE", "ORDER_UPDATE", "PROCESSING_BATCH_CREATE", "ORDER_LIST", None], "priority"),

    # ===== 7. Resource Allocation (5 cases) =====
    ("资源分配方案", ["SCHEDULING_SET_MANUAL", "PROCESSING_BATCH_WORKERS", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "resource_alloc"),
    ("设备调度安排", ["SCHEDULING_SET_MANUAL", "EQUIPMENT_STATUS_QUERY", "PROCESSING_BATCH_WORKERS", None], "resource_alloc"),
    ("人员调配到一号线", ["PROCESSING_BATCH_WORKERS", "SCHEDULING_SET_MANUAL", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_WORKER_ASSIGN", None], "resource_alloc"),
    ("产线分配调整", ["SCHEDULING_SET_MANUAL", "PROCESSING_BATCH_WORKERS", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "resource_alloc"),
    ("工装安排确认", ["SCHEDULING_SET_MANUAL", "EQUIPMENT_STATUS_QUERY", "PROCESSING_BATCH_WORKERS", "REPORT_DASHBOARD_OVERVIEW", None], "resource_alloc"),

    # ===== 8. Progress Tracking (6 cases) =====
    ("生产进度追踪", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", "REPORT_KPI", None], "progress_track"),
    ("今天完成进度多少", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_KPI", "PROCESSING_BATCH_LIST", None], "progress_track"),
    ("各车间任务进展", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", None], "progress_track"),
    ("本月计划执行率", ["REPORT_KPI", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", None], "progress_track"),
    ("在制品生产进度", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", "REPORT_KPI", None], "progress_track"),
    ("工单完成度统计", ["PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_KPI", None], "progress_track"),

    # ===== 9. Bottleneck (5 cases) =====
    ("瓶颈分析报告", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "EQUIPMENT_STATS", "REPORT_TRENDS", None], "bottleneck"),
    ("产能瓶颈在哪里", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "EQUIPMENT_STATS", None], "bottleneck"),
    ("哪个工序效率低下", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "EQUIPMENT_STATS", "REPORT_TRENDS", None], "bottleneck"),
    ("工序间等待时间太长", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "EQUIPMENT_STATS", "REPORT_TRENDS", None], "bottleneck"),
    ("各工序排队情况", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "EQUIPMENT_STATS", "REPORT_TRENDS", None], "bottleneck"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 67 ===")
    print(f"Focus: SCHEDULING & PLANNING DETAIL queries")
    print(f"       (production plan, capacity plan, MRP, shift schedule, task assign,")
    print(f"        priority, resource alloc, progress tracking, bottleneck)")
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
        'test': 'v5_round67_scheduling_planning',
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
    report_path = f'tests/ai-intent/reports/v5_round67_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
