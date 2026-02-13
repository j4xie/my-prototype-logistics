#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 61
Focus: NEGATIVE & CANCELLATION QUERIES for food manufacturing.
       Covers cancel_order, stop_production, reject_quality, undo_action,
       delete_data, disable_feature, refuse_shipment, complaint, correction.
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

# Round 61 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Cancel Order (6 cases) =====
    ("取消这个订单", ["ORDER_DELETE", "ORDER_CANCEL", "ORDER_UPDATE", "ORDER_LIST", None], "cancel_order"),
    ("不要了", ["ORDER_DELETE", "ORDER_CANCEL", "ORDER_UPDATE", "ORDER_LIST", None], "cancel_order"),
    ("退回订单", ["ORDER_DELETE", "ORDER_CANCEL", "ORDER_UPDATE", "ORDER_LIST", None], "cancel_order"),
    ("撤销下单", ["ORDER_DELETE", "ORDER_CANCEL", "ORDER_UPDATE", "ORDER_LIST", None], "cancel_order"),
    ("取消购买", ["ORDER_DELETE", "ORDER_CANCEL", "ORDER_UPDATE", "ORDER_LIST", None], "cancel_order"),
    ("不采购了", ["ORDER_DELETE", "ORDER_CANCEL", "ORDER_UPDATE", "ORDER_LIST", None], "cancel_order"),

    # ===== 2. Stop Production (6 cases) =====
    ("停产", ["PROCESSING_BATCH_CANCEL", "PROCESSING_BATCH_PAUSE", "EQUIPMENT_STOP", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", None], "stop_production"),
    ("暂停生产线", ["PROCESSING_BATCH_CANCEL", "PROCESSING_BATCH_PAUSE", "EQUIPMENT_STOP", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", None], "stop_production"),
    ("不生产了", ["PROCESSING_BATCH_CANCEL", "PROCESSING_BATCH_PAUSE", "EQUIPMENT_STOP", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", None], "stop_production"),
    ("停止加工", ["PROCESSING_BATCH_CANCEL", "PROCESSING_BATCH_PAUSE", "EQUIPMENT_STOP", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", None], "stop_production"),
    ("中止批次", ["PROCESSING_BATCH_CANCEL", "PROCESSING_BATCH_PAUSE", "EQUIPMENT_STOP", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", None], "stop_production"),
    ("关闭产线", ["PROCESSING_BATCH_CANCEL", "PROCESSING_BATCH_PAUSE", "EQUIPMENT_STOP", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", None], "stop_production"),

    # ===== 3. Reject Quality (5 cases) =====
    ("质检不合格", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "PROCESSING_BATCH_CANCEL", None], "reject_quality"),
    ("退回批次", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "PROCESSING_BATCH_CANCEL", "PROCESSING_BATCH_LIST", None], "reject_quality"),
    ("质量不达标", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "PROCESSING_BATCH_CANCEL", None], "reject_quality"),
    ("判定不合格", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "PROCESSING_BATCH_CANCEL", None], "reject_quality"),
    ("拒绝放行", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "PROCESSING_BATCH_CANCEL", None], "reject_quality"),

    # ===== 4. Undo Action (6 cases) =====
    ("撤销操作", ["CONTINUE_LAST_OPERATION", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "OPERATION_UNDO_OR_RECALL", None], "undo_action"),
    ("恢复原样", ["CONTINUE_LAST_OPERATION", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "SYSTEM_RESUME_LAST_ACTION", None], "undo_action"),
    ("回滚数据", ["CONTINUE_LAST_OPERATION", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "undo_action"),
    ("取消修改", ["CONTINUE_LAST_OPERATION", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "undo_action"),
    ("还原设置", ["CONTINUE_LAST_OPERATION", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "undo_action"),
    ("撤回提交", ["CONTINUE_LAST_OPERATION", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "undo_action"),

    # ===== 5. Delete Data (5 cases) =====
    ("删除记录", ["DATA_BATCH_DELETE", "PROCESSING_BATCH_CANCEL", "REPORT_DASHBOARD_OVERVIEW", None], "delete_data"),
    ("清除数据", ["DATA_BATCH_DELETE", "PROCESSING_BATCH_CANCEL", "REPORT_DASHBOARD_OVERVIEW", None], "delete_data"),
    ("移除条目", ["DATA_BATCH_DELETE", "PROCESSING_BATCH_CANCEL", "REPORT_DASHBOARD_OVERVIEW", None], "delete_data"),
    ("删除批次", ["DATA_BATCH_DELETE", "PROCESSING_BATCH_CANCEL", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_LIST", None], "delete_data"),
    ("清空列表", ["DATA_BATCH_DELETE", "PROCESSING_BATCH_CANCEL", "REPORT_DASHBOARD_OVERVIEW", None], "delete_data"),

    # ===== 6. Disable Feature (6 cases) =====
    ("关闭通知", ["FACTORY_NOTIFICATION_CONFIG", "USER_DISABLE", "CONFIG_RESET", "ALERT_RESOLVE", None], "disable_feature"),
    ("停用账号", ["FACTORY_NOTIFICATION_CONFIG", "USER_DISABLE", "CONFIG_RESET", "ALERT_RESOLVE", None], "disable_feature"),
    ("禁用功能", ["FACTORY_NOTIFICATION_CONFIG", "USER_DISABLE", "CONFIG_RESET", "ALERT_RESOLVE", "FACTORY_FEATURE_TOGGLE", None], "disable_feature"),
    ("取消提醒", ["FACTORY_NOTIFICATION_CONFIG", "USER_DISABLE", "CONFIG_RESET", "ALERT_RESOLVE", None], "disable_feature"),
    ("关闭预警", ["FACTORY_NOTIFICATION_CONFIG", "USER_DISABLE", "CONFIG_RESET", "ALERT_RESOLVE", "ALERT_LIST", None], "disable_feature"),
    ("停止推送", ["FACTORY_NOTIFICATION_CONFIG", "USER_DISABLE", "CONFIG_RESET", "ALERT_RESOLVE", None], "disable_feature"),

    # ===== 7. Refuse Shipment (5 cases) =====
    ("拒收货物", ["SHIPMENT_STATUS_UPDATE", "QUALITY_DISPOSITION_EXECUTE", "SHIPMENT_QUERY", "MATERIAL_BATCH_QUERY", None], "refuse_shipment"),
    ("退货", ["SHIPMENT_STATUS_UPDATE", "QUALITY_DISPOSITION_EXECUTE", "SHIPMENT_QUERY", None], "refuse_shipment"),
    ("退回发货", ["SHIPMENT_STATUS_UPDATE", "QUALITY_DISPOSITION_EXECUTE", "SHIPMENT_QUERY", "MATERIAL_BATCH_QUERY", None], "refuse_shipment"),
    ("不接受交货", ["SHIPMENT_STATUS_UPDATE", "QUALITY_DISPOSITION_EXECUTE", "SHIPMENT_QUERY", None], "refuse_shipment"),
    ("签收拒绝", ["SHIPMENT_STATUS_UPDATE", "QUALITY_DISPOSITION_EXECUTE", "SHIPMENT_QUERY", None], "refuse_shipment"),

    # ===== 8. Complaint (6 cases) =====
    ("投诉供应商", ["QUALITY_DISPOSITION_EXECUTE", "SUPPLIER_EVALUATE", "CUSTOMER_STATS", "ALERT_LIST", None], "complaint"),
    ("反馈问题", ["QUALITY_DISPOSITION_EXECUTE", "SUPPLIER_EVALUATE", "CUSTOMER_STATS", "ALERT_LIST", None], "complaint"),
    ("提出异议", ["QUALITY_DISPOSITION_EXECUTE", "SUPPLIER_EVALUATE", "CUSTOMER_STATS", "ALERT_LIST", None], "complaint"),
    ("不满意质量", ["QUALITY_DISPOSITION_EXECUTE", "SUPPLIER_EVALUATE", "CUSTOMER_STATS", "ALERT_LIST", "QUALITY_CHECK_QUERY", None], "complaint"),
    ("要求赔偿", ["QUALITY_DISPOSITION_EXECUTE", "SUPPLIER_EVALUATE", "CUSTOMER_STATS", "ALERT_LIST", None], "complaint"),
    ("客户投诉", ["QUALITY_DISPOSITION_EXECUTE", "SUPPLIER_EVALUATE", "CUSTOMER_STATS", "ALERT_LIST", None], "complaint"),

    # ===== 9. Correction (5 cases) =====
    ("纠正错误", ["MATERIAL_ADJUST_QUANTITY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "correction"),
    ("修正数据", ["MATERIAL_ADJUST_QUANTITY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "correction"),
    ("更正记录", ["MATERIAL_ADJUST_QUANTITY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "correction"),
    ("数据纠偏", ["MATERIAL_ADJUST_QUANTITY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "correction"),
    ("信息修正", ["MATERIAL_ADJUST_QUANTITY", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "correction"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 61 ===")
    print(f"Focus: NEGATIVE & CANCELLATION QUERIES")
    print(f"       (cancel_order, stop_production, reject_quality, undo_action,")
    print(f"        delete_data, disable_feature, refuse_shipment, complaint, correction)")
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
        'test': 'v5_round61_negative_cancellation',
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
    report_path = f'tests/ai-intent/reports/v5_round61_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
