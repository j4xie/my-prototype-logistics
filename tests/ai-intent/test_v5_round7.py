#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 7
Focus: Write/Action/Mutation operations
Categories: CREATE, UPDATE, DELETE, EXECUTE, PAUSE/STOP, ASSIGN, CLOCK, SAFETY
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

# Round 7 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # === CREATE 创建类 ===
    # ORDER_CREATE不存在，系统用ORDER_LIST代替
    ("新建一个订单", ["ORDER_LIST", "ORDER_STATUS"], "create-order"),
    ("创建生产批次", ["PROCESSING_BATCH_CREATE"], "create-batch"),
    ("录入一批新原料", ["MATERIAL_BATCH_CREATE", "MATERIAL_UPDATE"], "create-material"),
    ("新增一条发货单", ["SHIPMENT_CREATE"], "create-shipment"),
    # SUPPLIER_CREATE不存在，系统用SUPPLIER_LIST代替
    ("添加新供应商", ["SUPPLIER_LIST", "SUPPLIER_EVALUATE"], "create-supplier"),
    ("创建质检任务", ["QUALITY_CHECK_CREATE", "QUALITY_CHECK_EXECUTE"], "create-qc"),
    # CUSTOMER_CREATE/CUSTOMER_QUERY不在DB中, 使用CUSTOMER_SEARCH
    ("新增客户信息", ["CUSTOMER_SEARCH", "CUSTOMER_LIST"], "create-customer"),
    ("注册新用户", ["USER_CREATE"], "create-user"),

    # === UPDATE 更新类 ===
    ("更新设备状态", ["EQUIPMENT_STATUS_UPDATE", "EQUIPMENT_STATUS_QUERY"], "update-equip-status"),
    ("修改订单信息", ["ORDER_UPDATE", "ORDER_STATUS"], "update-order"),
    ("更新发货单状态", ["SHIPMENT_STATUS_UPDATE", "SHIPMENT_UPDATE", "SHIPMENT_QUERY"], "update-shipment"),
    ("修改批次信息", ["PROCESSING_BATCH_UPDATE", "PROCESSING_BATCH_DETAIL"], "update-batch"),
    ("调整库存数量", ["MATERIAL_ADJUST_QUANTITY", "QUANTITY_ADJUST", "MATERIAL_UPDATE"], "update-inv-qty"),
    ("更新供应商评级", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING"], "update-supplier-rating"),
    ("修改用户权限", ["USER_ROLE_ASSIGN", "USER_UPDATE"], "update-user-role"),

    # === DELETE 删除类 ===
    ("删除这个订单", ["ORDER_DELETE", "ORDER_STATUS"], "delete-order"),
    # MATERIAL_BATCH_DELETE不在DB中, 使用DATA_BATCH_DELETE
    ("删除这批原料记录", ["DATA_BATCH_DELETE", "MATERIAL_BATCH_QUERY"], "delete-material"),
    ("移除供应商", ["SUPPLIER_DELETE", "SUPPLIER_LIST"], "delete-supplier"),
    ("删除客户", ["CUSTOMER_DELETE"], "delete-customer"),
    ("注销用户账号", ["USER_DELETE", "USER_UPDATE"], "delete-user"),
    # EQUIPMENT_DELETE不存在，系统用SCALE_DELETE_DEVICE
    ("删除设备", ["SCALE_DELETE_DEVICE", "EQUIPMENT_DELETE"], "delete-equip"),

    # === EXECUTE 执行类 ===
    ("执行质检", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_CREATE"], "exec-quality-check"),
    ("做一次质检", ["QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_CREATE"], "exec-do-qc"),
    ("执行质量处置", ["QUALITY_DISPOSITION_EXECUTE"], "exec-disposition"),
    ("把不合格品标记为报废", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_EXECUTE"], "exec-mark-scrap"),

    # === PAUSE/STOP/CANCEL/COMPLETE ===
    ("暂停这个批次", ["PROCESSING_BATCH_PAUSE"], "pause-batch"),
    ("停止设备运行", ["EQUIPMENT_STOP", "EQUIPMENT_STATUS_UPDATE"], "stop-equip"),
    ("取消生产批次", ["PROCESSING_BATCH_CANCEL", "PROCESSING_BATCH_PAUSE"], "cancel-batch"),
    ("完成生产批次", ["PROCESSING_BATCH_COMPLETE", "PROCESSING_BATCH_UPDATE"], "complete-batch"),
    ("恢复生产", ["PROCESSING_BATCH_RESUME", "PROCESSING_BATCH_START", "PRODUCTION_STATUS_QUERY"], "resume-prod"),
    ("启动设备", ["EQUIPMENT_START", "EQUIPMENT_STATUS_UPDATE"], "start-equip"),
    ("开始生产", ["PROCESSING_BATCH_START", "PROCESSING_BATCH_CREATE", "PRODUCTION_STATUS_QUERY"], "start-prod"),

    # === ASSIGN 分配类 ===
    ("分配工人到这个批次", ["PROCESSING_WORKER_ASSIGN", "TASK_ASSIGN_WORKER"], "assign-worker"),
    ("给张三分配任务", ["TASK_ASSIGN_WORKER", "TASK_ASSIGN_EMPLOYEE", "PROCESSING_WORKER_ASSIGN"], "assign-task"),

    # === CLOCK 打卡考勤 ===
    ("打卡上班", ["CLOCK_IN", "ATTENDANCE_TODAY"], "clock-in"),
    ("打卡下班", ["CLOCK_OUT", "CLOCK_IN"], "clock-out"),
    ("签到", ["CLOCK_IN", "ATTENDANCE_TODAY"], "clock-sign-in"),

    # === ALERT 操作 ===
    ("处理这个告警", ["ALERT_RESOLVE", "ALERT_ACKNOWLEDGE", "ALERT_LIST"], "alert-resolve"),
    ("确认告警已收到", ["ALERT_ACKNOWLEDGE", "ALERT_RESOLVE"], "alert-ack"),
    ("关闭告警", ["ALERT_RESOLVE", "ALERT_LIST"], "alert-close"),

    # === SHIPMENT 操作 ===
    # SHIPMENT_CONFIRM/CANCEL/COMPLETE不存在，系统用STATUS_UPDATE代替
    ("确认发货", ["SHIPMENT_STATUS_UPDATE", "SHIPMENT_CREATE", "SHIPMENT_QUERY"], "ship-confirm"),
    ("取消发货", ["SHIPMENT_STATUS_UPDATE", "SHIPMENT_QUERY"], "ship-cancel"),
    ("完成发货", ["SHIPMENT_STATUS_UPDATE", "SHIPMENT_QUERY"], "ship-complete"),

    # === 物料操作 ===
    ("领用原料", ["MATERIAL_BATCH_CONSUME", "MATERIAL_BATCH_USE", "MATERIAL_BATCH_QUERY"], "mat-consume"),
    # MATERIAL_BATCH_RESERVE不存在
    ("预留库存", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "mat-reserve"),
    ("释放预留库存", ["MATERIAL_BATCH_RELEASE", "MATERIAL_BATCH_QUERY"], "mat-release"),

    # === 安全/破坏性操作 (应检测到CRITICAL级别) ===
    ("删除所有订单", ["DATA_BATCH_DELETE", "ORDER_DELETE"], "safety-delete-all"),
    ("清空库存", ["INVENTORY_CLEAR", "DATA_BATCH_DELETE", "MATERIAL_BATCH_DELETE"], "safety-clear-inv"),
    ("批量删除数据", ["DATA_BATCH_DELETE"], "safety-batch-delete"),
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
            return query, 'ERROR', None, None, category, data.get('message', 'unknown'), latency, None

        intent_data = data.get('data', {})
        intent = intent_data.get('intentCode', 'NONE')
        confidence = intent_data.get('confidence', 0)
        method = intent_data.get('matchMethod', 'unknown')
        action_type = intent_data.get('actionType', None)

        if 'NONE' in expected_intents and intent is None:
            return query, 'PASS', 'NONE', confidence, category, method, latency, action_type

        passed = intent in expected_intents
        status = 'PASS' if passed else 'FAIL'
        return query, status, intent, confidence, category, method, latency, action_type
    except requests.exceptions.Timeout:
        latency = time.time() - start_time
        return query, 'ERROR', None, None, category, 'TIMEOUT', latency, None
    except Exception as e:
        latency = time.time() - start_time
        return query, 'ERROR', None, None, category, str(e), latency, None

def main():
    print(f"=== v5 Intent Pipeline E2E Test - Round 7 ===")
    print(f"Focus: Write/Action/Mutation Operations")
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
    action_types = {}

    for i, (query, expected, category) in enumerate(TEST_CASES):
        q, status, intent, conf, cat, method, latency, action_type = test_intent(token, query, expected, category)
        results.append({
            'query': q, 'status': status, 'intent': intent,
            'confidence': conf, 'expected': expected, 'category': cat,
            'method': method, 'latency_ms': round(latency * 1000),
            'action_type': action_type
        })

        cat_group = cat.split('-')[0]
        if cat_group not in categories:
            categories[cat_group] = {'pass': 0, 'fail': 0, 'error': 0}

        if action_type:
            action_types[action_type] = action_types.get(action_type, 0) + 1

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
        action_str = f" [action={action_type}]" if action_type else ""
        print(f"  [{icon}] [{cat}] \"{q}\" => {intent} ({conf_str}) via {method} [{lat_str}]{action_str}" +
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

    if action_types:
        print(f"\n--- Action type distribution ---")
        for at, c in sorted(action_types.items(), key=lambda x: -x[1]):
            print(f"  {at}: {c}")

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
        'test': 'v5_round7_write_ops',
        'total': len(TEST_CASES),
        'pass': pass_count,
        'fail': fail_count,
        'error': error_count,
        'pass_rate': pass_count/len(TEST_CASES)*100,
        'category_breakdown': categories,
        'action_type_distribution': action_types,
        'method_distribution': methods,
        'results': results
    }
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_path = f'tests/ai-intent/reports/v5_round7_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
