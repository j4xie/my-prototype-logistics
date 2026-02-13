#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 55
Focus: REPORTING & ANALYTICS DETAIL queries.
       Covers daily/weekly/monthly reports, custom reports, trend reports,
       comparison analytics, export/share, real-time data, deep analysis.
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

# Round 55 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Daily Reports (6 cases) =====
    ("今日生产日报",
     ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None],
     "daily_reports"),
    ("质量日报",
     ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", None],
     "daily_reports"),
    ("库存日报",
     ["REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None],
     "daily_reports"),
    ("设备运行日报",
     ["REPORT_EQUIPMENT", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", None],
     "daily_reports"),
    ("出勤日报",
     ["ATTENDANCE_STATS", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None],
     "daily_reports"),
    ("综合日报",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_KPI", None],
     "daily_reports"),

    # ===== 2. Weekly Reports (5 cases) =====
    ("本周报表",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_KPI", None],
     "weekly_reports"),
    ("周产量汇总",
     ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None],
     "weekly_reports"),
    ("周质量报告",
     ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW", None],
     "weekly_reports"),
    ("周库存盘点",
     ["REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None],
     "weekly_reports"),
    ("周度KPI",
     ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None],
     "weekly_reports"),

    # ===== 3. Monthly Reports (6 cases) =====
    ("月度经营报告",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_FINANCE", "REPORT_KPI", None],
     "monthly_reports"),
    ("月产量报表",
     ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None],
     "monthly_reports"),
    ("月质量报告",
     ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW", None],
     "monthly_reports"),
    ("月度成本分析",
     ["REPORT_FINANCE", "COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_DASHBOARD_OVERVIEW", None],
     "monthly_reports"),
    ("月度财务",
     ["REPORT_FINANCE", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None],
     "monthly_reports"),
    ("月度盘点",
     ["REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None],
     "monthly_reports"),

    # ===== 4. Custom Reports (6 cases) =====
    ("自定义报表",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_KPI", None],
     "custom_reports"),
    ("按条件查询",
     ["REPORT_DASHBOARD_OVERVIEW", "CONDITION_SWITCH", None],
     "custom_reports"),
    ("指定时间段",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None],
     "custom_reports"),
    ("按产品线筛选",
     ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None],
     "custom_reports"),
    ("分组统计",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None],
     "custom_reports"),
    ("多维度分析",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "REPORT_TRENDS", None],
     "custom_reports"),

    # ===== 5. Trend Reports (5 cases) =====
    ("产量趋势",
     ["REPORT_TRENDS", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "COST_TREND_ANALYSIS", None],
     "trend_reports"),
    ("质量趋势图",
     ["REPORT_TRENDS", "REPORT_QUALITY", "QUALITY_STATS", "QUALITY_CHECK_QUERY", None],
     "trend_reports"),
    ("成本变化趋势",
     ["COST_TREND_ANALYSIS", "REPORT_TRENDS", "REPORT_FINANCE", "COST_QUERY", None],
     "trend_reports"),
    ("效率趋势",
     ["REPORT_TRENDS", "REPORT_EFFICIENCY", "REPORT_KPI", None],
     "trend_reports"),
    ("销售趋势",
     ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None],
     "trend_reports"),

    # ===== 6. Comparison (6 cases) =====
    ("同比分析",
     ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None],
     "comparison"),
    ("环比数据",
     ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_DASHBOARD_OVERVIEW", None],
     "comparison"),
    ("与目标对比",
     ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None],
     "comparison"),
    ("部门间对比",
     ["REPORT_EFFICIENCY", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "ATTENDANCE_STATS", "REPORT_TRENDS", None],
     "comparison"),
    ("产品间对比",
     ["REPORT_PRODUCTION", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", None],
     "comparison"),
    ("供应商对比",
     ["REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", None],
     "comparison"),

    # ===== 7. Export/Share (5 cases) =====
    ("导出PDF",
     ["REPORT_DASHBOARD_OVERVIEW", None],
     "export_share"),
    ("生成Excel",
     ["REPORT_DASHBOARD_OVERVIEW", None],
     "export_share"),
    ("发送报表",
     ["REPORT_DASHBOARD_OVERVIEW", None],
     "export_share"),
    ("打印报表",
     ["REPORT_DASHBOARD_OVERVIEW", None],
     "export_share"),
    ("分享数据",
     ["REPORT_DASHBOARD_OVERVIEW", None],
     "export_share"),

    # ===== 8. Real-time (6 cases) =====
    ("实时数据",
     ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None],
     "realtime"),
    ("即时统计",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "PRODUCTION_STATUS_QUERY", None],
     "realtime"),
    ("当前状态",
     ["PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None],
     "realtime"),
    ("今日实时",
     ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "ALERT_ACTIVE", None],
     "realtime"),
    ("动态数据",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "PRODUCTION_STATUS_QUERY", None],
     "realtime"),
    ("在线监控",
     ["EQUIPMENT_STATS", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None],
     "realtime"),

    # ===== 9. Analysis (5 cases) =====
    ("深度分析",
     ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "REPORT_TRENDS", None],
     "analysis"),
    ("根因分析",
     ["ALERT_DIAGNOSE", "REPORT_TRENDS", "QUALITY_STATS", None],
     "analysis"),
    ("关联分析",
     ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None],
     "analysis"),
    ("预测分析",
     ["REPORT_TRENDS", "COST_TREND_ANALYSIS", "REPORT_DASHBOARD_OVERVIEW", None],
     "analysis"),
    ("异常分析",
     ["ALERT_DIAGNOSE", "ALERT_LIST", "REPORT_TRENDS", "QUALITY_STATS", "REPORT_ANOMALY", None],
     "analysis"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 55 ===")
    print(f"Focus: REPORTING & ANALYTICS DETAIL queries")
    print(f"       (daily, weekly, monthly, custom, trend, comparison,")
    print(f"        export/share, real-time, analysis)")
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
        'test': 'v5_round55_reporting_analytics_detail',
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
    report_path = f'tests/ai-intent/reports/v5_round55_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
