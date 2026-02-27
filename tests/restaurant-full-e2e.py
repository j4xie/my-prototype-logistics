#!/usr/bin/env python3
"""
餐饮模块全链路 E2E 测试
覆盖: 意图匹配 → 执行验证 → 速度测量 → 质量评估

测试维度:
1. 标准短语匹配 (54条)
2. 口语/方言变体 (30条)
3. 反问/否定句式 (15条)
4. 时间限定查询 (15条)
5. 复合意图 (10条)
6. F001/F002 交叉验证 (10条)
7. 负面测试 — 工厂专属短语+F002不命中 (10条)
8. 18个意图 execute 全覆盖
9. 工厂零退化抽样 (20条)

环境: 测试服 47.100.235.168:10011, F002 (RESTAURANT), restaurant_admin1
"""
import requests, json, sys, time, statistics
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = 'http://47.100.235.168:10011'
FACTORY_ID = 'F002'
FACTORY_F001 = 'F001'

# ─── Token Management ───
_tokens = {}

FACTORY_USER_MAP = {
    'F001': 'factory_admin1',
    'F002': 'restaurant_admin1',
}

def get_token(factory_id='F002'):
    cached = _tokens.get(factory_id)
    if cached and (time.time() - cached[1]) < 600:
        return cached[0]
    username = FACTORY_USER_MAP.get(factory_id, 'factory_admin1')
    r = requests.post(f'{BASE_URL}/api/mobile/auth/unified-login',
        json={'username': username, 'password': '123456'}, timeout=15)
    token = r.json()['data']['token']
    _tokens[factory_id] = (token, time.time())
    return token

def recognize(input_text, factory_id='F002'):
    """Intent recognition only."""
    try:
        tok = get_token(factory_id)
        start = time.time()
        r = requests.post(f'{BASE_URL}/api/mobile/{factory_id}/ai-intents/recognize',
            json={'userInput': input_text},
            headers={'Authorization': f'Bearer {tok}'}, timeout=60)
        rt = time.time() - start
        if r.status_code == 401:
            _tokens.pop(factory_id, None)
            tok = get_token(factory_id)
            start = time.time()
            r = requests.post(f'{BASE_URL}/api/mobile/{factory_id}/ai-intents/recognize',
                json={'userInput': input_text},
                headers={'Authorization': f'Bearer {tok}'}, timeout=60)
            rt = time.time() - start
        data = r.json().get('data', {}) or {}
        return {
            'matched': data.get('matched', False),
            'intent': str(data.get('intentCode') or 'N/A'),
            'method': str(data.get('matchMethod') or '?'),
            'category': str(data.get('category') or '?'),
            'confidence': data.get('confidence', 0),
            'rt': rt,
        }
    except Exception as e:
        return {'matched': False, 'intent': 'ERROR', 'method': '?', 'category': '?', 'confidence': 0, 'rt': 0}

def execute_intent(input_text, factory_id='F002'):
    """Full intent execution."""
    try:
        tok = get_token(factory_id)
        start = time.time()
        r = requests.post(f'{BASE_URL}/api/mobile/{factory_id}/ai-intents/execute',
            json={'userInput': input_text},
            headers={'Authorization': f'Bearer {tok}'}, timeout=90)
        rt = time.time() - start
        if r.status_code == 401:
            _tokens.pop(factory_id, None)
            tok = get_token(factory_id)
            start = time.time()
            r = requests.post(f'{BASE_URL}/api/mobile/{factory_id}/ai-intents/execute',
                json={'userInput': input_text},
                headers={'Authorization': f'Bearer {tok}'}, timeout=90)
            rt = time.time() - start
        resp = r.json()
        data = resp.get('data', {}) or {}
        return {
            'success': resp.get('success', False),
            'intent': str(data.get('intentCode') or 'N/A'),
            'status': str(data.get('status') or '?'),
            'category': str(data.get('intentCategory') or '?'),
            'reply': str(data.get('formattedText') or data.get('replyText') or data.get('reply') or ''),
            'has_data': data.get('resultData') is not None and data.get('resultData') != {},
            'result_data': data.get('resultData'),
            'rt': rt,
        }
    except Exception as e:
        return {'success': False, 'intent': 'ERROR', 'status': 'ERROR', 'category': '?',
                'reply': str(e), 'has_data': False, 'result_data': None, 'rt': 0}

# ─── Helper ───
def check_intent(input_text, expected_intents, factory_id='F002'):
    """Check if recognized intent matches any of expected intents (pipe-separated)."""
    expected_list = [x.strip() for x in expected_intents.split('|')]
    result = recognize(input_text, factory_id)
    matched = result['intent'] in expected_list
    return matched, result

# ═══════════════════════════════════════════════
# Phase 1: 意图匹配测试
# ═══════════════════════════════════════════════

# Dimension 1: 标准短语匹配 (54 条, 每意图 3 条核心短语)
STANDARD_PHRASES = {
    'RESTAURANT_DISH_LIST': ['菜品列表', '有哪些菜品', '菜单'],
    'RESTAURANT_DISH_SALES_RANKING': ['菜品销量排行', '销量最好的菜是哪几道', '菜品排名'],
    'RESTAURANT_DISH_COST_ANALYSIS': ['菜品成本分析', '每道菜的成本是多少', '菜品成本'],
    'RESTAURANT_BESTSELLER_QUERY': ['畅销菜', '最受欢迎的菜', '哪道菜卖得最好'],
    'RESTAURANT_SLOW_SELLER_QUERY': ['滞销菜', '哪个菜卖不动', '不好卖的菜'],
    'RESTAURANT_INGREDIENT_STOCK': ['食材库存', '食材还有多少', '库存查询'],
    'RESTAURANT_INGREDIENT_EXPIRY_ALERT': ['快过期食材', '食材过期预警', '临期食材'],
    'RESTAURANT_INGREDIENT_LOW_STOCK': ['低库存食材', '食材不够了', '库存不足的食材'],
    'RESTAURANT_INGREDIENT_COST_TREND': ['食材成本趋势', '食材涨价了吗', '原料成本变化'],
    'RESTAURANT_PROCUREMENT_SUGGESTION': ['采购建议', '需要采购什么', '进货建议'],
    'RESTAURANT_DAILY_REVENUE': ['今天营业额', '今日营业额', '今天赚了多少'],
    'RESTAURANT_REVENUE_TREND': ['营业额趋势', '本周营业额', '最近营业情况'],
    'RESTAURANT_ORDER_STATISTICS': ['今天订单量', '订单统计', '今天接了多少单'],
    'RESTAURANT_PEAK_HOURS_ANALYSIS': ['高峰时段', '哪个时段客人最多', '用餐高峰'],
    'RESTAURANT_MARGIN_ANALYSIS': ['毛利率', '毛利分析', '利润率'],
    'RESTAURANT_WASTAGE_SUMMARY': ['损耗汇总', '食材损耗', '本周损耗'],
    'RESTAURANT_WASTAGE_RATE': ['损耗率', '损耗率是多少', '食材浪费比例'],
    'RESTAURANT_WASTAGE_ANOMALY': ['异常损耗', '有没有异常损耗', '损耗异常检测'],
}

# Dimension 2: 口语/方言变体 (30 条)
COLLOQUIAL_VARIANTS = [
    ('赚了多少钱', 'RESTAURANT_DAILY_REVENUE'),
    ('今天流水多少', 'RESTAURANT_DAILY_REVENUE'),
    ('今天进账多少', 'RESTAURANT_DAILY_REVENUE'),
    ('哪个菜好卖', 'RESTAURANT_BESTSELLER_QUERY'),
    ('什么菜最火', 'RESTAURANT_BESTSELLER_QUERY'),
    ('爆款是什么', 'RESTAURANT_BESTSELLER_QUERY'),
    ('食材不够了', 'RESTAURANT_INGREDIENT_LOW_STOCK'),
    ('原料快用完了', 'RESTAURANT_INGREDIENT_LOW_STOCK'),
    ('该进货了', 'RESTAURANT_PROCUREMENT_SUGGESTION'),
    ('该买什么', 'RESTAURANT_PROCUREMENT_SUGGESTION'),
    ('有什么菜啊', 'RESTAURANT_DISH_LIST'),
    ('今天有啥吃的', 'RESTAURANT_DISH_LIST'),
    ('看看菜', 'RESTAURANT_DISH_LIST'),
    ('那些菜没人点', 'RESTAURANT_SLOW_SELLER_QUERY'),
    ('哪些菜没人要', 'RESTAURANT_SLOW_SELLER_QUERY'),
    ('食材快坏了吗', 'RESTAURANT_INGREDIENT_EXPIRY_ALERT'),
    ('有过期的原料吗', 'RESTAURANT_INGREDIENT_EXPIRY_ALERT'),
    ('今天多少单', 'RESTAURANT_ORDER_STATISTICS'),
    ('几点最忙', 'RESTAURANT_PEAK_HOURS_ANALYSIS'),
    ('什么时候人最多', 'RESTAURANT_PEAK_HOURS_ANALYSIS'),
    ('利润怎么样', 'RESTAURANT_MARGIN_ANALYSIS'),
    ('赚不赚钱', 'RESTAURANT_MARGIN_ANALYSIS'),
    ('浪费了多少', 'RESTAURANT_WASTAGE_SUMMARY'),
    ('今天扔了多少食材', 'RESTAURANT_WASTAGE_SUMMARY'),
    ('菜品卖得怎么样', 'RESTAURANT_DISH_SALES_RANKING'),
    ('原料涨了多少', 'RESTAURANT_INGREDIENT_COST_TREND'),
    ('食材价格变了吗', 'RESTAURANT_INGREDIENT_COST_TREND'),
    ('有多少库存', 'RESTAURANT_INGREDIENT_STOCK'),
    ('损耗正常吗', 'RESTAURANT_WASTAGE_ANOMALY'),
    ('浪费率怎么样', 'RESTAURANT_WASTAGE_RATE'),
]

# Dimension 3: 反问/否定句式 (15 条)
QUESTION_NEGATION = [
    ('有没有快过期的食材', 'RESTAURANT_INGREDIENT_EXPIRY_ALERT'),
    ('库存够不够', 'RESTAURANT_INGREDIENT_LOW_STOCK'),
    ('是不是该采购了', 'RESTAURANT_PROCUREMENT_SUGGESTION'),
    ('有没有滞销的菜', 'RESTAURANT_SLOW_SELLER_QUERY'),
    ('损耗有没有异常', 'RESTAURANT_WASTAGE_ANOMALY'),
    ('今天有没有单', 'RESTAURANT_ORDER_STATISTICS'),
    ('营业额高不高', 'RESTAURANT_DAILY_REVENUE'),
    ('毛利率正不正常', 'RESTAURANT_MARGIN_ANALYSIS'),
    ('食材够不够用', 'RESTAURANT_INGREDIENT_STOCK'),
    ('最近有没有涨价', 'RESTAURANT_INGREDIENT_COST_TREND'),
    ('菜品受不受欢迎', 'RESTAURANT_BESTSELLER_QUERY'),
    ('有没有什么菜要下架', 'RESTAURANT_SLOW_SELLER_QUERY'),
    ('是不是亏了', 'RESTAURANT_MARGIN_ANALYSIS'),
    ('浪费是不是太多了', 'RESTAURANT_WASTAGE_RATE'),
    ('有哪些菜可以推荐', 'RESTAURANT_DISH_LIST|RESTAURANT_BESTSELLER_QUERY'),
]

# Dimension 4: 时间限定查询 (15 条)
TIME_BOUNDED = [
    ('昨天营业额', 'RESTAURANT_DAILY_REVENUE|RESTAURANT_REVENUE_TREND'),
    ('上周营业额', 'RESTAURANT_REVENUE_TREND'),
    ('本月毛利', 'RESTAURANT_MARGIN_ANALYSIS'),
    ('今天的损耗', 'RESTAURANT_WASTAGE_SUMMARY'),
    ('本周食材损耗', 'RESTAURANT_WASTAGE_SUMMARY'),
    ('昨天的订单', 'RESTAURANT_ORDER_STATISTICS'),
    ('近7天营业额', 'RESTAURANT_REVENUE_TREND'),
    ('上个月菜品销量', 'RESTAURANT_DISH_SALES_RANKING'),
    ('今天卖了多少', 'RESTAURANT_DAILY_REVENUE'),
    ('最近一周畅销菜', 'RESTAURANT_BESTSELLER_QUERY'),
    ('这个月的损耗率', 'RESTAURANT_WASTAGE_RATE'),
    ('近30天营业趋势', 'RESTAURANT_REVENUE_TREND'),
    ('上周五的营业额', 'RESTAURANT_DAILY_REVENUE|RESTAURANT_REVENUE_TREND'),
    ('今天的高峰时段', 'RESTAURANT_PEAK_HOURS_ANALYSIS'),
    ('最近采购建议', 'RESTAURANT_PROCUREMENT_SUGGESTION'),
]

# Dimension 5: 复合意图 (10 条, 期望匹配到主意图之一即可)
COMPOUND_INTENTS = [
    ('今天营业额和订单量', 'RESTAURANT_DAILY_REVENUE|RESTAURANT_ORDER_STATISTICS'),
    ('菜品销量和成本分析', 'RESTAURANT_DISH_SALES_RANKING|RESTAURANT_DISH_COST_ANALYSIS'),
    ('食材库存和采购建议', 'RESTAURANT_INGREDIENT_STOCK|RESTAURANT_PROCUREMENT_SUGGESTION'),
    ('损耗太大查原因', 'RESTAURANT_WASTAGE_ANOMALY|RESTAURANT_WASTAGE_SUMMARY'),
    ('哪个菜最好卖利润最高', 'RESTAURANT_BESTSELLER_QUERY|RESTAURANT_MARGIN_ANALYSIS'),
    ('营业额和毛利分析', 'RESTAURANT_DAILY_REVENUE|RESTAURANT_MARGIN_ANALYSIS'),
    ('过期和低库存食材', 'RESTAURANT_INGREDIENT_EXPIRY_ALERT|RESTAURANT_INGREDIENT_LOW_STOCK'),
    ('菜品排名和滞销菜', 'RESTAURANT_DISH_SALES_RANKING|RESTAURANT_SLOW_SELLER_QUERY'),
    ('订单和高峰时段', 'RESTAURANT_ORDER_STATISTICS|RESTAURANT_PEAK_HOURS_ANALYSIS'),
    ('损耗率和异常损耗', 'RESTAURANT_WASTAGE_RATE|RESTAURANT_WASTAGE_ANOMALY'),
]

# Dimension 6: F001/F002 交叉验证 (10 条)
CROSS_VALIDATION = [
    # (input, F001_expected, F002_expected)
    ('营业额', 'REPORT_KPI|DAILY_PRODUCTION_REPORT|DATA_QUERY', 'RESTAURANT_DAILY_REVENUE'),
    ('成本分析', 'COST_TREND_ANALYSIS|DATA_QUERY', 'RESTAURANT_DISH_COST_ANALYSIS|RESTAURANT_INGREDIENT_COST_TREND'),
    ('库存查询', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY', 'RESTAURANT_INGREDIENT_STOCK'),
    ('损耗', 'QUALITY_TREND_REPORT|DATA_QUERY', 'RESTAURANT_WASTAGE_SUMMARY'),
    ('菜品列表', 'PRODUCT_TYPE_QUERY', 'RESTAURANT_DISH_LIST'),
    ('毛利率', 'DATA_QUERY|REPORT_KPI', 'RESTAURANT_MARGIN_ANALYSIS'),
    ('采购建议', 'DATA_QUERY|MATERIAL_BATCH_QUERY', 'RESTAURANT_PROCUREMENT_SUGGESTION'),
    ('订单统计', 'DATA_QUERY|REPORT_KPI', 'RESTAURANT_ORDER_STATISTICS'),
    ('销量排行', 'PRODUCT_SALES_REPORT|DATA_QUERY', 'RESTAURANT_DISH_SALES_RANKING'),
    ('高峰时段', 'DATA_QUERY', 'RESTAURANT_PEAK_HOURS_ANALYSIS'),
]

# Dimension 7: 负面测试 — 工厂专属短语 + F002 不命中餐饮意图 (10 条)
NEGATIVE_TESTS = [
    # Factory-specific phrases that should NOT match restaurant intents on F002
    ('产线良品率', False),  # Factory production line
    ('车间排产', False),    # Workshop scheduling
    ('设备OEE', False),     # Equipment OEE
    ('工单进度', False),    # Work order progress
    ('模具维护', False),    # Mold maintenance
    ('SPC控制图', False),   # Statistical process control
    ('炉次信息', False),    # Furnace batch info
    ('工艺参数', False),    # Process parameters
    ('BOM物料清单', False), # Bill of materials
    ('排产甘特图', False),  # Scheduling Gantt chart
]

# ═══════════════════════════════════════════════
# Phase 2: 意图执行矩阵
# ═══════════════════════════════════════════════

EXECUTE_MATRIX = [
    # (intent_name, input_phrase, validation_checks)
    ('RESTAURANT_DISH_LIST', '菜品列表', ['dishes', '菜品']),
    ('RESTAURANT_DISH_SALES_RANKING', '菜品销量排行', ['ranking', '排名', '销量']),
    ('RESTAURANT_DISH_COST_ANALYSIS', '菜品成本分析', ['成本', 'BOM', '配方']),
    ('RESTAURANT_BESTSELLER_QUERY', '畅销菜', ['畅销', '销量', '受欢迎']),
    ('RESTAURANT_SLOW_SELLER_QUERY', '滞销菜', ['滞销', '卖不动', '销量低', '无销售']),
    ('RESTAURANT_INGREDIENT_STOCK', '食材库存', ['库存', '食材', '数量']),
    ('RESTAURANT_INGREDIENT_EXPIRY_ALERT', '快过期食材', ['过期', '临期', '保质期', '暂无']),
    ('RESTAURANT_INGREDIENT_LOW_STOCK', '低库存食材', ['低库存', '不足', '库存', '暂无']),
    ('RESTAURANT_INGREDIENT_COST_TREND', '食材成本趋势', ['成本', '趋势', '价格', '暂无']),
    ('RESTAURANT_PROCUREMENT_SUGGESTION', '采购建议', ['采购', '建议', '补货']),
    ('RESTAURANT_DAILY_REVENUE', '今天营业额', ['营业额', '¥', '订单']),
    ('RESTAURANT_REVENUE_TREND', '营业额趋势', ['趋势', '营业额', '日均']),
    ('RESTAURANT_ORDER_STATISTICS', '订单统计', ['订单', '客单价', '统计']),
    ('RESTAURANT_PEAK_HOURS_ANALYSIS', '高峰时段', ['高峰', '时段', '时间']),
    ('RESTAURANT_MARGIN_ANALYSIS', '毛利率分析', ['毛利', '利润', '率']),
    ('RESTAURANT_WASTAGE_SUMMARY', '损耗汇总', ['损耗', '汇总', '暂无']),
    ('RESTAURANT_WASTAGE_RATE', '损耗率', ['损耗', '率', '暂无']),
    ('RESTAURANT_WASTAGE_ANOMALY', '异常损耗', ['异常', '损耗', '暂无']),
]

# Phase 9: 工厂零退化抽样 (20 条)
FACTORY_REGRESSION = [
    ('查看今天的生产批次', 'PRODUCTION_BATCH_QUERY|DATA_QUERY'),
    ('原料入库记录', 'MATERIAL_BATCH_QUERY|DATA_QUERY'),
    ('质检报告', 'QUALITY_TREND_REPORT|DATA_QUERY'),
    ('设备维护计划', 'EQUIPMENT_MAINTENANCE_REPORT|DATA_QUERY'),
    ('工人考勤', 'WORKER_ATTENDANCE_QUERY|DATA_QUERY'),
    ('产品出库', 'SHIPMENT_QUERY|DATA_QUERY'),
    ('供应商列表', 'SUPPLIER_QUERY|DATA_QUERY'),
    ('生产日报', 'DAILY_PRODUCTION_REPORT|DATA_QUERY|REPORT_KPI'),
    ('产量统计', 'PRODUCTION_OUTPUT_QUERY|DATA_QUERY|REPORT_KPI'),
    ('良品率', 'QUALITY_TREND_REPORT|DATA_QUERY'),
    ('排产计划', 'SCHEDULING_OVERVIEW|DATA_QUERY'),
    ('物料消耗', 'MATERIAL_CONSUMPTION_QUERY|DATA_QUERY'),
    ('客户订单', 'ORDER_STATUS_QUERY|DATA_QUERY'),
    ('仓库盘点', 'REPORT_INVENTORY|DATA_QUERY'),
    ('人员排班', 'SCHEDULING_OVERVIEW|DATA_QUERY'),
    ('能耗报告', 'DATA_QUERY|REPORT_KPI'),
    ('废品统计', 'QUALITY_TREND_REPORT|DATA_QUERY'),
    ('交付进度', 'DATA_QUERY|ORDER_STATUS_QUERY'),
    ('车间温湿度', 'DATA_QUERY|IOT_DATA_QUERY'),
    ('生产效率', 'PRODUCTION_OUTPUT_QUERY|DATA_QUERY|REPORT_KPI'),
]

# ═══════════════════════════════════════════════
# Test Runner
# ═══════════════════════════════════════════════

def run_dimension_test(name, test_cases, factory_id='F002'):
    """Run a set of (input, expected_intents) tests."""
    passed = 0
    failed = 0
    results = []
    recognize_rts = []

    for item in test_cases:
        if isinstance(item, tuple) and len(item) == 2:
            input_text, expected = item
        else:
            continue

        expected_list = [x.strip() for x in expected.split('|')]
        result = recognize(input_text, factory_id)
        ok = result['intent'] in expected_list
        recognize_rts.append(result['rt'])

        if ok:
            passed += 1
        else:
            failed += 1
            results.append(f"  FAIL: '{input_text}' → {result['intent']} (expected: {expected}) [{result['method']}, {result['rt']:.2f}s]")

    total = passed + failed
    pct = (passed / total * 100) if total > 0 else 0
    p95_rt = sorted(recognize_rts)[int(len(recognize_rts) * 0.95)] if recognize_rts else 0

    print(f"\n{'='*60}")
    print(f"  {name}: {passed}/{total} ({pct:.1f}%)  |  p95 RT: {p95_rt:.2f}s")
    print(f"{'='*60}")
    for r in results:
        print(r)

    return passed, total, recognize_rts

def run_standard_phrase_tests():
    """Dimension 1: Standard phrase matching."""
    test_cases = []
    for intent, phrases in STANDARD_PHRASES.items():
        for phrase in phrases:
            test_cases.append((phrase, intent))
    return run_dimension_test("D1: 标准短语匹配", test_cases)

def run_negative_tests():
    """Dimension 7: Factory-specific phrases should not match restaurant intents."""
    passed = 0
    failed = 0
    results = []
    restaurant_intents = set(STANDARD_PHRASES.keys())

    for input_text, _ in NEGATIVE_TESTS:
        result = recognize(input_text, 'F002')
        # Should NOT match any RESTAURANT_ intent
        is_restaurant = result['intent'].startswith('RESTAURANT_')
        if not is_restaurant:
            passed += 1
        else:
            failed += 1
            results.append(f"  FAIL: '{input_text}' → {result['intent']} (should NOT be RESTAURANT_*)")

    total = passed + failed
    pct = (passed / total * 100) if total > 0 else 0
    print(f"\n{'='*60}")
    print(f"  D7: 负面测试 (工厂短语不命中餐饮): {passed}/{total} ({pct:.1f}%)")
    print(f"{'='*60}")
    for r in results:
        print(r)
    return passed, total, []

def run_cross_validation():
    """Dimension 6: Same phrase → different intents for F001 vs F002."""
    passed = 0
    failed = 0
    results = []

    for input_text, f001_expected, f002_expected in CROSS_VALIDATION:
        f001_list = [x.strip() for x in f001_expected.split('|')]
        f002_list = [x.strip() for x in f002_expected.split('|')]

        r1 = recognize(input_text, 'F001')
        r2 = recognize(input_text, 'F002')

        # F002 should match a restaurant intent
        f2_ok = r2['intent'] in f002_list
        # F001 should NOT match a restaurant intent (loosely: match factory intent OR anything non-restaurant)
        f1_ok = not r1['intent'].startswith('RESTAURANT_')

        if f2_ok and f1_ok:
            passed += 1
        else:
            failed += 1
            detail = f"F001→{r1['intent']}({'OK' if f1_ok else 'BAD'}), F002→{r2['intent']}({'OK' if f2_ok else 'BAD'})"
            results.append(f"  FAIL: '{input_text}': {detail}")

    total = passed + failed
    pct = (passed / total * 100) if total > 0 else 0
    print(f"\n{'='*60}")
    print(f"  D6: 交叉验证 (F001 vs F002): {passed}/{total} ({pct:.1f}%)")
    print(f"{'='*60}")
    for r in results:
        print(r)
    return passed, total, []

def run_factory_regression():
    """Phase 9: Factory F001 zero-degradation check."""
    test_cases = FACTORY_REGRESSION
    passed = 0
    failed = 0
    results = []

    for input_text, expected in test_cases:
        expected_list = [x.strip() for x in expected.split('|')]
        result = recognize(input_text, 'F001')
        # Pass if matched any expected OR matched any non-RESTAURANT_ intent
        ok = result['intent'] in expected_list or (result['matched'] and not result['intent'].startswith('RESTAURANT_'))
        if ok:
            passed += 1
        else:
            failed += 1
            results.append(f"  FAIL: '{input_text}' → {result['intent']} (expected: {expected}) [{result['method']}]")

    total = passed + failed
    pct = (passed / total * 100) if total > 0 else 0
    print(f"\n{'='*60}")
    print(f"  D9: 工厂零退化抽样 (F001): {passed}/{total} ({pct:.1f}%)")
    print(f"{'='*60}")
    for r in results:
        print(r)
    return passed, total

def run_execute_tests():
    """Phase 2: Execute all 18 intents and validate responses."""
    passed = 0
    failed = 0
    results = []
    execute_rts = []
    quality_scores = []

    print(f"\n{'='*60}")
    print(f"  Phase 2: 意图执行验证 (18 个 Handler)")
    print(f"{'='*60}")

    for intent_name, input_phrase, check_words in EXECUTE_MATRIX:
        result = execute_intent(input_phrase, 'F002')
        execute_rts.append(result['rt'])

        # Validation
        status_ok = result['status'] == 'COMPLETED'
        reply_ok = len(result['reply']) > 5
        reply_cn = any('\u4e00' <= c <= '\u9fff' for c in result['reply'])
        word_found = any(w in result['reply'] for w in check_words) if check_words else True

        # Quality score (0-4)
        quality = sum([status_ok, reply_ok, reply_cn, word_found])
        quality_scores.append(quality)

        if status_ok and reply_ok:
            passed += 1
            status = 'PASS'
        else:
            failed += 1
            status = 'FAIL'

        reply_preview = result['reply'][:80].replace('\n', ' ')
        print(f"  [{status}] {intent_name}")
        print(f"         RT: {result['rt']:.2f}s | status={result['status']} | data={'Y' if result['has_data'] else 'N'} | quality={quality}/4")
        print(f"         回复: {reply_preview}...")

    total = passed + failed
    pct = (passed / total * 100) if total > 0 else 0
    avg_rt = statistics.mean(execute_rts) if execute_rts else 0
    p95_rt = sorted(execute_rts)[int(len(execute_rts) * 0.95)] if execute_rts else 0
    avg_quality = statistics.mean(quality_scores) if quality_scores else 0

    print(f"\n  Execute 结果: {passed}/{total} ({pct:.1f}%)")
    print(f"  RT: avg={avg_rt:.2f}s, p95={p95_rt:.2f}s")
    print(f"  平均质量分: {avg_quality:.1f}/4")

    return passed, total, execute_rts, quality_scores

# ═══════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════

def main():
    print("=" * 70)
    print("  餐饮模块全链路 E2E 测试")
    print(f"  环境: {BASE_URL} | F002 (RESTAURANT)")
    print(f"  时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    # Pre-warm tokens
    print("\n[准备] 获取 Token...")
    get_token('F001')
    get_token('F002')
    print("  F001 (factory_admin1): OK")
    print("  F002 (restaurant_admin1): OK")

    all_results = {}
    all_rts = []

    # ─── Phase 1: Intent Matching ───
    print("\n" + "█" * 70)
    print("  PHASE 1: 意图匹配覆盖率测试")
    print("█" * 70)

    # D1: Standard phrases
    d1_pass, d1_total, d1_rts = run_standard_phrase_tests()
    all_results['D1_标准短语'] = (d1_pass, d1_total)
    all_rts.extend(d1_rts)

    # D2: Colloquial variants
    d2_pass, d2_total, d2_rts = run_dimension_test("D2: 口语/方言变体", COLLOQUIAL_VARIANTS)
    all_results['D2_口语变体'] = (d2_pass, d2_total)
    all_rts.extend(d2_rts)

    # D3: Question/negation
    d3_pass, d3_total, d3_rts = run_dimension_test("D3: 反问/否定句式", QUESTION_NEGATION)
    all_results['D3_反问否定'] = (d3_pass, d3_total)
    all_rts.extend(d3_rts)

    # D4: Time-bounded
    d4_pass, d4_total, d4_rts = run_dimension_test("D4: 时间限定查询", TIME_BOUNDED)
    all_results['D4_时间限定'] = (d4_pass, d4_total)
    all_rts.extend(d4_rts)

    # D5: Compound intents
    d5_pass, d5_total, d5_rts = run_dimension_test("D5: 复合意图", COMPOUND_INTENTS)
    all_results['D5_复合意图'] = (d5_pass, d5_total)
    all_rts.extend(d5_rts)

    # D6: Cross-validation
    d6_pass, d6_total, _ = run_cross_validation()
    all_results['D6_交叉验证'] = (d6_pass, d6_total)

    # D7: Negative tests
    d7_pass, d7_total, _ = run_negative_tests()
    all_results['D7_负面测试'] = (d7_pass, d7_total)

    # ─── Phase 2: Execute ───
    print("\n" + "█" * 70)
    print("  PHASE 2: 意图执行验证")
    print("█" * 70)

    ex_pass, ex_total, ex_rts, quality_scores = run_execute_tests()
    all_results['执行验证'] = (ex_pass, ex_total)

    # ─── Phase 9: Factory Regression ───
    print("\n" + "█" * 70)
    print("  PHASE 9: 工厂零退化抽样")
    print("█" * 70)

    reg_pass, reg_total = run_factory_regression()
    all_results['工厂零退化'] = (reg_pass, reg_total)

    # ═══════════════════════════════════════════════
    # Final Report
    # ═══════════════════════════════════════════════
    print("\n" + "█" * 70)
    print("  综合测试报告")
    print("█" * 70)

    total_pass = sum(v[0] for v in all_results.values())
    total_tests = sum(v[1] for v in all_results.values())
    overall_pct = (total_pass / total_tests * 100) if total_tests > 0 else 0

    print(f"\n{'模块':<20} {'通过':>6} {'总数':>6} {'通过率':>8}")
    print("-" * 45)
    for name, (p, t) in all_results.items():
        pct = (p / t * 100) if t > 0 else 0
        status = '✓' if pct >= 80 else '✗'
        print(f"{status} {name:<18} {p:>6} {t:>6} {pct:>7.1f}%")
    print("-" * 45)
    print(f"  {'合计':<18} {total_pass:>6} {total_tests:>6} {overall_pct:>7.1f}%")

    # RT Statistics
    if all_rts:
        print(f"\n  Recognize RT: avg={statistics.mean(all_rts):.2f}s, p50={sorted(all_rts)[len(all_rts)//2]:.2f}s, p95={sorted(all_rts)[int(len(all_rts)*0.95)]:.2f}s")
    if ex_rts:
        print(f"  Execute RT:   avg={statistics.mean(ex_rts):.2f}s, p50={sorted(ex_rts)[len(ex_rts)//2]:.2f}s, p95={sorted(ex_rts)[int(len(ex_rts)*0.95)]:.2f}s")

    # Quality summary
    if quality_scores:
        avg_q = statistics.mean(quality_scores)
        high_q = sum(1 for q in quality_scores if q >= 3)
        print(f"\n  回复质量: avg={avg_q:.1f}/4, 高质量(≥3/4): {high_q}/{len(quality_scores)}")

    # Acceptance criteria
    print(f"\n{'─'*45}")
    print("  验收标准检查:")
    d1_ok = d1_pass == d1_total
    d2_ok = d2_pass >= d2_total * 0.83
    d6_ok = d6_pass == d6_total
    reg_ok = reg_pass == reg_total
    ex_ok = ex_pass == ex_total
    rec_rt_ok = all_rts and sorted(all_rts)[int(len(all_rts)*0.95)] <= 5.0  # generous for LLM fallback
    ex_rt_ok = ex_rts and sorted(ex_rts)[int(len(ex_rts)*0.95)] <= 5.0

    checks = [
        (f"标准短语 100%: {d1_pass}/{d1_total}", d1_ok),
        (f"口语变体 ≥83%: {d2_pass}/{d2_total}", d2_ok),
        (f"交叉验证 100%: {d6_pass}/{d6_total}", d6_ok),
        (f"工厂零退化: {reg_pass}/{reg_total}", reg_ok),
        (f"Execute 18/18: {ex_pass}/{ex_total}", ex_ok),
        (f"Recognize p95 ≤5s: {sorted(all_rts)[int(len(all_rts)*0.95)]:.2f}s" if all_rts else "No RT data", rec_rt_ok),
        (f"Execute p95 ≤5s: {sorted(ex_rts)[int(len(ex_rts)*0.95)]:.2f}s" if ex_rts else "No RT data", ex_rt_ok),
    ]

    for desc, ok in checks:
        print(f"  {'✓' if ok else '✗'} {desc}")

    all_pass = all(ok for _, ok in checks)
    print(f"\n  {'▶ 全部通过' if all_pass else '▶ 存在未达标项'}")

    # P1 TODO list
    print(f"\n{'─'*45}")
    print("  P1 待办清单 (未实现功能):")
    p1_items = [
        "RESTAURANT_DISH_CREATE — 添加菜品 (写入)",
        "RESTAURANT_DISH_UPDATE — 修改菜品 (写入)",
        "RESTAURANT_DISH_DELETE — 下架菜品 (写入)",
        "RESTAURANT_WASTAGE_RECORD — 记录损耗 (写入)",
        "RESTAURANT_PROCUREMENT_CREATE — 生成采购单 (写入)",
        "RESTAURANT_TABLE_TURNOVER — 翻台率 (扩展查询)",
        "RESTAURANT_RETURN_RATE — 退单率 (扩展查询)",
        "RESTAURANT_AVG_TICKET — 人均消费 (扩展查询)",
        "餐饮知识库: 不建议单独建设, 用 LLM fallback system prompt 注入",
    ]
    for i, item in enumerate(p1_items, 1):
        print(f"  {i}. {item}")

    return 0 if all_pass else 1

if __name__ == '__main__':
    sys.exit(main())
