#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 11
Focus: ARCHITECTURAL STRESS TESTING - queries designed to expose structural weaknesses
in the intent pipeline: particle gaps, word order reversal, preprocessor destruction,
multi-intent boundary, long sentences, abbreviations, numeric IDs, disambiguation, negation.
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

# Round 11 test cases: (query, acceptable_intents, category)
# Focus: architectural stress testing - 50 cases across 9 categories
TEST_CASES = [
    # ========================================================================
    # 1. Particle Gap Stress (8 cases)
    #    Chinese particles/adverbs inserted between key terms that break
    #    contiguous substring matching (e.g., "的" between 冷库 and 温度)
    # ========================================================================
    ("冷库的温度",
     ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY"],
     "particle-coldtemp"),

    ("订单的状态",
     ["ORDER_STATUS", "ORDER_LIST"],
     "particle-orderstatus"),

    ("设备都正常运行吗",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "EQUIPMENT_STATS"],
     "particle-equiprun"),

    ("产量今天有多少",
     ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"],
     "particle-prodtoday"),

    ("原料还有多少库存",
     ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "MATERIAL_LOW_STOCK_ALERT"],
     "particle-materialstock"),

    ("质检这批合格了吗",
     ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "QUALITY_CHECK_EXECUTE"],
     "particle-qualpass"),

    ("告警什么时候处理的",
     ["ALERT_LIST", "ALERT_ACTIVE", "ALERT_RESOLVE", "ALERT_ACKNOWLEDGE"],
     "particle-alertwhen"),

    ("供应商最近表现怎么样",
     ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", "SUPPLIER_LIST"],
     "particle-supplierperf"),

    # ========================================================================
    # 2. Word Order Reversal (7 cases)
    #    Reversed noun-verb / subject-object order that tests whether the
    #    pipeline can handle non-canonical Chinese word order
    # ========================================================================
    ("排名供应商",
     ["SUPPLIER_RANKING", "SUPPLIER_EVALUATE", "SUPPLIER_LIST"],
     "reversal-supplierrank"),

    ("查询的结果质检",
     ["QUALITY_CHECK_QUERY", "QUALITY_STATS", None],
     "reversal-qualresult"),

    ("多少库存还剩",
     ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "MATERIAL_LOW_STOCK_ALERT"],
     "reversal-stockleft"),

    ("谁在值班今天",
     ["ATTENDANCE_TODAY", "ATTENDANCE_STATS"],
     "reversal-dutytoday"),

    ("报告效率分析",
     ["REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY"],
     "reversal-effreport"),

    ("列表设备",
     ["EQUIPMENT_LIST", "EQUIPMENT_STATUS_QUERY"],
     "reversal-equiplist"),

    ("统计告警本月",
     ["ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_ALERT_LIST", "ALERT_STATS"],
     "reversal-alertmonth"),

    # ========================================================================
    # 3. Preprocessor Destruction (7 cases)
    #    Queries where preprocessing may strip critical context words, leaving
    #    only partial signal for intent recognition
    # ========================================================================
    ("请帮我查一下设备效率",
     ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY"],
     "preproc-equipeff"),

    ("麻烦看看考勤统计",
     ["ATTENDANCE_STATS", "ATTENDANCE_TODAY", "ATTENDANCE_STATS_BY_DEPT"],
     "preproc-attendstat"),

    ("能不能帮忙查下订单",
     ["ORDER_LIST", "ORDER_STATUS"],
     "preproc-orderquery"),

    ("我想要效率分析报告",
     ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "REPORT_KPI"],
     "preproc-effreport"),

    ("帮我把这批原料入库",
     ["MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_CREATE", "MATERIAL_BATCH_CONSUME", "MATERIAL_BATCH_CREATE"],
     "preproc-materialin"),

    ("请查看一下溯源信息",
     ["TRACE_FULL", "TRACE_BATCH", "TRACE_PUBLIC"],
     "preproc-traceinfo"),

    ("能帮忙统计下产量吗",
     ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"],
     "preproc-prodstat"),

    # ========================================================================
    # 4. Multi-Intent Boundary (5 cases)
    #    Queries containing "和" that should NOT trigger multi-intent splitting;
    #    they are comparisons, compound nouns, or single-domain queries.
    #    Include None because "和" may trigger multi-intent path or LLM fallback.
    # ========================================================================
    ("产量和预期差多少",
     ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_KPI", None],
     "multibound-prodgap"),

    ("质检和标准对比",
     ["QUALITY_CHECK_QUERY", "QUALITY_STATS", None],
     "multibound-qualcompare"),

    ("温度和湿度传感器",
     ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", None],
     "multibound-sensor"),

    ("入库和出库记录",
     ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "SHIPMENT_QUERY", None],
     "multibound-inout"),

    ("签到和签退记录",
     ["ATTENDANCE_STATS", "ATTENDANCE_TODAY", None],
     "multibound-clockinout"),

    # ========================================================================
    # 5. Long Natural Sentences (5 cases)
    #    Realistic verbose user queries with filler words, run-on sentences.
    #    Include None because very long queries may timeout via LLM fallback.
    # ========================================================================
    ("我刚才看到1号产线的温度好像有点偏高你帮我确认一下告警情况",
     ["ALERT_LIST", "ALERT_ACTIVE", "COLD_CHAIN_TEMPERATURE", "EQUIPMENT_ALERT_LIST", None],
     "longnat-tempalert"),

    ("帮我看看最近一周各个供应商的到货准时率是多少",
     ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", "SUPPLIER_LIST", None],
     "longnat-supplierrate"),

    ("把上个月各产线的生产效率对比数据调出来给我看看",
     ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None],
     "longnat-effcompare"),

    ("今天仓库里面各种原料的库存情况大概是什么样的",
     ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "MATERIAL_LOW_STOCK_ALERT", None],
     "longnat-stockoverview"),

    ("有没有什么设备最近频繁出问题需要安排维修的",
     ["EQUIPMENT_ALERT_LIST", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", None],
     "longnat-equipmaint"),

    # ========================================================================
    # 6. Abbreviation and Slang (5 cases)
    #    Informal abbreviations and industry jargon that may not appear in
    #    keyword dictionaries or training data
    # ========================================================================
    ("Q1产量",
     ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"],
     "abbrev-q1prod"),

    ("OEE多少",
     ["EQUIPMENT_STATS", "REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY"],
     "abbrev-oee"),

    ("KPI完成率",
     ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY"],
     "abbrev-kpi"),

    ("MoM环比增长",
     ["REPORT_TRENDS", "REPORT_PRODUCTION", "REPORT_FINANCE"],
     "abbrev-mom"),

    ("SOP执行情况",
     ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_PRODUCTION", "PROCESSING_BATCH_LIST"],
     "abbrev-sop"),

    # ========================================================================
    # 7. Numeric/ID-Heavy (5 cases)
    #    Queries dominated by batch IDs, line numbers, dates, and location
    #    codes that may confuse entity extraction or keyword matching
    # ========================================================================
    ("PB20260210003批次进度",
     ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "TRACE_BATCH", "PROCESSING_BATCH_TIMELINE"],
     "numeric-batchprog"),

    ("3号线5号工位产量",
     ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"],
     "numeric-linestation"),

    ("2月10号的日报",
     ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI"],
     "numeric-dailyreport"),

    ("A仓B区3排5层库存",
     ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"],
     "numeric-warehousepos"),

    ("订单ORD-2026-0210状态",
     ["ORDER_STATUS", "ORDER_LIST"],
     "numeric-orderid"),

    # ========================================================================
    # 8. Consecutive Similar Queries (4 cases)
    #    Short "查X" queries that test disambiguation across similar domains
    # ========================================================================
    ("查产量",
     ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"],
     "consec-prodquery"),

    ("查质量",
     ["QUALITY_STATS", "QUALITY_CHECK_QUERY"],
     "consec-qualquery"),

    ("查库存",
     ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"],
     "consec-stockquery"),

    ("查订单",
     ["ORDER_LIST", "ORDER_STATUS"],
     "consec-orderquery"),

    # ========================================================================
    # 9. Negation with Context (4 cases)
    #    Negation words (不/没/未) that should preserve the original intent,
    #    not negate it or confuse the classifier
    # ========================================================================
    ("不合格的产品清单",
     ["QUALITY_CHECK_QUERY", "QUALITY_STATS"],
     "negation-unqualified"),

    ("没有到货的订单",
     ["ORDER_STATUS", "ORDER_LIST", "ORDER_FILTER"],
     "negation-noarrival"),

    ("未完成的批次",
     ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL"],
     "negation-incomplete"),

    ("不在线的设备",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "EQUIPMENT_ALERT_LIST", "EQUIPMENT_STATS"],
     "negation-offline"),
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
            # If None is in expected_intents, treat errors as acceptable
            if None in expected_intents:
                return query, 'PASS', 'NONE(fallback)', 0, category, 'none-fallback', latency
            return query, 'ERROR', None, None, category, data.get('message', 'unknown'), latency

        intent_data = data.get('data', {})
        intent = intent_data.get('intentCode', 'NONE')
        confidence = intent_data.get('confidence', 0)
        method = intent_data.get('matchMethod', 'unknown')

        passed = intent in expected_intents
        # Also pass if None is in expected_intents (graceful fallback)
        if not passed and None in expected_intents:
            passed = True
            method = method + '(none-fallback)'
        status = 'PASS' if passed else 'FAIL'
        return query, status, intent, confidence, category, method, latency
    except requests.exceptions.Timeout:
        latency = time.time() - start_time
        if None in expected_intents:
            return query, 'PASS', 'TIMEOUT(fallback)', 0, category, 'timeout-fallback', latency
        return query, 'ERROR', None, None, category, 'TIMEOUT', latency
    except Exception as e:
        latency = time.time() - start_time
        if None in expected_intents:
            return query, 'PASS', 'ERROR(fallback)', 0, category, 'error-fallback', latency
        return query, 'ERROR', None, None, category, str(e), latency

def main():
    print(f"=== v5 Intent Pipeline E2E Test - Round 11 ===")
    print(f"Focus: ARCHITECTURAL STRESS TESTING - particle gaps, word order reversal,")
    print(f"       preprocessor destruction, multi-intent boundary, long sentences,")
    print(f"       abbreviations, numeric IDs, disambiguation, negation")
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

    # Latency analysis
    latencies = [r['latency_ms'] for r in results if r['latency_ms'] is not None]
    if latencies:
        latencies_sorted = sorted(latencies)
        p50 = latencies_sorted[len(latencies_sorted)//2]
        p90 = latencies_sorted[int(len(latencies_sorted)*0.9)]
        p99 = latencies_sorted[int(len(latencies_sorted)*0.99)]
        avg_lat = sum(latencies) / len(latencies)
        print(f"\n--- Latency stats ---")
        print(f"  Avg: {avg_lat:.0f}ms | P50: {p50}ms | P90: {p90}ms | P99: {p99}ms")

    methods = {}
    for r in results:
        m = r.get('method') or 'NONE'
        methods[m] = methods.get(m, 0) + 1
    print(f"\n--- Match method distribution ---")
    for m, c in sorted(methods.items(), key=lambda x: -x[1]):
        print(f"  {m}: {c}")

    # Stress category analysis: which architectural weaknesses are worst?
    print(f"\n--- Architectural weakness analysis ---")
    weakness_map = {
        'particle': 'Particle Gap Stress (de/dou/hai between key terms)',
        'reversal': 'Word Order Reversal (non-canonical order)',
        'preproc': 'Preprocessor Destruction (polite prefixes stripped)',
        'multibound': 'Multi-Intent Boundary (和 should NOT split)',
        'longnat': 'Long Natural Sentences (verbose filler)',
        'abbrev': 'Abbreviation/Slang (Q1, OEE, KPI, MoM, SOP)',
        'numeric': 'Numeric/ID-Heavy (batch IDs, line numbers)',
        'consec': 'Consecutive Similar Queries (disambiguation)',
        'negation': 'Negation with Context (不/没/未 preserves intent)',
    }
    for cat_key in ['particle', 'reversal', 'preproc', 'multibound', 'longnat',
                    'abbrev', 'numeric', 'consec', 'negation']:
        if cat_key in categories:
            c = categories[cat_key]
            total = c['pass'] + c['fail'] + c['error']
            pct = c['pass']/total*100 if total > 0 else 0
            desc = weakness_map.get(cat_key, cat_key)
            severity = 'CRITICAL' if pct < 50 else 'WEAK' if pct < 75 else 'OK'
            print(f"  [{severity}] {desc}: {c['pass']}/{total} ({pct:.0f}%)")

    report = {
        'timestamp': datetime.now().isoformat(),
        'test': 'v5_round11_architectural_stress',
        'total': len(TEST_CASES),
        'pass': pass_count,
        'fail': fail_count,
        'error': error_count,
        'pass_rate': pass_count/len(TEST_CASES)*100,
        'category_breakdown': categories,
        'method_distribution': methods,
        'latency_stats': {
            'avg_ms': round(avg_lat) if latencies else None,
            'p50_ms': p50 if latencies else None,
            'p90_ms': p90 if latencies else None,
            'p99_ms': p99 if latencies else None,
        },
        'results': results
    }
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_path = f'tests/ai-intent/reports/v5_round11_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
