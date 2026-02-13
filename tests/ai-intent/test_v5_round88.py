#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 88
Focus: CLEANING & SANITATION queries for food manufacturing.
       Covers cip_cleaning, sanitation_schedule, pest_control, hygiene_inspect,
       allergen_control, water_quality, air_quality, waste_disposal, surface_test.
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

# Round 88 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. CIP Cleaning (6 cases) =====
    ("查看CIP清洗记录", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "cip_cleaning"),
    ("今天在线清洗完成了吗", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "QUALITY_CHECK_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "cip_cleaning"),
    ("本周清洗记录导出", ["EQUIPMENT_MAINTENANCE", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "DATA_BATCH_DELETE", None], "cip_cleaning"),
    ("CIP清洗验证结果", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "cip_cleaning"),
    ("清洗周期是否需要调整", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "cip_cleaning"),
    ("清洗液浓度检测数据", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "MATERIAL_BATCH_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "cip_cleaning"),

    # ===== 2. Sanitation Schedule (5 cases) =====
    ("今天的卫生排班表", ["PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "sanitation_schedule"),
    ("本周清洁计划安排", ["PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "EQUIPMENT_MAINTENANCE", None], "sanitation_schedule"),
    ("消毒时间表查询", ["QUALITY_CHECK_QUERY", "PROCESSING_BATCH_LIST", "EQUIPMENT_MAINTENANCE", "REPORT_DASHBOARD_OVERVIEW", None], "sanitation_schedule"),
    ("下周卫生检查安排", ["QUALITY_CHECK_QUERY", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "sanitation_schedule"),
    ("各区域清洁频率统计", ["QUALITY_CHECK_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "sanitation_schedule"),

    # ===== 3. Pest Control (6 cases) =====
    ("虫害控制记录查询", ["QUALITY_CHECK_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "pest_control"),
    ("本月鼠害防治报告", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "ALERT_LIST", None], "pest_control"),
    ("灭蝇灯检查记录", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "pest_control"),
    ("最近的虫害记录有异常吗", ["QUALITY_CHECK_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "pest_control"),
    ("车间防虫措施执行情况", ["QUALITY_CHECK_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "ISAPI_CONFIG_FIELD_DETECTION", None], "pest_control"),
    ("虫害趋势分析报告", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "ALERT_LIST", "REPORT_TRENDS", None], "pest_control"),

    # ===== 4. Hygiene Inspection (5 cases) =====
    ("今天卫生检查结果", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "hygiene_inspect"),
    ("车间环境卫生评估", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "COLD_CHAIN_TEMPERATURE", None], "hygiene_inspect"),
    ("人员卫生检查合格率", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "hygiene_inspect"),
    ("各车间卫生得分排名", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "hygiene_inspect"),
    ("卫生评分低于80分的区域", ["QUALITY_CHECK_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "hygiene_inspect"),

    # ===== 5. Allergen Control (6 cases) =====
    ("过敏原管理清单查看", ["QUALITY_CHECK_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "allergen_control"),
    ("过敏原清洗是否完成", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "EQUIPMENT_MAINTENANCE", "REPORT_DASHBOARD_OVERVIEW", None], "allergen_control"),
    ("产品过敏原标识检查", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "allergen_control"),
    ("交叉接触风险评估报告", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "allergen_control"),
    ("过敏原检测最新结果", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "allergen_control"),
    ("过敏原声明更新状态", ["QUALITY_CHECK_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", "SHIPMENT_STATUS_UPDATE", None], "allergen_control"),

    # ===== 6. Water Quality (5 cases) =====
    ("今日水质检测报告", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "COLD_CHAIN_TEMPERATURE", "REPORT_DASHBOARD_OVERVIEW", None], "water_quality"),
    ("本月用水量统计", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", None], "water_quality"),
    ("水处理记录查询", ["QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "water_quality"),
    ("水质报告导出", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "water_quality"),
    ("废水处理达标情况", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "water_quality"),

    # ===== 7. Air Quality (6 cases) =====
    ("车间空气质量检测数据", ["QUALITY_CHECK_QUERY", "COLD_CHAIN_TEMPERATURE", "REPORT_DASHBOARD_OVERVIEW", None], "air_quality"),
    ("洁净区洁净度检查", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "COLD_CHAIN_TEMPERATURE", "REPORT_DASHBOARD_OVERVIEW", None], "air_quality"),
    ("微生物采样结果查询", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "air_quality"),
    ("空气过滤器更换记录", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "air_quality"),
    ("正压检查是否合格", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "air_quality"),
    ("落菌检测超标了吗", ["QUALITY_CHECK_QUERY", "ALERT_LIST", "COLD_CHAIN_TEMPERATURE", "REPORT_DASHBOARD_OVERVIEW", None], "air_quality"),

    # ===== 8. Waste Disposal (5 cases) =====
    ("废弃物处理记录查询", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "waste_disposal"),
    ("本月垃圾分类执行情况", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "waste_disposal"),
    ("危废处理台账", ["QUALITY_CHECK_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_DISPOSITION_EXECUTE", None], "waste_disposal"),
    ("废水排放数据查看", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "waste_disposal"),
    ("固废记录统计报表", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "waste_disposal"),

    # ===== 9. Surface Testing (6 cases) =====
    ("表面检测结果查询", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "surface_test"),
    ("ATP检测数据查看", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "surface_test"),
    ("涂抹检测合格率", ["QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "QUALITY_STATS", None], "surface_test"),
    ("清洗后洁净验证结果", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "EQUIPMENT_MAINTENANCE", "REPORT_DASHBOARD_OVERVIEW", None], "surface_test"),
    ("设备残留检测报告", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "surface_test"),
    ("微生物检测超标预警", ["QUALITY_CHECK_QUERY", "ALERT_LIST", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "surface_test"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 88 ===")
    print(f"Focus: CLEANING & SANITATION queries for food manufacturing")
    print(f"       (cip_cleaning, sanitation_schedule, pest_control, hygiene_inspect,")
    print(f"        allergen_control, water_quality, air_quality, waste_disposal, surface_test)")
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
        'test': 'v5_round88_cleaning_sanitation',
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
    report_path = f'tests/ai-intent/reports/v5_round88_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
