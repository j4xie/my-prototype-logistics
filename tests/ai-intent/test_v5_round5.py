#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 5
Extreme edge cases: typos, homophones, abbreviations, negation commands,
numeric-heavy, permission queries, mixed formality, run-on sentences,
emoji-laden, zero-context follow-ups.
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

# Round 5 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # === 错别字/近似表达 ===
    ("查一下苦存", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "typo-kucun"),
    ("生产报高", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST"], "typo-baogao"),
    ("设北维修", ["EQUIPMENT_MAINTENANCE"], "typo-shebei"),
    ("智检报告", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "NONE"], "typo-zhijian"),
    ("出请统计", ["ATTENDANCE_STATS", "ATTENDANCE_TODAY", "REPORT_DASHBOARD_OVERVIEW", "NONE"], "typo-chuqin"),

    # === 超长自然语句 ===
    # Note: "和" triggers multi-intent detection, so this goes through LLM/multi-intent path
    ("帮我查一下上个月车间A的生产效率报告，最好包含每天的产量数据和设备利用率",
     ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "EQUIPMENT_STATS", "REPORT_DASHBOARD_OVERVIEW", "NONE"], "long-efficiency-report"),
    ("我想了解一下最近三个月以来我们工厂所有产线的质量检查合格率变化趋势",
     ["QUALITY_STATS", "REPORT_QUALITY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW"], "long-quality-trend"),
    ("麻烦把今天早上到现在为止所有车间的产量汇总一下发给我",
     ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "long-today-summary"),

    # === 缩写/简称 ===
    ("OEE", ["EQUIPMENT_STATS", "REPORT_EFFICIENCY"], "abbrev-oee"),
    ("SOP", ["QUALITY_CHECK_QUERY", "PROCESSING_BATCH_LIST", "NONE"], "abbrev-sop"),
    ("KPI", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW"], "abbrev-kpi"),
    ("MRP", ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "MRP_CALCULATION", "NONE"], "abbrev-mrp"),
    ("QC", ["QUALITY_CHECK_QUERY", "QUALITY_STATS"], "abbrev-qc"),

    # === 否定/取消类指令 ===
    ("不要发货了", ["SHIPMENT_QUERY", "ORDER_STATUS", "NONE"], "negate-no-ship"),
    ("暂停生产", ["PROCESSING_BATCH_PAUSE", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "NONE"], "negate-pause-prod"),
    ("取消这个订单", ["ORDER_DELETE", "ORDER_STATUS", "ORDER_LIST", "NONE"], "negate-cancel-order"),
    ("别出库了", ["MATERIAL_BATCH_QUERY", "SHIPMENT_QUERY", "NONE"], "negate-no-outbound"),
    ("停机检修", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_UPDATE", "EQUIPMENT_STOP"], "negate-stop-maint"),

    # === 纯数字/编号查询 ===
    ("BN20260209001", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "NONE"], "numeric-batch-id"),
    ("F001", ["NONE", "REPORT_DASHBOARD_OVERVIEW"], "numeric-factory-id"),
    ("查下3号线", ["PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST"], "numeric-line3"),

    # === 反问/确认类 ===
    ("产量达标了吗", ["REPORT_KPI", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "confirm-target"),
    ("库存够用吗", ["MATERIAL_LOW_STOCK_ALERT", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "confirm-stock"),
    ("质检通过了吗", ["QUALITY_CHECK_QUERY", "QUALITY_STATS"], "confirm-quality"),
    ("设备都正常吗", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST"], "confirm-equip"),
    ("今天有人迟到吗", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", "ATTENDANCE_ANOMALY"], "confirm-late"),

    # === 口语化连续表达 ===
    ("看看厂里啥情况", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY"], "casual-factory-status"),
    ("仓库那边忙不忙", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "SHIPMENT_QUERY"], "casual-warehouse"),
    ("质量这块怎么说", ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_QUALITY"], "casual-quality"),
    ("最近效益好不好", ["REPORT_FINANCE", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW"], "casual-profit"),
    ("工人都到了吧", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS"], "casual-attendance"),

    # === 带语气词 ===
    ("唉，设备又坏了", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY"], "mood-equip-broken"),
    ("哎呀库存不够了吧", ["MATERIAL_LOW_STOCK_ALERT", "REPORT_INVENTORY"], "mood-stock-low"),
    ("嗯查下今天产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "mood-check-prod"),

    # === 指标类精确查询 ===
    ("良品率", ["QUALITY_STATS", "REPORT_QUALITY", "REPORT_KPI"], "metric-yield"),
    ("废品率", ["QUALITY_STATS", "REPORT_QUALITY"], "metric-scrap"),
    ("人均产量", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "REPORT_KPI"], "metric-per-capita"),
    ("成本分析", ["REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", "COST_TREND_ANALYSIS"], "metric-cost"),
    ("交货准时率", ["SUPPLIER_EVALUATE", "SHIPMENT_QUERY", "REPORT_KPI"], "metric-on-time"),

    # === 跨模块复合 ===
    ("质检不合格的批次要退货", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "QUALITY_STATS", "SHIPMENT_QUERY"], "cross-reject-return"),
    ("设备停了影响产量了", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "PRODUCTION_STATUS_QUERY", "EQUIPMENT_STOP"], "cross-equip-prod"),
    ("原料到了赶紧排产", ["MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_CREATE", "SHIPMENT_QUERY"], "cross-material-plan"),
    ("订单催了加快发货", ["ORDER_STATUS", "SHIPMENT_QUERY", "SHIPMENT_CREATE"], "cross-rush-ship"),

    # === 角色特定 ===
    ("我要看总经理日报", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", "REPORT_PRODUCTION"], "role-ceo-daily"),
    ("车间主任要的报表", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW"], "role-workshop-report"),
    ("给采购部看的供应商评估", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST"], "role-procurement"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 5 ===")
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

    if error_count > 0:
        print(f"\n--- Error queries ---")
        for r in results:
            if r['status'] == 'ERROR':
                print(f"  \"{r['query']}\" => {r['method']} [{r['category']}]")

    methods = {}
    for r in results:
        m = r.get('method') or 'NONE'
        methods[m] = methods.get(m, 0) + 1
    print(f"\n--- Match method distribution ---")
    for m, c in sorted(methods.items(), key=lambda x: -x[1]):
        print(f"  {m}: {c}")

    report = {
        'timestamp': datetime.now().isoformat(),
        'test': 'v5_round5',
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
    report_path = f'tests/ai-intent/reports/v5_round5_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
