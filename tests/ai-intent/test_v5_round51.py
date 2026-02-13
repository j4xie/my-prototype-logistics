#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 51
Focus: ERROR RECOVERY & RETRY queries.
       Covers retry requests, error diagnosis, fallback queries,
       correction, status check, help request, timeout,
       data issues, and permission errors.
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

# Round 51 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Retry Requests (6 cases) =====
    ("再查一次",
     ["QUERY_RETRY_LAST", "REPORT_DASHBOARD_OVERVIEW", None],
     "retry_request"),
    ("重新查询",
     ["QUERY_RETRY_LAST", "REPORT_DASHBOARD_OVERVIEW", None],
     "retry_request"),
    ("刷新数据",
     ["QUERY_RETRY_LAST", "REPORT_DASHBOARD_OVERVIEW", None],
     "retry_request"),
    ("重新加载",
     ["QUERY_RETRY_LAST", None],
     "retry_request"),
    ("再试一下",
     ["QUERY_RETRY_LAST", None],
     "retry_request"),
    ("查询失败重试",
     ["QUERY_RETRY_LAST", None],
     "retry_request"),

    # ===== 2. Error Diagnosis (6 cases) =====
    ("为什么出错了",
     ["ALERT_DIAGNOSE", None],
     "error_diagnosis"),
    ("错误原因",
     ["ALERT_DIAGNOSE", None],
     "error_diagnosis"),
    ("失败原因分析",
     ["ALERT_DIAGNOSE", None],
     "error_diagnosis"),
    ("问题诊断",
     ["ALERT_DIAGNOSE", "EQUIPMENT_STATUS_QUERY", None],
     "error_diagnosis"),
    ("根因分析",
     ["ALERT_DIAGNOSE", None],
     "error_diagnosis"),
    ("异常排查",
     ["ALERT_DIAGNOSE", "ALERT_LIST", None],
     "error_diagnosis"),

    # ===== 3. Fallback Queries (5 cases) =====
    ("换个方式查",
     [None, "QUERY_RETRY_LAST"],
     "fallback"),
    ("有没有替代方案",
     [None],
     "fallback"),
    ("手动查询",
     [None, "REPORT_DASHBOARD_OVERVIEW", "SCHEDULING_SET_MANUAL"],
     "fallback"),
    ("离线查看",
     [None, "REPORT_DASHBOARD_OVERVIEW"],
     "fallback"),
    ("导出后查看",
     [None, "REPORT_DASHBOARD_OVERVIEW"],
     "fallback"),

    # ===== 4. Correction (6 cases) =====
    ("刚才查错了",
     [None, "QUERY_RETRY_LAST"],
     "correction"),
    ("不是这个批次",
     [None, "QUERY_RETRY_LAST", "PROCESSING_BATCH_DETAIL"],
     "correction"),
    ("搞错了重来",
     [None, "QUERY_RETRY_LAST"],
     "correction"),
    ("修正查询条件",
     [None, "QUERY_RETRY_LAST", "CONDITION_SWITCH"],
     "correction"),
    ("更正数据",
     [None, "REPORT_DASHBOARD_OVERVIEW"],
     "correction"),
    ("输入有误",
     [None, "FORM_GENERATION"],
     "correction"),

    # ===== 5. Status Check (6 cases) =====
    ("现在好了吗",
     [None, "ALERT_ACTIVE", "EQUIPMENT_STATUS_QUERY"],
     "status_check"),
    ("恢复了没",
     [None, "ALERT_ACTIVE", "EQUIPMENT_STATUS_QUERY"],
     "status_check"),
    ("问题解决了吗",
     [None, "ALERT_ACTIVE"],
     "status_check"),
    ("服务正常了吗",
     [None, "EQUIPMENT_STATUS_QUERY", "ALERT_ACTIVE"],
     "status_check"),
    ("连接正常吗",
     [None, "EQUIPMENT_STATUS_QUERY", "ALERT_ACTIVE"],
     "status_check"),
    ("还有问题吗",
     [None, "ALERT_ACTIVE", "ALERT_LIST"],
     "status_check"),

    # ===== 6. Help Request (5 cases) =====
    ("不会操作",
     [None, "FACTORY_SETTINGS"],
     "help_request"),
    ("怎么查",
     [None, "QUERY_RETRY_LAST"],
     "help_request"),
    ("教我用",
     [None],
     "help_request"),
    ("使用帮助",
     [None, "FACTORY_SETTINGS"],
     "help_request"),
    ("操作指南",
     [None, "FACTORY_SETTINGS"],
     "help_request"),

    # ===== 7. Timeout (5 cases) =====
    ("等太久了",
     [None],
     "timeout"),
    ("加载太慢",
     [None],
     "timeout"),
    ("响应超时",
     [None, "ALERT_LIST"],
     "timeout"),
    ("一直在转",
     [None],
     "timeout"),
    ("卡住了",
     [None, "ALERT_LIST", "EQUIPMENT_STATUS_QUERY"],
     "timeout"),

    # ===== 8. Data Issue (6 cases) =====
    ("数据不对",
     [None, "ALERT_DIAGNOSE", "REPORT_DASHBOARD_OVERVIEW"],
     "data_issue"),
    ("数字有问题",
     [None, "ALERT_DIAGNOSE", "ALERT_LIST"],
     "data_issue"),
    ("怎么是空的",
     [None],
     "data_issue"),
    ("没有数据",
     [None, "REPORT_DASHBOARD_OVERVIEW"],
     "data_issue"),
    ("数据缺失",
     [None, "ALERT_DIAGNOSE", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW"],
     "data_issue"),
    ("数据异常",
     [None, "ALERT_DIAGNOSE", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW"],
     "data_issue"),

    # ===== 9. Permission Error (5 cases) =====
    ("看不了",
     [None],
     "permission_error"),
    ("没有权限",
     [None, "FACTORY_SETTINGS"],
     "permission_error"),
    ("被拒绝了",
     [None],
     "permission_error"),
    ("访问受限",
     [None, "FACTORY_SETTINGS"],
     "permission_error"),
    ("无法操作",
     [None],
     "permission_error"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 51 ===")
    print(f"Focus: ERROR RECOVERY & RETRY queries")
    print(f"       (retry requests, error diagnosis, fallback queries,")
    print(f"        correction, status check, help request, timeout,")
    print(f"        data issues, permission errors)")
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
        'test': 'v5_round51_error_recovery_retry',
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
    report_path = f'tests/ai-intent/reports/v5_round51_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
