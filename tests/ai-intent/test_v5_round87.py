#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 87
Focus: CUSTOMER SERVICE & COMPLAINT queries for food manufacturing.
       Covers complaint_receive, return_process, customer_feedback, after_sales,
       recall_manage, customer_inquiry, service_level, claim_process, and crm_data.
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

# Round 87 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== complaint_receive (6 cases) =====
    ("客户投诉记录查询", ["CUSTOMER_SEARCH", "QUALITY_CHECK_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "complaint_receive"),
    ("登记一条新的投诉信息", ["QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE", "CUSTOMER_SEARCH", None], "complaint_receive"),
    ("投诉处理进度怎么样了", ["QUALITY_CHECK_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None], "complaint_receive"),
    ("跟踪上周的客户投诉", ["CUSTOMER_SEARCH", "QUALITY_CHECK_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", "CUSTOMER_STATS", None], "complaint_receive"),
    ("本月投诉统计数据", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", None], "complaint_receive"),
    ("按投诉类型分类汇总", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "QUALITY_CHECK_QUERY", None], "complaint_receive"),

    # ===== return_process (5 cases) =====
    ("查看退货处理记录", ["QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "return_process"),
    ("退货原因分析报告", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "QUALITY_CHECK_QUERY", "ALERT_DIAGNOSE", None], "return_process"),
    ("本月退货统计是多少", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "MATERIAL_BATCH_QUERY", None], "return_process"),
    ("退货审批流程查询", ["QUALITY_DISPOSITION_EXECUTE", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", None], "return_process"),
    ("客户要求换货怎么处理", ["QUALITY_DISPOSITION_EXECUTE", "ORDER_LIST", "CUSTOMER_SEARCH", None], "return_process"),

    # ===== customer_feedback (6 cases) =====
    ("查看客户反馈汇总", ["CUSTOMER_SEARCH", "CUSTOMER_BY_TYPE", "REPORT_DASHBOARD_OVERVIEW", "CUSTOMER_STATS", None], "customer_feedback"),
    ("满意度调查结果怎么样", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "CUSTOMER_SEARCH", "SUPPLIER_EVALUATE", None], "customer_feedback"),
    ("客户评价数据分析", ["CUSTOMER_SEARCH", "CUSTOMER_BY_TYPE", "REPORT_DASHBOARD_OVERVIEW", "SUPPLIER_EVALUATE", "CUSTOMER_STATS", None], "customer_feedback"),
    ("反馈分析报告", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "CUSTOMER_SEARCH", None], "customer_feedback"),
    ("NPS评分是多少", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "SUPPLIER_EVALUATE", None], "customer_feedback"),
    ("收集到的客户建议有哪些", ["CUSTOMER_SEARCH", "CUSTOMER_BY_TYPE", "REPORT_DASHBOARD_OVERVIEW", "MRP_CALCULATION", None], "customer_feedback"),

    # ===== after_sales (5 cases) =====
    ("售后服务情况总览", ["REPORT_DASHBOARD_OVERVIEW", "CUSTOMER_SEARCH", "ORDER_LIST", None], "after_sales"),
    ("查看售后服务记录", ["CUSTOMER_SEARCH", "CUSTOMER_PURCHASE_HISTORY", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "after_sales"),
    ("维修工单跟踪查询", ["ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", "EQUIPMENT_MAINTENANCE", None], "after_sales"),
    ("保修期查询", ["CUSTOMER_SEARCH", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "after_sales"),
    ("售后费用统计报告", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "CUSTOMER_PURCHASE_HISTORY", "COST_TREND_ANALYSIS", None], "after_sales"),

    # ===== recall_manage (6 cases) =====
    ("产品召回流程启动", ["TRACE_BATCH", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", None], "recall_manage"),
    ("查询召回批次信息", ["TRACE_BATCH", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "recall_manage"),
    ("召回进度跟踪", ["TRACE_BATCH", "QUALITY_CHECK_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "recall_manage"),
    ("发送召回通知给客户", ["ALERT_LIST", "CUSTOMER_SEARCH", "TRACE_BATCH", None], "recall_manage"),
    ("召回范围评估分析", ["TRACE_BATCH", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_DISPOSITION_EVALUATE", None], "recall_manage"),
    ("生成召回报告", ["TRACE_BATCH", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "recall_manage"),

    # ===== customer_inquiry (5 cases) =====
    ("客户咨询记录查看", ["CUSTOMER_SEARCH", "CUSTOMER_BY_TYPE", "CUSTOMER_PURCHASE_HISTORY", "REPORT_DASHBOARD_OVERVIEW", None], "customer_inquiry"),
    ("产品咨询问题汇总", ["CUSTOMER_SEARCH", "REPORT_DASHBOARD_OVERVIEW", "PRODUCT_UPDATE", None], "customer_inquiry"),
    ("客户问价格怎么报", ["CUSTOMER_SEARCH", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "customer_inquiry"),
    ("交期咨询回复情况", ["SHIPMENT_QUERY", "ORDER_LIST", "CUSTOMER_SEARCH", "REPORT_DASHBOARD_OVERVIEW", None], "customer_inquiry"),
    ("技术咨询记录查询", ["CUSTOMER_SEARCH", "REPORT_DASHBOARD_OVERVIEW", None], "customer_inquiry"),

    # ===== service_level (6 cases) =====
    ("客户服务等级标准查看", ["CUSTOMER_BY_TYPE", "CUSTOMER_SEARCH", "REPORT_DASHBOARD_OVERVIEW", None], "service_level"),
    ("投诉响应时间统计", ["REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", None], "service_level"),
    ("工单处理时效分析", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "REPORT_EFFICIENCY", None], "service_level"),
    ("服务质量考核报告", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "SUPPLIER_EVALUATE", "REPORT_QUALITY", None], "service_level"),
    ("客服人员绩效排名", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "SUPPLIER_EVALUATE", "REPORT_KPI", None], "service_level"),
    ("服务标准达成情况", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "SUPPLIER_EVALUATE", None], "service_level"),

    # ===== claim_process (5 cases) =====
    ("理赔处理进度查询", ["QUALITY_DISPOSITION_EXECUTE", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "claim_process"),
    ("制定赔偿方案", ["QUALITY_DISPOSITION_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "claim_process"),
    ("损失评估金额是多少", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_TRENDS", "QUALITY_CHECK_QUERY", None], "claim_process"),
    ("保险理赔申请记录", ["ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "claim_process"),
    ("质量事故责任认定", ["QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "claim_process"),

    # ===== crm_data (6 cases) =====
    ("查看客户档案信息", ["CUSTOMER_SEARCH", "CUSTOMER_BY_TYPE", "CUSTOMER_PURCHASE_HISTORY", "REPORT_DASHBOARD_OVERVIEW", None], "crm_data"),
    ("客户分级管理列表", ["CUSTOMER_BY_TYPE", "CUSTOMER_SEARCH", "REPORT_DASHBOARD_OVERVIEW", None], "crm_data"),
    ("VIP客户名单查询", ["CUSTOMER_BY_TYPE", "CUSTOMER_SEARCH", "CUSTOMER_PURCHASE_HISTORY", "REPORT_DASHBOARD_OVERVIEW", None], "crm_data"),
    ("客户画像数据分析", ["CUSTOMER_SEARCH", "CUSTOMER_BY_TYPE", "REPORT_DASHBOARD_OVERVIEW", "CUSTOMER_STATS", None], "crm_data"),
    ("客户关系维护记录", ["CUSTOMER_SEARCH", "CUSTOMER_PURCHASE_HISTORY", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_MAINTENANCE", None], "crm_data"),
    ("客户生命周期分析报告", ["CUSTOMER_SEARCH", "CUSTOMER_BY_TYPE", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "crm_data"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 87 ===")
    print(f"Focus: CUSTOMER SERVICE & COMPLAINT queries")
    print(f"       (complaint_receive, return_process, customer_feedback, after_sales,")
    print(f"        recall_manage, customer_inquiry, service_level, claim_process, crm_data)")
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
        'test': 'v5_round87_customer_service_complaint',
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
    report_path = f'tests/ai-intent/reports/v5_round87_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
