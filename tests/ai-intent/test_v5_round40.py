#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 40
Focus: SEASONAL, INDUSTRY-SPECIFIC & DOMAIN KNOWLEDGE queries for food manufacturing.
       Covers seasonal production, food safety, cold chain, raw materials,
       production processes, regulatory, waste management, energy, and quality grades.
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

# Round 40 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Seasonal Production (6 cases) =====
    ("春节前备货计划", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", "MATERIAL_BATCH_QUERY", None], "seasonal_production"),
    ("夏季防腐措施", ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", None], "seasonal_production"),
    ("中秋月饼生产排期", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", None], "seasonal_production"),
    ("冬季取暖成本", ["REPORT_FINANCE", None], "seasonal_production"),
    ("节假日排班", ["ATTENDANCE_STATS", None], "seasonal_production"),
    ("旺季产能规划", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None], "seasonal_production"),

    # ===== 2. Food Safety Specific (6 cases) =====
    ("HACCP记录", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", None], "food_safety"),
    ("CCP点监控", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", None], "food_safety"),
    ("微生物检测结果", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_STATS", None], "food_safety"),
    ("农残检测", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_STATS", None], "food_safety"),
    ("重金属检测", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_STATS", None], "food_safety"),
    ("食品添加剂用量", ["QUALITY_CHECK_QUERY", "MATERIAL_BATCH_QUERY", None], "food_safety"),

    # ===== 3. Cold Chain (6 cases) =====
    ("冷库温度", ["COLD_CHAIN_TEMPERATURE", "COLD_CHAIN_ALERT", "EQUIPMENT_STATUS_QUERY", None], "cold_chain"),
    ("冷链运输记录", ["COLD_CHAIN_TEMPERATURE", "COLD_CHAIN_ALERT", "SHIPMENT_QUERY", None], "cold_chain"),
    ("断冷预警", ["COLD_CHAIN_ALERT", "ALERT_LIST", None], "cold_chain"),
    ("冷藏车温度", ["COLD_CHAIN_TEMPERATURE", "COLD_CHAIN_ALERT", "EQUIPMENT_STATUS_QUERY", None], "cold_chain"),
    ("解冻记录", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", None], "cold_chain"),
    ("冷链合规", ["COLD_CHAIN_TEMPERATURE", "COLD_CHAIN_ALERT", "FOOD_SAFETY_CERT_QUERY", None], "cold_chain"),

    # ===== 4. Raw Material (5 cases) =====
    ("原料产地溯源", ["MATERIAL_BATCH_QUERY", "SUPPLIER_QUERY", None], "raw_material"),
    ("供应商资质到期", ["SUPPLIER_QUERY", "SUPPLIER_EVALUATE", "FOOD_SAFETY_CERT_QUERY", "ALERT_LIST", None], "raw_material"),
    ("原料批次检验", ["MATERIAL_BATCH_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "raw_material"),
    ("进口原料报关", ["MATERIAL_BATCH_QUERY", "SUPPLIER_QUERY", None], "raw_material"),
    ("原料替代方案", ["MATERIAL_BATCH_QUERY", None], "raw_material"),

    # ===== 5. Production Process (6 cases) =====
    ("发酵温度控制", ["EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", "QUALITY_CHECK_QUERY", "COLD_CHAIN_TEMPERATURE", None], "production_process"),
    ("杀菌参数设置", ["EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", "QUALITY_CHECK_QUERY", None], "production_process"),
    ("配料比例调整", ["PRODUCTION_STATUS_QUERY", "MATERIAL_BATCH_QUERY", None], "production_process"),
    ("包装线速度", ["EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", None], "production_process"),
    ("灌装量校准", ["EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "production_process"),
    ("蒸煮时间", ["PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", None], "production_process"),

    # ===== 6. Regulatory (5 cases) =====
    ("GB标准检查", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", None], "regulatory"),
    ("出口检验检疫", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "regulatory"),
    ("有机认证审核", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_EXECUTE", None], "regulatory"),
    ("生产许可证更新", ["FOOD_SAFETY_CERT_QUERY", "PROCESSING_BATCH_LIST", None], "regulatory"),
    ("FDA合规检查", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "regulatory"),

    # ===== 7. Waste Management (5 cases) =====
    ("废料处理记录", ["REPORT_PRODUCTION", "QUALITY_CHECK_QUERY", None], "waste_management"),
    ("回收率统计", ["REPORT_PRODUCTION", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "waste_management"),
    ("边角料利用", ["REPORT_PRODUCTION", "MATERIAL_BATCH_QUERY", None], "waste_management"),
    ("废水排放达标", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "waste_management"),
    ("固废处理", ["QUALITY_DISPOSITION_EXECUTE", None], "waste_management"),

    # ===== 8. Energy (6 cases) =====
    ("能耗统计", ["REPORT_FINANCE", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "energy"),
    ("水电费分析", ["REPORT_FINANCE", "COST_TREND_ANALYSIS", None], "energy"),
    ("节能措施效果", ["REPORT_FINANCE", "REPORT_TRENDS", None], "energy"),
    ("碳排放统计", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "energy"),
    ("蒸汽使用量", ["EQUIPMENT_STATUS_QUERY", "REPORT_PRODUCTION", None], "energy"),
    ("压缩空气消耗", ["EQUIPMENT_STATUS_QUERY", "REPORT_PRODUCTION", None], "energy"),

    # ===== 9. Quality Grades (5 cases) =====
    ("产品分级标准", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", "ALERT_TRIAGE", None], "quality_grades"),
    ("等级评定结果", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", None], "quality_grades"),
    ("优等品比例", ["QUALITY_STATS", "REPORT_QUALITY", "QUALITY_CHECK_QUERY", None], "quality_grades"),
    ("次品原因分析", ["QUALITY_STATS", "REPORT_QUALITY", "QUALITY_CHECK_QUERY", "ALERT_DIAGNOSE", None], "quality_grades"),
    ("客户退货原因", ["QUALITY_STATS", "REPORT_QUALITY", None], "quality_grades"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 40 ===")
    print(f"Focus: SEASONAL, INDUSTRY-SPECIFIC & DOMAIN KNOWLEDGE queries")
    print(f"       for food manufacturing (cold chain, food safety, regulatory, etc.)")
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
        'test': 'v5_round40_seasonal_domain_specific',
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
    report_path = f'tests/ai-intent/reports/v5_round40_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
