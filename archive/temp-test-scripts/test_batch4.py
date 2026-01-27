import requests
import json
import time
import sys

RECOGNIZE_URL = 'http://139.196.165.140:10010/api/public/ai-demo/recognize'

test_cases = [
    # Ambiguous inputs
    '查一下', '删除', '修改那个', '看看数据', '处理一下',
    '那个订单', '上次说的', '帮我弄一下', '这个不对', '改成正确的',
    '查看它的详情', '把它删掉', '修改这个', '那个怎么样了', '他负责的订单',
    '订单...', '查询那个姓张的', '上周的那批货', '价格比较高的', '最近的那个',
    '看看订单和产品', '删除或者取消', '今天或明天的', '张三或李四的', 'A仓库或B仓库',
    '查询订单状态', '修改产品价格', '调整库存数量', '分配任务给员工', '设置提醒',
    '删除但保留记录', '增加并减少库存', '完成未完成的', '查询不存在的', '修改只读数据',
    '那个', '这个', '它', '他们', '之前的',
    '后面的', '其他的', '查一下吧', '看看呢', '怎么样',
    '如何', '咋办', '弄一下', '这个的数据', '那个的情况',
    '刚才说的', '前面提到的', '另一个', '同样的', '类似的',
    '差不多的', '好像是', '大概是', '可能是', '应该是',
    '或许', '也许', '估计', '貌似', '有点',
    '稍微', '一些', '几个', '部分', '某些',
    # Context-dependent
    '上面那个订单的详情', '刚才查的那批货', '同样的查询条件', '和之前一样', '继续刚才的操作',
    '撤销上一步', '再查一次', '换一个条件', '看看别的', '这个不行,换那个',
    '基于这个结果筛选', '在这些里面找', '排除掉已选的', '只保留符合条件的', '把这些合并',
    '然后呢', '还有吗', '就这样', '不对,是另一个', '我是说那个',
    '刚才的订单', '上次的产品', '之前的数据', '那个的结果', '这个的操作',
    '同样的订单', '一样的产品', '继续的数据', '下一个结果', '上一个操作',
    '再来一次', '重复刚才', '返回上页', '下一页', '更多结果',
    '展开详情', '收起列表', '刷新数据', '重新加载', '恢复默认'
]

results = {'success': 0, 'failed': 0, 'confidence_sum': 0, 'methods': {}, 'low_conf_count': 0, 'errors': []}
session = f'batch4-{int(time.time())}'

print('Starting Batch 4 tests...', flush=True)
sys.stdout.flush()

for i, text in enumerate(test_cases):
    try:
        r = requests.post(RECOGNIZE_URL, json={'userInput': text, 'sessionId': session}, timeout=15)
        if r.status_code == 200:
            data = r.json()
            if data.get('code') == 200:
                results['success'] += 1
                conf = data.get('data', {}).get('confidence', 0) or 0
                results['confidence_sum'] += conf
                if conf < 0.5:
                    results['low_conf_count'] += 1
                method = data.get('data', {}).get('matchMethod', 'unknown')
                results['methods'][method] = results['methods'].get(method, 0) + 1
            else:
                results['failed'] += 1
                results['errors'].append(f"{text}: code {data.get('code')}")
        else:
            results['failed'] += 1
            results['errors'].append(f"{text}: status {r.status_code}")
    except requests.exceptions.Timeout:
        results['failed'] += 1
        results['errors'].append(f"{text}: timeout")
    except Exception as e:
        results['failed'] += 1
        results['errors'].append(f"{text}: {str(e)[:50]}")

    if (i+1) % 25 == 0:
        print(f'Batch 4 progress: {i+1}/{len(test_cases)}', flush=True)
        sys.stdout.flush()
    time.sleep(0.15)

print('')
print('=== Batch 4 Results (Ambiguous + Context - Phase 3) ===')
print(f'Total: {len(test_cases)}')
print(f'Success: {results["success"]} ({results["success"]/len(test_cases)*100:.1f}%)')
print(f'Failed: {results["failed"]}')
print(f'Avg Confidence: {results["confidence_sum"]/max(1,results["success"]):.2f}')
print(f'Low Confidence (<0.5): {results["low_conf_count"]} (expected for ambiguous inputs)')
print(f'Methods: {results["methods"]}')
if results['errors']:
    print(f'\nFirst 10 errors:')
    for err in results['errors'][:10]:
        print(f'  - {err}')
sys.stdout.flush()
