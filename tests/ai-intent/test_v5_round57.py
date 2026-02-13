#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 57
Focus: COMPLIANCE & AUDIT queries for food manufacturing.
       Covers food safety cert, audit records, standard compliance,
       document management, recall management, risk assessment,
       training records, environment monitoring, and corrective action.
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

# Round 57 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Food Safety Cert (6 cases) =====
    ("食品安全证书查看", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "food_safety_cert"),
    ("SC认证到期了吗", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "ALERT_LIST", None], "food_safety_cert"),
    ("HACCP认证记录", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "food_safety_cert"),
    ("食品生产许可证查询", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "PROCESSING_BATCH_LIST", None], "food_safety_cert"),
    ("卫生许可证状态", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "food_safety_cert"),
    ("生产许可证有效期", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "food_safety_cert"),

    # ===== 2. Audit Records (6 cases) =====
    ("审计记录查看", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "audit_records"),
    ("上次内审报告", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "audit_records"),
    ("外审准备材料", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "audit_records"),
    ("审核跟踪进度", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "audit_records"),
    ("飞行检查结果", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "audit_records"),
    ("突击检查记录", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "audit_records"),

    # ===== 3. Standard Compliance (5 cases) =====
    ("标准合规检查", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "FOOD_SAFETY_CERT_QUERY", "REPORT_QUALITY", None], "standard_compliance"),
    ("GB标准对照", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "FOOD_SAFETY_CERT_QUERY", "REPORT_QUALITY", None], "standard_compliance"),
    ("国标检查结果", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "FOOD_SAFETY_CERT_QUERY", "REPORT_QUALITY", None], "standard_compliance"),
    ("行业标准达标情况", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "FOOD_SAFETY_CERT_QUERY", "REPORT_QUALITY", None], "standard_compliance"),
    ("合规检查报告", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "FOOD_SAFETY_CERT_QUERY", "REPORT_QUALITY", None], "standard_compliance"),

    # ===== 4. Document Management (6 cases) =====
    ("文档管理列表", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "QUALITY_CHECK_QUERY", None], "document_mgmt"),
    ("SOP操作规范查看", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "QUALITY_CHECK_QUERY", None], "document_mgmt"),
    ("操作手册在哪里", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "QUALITY_CHECK_QUERY", None], "document_mgmt"),
    ("规章制度更新", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "QUALITY_CHECK_QUERY", "RULE_CONFIG", None], "document_mgmt"),
    ("文件版本记录", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "QUALITY_CHECK_QUERY", None], "document_mgmt"),
    ("文档审批流程", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "QUALITY_CHECK_QUERY", None], "document_mgmt"),

    # ===== 5. Recall Management (5 cases) =====
    ("产品召回流程", ["TRACE_BATCH", "TRACE_FULL", "QUALITY_DISPOSITION_EXECUTE", "PROCESSING_BATCH_LIST", None], "recall_mgmt"),
    ("批次召回范围", ["TRACE_BATCH", "TRACE_FULL", "QUALITY_DISPOSITION_EXECUTE", "PROCESSING_BATCH_LIST", None], "recall_mgmt"),
    ("召回通知发送", ["TRACE_BATCH", "TRACE_FULL", "QUALITY_DISPOSITION_EXECUTE", "PROCESSING_BATCH_LIST", None], "recall_mgmt"),
    ("召回追踪进度", ["TRACE_BATCH", "TRACE_FULL", "QUALITY_DISPOSITION_EXECUTE", "PROCESSING_BATCH_LIST", None], "recall_mgmt"),
    ("召回产品处理", ["TRACE_BATCH", "TRACE_FULL", "QUALITY_DISPOSITION_EXECUTE", "PROCESSING_BATCH_LIST", None], "recall_mgmt"),

    # ===== 6. Risk Assessment (6 cases) =====
    ("风险评估报告", ["ALERT_LIST", "ALERT_DIAGNOSE", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", None], "risk_assessment"),
    ("危害分析结果", ["ALERT_LIST", "ALERT_DIAGNOSE", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", None], "risk_assessment"),
    ("风险等级评定", ["ALERT_LIST", "ALERT_DIAGNOSE", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", None], "risk_assessment"),
    ("CCP监控点状态", ["ALERT_LIST", "ALERT_DIAGNOSE", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", None], "risk_assessment"),
    ("风险预警通知", ["ALERT_LIST", "ALERT_DIAGNOSE", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", "FACTORY_NOTIFICATION_CONFIG", None], "risk_assessment"),
    ("安全隐患排查", ["ALERT_LIST", "ALERT_DIAGNOSE", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", None], "risk_assessment"),

    # ===== 7. Training Record (5 cases) =====
    ("培训记录查看", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "training_record"),
    ("员工培训完成情况", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "training_record"),
    ("下月培训计划", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "training_record"),
    ("培训考核成绩", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None], "training_record"),
    ("新员工上岗培训", ["HR_EMPLOYEE_LIST", "ATTENDANCE_STATS", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "training_record"),

    # ===== 8. Environment Monitoring (6 cases) =====
    ("车间环境监测数据", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "EQUIPMENT_STATUS_QUERY", None], "env_monitoring"),
    ("车间温湿度查看", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "EQUIPMENT_STATUS_QUERY", None], "env_monitoring"),
    ("水质检测报告", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "EQUIPMENT_STATUS_QUERY", None], "env_monitoring"),
    ("车间空气质量", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "EQUIPMENT_STATUS_QUERY", None], "env_monitoring"),
    ("噪音检测数据", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "EQUIPMENT_STATUS_QUERY", None], "env_monitoring"),
    ("废水处理达标情况", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "EQUIPMENT_STATUS_QUERY", None], "env_monitoring"),

    # ===== 9. Corrective Action (5 cases) =====
    ("纠正措施执行情况", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "ALERT_RESOLVE", "PLAN_UPDATE", None], "corrective_action"),
    ("整改通知下发", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "ALERT_RESOLVE", "PLAN_UPDATE", None], "corrective_action"),
    ("不合格品处理", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "ALERT_RESOLVE", "PLAN_UPDATE", None], "corrective_action"),
    ("改善计划进度", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "ALERT_RESOLVE", "PLAN_UPDATE", None], "corrective_action"),
    ("预防措施落实", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "ALERT_RESOLVE", "PLAN_UPDATE", "ALERT_DIAGNOSE", None], "corrective_action"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 57 ===")
    print(f"Focus: COMPLIANCE & AUDIT queries")
    print(f"       (food safety cert, audit records, standard compliance, document mgmt,")
    print(f"        recall mgmt, risk assessment, training record, env monitoring, corrective action)")
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
        'test': 'v5_round57_compliance_audit',
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
    report_path = f'tests/ai-intent/reports/v5_round57_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
