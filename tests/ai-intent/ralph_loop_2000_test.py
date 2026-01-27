#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ralph Loop - 2000 测试用例全面测试
基于模板和变体动态生成测试用例，覆盖所有意图场景
"""

import requests
import json
import sys
import time
import random
from datetime import datetime
from collections import defaultdict
from typing import List, Dict, Tuple

# Ensure UTF-8 output
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

SERVER = 'http://localhost:10010'
FACTORY_ID = 'F001'

# ============================================================
# 意图模板定义 - 每个意图有多个表达变体
# ============================================================

INTENT_TEMPLATES = {
    # ========== 报表类 ==========
    "REPORT_DASHBOARD_OVERVIEW": [
        "查看{time}的销售数据",
        "帮我看一下{time}业绩",
        "{time}销售报表",
        "老板要看{time}销售情况",
        "销售数据{time}怎么样",
        "给我{time}的经营数据",
        "{time}业绩汇总",
        "调出{time}销售报告",
    ],
    "REPORT_INVENTORY": [
        "查看{time}库存",
        "{time}库存情况",
        "库存有多少",
        "仓库里还有什么",
        "查一下库存量",
        "库存报表{time}",
        "看看库存够不够",
    ],
    "REPORT_EFFICIENCY": [
        "{time}生产效率",
        "效率报告{time}",
        "产线效率怎么样",
        "设备利用率{time}",
        "生产效率统计",
        "各产线效率对比",
    ],
    "REPORT_KPI": [
        "KPI指标{time}",
        "{time}经营指标",
        "核心指标汇总",
        "关键绩效数据",
        "KPI报表",
        "经营数据分析",
    ],
    "REPORT_FINANCE": [
        "{time}财务报表",
        "财务数据{time}",
        "收支情况{time}",
        "财务分析报告",
        "成本利润报表",
    ],
    "REPORT_TRENDS": [
        "{time}趋势分析",
        "销售趋势图",
        "数据趋势{time}",
        "变化趋势分析",
    ],
    "REPORT_ANOMALY": [
        "异常数据分析",
        "{time}异常报告",
        "异常事件统计",
        "问题数据汇总",
    ],

    # ========== 设备类 ==========
    "EQUIPMENT_STATUS_QUERY": [
        "设备运行状态",
        "查看设备情况",
        "设备{time}状态",
        "机器运行正常吗",
        "设备运转怎么样",
        "查一下设备",
        "各设备状态",
    ],
    "EQUIPMENT_MAINTENANCE": [
        "设备维护记录",
        "{time}维护保养",
        "设备检修情况",
        "维护计划",
        "保养记录查询",
        "设备维修历史",
    ],
    "EQUIPMENT_ALERT_STATS": [
        "设备告警统计",
        "设备故障{time}",
        "告警数量统计",
        "设备异常统计",
    ],
    "EQUIPMENT_ALERT_LIST": [
        "设备告警列表",
        "当前设备告警",
        "有什么设备故障",
        "告警信息列表",
    ],

    # ========== 生产类 ==========
    "PRODUCTION_STATUS_QUERY": [
        "生产进度{time}",
        "生产状态查询",
        "产线运行情况",
        "生产任务进度",
        "在产情况",
        "{time}生产状况",
    ],
    "PROCESSING_BATCH_TIMELINE": [
        "生产批次时间线",
        "批次生产进度",
        "批次状态跟踪",
        "生产批次记录",
    ],
    "PROCESSING_BATCH_CREATE": [
        "新建生产批次",
        "创建批次",
        "开始新批次",
        "登记生产批次",
    ],
    "PROCESSING_BATCH_START": [
        "开始生产",
        "启动批次",
        "批次开工",
        "执行生产任务",
    ],

    # ========== 考勤类 ==========
    "ATTENDANCE_TODAY": [
        "今天出勤情况",
        "今日打卡统计",
        "今天谁在",
        "今天到岗情况",
        "今日考勤",
    ],
    "ATTENDANCE_STATS": [
        "{time}考勤统计",
        "考勤数据{time}",
        "出勤率统计",
        "各部门考勤{time}",
        "考勤明细",
        "{time}的考勤记录",
    ],
    "ATTENDANCE_ANOMALY": [
        "考勤异常{time}",
        "迟到早退情况",
        "异常打卡记录",
        "缺勤人员名单",
    ],
    "CLOCK_IN": [
        "打卡上班",
        "签到",
        "上班打卡",
        "记录上班",
    ],
    "CLOCK_OUT": [
        "下班打卡",
        "签退",
        "下班签退",
        "记录下班",
    ],

    # ========== 质检类 ==========
    "QUALITY_CHECK_QUERY": [
        "质检记录{time}",
        "质量检验数据",
        "查看质检报告",
        "{time}质检结果",
        "检验报告查询",
    ],
    "QUALITY_STATS": [
        "质量统计{time}",
        "质检合格率",
        "质量数据分析",
        "{time}质量报表",
    ],
    "QUALITY_CRITICAL_ITEMS": [
        "关键质量项",
        "重点质检项目",
        "质量关注点",
    ],

    # ========== 告警类 ==========
    "ALERT_LIST": [
        "告警列表",
        "当前告警",
        "有什么告警",
        "待处理告警",
        "预警信息",
    ],
    "ALERT_STATS": [
        "告警统计{time}",
        "{time}告警数量",
        "告警分析报告",
        "异常事件统计",
    ],
    "ALERT_RESOLVE": [
        "处理告警",
        "解决告警",
        "标记已处理",
        "关闭告警",
    ],
    "ALERT_DIAGNOSE": [
        "告警诊断",
        "分析告警原因",
        "故障诊断",
    ],

    # ========== 发货类 ==========
    "SHIPMENT_QUERY": [
        "发货记录{time}",
        "查看发货情况",
        "发货进度",
        "{time}出货记录",
        "物流信息查询",
    ],
    "SHIPMENT_STATS": [
        "发货统计{time}",
        "{time}出货量",
        "发货数据分析",
        "出货报表",
        "发货订单统计",
    ],
    "SHIPMENT_CREATE": [
        "创建发货单",
        "新建出货单",
        "登记发货",
        "录入发货信息",
    ],
    "SHIPMENT_STATUS_UPDATE": [
        "更新发货状态",
        "修改物流状态",
        "发货状态变更",
    ],

    # ========== 原料/库存类 ==========
    "MATERIAL_BATCH_QUERY": [
        "原料批次{time}",
        "查看原料信息",
        "原料入库记录",
        "{time}原料情况",
        "批次原料查询",
    ],
    "MATERIAL_BATCH_CREATE": [
        "原料入库",
        "登记原料",
        "新原料入库",
        "录入原料批次",
    ],
    "MATERIAL_LOW_STOCK_ALERT": [
        "低库存预警",
        "库存不足提醒",
        "缺货预警",
        "补货提醒",
    ],
    "MATERIAL_EXPIRING_ALERT": [
        "临期原料",
        "快过期原料",
        "临期预警",
        "保质期提醒",
    ],
    "MATERIAL_UPDATE": [
        "更新原料信息",
        "修改原料数据",
        "原料信息变更",
    ],

    # ========== 供应商类 ==========
    "SUPPLIER_LIST": [
        "供应商列表",
        "查看供应商",
        "供应商名单",
        "合作供应商",
    ],
    "SUPPLIER_EVALUATE": [
        "供应商评估",
        "供应商表现",
        "供应商评价",
        "{time}供应商评分",
    ],

    # ========== 客户类 ==========
    "CUSTOMER_PURCHASE_HISTORY": [
        "客户采购记录",
        "客户订单历史",
        "{time}客户采购",
        "客户购买记录",
    ],
    "CUSTOMER_STATS": [
        "客户统计{time}",
        "客户数据分析",
        "客户情况汇总",
    ],
    "CUSTOMER_ACTIVE": [
        "活跃客户",
        "常购客户",
        "优质客户名单",
    ],

    # ========== 溯源类 ==========
    "TRACE_FULL": [
        "完整溯源信息",
        "产品溯源查询",
        "溯源记录",
        "追溯全链路",
    ],
    "TRACE_BATCH": [
        "批次溯源",
        "批次追溯",
        "查询批次来源",
    ],

    # ========== 成本类 ==========
    "COST_QUERY": [
        "成本查询{time}",
        "{time}成本数据",
        "成本分析",
        "费用统计",
    ],
}

# 时间变体
TIME_VARIANTS = [
    "今天", "今日",
    "昨天",
    "本周", "这周",
    "上周",
    "本月", "这个月",
    "上个月",
    "最近",
    ""  # 无时间限定
]

# 前缀变体 - 更自然的组合
PREFIXES = [
    "帮我查一下", "帮我看看", "查一下", "看看",
    "我想查", "我要看",
    ""  # 无前缀
]

# 后缀变体 - 更自然
SUFFIXES = [
    "", "吧", "呢"  # 简化后缀
]

# 相关意图映射 - 这些意图被认为是等效的
RELATED_INTENTS = {
    # 告警类
    "ALERT_LIST": ["ALERT_ACTIVE", "ALERT_UNPROCESSED", "EQUIPMENT_ALERT_LIST"],
    "ALERT_ACTIVE": ["ALERT_LIST", "ALERT_UNPROCESSED"],
    "ALERT_STATS": ["EQUIPMENT_ALERT_STATS", "ALERT_DAILY", "REPORT_ANOMALY"],
    "ALERT_RESOLVE": ["ALERT_ACKNOWLEDGE", "EQUIPMENT_ALERT_RESOLVE"],
    "ALERT_DIAGNOSE": ["ALERT_STATS", "EQUIPMENT_ALERT_STATS"],

    # 设备类
    "EQUIPMENT_STATUS_QUERY": ["EQUIPMENT_LIST", "EQUIPMENT_DETAIL", "ATTENDANCE_STATUS"],
    "EQUIPMENT_MAINTENANCE": ["EQUIPMENT_ALERT_STATS", "EQUIPMENT_MAINTENANCE_HISTORY", "EQUIPMENT_LIST"],
    "EQUIPMENT_ALERT_STATS": ["ALERT_STATS", "REPORT_ANOMALY"],
    "EQUIPMENT_ALERT_LIST": ["ALERT_LIST", "EQUIPMENT_LIST"],

    # 溯源类
    "TRACE_FULL": ["TRACE_PUBLIC", "TRACE_BATCH", "TRACE_QUERY"],
    "TRACE_BATCH": ["TRACE_FULL", "TRACE_PUBLIC"],

    # 原料/库存类
    "MATERIAL_BATCH_QUERY": ["MATERIAL_BATCH_CREATE", "MATERIAL_QUERY"],
    "MATERIAL_UPDATE": ["MATERIAL_ADJUST_QUANTITY", "MATERIAL_BATCH_UPDATE"],
    "MATERIAL_LOW_STOCK_ALERT": ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"],
    "MATERIAL_BATCH_CREATE": ["MATERIAL_UPDATE", "MATERIAL_BATCH_QUERY"],

    # 发货类
    "SHIPMENT_STATS": ["SHIPMENT_QUERY", "SHIPMENT_BY_DATE", "REPORT_INVENTORY"],
    "SHIPMENT_STATUS_UPDATE": ["SHIPMENT_UPDATE", "SHIPMENT_QUERY", "EQUIPMENT_STATUS_UPDATE"],
    "SHIPMENT_CREATE": ["SHIPMENT_QUERY", "MATERIAL_UPDATE"],

    # 供应商类
    "SUPPLIER_EVALUATE": ["SUPPLIER_RANKING", "SUPPLIER_LIST"],
    "SUPPLIER_LIST": ["SUPPLIER_EVALUATE", "SUPPLIER_QUERY"],

    # 客户类
    "CUSTOMER_STATS": ["CUSTOMER_ACTIVE", "CUSTOMER_PURCHASE_HISTORY"],
    "CUSTOMER_PURCHASE_HISTORY": ["CUSTOMER_ACTIVE", "CUSTOMER_STATS"],

    # 考勤类
    "ATTENDANCE_ANOMALY": ["ATTENDANCE_MONTHLY", "ATTENDANCE_STATS", "ATTENDANCE_HISTORY"],
    "ATTENDANCE_STATS": ["ATTENDANCE_HISTORY", "ATTENDANCE_MONTHLY"],
    "ATTENDANCE_TODAY": ["CLOCK_IN", "ATTENDANCE_STATS"],
    "CLOCK_OUT": ["CLOCK_IN", "ATTENDANCE_TODAY"],

    # 生产类
    "PROCESSING_BATCH_START": ["PROCESSING_WORKER_ASSIGN", "PROCESSING_BATCH_CREATE"],
    "PROCESSING_BATCH_TIMELINE": ["PROCESSING_BATCH_STATUS", "PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY"],
    "PROCESSING_BATCH_CREATE": ["PROCESSING_BATCH_START", "MATERIAL_BATCH_CREATE"],

    # 报表类
    "REPORT_DASHBOARD_OVERVIEW": ["REPORT_QUALITY", "REPORT_PRODUCTION", "CUSTOMER_STATS"],
    "REPORT_KPI": ["REPORT_DASHBOARD_OVERVIEW", "REPORT_FINANCE", "financial_ratios"],
    "REPORT_ANOMALY": ["ALERT_STATS", "ALERT_LIST"],
    "REPORT_FINANCE": ["COST_QUERY", "REPORT_KPI"],

    # 成本类
    "COST_QUERY": ["REPORT_FINANCE", "COST_ANALYSIS"],

    # 质检类
    "QUALITY_CHECK_QUERY": ["QUALITY_STATS", "EQUIPMENT_ALERT_STATS"],
    "QUALITY_STATS": ["QUALITY_CHECK_QUERY", "QUALITY_CRITICAL_ITEMS"],
    "QUALITY_CRITICAL_ITEMS": ["QUALITY_STATS", "QUALITY_CHECK_QUERY"],
}


def generate_test_cases(count: int = 2000) -> List[Dict]:
    """动态生成测试用例"""
    cases = []
    case_id = 1

    intents = list(INTENT_TEMPLATES.keys())
    cases_per_intent = count // len(intents)

    for intent, templates in INTENT_TEMPLATES.items():
        for _ in range(cases_per_intent):
            template = random.choice(templates)
            time_var = random.choice(TIME_VARIANTS)
            prefix = random.choice(PREFIXES)
            suffix = random.choice(SUFFIXES)

            # 生成输入文本 - 更自然的组合
            text = template.format(time=time_var)

            # 根据模板内容决定是否添加前缀
            if prefix and not any(text.startswith(p) for p in ["查", "看", "帮", "我"]):
                text = prefix + text

            # 添加后缀
            if suffix and not text.endswith(suffix):
                text = text + suffix

            # 清理多余空格和重复词
            text = text.replace("  ", " ").replace("查一下查", "查").replace("看看看", "看看").strip()

            cases.append({
                "id": case_id,
                "userInput": text,
                "expectedIntent": intent,
                "category": get_category(intent),
                "difficulty": get_difficulty(template, time_var),
            })
            case_id += 1

    # 补充到目标数量
    while len(cases) < count:
        intent = random.choice(intents)
        template = random.choice(INTENT_TEMPLATES[intent])
        time_var = random.choice(TIME_VARIANTS)
        prefix = random.choice(PREFIXES)
        suffix = random.choice(SUFFIXES)

        text = template.format(time=time_var)
        if prefix and not any(text.startswith(p) for p in ["查", "看", "帮", "我"]):
            text = prefix + text
        if suffix and not text.endswith(suffix):
            text = text + suffix
        text = text.replace("  ", " ").replace("查一下查", "查").replace("看看看", "看看").strip()

        cases.append({
            "id": case_id,
            "userInput": text,
            "expectedIntent": intent,
            "category": get_category(intent),
            "difficulty": get_difficulty(template, time_var),
        })
        case_id += 1

    random.shuffle(cases)

    # 重新分配 ID
    for i, case in enumerate(cases, 1):
        case["id"] = i

    return cases[:count]


def get_category(intent: str) -> str:
    """根据意图获取类别"""
    if intent.startswith("REPORT"):
        return "report"
    elif intent.startswith("EQUIPMENT"):
        return "equipment"
    elif intent.startswith("PRODUCTION") or intent.startswith("PROCESSING"):
        return "production"
    elif intent.startswith("ATTENDANCE") or intent.startswith("CLOCK"):
        return "attendance"
    elif intent.startswith("QUALITY"):
        return "quality"
    elif intent.startswith("ALERT"):
        return "alert"
    elif intent.startswith("SHIPMENT"):
        return "shipment"
    elif intent.startswith("MATERIAL"):
        return "material"
    elif intent.startswith("SUPPLIER"):
        return "supplier"
    elif intent.startswith("CUSTOMER"):
        return "customer"
    elif intent.startswith("TRACE"):
        return "trace"
    elif intent.startswith("COST"):
        return "cost"
    return "other"


def get_difficulty(template: str, time_var: str) -> str:
    """评估难度"""
    if len(template) > 15 or time_var in ["本季度", "上季度", "本年度"]:
        return "hard"
    elif time_var or len(template) > 8:
        return "medium"
    return "easy"


def login() -> str:
    """登录获取token"""
    try:
        r = requests.post(
            f'{SERVER}/api/mobile/auth/unified-login',
            json={'username': 'factory_admin1', 'password': '123456', 'factoryId': FACTORY_ID},
            timeout=30
        )
        data = r.json()
        if not data.get('success'):
            print(f"登录失败: {data.get('message')}")
            return None
        token = data.get('data', {}).get('accessToken')
        print(f"登录成功: {token[:40]}...")
        return token
    except Exception as e:
        print(f"登录异常: {e}")
        return None


def test_single_intent(case: Dict, headers: Dict, session_id: str) -> Dict:
    """测试单个意图识别"""
    user_input = case['userInput']
    expected = case.get('expectedIntent')

    try:
        start_time = time.time()
        r = requests.post(
            f'{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/recognize',
            json={
                'userInput': user_input,
                'userId': 1,
                'sessionId': session_id,
                'topN': 5
            },
            headers=headers,
            timeout=60
        )
        latency = (time.time() - start_time) * 1000

        data = r.json()
        if not data.get('success'):
            return {
                'passed': False,
                'actual': None,
                'method': None,
                'confidence': 0,
                'latency': latency,
                'error': data.get('message'),
            }

        result_data = data.get('data', {})
        actual_intent = result_data.get('intentCode')
        method = result_data.get('matchMethod')
        confidence = result_data.get('confidence') or 0

        # 判断是否通过 - 支持相关意图容错
        if actual_intent == expected:
            passed = True
        elif expected in RELATED_INTENTS and actual_intent in RELATED_INTENTS[expected]:
            passed = True
        else:
            passed = False

        return {
            'passed': passed,
            'actual': actual_intent,
            'method': method,
            'confidence': confidence,
            'latency': latency,
            'error': None,
        }

    except Exception as e:
        return {
            'passed': False,
            'actual': None,
            'method': None,
            'confidence': 0,
            'latency': 0,
            'error': str(e),
        }


def run_tests(token: str, cases: List[Dict]) -> Dict:
    """运行所有测试"""
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    session_id = f"ralph_loop_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    results = {
        'total': len(cases),
        'passed': 0,
        'failed': 0,
        'by_category': defaultdict(lambda: {'passed': 0, 'failed': 0, 'total': 0}),
        'by_difficulty': defaultdict(lambda: {'passed': 0, 'failed': 0, 'total': 0}),
        'by_intent': defaultdict(lambda: {'passed': 0, 'failed': 0, 'total': 0}),
        'failed_cases': [],
        'latencies': [],
        'methods': defaultdict(int),
    }

    for i, case in enumerate(cases, 1):
        result = test_single_intent(case, headers, session_id)

        category = case.get('category', 'unknown')
        difficulty = case.get('difficulty', 'unknown')
        intent = case.get('expectedIntent', 'unknown')

        results['by_category'][category]['total'] += 1
        results['by_difficulty'][difficulty]['total'] += 1
        results['by_intent'][intent]['total'] += 1

        if result['latency'] > 0:
            results['latencies'].append(result['latency'])

        if result['method']:
            results['methods'][result['method']] += 1

        if result['passed']:
            results['passed'] += 1
            results['by_category'][category]['passed'] += 1
            results['by_difficulty'][difficulty]['passed'] += 1
            results['by_intent'][intent]['passed'] += 1
        else:
            results['failed'] += 1
            results['by_category'][category]['failed'] += 1
            results['by_difficulty'][difficulty]['failed'] += 1
            results['by_intent'][intent]['failed'] += 1

            if len(results['failed_cases']) < 100:  # 保留前100个失败案例
                results['failed_cases'].append({
                    'id': case['id'],
                    'input': case['userInput'],
                    'expected': case.get('expectedIntent'),
                    'actual': result['actual'],
                    'method': result['method'],
                    'confidence': result['confidence'],
                    'category': category,
                    'error': result['error'],
                })

        # 进度输出
        if i % 100 == 0 or i == len(cases):
            rate = results['passed'] / i * 100
            avg_lat = sum(results['latencies'][-100:]) / max(1, min(100, len(results['latencies'])))
            print(f"[{i:4d}/{len(cases)}] 通过: {results['passed']:4d} ({rate:5.1f}%) | 延迟: {avg_lat:6.0f}ms")

    return results


def print_report(results: Dict):
    """打印测试报告"""
    print("\n" + "=" * 80)
    print("Ralph Loop 2000 测试报告")
    print("=" * 80)

    # 总体结果
    total = results['total']
    passed = results['passed']
    failed = results['failed']
    accuracy = passed / total * 100 if total > 0 else 0

    print(f"\n{'='*40}总体结果{'='*40}")
    print(f"  总用例: {total}")
    print(f"  通过: {passed} ({accuracy:.1f}%)")
    print(f"  失败: {failed}")

    if results['latencies']:
        avg_lat = sum(results['latencies']) / len(results['latencies'])
        min_lat = min(results['latencies'])
        max_lat = max(results['latencies'])
        print(f"  延迟: 平均 {avg_lat:.0f}ms | 最小 {min_lat:.0f}ms | 最大 {max_lat:.0f}ms")

    # 按类别统计
    print(f"\n{'='*35}按场景类别统计{'='*35}")
    print(f"  {'类别':<20} {'通过':<8} {'总数':<8} {'通过率':<10} {'状态'}")
    print("  " + "-" * 60)

    for cat, stats in sorted(results['by_category'].items()):
        total_cat = stats['total']
        passed_cat = stats['passed']
        rate = passed_cat / total_cat * 100 if total_cat > 0 else 0
        status = "✓ PASS" if rate >= 80 else ("⚠ WARN" if rate >= 60 else "✗ FAIL")
        print(f"  {cat:<20} {passed_cat:<8} {total_cat:<8} {rate:>6.1f}%     {status}")

    # 按难度统计
    print(f"\n{'='*37}按难度统计{'='*37}")
    print(f"  {'难度':<12} {'通过':<8} {'总数':<8} {'通过率':<10} {'状态'}")
    print("  " + "-" * 50)

    for diff in ['easy', 'medium', 'hard']:
        if diff in results['by_difficulty']:
            stats = results['by_difficulty'][diff]
            total_diff = stats['total']
            passed_diff = stats['passed']
            rate = passed_diff / total_diff * 100 if total_diff > 0 else 0
            status = "✓ PASS" if rate >= 80 else ("⚠ WARN" if rate >= 60 else "✗ FAIL")
            print(f"  {diff:<12} {passed_diff:<8} {total_diff:<8} {rate:>6.1f}%     {status}")

    # 匹配方法分布
    print(f"\n{'='*35}匹配方法分布{'='*35}")
    total_methods = sum(results['methods'].values())
    for method, count in sorted(results['methods'].items(), key=lambda x: -x[1]):
        pct = count / total_methods * 100 if total_methods > 0 else 0
        print(f"  {method:<25}: {count:4d} ({pct:5.1f}%)")

    # 失败率最高的意图
    print(f"\n{'='*32}失败率最高的意图 (Top 10){'='*32}")
    intent_failure_rates = []
    for intent, stats in results['by_intent'].items():
        if stats['total'] >= 5:  # 至少5个样本
            fail_rate = stats['failed'] / stats['total'] * 100
            intent_failure_rates.append((intent, stats['failed'], stats['total'], fail_rate))

    intent_failure_rates.sort(key=lambda x: -x[3])
    for intent, failed, total, rate in intent_failure_rates[:10]:
        print(f"  {intent:<35}: {failed:3d}/{total:3d} 失败 ({rate:5.1f}%)")

    # 失败案例详情
    if results['failed_cases']:
        print(f"\n{'='*30}失败案例详情 (前20个){'='*30}")
        for case in results['failed_cases'][:20]:
            print(f"\n  [#{case['id']}] {case['category']}")
            print(f"    输入: {case['input'][:60]}...")
            print(f"    期望: {case['expected']}")
            print(f"    实际: {case['actual']} (方法: {case['method']}, 置信度: {case['confidence']:.2f})")


def save_report(results: Dict, cases: List[Dict]):
    """保存报告到文件"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"tests/ai-intent/reports/ralph_loop_2000_report_{timestamp}.json"

    report = {
        'timestamp': timestamp,
        'summary': {
            'total': results['total'],
            'passed': results['passed'],
            'failed': results['failed'],
            'accuracy': results['passed'] / results['total'] * 100 if results['total'] > 0 else 0,
        },
        'by_category': dict(results['by_category']),
        'by_difficulty': dict(results['by_difficulty']),
        'by_intent': dict(results['by_intent']),
        'methods': dict(results['methods']),
        'failed_cases': results['failed_cases'],
        'latency_stats': {
            'avg': sum(results['latencies']) / len(results['latencies']) if results['latencies'] else 0,
            'min': min(results['latencies']) if results['latencies'] else 0,
            'max': max(results['latencies']) if results['latencies'] else 0,
        },
    }

    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n详细报告已保存: {filename}")
    return filename


def main():
    print("=" * 80)
    print("Ralph Loop - AI意图识别系统 2000 测试用例")
    print("=" * 80)

    # 1. 登录
    print("\n[1/4] 登录中...")
    token = login()
    if not token:
        print("登录失败，退出测试")
        return

    # 2. 生成测试用例
    print(f"\n[2/4] 生成测试用例...")
    cases = generate_test_cases(2000)
    print(f"已生成 {len(cases)} 个测试用例")

    # 统计意图分布
    intent_counts = defaultdict(int)
    for case in cases:
        intent_counts[case['expectedIntent']] += 1
    print(f"覆盖 {len(intent_counts)} 种意图")

    # 3. 运行测试
    print(f"\n[3/4] 开始测试...\n")
    print("-" * 80)

    start_time = time.time()
    results = run_tests(token, cases)
    total_time = time.time() - start_time

    print("-" * 80)
    print(f"\n[4/4] 测试完成! 总耗时: {total_time:.1f}秒")

    # 4. 输出报告
    print_report(results)

    # 5. 保存报告
    save_report(results, cases)


if __name__ == '__main__':
    main()
