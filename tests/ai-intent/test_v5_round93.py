#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 93
Focus: REGULATORY & CERTIFICATION queries for food manufacturing.
       Covers food_license, haccp, iso_quality, organic_cert, export_cert,
       label_compliance, recall_regulatory, audit_prep, and document_control.
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

# Round 93 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Food License (6 cases) =====
    ("食品生产许可证", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "RULE_CONFIG", None], "food_license"),
    ("SC认证", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "RULE_CONFIG", None], "food_license"),
    ("许可证到期", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "MATERIAL_EXPIRING_ALERT", "ALERT_LIST", None], "food_license"),
    ("许可证续期", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "MATERIAL_EXPIRING_ALERT", "RULE_CONFIG", None], "food_license"),
    ("生产资质", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "PRODUCT_TYPE_QUERY", "PROCESSING_BATCH_LIST", None], "food_license"),
    ("经营许可", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "RULE_CONFIG", None], "food_license"),

    # ===== 2. HACCP (5 cases) =====
    ("HACCP认证", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", None], "haccp"),
    ("危害分析", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", "ALERT_LIST", None], "haccp"),
    ("关键控制点", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", "RULE_CONFIG", None], "haccp"),
    ("CCP监控", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", "ALERT_LIST", None], "haccp"),
    ("HACCP审核", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", None], "haccp"),

    # ===== 3. ISO Quality (6 cases) =====
    ("ISO22000", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "RULE_CONFIG", None], "iso_quality"),
    ("ISO9001", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "RULE_CONFIG", None], "iso_quality"),
    ("体系认证", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "RULE_CONFIG", None], "iso_quality"),
    ("管理体系", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", "RULE_CONFIG", None], "iso_quality"),
    ("内审计划", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", "FORM_GENERATION", "PLAN_UPDATE", None], "iso_quality"),
    ("管理评审", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", None], "iso_quality"),

    # ===== 4. Organic Certification (5 cases) =====
    ("有机认证", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", "PRODUCT_TYPE_QUERY", None], "organic_cert"),
    ("绿色食品认证", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "PRODUCT_TYPE_QUERY", None], "organic_cert"),
    ("无公害认证", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "PRODUCT_TYPE_QUERY", None], "organic_cert"),
    ("地理标志", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "PRODUCT_TYPE_QUERY", "TRACE_BATCH", None], "organic_cert"),
    ("认证标志", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "PRODUCT_TYPE_QUERY", None], "organic_cert"),

    # ===== 5. Export Certification (6 cases) =====
    ("出口许可", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "RULE_CONFIG", None], "export_cert"),
    ("检验检疫", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", None], "export_cert"),
    ("出口报关", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "FORM_GENERATION", None], "export_cert"),
    ("原产地证明", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "TRACE_BATCH", "MATERIAL_BATCH_QUERY", None], "export_cert"),
    ("健康证书", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "FORM_GENERATION", None], "export_cert"),
    ("出口标准", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "RULE_CONFIG", None], "export_cert"),

    # ===== 6. Label Compliance (5 cases) =====
    ("标签合规", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", "RULE_CONFIG", None], "label_compliance"),
    ("营养标签", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "PRODUCT_TYPE_QUERY", None], "label_compliance"),
    ("配料表", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "PRODUCT_TYPE_QUERY", "MATERIAL_BATCH_QUERY", None], "label_compliance"),
    ("过敏原标示", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", "ALERT_LIST", "MATERIAL_BATCH_QUERY", None], "label_compliance"),
    ("保质期标注", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "MATERIAL_EXPIRING_ALERT", "PRODUCT_TYPE_QUERY", None], "label_compliance"),

    # ===== 7. Recall / Regulatory (6 cases) =====
    ("召回备案", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "TRACE_BATCH", "ALERT_LIST", None], "recall_regulatory"),
    ("食品召回", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "TRACE_BATCH", "ALERT_LIST", None], "recall_regulatory"),
    ("不合格通报", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE", "REPORT_QUALITY", "ALERT_LIST", "REPORT_TRENDS", None], "recall_regulatory"),
    ("监管通知", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "ALERT_LIST", "FACTORY_NOTIFICATION_CONFIG", None], "recall_regulatory"),
    ("行政处罚", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "ALERT_LIST", "SUPPLIER_EVALUATE", None], "recall_regulatory"),
    ("整改要求", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", "ALERT_LIST", None], "recall_regulatory"),

    # ===== 8. Audit Preparation (5 cases) =====
    ("审核准备", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", None], "audit_prep"),
    ("迎审材料", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "FORM_GENERATION", "MATERIAL_BATCH_QUERY", None], "audit_prep"),
    ("审核清单", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "FORM_GENERATION", "REPORT_DASHBOARD_OVERVIEW", None], "audit_prep"),
    ("不符合项", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", "ALERT_LIST", "FORM_GENERATION", None], "audit_prep"),
    ("纠正措施", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", "ALERT_LIST", None], "audit_prep"),

    # ===== 9. Document Control (6 cases) =====
    ("文件管理", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "RULE_CONFIG", None], "document_control"),
    ("体系文件", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "FORM_GENERATION", "RULE_CONFIG", None], "document_control"),
    ("程序文件", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "FORM_GENERATION", "RULE_CONFIG", None], "document_control"),
    ("作业指导书", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "FORM_GENERATION", "RULE_CONFIG", None], "document_control"),
    ("记录管理", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "ATTENDANCE_HISTORY", None], "document_control"),
    ("文件变更", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "FORM_GENERATION", "RULE_CONFIG", None], "document_control"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 93 ===")
    print(f"Focus: REGULATORY & CERTIFICATION queries")
    print(f"       (food_license, haccp, iso_quality, organic_cert, export_cert,")
    print(f"        label_compliance, recall_regulatory, audit_prep, document_control)")
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
        'test': 'v5_round93_regulatory_certification',
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
    report_path = f'tests/ai-intent/reports/v5_round93_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
