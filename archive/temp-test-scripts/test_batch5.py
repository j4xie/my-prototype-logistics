import requests
import json
import time

RECOGNIZE_URL = 'http://139.196.165.140:10010/api/public/ai-demo/recognize'

test_cases = [
    # Edge cases (should trigger low confidence / active learning)
    'xjklsdf', '123456', '???', 'a', '查询查询查询',
    '你好你好你好', 'asdfghjkl', 'test test test', '订单订单订单订单订单',
    '查询order的status', 'delete订单', 'show我的orders',
    '【订单查询】', '=====订单=====', '>>>查询<<<',
    '@订单#查询', '订.单.查.询',
    '播放音乐', '打开相机', '发送微信', '导航到北京', '设置闹钟',
    'SELECT * FROM orders', '{"action": "query"}', '<order>query</order>',
    'curl -X GET /orders', 'orders.find({})',
    'qwertyuiop', '!@#%^&*()',
    'null', 'undefined', 'NaN', 'true', 'false',
    '[]', '{}', '0', '-1', '9999999999',
    # Domain-specific
    '查询溯源码', '扫描批次二维码', '追溯产品来源', '查看供应链信息', '冷链温度监控',
    'HACCP记录查询', 'GMP合规检查', '批次召回', '原料批次追踪', '成品检验报告',
    '查看BOM清单', 'MRP计算', 'WMS库位查询', 'ERP数据同步', 'IoT设备状态',
    '保质期预警', '配方查询', '营养成分分析', '过敏原标识', '有机认证查询',
    '溯源码验证', '追溯链查询', '质检报告', '检疫证明', '合格证打印',
    '产地证明', '生产许可证', '食品标签', '批号管理', '效期管理',
    # Typos
    '查旬订单', '库存查徇', '生产报彪', '员工名蛋', '设被状态',
    '产品查xun', '订单chaxun', '库cun查询', 'shengchan报表', 'yuangong列表',
    '查询定单', '苦存数量', '产品价个', '圆工信息', '涉备维护',
    '查询，订单', '库存。。。', '产品！！', '员工???', '设备...',
    # Multi-intent
    '查看订单并导出报表', '先查库存再下订单', '删除旧数据并备份',
    '统计销售额和利润', '查看员工考勤和绩效', '更新库存并通知仓管',
    '查询订单状态和物流信息', '生成报表并发送邮件',
    '检查设备状态并安排维护', '审核订单并安排发货'
]

results = {'success': 0, 'failed': 0, 'confidence_sum': 0, 'methods': {}, 'low_conf_count': 0, 'unmatched': 0}
session = f'batch5-{int(time.time())}'

detailed_results = []

for i, text in enumerate(test_cases):
    if not text or not text.strip():
        results['failed'] += 1
        continue
    try:
        r = requests.post(RECOGNIZE_URL, json={'userInput': text, 'sessionId': session}, timeout=30)
        if r.status_code == 200:
            data = r.json()
            if data.get('code') == 200:
                results['success'] += 1
                resp_data = data.get('data', {})
                conf = resp_data.get('confidence', 0) or 0
                results['confidence_sum'] += conf
                if conf < 0.5:
                    results['low_conf_count'] += 1
                if not resp_data.get('matched', True):
                    results['unmatched'] += 1
                method = resp_data.get('matchMethod', 'unknown')
                results['methods'][method] = results['methods'].get(method, 0) + 1
                detailed_results.append({
                    'input': text[:30],
                    'confidence': conf,
                    'method': method,
                    'intent': resp_data.get('intent', 'N/A')
                })
            else:
                results['failed'] += 1
        else:
            results['failed'] += 1
    except Exception as e:
        results['failed'] += 1
        print(f'Error: {e}')
    if (i+1) % 25 == 0:
        print(f'Batch 5 progress: {i+1}/{len(test_cases)}')
    time.sleep(0.15)

print()
print('=== Batch 5 Results (Edge Cases + Domain + Typos - Phase 4) ===')
print(f'Total: {len(test_cases)}')
print(f'Success: {results["success"]} ({results["success"]/len(test_cases)*100:.1f}%)')
print(f'Avg Confidence: {results["confidence_sum"]/max(1,results["success"]):.2f}')
print(f'Low Confidence (<0.5): {results["low_conf_count"]} (triggers active learning)')
print(f'Unmatched: {results["unmatched"]}')
print(f'Methods: {results["methods"]}')

print()
print('=== Sample Low Confidence Results ===')
low_conf = [r for r in detailed_results if r['confidence'] < 0.5][:15]
for r in low_conf:
    print(f'  [{r["confidence"]:.2f}] {r["input"]} -> {r["intent"]}')

print()
print('=== Domain-Specific Results ===')
domain_inputs = ['查询溯源码', 'HACCP记录查询', '批次召回', 'IoT设备状态', '质检报告', '冷链温度监控', '溯源码验证']
for r in detailed_results:
    if any(d in r['input'] for d in domain_inputs):
        print(f'  [{r["confidence"]:.2f}] {r["input"]} -> {r["intent"]} ({r["method"]})')

print()
print('=== Multi-Intent Results ===')
multi_inputs = ['查看订单并导出报表', '先查库存再下订单', '统计销售额和利润', '查询订单状态和物流信息']
for r in detailed_results:
    if any(m in r['input'] for m in multi_inputs):
        print(f'  [{r["confidence"]:.2f}] {r["input"]} -> {r["intent"]} ({r["method"]})')
