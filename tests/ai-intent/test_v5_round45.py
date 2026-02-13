#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 45
Focus: QUALITY INSPECTION DETAIL queries.
       Covers incoming QC, in-process QC, final QC, test methods,
       non-conformance, quality analysis, quality certs, customer quality,
       and quality improvement.
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

# Round 45 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Incoming QC (6 cases) =====
    ("来料检验", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "QUALITY_CHECK_EXECUTE", "MATERIAL_BATCH_QUERY", None], "incoming_qc"),
    ("原料检测", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "MATERIAL_BATCH_QUERY", None], "incoming_qc"),
    ("进货检验", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "MATERIAL_BATCH_QUERY", None], "incoming_qc"),
    ("来料合格率", ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "incoming_qc"),
    ("供应商来料质量", ["SUPPLIER_EVALUATE", "QUALITY_STATS", "QUALITY_CHECK_QUERY", None], "incoming_qc"),
    ("IQC检验", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_LIST", None], "incoming_qc"),

    # ===== 2. In-Process QC (6 cases) =====
    ("过程检验", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_LIST", None], "inprocess_qc"),
    ("巡检记录", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", None], "inprocess_qc"),
    ("工序检验", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "inprocess_qc"),
    ("首件检验", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "inprocess_qc"),
    ("在线检测", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "inprocess_qc"),
    ("IPQC结果", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "QUALITY_STATS", None], "inprocess_qc"),

    # ===== 3. Final QC (6 cases) =====
    ("成品检验", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_LIST", None], "final_qc"),
    ("出厂检验", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "FOOD_SAFETY_CERT_QUERY", None], "final_qc"),
    ("最终检验结果", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "QUALITY_STATS", None], "final_qc"),
    ("OQC报告", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "QUALITY_CHECK_LIST", None], "final_qc"),
    ("发货前检查", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "final_qc"),
    ("合格判定", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_DISPOSITION_EXECUTE", None], "final_qc"),

    # ===== 4. Test Methods (5 cases) =====
    ("检验方法", ["QUALITY_CHECK_QUERY", None], "test_methods"),
    ("检测标准", ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", None], "test_methods"),
    ("抽样方案", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_STATS", None], "test_methods"),
    ("AQL标准", ["QUALITY_CHECK_QUERY", None], "test_methods"),
    ("检验规程", ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", None], "test_methods"),

    # ===== 5. Non-Conformance (6 cases) =====
    ("不合格品", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "QUALITY_STATS", None], "non_conformance"),
    ("缺陷类型", ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "non_conformance"),
    ("不良原因", ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "ALERT_DIAGNOSE", None], "non_conformance"),
    ("返工处理", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_EXECUTE", None], "non_conformance"),
    ("让步接收", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_EXECUTE", None], "non_conformance"),
    ("报废处理", ["QUALITY_DISPOSITION_EXECUTE", None], "non_conformance"),

    # ===== 6. Quality Analysis (6 cases) =====
    ("质量分析报告", ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "quality_analysis"),
    ("SPC控制图", ["QUALITY_STATS", "REPORT_QUALITY", "REPORT_TRENDS", None], "quality_analysis"),
    ("质量趋势", ["REPORT_TRENDS", "QUALITY_STATS", "REPORT_QUALITY", "QUALITY_CHECK_QUERY", None], "quality_analysis"),
    ("不良趋势", ["REPORT_TRENDS", "QUALITY_STATS", "REPORT_QUALITY", None], "quality_analysis"),
    ("帕累托分析", ["QUALITY_STATS", "REPORT_QUALITY", "REPORT_TRENDS", None], "quality_analysis"),
    ("鱼骨图分析", ["QUALITY_STATS", "ALERT_DIAGNOSE", "REPORT_QUALITY", None], "quality_analysis"),

    # ===== 7. Quality Cert (5 cases) =====
    ("质量证书", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", None], "quality_cert"),
    ("检验报告", ["REPORT_QUALITY", "QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", None], "quality_cert"),
    ("COA生成", ["FOOD_SAFETY_CERT_QUERY", "LABEL_PRINT", "REPORT_QUALITY", None], "quality_cert"),
    ("合格证打印", ["LABEL_PRINT", "FOOD_SAFETY_CERT_QUERY", None], "quality_cert"),
    ("检测报告查看", ["REPORT_QUALITY", "QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", None], "quality_cert"),

    # ===== 8. Customer Quality (5 cases) =====
    ("客户投诉", ["ALERT_LIST", "QUALITY_STATS", "QUALITY_CHECK_QUERY", None], "customer_quality"),
    ("客户退货", ["QUALITY_DISPOSITION_EXECUTE", "ALERT_LIST", "QUALITY_STATS", "MATERIAL_BATCH_QUERY", None], "customer_quality"),
    ("客诉处理进度", ["ALERT_LIST", "ALERT_DIAGNOSE", "QUALITY_DISPOSITION_EXECUTE", "CUSTOMER_STATS", None], "customer_quality"),
    ("客户满意度", ["QUALITY_STATS", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", "CUSTOMER_STATS", None], "customer_quality"),
    ("质量反馈", ["QUALITY_STATS", "ALERT_LIST", "QUALITY_CHECK_QUERY", None], "customer_quality"),

    # ===== 9. Quality Improvement (5 cases) =====
    ("纠正措施", ["QUALITY_DISPOSITION_EXECUTE", "ALERT_DIAGNOSE", None], "quality_improvement"),
    ("预防措施", ["QUALITY_DISPOSITION_EXECUTE", "ALERT_DIAGNOSE", None], "quality_improvement"),
    ("8D报告", ["REPORT_QUALITY", "ALERT_DIAGNOSE", "QUALITY_DISPOSITION_EXECUTE", None], "quality_improvement"),
    ("质量改进项目", ["QUALITY_DISPOSITION_EXECUTE", "REPORT_QUALITY", "QUALITY_STATS", "QUALITY_CHECK_QUERY", None], "quality_improvement"),
    ("CAPA跟踪", ["QUALITY_DISPOSITION_EXECUTE", "ALERT_LIST", "ALERT_DIAGNOSE", None], "quality_improvement"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 45 ===")
    print(f"Focus: QUALITY INSPECTION DETAIL queries")
    print(f"       (incoming QC, in-process QC, final QC, test methods,")
    print(f"        non-conformance, quality analysis, certs, customer quality, improvement)")
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
        'test': 'v5_round45_quality_inspection_detail',
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
    report_path = f'tests/ai-intent/reports/v5_round45_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
