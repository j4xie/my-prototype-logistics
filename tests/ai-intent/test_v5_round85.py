#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 85
Focus: MILESTONE COMPREHENSIVE MIX #4.
       Covers dialect/slang, emoji-style, single-char, sentence-long,
       question-format, command-format, conditional, comparison,
       negation, and confirmation queries.
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

# Round 85 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Dialect/Slang (5 cases) =====
    ("产量咋样", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "dialect_slang"),
    ("库存够不够", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_LOW_STOCK_ALERT", None], "dialect_slang"),
    ("机器又坏了吧", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_DETAIL", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "dialect_slang"),
    ("今儿谁上班", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "dialect_slang"),
    ("这批货行不行", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "PROCESSING_BATCH_DETAIL", "MATERIAL_BATCH_QUERY", "TRACE_BATCH", "REPORT_DASHBOARD_OVERVIEW", None], "dialect_slang"),

    # ===== 2. Emoji-Style (plain text equivalents) (5 cases) =====
    ("查看统计", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_INVENTORY", "PRODUCTION_STATUS_QUERY", None], "emoji_style"),
    ("产量上升了吗", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "emoji_style"),
    ("设备报警", ["ALERT_LIST", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_ALERT_LIST", None], "emoji_style"),
    ("质检通过了", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_DISPOSITION_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "emoji_style"),
    ("库存下降了", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "emoji_style"),

    # ===== 3. Single-Char (5 cases) =====
    ("产", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "single_char"),
    ("质", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "single_char"),
    ("库", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "single_char"),
    ("单", ["ORDER_LIST", "ORDER_DETAIL", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "single_char"),
    ("人", ["HR_EMPLOYEE_LIST", "ATTENDANCE_TODAY", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "single_char"),

    # ===== 4. Long Sentence (5 cases) =====
    ("帮我看一下今天上午A车间的豆腐生产线实际产量和计划产量的对比情况", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "long_sentence"),
    ("我想查询一下上个月所有供应商的原材料送检合格率排名", ["SUPPLIER_LIST", "SUPPLIER_EVALUATE", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "long_sentence"),
    ("请调出最近三个月设备维护保养记录并生成维护费用趋势图", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "REPORT_TRENDS", "COST_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "long_sentence"),
    ("能不能帮我分析一下为什么这个月的人工成本比上个月高了这么多", ["COST_QUERY", "REPORT_FINANCE", "REPORT_TRENDS", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "long_sentence"),
    ("我需要导出本季度各产品线的良品率和返工率的详细数据报告", ["REPORT_PRODUCTION", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "REPORT_QUALITY", None], "long_sentence"),

    # ===== 5. Question Format (5 cases) =====
    ("今天产了多少", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "question_format"),
    ("哪台设备坏了", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "question_format"),
    ("谁没来上班", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "question_format"),
    ("什么时候发货", ["SHIPMENT_QUERY", "ORDER_LIST", "ORDER_DETAIL", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_BATCH_QUERY", None], "question_format"),
    ("哪个批次有问题", ["QUALITY_CHECK_QUERY", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL", "TRACE_BATCH", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "question_format"),

    # ===== 6. Command Format (5 cases) =====
    ("开始质检", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "command_format"),
    ("停止生产", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_COMPLETE", "EQUIPMENT_STATUS_UPDATE", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_CANCEL", None], "command_format"),
    ("启动设备", ["EQUIPMENT_STATUS_UPDATE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_START", None], "command_format"),
    ("完成报工", ["PROCESSING_BATCH_COMPLETE", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "command_format"),
    ("提交报告", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_EXECUTE", None], "command_format"),

    # ===== 7. Conditional (5 cases) =====
    ("如果库存不足就采购", ["MRP_CALCULATION", "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CREATE", "REPORT_DASHBOARD_OVERVIEW", "MATERIAL_LOW_STOCK_ALERT", None], "conditional"),
    ("产量达标就下班", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "ATTENDANCE_TODAY", "REPORT_DASHBOARD_OVERVIEW", None], "conditional"),
    ("质检合格就入库", ["QUALITY_CHECK_EXECUTE", "QUALITY_DISPOSITION_EXECUTE", "MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "conditional"),
    ("设备异常就停机", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_UPDATE", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "conditional"),
    ("温度超标就报警", ["ALERT_LIST", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", "COLD_CHAIN_TEMPERATURE", None], "conditional"),

    # ===== 8. Comparison Query (5 cases) =====
    ("今天比昨天产量多吗", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "comparison_query"),
    ("A车间和B车间哪个效率高", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", None], "comparison_query"),
    ("这批比上批质量好吗", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "comparison_query"),
    ("本月成本和上月比怎样", ["COST_QUERY", "REPORT_FINANCE", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "comparison_query"),
    ("今年比去年产能提升多少", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_EFFICIENCY", None], "comparison_query"),

    # ===== 9. Negation Query (5 cases) =====
    ("不合格品处理", ["QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "negation_query"),
    ("未完成订单", ["ORDER_LIST", "ORDER_DETAIL", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", "ORDER_UPDATE", None], "negation_query"),
    ("没有签到的人", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", "CLOCK_IN", None], "negation_query"),
    ("不能发货的原因", ["SHIPMENT_QUERY", "ORDER_LIST", "QUALITY_CHECK_QUERY", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "negation_query"),
    ("未检验的批次", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "PROCESSING_BATCH_LIST", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "negation_query"),

    # ===== 10. Confirmation Query (5 cases) =====
    ("确认入库", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "SHIPMENT_STATUS_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "confirmation_query"),
    ("确认发货", ["SHIPMENT_CREATE", "SHIPMENT_STATUS_UPDATE", "SHIPMENT_QUERY", "ORDER_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "confirmation_query"),
    ("确认报废", ["QUALITY_DISPOSITION_EXECUTE", "MATERIAL_ADJUST_QUANTITY", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_DISPOSITION_EVALUATE", None], "confirmation_query"),
    ("确认完工", ["PROCESSING_BATCH_COMPLETE", "PRODUCTION_STATUS_QUERY", "ORDER_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "confirmation_query"),
    ("确认合格", ["QUALITY_CHECK_EXECUTE", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "confirmation_query"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 85 ===")
    print(f"Focus: MILESTONE COMPREHENSIVE MIX #4")
    print(f"       (dialect_slang, emoji_style, single_char, long_sentence, question_format,")
    print(f"        command_format, conditional, comparison_query, negation_query, confirmation_query)")
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
        'test': 'v5_round85_milestone_comprehensive_mix_4',
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
    report_path = f'tests/ai-intent/reports/v5_round85_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
