#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
失败案例分析脚本 - 收集并分析意图识别失败的模式
"""

import requests
import json
import sys
import time
import random
from datetime import datetime
from collections import defaultdict, Counter
from concurrent.futures import ThreadPoolExecutor, as_completed

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

SERVER = 'http://139.196.165.140:10010'
FACTORY_ID = 'F001'
WORKERS = 10

# 意图模板 - 与 fast_parallel_test.py 一致
INTENT_TEMPLATES = {
    "REPORT_DASHBOARD_OVERVIEW": ["查看{time}的销售数据", "帮我看一下{time}业绩", "{time}销售报表"],
    "REPORT_INVENTORY": ["查看{time}库存", "{time}库存情况", "库存有多少"],
    "REPORT_EFFICIENCY": ["{time}生产效率", "效率报告{time}", "产线效率怎么样"],
    "REPORT_KPI": ["KPI指标{time}", "{time}经营指标", "核心指标汇总"],
    "REPORT_FINANCE": ["{time}财务报表", "财务数据{time}", "收支情况{time}"],
    "EQUIPMENT_STATUS_QUERY": ["设备运行状态", "查看设备情况", "设备{time}状态"],
    "EQUIPMENT_MAINTENANCE": ["设备维护记录", "{time}维护保养", "设备检修情况"],
    "PRODUCTION_STATUS_QUERY": ["生产进度{time}", "生产状态查询", "产线运行情况"],
    "PROCESSING_BATCH_TIMELINE": ["生产批次时间线", "批次生产进度", "批次状态跟踪"],
    "ATTENDANCE_TODAY": ["今天出勤情况", "今日打卡统计", "今天谁在"],
    "ATTENDANCE_STATS": ["{time}考勤统计", "考勤数据{time}", "出勤率统计"],
    "QUALITY_CHECK_QUERY": ["质检记录{time}", "质量检验数据", "查看质检报告"],
    "QUALITY_STATS": ["质量统计{time}", "质检合格率", "质量数据分析"],
    "ALERT_LIST": ["告警列表", "当前告警", "有什么告警"],
    "ALERT_STATS": ["告警统计{time}", "{time}告警数量", "告警分析报告"],
    "SHIPMENT_QUERY": ["发货记录{time}", "查看发货情况", "发货进度"],
    "SHIPMENT_STATS": ["发货统计{time}", "{time}出货量", "发货数据分析"],
    "MATERIAL_BATCH_QUERY": ["原料批次{time}", "查看原料信息", "原料入库记录"],
    "MATERIAL_LOW_STOCK_ALERT": ["低库存预警", "库存不足提醒", "缺货预警"],
    "MATERIAL_EXPIRING_ALERT": ["临期原料", "快过期原料", "临期预警"],
    "SUPPLIER_LIST": ["供应商列表", "查看供应商", "供应商名单"],
    "CUSTOMER_PURCHASE_HISTORY": ["客户采购记录", "客户订单历史", "{time}客户采购"],
    "TRACE_FULL": ["完整溯源信息", "产品溯源查询", "溯源记录"],
    "COST_QUERY": ["成本查询{time}", "{time}成本数据", "成本分析"],
}

TIME_VARIANTS = ["今天", "昨天", "本周", "上周", "本月", "上个月", "最近", ""]

def login():
    """登录获取 token"""
    url = f"{SERVER}/api/mobile/auth/unified-login"
    payload = {"username": "factory_admin1", "password": "123456"}
    try:
        resp = requests.post(url, json=payload, timeout=10)
        data = resp.json()
        if data.get('success') and data.get('data', {}).get('accessToken'):
            return data['data']['accessToken']
    except Exception as e:
        print(f"登录失败: {e}")
    return None

def generate_cases(count):
    """生成测试用例"""
    cases = []
    intents = list(INTENT_TEMPLATES.keys())

    for i in range(count):
        expected_intent = random.choice(intents)
        templates = INTENT_TEMPLATES[expected_intent]
        template = random.choice(templates)
        time_var = random.choice(TIME_VARIANTS)
        query = template.replace("{time}", time_var).strip()

        cases.append({
            'id': i + 1,
            'query': query,
            'expected': expected_intent,
            'template': template
        })

    return cases

def test_one(case, headers, session_id):
    """测试单个用例"""
    url = f"{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/recognize"
    payload = {
        "userInput": case['query'],
        "sessionId": session_id
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
        data = resp.json()

        if data.get('success') and data.get('data'):
            result = data['data']
            actual_intent = result.get('intentCode')
            confidence = result.get('confidence', 0)
            match_method = result.get('matchMethod', 'UNKNOWN')

            is_correct = actual_intent == case['expected']

            return {
                'id': case['id'],
                'query': case['query'],
                'expected': case['expected'],
                'actual': actual_intent,
                'confidence': confidence,
                'matchMethod': match_method,
                'correct': is_correct,
                'template': case['template']
            }
    except Exception as e:
        pass

    return {
        'id': case['id'],
        'query': case['query'],
        'expected': case['expected'],
        'actual': None,
        'confidence': 0,
        'matchMethod': 'ERROR',
        'correct': False,
        'template': case['template']
    }

def analyze_failures(results):
    """分析失败案例"""
    failures = [r for r in results if not r['correct']]

    print(f"\n{'='*70}")
    print(f"失败案例分析 (共 {len(failures)} 个)")
    print(f"{'='*70}")

    # 1. 按期望意图统计失败
    expected_fails = Counter(f['expected'] for f in failures)
    print(f"\n## 1. 按期望意图统计失败数:")
    for intent, count in expected_fails.most_common(15):
        total_expected = sum(1 for r in results if r['expected'] == intent)
        fail_rate = count / total_expected * 100 if total_expected > 0 else 0
        print(f"   {intent}: {count} 失败 / {total_expected} 总计 ({fail_rate:.1f}%)")

    # 2. 按实际返回意图统计
    actual_returns = Counter(f['actual'] for f in failures)
    print(f"\n## 2. 失败时实际返回的意图:")
    for intent, count in actual_returns.most_common(10):
        print(f"   {intent}: {count} 次")

    # 3. 按匹配方法统计失败
    method_fails = Counter(f['matchMethod'] for f in failures)
    print(f"\n## 3. 失败时的匹配方法:")
    for method, count in method_fails.most_common():
        print(f"   {method}: {count} 次")

    # 4. 常见混淆对
    confusion_pairs = Counter((f['expected'], f['actual']) for f in failures)
    print(f"\n## 4. 常见混淆对 (期望 -> 实际):")
    for (expected, actual), count in confusion_pairs.most_common(15):
        print(f"   {expected} -> {actual}: {count} 次")

    # 5. 示例失败案例
    print(f"\n## 5. 失败案例示例:")
    for f in failures[:20]:
        print(f"   [{f['matchMethod']}] \"{f['query']}\"")
        print(f"      期望: {f['expected']}, 实际: {f['actual']}, 置信度: {f['confidence']:.2f}")

    return {
        'total_failures': len(failures),
        'expected_fails': dict(expected_fails),
        'actual_returns': dict(actual_returns),
        'method_fails': dict(method_fails),
        'confusion_pairs': [{'expected': e, 'actual': a, 'count': c}
                           for (e, a), c in confusion_pairs.most_common(20)],
        'sample_failures': failures[:50]
    }

def main():
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 300
    print(f"=== 失败案例分析 ({count} 用例) ===")

    token = login()
    if not token:
        print("登录失败")
        return
    print(f"登录成功")

    cases = generate_cases(count)
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    session_id = f"analyze_{datetime.now().strftime('%H%M%S')}"

    results = []
    completed = 0
    start = time.time()

    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = {executor.submit(test_one, c, headers, session_id): c for c in cases}

        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            completed += 1

            if completed % 50 == 0:
                passed = sum(1 for r in results if r['correct'])
                rate = passed / completed * 100
                print(f"[{completed:4d}/{count}] 准确率: {rate:.1f}%")

    # 统计结果
    passed = sum(1 for r in results if r['correct'])
    accuracy = passed / count * 100

    print(f"\n{'='*70}")
    print(f"总计: {passed}/{count} 通过 ({accuracy:.1f}%)")
    print(f"耗时: {time.time() - start:.1f}秒")

    # 分析失败案例
    analysis = analyze_failures(results)

    # 保存详细结果
    output = {
        'timestamp': datetime.now().isoformat(),
        'total': count,
        'passed': passed,
        'accuracy': accuracy,
        'analysis': analysis,
        'all_results': results
    }

    filename = f"reports/failure_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\n详细结果已保存: {filename}")

if __name__ == '__main__':
    main()
