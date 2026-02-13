#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 74
Focus: DOCUMENT & FORM MANAGEMENT queries for food manufacturing.
       Covers form_fill, form_query, approval, sop, checklist,
       log_entry, certificate, version_control, and archive.
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

# Round 74 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Form Fill (6 cases) =====
    ("填写表单", ["FORM_GENERATION", "PROCESSING_BATCH_COMPLETE", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None], "form_fill"),
    ("工单填报", ["FORM_GENERATION", "PROCESSING_BATCH_COMPLETE", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None], "form_fill"),
    ("报工填写", ["PROCESSING_BATCH_COMPLETE", "FORM_GENERATION", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None], "form_fill"),
    ("日报填写", ["FORM_GENERATION", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_COMPLETE", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None], "form_fill"),
    ("数据录入", ["FORM_GENERATION", "PROCESSING_BATCH_COMPLETE", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None], "form_fill"),
    ("信息填报", ["FORM_GENERATION", "PROCESSING_BATCH_COMPLETE", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None], "form_fill"),

    # ===== 2. Form Query (6 cases) =====
    ("查看表单", ["PROCESSING_BATCH_LIST", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", None], "form_query"),
    ("历史工单", ["PROCESSING_BATCH_LIST", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", None], "form_query"),
    ("已提交表单", ["PROCESSING_BATCH_LIST", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "FORM_GENERATION", None], "form_query"),
    ("表单记录", ["PROCESSING_BATCH_LIST", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "FORM_GENERATION", None], "form_query"),
    ("单据查询", ["PROCESSING_BATCH_LIST", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", None], "form_query"),
    ("工单列表", ["PROCESSING_BATCH_LIST", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", None], "form_query"),

    # ===== 3. Approval (5 cases) =====
    ("审批工单", ["PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_LIST", None], "approval"),
    ("审批流程", ["PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_LIST", None], "approval"),
    ("审批进度", ["PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_LIST", None], "approval"),
    ("批准申请", ["PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_LIST", None], "approval"),
    ("签字确认", ["PLAN_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_LIST", None], "approval"),

    # ===== 4. SOP (6 cases) =====
    ("SOP文档", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "QUALITY_CHECK_QUERY", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", None], "sop"),
    ("标准操作规程", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "QUALITY_CHECK_QUERY", "PRODUCTION_STATUS_QUERY", "RULE_CONFIG", None], "sop"),
    ("操作指南", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "QUALITY_CHECK_QUERY", "PRODUCTION_STATUS_QUERY", None], "sop"),
    ("作业指导书", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "QUALITY_CHECK_QUERY", "PRODUCTION_STATUS_QUERY", None], "sop"),
    ("工艺文件", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "QUALITY_CHECK_QUERY", "PRODUCTION_STATUS_QUERY", None], "sop"),
    ("操作手册", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "QUALITY_CHECK_QUERY", "PRODUCTION_STATUS_QUERY", None], "sop"),

    # ===== 5. Checklist (5 cases) =====
    ("检查清单", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "FORM_GENERATION", "EQUIPMENT_STATUS_QUERY", None], "checklist"),
    ("点检表", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "FORM_GENERATION", "EQUIPMENT_STATUS_QUERY", None], "checklist"),
    ("巡检单", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "FORM_GENERATION", "EQUIPMENT_STATUS_QUERY", None], "checklist"),
    ("检查项目", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "FORM_GENERATION", "EQUIPMENT_STATUS_QUERY", None], "checklist"),
    ("核对清单", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "FORM_GENERATION", "EQUIPMENT_STATUS_QUERY", None], "checklist"),

    # ===== 6. Log Entry (6 cases) =====
    ("操作日志", ["REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_TIMELINE", "EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", None], "log_entry"),
    ("生产日志", ["REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_TIMELINE", "EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", None], "log_entry"),
    ("设备日志", ["EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_TIMELINE", "PRODUCTION_STATUS_QUERY", None], "log_entry"),
    ("交接班记录", ["REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_TIMELINE", "EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", None], "log_entry"),
    ("运行记录", ["REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_TIMELINE", "EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", None], "log_entry"),
    ("变更记录", ["REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_TIMELINE", "EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", None], "log_entry"),

    # ===== 7. Certificate (5 cases) =====
    ("出具证书", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "LABEL_PRINT", None], "certificate"),
    ("合格证明", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "LABEL_PRINT", None], "certificate"),
    ("检测报告", ["QUALITY_CHECK_QUERY", "FOOD_SAFETY_CERT_QUERY", "REPORT_QUALITY", "LABEL_PRINT", None], "certificate"),
    ("出厂证明", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "LABEL_PRINT", None], "certificate"),
    ("质量证明", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "LABEL_PRINT", None], "certificate"),

    # ===== 8. Version Control (6 cases) =====
    ("文件版本", ["REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "FORM_GENERATION", None], "version_control"),
    ("历史版本", ["REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "FORM_GENERATION", None], "version_control"),
    ("版本对比", ["REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "FORM_GENERATION", "REPORT_TRENDS", None], "version_control"),
    ("文件更新", ["REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "FORM_GENERATION", None], "version_control"),
    ("最新版本", ["REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "FORM_GENERATION", None], "version_control"),
    ("版本回退", ["CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", None], "version_control"),

    # ===== 9. Archive (5 cases) =====
    ("文档归档", ["REPORT_DASHBOARD_OVERVIEW", "DATA_BATCH_DELETE", "CONFIG_RESET", None], "archive"),
    ("资料存档", ["REPORT_DASHBOARD_OVERVIEW", "DATA_BATCH_DELETE", "CONFIG_RESET", "MATERIAL_BATCH_QUERY", None], "archive"),
    ("历史文档", ["REPORT_DASHBOARD_OVERVIEW", "DATA_BATCH_DELETE", "CONFIG_RESET", None], "archive"),
    ("档案查询", ["REPORT_DASHBOARD_OVERVIEW", "DATA_BATCH_DELETE", "CONFIG_RESET", "QUERY_EMPLOYEE_PROFILE", None], "archive"),
    ("文件归类", ["REPORT_DASHBOARD_OVERVIEW", "DATA_BATCH_DELETE", "CONFIG_RESET", None], "archive"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 74 ===")
    print(f"Focus: DOCUMENT & FORM MANAGEMENT queries")
    print(f"       (form_fill, form_query, approval, sop, checklist, log_entry, certificate, version_control, archive)")
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
        'test': 'v5_round74_document_form_management',
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
    report_path = f'tests/ai-intent/reports/v5_round74_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
