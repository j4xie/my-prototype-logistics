#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 4
Real-world production scenarios: urgent/emotional, industry jargon,
entity-specific, dialect, multi-step, question vs command, edge cases.
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

# Round 4 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # === 紧急/情绪化表达 ===
    ("急！设备坏了", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY"], "urgent-equip-down"),
    ("赶紧查一下库存", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "urgent-check-inv"),
    ("快看看有没有告警", ["ALERT_LIST", "ALERT_ACTIVE"], "urgent-check-alert"),
    ("出事了，质检不合格", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "QUALITY_DISPOSITION_EXECUTE"], "urgent-quality-fail"),
    ("完蛋了订单超时了", ["ORDER_STATUS", "ORDER_LIST", "SHIPMENT_QUERY"], "urgent-order-late"),

    # === 行业术语/专业表达 ===
    ("HACCP审核记录", ["QUALITY_CHECK_QUERY", "QUALITY_STATS"], "jargon-haccp"),
    ("CCP点检测数据", ["QUALITY_CHECK_QUERY"], "jargon-ccp"),
    ("GMP检查报告", ["QUALITY_CHECK_QUERY", "QUALITY_STATS"], "jargon-gmp"),
    ("BOM物料清单", ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY"], "jargon-bom"),
    ("WMS出入库流水", ["MATERIAL_BATCH_QUERY", "SHIPMENT_QUERY"], "jargon-wms"),

    # === 带实体的具体查询 ===
    ("A线今天产了多少", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "entity-line-a"),
    ("车间二的设备状态", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST"], "entity-workshop2"),
    ("面粉还剩多少", ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY"], "entity-flour"),
    ("张三今天来了吗", ["ATTENDANCE_TODAY", "ATTENDANCE_HISTORY"], "entity-person"),
    ("BN20260209001批次状态", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST"], "entity-batch-id"),

    # === 口语化/方言变体 ===
    ("活儿干到哪了", ["PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY"], "dialect-progress"),
    ("料够不够用", ["MATERIAL_BATCH_QUERY", "MATERIAL_LOW_STOCK_ALERT", "REPORT_INVENTORY"], "dialect-material-enough"),
    ("人到齐了没", ["ATTENDANCE_TODAY"], "dialect-all-present"),
    ("货发了吗", ["SHIPMENT_QUERY"], "dialect-shipped"),
    ("钱收了没", ["REPORT_FINANCE", "CUSTOMER_PURCHASE_HISTORY"], "dialect-payment"),

    # === 问题 vs 命令 ===
    ("为什么产量下降了", ["REPORT_TRENDS", "REPORT_PRODUCTION"], "question-why-prod-drop"),
    ("质量问题出在哪里", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY"], "question-quality-root"),
    ("怎么提高设备利用率", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY"], "question-improve-util"),
    ("谁负责这个批次", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST"], "question-who-owns"),
    ("这个月目标完成了吗", ["REPORT_KPI", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW"], "question-target-met"),

    # === 多维度/复合查询 ===
    ("今天产量和质检数据", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "QUALITY_STATS", None], "multi-prod-quality"),
    ("上周出勤率和加班情况", ["ATTENDANCE_STATS", "ATTENDANCE_HISTORY"], "multi-attend-overtime"),
    ("库存低于安全线的原料", ["MATERIAL_LOW_STOCK_ALERT", "REPORT_INVENTORY"], "multi-low-stock"),
    ("效率最高的产线是哪条", ["REPORT_EFFICIENCY", "EQUIPMENT_STATS", "REPORT_PRODUCTION"], "multi-best-line"),
    ("哪个供应商交货最准时", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", "SUPPLIER_RANKING"], "multi-best-supplier"),

    # === 时间范围变体 ===
    ("上周一的产量", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY"], "time-specific-day"),
    ("今天早班的出勤", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS"], "time-shift"),
    ("最近一个月的告警趋势", ["ALERT_STATS", "ALERT_LIST"], "time-month-trend"),
    ("去年同期销售对比", ["REPORT_TRENDS", "REPORT_FINANCE"], "time-yoy"),
    ("下周的排产计划", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_CREATE"], "time-next-week"),

    # === 操作类指令 ===
    ("帮我导出今天的产量报表", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY"], "action-export-report"),
    ("把这批原料标记为不合格", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_EXECUTE"], "action-mark-reject"),
    ("通知仓库准备出货", ["SHIPMENT_CREATE", "SHIPMENT_QUERY"], "action-notify-ship"),
    ("关闭这条告警", ["ALERT_RESOLVE", "ALERT_LIST"], "action-close-alert"),
    ("更新设备维护记录", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_UPDATE"], "action-update-maint"),

    # === 对比/分析类 ===
    ("A线和B线的产量对比", ["REPORT_PRODUCTION", "REPORT_TRENDS"], "compare-lines"),
    ("今天和昨天的出勤率对比", ["ATTENDANCE_STATS", "REPORT_TRENDS"], "compare-attend"),
    ("各车间的质检合格率", ["QUALITY_STATS", "REPORT_QUALITY"], "compare-quality-dept"),
    ("本月各产品的销售排名", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW"], "compare-sales-rank"),
    ("供应商价格对比", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST"], "compare-supplier-price"),

    # === 否定/纠正 ===
    ("不对，我要查的是上个月的", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "NONE"], "correct-wrong-month"),
    ("不是这个批次", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL", "NONE"], "correct-wrong-batch"),
    ("我说的不是告警，是质检", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "NONE"], "correct-not-alert"),
]

def test_intent(token, query, expected_intents, category):
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    try:
        r = requests.post(
            f'{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/recognize',
            headers=headers,
            json={'userInput': query},
            timeout=25
        )
        data = r.json()
        if not data.get('success'):
            return query, 'ERROR', None, None, category, data.get('message', 'unknown')

        intent_data = data.get('data', {})
        intent = intent_data.get('intentCode', 'NONE')
        confidence = intent_data.get('confidence', 0)
        method = intent_data.get('matchMethod', 'unknown')

        if 'NONE' in expected_intents and intent is None:
            return query, 'PASS', 'NONE', confidence, category, method

        passed = intent in expected_intents
        status = 'PASS' if passed else 'FAIL'
        return query, status, intent, confidence, category, method
    except Exception as e:
        return query, 'ERROR', None, None, category, str(e)

def main():
    print(f"=== v5 Intent Pipeline E2E Test - Round 4 ===")
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
        q, status, intent, conf, cat, method = test_intent(token, query, expected, category)
        results.append({
            'query': q, 'status': status, 'intent': intent,
            'confidence': conf, 'expected': expected, 'category': cat, 'method': method
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
        print(f"  [{icon}] [{cat}] \"{q}\" => {intent} ({conf_str}) via {method}" +
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
                print(f"  \"{r['query']}\" => {r['intent']} (expected {r['expected']}) [{r['category']}] via {r['method']}")

    methods = {}
    for r in results:
        m = r.get('method') or 'NONE'
        methods[m] = methods.get(m, 0) + 1
    print(f"\n--- Match method distribution ---")
    for m, c in sorted(methods.items(), key=lambda x: -x[1]):
        print(f"  {m}: {c}")

    report = {
        'timestamp': datetime.now().isoformat(),
        'test': 'v5_round4',
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
    report_path = f'tests/ai-intent/reports/v5_round4_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
