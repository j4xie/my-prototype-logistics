#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全面测试 - 使用不同种子生成测试用例，统计各层匹配方法
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
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SERVER = 'http://47.100.235.168:10010'
FACTORY_ID = 'F001'
WORKERS = 10

# 意图模板 - 覆盖所有主要意图类型
INTENT_TEMPLATES = {
    # 报表类
    "REPORT_DASHBOARD_OVERVIEW": ["查看{time}的销售数据", "帮我看一下{time}业绩", "{time}销售报表", "销售情况怎么样"],
    "REPORT_INVENTORY": ["查看{time}库存", "{time}库存情况", "库存有多少", "仓库还有多少货"],
    "REPORT_EFFICIENCY": ["{time}生产效率", "效率报告{time}", "产线效率怎么样", "生产效率分析"],
    "REPORT_KPI": ["KPI指标{time}", "{time}经营指标", "核心指标汇总", "关键绩效指标"],
    "REPORT_FINANCE": ["{time}财务报表", "财务数据{time}", "收支情况{time}", "利润分析"],
    "REPORT_PRODUCTION": ["生产报告{time}", "{time}产量统计", "生产数据汇总"],
    "REPORT_TRENDS": ["趋势分析{time}", "同比环比", "增长趋势"],

    # 设备类
    "EQUIPMENT_STATUS_QUERY": ["设备运行状态", "查看设备情况", "设备{time}状态", "机器正常吗"],
    "EQUIPMENT_MAINTENANCE": ["设备维护记录", "{time}维护保养", "设备检修情况", "保养计划"],
    "EQUIPMENT_LIST": ["设备列表", "有哪些设备", "设备清单"],
    "EQUIPMENT_STATS": ["设备统计", "设备运行数据", "设备利用率"],

    # 生产类
    "PRODUCTION_STATUS_QUERY": ["生产进度{time}", "生产状态查询", "产线运行情况", "今天产量咋样"],
    "PROCESSING_BATCH_TIMELINE": ["生产批次时间线", "批次生产进度", "批次状态跟踪"],
    "PROCESSING_BATCH_LIST": ["生产批次列表", "当前批次", "在产批次"],
    "PROCESSING_BATCH_CREATE": ["新建批次", "创建生产批次", "开一个新批次"],

    # 考勤类
    "ATTENDANCE_TODAY": ["今天出勤情况", "今日打卡统计", "今天谁在", "今天到岗人员"],
    "ATTENDANCE_STATS": ["{time}考勤统计", "考勤数据{time}", "出勤率统计", "考勤分析"],
    "ATTENDANCE_HISTORY": ["考勤历史", "打卡记录", "历史考勤数据"],
    "CLOCK_IN": ["打卡", "签到", "上班打卡"],
    "CLOCK_OUT": ["下班", "签退", "下班打卡"],

    # 质量类
    "QUALITY_CHECK_QUERY": ["质检记录{time}", "质量检验数据", "查看质检报告"],
    "QUALITY_STATS": ["质量统计{time}", "质检合格率", "质量数据分析"],
    "QUALITY_CHECK_EXECUTE": ["执行质检", "开始检验", "质量检查"],

    # 告警类
    "ALERT_LIST": ["告警列表", "当前告警", "有什么告警", "系统警报"],
    "ALERT_STATS": ["告警统计{time}", "{time}告警数量", "告警分析报告"],
    "ALERT_ACTIVE": ["活跃告警", "未处理告警", "正在发生的告警"],

    # 发货类
    "SHIPMENT_QUERY": ["发货记录{time}", "查看发货情况", "发货进度"],
    "SHIPMENT_STATS": ["发货统计{time}", "{time}出货量", "发货数据分析"],

    # 原料类
    "MATERIAL_BATCH_QUERY": ["原料批次{time}", "查看原料信息", "原料入库记录", "物料查询"],
    "MATERIAL_LOW_STOCK_ALERT": ["低库存预警", "库存不足提醒", "缺货预警", "原料不够了"],
    "MATERIAL_EXPIRING_ALERT": ["临期原料", "快过期原料", "临期预警"],
    "MATERIAL_BATCH_CREATE": ["新增原料", "原料入库", "登记原料"],

    # 供应商/客户类
    "SUPPLIER_LIST": ["供应商列表", "查看供应商", "供应商名单"],
    "CUSTOMER_PURCHASE_HISTORY": ["客户采购记录", "客户订单历史", "{time}客户采购"],

    # 溯源类
    "TRACE_FULL": ["完整溯源信息", "产品溯源查询", "溯源记录", "全链路追溯"],
    "TRACE_BATCH": ["批次溯源", "追踪批次", "批次追溯"],

    # 成本类
    "COST_QUERY": ["成本查询{time}", "{time}成本数据", "成本分析", "查看成本"],
}

TIME_VARIANTS = ["今天", "昨天", "本周", "上周", "本月", "上个月", "最近", ""]
PREFIXES = ["帮我查一下", "查一下", "看看", "请帮我", ""]

# 相关意图（允许的替代匹配）
RELATED_INTENTS = {
    "ALERT_LIST": ["ALERT_ACTIVE", "ALERT_UNPROCESSED"],
    "EQUIPMENT_STATUS_QUERY": ["EQUIPMENT_LIST", "EQUIPMENT_DETAIL"],
    "TRACE_FULL": ["TRACE_PUBLIC", "TRACE_BATCH"],
    "MATERIAL_BATCH_QUERY": ["MATERIAL_BATCH_CREATE", "MATERIAL_QUERY"],
    "SHIPMENT_STATS": ["SHIPMENT_QUERY", "SHIPMENT_BY_DATE"],
    "ATTENDANCE_STATS": ["ATTENDANCE_HISTORY", "ATTENDANCE_MONTHLY"],
    "PROCESSING_BATCH_TIMELINE": ["PROCESSING_BATCH_STATUS", "PRODUCTION_STATUS_QUERY"],
    "QUALITY_CHECK_QUERY": ["QUALITY_STATS"],
}

def generate_cases(count, seed):
    """使用指定种子生成测试用例"""
    random.seed(seed)
    cases = []
    intents = list(INTENT_TEMPLATES.keys())

    for i in range(count):
        intent = intents[i % len(intents)]
        template = random.choice(INTENT_TEMPLATES[intent])
        time_var = random.choice(TIME_VARIANTS)
        prefix = random.choice(PREFIXES)
        text = template.format(time=time_var)
        if prefix and not text.startswith(("查", "看", "帮", "请")):
            text = prefix + text
        cases.append({
            "id": i+1,
            "userInput": text.strip(),
            "expectedIntent": intent,
            "template": template
        })

    random.shuffle(cases)
    return cases

def login():
    try:
        r = requests.post(f'{SERVER}/api/mobile/auth/unified-login',
            json={'username': 'factory_admin1', 'password': '123456', 'factoryId': FACTORY_ID}, timeout=30)
        data = r.json()
        if data.get('success'):
            return data.get('data', {}).get('accessToken')
    except Exception as e:
        print(f"登录失败: {e}")
    return None

def test_one(case, headers, session_id):
    """测试单个用例，返回详细结果"""
    try:
        r = requests.post(f'{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/recognize',
            json={'userInput': case['userInput'], 'userId': 1, 'sessionId': session_id, 'topN': 5},
            headers=headers, timeout=60)
        data = r.json()

        if not data.get('success'):
            return {
                'id': case['id'],
                'userInput': case['userInput'],
                'expected': case['expectedIntent'],
                'actual': None,
                'correct': False,
                'matchMethod': None,
                'confidence': 0,
                'error': data.get('message', 'API error')
            }

        result_data = data.get('data', {})
        actual = result_data.get('intentCode')
        expected = case['expectedIntent']
        method = result_data.get('matchMethod')
        confidence = result_data.get('confidence', 0)

        # 检查是否正确（包括相关意图）
        correct = (actual == expected)
        if not correct and expected in RELATED_INTENTS:
            correct = actual in RELATED_INTENTS[expected]

        return {
            'id': case['id'],
            'userInput': case['userInput'],
            'expected': expected,
            'actual': actual,
            'correct': correct,
            'matchMethod': method,
            'confidence': confidence,
            'error': None
        }
    except Exception as e:
        return {
            'id': case['id'],
            'userInput': case['userInput'],
            'expected': case['expectedIntent'],
            'actual': None,
            'correct': False,
            'matchMethod': None,
            'confidence': 0,
            'error': str(e)
        }

def analyze_results(results):
    """分析测试结果"""
    total = len(results)
    correct = sum(1 for r in results if r['correct'])

    # 按匹配方法统计
    method_stats = defaultdict(lambda: {'total': 0, 'correct': 0})
    for r in results:
        method = r['matchMethod'] or 'NONE'
        method_stats[method]['total'] += 1
        if r['correct']:
            method_stats[method]['correct'] += 1

    # 按意图类型统计
    intent_stats = defaultdict(lambda: {'total': 0, 'correct': 0})
    for r in results:
        intent_stats[r['expected']]['total'] += 1
        if r['correct']:
            intent_stats[r['expected']]['correct'] += 1

    # 失败案例分析
    failures = [r for r in results if not r['correct']]
    confusion_pairs = Counter()
    for r in failures:
        confusion_pairs[(r['expected'], r['actual'])] += 1

    return {
        'total': total,
        'correct': correct,
        'accuracy': correct / total * 100,
        'method_stats': dict(method_stats),
        'intent_stats': dict(intent_stats),
        'failures': failures,
        'confusion_pairs': confusion_pairs.most_common(20)
    }

def main():
    # 解析参数
    count = 500
    seed = int(time.time())  # 使用当前时间作为随机种子

    if len(sys.argv) > 1:
        count = int(sys.argv[1])
    if len(sys.argv) > 2:
        seed = int(sys.argv[2])

    print(f"=" * 70)
    print(f"  全面意图识别测试")
    print(f"  用例数: {count}, 随机种子: {seed}, 并行线程: {WORKERS}")
    print(f"=" * 70)

    # 登录
    token = login()
    if not token:
        print("登录失败，退出")
        return
    print("✓ 登录成功")

    # 生成测试用例
    cases = generate_cases(count, seed)
    print(f"✓ 生成 {len(cases)} 个测试用例")

    # 统计用例中的意图分布
    intent_dist = Counter(c['expectedIntent'] for c in cases)
    print(f"✓ 覆盖 {len(intent_dist)} 种意图类型")

    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    session_id = f"test_{datetime.now().strftime('%H%M%S')}"

    # 并行测试
    results = []
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = {executor.submit(test_one, c, headers, session_id): c for c in cases}

        completed = 0
        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            completed += 1

            if completed % 100 == 0:
                passed = sum(1 for r in results if r['correct'])
                elapsed = time.time() - start_time
                rate = passed / completed * 100
                speed = completed / elapsed
                print(f"[{completed:4d}/{count}] 通过: {passed:4d} ({rate:.1f}%) | 速度: {speed:.1f}/s")

    elapsed = time.time() - start_time

    # 分析结果
    analysis = analyze_results(results)

    print()
    print("=" * 70)
    print("  测试结果汇总")
    print("=" * 70)
    print(f"总计: {analysis['correct']}/{analysis['total']} 通过 ({analysis['accuracy']:.1f}%)")
    print(f"耗时: {elapsed:.1f}秒 ({analysis['total']/elapsed:.1f} 用例/秒)")

    # 各层匹配方法统计
    print()
    print("-" * 70)
    print("  各层匹配方法统计")
    print("-" * 70)
    print(f"{'方法':<20} {'总数':>8} {'正确':>8} {'准确率':>10}")
    print("-" * 50)

    method_order = ['PHRASE_MATCH', 'CLASSIFIER', 'SEMANTIC', 'LLM_FALLBACK', 'NONE']
    for method in method_order:
        if method in analysis['method_stats']:
            stats = analysis['method_stats'][method]
            rate = stats['correct'] / stats['total'] * 100 if stats['total'] > 0 else 0
            print(f"{method:<20} {stats['total']:>8} {stats['correct']:>8} {rate:>9.1f}%")

    # 其他方法
    for method, stats in analysis['method_stats'].items():
        if method not in method_order:
            rate = stats['correct'] / stats['total'] * 100 if stats['total'] > 0 else 0
            print(f"{method:<20} {stats['total']:>8} {stats['correct']:>8} {rate:>9.1f}%")

    # 失败率最高的意图
    print()
    print("-" * 70)
    print("  失败率最高的意图 (Top 10)")
    print("-" * 70)

    intent_failures = []
    for intent, stats in analysis['intent_stats'].items():
        if stats['total'] > 0:
            fail_rate = (stats['total'] - stats['correct']) / stats['total'] * 100
            intent_failures.append((intent, stats['total'], stats['correct'], fail_rate))

    intent_failures.sort(key=lambda x: x[3], reverse=True)

    print(f"{'意图':<35} {'总数':>6} {'正确':>6} {'失败率':>8}")
    print("-" * 60)
    for intent, total, correct, fail_rate in intent_failures[:10]:
        if fail_rate > 0:
            print(f"{intent:<35} {total:>6} {correct:>6} {fail_rate:>7.1f}%")

    # 常见混淆对
    if analysis['confusion_pairs']:
        print()
        print("-" * 70)
        print("  常见混淆对 (期望 -> 实际)")
        print("-" * 70)
        for (expected, actual), count in analysis['confusion_pairs'][:15]:
            print(f"  {expected} -> {actual}: {count}次")

    # 失败案例示例
    failures = analysis['failures']
    if failures:
        print()
        print("-" * 70)
        print(f"  失败案例示例 (共 {len(failures)} 个)")
        print("-" * 70)
        for r in failures[:10]:
            method = r['matchMethod'] or 'None'
            print(f"  [{method}] \"{r['userInput']}\"")
            print(f"      期望: {r['expected']}, 实际: {r['actual']}")

    # 保存详细结果
    report_dir = 'reports'
    import os
    os.makedirs(report_dir, exist_ok=True)

    report_file = f"{report_dir}/comprehensive_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump({
            'summary': {
                'total': analysis['total'],
                'correct': analysis['correct'],
                'accuracy': analysis['accuracy'],
                'seed': seed,
                'elapsed': elapsed
            },
            'method_stats': analysis['method_stats'],
            'intent_stats': analysis['intent_stats'],
            'confusion_pairs': [(f"{e}->{a}", c) for (e, a), c in analysis['confusion_pairs']],
            'failures': failures[:100]  # 只保存前100个失败案例
        }, f, ensure_ascii=False, indent=2)

    print()
    print(f"详细报告已保存: {report_file}")
    print("=" * 70)

if __name__ == '__main__':
    main()
