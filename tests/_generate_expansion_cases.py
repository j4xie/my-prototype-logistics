#!/usr/bin/env python3
"""
Generate NEW test categories (AI1-AN3) for intent routing E2E.
Covers untested dimensions:
  AI1-AI5: Typo/misspelling resilience (错别字容错)
  AJ1-AJ3: Mixed Chinese-English (中英混合)
  AK1-AK3: Emoji/special chars in queries (表情符号/特殊字符)
  AL1-AL3: Very long queries with noise (超长噪音输入)
  AM1-AM3: Restaurant domain extended (餐饮扩展)
  AN1-AN3: Multi-turn context simulation (多轮上下文模拟)

Analyzes existing coverage gaps from A1-AH15 and generates
50-80 NEW test cases in the exact same format.

Output: Python dict ready to merge into categories = {...}
"""

# =====================================================================
# COVERAGE GAP ANALYSIS
# =====================================================================
#
# Existing coverage (A1-AH15, ~140 groups):
#   - W1 has 5 typo cases, but only simple single-char substitutions
#   - W2 has 4 Chinese-English mix cases, very basic
#   - AA7 has pure noise (???, 666), but no emoji-embedded queries
#   - W5/J3 have long queries, but not extreme (50+ char with filler)
#   - AC1-AC4 cover restaurant basics, but no restaurant WRITE ops
#   - Z1-Z2/AB7 cover context refs, but no multi-turn chains
#
# GAPS IDENTIFIED:
#   1. Typos: Only W1 has 5 cases. No phonetic confusion (同音字),
#      no radical confusion (形近字), no pinyin typos.
#   2. Chinese-English: W2 has 4 cases. No full English domain words,
#      no mixed-script numbers, no code-like inputs.
#   3. Emoji/Special: AA7 tests pure noise. No emoji + real intent,
#      no Unicode symbols mixed with business terms.
#   4. Long queries: J3/W5 max ~40 chars. No 60+ char queries with
#      heavy filler words, repeated info, or stream-of-consciousness.
#   5. Restaurant: AC1-AC4 are QUERY only. No restaurant WRITE ops
#      (create menu item, record waste, update price).
#   6. Multi-turn: Z1/Z2/AB7 test single references. No chained
#      follow-ups like "接上条 → 再详细看 → 导出这个".
# =====================================================================

expansion_categories = {

    # ====== AI1-AI5: Typo/Misspelling Resilience (错别字深度容错) ======
    'AI1': ('拼写错误-库存领域同音字', [
        ('库纯还有多少', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|QUERY_INVENTORY_QUANTITY|N/A', '库存→库纯(同音typo)'),
        ('原才料入库了没', 'QUERY', 'MATERIAL_BATCH_QUERY|MATERIAL_BATCH_CREATE|N/A', '材→才(形近typo)'),
        ('查看仓酷温度', 'QUERY', 'COLD_CHAIN_TEMPERATURE|REPORT_INVENTORY|MATERIAL_BATCH_QUERY|N/A', '库→酷(同音typo)'),
        ('猪肉存活量', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|N/A', '存货→存活(同音typo)'),
        ('低库纯预警', 'QUERY', 'MATERIAL_LOW_STOCK_ALERT|MATERIAL_BATCH_QUERY|REPORT_INVENTORY|N/A', '库存→库纯(预警场景)'),
    ]),
    'AI2': ('拼写错误-生产领域形近字', [
        ('查看生厂批次', 'QUERY', 'PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY|N/A', '产→厂(形近typo)'),
        ('今天的厂量是多少', 'QUERY', 'REPORT_PRODUCTION|PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY|N/A', '产量→厂量'),
        ('批刺详情', 'QUERY', 'PROCESSING_BATCH_DETAIL|PROCESSING_BATCH_LIST|N/A', '次→刺(形近typo)'),
        ('生产尽度报告', 'QUERY', 'TASK_PROGRESS_QUERY|PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY|REPORT_PRODUCTION|N/A', '进→尽(形近typo)'),
        ('加工车问温度', 'QUERY', 'COLD_CHAIN_TEMPERATURE|EQUIPMENT_STATUS_QUERY|N/A', '间→问(形近typo)'),
    ]),
    'AI3': ('拼写错误-质检设备领域', [
        ('支检结果', 'QUERY', 'QUALITY_CHECK_QUERY|QUALITY_STATS|N/A', '质→支(声母同typo)'),
        ('设备故樟', 'QUERY', 'EQUIPMENT_STATUS_QUERY|ALERT_LIST|EQUIPMENT_ALERT_LIST|N/A', '障→樟(形近typo)'),
        ('质检报高', 'QUERY', 'QUALITY_CHECK_QUERY|REPORT_QUALITY|N/A', '告→高(同音typo)'),
        ('不河格批次', 'QUERY', 'QUALITY_CHECK_QUERY|QUALITY_STATS|N/A', '合→河(同音typo)'),
        ('设备运形状态', 'QUERY', 'EQUIPMENT_STATUS_QUERY|EQUIPMENT_LIST|N/A', '行→形(同音typo)'),
    ]),
    'AI4': ('拼写错误-发货订单HR', [
        ('发或记录', 'QUERY', 'SHIPMENT_QUERY|SHIPMENT_STATS|ORDER_LIST|N/A', '货→或(同音typo)'),
        ('订单逾其了', 'QUERY', 'ORDER_LIST|ORDER_TIMEOUT_MONITOR|N/A', '期→其(同音typo)'),
        ('考勤已常记录', 'QUERY', 'ATTENDANCE_ANOMALY|ATTENDANCE_STATS|ATTENDANCE_HISTORY|N/A', '异常→已常(同音typo)'),
        ('帮我打咔', 'WRITE', 'CLOCK_IN|CLOCK_OUT|N/A', '卡→咔(同音typo)'),
        ('排版表', 'QUERY', 'SCHEDULING_LIST|SCHEDULING_COVERAGE_QUERY|N/A', '班→版(同音typo)'),
    ]),
    'AI5': ('拼写错误-拼音首字母/缩写误用', [
        ('kc还有多少', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|N/A', 'kc=库存拼音首字母'),
        ('zj结果查一下', 'QUERY', 'QUALITY_CHECK_QUERY|QUALITY_STATS|N/A', 'zj=质检拼音'),
        ('pb情况', 'QUERY', 'SCHEDULING_LIST|SCHEDULING_COVERAGE_QUERY|N/A', 'pb=排班拼音'),
        ('sc批次列表', 'QUERY', 'PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY|N/A', 'sc=生产拼音'),
        ('sb运行正常吗', 'QUERY', 'EQUIPMENT_STATUS_QUERY|EQUIPMENT_LIST|N/A', 'sb=设备拼音(敏感词干扰)'),
    ]),

    # ====== AJ1-AJ3: Mixed Chinese-English (中英混合深度) ======
    'AJ1': ('中英混合-动词英文名词中文', [
        ('check一下inventory', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|N/A', 'check+inventory'),
        ('帮我看看order list', 'QUERY', 'ORDER_LIST|ORDER_STATUS|N/A', '中文+order list'),
        ('update一下shipping status', 'WRITE', 'SHIPMENT_STATUS_UPDATE|SHIPMENT_UPDATE|ORDER_UPDATE|N/A', 'update+shipping'),
        ('create一个new batch', 'WRITE', 'PROCESSING_BATCH_CREATE|MATERIAL_BATCH_CREATE|N/A', 'create+batch'),
        ('delete这个order', 'WRITE', 'ORDER_DELETE|ORDER_UPDATE|N/A', 'delete+order'),
        ('query一下attendance', 'QUERY', 'ATTENDANCE_HISTORY|ATTENDANCE_STATS|ATTENDANCE_TODAY|N/A', 'query+attendance'),
    ]),
    'AJ2': ('中英混合-行业术语嵌入', [
        ('帮我看看今天的KPI dashboard', 'QUERY', 'REPORT_KPI|REPORT_DASHBOARD_OVERVIEW|N/A', 'KPI dashboard'),
        ('supply chain status查一下', 'QUERY', 'REPORT_DASHBOARD_OVERVIEW|SHIPMENT_QUERY|ORDER_LIST|N/A', 'supply chain'),
        ('quality report拉一下', 'QUERY', 'QUALITY_CHECK_QUERY|REPORT_QUALITY|QUALITY_STATS|N/A', 'quality report'),
        ('equipment maintenance log', 'QUERY', 'EQUIPMENT_MAINTENANCE|EQUIPMENT_DETAIL|EQUIPMENT_LIST|N/A', 'equipment维护'),
        ('production line status怎么样', 'QUERY', 'PRODUCTION_STATUS_QUERY|EQUIPMENT_STATUS_QUERY|PROCESSING_BATCH_LIST|N/A', 'production line'),
    ]),
    'AJ3': ('中英混合-全英文业务查询', [
        ('show me the inventory', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|N/A', '全英-库存'),
        ('how many orders today', 'QUERY', 'ORDER_LIST|ORDER_TODAY|REPORT_DASHBOARD_OVERVIEW|N/A', '全英-今日订单'),
        ('equipment alert list', 'QUERY', 'EQUIPMENT_ALERT_LIST|ALERT_LIST|EQUIPMENT_STATUS_QUERY|N/A', '全英-设备告警'),
        ('clock in please', 'WRITE', 'CLOCK_IN|N/A', '全英-打卡'),
        ('create new production batch', 'WRITE', 'PROCESSING_BATCH_CREATE|N/A', '全英-创建批次'),
    ]),

    # ====== AK1-AK3: Emoji/Special Chars in Queries ======
    'AK1': ('表情符号-emoji嵌入查询意图', [
        ('\U0001f4e6库存查询', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|N/A', '📦+库存'),
        ('\u26a0\ufe0f告警处理', 'QUERY|WRITE', 'ALERT_LIST|ALERT_ACTIVE|ALERT_ACKNOWLEDGE|N/A', '⚠️+告警'),
        ('\U0001f4ca今天的报表', 'QUERY', 'REPORT_KPI|REPORT_DASHBOARD_OVERVIEW|REPORT_PRODUCTION|N/A', '📊+报表'),
        ('\U0001f525紧急发货', 'WRITE', 'SHIPMENT_CREATE|SHIPMENT_EXPEDITE|N/A', '🔥+紧急发货'),
        ('\u2705质检通过', 'WRITE', 'QUALITY_CHECK_EXECUTE|QUALITY_BATCH_MARK_AS_INSPECTED|N/A', '✅+质检通过'),
        ('\U0001f6a8设备故障', 'QUERY', 'EQUIPMENT_STATUS_QUERY|ALERT_LIST|EQUIPMENT_ALERT_LIST|N/A', '🚨+设备故障'),
    ]),
    'AK2': ('特殊字符-符号夹杂业务查询', [
        ('【紧急】查一下库存', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|N/A', '方括号+库存'),
        ('***设备状态***', 'QUERY', 'EQUIPMENT_STATUS_QUERY|EQUIPMENT_LIST|N/A', '星号+设备'),
        ('~~订单列表~~', 'QUERY', 'ORDER_LIST|ORDER_STATUS|N/A', '波浪号+订单'),
        ('>>查看质检报告<<', 'QUERY', 'QUALITY_CHECK_QUERY|REPORT_QUALITY|N/A', '箭头+质检'),
        ('=====财务报表=====', 'QUERY', 'REPORT_FINANCE|REPORT_KPI|N/A', '等号分隔+财务'),
    ]),
    'AK3': ('特殊字符-数学符号/括号/引号', [
        ('库存 > 100kg 的原料', 'QUERY', 'MATERIAL_BATCH_QUERY|MATERIAL_LOW_STOCK_ALERT|REPORT_INVENTORY|N/A', '大于号+条件'),
        ('"猪肉"库存查询', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|N/A', '引号+查询'),
        ('(今天的)生产批次', 'QUERY', 'PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY|N/A', '圆括号+生产'),
        ('订单#001状态？', 'QUERY', 'ORDER_STATUS|ORDER_LIST|BATCH_AUTO_LOOKUP|N/A', '#号+订单'),
        ('库存=？', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|N/A', '等号问号+库存'),
    ]),

    # ====== AL1-AL3: Very Long Queries with Noise Words (超长噪音) ======
    'AL1': ('超长查询-口语噪音填充50字以上', [
        ('嗯那个就是说啊我想问一下就是那个仓库里面的那个猪肉库存现在到底还有多少斤来着有人知道吗', 'QUERY',
         'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|QUERY_INVENTORY_QUANTITY|N/A', '70+字口语噪音-库存'),
        ('老板刚才打电话问我说让我赶紧查一下这周到目前为止所有的生产批次一共完成了多少我需要马上汇报', 'QUERY',
         'PROCESSING_BATCH_LIST|REPORT_PRODUCTION|PRODUCTION_STATUS_QUERY|N/A', '60+字口语噪音-生产'),
        ('你好我是新来的仓管员叫小李请问怎么在系统里面查看我负责的那几个冷库的温度有没有超标的情况', 'QUERY',
         'COLD_CHAIN_TEMPERATURE|EQUIPMENT_STATUS_QUERY|ALERT_LIST|N/A', '55+字自我介绍+查询'),
        ('不好意思打扰一下我想确认一个事情就是上周五下午那批从山东运过来的牛肉原料有没有做过质检', 'QUERY',
         'QUALITY_CHECK_QUERY|MATERIAL_BATCH_QUERY|N/A', '55+字礼貌前缀+质检'),
    ]),
    'AL2': ('超长查询-重复信息和修正', [
        ('查一下订单不对查库存不对不对是查质检对查质检结果最近的质检结果帮我查一下', 'QUERY',
         'QUALITY_CHECK_QUERY|QUALITY_STATS|ORDER_LIST|MATERIAL_BATCH_QUERY|N/A', '50+字反复修正-质检'),
        ('帮我看看那个什么来着就是那个嗯对就是设备设备状态对设备运行状态查一下看看有没有异常的', 'QUERY',
         'EQUIPMENT_STATUS_QUERY|ALERT_LIST|N/A', '50+字犹豫+设备'),
        ('我跟你说个事情啊上午来了一批货猪肉一共两千斤我需要录入入库系统你能帮我操作一下吗', 'WRITE',
         'MATERIAL_BATCH_CREATE|N/A', '55+字叙述+入库'),
    ]),
    'AL3': ('超长查询-多条件组合长句', [
        ('帮我看看本月库存低于安全线的所有原材料按类别分类统计一下每种缺了多少需要补多少还有预计什么时候能补齐', 'QUERY',
         'MATERIAL_LOW_STOCK_ALERT|MATERIAL_BATCH_QUERY|REPORT_INVENTORY|MRP_CALCULATION|N/A', '65+字多条件-库存'),
        ('从上个月一号到这个月十五号之间所有合格率低于百分之九十五的生产批次列一个清单按车间汇总一下', 'QUERY',
         'QUALITY_STATS|QUALITY_CHECK_QUERY|PROCESSING_BATCH_LIST|REPORT_QUALITY|N/A', '55+字条件+统计'),
        ('请帮我把今天所有已经完成质检但是还没有入库的批次找出来然后看看哪些可以安排发货给客户', 'QUERY',
         'QUALITY_CHECK_QUERY|MATERIAL_BATCH_QUERY|SHIPMENT_QUERY|ORDER_LIST|PROCESSING_BATCH_LIST|N/A', '50+字复合条件'),
    ]),

    # ====== AM1-AM3: Restaurant Domain Extended (餐饮扩展) ======
    'AM1': ('餐饮-写入操作', [
        ('添加一道新菜品红烧排骨', 'WRITE', 'RESTAURANT_DISH_CREATE|PRODUCT_UPDATE|MATERIAL_BATCH_CREATE|N/A', '新增菜品'),
        ('更新宫保鸡丁的价格为38元', 'WRITE', 'RESTAURANT_DISH_UPDATE|PRODUCT_UPDATE|ORDER_UPDATE|N/A', '更新菜品价格'),
        ('下架麻辣小龙虾这道菜', 'WRITE', 'RESTAURANT_DISH_DELETE|PRODUCT_UPDATE|MATERIAL_BATCH_DELETE|N/A', '下架菜品'),
        ('记录今天的食材损耗', 'WRITE', 'RESTAURANT_WASTAGE_RECORD|MATERIAL_BATCH_CONSUME|MATERIAL_ADJUST_QUANTITY|N/A', '记录损耗'),
        ('今天的食材采购单生成一下', 'WRITE', 'RESTAURANT_PROCUREMENT_CREATE|ORDER_NEW|ORDER_NEW|N/A', '生成采购单'),
    ]),
    'AM2': ('餐饮-后厨运营查询', [
        ('后厨现在有几个人在岗', 'QUERY', 'WORKER_IN_SHOP_REALTIME_COUNT|ATTENDANCE_TODAY|QUERY_ONLINE_STAFF_COUNT|N/A', '后厨人数'),
        ('哪个厨师今天产出最高', 'QUERY', 'REPORT_EFFICIENCY|ATTENDANCE_STATS|PRODUCTION_STATUS_QUERY|N/A', '厨师产出'),
        ('中午的翻台率是多少', 'QUERY', 'RESTAURANT_TABLE_TURNOVER|REPORT_KPI|REPORT_EFFICIENCY|N/A', '翻台率'),
        ('外卖订单占比多少', 'QUERY', 'RESTAURANT_ORDER_STATISTICS|ORDER_LIST|REPORT_KPI|N/A', '外卖占比'),
        ('哪个菜退单率最高', 'QUERY', 'RESTAURANT_RETURN_RATE|QUALITY_STATS|REPORT_KPI|PRODUCT_SALES_RANKING|N/A', '退单率'),
    ]),
    'AM3': ('餐饮-经营诊断分析', [
        ('这周跟上周营业额对比', 'QUERY', 'RESTAURANT_REVENUE_TREND|REPORT_TRENDS|REPORT_KPI|REPORT_PRODUCTION_WEEKLY_COMPARISON|N/A', '餐饮周对比'),
        ('人均消费是多少', 'QUERY', 'RESTAURANT_AVG_TICKET|REPORT_KPI|CUSTOMER_STATS|N/A', '人均消费'),
        ('哪些菜品的毛利率最高', 'QUERY', 'RESTAURANT_DISH_COST_ANALYSIS|RESTAURANT_MARGIN_ANALYSIS|REPORT_FINANCE|N/A', '菜品毛利排名'),
        ('本月食材成本占营业额比例', 'QUERY', 'RESTAURANT_INGREDIENT_COST_TREND|COST_TREND_ANALYSIS|REPORT_FINANCE|RESTAURANT_MARGIN_ANALYSIS|N/A', '食材成本率'),
        ('经营状况总览', 'QUERY', 'RESTAURANT_DAILY_REVENUE|REPORT_DASHBOARD_OVERVIEW|REPORT_KPI|N/A', '餐饮总览'),
    ]),

    # ====== AN1-AN3: Multi-Turn Context Simulation (多轮上下文) ======
    'AN1': ('多轮-接上条/继续查', [
        ('接上条', 'QUERY', 'CONTEXT_CONTINUE|REPORT_DASHBOARD_OVERVIEW|N/A', '极短接续-接上条'),
        ('刚才那个继续查', 'QUERY', 'CONTEXT_CONTINUE|REPORT_DASHBOARD_OVERVIEW|N/A', '接续-刚才继续'),
        ('上一个结果的详细信息', 'QUERY', 'CONTEXT_CONTINUE|QUERY_GENERIC_DETAIL|PROCESSING_BATCH_DETAIL|N/A', '接续-上一个详情'),
        ('把刚才的结果导出', 'WRITE', 'CONTEXT_CONTINUE|FORM_GENERATION|REPORT_DASHBOARD_OVERVIEW|N/A', '接续-导出结果'),
        ('按时间排个序', 'QUERY', 'CONTEXT_CONTINUE|REPORT_TRENDS|REPORT_DASHBOARD_OVERVIEW|N/A', '接续-排序'),
        ('筛选不合格的', 'QUERY', 'CONTEXT_CONTINUE|QUALITY_CHECK_QUERY|QUALITY_STATS|N/A', '接续-筛选条件'),
    ]),
    'AN2': ('多轮-维度切换追问', [
        ('换成按月看', 'QUERY', 'CONTEXT_CONTINUE|REPORT_TRENDS|REPORT_KPI|N/A', '切换-按月'),
        ('再看看按产品分的', 'QUERY', 'CONTEXT_CONTINUE|PRODUCT_TYPE_QUERY|PRODUCT_SALES_RANKING|N/A', '切换-按产品'),
        ('如果按车间拆分呢', 'QUERY', 'CONTEXT_CONTINUE|REPORT_PRODUCTION|ATTENDANCE_STATS_BY_DEPT|N/A', '切换-按车间'),
        ('同样的数据看去年的', 'QUERY', 'CONTEXT_CONTINUE|REPORT_TRENDS|REPORT_KPI|N/A', '切换-去年'),
        ('能不能按金额从大到小', 'QUERY', 'CONTEXT_CONTINUE|ORDER_LIST|REPORT_KPI|N/A', '切换-排序'),
    ]),
    'AN3': ('多轮-确认/否定/修正上文', [
        ('对就是这个再查详细一点', 'QUERY', 'CONTEXT_CONTINUE|QUERY_GENERIC_DETAIL|PROCESSING_BATCH_DETAIL|N/A', '确认+追查'),
        ('不是这个我要的是猪肉的不是牛肉的', 'QUERY', 'MATERIAL_BATCH_QUERY|CONTEXT_CONTINUE|N/A', '否定+修正品类'),
        ('没错就看这个批次的溯源', 'QUERY', 'TRACE_BATCH|TRACE_FULL|CONTEXT_CONTINUE|N/A', '确认+追溯'),
        ('不对我说的是上个月的', 'QUERY', 'CONTEXT_CONTINUE|REPORT_DASHBOARD_OVERVIEW|N/A', '否定+修正时间'),
        ('好的那帮我导出Excel', 'WRITE', 'CONTEXT_CONTINUE|FORM_GENERATION|REPORT_DASHBOARD_OVERVIEW|N/A', '确认+导出'),
    ]),
}


# =====================================================================
# OUTPUT: Print in mergeable format
# =====================================================================

def print_expansion():
    """Print the categories in a format ready to paste into intent-routing-e2e-150.py"""

    total_cases = sum(len(cases) for _, cases in expansion_categories.values())
    total_groups = len(expansion_categories)

    print("=" * 70)
    print(f"EXPANSION TEST CASES: {total_groups} groups, {total_cases} cases")
    print("=" * 70)

    # Coverage analysis
    print("\n# Coverage Gap Analysis:")
    print("# -------------------------------------------------------")
    print(f"# AI1-AI5: Typo/misspelling resilience .... {sum(len(c) for k,(n,c) in expansion_categories.items() if k.startswith('AI'))} cases")
    print(f"# AJ1-AJ3: Mixed Chinese-English .......... {sum(len(c) for k,(n,c) in expansion_categories.items() if k.startswith('AJ'))} cases")
    print(f"# AK1-AK3: Emoji/special chars ............ {sum(len(c) for k,(n,c) in expansion_categories.items() if k.startswith('AK'))} cases")
    print(f"# AL1-AL3: Very long queries (50+ chars) .. {sum(len(c) for k,(n,c) in expansion_categories.items() if k.startswith('AL'))} cases")
    print(f"# AM1-AM3: Restaurant domain extended ..... {sum(len(c) for k,(n,c) in expansion_categories.items() if k.startswith('AM'))} cases")
    print(f"# AN1-AN3: Multi-turn context simulation .. {sum(len(c) for k,(n,c) in expansion_categories.items() if k.startswith('AN'))} cases")
    print(f"# TOTAL: {total_cases} new cases across {total_groups} groups")
    print("# -------------------------------------------------------")
    print()

    # Existing coverage reminder
    print("# Existing similar coverage (for reference):")
    print("#   W1 (5 typo cases) - only basic single-char subs")
    print("#   W2 (4 CN-EN mix) - very basic, 2 query + 1 write + 1 report")
    print("#   AA7 (6 noise) - pure symbols/nonsense, no emoji+intent")
    print("#   J3/W5 (9 long) - max ~45 chars, not 50+")
    print("#   AC1-AC4 (24 restaurant) - all QUERY, no WRITE ops")
    print("#   Z1-Z2/AB7 (15 context) - single refs, no multi-turn chains")
    print()
    print("# NEW coverage fills these gaps with deeper, more diverse tests.")
    print()

    # Print the dict
    print("# ====== PASTE THIS INTO categories = {...} ======")
    print()

    for key in sorted(expansion_categories.keys()):
        cat_name, cases = expansion_categories[key]
        print(f"    '{key}': ('{cat_name}', [")
        for query, exp_type, exp_intents, desc in cases:
            # Escape single quotes in query string
            q = query.replace("'", "\\'")
            print(f"        ('{q}', '{exp_type}', '{exp_intents}', '{desc}'),")
        print(f"    ]),")
        print()

    # Summary table
    print()
    print("# ====== SUMMARY TABLE ======")
    print(f"# {'Group':<8} {'Name':<40} {'Cases':>5} {'Types'}")
    print(f"# {'-'*8} {'-'*40} {'-'*5} {'-'*30}")
    for key in sorted(expansion_categories.keys()):
        cat_name, cases = expansion_categories[key]
        types = set()
        for _, et, _, _ in cases:
            types.update(et.split('|'))
        print(f"# {key:<8} {cat_name:<40} {len(cases):>5} {', '.join(sorted(types))}")

    print(f"#")
    print(f"# GRAND TOTAL: {total_cases} new test cases in {total_groups} groups")


if __name__ == '__main__':
    import io, sys
    # Force UTF-8 output on Windows to avoid GBK encoding errors
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    print_expansion()
