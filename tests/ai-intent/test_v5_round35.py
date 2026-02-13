#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 35
Focus: DATA OPERATIONS & CRUD - creating, reading, updating, deleting various
       business objects, data import/export, batch operations.
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

# Round 35 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Create Operations (6 cases) =====
    ("新建一个生产批次", ["PROCESSING_BATCH_CREATE", None], "create"),
    ("登记一批新原料", ["MATERIAL_BATCH_CREATE", None], "create"),
    ("录入质检结果", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", None], "create"),
    ("添加新供应商", ["SUPPLIER_CREATE", "SUPPLIER_LIST", None], "create"),
    ("创建发货单", ["SHIPMENT_CREATE", "ORDER_CREATE", None], "create"),
    ("新增设备", [None], "create"),

    # ===== 2. Read/Query Operations (6 cases) =====
    ("查看批次详情", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", None], "read"),
    ("查询库存明细", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "INVENTORY_LIST", "REPORT_INVENTORY", None], "read"),
    ("看一下订单状态", ["ORDER_STATUS", "ORDER_LIST", "ORDER_DETAIL", None], "read"),
    ("检索质检记录", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", None], "read"),
    ("获取设备信息", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", None], "read"),
    ("查找供应商", ["SUPPLIER_LIST", "SUPPLIER_QUERY", "SUPPLIER_SEARCH", None], "read"),

    # ===== 3. Update Operations (6 cases) =====
    ("更新批次状态", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_DETAIL", None], "update"),
    ("修改库存数量", ["MATERIAL_ADJUST_QUANTITY", "INVENTORY_QUERY", None], "update"),
    ("调整订单金额", ["ORDER_UPDATE", "ORDER_DETAIL", "ORDER_FILTER", None], "update"),
    ("更新供应商信息", ["SUPPLIER_CREATE", "SUPPLIER_LIST", None], "update"),
    ("修改设备参数", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATUS_UPDATE", None], "update"),
    ("更新质检结果", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", None], "update"),

    # ===== 4. Delete/Deactivate (5 cases) =====
    ("删除这条记录", [None], "delete"),
    ("停用这个供应商", [None, "SUPPLIER_LIST", "SUPPLIER_DELETE"], "delete"),
    ("取消这个批次", [None, "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_CANCEL"], "delete"),
    ("作废这张单", [None, "ORDER_STATUS", "ORDER_UPDATE", "ORDER_DELETE"], "delete"),
    ("清除过期数据", [None, "DATA_BATCH_DELETE"], "delete"),

    # ===== 5. Batch Operations (6 cases) =====
    ("批量导入数据", [None], "batch"),
    ("批量更新状态", [None, "PROCESSING_BATCH_LIST", "SHIPMENT_STATUS_UPDATE"], "batch"),
    ("批量打印标签", ["LABEL_PRINT", None], "batch"),
    ("批量审批", [None], "batch"),
    ("批量发货", ["SHIPMENT_CREATE", "ORDER_CREATE", None], "batch"),
    ("批量质检", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_LIST", "QUALITY_CHECK_QUERY", None], "batch"),

    # ===== 6. Data Import (5 cases) =====
    ("导入Excel数据", [None], "import"),
    ("上传供应商名单", [None, "SUPPLIER_CREATE", "SUPPLIER_LIST"], "import"),
    ("导入BOM", [None, "MATERIAL_BATCH_QUERY"], "import"),
    ("导入价格表", [None], "import"),
    ("上传质检模板", [None, "QUALITY_CHECK_EXECUTE"], "import"),

    # ===== 7. Data Export (6 cases) =====
    ("导出库存报表", ["REPORT_INVENTORY", "INVENTORY_QUERY", "INVENTORY_LIST", None], "export"),
    ("下载质检数据", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "REPORT_QUALITY", "QUALITY_STATS", None], "export"),
    ("导出订单明细", ["ORDER_LIST", "ORDER_DETAIL", "ORDER_STATUS", None], "export"),
    ("生成PDF报告", ["REPORT_DASHBOARD_OVERVIEW", None], "export"),
    ("导出Excel", [None, "REPORT_DASHBOARD_OVERVIEW"], "export"),
    ("打印汇总表", ["REPORT_DASHBOARD_OVERVIEW", "LABEL_PRINT", None], "export"),

    # ===== 8. Data Validation (5 cases) =====
    ("数据校验", [None, "REPORT_DASHBOARD_OVERVIEW"], "validation"),
    ("检查完整性", [None], "validation"),
    ("核对数量", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "MATERIAL_ADJUST_QUANTITY", None], "validation"),
    ("数据异常检测", [None, "ALERT_LIST", "ALERT_ACTIVE"], "validation"),
    ("一致性检查", [None], "validation"),

    # ===== 9. Data Sync (5 cases) =====
    ("同步数据", [None, "REPORT_DASHBOARD_OVERVIEW"], "sync"),
    ("刷新缓存", [None], "sync"),
    ("更新主数据", [None, "REPORT_DASHBOARD_OVERVIEW"], "sync"),
    ("数据对账", [None, "REPORT_DASHBOARD_OVERVIEW"], "sync"),
    ("系统同步", [None], "sync"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 35 ===")
    print(f"Focus: DATA OPERATIONS & CRUD - creating, reading, updating, deleting")
    print(f"       business objects, data import/export, batch operations")
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
        'test': 'v5_round35_data_operations_crud',
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
    report_path = f'tests/ai-intent/reports/v5_round35_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
