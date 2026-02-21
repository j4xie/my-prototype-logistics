#!/usr/bin/env python3
"""Phase 2b Deep Analysis — spot-check failing intents and categorize issues"""
import requests, json, sys, time, os
sys.stdout.reconfigure(encoding='utf-8')

# Login
login_r = requests.post('http://47.100.235.168:10010/api/mobile/auth/unified-login',
    json={'username': 'factory_admin1', 'password': '123456'})
token = login_r.json()['data']['token']

def execute(input_text):
    try:
        r = requests.post('http://47.100.235.168:10010/api/mobile/F001/ai-intents/execute',
            json={'userInput': input_text},
            headers={'Authorization': f'Bearer {token}'}, timeout=90)
        resp = r.json()
        data = resp.get('data', {}) or {}
        return {
            'success': resp.get('success', False),
            'intent': str(data.get('intentCode') or 'N/A'),
            'status': str(data.get('status') or '?'),
            'reply': str(data.get('formattedText') or data.get('replyText') or data.get('reply') or ''),
            'has_data': bool(data.get('resultData')),
            'error_msg': str(data.get('errorMessage') or data.get('message') or ''),
            'raw_keys': list((data.get('resultData') or {}).keys()) if isinstance(data.get('resultData'), dict) else [],
        }
    except Exception as e:
        return {'success': False, 'intent': 'ERROR', 'status': 'ERROR', 'reply': '',
                'has_data': False, 'error_msg': str(e), 'raw_keys': []}

# ===== Part 1: Spot-check ALL 91 FAIL intents =====
# Grouped by root cause category
fail_tests = {
    'A-财务深层(无handler)': [
        ('偿债能力分析', 'QUERY_SOLVENCY'),
        ('净资产回报率', 'QUERY_FINANCE_ROE'),
        ('杜邦分析', 'QUERY_DUPONT_ANALYSIS'),
        ('流动比率查询', 'QUERY_LIQUIDITY'),
        ('资产收益率', 'QUERY_FINANCE_ROA'),
        ('经营效益概览', 'REPORT_BENEFIT_OVERVIEW'),
    ],
    'B-HR深层(无handler)': [
        ('在线员工数量', 'QUERY_ONLINE_STAFF_COUNT'),
        ('查看员工资料', 'QUERY_EMPLOYEE_PROFILE'),
        ('部门考勤统计', 'ATTENDANCE_STATS_BY_DEPT'),
        ('删除员工李四', 'HR_DELETE_EMPLOYEE'),
        ('分配任务给张三', 'TASK_ASSIGN_WORKER'),
    ],
    'C-冷链/温度(无handler)': [
        ('三号冷库温度记录', 'COLD_CHAIN_TEMPERATURE'),
        ('冷库温度告警', 'COLD_CHAIN_TEMPERATURE'),
    ],
    'D-订单更新/审批(无handler)': [
        ('修改订单状态', 'ORDER_UPDATE'),
        ('订单已发货', 'ORDER_UPDATE'),
        ('审批这个采购订单', 'ORDER_APPROVAL'),
        ('查看审批记录', 'QUERY_APPROVAL_RECORD'),
        ('提交审批', 'ORDER_UPDATE'),
    ],
    'E-设备深层(无handler)': [
        ('设备故障报告', 'EQUIPMENT_BREAKDOWN_REPORT'),
        ('车间日报', 'REPORT_WORKSHOP_DAILY'),
        ('启动摄像头', 'EQUIPMENT_CAMERA_START'),
        ('CCP监控数据', 'CCP_MONITOR_DATA_DETECTION'),
        ('按名称查设备状态', 'QUERY_EQUIPMENT_STATUS_BY_NAME'),
        ('分析一下3号设备的运行状况', 'ANALYZE_EQUIPMENT'),
    ],
    'F-生产过程深层(无handler)': [
        ('当前生产到哪一步了', 'QUERY_PROCESSING_CURRENT_STEP'),
        ('查看生产工序', 'QUERY_PROCESSING_STEP'),
        ('现在车间有多少人在', 'WORKER_IN_SHOP_REALTIME_COUNT'),
        ('这个批次的负责人是谁', 'QUERY_PROCESSING_BATCH_SUPERVISOR'),
        ('确认工人到岗', 'WORKER_ARRIVAL_CONFIRM'),
    ],
    'G-出库/仓储(无handler)': [
        ('出库一批猪肉', 'INVENTORY_OUTBOUND'),
        ('仓库出库操作', 'WAREHOUSE_OUTBOUND'),
        ('通知仓库备货', 'SHIPMENT_NOTIFY_WAREHOUSE_PREPARE'),
        ('MRP物料需求计算', 'MRP_CALCULATION'),
    ],
    'H-通知/系统(无handler)': [
        ('发微信通知给仓库', 'NOTIFICATION_SEND_WECHAT'),
        ('恢复默认系统配置', 'CONFIG_RESET'),
        ('配置采购审批流程', 'APPROVAL_CONFIG_PURCHASE_ORDER'),
    ],
    'I-其他缺失handler': [
        ('我的待办事项', 'USER_TODO_LIST'),
        ('新增一个供应商', 'SUPPLIER_CREATE'),
        ('客户回款状态', 'PAYMENT_STATUS_QUERY'),
        ('各产品销售排名', 'PRODUCT_SALES_RANKING'),
        ('运输线路查询', 'QUERY_TRANSPORT_LINE'),
        ('AI质检分析报告', 'REPORT_AI_QUALITY'),
        ('这批猪肉退货原因', 'QUERY_MATERIAL_REJECTION_REASON'),
        ('订单还缺多少原料', 'QUERY_ORDER_PENDING_MATERIAL_QUANTITY'),
        ('删除发货单', 'SHIPMENT_DELETE'),
    ],
}

print('=' * 80)
print('Phase 2b Deep Analysis: FAIL Intent Spot-Check')
print('=' * 80)

category_results = {}
all_fail_intents = set()

for category, tests in fail_tests.items():
    print(f'\n--- {category} ---')
    cat_fails = 0
    for inp, expected_intent in tests:
        result = execute(inp)
        is_fail = result['status'] in ('FAILED', 'ERROR')
        mark = 'FAIL' if is_fail else 'OK  '
        if is_fail:
            cat_fails += 1
            all_fail_intents.add(result['intent'])
        reply_preview = result['reply'][:60].replace('\n', ' ') if result['reply'] else '(empty)'
        print(f'  {mark} {result["intent"]:40s} status={result["status"]:15s} | {inp}')
        if is_fail and result['error_msg']:
            print(f'       error: {result["error_msg"][:80]}')
    category_results[category] = (cat_fails, len(tests))

# ===== Part 2: Check WARN patterns (NO_REPLY for matched intents) =====
print(f'\n{"=" * 80}')
print('Phase 2b Deep Analysis: WARN Pattern Spot-Check')
print('=' * 80)

warn_tests = [
    # Intents that match but return empty/short reply
    ('环比增长多少', 'REPORT_TRENDS', 'Q1: 趋势报表短回复'),
    ('利润趋势分析', 'PROFIT_TREND_ANALYSIS', 'U6: 短回复/通用'),
    ('供应商列表', 'SUPPLIER_LIST', 'E1: 供应商查询'),
    ('完整溯源链条', 'TRACE_FULL', 'X3: 溯源链'),
    ('溯源码查询', 'TRACE_PUBLIC', 'E5: 溯源码'),
    ('电子秤列表', 'SCALE_LIST_DEVICES', 'I3: 电子秤'),
    ('上一个批次的详情', 'PROCESSING_BATCH_DETAIL', 'Z1: 上下文回指'),
    ('情况怎么样', 'REPORT_DASHBOARD_OVERVIEW', 'J4: 模糊输入'),
    ('你好', 'N/A', 'AA10: 闲聊'),
    ('666', 'N/A', 'AA7: 纯噪音'),
    ('同上', 'N/A', 'AB7: 省略'),
    ('这个呢', 'N/A', 'Z2: 极短回指'),
]

for inp, expected, desc in warn_tests:
    result = execute(inp)
    reply_len = len(result['reply'])
    reply_preview = result['reply'][:60].replace('\n', ' ') if result['reply'] else '(empty)'
    mark = 'OK  ' if reply_len > 10 else ('WARN' if reply_len > 0 else 'NONE')
    print(f'  {mark} [{desc:20s}] {result["intent"]:35s} reply_len={reply_len:4d} | {reply_preview}')

# ===== Summary =====
print(f'\n{"=" * 80}')
print('ANALYSIS SUMMARY')
print('=' * 80)

total_fail_tested = sum(v[1] for v in category_results.values())
total_still_fail = sum(v[0] for v in category_results.values())
print(f'\nFAIL Categories ({total_still_fail}/{total_fail_tested} still failing):')
for cat, (fails, total) in sorted(category_results.items()):
    pct = 100 * fails / total if total else 0
    bar = '█' * fails + '░' * (total - fails)
    print(f'  {cat:40s} {fails}/{total} FAIL ({pct:.0f}%) {bar}')

print(f'\nUnique failing intent codes: {len(all_fail_intents)}')
print(f'Failing intents: {", ".join(sorted(all_fail_intents))}')

# Categorize fixes needed
print(f'\n--- Fix Priority ---')
print(f'P0 (High impact, many test cases):')
print(f'  - ORDER_UPDATE (7 cases): 需要订单状态更新handler')
print(f'  - COLD_CHAIN_TEMPERATURE (6 cases): 需要冷链温度查询handler')
print(f'  - QUERY_FINANCE_* (10 cases): 需要5个财务分析handler')
print(f'P1 (Medium impact):')
print(f'  - EQUIPMENT_BREAKDOWN_REPORT (4 cases)')
print(f'  - QUERY_PROCESSING_* (4 cases): 生产工序查询')
print(f'  - INVENTORY_OUTBOUND/WAREHOUSE_OUTBOUND (3 cases)')
print(f'  - ORDER_APPROVAL + QUERY_APPROVAL_RECORD (6 cases)')
print(f'P2 (Low impact, 1-2 cases each):')
print(f'  - NOTIFICATION_SEND_WECHAT, CONFIG_RESET, MRP_CALCULATION')
print(f'  - EQUIPMENT_CAMERA_START, USER_TODO_LIST, SUPPLIER_CREATE/DELETE')
print(f'  - PAYMENT_STATUS_QUERY, PRODUCT_SALES_RANKING, etc.')
