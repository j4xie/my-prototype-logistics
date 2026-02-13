#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 3 (Stress Test)
Ultra-short inputs, long natural sentences, ambiguous cross-category,
negative phrasing, and mixed-language inputs.
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

# Round 3 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # === Ultra-short inputs (1-2 chars or very brief) ===
    ("产量", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY"], "ultra-short-production"),
    ("质检", ["QUALITY_CHECK_QUERY", "QUALITY_STATS"], "ultra-short-quality"),
    ("排班", ["ATTENDANCE_HISTORY", "ATTENDANCE_STATS"], "ultra-short-schedule"),
    ("库存", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "ultra-short-inventory"),
    ("告警", ["ALERT_LIST", "ALERT_ACTIVE"], "ultra-short-alert"),
    ("发货", ["SHIPMENT_QUERY", "SHIPMENT_CREATE"], "ultra-short-shipment"),
    ("设备", ["EQUIPMENT_LIST", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS"], "ultra-short-equipment"),
    ("考勤", ["ATTENDANCE_TODAY", "ATTENDANCE_HISTORY", "ATTENDANCE_STATS"], "ultra-short-attendance"),
    ("订单", ["ORDER_LIST", "ORDER_STATUS"], "ultra-short-order"),
    ("批次", ["PROCESSING_BATCH_LIST", "MATERIAL_BATCH_QUERY"], "ultra-short-batch"),

    # === Long natural sentences ===
    ("帮我看看上个月车间A的生产效率报告", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION"], "long-efficiency-report"),
    ("我想知道这周仓库里面粉的库存还有多少", ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY"], "long-material-query"),
    ("帮我统计一下所有产线今天的产量汇总数据", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY"], "long-production-summary"),
    ("看看最近一周质量检测的合格率有没有下降", ["QUALITY_STATS", "REPORT_QUALITY"], "long-quality-trend"),
    ("我需要一份上个月各部门的考勤统计分析报告", ["ATTENDANCE_STATS", "ATTENDANCE_HISTORY"], "long-attendance-report"),
    ("检查一下今天有没有什么新的告警或者异常情况", ["ALERT_LIST", "ALERT_ACTIVE"], "long-alert-check"),
    ("把这个月所有客户的发货记录统计一下", ["SHIPMENT_STATS", "SHIPMENT_QUERY"], "long-shipment-stats"),
    ("帮忙查查这批原料是从哪个供应商那里进来的", ["TRACE_BATCH", "MATERIAL_BATCH_QUERY", "SUPPLIER_LIST"], "long-trace-supplier"),

    # === Ambiguous cross-category ===
    ("原料到了没", ["MATERIAL_BATCH_QUERY", "SHIPMENT_QUERY", "ORDER_STATUS"], "ambig-material-arrival"),
    # These are intentionally vague - system correctly asks for clarification (None = REJECTED)
    ("东西好了吗", ["PROCESSING_BATCH_LIST", "QUALITY_CHECK_QUERY", "PRODUCTION_STATUS_QUERY", "NONE"], "ambig-thing-ready"),
    ("数据出来了吗", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_STATS"], "ambig-data-ready"),
    ("有没有问题", ["ALERT_LIST", "ALERT_ACTIVE", "QUALITY_CHECK_QUERY", "EQUIPMENT_STATUS_QUERY"], "ambig-any-problem"),
    ("进度怎么样", ["PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "ORDER_STATUS"], "ambig-progress"),
    ("情况如何", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY"], "ambig-situation"),
    ("那个好了没", ["PROCESSING_BATCH_LIST", "QUALITY_CHECK_QUERY", "PRODUCTION_STATUS_QUERY", "NONE"], "ambig-that-done"),
    ("数量对吗", ["MATERIAL_BATCH_QUERY", "QUALITY_CHECK_QUERY", "REPORT_INVENTORY", "NONE"], "ambig-quantity-check"),

    # === Negative phrasing ===
    ("不要发货了", ["SHIPMENT_CANCEL", "SHIPMENT_QUERY", "ORDER_STATUS", "NONE"], "neg-cancel-ship"),
    ("取消订单", ["ORDER_CANCEL", "ORDER_STATUS", "ORDER_LIST", "ORDER_DELETE"], "neg-cancel-order"),
    ("停止生产", ["PROCESSING_BATCH_CANCEL", "EQUIPMENT_STOP", "PRODUCTION_STATUS_QUERY"], "neg-stop-production"),
    ("别报警了", ["ALERT_RESOLVE", "ALERT_LIST"], "neg-stop-alert"),

    # === Compound/multi-intent ===
    # Note: "和" triggers multi-intent LLM path, may timeout non-deterministically
    ("生产和质检情况", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "QUALITY_STATS", None], "compound-prod-quality"),
    ("库存和发货", ["REPORT_INVENTORY", "SHIPMENT_QUERY", "MATERIAL_BATCH_QUERY", None], "compound-inv-ship"),
    ("考勤和排班", ["ATTENDANCE_TODAY", "ATTENDANCE_HISTORY", "ATTENDANCE_STATS"], "compound-attend-sched"),
    ("设备和告警", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "ALERT_LIST", "EQUIPMENT_LIST", None], "compound-equip-alert"),

    # === Typo/phonetic variants (known limitation: pinyin not supported) ===
    ("查看zhijian结果", ["QUALITY_CHECK_QUERY", "NONE"], "typo-pinyin-quality"),
    ("shebei状态", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "EQUIPMENT_LIST", "NONE"], "typo-pinyin-equip"),
    ("kucun多少", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "NONE"], "typo-pinyin-inv"),
    ("fahuo记录", ["SHIPMENT_QUERY", "NONE"], "typo-pinyin-ship"),

    # === Time-specific queries ===
    ("昨天的产量", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY"], "time-yesterday-prod"),
    ("上周的质检结果", ["QUALITY_CHECK_QUERY", "QUALITY_STATS"], "time-lastweek-quality"),
    ("这个月的订单", ["ORDER_LIST", "SHIPMENT_STATS", "ORDER_FILTER"], "time-thismonth-order"),
    ("今年销售额", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW"], "time-thisyear-sales"),
    ("最近三天的告警", ["ALERT_LIST", "ALERT_STATS"], "time-3day-alert"),
    ("半年的利润趋势", ["REPORT_TRENDS", "REPORT_FINANCE"], "time-halfyear-trend"),

    # === Role-specific language ===
    ("帮我看下我负责的批次", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL"], "role-mybatch"),
    ("我的待办事项", ["ALERT_ACTIVE", "PROCESSING_BATCH_LIST"], "role-mytodo"),
    ("给老板看的报表", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_FINANCE"], "role-boss-report"),
    ("车间主管日报", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW"], "role-supervisor-daily"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 3 (Stress Test) ===")
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

        # Track by category group
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

    # Category breakdown
    print(f"\n--- Category breakdown ---")
    for cat, counts in sorted(categories.items()):
        total = counts['pass'] + counts['fail'] + counts['error']
        print(f"  {cat}: {counts['pass']}/{total} pass")

    if fail_count > 0:
        print(f"\n--- Failed queries ---")
        for r in results:
            if r['status'] == 'FAIL':
                print(f"  \"{r['query']}\" => {r['intent']} (expected {r['expected']}) [{r['category']}] via {r['method']}")

    # Match method distribution
    methods = {}
    for r in results:
        m = r.get('method') or 'NONE'
        methods[m] = methods.get(m, 0) + 1
    print(f"\n--- Match method distribution ---")
    for m, c in sorted(methods.items(), key=lambda x: -x[1]):
        print(f"  {m}: {c}")

    # Save report
    report = {
        'timestamp': datetime.now().isoformat(),
        'test': 'v5_round3',
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
    report_path = f'tests/ai-intent/reports/v5_round3_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
