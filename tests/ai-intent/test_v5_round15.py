#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 15
Focus: PRODUCTION REALISM - queries that real factory workers would actually
       type on a mobile phone during daily operations. Voice-to-text errors,
       mobile keyboard shortcuts, worker slang, natural time references,
       action-target combos, negation, quantified queries, multi-part requests,
       and complaint/problem reporting.
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

# Round 15 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Voice-to-text artifacts (6 cases) =====
    # Homophone errors common in Chinese speech recognition
    # "产两" = voice misrecognition of "产量" (chanliang → changliang)
    ("今天产两多少", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "voice-changliang"),
    # "直检" = voice misrecognition of "质检" (zhijian)
    ("直检报告出来了吗", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY"], "voice-zhijian"),
    # "库村" = voice misrecognition of "库存" (kucun → kucun with wrong char)
    ("库村还有多少", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "voice-kucun"),
    # "发货" misheard as "罚款" - but context should still suggest shipment
    ("今天罚款了几单", ["SHIPMENT_QUERY", "SHIPMENT_STATS", "ORDER_LIST", None], "voice-fahuo"),
    # "保质期" misheard as "保质其"
    ("这批货保质其到什么时候", ["MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_DETAIL", "TRACE_BATCH", "MATERIAL_EXPIRING_ALERT"], "voice-baozhiqi"),
    # "设备" misheard as "社备" - still close enough phonetically
    ("社备运行正常吗", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", None], "voice-shebei"),

    # ===== 2. Mobile keyboard shortcuts (5 cases) =====
    # Partial pinyin that workers type quickly on mobile
    # "kcl" = pinyin abbreviation attempt for "看产量"
    ("kcl", [None, "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "mobile-kcl"),
    # "ck" = common abbreviation for "仓库" (warehouse)
    ("ck", [None, "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "mobile-ck"),
    # "sb" = abbreviation for "设备" (equipment) - also vulgar slang, system should handle gracefully
    ("sb状态", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", None], "mobile-sb"),
    # Quick numeric + text: workers type "3#" for "3号" (number 3)
    ("3#线产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None], "mobile-hash-number"),
    # Autocomplete artifact: double character from predictive text
    ("查查库存", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "mobile-double-tap"),

    # ===== 3. Worker slang/colloquial (6 cases) =====
    # Factory floor language - informal Chinese used by workers
    # "出了多少货" = how much product shipped (colloquial for shipment query)
    ("今天出了多少货", ["SHIPMENT_QUERY", "SHIPMENT_STATS", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "slang-output"),
    # "线上还有多少" = how much is still on the production line
    ("线上还有多少没做完", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_INVENTORY", None], "slang-wip"),
    # "东西够不够" = is there enough stuff (materials)
    ("东西够不够用", ["MATERIAL_LOW_STOCK_ALERT", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", None], "slang-enough"),
    # "上头" = colloquial for leadership/management, "催" = urging
    ("上头催单子了快看看", ["ORDER_STATUS", "ORDER_LIST", "PRODUCTION_STATUS_QUERY"], "slang-boss-rush"),
    # "跑了多少" = how many units ran (production output slang)
    ("今天跑了多少件", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "slang-run-count"),
    # "那边" = over there, vague spatial reference to another workshop/warehouse
    ("那边仓库还有料吗", ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "MATERIAL_LOW_STOCK_ALERT"], "slang-warehouse"),

    # ===== 4. Contextual time references (6 cases) =====
    # Natural time expressions workers actually use
    # "刚才" = just now
    ("刚才那批质检过了没", ["QUALITY_CHECK_QUERY", "PROCESSING_BATCH_DETAIL", "QUALITY_STATS"], "time-justmow"),
    # "上午" = this morning
    ("上午的产量报一下", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "time-morning"),
    # "前天" = day before yesterday
    ("前天的出勤怎么样", ["ATTENDANCE_STATS", "ATTENDANCE_TODAY"], "time-daybefore"),
    # "这礼拜" = this week (colloquial, vs formal "本周")
    ("这礼拜订单情况", ["ORDER_STATUS", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", "ORDER_TODAY"], "time-thisweek"),
    # "上个月底" = end of last month
    ("上个月底库存盘点了没", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "time-lastmonthend"),
    # "年后" = after Chinese New Year (very common factory time reference)
    ("年后复工到现在产了多少", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_TRENDS"], "time-afternewyear"),

    # ===== 5. Action + target combos (6 cases) =====
    # Verb-object combinations workers use in daily operations
    # "扫码查批次" = scan barcode to check batch
    ("扫码查批次", ["TRACE_BATCH", "PROCESSING_BATCH_DETAIL", "MATERIAL_BATCH_QUERY"], "action-scan-batch"),
    # "拍照上传" = take photo and upload (evidence/quality photo)
    ("拍照上传检验结果", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "FORM_GENERATION", None], "action-photo-upload"),
    # "打印标签" = print label
    ("打印这个批次的标签", ["PROCESSING_BATCH_DETAIL", "TRACE_BATCH", "FORM_GENERATION", None], "action-print-label"),
    # "导出报表" = export report
    ("把这个月的质检报表导出来", ["REPORT_QUALITY", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW"], "action-export-report"),
    # "录入数据" = enter/record data
    ("录入今天的生产数据", ["REPORT_PRODUCTION", "FORM_GENERATION", "PROCESSING_BATCH_COMPLETE", "PRODUCTION_STATUS_QUERY", None], "action-enter-data"),
    # "确认收货" = confirm goods receipt
    ("确认这批原料收货", ["MATERIAL_BATCH_QUERY", "ORDER_STATUS", "PROCESSING_BATCH_COMPLETE", "MATERIAL_BATCH_CREATE", None], "action-confirm-receipt"),

    # ===== 6. Negation with action (5 cases) =====
    # Workers telling the system to stop/cancel/hold operations
    # "别发货了" = don't ship it
    ("这单别发货了", ["ORDER_CANCEL", "SHIPMENT_QUERY", "ORDER_STATUS", None], "negate-stop-ship"),
    # "先不要质检" = hold off on quality check
    ("先不要质检这批", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "PROCESSING_BATCH_DETAIL", None], "negate-hold-qc"),
    # "暂停生产" = pause production
    ("3号线暂停生产", ["PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", "PROCESSING_BATCH_PAUSE", None], "negate-pause-prod"),
    # "不要了" = cancel/don't want it anymore
    ("那个订单不要了取消掉", ["ORDER_CANCEL", "ORDER_STATUS", "ORDER_DELETE"], "negate-cancel-order"),
    # "别删" = don't delete (worker worried about accidental deletion)
    ("别删那个批次记录", ["PROCESSING_BATCH_DETAIL", "MATERIAL_BATCH_QUERY", "DATA_BATCH_DELETE", "PROCESSING_BATCH_CANCEL", None], "negate-dont-delete"),

    # ===== 7. Quantified queries (5 cases) =====
    # Specific quantities, workshop numbers, batch counts
    # "还差50箱" = still short 50 boxes
    ("还差50箱才够今天的单", ["MATERIAL_LOW_STOCK_ALERT", "REPORT_INVENTORY", "ORDER_STATUS", "MATERIAL_BATCH_QUERY", None], "quant-shortage"),
    # "已经做了200件" = already made 200 pieces
    ("已经做了200件了还要做多少", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_DETAIL", "REPORT_PRODUCTION", None], "quant-progress"),
    # "第3车间" = workshop number 3
    ("第3车间今天出勤几个人", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS"], "quant-workshop"),
    # "5吨" = 5 tons
    ("仓库里还有没有5吨以上的面粉", ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "MATERIAL_LOW_STOCK_ALERT"], "quant-weight"),
    # "第二次" = second time
    ("这是第二次质检不合格了", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "ALERT_LIST"], "quant-repeat-fail"),

    # ===== 8. Multi-part natural requests (5 cases) =====
    # Realistic longer requests combining multiple information needs
    # Production + quality combined
    ("帮我看一下3号线的产量和质检情况",
     ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "multi-prod-quality"),
    # Inventory + order combined
    ("查下A仓的库存够不够发明天的订单",
     ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "ORDER_STATUS", "MATERIAL_LOW_STOCK_ALERT"], "multi-inv-order"),
    # Equipment + production impact
    ("2号包装机修好了没有能不能恢复生产",
     ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_RESUME"], "multi-equip-resume"),
    # Attendance + task assignment
    ("今天谁请假了活分给谁干",
     ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "multi-attendance-assign"),
    # Supplier + material combined
    ("张三那个供应商的豆油到了没有质量怎么样",
     ["SUPPLIER_LIST", "SUPPLIER_EVALUATE", "MATERIAL_BATCH_QUERY", "ORDER_STATUS", "SHIPMENT_QUERY", "QUALITY_STATS"], "multi-supplier-material"),

    # ===== 9. Complaint/problem reporting (6 cases) =====
    # Workers reporting issues encountered during production
    # Machine breakdown
    ("机器又坏了赶紧来修", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_ALERT_LIST", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST"], "complaint-machine-down"),
    # Temperature issue (cold chain)
    ("冷库温度太高了", ["COLD_CHAIN_TEMPERATURE", "ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_ALERT_LIST"], "complaint-temp-high"),
    # Material shortage
    ("原料不够用了赶紧补货", ["MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY"], "complaint-material-short"),
    # Quality issue found
    ("这批货颜色不对有问题", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "ALERT_LIST", "DISPOSITION_EXECUTE"], "complaint-quality-color"),
    # Equipment making noise (sensor/anomaly)
    ("1号线电机声音不正常", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_ALERT_LIST", "ALERT_LIST"], "complaint-abnormal-sound"),
    # Worker safety / environmental
    ("车间里味道很重是不是泄漏了", ["ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_ALERT_LIST", "COLD_CHAIN_TEMPERATURE", None], "complaint-smell-leak"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 15 ===")
    print(f"Focus: PRODUCTION REALISM - voice-to-text artifacts, mobile keyboard shortcuts,")
    print(f"       worker slang, contextual time references, action+target combos,")
    print(f"       negation, quantified queries, multi-part requests, complaint reporting")
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
        'test': 'v5_round15_production_realism',
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
    report_path = f'tests/ai-intent/reports/v5_round15_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
