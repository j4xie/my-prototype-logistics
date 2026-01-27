import requests
import json
import time

RECOGNIZE_URL = 'http://139.196.165.140:10010/api/public/ai-demo/recognize'

test_cases = [
    '删除订单O001', '取消所有待处理订单', '清空库存数据', '删除员工E001的记录', '移除产品P001',
    '废弃批次B001', '删除所有过期数据', '重置系统设置', '清除质检记录', '删除供应商S001',
    '修改所有订单状态为已完成', '更新所有产品价格', '批量调整库存数量', '修改员工权限', '更改系统配置',
    '永久删除客户C001的所有数据', '归档并删除2023年的订单', '合并重复的产品记录', '迁移仓库数据到新系统', '回滚到上一个版本',
    '调整订单O001的金额为0', '取消客户C001的所有欠款', '修改财务报表数据', '删除付款记录', '重新计算所有订单成本',
    '删除订单', '移除产品', '清除库存', '删除员工', '废弃批次',
    '清空记录', '删除数据', '移除配置', '清除日志', '删除备份',
    '批量删除', '全部删除', '强制删除', '彻底删除', '永久删除',
    '修改订单金额', '更改产品价格', '调整库存数据', '变更员工信息', '更新批次状态',
    '批量修改', '全部更新', '强制修改', '覆盖数据', '重置密码',
    '取消订单O123', '作废发票', '撤销审批', '终止合同', '注销账户',
    '停用产品', '冻结账户', '解除绑定', '清理缓存', '重建索引',
    'delete order', 'remove product', 'clear inventory', 'cancel all', 'reset system'
]

results = {'success': 0, 'failed': 0, 'confidence_sum': 0, 'methods': {}, 'high_sensitivity': 0}
session = f'batch3-{int(time.time())}'

print(f"Starting Batch 3 tests with {len(test_cases)} cases...")

for i, text in enumerate(test_cases):
    try:
        r = requests.post(RECOGNIZE_URL, json={'userInput': text, 'sessionId': session}, timeout=30)
        if r.status_code == 200:
            data = r.json()
            if data.get('code') == 200:
                results['success'] += 1
                conf = data.get('data', {}).get('confidence', 0)
                results['confidence_sum'] += conf or 0
                method = data.get('data', {}).get('matchMethod', 'unknown')
                results['methods'][method] = results['methods'].get(method, 0) + 1
                sens = data.get('data', {}).get('sensitivityLevel', '')
                if sens in ['HIGH', 'CRITICAL']:
                    results['high_sensitivity'] += 1
            else:
                results['failed'] += 1
        else:
            results['failed'] += 1
    except Exception as e:
        results['failed'] += 1
        print(f"Error on case {i}: {e}")
    if (i+1) % 20 == 0:
        print(f'Batch 3 progress: {i+1}/{len(test_cases)}')
    time.sleep(0.2)

print('')
print('=== Batch 3 Results (High-Risk Operations - Phase 1) ===')
print(f'Total: {len(test_cases)}')
print(f'Success: {results["success"]} ({results["success"]/len(test_cases)*100:.1f}%)')
print(f'Avg Confidence: {results["confidence_sum"]/max(1,results["success"]):.2f}')
print(f'High Sensitivity Detected: {results["high_sensitivity"]}')
print(f'Methods: {results["methods"]}')
