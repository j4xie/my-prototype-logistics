#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 34
Focus: PRODUCTION PLANNING & SCHEDULING - production plans, capacity planning,
       scheduling, MRP, demand forecasting, line balancing, order scheduling,
       resource allocation, plan monitoring.
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

# Round 34 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Production Plans (6 cases) =====
    ("查一下现在的生产计划", ["PRODUCTION_PLAN_QUERY", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", None], "production_plans"),
    ("今天的生产任务有哪些", ["PRODUCTION_PLAN_QUERY", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", None], "production_plans"),
    ("明天排什么产品", ["PRODUCTION_PLAN_QUERY", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", None], "production_plans"),
    ("这周的生产计划安排", ["PRODUCTION_PLAN_QUERY", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_CREATE", "REPORT_PRODUCTION", None], "production_plans"),
    ("本月生产计划完成率怎么样", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "PRODUCTION_PLAN_QUERY", None], "production_plans"),
    ("生产计划需要调整吗", ["PRODUCTION_PLAN_QUERY", "PRODUCTION_STATUS_QUERY", "PLAN_UPDATE", "REPORT_PRODUCTION", None], "production_plans"),

    # ===== 2. Capacity Planning (5 cases) =====
    ("帮我做一下产能评估", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", None], "capacity_planning"),
    ("现在各条产线的可用产能是多少", ["PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", None], "capacity_planning"),
    ("产能瓶颈在哪里", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", None], "capacity_planning"),
    ("下个月要扩产，看看可行不", ["PRODUCTION_PLAN_QUERY", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", None], "capacity_planning"),
    ("各产线的产能利用率统计", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", None], "capacity_planning"),

    # ===== 3. Scheduling (6 cases) =====
    ("帮我排一下明天的生产排程", ["PRODUCTION_PLAN_QUERY", "PROCESSING_BATCH_CREATE", "PRODUCTION_STATUS_QUERY", None], "scheduling"),
    ("生产任务优先级怎么排", ["PRODUCTION_PLAN_QUERY", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", None], "scheduling"),
    ("有个紧急订单要插单", ["PROCESSING_BATCH_CREATE", "PRODUCTION_PLAN_QUERY", "ORDER_LIST", "ORDER_STATUS", None], "scheduling"),
    ("排产有冲突怎么处理", ["PRODUCTION_PLAN_QUERY", "PRODUCTION_STATUS_QUERY", None], "scheduling"),
    ("根据交期排一下生产顺序", ["PRODUCTION_PLAN_QUERY", "ORDER_LIST", "PROCESSING_BATCH_LIST", None], "scheduling"),
    ("排产方案能不能优化一下", ["PRODUCTION_PLAN_QUERY", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "SCHEDULING_SET_MANUAL", None], "scheduling"),

    # ===== 4. MRP/Material Planning (6 cases) =====
    ("物料需求计划帮我生成一下", ["MATERIAL_BATCH_QUERY", "MATERIAL_LOW_STOCK_ALERT", "MRP_CALCULATION", "PRODUCTION_PLAN_QUERY", None], "mrp"),
    ("查一下这个产品的BOM清单", ["MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_LIST", None], "mrp"),
    ("下周生产的物料齐套吗", ["MATERIAL_BATCH_QUERY", "MATERIAL_LOW_STOCK_ALERT", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", None], "mrp"),
    ("目前有哪些物料短缺", ["MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY", "REPORT_PRODUCTION", None], "mrp"),
    ("根据生产计划给一下采购建议", ["MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY", "MRP_CALCULATION", "PRODUCTION_PLAN_QUERY", None], "mrp"),
    ("安全库存水位检查一下", ["MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "REPORT_PRODUCTION", None], "mrp"),

    # ===== 5. Demand Forecasting (5 cases) =====
    ("帮我做一下下个月的需求预测", ["REPORT_TRENDS", "REPORT_PRODUCTION", "PRODUCTION_PLAN_QUERY", None], "demand_forecast"),
    ("根据历史数据预测一下订单量", ["REPORT_TRENDS", "ORDER_LIST", "REPORT_PRODUCTION", None], "demand_forecast"),
    ("旺季来了，季节性需求怎么分析", ["REPORT_TRENDS", "REPORT_PRODUCTION", None], "demand_forecast"),
    ("最近三个月的销量趋势怎么样", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "ORDER_LIST", None], "demand_forecast"),
    ("市场需求变化情况分析一下", ["REPORT_TRENDS", "REPORT_PRODUCTION", None], "demand_forecast"),

    # ===== 6. Line Balancing (5 cases) =====
    ("产线平衡率怎么样", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "line_balancing"),
    ("各工序的人员分配合理吗", ["ATTENDANCE_STATS", "REPORT_EFFICIENCY", "PROCESSING_WORKER_ASSIGN", "PRODUCTION_STATUS_QUERY", None], "line_balancing"),
    ("瓶颈工序是哪个环节", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", None], "line_balancing"),
    ("各工位节拍时间统计一下", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "line_balancing"),
    ("产线平衡率能到多少", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "line_balancing"),

    # ===== 7. Order Scheduling (6 cases) =====
    ("查一下订单排期情况", ["ORDER_LIST", "ORDER_STATUS", "PRODUCTION_PLAN_QUERY", None], "order_scheduling"),
    ("这批订单交期能保证吗", ["ORDER_LIST", "ORDER_STATUS", "PRODUCTION_STATUS_QUERY", None], "order_scheduling"),
    ("订单优先级怎么调整", ["ORDER_LIST", "ORDER_STATUS", "PRODUCTION_PLAN_QUERY", None], "order_scheduling"),
    ("有哪些延期订单", ["ORDER_LIST", "ORDER_STATUS", "REPORT_PRODUCTION", None], "order_scheduling"),
    ("客户紧急加单了怎么插进去", ["ORDER_LIST", "PROCESSING_BATCH_CREATE", "PRODUCTION_PLAN_QUERY", None], "order_scheduling"),
    ("这个大订单能不能分批生产", ["ORDER_LIST", "PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", "PRODUCTION_PLAN_QUERY", None], "order_scheduling"),

    # ===== 8. Resource Allocation (5 cases) =====
    ("各车间的资源分配情况", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "ATTENDANCE_STATS", None], "resource_allocation"),
    ("人员怎么调配比较合理", ["ATTENDANCE_STATS", "REPORT_EFFICIENCY", "PROCESSING_WORKER_ASSIGN", "PRODUCTION_STATUS_QUERY", None], "resource_allocation"),
    ("设备分配到哪条线了", ["EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None], "resource_allocation"),
    ("模具排程安排查一下", ["EQUIPMENT_STATUS_QUERY", "PRODUCTION_PLAN_QUERY", "PRODUCTION_STATUS_QUERY", None], "resource_allocation"),
    ("工装夹具准备好了吗", ["EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", "MATERIAL_BATCH_QUERY", None], "resource_allocation"),

    # ===== 9. Plan Monitoring (6 cases) =====
    ("今天的生产计划执行到哪了", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", None], "plan_monitoring"),
    ("各批次的生产进度跟踪一下", ["PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None], "plan_monitoring"),
    ("计划和实际产量偏差多少", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_EFFICIENCY", None], "plan_monitoring"),
    ("这个月的计划达成率是多少", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", None], "plan_monitoring"),
    ("有没有可能延误的生产任务", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", None], "plan_monitoring"),
    ("今天各条线的产出情况跟踪", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", None], "plan_monitoring"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 34 ===")
    print(f"Focus: PRODUCTION PLANNING & SCHEDULING - production plans, capacity planning,")
    print(f"       scheduling, MRP, demand forecasting, line balancing, order scheduling,")
    print(f"       resource allocation, plan monitoring")
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
        'test': 'v5_round34_production_planning_scheduling',
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
    report_path = f'tests/ai-intent/reports/v5_round34_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
