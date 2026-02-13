#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 69
Focus: DATA IMPORT/EXPORT & INTEGRATION queries for food manufacturing.
       Covers data export, data import, print labels, print reports, barcode,
       API sync, backup, template management, and batch operations.
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

# Round 69 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Data Export (6 cases) =====
    ("导出本月生产数据", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_FINANCE", "PRODUCTION_STATUS_QUERY", None], "data_export"),
    ("下载质检报表", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_FINANCE", "REPORT_QUALITY", None], "data_export"),
    ("把库存数据导出Excel", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_FINANCE", "REPORT_INVENTORY", None], "data_export"),
    ("成本数据下载到本地", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_FINANCE", None], "data_export"),
    ("批量导出所有批次记录", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_FINANCE", None], "data_export"),
    ("报表下载成PDF", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_FINANCE", None], "data_export"),

    # ===== 2. Data Import (6 cases) =====
    ("导入供应商数据", ["FORM_GENERATION", "REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", None], "data_import"),
    ("上传Excel物料清单", ["FORM_GENERATION", "REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "MATERIAL_BATCH_QUERY", None], "data_import"),
    ("批量导入员工信息", ["FORM_GENERATION", "REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "ATTENDANCE_HISTORY", None], "data_import"),
    ("录入今天的生产数据", ["FORM_GENERATION", "REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "PRODUCTION_STATUS_QUERY", None], "data_import"),
    ("下载导入模板", ["FORM_GENERATION", "REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", None], "data_import"),
    ("上传质检报告文件", ["FORM_GENERATION", "REPORT_DASHBOARD_OVERVIEW", "CONFIG_RESET", "QUALITY_CHECK_QUERY", None], "data_import"),

    # ===== 3. Print Label (5 cases) =====
    ("打印这个批次的标签", ["LABEL_PRINT", "LABEL_TEMPLATE_QUERY", "PRODUCT_UPDATE", None], "print_label"),
    ("批次B2026-001的标签", ["LABEL_PRINT", "LABEL_TEMPLATE_QUERY", "PRODUCT_UPDATE", None], "print_label"),
    ("生成产品标签", ["LABEL_PRINT", "LABEL_TEMPLATE_QUERY", "PRODUCT_UPDATE", None], "print_label"),
    ("打印外箱标签", ["LABEL_PRINT", "LABEL_TEMPLATE_QUERY", "PRODUCT_UPDATE", None], "print_label"),
    ("二维码标签打印", ["LABEL_PRINT", "LABEL_TEMPLATE_QUERY", "PRODUCT_UPDATE", None], "print_label"),

    # ===== 4. Print Report (6 cases) =====
    ("打印今天的生产报表", ["LABEL_PRINT", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "REPORT_PRODUCTION", None], "print_report"),
    ("打印质检检验单", ["LABEL_PRINT", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "print_report"),
    ("打印送货单据", ["LABEL_PRINT", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "SHIPMENT_CREATE", None], "print_report"),
    ("出一份质量报告打印", ["LABEL_PRINT", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "print_report"),
    ("批量打印所有出库单", ["LABEL_PRINT", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", None], "print_report"),
    ("预览打印效果", ["LABEL_PRINT", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", None], "print_report"),

    # ===== 5. Barcode (5 cases) =====
    ("扫码查一下这个产品", ["TRACE_BATCH", "TRACE_PUBLIC", "MATERIAL_BATCH_QUERY", "PRODUCT_TYPE_QUERY", None], "barcode"),
    ("条码识别入库", ["TRACE_BATCH", "TRACE_PUBLIC", "MATERIAL_BATCH_QUERY", "SCALE_ADD_DEVICE_VISION", None], "barcode"),
    ("扫描物料条码入库", ["TRACE_BATCH", "TRACE_PUBLIC", "MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CREATE", None], "barcode"),
    ("二维码扫描溯源", ["TRACE_BATCH", "TRACE_PUBLIC", "MATERIAL_BATCH_QUERY", None], "barcode"),
    ("扫一扫查批次信息", ["TRACE_BATCH", "TRACE_PUBLIC", "MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_DETAIL", None], "barcode"),

    # ===== 6. API Sync (6 cases) =====
    ("同步ERP库存数据", ["CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "REPORT_INVENTORY", None], "api_sync"),
    ("ERP系统对接", ["CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", None], "api_sync"),
    ("和财务系统同步", ["CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", None], "api_sync"),
    ("推送生产数据到ERP", ["CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", None], "api_sync"),
    ("调用外部接口获取价格", ["CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", None], "api_sync"),
    ("自动同步订单数据", ["CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "EQUIPMENT_STATUS_QUERY", None], "api_sync"),

    # ===== 7. Backup (5 cases) =====
    ("备份今天的数据", ["DATA_BATCH_DELETE", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "backup"),
    ("设置自动备份", ["DATA_BATCH_DELETE", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "backup"),
    ("恢复上周的备份", ["DATA_BATCH_DELETE", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "backup"),
    ("备份策略怎么配置", ["DATA_BATCH_DELETE", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "backup"),
    ("归档去年的生产数据", ["DATA_BATCH_DELETE", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None], "backup"),

    # ===== 8. Template (6 cases) =====
    ("管理导入模板", ["FORM_GENERATION", "LABEL_TEMPLATE_QUERY", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "template"),
    ("下载物料导入模板", ["FORM_GENERATION", "LABEL_TEMPLATE_QUERY", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "template"),
    ("自定义表单模板", ["FORM_GENERATION", "LABEL_TEMPLATE_QUERY", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "template"),
    ("修改质检报告模板", ["FORM_GENERATION", "LABEL_TEMPLATE_QUERY", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", None], "template"),
    ("打印模板设置", ["FORM_GENERATION", "LABEL_TEMPLATE_QUERY", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "template"),
    ("创建自定义模板", ["FORM_GENERATION", "LABEL_TEMPLATE_QUERY", "CONFIG_RESET", "REPORT_DASHBOARD_OVERVIEW", None], "template"),

    # ===== 9. Batch Operations (5 cases) =====
    ("批量修改产品状态", ["DATA_BATCH_DELETE", "REPORT_DASHBOARD_OVERVIEW", "PLAN_UPDATE", None], "batch_ops"),
    ("批量更新库存数量", ["DATA_BATCH_DELETE", "REPORT_DASHBOARD_OVERVIEW", "PLAN_UPDATE", "MATERIAL_ADJUST_QUANTITY", None], "batch_ops"),
    ("批量删除过期记录", ["DATA_BATCH_DELETE", "REPORT_DASHBOARD_OVERVIEW", "PLAN_UPDATE", "MATERIAL_EXPIRED_QUERY", None], "batch_ops"),
    ("批量审批领料申请", ["DATA_BATCH_DELETE", "REPORT_DASHBOARD_OVERVIEW", "PLAN_UPDATE", None], "batch_ops"),
    ("批量处理待检物料", ["DATA_BATCH_DELETE", "REPORT_DASHBOARD_OVERVIEW", "PLAN_UPDATE", "MATERIAL_BATCH_QUERY", None], "batch_ops"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 69 ===")
    print(f"Focus: DATA IMPORT/EXPORT & INTEGRATION queries")
    print(f"       (export, import, print labels, print reports, barcode, API sync, backup, template, batch ops)")
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
        'test': 'v5_round69_data_import_export_integration',
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
    report_path = f'tests/ai-intent/reports/v5_round69_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
