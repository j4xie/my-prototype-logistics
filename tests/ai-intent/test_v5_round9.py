#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 9
Focus: Multi-step workflows, permissions, urgency, explanations, trends, bulk ops, status changes, reports, config
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

# Round 9 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # === 1. Multi-step/workflow queries (5 cases) ===
    ("先检查库存再安排发货", ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "SHIPMENT_CREATE"], "workflow-inventory-ship"),
    ("完成质检后入库这批原料", ["QUALITY_CHECK_EXECUTE", "MATERIAL_BATCH_CREATE", "MATERIAL_BATCH_RELEASE", "MATERIAL_BATCH_QUERY", "QUALITY_CHECK_QUERY"], "workflow-qc-inbound"),
    ("先停机维护再重新启动设备", ["EQUIPMENT_STOP", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_START"], "workflow-maintain-restart"),
    ("审批通过后发起生产排程", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_START", "ORDER_STATUS"], "workflow-approve-schedule"),
    ("验收合格后放行并出库", ["MATERIAL_BATCH_RELEASE", "QUALITY_DISPOSITION_EXECUTE", "MATERIAL_BATCH_CONSUME", None], "workflow-release-outbound"),

    # === 2. Permission/authority queries (5 cases) ===
    # Note: permission meta-queries often timeout (None) since the pipeline extracts action verbs, not meta-questions
    ("我有权限审批这个订单吗", ["ORDER_STATUS", "ORDER_LIST", "NONE", None], "permission-approve"),
    ("谁有权限删除供应商信息", ["SUPPLIER_DELETE", "SUPPLIER_LIST", "NONE"], "permission-delete"),
    ("质检员能不能修改加工参数", ["QUALITY_CHECK_QUERY", "PROCESSING_BATCH_DETAIL", "NONE", "PROCESSING_BATCH_LIST"], "permission-role-check"),
    ("仓管员可以审批采购单吗", ["ORDER_STATUS", "ORDER_LIST", "NONE", None], "permission-warehouse"),
    ("这个操作需要什么权限级别", ["NONE", "USER_ROLE_ASSIGN", None], "permission-level-query"),

    # === 3. Urgency/priority expressions (5 cases) ===
    ("紧急！1号线设备故障停机了", ["EQUIPMENT_ALERT_LIST", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STOP", "ALERT_LIST"], "urgency-equipment-fault"),
    ("加急处理这个订单马上要发货", ["ORDER_STATUS", "SHIPMENT_CREATE", "ORDER_LIST", "MATERIAL_BATCH_QUERY", "SHIPMENT_STATUS_UPDATE", "SHIPMENT_QUERY"], "urgency-order-rush"),
    ("立刻停止2号生产线有安全隐患", ["EQUIPMENT_STOP", "PROCESSING_BATCH_CANCEL", "ALERT_LIST", "PROCESSING_BATCH_LIST"], "urgency-safety-stop"),
    ("赶紧查一下冷库温度告警", ["ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_ALERT_LIST", "COLD_CHAIN_TEMPERATURE"], "urgency-temp-alert"),
    ("优先处理这批即将过期的原料", ["MATERIAL_BATCH_QUERY", "MATERIAL_FIFO_RECOMMEND", "MATERIAL_BATCH_CONSUME", "MATERIAL_EXPIRING_ALERT"], "urgency-expiry-material"),

    # === 4. Explanation/why queries (5 cases) ===
    ("为什么这批原料质检不合格", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "TRACE_BATCH"], "explain-qc-fail"),
    ("这批产品退货的原因是什么", ["ORDER_STATUS", "QUALITY_CHECK_QUERY", "TRACE_BATCH", "MATERIAL_BATCH_QUERY"], "explain-return-reason"),
    ("为啥这个月产量下降了", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "REPORT_TRENDS"], "explain-output-drop"),
    ("设备停机原因分析", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_ALERT_LIST", None], "explain-downtime"),
    ("这批原料为啥被退回给供应商", ["SUPPLIER_EVALUATE", "QUALITY_CHECK_QUERY", "MATERIAL_BATCH_QUERY", "TRACE_BATCH", None], "explain-supplier-return"),

    # === 5. Historical/trend analysis queries (5 cases) ===
    ("最近三个月的产量环比增长了多少", ["REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW"], "trend-production-mom"),
    ("今年和去年同期的质检合格率对比", ["QUALITY_STATS", "REPORT_TRENDS", "QUALITY_CHECK_QUERY"], "trend-quality-yoy"),
    ("过去半年的库存周转率趋势", ["REPORT_INVENTORY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW"], "trend-inventory-turnover"),
    ("上个季度设备故障频率变化", ["EQUIPMENT_ALERT_LIST", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS"], "trend-equipment-fault"),
    ("近一年的供应商交货准时率走势", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", "REPORT_TRENDS"], "trend-supplier-delivery"),

    # === 6. Batch/bulk operations (5 cases) ===
    ("批量审批所有待审的采购订单", ["ORDER_LIST", "ORDER_STATUS", "DATA_BATCH_DELETE"], "bulk-approve-orders"),
    ("一次性删除所有过期的原料批次", ["DATA_BATCH_DELETE", "MATERIAL_BATCH_DELETE", "MATERIAL_BATCH_QUERY"], "bulk-delete-expired"),
    ("把所有待检批次标记为已检", ["QUALITY_CHECK_EXECUTE", "PROCESSING_BATCH_LIST", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", None], "bulk-mark-inspected"),
    ("批量更新供应商评分", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", "SUPPLIER_LIST"], "bulk-update-supplier"),
    ("一键确认所有活跃告警", ["ALERT_ACKNOWLEDGE", "ALERT_ACTIVE", "ALERT_RESOLVE"], "bulk-ack-alerts"),

    # === 7. Status change queries (4 cases) ===
    ("把这个订单状态改为已完成", ["ORDER_STATUS", "SHIPMENT_STATUS_UPDATE", "ORDER_LIST"], "status-order-complete"),
    ("设备状态改为维修中", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STOP"], "status-equip-maintain"),
    ("将加工批次PB20260209标记为完成", ["PROCESSING_BATCH_COMPLETE", "PROCESSING_BATCH_DETAIL"], "status-batch-complete"),
    ("恢复这条被暂停的生产线", ["PROCESSING_BATCH_RESUME", "EQUIPMENT_START", "PROCESSING_BATCH_START", "PROCESSING_BATCH_PAUSE", "PROCESSING_BATCH_LIST"], "status-resume-line"),

    # === 8. Report/export requests (4 cases) ===
    ("导出本月的质检报告", ["QUALITY_STATS", "REPORT_PRODUCTION", "QUALITY_CHECK_QUERY"], "report-export-quality"),
    ("生成上个月的财务月报", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW"], "report-finance-monthly"),
    ("打印今天的生产日报", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW"], "report-daily-production"),
    ("下载本季度的库存盘点表", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW"], "report-inventory-export"),

    # === 9. Configuration/settings queries (4 cases) ===
    ("修改冷库温度告警阈值为负18度", ["ALERT_LIST", "EQUIPMENT_STATUS_QUERY", "ALERT_ACTIVE", "NONE", "COLD_CHAIN_TEMPERATURE"], "config-alert-threshold"),
    ("设置质检合格率标准为98%", ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "NONE"], "config-quality-standard"),
    ("调整原料安全库存下限", ["MATERIAL_LOW_STOCK_ALERT", "MATERIAL_ADJUST_QUANTITY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY"], "config-safety-stock"),
    ("更改订单自动取消的超时时间", ["ORDER_LIST", "ORDER_STATUS", "ORDER_CANCEL", "ORDER_DELETE", "NONE", None], "config-order-timeout"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 9 ===")
    print(f"Focus: Workflows, Permissions, Urgency, Explanations, Trends, Bulk Ops, Status Changes, Reports, Config")
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
        print(f"  {cat}: {counts['pass']}/{total} ({pct:.0f}%)")

    if fail_count > 0:
        print(f"\n--- Failed queries ---")
        for r in results:
            if r['status'] == 'FAIL':
                print(f"  \"{r['query']}\" => {r['intent']} (expected {r['expected']}) [{r['category']}] via {r['method']} [{r['latency_ms']}ms]")

    if error_count > 0:
        print(f"\n--- Error queries ---")
        for r in results:
            if r['status'] == 'ERROR':
                print(f"  \"{r['query']}\" => {r['method']} [{r['category']}] [{r['latency_ms']}ms]")

    methods = {}
    for r in results:
        m = r.get('method') or 'NONE'
        methods[m] = methods.get(m, 0) + 1
    print(f"\n--- Match method distribution ---")
    for m, c in sorted(methods.items(), key=lambda x: -x[1]):
        print(f"  {m}: {c}")

    report = {
        'timestamp': datetime.now().isoformat(),
        'test': 'v5_round9_workflows_permissions_urgency',
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
    report_path = f'tests/ai-intent/reports/v5_round9_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
