#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 75
Focus: PREDICTIVE & AI-DRIVEN queries for food manufacturing.
       Covers demand forecast, quality predict, maintenance predict,
       cost predict, optimization, anomaly detect, trend analysis,
       what-if scenarios, and smart alerts.
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

# Round 75 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Demand Forecast (6 cases) =====
    ("下个月需求预测", ["REPORT_TRENDS", "MRP_CALCULATION", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "demand_forecast"),
    ("预测下季度销量", ["REPORT_TRENDS", "MRP_CALCULATION", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "demand_forecast"),
    ("订单预测分析", ["REPORT_TRENDS", "MRP_CALCULATION", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "demand_forecast"),
    ("市场需求趋势", ["REPORT_TRENDS", "MRP_CALCULATION", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "demand_forecast"),
    ("预估下月销量多少", ["REPORT_TRENDS", "MRP_CALCULATION", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "demand_forecast"),
    ("需求规划报告", ["REPORT_TRENDS", "MRP_CALCULATION", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "demand_forecast"),

    # ===== 2. Quality Predict (6 cases) =====
    ("质量预测模型", ["REPORT_QUALITY", "QUALITY_STATS", "ALERT_LIST", "REPORT_TRENDS", "ALERT_DIAGNOSE", None], "quality_predict"),
    ("不良品率预测", ["REPORT_QUALITY", "QUALITY_STATS", "ALERT_LIST", "REPORT_TRENDS", "ALERT_DIAGNOSE", "QUALITY_CHECK_QUERY", None], "quality_predict"),
    ("质量风险预判", ["REPORT_QUALITY", "QUALITY_STATS", "ALERT_LIST", "REPORT_TRENDS", "ALERT_DIAGNOSE", None], "quality_predict"),
    ("质量预警分析", ["REPORT_QUALITY", "QUALITY_STATS", "ALERT_LIST", "REPORT_TRENDS", "ALERT_DIAGNOSE", None], "quality_predict"),
    ("缺陷趋势预测", ["REPORT_QUALITY", "QUALITY_STATS", "ALERT_LIST", "REPORT_TRENDS", "ALERT_DIAGNOSE", None], "quality_predict"),
    ("下月质量风险评估", ["REPORT_QUALITY", "QUALITY_STATS", "ALERT_LIST", "REPORT_TRENDS", "ALERT_DIAGNOSE", "QUALITY_DISPOSITION_EVALUATE", None], "quality_predict"),

    # ===== 3. Maintenance Predict (5 cases) =====
    ("预测性维护方案", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "ALERT_LIST", "ALERT_DIAGNOSE", None], "maintenance_predict"),
    ("设备故障预测", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "ALERT_LIST", "ALERT_DIAGNOSE", "EQUIPMENT_ALERT_LIST", None], "maintenance_predict"),
    ("设备剩余寿命预估", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "ALERT_LIST", "ALERT_DIAGNOSE", None], "maintenance_predict"),
    ("维护预警提示", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "ALERT_LIST", "ALERT_DIAGNOSE", None], "maintenance_predict"),
    ("预防性维修计划", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS", "ALERT_LIST", "ALERT_DIAGNOSE", None], "maintenance_predict"),

    # ===== 4. Cost Predict (6 cases) =====
    ("下季度成本预测", ["COST_TREND_ANALYSIS", "COST_QUERY", "REPORT_FINANCE", "REPORT_TRENDS", None], "cost_predict"),
    ("费用预估报告", ["COST_TREND_ANALYSIS", "COST_QUERY", "REPORT_FINANCE", "REPORT_TRENDS", None], "cost_predict"),
    ("预算预测分析", ["COST_TREND_ANALYSIS", "COST_QUERY", "REPORT_FINANCE", "REPORT_TRENDS", None], "cost_predict"),
    ("成本模拟计算", ["COST_TREND_ANALYSIS", "COST_QUERY", "REPORT_FINANCE", "REPORT_TRENDS", None], "cost_predict"),
    ("明年费用预算多少", ["COST_TREND_ANALYSIS", "COST_QUERY", "REPORT_FINANCE", "REPORT_TRENDS", None], "cost_predict"),
    ("投资回报率预测", ["COST_TREND_ANALYSIS", "COST_QUERY", "REPORT_FINANCE", "REPORT_TRENDS", None], "cost_predict"),

    # ===== 5. Optimization (5 cases) =====
    ("AI优化建议", ["REPORT_EFFICIENCY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "MRP_CALCULATION", None], "optimization"),
    ("产线改善方案", ["REPORT_EFFICIENCY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "MRP_CALCULATION", None], "optimization"),
    ("如何提升生产效率", ["REPORT_EFFICIENCY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "MRP_CALCULATION", None], "optimization"),
    ("流程优化分析", ["REPORT_EFFICIENCY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "MRP_CALCULATION", None], "optimization"),
    ("给出最优排产方案", ["REPORT_EFFICIENCY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "MRP_CALCULATION", "SCHEDULING_SET_MANUAL", None], "optimization"),

    # ===== 6. Anomaly Detect (6 cases) =====
    ("异常数据检测", ["ALERT_DIAGNOSE", "ALERT_LIST", "REPORT_ANOMALY", "REPORT_TRENDS", None], "anomaly_detect"),
    ("异常识别报告", ["ALERT_DIAGNOSE", "ALERT_LIST", "REPORT_ANOMALY", "REPORT_TRENDS", None], "anomaly_detect"),
    ("生产偏差检测", ["ALERT_DIAGNOSE", "ALERT_LIST", "REPORT_ANOMALY", "REPORT_TRENDS", None], "anomaly_detect"),
    ("找出离群点数据", ["ALERT_DIAGNOSE", "ALERT_LIST", "REPORT_ANOMALY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "anomaly_detect"),
    ("异常数据有哪些", ["ALERT_DIAGNOSE", "ALERT_LIST", "REPORT_ANOMALY", "REPORT_TRENDS", None], "anomaly_detect"),
    ("自动检测异常波动", ["ALERT_DIAGNOSE", "ALERT_LIST", "REPORT_ANOMALY", "REPORT_TRENDS", None], "anomaly_detect"),

    # ===== 7. Trend Analysis (5 cases) =====
    ("产量趋势分析", ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_DASHBOARD_OVERVIEW", None], "trend_analysis"),
    ("销售走势预判", ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_DASHBOARD_OVERVIEW", None], "trend_analysis"),
    ("数据趋势怎么样", ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_DASHBOARD_OVERVIEW", None], "trend_analysis"),
    ("找出变化规律", ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_DASHBOARD_OVERVIEW", None], "trend_analysis"),
    ("近半年增长趋势", ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_DASHBOARD_OVERVIEW", None], "trend_analysis"),

    # ===== 8. What-If (6 cases) =====
    ("假如增产20%会怎样", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", "MRP_CALCULATION", None], "what_if"),
    ("如果增加一条产线", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", "MRP_CALCULATION", "PROCESSING_BATCH_CREATE", None], "what_if"),
    ("模拟增产50%的影响", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", "MRP_CALCULATION", None], "what_if"),
    ("产能仿真分析", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", "MRP_CALCULATION", None], "what_if"),
    ("两个方案对比分析", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", "MRP_CALCULATION", None], "what_if"),
    ("扩产对成本的影响分析", ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", "MRP_CALCULATION", "COST_TREND_ANALYSIS", None], "what_if"),

    # ===== 9. Smart Alert (5 cases) =====
    ("智能预警设置", ["ALERT_LIST", "ALERT_ACTIVE", "ALERT_DIAGNOSE", "REPORT_DASHBOARD_OVERVIEW", None], "smart_alert"),
    ("AI告警有哪些", ["ALERT_LIST", "ALERT_ACTIVE", "ALERT_DIAGNOSE", "REPORT_DASHBOARD_OVERVIEW", None], "smart_alert"),
    ("自动预警规则", ["ALERT_LIST", "ALERT_ACTIVE", "ALERT_DIAGNOSE", "REPORT_DASHBOARD_OVERVIEW", "RULE_CONFIG", None], "smart_alert"),
    ("智能监控面板", ["ALERT_LIST", "ALERT_ACTIVE", "ALERT_DIAGNOSE", "REPORT_DASHBOARD_OVERVIEW", "ISAPI_QUERY_CAPABILITIES", None], "smart_alert"),
    ("AI巡检结果", ["ALERT_LIST", "ALERT_ACTIVE", "ALERT_DIAGNOSE", "REPORT_DASHBOARD_OVERVIEW", None], "smart_alert"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 75 ===")
    print(f"Focus: PREDICTIVE & AI-DRIVEN queries")
    print(f"       (demand forecast, quality predict, maintenance predict, cost predict,")
    print(f"        optimization, anomaly detect, trend analysis, what-if, smart alert)")
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
        'test': 'v5_round75_predictive_ai_driven',
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
    report_path = f'tests/ai-intent/reports/v5_round75_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
