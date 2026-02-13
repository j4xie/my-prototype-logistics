#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 26
Focus: MIXED & AMBIGUOUS QUERIES - cross-domain queries that could map to multiple intents,
       vague requests, incomplete sentences, context-dependent queries, colloquial language,
       negation/cancellation, compound queries, and action-object mismatches.
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

# Round 26 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Cross-Domain Ambiguous (6 cases) =====
    # Queries that straddle two or more business domains
    ("产量和质量一起看看", ["PRODUCTION_STATUS_QUERY", "QUALITY_STATS", "REPORT_PRODUCTION", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", None], "crossdomain-production-quality"),
    ("库存不够了要不要采购", ["MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY", "SUPPLIER_LIST", "MRP_CALCULATION", "ORDER_CREATE", None], "crossdomain-inventory-procurement"),
    ("设备坏了影响产量了", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "EQUIPMENT_MAINTENANCE", "PRODUCTION_STATUS_QUERY", "ALERT_ACTIVE", None], "crossdomain-equipment-production"),
    ("质检不合格退给供应商", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "SUPPLIER_EVALUATE", "TRACE_UPSTREAM", None], "crossdomain-quality-supplier"),
    ("出货前检查一下温度和标签", ["COLD_CHAIN_TEMPERATURE", "QUALITY_CHECK_EXECUTE", "LABEL_QUERY", "SHIPMENT_QUERY", None], "crossdomain-coldchain-label"),
    ("考勤异常影响工资了", ["ATTENDANCE_ANOMALY", "ATTENDANCE_HISTORY", "REPORT_FINANCE", None], "crossdomain-attendance-finance"),

    # ===== 2. Vague/Incomplete (6 cases) =====
    # One-word or extremely short queries with no clear intent
    ("情况", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None], "vague-situation"),
    ("数据", ["REPORT_DASHBOARD_OVERVIEW", None], "vague-data"),
    ("统计", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "QUALITY_STATS", "ORDER_STATS", None], "vague-statistics"),
    ("检查", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "EQUIPMENT_STATUS_QUERY", None], "vague-check"),
    ("查看", ["REPORT_DASHBOARD_OVERVIEW", None], "vague-view"),
    ("更新", ["PRODUCT_UPDATE", "BATCH_UPDATE", "EQUIPMENT_STATUS_UPDATE", None], "vague-update"),

    # ===== 3. Context-Dependent (5 cases) =====
    # Queries that require conversational context to be meaningful
    ("那个呢", [None, "QUERY_RETRY_LAST"], "context-that-one"),
    ("上次的结果", [None, "QUERY_RETRY_LAST", "REPORT_DASHBOARD_OVERVIEW"], "context-last-result"),
    ("刚才说的那个报表", [None, "QUERY_RETRY_LAST", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION"], "context-just-mentioned"),
    ("接着做", [None, "QUERY_RETRY_LAST", "PROCESSING_BATCH_RESUME", "CONTINUE_LAST_OPERATION"], "context-continue"),
    ("继续", [None, "QUERY_RETRY_LAST", "PROCESSING_BATCH_RESUME"], "context-go-on"),

    # ===== 4. Compound Queries (6 cases) =====
    # Multi-part requests that combine two or more intents
    ("先查产量再看质检结果", ["PRODUCTION_STATUS_QUERY", "QUALITY_CHECK_QUERY", "REPORT_PRODUCTION", "REPORT_QUALITY", None], "compound-production-then-quality"),
    ("查一下库存然后下个采购单", ["MATERIAL_BATCH_QUERY", "MATERIAL_LOW_STOCK_ALERT", "ORDER_CREATE", "MRP_CALCULATION", None], "compound-inventory-then-order"),
    ("打印标签并且发货", ["LABEL_PRINT", "SHIPMENT_CREATE", "SHIPMENT_STATUS_UPDATE", None], "compound-print-and-ship"),
    ("质检完了安排入库", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "MATERIAL_BATCH_CREATE", "PROCESSING_BATCH_COMPLETE", None], "compound-qc-then-inbound"),
    ("看看今天产量顺便查下出勤", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "ATTENDANCE_TODAY", None], "compound-production-and-attendance"),
    ("把设备停了然后报修", ["EQUIPMENT_STOP", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_UPDATE", None], "compound-stop-then-maintain"),

    # ===== 5. Negation/Cancellation (5 cases) =====
    # Queries expressing negation, cancellation, or stopping actions
    ("别发了", [None, "ORDER_CANCEL", "SHIPMENT_STATUS_UPDATE"], "negation-dont-send"),
    ("不要了取消吧", [None, "ORDER_CANCEL", "PROCESSING_BATCH_CANCEL"], "negation-cancel-it"),
    ("取消这个生产批次", ["PROCESSING_BATCH_CANCEL", "ORDER_CANCEL", "PROCESSING_BATCH_LIST", None], "negation-cancel-batch"),
    ("暂停生产线", ["PROCESSING_BATCH_PAUSE", "EQUIPMENT_STOP", None], "negation-pause-production"),
    ("停止发货", [None, "ORDER_CANCEL", "SHIPMENT_STATUS_UPDATE", "PROCESSING_BATCH_PAUSE"], "negation-stop-shipping"),

    # ===== 6. Colloquial/Dialect (6 cases) =====
    # Informal Chinese, slang, or dialect expressions
    ("搞定了没", [None, "PRODUCTION_STATUS_QUERY", "ORDER_STATUS", "PROCESSING_BATCH_DETAIL"], "colloquial-done-yet"),
    ("咋回事啊这设备", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_LIST", None], "colloquial-whats-wrong-equipment"),
    ("啥情况现在", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None], "colloquial-whats-going-on"),
    ("整一下那个报表", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_QUALITY", "REPORT_FINANCE", None], "colloquial-fix-report"),
    ("赶紧出个单子", ["ORDER_CREATE", "SHIPMENT_CREATE", "PROCESSING_BATCH_CREATE", None], "colloquial-hurry-create-order"),
    ("这玩意儿靠谱不", [None, "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY", "SUPPLIER_EVALUATE"], "colloquial-is-it-reliable"),

    # ===== 7. Number-Heavy (5 cases) =====
    # Queries with lots of numeric data, batch codes, quantities
    ("B20260210第3批200kg入库", ["MATERIAL_BATCH_CREATE", "MATERIAL_ADJUST_QUANTITY", "PROCESSING_BATCH_CREATE", None], "number-batch-inbound"),
    ("订单20260210003发了没", ["ORDER_STATUS", "SHIPMENT_QUERY", "ORDER_LIST", None], "number-order-status"),
    ("3号线产了1500箱", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_UPDATE", "PROCESSING_BATCH_DETAIL", None], "number-line-output"),
    ("温度-18.5度是不是正常", ["COLD_CHAIN_TEMPERATURE", "COLD_CHAIN_ALERT", None], "number-temperature-check"),
    ("仓库A区还有3200件库存", ["MATERIAL_BATCH_QUERY", "MATERIAL_LOW_STOCK_ALERT", "REPORT_INVENTORY", None], "number-warehouse-inventory"),

    # ===== 8. Question Forms (6 cases) =====
    # Same underlying intent expressed as different question types
    ("今天是不是都到齐了", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", "ATTENDANCE_DEPARTMENT", None], "question-yesno-attendance"),
    ("质检报告出来了对不对", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "QUALITY_STATS", None], "question-confirmation-qc"),
    ("有没有新的告警", ["ALERT_ACTIVE", "ALERT_LIST", "ALERT_STATS", None], "question-existence-alert"),
    ("能不能导出这个月的数据", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_FINANCE", "ATTENDANCE_MONTHLY", None], "question-ability-export"),
    ("是谁审批的这个单子", [None, "ORDER_STATUS", "ORDER_LIST", "PROCESSING_BATCH_DETAIL"], "question-who-approved"),
    ("要不要补货了", ["MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY", "MRP_CALCULATION", "ORDER_CREATE", None], "question-should-restock"),

    # ===== 9. Action + Object Mismatch (5 cases) =====
    # Unusual combinations of actions and objects
    ("打印温度记录", ["COLD_CHAIN_TEMPERATURE", "REPORT_QUALITY", "LABEL_PRINT", None], "mismatch-print-temperature"),
    ("扫描报表", ["REPORT_DASHBOARD_OVERVIEW", "LABEL_QUERY", None], "mismatch-scan-report"),
    ("称重订单", ["SCALE_LIST_DEVICES", "ORDER_LIST", "ORDER_STATUS", "SCALE_DEVICE_DETAIL", None], "mismatch-weigh-order"),
    ("拍照设备状态", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", "SCALE_ADD_DEVICE_VISION", None], "mismatch-photo-equipment"),
    ("语音查库存", ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "MATERIAL_LOW_STOCK_ALERT", None], "mismatch-voice-inventory"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 26 ===")
    print(f"Focus: MIXED & AMBIGUOUS QUERIES - cross-domain, vague, context-dependent,")
    print(f"       compound, negation, colloquial, number-heavy, question forms, mismatches")
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
        'test': 'v5_round26_mixed_ambiguous',
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
    report_path = f'tests/ai-intent/reports/v5_round26_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
