#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 91
Focus: LABORATORY & TESTING queries for food manufacturing.
       Covers sample_mgmt, lab_equipment, test_method, result_report,
       micro_test, chem_test, sensory_eval, outsource_test, and lab_compliance.
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

# Round 91 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Sample Management (6 cases) =====
    ("查看样品管理记录", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_STATS", "MATERIAL_BATCH_QUERY", "REPORT_QUALITY", None], "sample_mgmt"),
    ("今天的取样记录有哪些", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_STATS", "MATERIAL_BATCH_QUERY", "REPORT_QUALITY", None], "sample_mgmt"),
    ("查询样品编号SP20260210", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "MATERIAL_BATCH_QUERY", "REPORT_QUALITY", None], "sample_mgmt"),
    ("留样管理情况汇总", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "MATERIAL_BATCH_QUERY", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", None], "sample_mgmt"),
    ("样品入库登记", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CREATE", None], "sample_mgmt"),
    ("到期样品销毁清单", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "MATERIAL_BATCH_QUERY", "REPORT_QUALITY", "ALERT_LIST", None], "sample_mgmt"),

    # ===== 2. Lab Equipment (5 cases) =====
    ("实验室设备运行状态", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "QUALITY_CHECK_QUERY", None], "lab_equipment"),
    ("仪器校准到期提醒", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "ALERT_LIST", "QUALITY_CHECK_QUERY", "MATERIAL_EXPIRING_ALERT", None], "lab_equipment"),
    ("试剂库存管理查询", ["MATERIAL_BATCH_QUERY", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", "REPORT_INVENTORY", None], "lab_equipment"),
    ("实验室温湿度监控数据", ["COLD_CHAIN_TEMPERATURE", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", "ALERT_LIST", None], "lab_equipment"),
    ("查看设备校验证书", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "EQUIPMENT_LIST", None], "lab_equipment"),

    # ===== 3. Test Method (6 cases) =====
    ("查看当前使用的检测方法", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_STATS", "REPORT_QUALITY", None], "test_method"),
    ("GB标准检测方法查询", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", None], "test_method"),
    ("方法验证报告查看", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "test_method"),
    ("检测限是多少", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_STATS", "REPORT_QUALITY", None], "test_method"),
    ("方法偏差分析结果", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", "REPORT_TRENDS", None], "test_method"),
    ("分析方法适用性评估", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", "REPORT_TRENDS", "QUALITY_DISPOSITION_EVALUATE", None], "test_method"),

    # ===== 4. Result & Report (5 cases) =====
    ("查看今天的检测结果", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", None], "result_report"),
    ("生成本批次检测报告", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", "QUALITY_STATS", None], "result_report"),
    ("COA证书出具情况", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "QUALITY_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "result_report"),
    ("导出检测数据", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", None], "result_report"),
    ("检测结果审核流程", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", "QUALITY_STATS", None], "result_report"),

    # ===== 5. Microbiology Testing (6 cases) =====
    ("微生物检测结果汇总", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", "QUALITY_CHECK_EXECUTE", None], "micro_test"),
    ("菌落总数检测超标了吗", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "QUALITY_CHECK_EXECUTE", "ALERT_LIST", "REPORT_QUALITY", None], "micro_test"),
    ("大肠菌群检测报告", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", "QUALITY_CHECK_EXECUTE", None], "micro_test"),
    ("致病菌检测有没有异常", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "QUALITY_CHECK_EXECUTE", "ALERT_LIST", "REPORT_QUALITY", None], "micro_test"),
    ("霉菌酵母计数结果查询", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", None], "micro_test"),
    ("沙门氏菌检出情况", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "QUALITY_CHECK_EXECUTE", "ALERT_LIST", "REPORT_QUALITY", None], "micro_test"),

    # ===== 6. Chemical Testing (5 cases) =====
    ("化学检测指标查看", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", None], "chem_test"),
    ("重金属检测是否合格", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "QUALITY_CHECK_EXECUTE", "ALERT_LIST", "REPORT_QUALITY", None], "chem_test"),
    ("农残检测结果查询", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", None], "chem_test"),
    ("添加剂含量检测数据", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", None], "chem_test"),
    ("理化指标检测报告", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", None], "chem_test"),

    # ===== 7. Sensory Evaluation (6 cases) =====
    ("感官评价结果查看", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", None], "sensory_eval"),
    ("产品色泽检测记录", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_STATS", "REPORT_QUALITY", None], "sensory_eval"),
    ("气味检测有没有异味", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_STATS", "ALERT_LIST", "REPORT_QUALITY", None], "sensory_eval"),
    ("本批次口感评分多少", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", None], "sensory_eval"),
    ("外观检查合格率", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", "REPORT_TRENDS", None], "sensory_eval"),
    ("质地评估结果分析", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", "REPORT_TRENDS", "QUALITY_DISPOSITION_EVALUATE", None], "sensory_eval"),

    # ===== 8. Outsource Testing (5 cases) =====
    ("外检委托单查询", ["QUALITY_CHECK_QUERY", "SUPPLIER_EVALUATE", "REPORT_QUALITY", "QUALITY_STATS", None], "outsource_test"),
    ("第三方检测进度跟踪", ["QUALITY_CHECK_QUERY", "SUPPLIER_EVALUATE", "REPORT_QUALITY", "QUALITY_STATS", None], "outsource_test"),
    ("外送样品物流状态", ["QUALITY_CHECK_QUERY", "MATERIAL_BATCH_QUERY", "SUPPLIER_EVALUATE", "SHIPMENT_STATUS_UPDATE", None], "outsource_test"),
    ("外检报告接收情况", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "SUPPLIER_EVALUATE", "QUALITY_STATS", None], "outsource_test"),
    ("检测费用统计", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", "SUPPLIER_EVALUATE", None], "outsource_test"),

    # ===== 9. Lab Compliance (6 cases) =====
    ("实验室资质查看", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "QUALITY_STATS", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "lab_compliance"),
    ("CNAS认证状态查询", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "QUALITY_STATS", "EQUIPMENT_STATUS_QUERY", None], "lab_compliance"),
    ("实验室内部审核记录", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_EXECUTE", None], "lab_compliance"),
    ("能力验证参加结果", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", "REPORT_TRENDS", None], "lab_compliance"),
    ("实验室安全检查记录", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "REPORT_QUALITY", None], "lab_compliance"),
    ("实验室原始记录查询", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", None], "lab_compliance"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 91 ===")
    print(f"Focus: LABORATORY & TESTING queries")
    print(f"       (sample_mgmt, lab_equipment, test_method, result_report,")
    print(f"        micro_test, chem_test, sensory_eval, outsource_test, lab_compliance)")
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
        'test': 'v5_round91_laboratory_testing',
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
    report_path = f'tests/ai-intent/reports/v5_round91_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
