#!/usr/bin/env python3
"""
Generate full training data v2 for 183-intent classifier.

Comprehensive augmentation strategy replacing simple prefix/suffix:
1. Domain synonym dictionary (50+ word groups) for Chinese food/manufacturing
2. Conversational templates (30+ patterns: command, query, existential, time, context, urgency, colloquial)
3. Category-specific natural language samples (10-20 per category)
4. Hard negatives for known confusion clusters
5. Typo/homophone simulation (10% chance)
6. negative_keywords cross-intent hard negatives from intents_export.jsonl
7. Minimum 100, maximum 150 samples per intent

Reads:  data/intents_export.jsonl
Writes: data/full_training_data.jsonl, data/label_mapping.json
"""

import json
import random
import re
from pathlib import Path
from collections import defaultdict

random.seed(42)

# ===========================================================================
# 1. DOMAIN SYNONYM DICTIONARY (50+ word groups)
# ===========================================================================
DOMAIN_SYNONYMS = {
    "设备": ["机器", "机台", "机组", "装备", "设备"],
    "告警": ["警报", "报警", "预警", "异常", "告警"],
    "原料": ["原材料", "材料", "物料", "进料", "原料"],
    "库存": ["存货", "存量", "储备", "库存"],
    "质检": ["质量检验", "品检", "品质检查", "QC", "质检"],
    "生产": ["加工", "制造", "制作", "生产"],
    "员工": ["工人", "工友", "人员", "职员", "员工"],
    "发货": ["出货", "发运", "交货", "配送", "发货"],
    "供应商": ["供货商", "厂商", "供应商"],
    "订单": ["单子", "工单", "订单"],
    "维修": ["维护", "保养", "检修", "修理", "维修"],
    "批次": ["批号", "LOT号", "批次"],
    "产线": ["生产线", "流水线", "车间线", "产线"],
    "报表": ["报告", "统计表", "汇总", "报表"],
    "采购": ["进货", "买入", "下单", "采购"],
    "不合格": ["不良", "NG", "次品", "缺陷", "不合格"],
    "打卡": ["签到", "考勤", "打卡"],
    "客户": ["顾客", "买家", "客户方", "客户"],
    "仓库": ["仓储", "库房", "库区", "仓库"],
    "排产": ["排程", "生产计划", "产能安排", "排产"],
    "入库": ["到货", "进仓", "收货", "入库"],
    "出库": ["出仓", "领料", "发料", "出库"],
    "合格率": ["良品率", "通过率", "达标率", "合格率"],
    "产量": ["产出", "产出量", "出货量", "产量"],
    "效率": ["效能", "效率", "产能", "稼动率"],
    "工序": ["工步", "工站", "制程", "工序"],
    "包装": ["封装", "打包", "装箱", "包装"],
    "温度": ["温控", "测温", "温度"],
    "冷链": ["冷藏", "冷冻", "低温运输", "冷链"],
    "溯源": ["追溯", "追踪", "回溯", "溯源"],
    "食品": ["食材", "食物", "原料", "食品"],
    "保质期": ["有效期", "赏味期", "shelf life", "保质期"],
    "配方": ["BOM", "配料表", "物料清单", "配方"],
    "车间": ["厂房", "生产区", "作业区", "车间"],
    "班次": ["班组", "轮班", "当班", "班次"],
    "盘点": ["盘库", "清点", "实物核对", "盘点"],
    "绩效": ["业绩", "考核", "绩效"],
    "工单": ["任务单", "作业单", "工单"],
    "调度": ["排程", "调配", "调度"],
    "物流": ["运输", "货运", "配送", "物流"],
    "收货": ["验收", "签收", "到货确认", "收货"],
    "审核": ["审批", "复核", "审查", "审核"],
    "安全": ["安防", "安全防护", "安全"],
    "检测": ["检验", "测试", "检查", "检测"],
    "标准": ["规范", "基准", "标准"],
    "异常": ["故障", "问题", "异常"],
    "记录": ["日志", "台账", "记录"],
    "计划": ["规划", "方案", "计划"],
    "统计": ["汇总", "数据分析", "统计"],
    "监控": ["监视", "监测", "实时跟踪", "监控"],
    "预警": ["提醒", "预报", "预警"],
    "成本": ["费用", "花销", "开支", "成本"],
}

# ===========================================================================
# 2. CONVERSATIONAL TEMPLATES (30+)
# ===========================================================================

# Command patterns
COMMAND_TEMPLATES = [
    "帮我{kw}",
    "请帮我{kw}一下",
    "麻烦你{kw}",
    "赶紧{kw}",
    "马上给我{kw}",
    "能不能帮我{kw}",
    "可不可以{kw}",
    "帮忙{kw}",
    "请{kw}",
    "我要{kw}",
]

# Query patterns
QUERY_TEMPLATES = [
    "{kw}怎么样了",
    "{kw}是什么情况",
    "{kw}现在怎么样",
    "{kw}有没有问题",
    "现在{kw}是多少",
    "{kw}搞定了没",
    "{kw}处理了吗",
    "为什么{kw}",
    "{kw}什么时候好",
    "{kw}到底怎么回事",
    "{kw}情况如何",
]

# Existential patterns
EXISTENTIAL_TEMPLATES = [
    "有没有{kw}",
    "有{kw}吗",
    "还有{kw}没有",
    "有多少{kw}",
    "是否有{kw}",
]

# Time-scoped patterns
TIME_TEMPLATES = [
    "今天的{kw}",
    "这周{kw}怎么样",
    "本月{kw}情况",
    "最近{kw}",
    "上个月{kw}",
    "今天{kw}了没",
    "这几天{kw}",
    "昨天的{kw}",
]

# Context-framed (factory-specific)
CONTEXT_TEMPLATES = [
    "老板要看{kw}",
    "客户在问{kw}",
    "交接班需要看{kw}",
    "月底盘点{kw}",
    "领导问{kw}",
    "审计要{kw}数据",
    "汇报用的{kw}",
    "开会要用{kw}",
]

# Urgency markers
URGENCY_TEMPLATES = [
    "赶紧给我看{kw}",
    "快点帮我{kw}",
    "马上{kw}",
    "立刻{kw}",
    "急着要{kw}",
    "抓紧{kw}",
    "加急{kw}",
]

# Colloquial variants
COLLOQUIAL_TEMPLATES = [
    "{kw}咋样了",
    "给我搞一下{kw}",
    "{kw}啥情况",
    "看看{kw}咋回事",
    "{kw}搞好了没",
    "{kw}弄好了没",
    "瞅瞅{kw}",
    "{kw}整完了吗",
]

ALL_TEMPLATES = (
    COMMAND_TEMPLATES
    + QUERY_TEMPLATES
    + EXISTENTIAL_TEMPLATES
    + TIME_TEMPLATES
    + CONTEXT_TEMPLATES
    + URGENCY_TEMPLATES
    + COLLOQUIAL_TEMPLATES
)

# ===========================================================================
# 3. CATEGORY-SPECIFIC NATURAL LANGUAGE SAMPLES
# ===========================================================================
CATEGORY_SAMPLES = {
    "EQUIPMENT": [
        "几号机还在跑没",
        "车间里哪台机器停了",
        "设备开机率怎么样",
        "哪些设备该保养了",
        "机器一直报警怎么回事",
        "设备运行都正常吗",
        "今天有设备坏了没",
        "机台效率怎么样",
        "哪台机器该检修了",
        "设备故障率高不高",
        "车间设备都开着呢吗",
        "那台老机器又出毛病了吧",
        "设备OEE多少",
        "几号线的设备状态怎么样",
        "设备巡检做了没",
    ],
    "MATERIAL": [
        "仓库里还有多少原料",
        "够不够下一批生产用",
        "快过期的有没有",
        "哪些原料需要补货",
        "低库存的物料",
        "原料到了没",
        "库存够用几天的",
        "面粉还剩多少",
        "这批料是哪个供应商的",
        "原料品质有问题吗",
        "仓库温度正常吗",
        "哪个原料用得最快",
        "原材料够不够这批订单用",
        "库房里啥快用完了",
        "进料检验做了没",
    ],
    "QUALITY": [
        "今天质检通过率多少",
        "这批货质检出来了没",
        "有没有不合格的",
        "上一批质检结果怎样",
        "合格率达标了吗",
        "不良品有多少",
        "品控问题出在哪",
        "这批货能过质检吗",
        "质量问题集中在哪个工序",
        "今天废品率高不高",
        "检验报告出了没",
        "这批质检不过怎么处理",
        "客户投诉的质量问题查清楚了没",
        "哪个产品线质量最好",
        "不合格品怎么处置",
    ],
    "ORDER": [
        "今天接了几单",
        "有没有新订单",
        "待发货的订单有几个",
        "客户的单子什么状态了",
        "最近订单多不多",
        "大客户的订单排到什么时候了",
        "这个订单什么时候能交",
        "有紧急订单吗",
        "订单进度更新一下",
        "今天的订单总金额多少",
        "哪些订单超期了",
        "积压的订单有多少",
        "退货的订单有几个",
        "订单完成率怎么样",
    ],
    "HR": [
        "今天谁没来",
        "工人到齐了没",
        "迟到的有几个",
        "新来的员工分到哪个车间了",
        "最近离职率高不高",
        "招人招得怎么样了",
        "员工培训安排了吗",
        "加班的人多不多",
        "谁的绩效最好",
        "工资算好了没",
        "哪个部门缺人",
        "人事档案更新了没",
    ],
    "ATTENDANCE": [
        "今天谁没来",
        "工人到齐了没",
        "迟到的有几个",
        "出勤率怎么样",
        "谁还没打卡",
        "考勤数据对得上吗",
        "旷工的有谁",
        "全勤的有几个人",
        "早退的人有没有",
        "夜班人到齐了吗",
        "今天请假的有几个",
        "上个月全勤奖给了谁",
    ],
    "CLOCK": [
        "帮我打个卡",
        "我到了",
        "下班了",
        "签到签到",
        "上班打卡",
        "我来了帮我签到",
        "到厂里了打个卡",
        "下班帮我签退",
        "今天我迟到了先打卡",
        "补一下昨天的卡",
        "我先撤了签退",
        "上工了",
    ],
    "REPORT": [
        "出个报表",
        "拉一份统计",
        "导出一下",
        "做个汇报用",
        "数据拉出来看看",
        "给我一份总结报告",
        "生成个报表",
        "统计数据导出",
        "做个月度总结",
        "数据报表发给我",
        "把这个数据做成图表",
        "生成一份分析报告",
        "帮我出个数据汇总",
        "周报数据拉一下",
    ],
    "PROCESSING": [
        "产线上跑的是什么",
        "今天计划生产多少",
        "排产排到几号了",
        "这批做到哪个工序了",
        "几号线在做什么产品",
        "产线效率怎么样",
        "这批什么时候能做完",
        "生产进度跟得上吗",
        "今天白班做了多少",
        "还有几批没开始做",
        "车间产量达标了吗",
        "投料量是多少",
        "生产计划有变动吗",
        "下一批做什么产品",
    ],
    "SHIPMENT": [
        "发货了没",
        "物流到哪了",
        "什么时候能到",
        "发货单改一下",
        "今天发出去多少货",
        "这批货发了吗",
        "客户催着要货呢",
        "物流信息查一下",
        "快递什么时候到",
        "出货单打印一下",
        "配送计划安排了吗",
        "今天的发货清单",
        "这批货发到哪了",
        "退货的物流跟踪一下",
    ],
    "ALERT": [
        "有什么告警",
        "新的报警处理了没",
        "哪些告警还没解决",
        "最近告警多不多",
        "机器报警了快看看",
        "车间有异常吗",
        "告警处理进度怎么样",
        "紧急告警有几个",
        "这个报警什么原因",
        "告警太多了分个优先级",
        "上一班遗留的告警处理了吗",
        "新发的告警是什么",
        "故障告警还在响",
    ],
    "PROCUREMENT": [
        "下个采购单",
        "采购进度怎么样",
        "这批采购什么时候到",
        "采购价格谈好了没",
        "需要采购什么",
        "采购申请批了没",
        "紧急采购一批原料",
        "采购成本能不能降一下",
        "上个月采购了多少",
        "采购计划有变动吗",
    ],
    "SUPPLIER": [
        "供应商名单",
        "评分最高的供应商",
        "到货及时率怎样",
        "这个供应商靠谱吗",
        "有没有新的供应商推荐",
        "供应商资质过期了没",
        "哪家供应商性价比最高",
        "供应商送货准时吗",
        "换个供应商怎么样",
        "供应商考核结果出了没",
    ],
    "CUSTOMER": [
        "客户反馈怎么样",
        "大客户最近下单了没",
        "新客户有几个",
        "客户投诉的问题处理了吗",
        "老客户续单了吗",
        "客户满意度调查做了没",
        "这个客户的信用怎么样",
        "客户欠款多不多",
        "VIP客户名单",
        "客户分类情况",
    ],
    "TRACE": [
        "这批货从哪来的",
        "溯源码扫一下",
        "追溯到原料来源了吗",
        "食品溯源报告出了没",
        "这个批次的全链路信息",
        "消费者扫码能查到什么",
        "溯源记录完整吗",
        "从原料到成品的追踪",
        "这个产品的溯源链",
        "出了问题能追溯到哪一步",
    ],
    "SCHEDULING": [
        "自动排产开了吗",
        "排产结果看一下",
        "产能安排合理吗",
        "调整一下排产计划",
        "排程冲突了怎么办",
        "手动排一下这批",
        "自动排产准不准",
        "排产优先级怎么定的",
    ],
    "USER": [
        "新建个账号",
        "这个用户权限不够",
        "帮他开通系统权限",
        "把这个账号禁了",
        "新员工入职开户",
        "密码重置一下",
        "修改用户角色",
        "这个人的账号还在吗",
    ],
    "COST": [
        "这个月花了多少钱",
        "成本超预算了吗",
        "哪个环节成本最高",
        "降本方案有效果吗",
        "材料成本涨了多少",
        "人工成本占比多少",
        "费用明细拉一下",
        "成本分析报告出了没",
    ],
    "FINANCE": [
        "财务数据看一下",
        "收支平衡了吗",
        "利润率多少",
        "现金流还够吗",
        "应收账款有多少",
        "财务报表出了没",
        "预算执行情况怎么样",
        "这个月盈利了吗",
    ],
    "PRODUCTION_STATUS": [
        "今天生产了多少",
        "产线进度怎样",
        "车间产量达标没",
        "当前在做什么产品",
        "生产数据汇总一下",
        "日产量是多少",
        "完成率多少了",
        "还差多少没完成",
    ],
    "SCALE": [
        "秤连上了没",
        "称重数据准不准",
        "电子秤校准了吗",
        "秤的读数不对",
        "地磅数据拉一下",
        "这个秤精度够吗",
        "秤列表看看",
        "新买的秤接入了没",
    ],
    "COLD_CHAIN": [
        "冷库温度正常吗",
        "运输途中温度有没有超标",
        "冷链监控数据看一下",
        "冷藏车温度多少",
        "温控报警了",
        "冷链断链了吗",
    ],
}

# ===========================================================================
# 4. HARD NEGATIVES FOR CONFUSION CLUSTERS
# ===========================================================================
# Format: { (intent_A, intent_B): [(sample, correct_label), ...] }
HARD_NEGATIVES = {
    # PROCESSING_BATCH_LIST vs MATERIAL_BATCH_QUERY
    ("PROCESSING_BATCH_LIST", "MATERIAL_BATCH_QUERY"): [
        ("生产批次有哪些", "PROCESSING_BATCH_LIST"),
        ("在做的批次列表", "PROCESSING_BATCH_LIST"),
        ("车间正在加工的批次", "PROCESSING_BATCH_LIST"),
        ("今天的生产任务有哪些", "PROCESSING_BATCH_LIST"),
        ("产线上跑的批次", "PROCESSING_BATCH_LIST"),
        ("原料批次有哪些", "MATERIAL_BATCH_QUERY"),
        ("仓库里的原料批次查一下", "MATERIAL_BATCH_QUERY"),
        ("材料库存批次", "MATERIAL_BATCH_QUERY"),
        ("物料的批次信息", "MATERIAL_BATCH_QUERY"),
        ("入库的原料批次号", "MATERIAL_BATCH_QUERY"),
    ],
    # CLOCK_IN vs ATTENDANCE_TODAY
    ("CLOCK_IN", "ATTENDANCE_TODAY"): [
        ("我到了帮我打卡", "CLOCK_IN"),
        ("签个到", "CLOCK_IN"),
        ("我来上班了打卡", "CLOCK_IN"),
        ("帮我签到一下", "CLOCK_IN"),
        ("打卡打卡我来了", "CLOCK_IN"),
        ("今天谁打卡了", "ATTENDANCE_TODAY"),
        ("出勤的人都有谁", "ATTENDANCE_TODAY"),
        ("今天到岗人数多少", "ATTENDANCE_TODAY"),
        ("今天工人都来了吗", "ATTENDANCE_TODAY"),
        ("今天打卡情况怎么样", "ATTENDANCE_TODAY"),
    ],
    # EQUIPMENT_STATUS_QUERY vs EQUIPMENT_MAINTENANCE
    ("EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE"): [
        ("设备现在运行正常吗", "EQUIPMENT_STATUS_QUERY"),
        ("机台状态怎么样", "EQUIPMENT_STATUS_QUERY"),
        ("机器运行情况查一下", "EQUIPMENT_STATUS_QUERY"),
        ("几号设备在线吗", "EQUIPMENT_STATUS_QUERY"),
        ("设备健康度怎么样", "EQUIPMENT_STATUS_QUERY"),
        ("设备该保养了", "EQUIPMENT_MAINTENANCE"),
        ("机器需要检修", "EQUIPMENT_MAINTENANCE"),
        ("安排设备维护", "EQUIPMENT_MAINTENANCE"),
        ("上次保养是什么时候", "EQUIPMENT_MAINTENANCE"),
        ("设备润滑做了没", "EQUIPMENT_MAINTENANCE"),
    ],
    # REPORT_PRODUCTION vs REPORT_QUALITY (domain noun before "报表")
    ("REPORT_PRODUCTION", "REPORT_QUALITY"): [
        ("生产报表拉一下", "REPORT_PRODUCTION"),
        ("今天的产量报告", "REPORT_PRODUCTION"),
        ("产出数据统计", "REPORT_PRODUCTION"),
        ("车间产量汇总", "REPORT_PRODUCTION"),
        ("各班次产量对比", "REPORT_PRODUCTION"),
        ("质量报表看一下", "REPORT_QUALITY"),
        ("合格率报告", "REPORT_QUALITY"),
        ("品质数据统计", "REPORT_QUALITY"),
        ("质检报表汇总", "REPORT_QUALITY"),
        ("废品率报告", "REPORT_QUALITY"),
    ],
    # REPORT_EFFICIENCY vs REPORT_INVENTORY
    ("REPORT_EFFICIENCY", "REPORT_INVENTORY"): [
        ("效率数据统计", "REPORT_EFFICIENCY"),
        ("产能利用率报表", "REPORT_EFFICIENCY"),
        ("设备效率分析", "REPORT_EFFICIENCY"),
        ("OEE数据拉一下", "REPORT_EFFICIENCY"),
        ("库存报表导出", "REPORT_INVENTORY"),
        ("仓储数据汇总", "REPORT_INVENTORY"),
        ("存货报告看一下", "REPORT_INVENTORY"),
        ("收发存数据统计", "REPORT_INVENTORY"),
    ],
    # ORDER_MODIFY vs ORDER_UPDATE (very similar)
    ("ORDER_MODIFY", "ORDER_UPDATE"): [
        ("我要改个订单", "ORDER_MODIFY"),
        ("订单内容需要修改", "ORDER_MODIFY"),
        ("这个订单改一下数量", "ORDER_MODIFY"),
        ("编辑一下订单信息", "ORDER_MODIFY"),
        ("更新订单状态", "ORDER_UPDATE"),
        ("订单进度更新一下", "ORDER_UPDATE"),
        ("刷新订单数据", "ORDER_UPDATE"),
        ("同步订单最新信息", "ORDER_UPDATE"),
    ],
    # ALERT_LIST vs ALERT_ACTIVE
    ("ALERT_LIST", "ALERT_ACTIVE"): [
        ("所有告警列表", "ALERT_LIST"),
        ("告警记录汇总", "ALERT_LIST"),
        ("历史告警都有哪些", "ALERT_LIST"),
        ("全部告警一览", "ALERT_LIST"),
        ("未处理的告警", "ALERT_ACTIVE"),
        ("正在发生的异常", "ALERT_ACTIVE"),
        ("活跃告警有几个", "ALERT_ACTIVE"),
        ("待处理的报警", "ALERT_ACTIVE"),
    ],
    # MATERIAL_EXPIRING_ALERT vs MATERIAL_EXPIRED_QUERY
    ("MATERIAL_EXPIRING_ALERT", "MATERIAL_EXPIRED_QUERY"): [
        ("快过期的原料有哪些", "MATERIAL_EXPIRING_ALERT"),
        ("临期物料预警", "MATERIAL_EXPIRING_ALERT"),
        ("保质期快到的材料", "MATERIAL_EXPIRING_ALERT"),
        ("即将到期的原料提醒", "MATERIAL_EXPIRING_ALERT"),
        ("已经过期的原料", "MATERIAL_EXPIRED_QUERY"),
        ("过了保质期的材料", "MATERIAL_EXPIRED_QUERY"),
        ("过期原料查一下", "MATERIAL_EXPIRED_QUERY"),
        ("有没有已经过期的物料", "MATERIAL_EXPIRED_QUERY"),
    ],
    # MATERIAL_LOW_STOCK_ALERT vs MATERIAL_BATCH_QUERY
    ("MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY"): [
        ("哪些原料快没了", "MATERIAL_LOW_STOCK_ALERT"),
        ("库存不足的物料", "MATERIAL_LOW_STOCK_ALERT"),
        ("需要补货的原料", "MATERIAL_LOW_STOCK_ALERT"),
        ("低库存预警", "MATERIAL_LOW_STOCK_ALERT"),
        ("查一下原料库存", "MATERIAL_BATCH_QUERY"),
        ("仓库里有什么原料", "MATERIAL_BATCH_QUERY"),
        ("原料清单看看", "MATERIAL_BATCH_QUERY"),
        ("物料信息查询", "MATERIAL_BATCH_QUERY"),
    ],
    # SHIPMENT_QUERY vs SHIPMENT_BY_DATE
    ("SHIPMENT_QUERY", "SHIPMENT_BY_DATE"): [
        ("查一下出货记录", "SHIPMENT_QUERY"),
        ("发货历史看看", "SHIPMENT_QUERY"),
        ("出货单列表", "SHIPMENT_QUERY"),
        ("全部发货记录", "SHIPMENT_QUERY"),
        ("今天发了多少货", "SHIPMENT_BY_DATE"),
        ("昨天的出货单", "SHIPMENT_BY_DATE"),
        ("本周发货情况", "SHIPMENT_BY_DATE"),
        ("上个月出货量", "SHIPMENT_BY_DATE"),
    ],
    # QUALITY_CHECK_EXECUTE vs QUALITY_STATS
    ("QUALITY_CHECK_EXECUTE", "QUALITY_STATS"): [
        ("执行这批货的质检", "QUALITY_CHECK_EXECUTE"),
        ("开始做质量检查", "QUALITY_CHECK_EXECUTE"),
        ("这批货要检一下", "QUALITY_CHECK_EXECUTE"),
        ("进行入库检验", "QUALITY_CHECK_EXECUTE"),
        ("今天合格率多少", "QUALITY_STATS"),
        ("质检通过率统计", "QUALITY_STATS"),
        ("品质数据分析", "QUALITY_STATS"),
        ("废品率多少", "QUALITY_STATS"),
    ],
    # PROCESSING_BATCH_CREATE vs PROCESSING_BATCH_START
    ("PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_START"): [
        ("建一个新的生产批次", "PROCESSING_BATCH_CREATE"),
        ("新增一个批次", "PROCESSING_BATCH_CREATE"),
        ("创建生产任务", "PROCESSING_BATCH_CREATE"),
        ("录入新批次信息", "PROCESSING_BATCH_CREATE"),
        ("这个批次可以开始了", "PROCESSING_BATCH_START"),
        ("启动生产", "PROCESSING_BATCH_START"),
        ("投产这个批次", "PROCESSING_BATCH_START"),
        ("开始加工", "PROCESSING_BATCH_START"),
    ],
}

# ===========================================================================
# 5. TYPO / HOMOPHONE SIMULATION
# ===========================================================================
COMMON_TYPOS = {
    "考勤": ["烤勤", "考琴"],
    "签到": ["签道", "前到"],
    "批次": ["皮次"],
    "设备": ["射备"],
    "质检": ["制检"],
    "库存": ["酷存"],
    "告警": ["搞警"],
    "维修": ["为修"],
    "订单": ["定单"],
    "统计": ["同计"],
    "报表": ["报标"],
    "打卡": ["大卡", "打咖"],
    "原料": ["原了", "圆料"],
    "生产": ["声产"],
    "发货": ["发祸"],
    "供应商": ["公应商"],
    "采购": ["才购"],
    "仓库": ["苍库"],
    "排产": ["牌产"],
    "保养": ["包养"],
    "溯源": ["诉源"],
    "绩效": ["记效"],
    "工序": ["工需"],
    "班次": ["版次"],
    "盘点": ["判点"],
    "审核": ["身核"],
    "监控": ["兼控"],
    "成本": ["乘本"],
    "财务": ["才务"],
}

TYPO_RATE = 0.10  # 10% chance of applying a typo

# ===========================================================================
# 5b. NEW INTENT CLASSES: OUT_OF_DOMAIN + CONTEXT_CONTINUE
# ===========================================================================

# OUT_OF_DOMAIN: ~150 samples for non-business inputs (noise, greetings, off-topic)
OUT_OF_DOMAIN_SAMPLES = [
    # --- Pure noise / symbols ---
    "？？？", "。。。", "666", "888", "233", "哈哈哈哈", "嗯嗯好的", "啊？",
    "呃呃呃", "嗯", "哦", "噢", "嘿嘿", "呵呵", "嘻嘻", "hiahia",
    "!!!!", "？！？！", "~", "...", "……", "😂", "👍",
    "ok", "OK", "好的", "行", "知道了", "收到", "了解",
    # --- Greetings ---
    "你好", "您好", "Hello", "Hi", "嗨", "你好呀", "早上好",
    "下午好", "晚上好", "老师好", "大家好", "嘿你好",
    # --- Identity questions ---
    "你是谁", "你叫什么", "你是什么系统", "你能干什么", "你是机器人吗",
    "你是AI吗", "你是人工智能吗", "你有名字吗",
    # --- Weather / off-topic ---
    "今天天气怎么样", "明天会下雨吗", "外面热不热", "气温多少度",
    # --- Gratitude / farewell ---
    "谢谢", "谢谢你", "多谢", "感谢", "辛苦了", "再见", "拜拜", "下次再聊",
    # --- Entertainment / non-business ---
    "讲个笑话", "说个故事", "唱首歌", "帮我写一封邮件", "帮我翻译一段话",
    "帮我写个PPT", "推荐一部电影", "今天股票怎么样", "帮我算个数学题",
    "世界杯结果怎样", "最近有什么新闻", "帮我订个外卖", "附近有什么好吃的",
    "帮我写一首诗", "给我讲个冷知识", "明天放假吗", "中午吃什么好",
    # --- Random gibberish ---
    "asdfghjkl", "qwerty", "啊啊啊啊", "哇哇哇", "嘤嘤嘤",
    "啦啦啦", "嗷嗷嗷", "哼哼哼", "额额额",
    # --- Confirmations without context ---
    "对", "不是", "是的", "没有", "不要", "算了", "可以", "随便",
    "看看再说", "先这样吧", "好吧", "无所谓", "你说呢",
    # --- Complaints without business intent ---
    "好烦", "累死了", "无聊", "不想干了", "烦死了", "头疼",
    "今天好忙", "加班好累", "太难了",
    # --- Hard negatives: similar to business but clearly off-topic ---
    "什么是ERP", "管理学怎么学", "供应链理论是什么",
    "什么叫精益生产", "质量管理体系有哪些", "ISO认证怎么办",
    "帮我百度一下", "搜索一下谷歌", "打开微信", "发个朋友圈",
    "帮我叫个车", "帮我设个闹钟", "提醒我下午开会",
    "公司地址在哪", "电话号码多少", "wifi密码是什么",
    "食堂几点开饭", "厕所在哪", "空调温度调一下",
    # --- More samples to reach ~150 ---
    "你好帮我看看", "你是AI助手吗", "你什么都能查吗",
    "系统怎么用", "功能有哪些", "使用说明在哪",
    "哈喽", "hey", "yo", "喂", "在吗", "人呢",
    "刚才说什么来着", "没事了", "搞定了", "不用了",
    "等一下", "稍等", "我想想", "让我考虑一下",
]

# CONTEXT_CONTINUE: ~120 samples for context-dependent follow-ups
CONTEXT_CONTINUE_SAMPLES = [
    # --- Ellipsis / same-as-before ---
    "同上", "继续", "跟刚才一样", "还是之前那个条件",
    "一样的，再查一遍", "重复一遍", "再来一次",
    "跟上次一样", "按之前的来", "老样子",
    "同样条件", "不变", "维持原来的", "还是那个",
    # --- Follow-up questions ---
    "那质检结果呢", "详细的呢", "换成上个月的",
    "按部门拆分看看", "这个呢", "那个呢",
    "那其他的呢", "还有呢", "然后呢", "接下来呢",
    "其余的呢", "另外的呢", "反过来呢",
    "下一个", "上一个", "第二页", "看更多",
    # --- Refinement requests ---
    "详细一点", "简单说一下", "具体点",
    "能不能再详细些", "太简略了", "展开说说",
    "总结一下", "精简一点", "核心数据就行",
    # --- Time shift ---
    "换成上个月的", "看本周的", "改成去年的",
    "看昨天的", "三月份的呢", "Q1的数据",
    "今年的呢", "对比上季度", "最近一周",
    # --- Scope shift ---
    "换个角度看看", "从另一个维度", "按区域看",
    "按产品线分", "分车间看看", "各班次对比",
    "换成饼图", "用柱状图", "导出Excel",
    # --- Repeat / redo ---
    "再说一遍", "没听清", "重复", "pardon",
    "再查一次", "重新查", "刷新一下",
    "更新数据", "同步一下", "拉取最新的",
    # --- Context references ---
    "就刚才那个", "前面那个", "上面提到的",
    "之前查的那个", "上次说的", "你刚才说的",
    "回到上一个", "返回之前的", "回退",
    # --- Continuation ---
    "继续说", "往下看", "后面还有吗",
    "还有没有了", "全部显示", "展示完整的",
    "完整版", "不要省略", "全量数据",
    # --- Confirmation to continue ---
    "好的继续", "对的继续查", "没错就这个",
    "是的帮我查", "可以继续", "对对对就是这个",
    "嗯查一下", "嗯看看", "嗯帮我弄一下",
    # --- Additional to reach 100+ ---
    "对，就是这个", "嗯对的", "没错",
    "同样的条件再查一次", "跟之前那次一样查",
    "按照上次的参数", "用同样的筛选条件",
    "之前那个再来一遍", "上一次的结果再看看",
    "换个维度看", "从另一个方面分析",
]

# Hard negatives for OUT_OF_DOMAIN: look like greetings but have business intent
OUT_OF_DOMAIN_HARD_NEGATIVES = [
    ("你好帮我查库存", "MATERIAL_BATCH_QUERY"),
    ("你好，看一下今天产量", "REPORT_PRODUCTION"),
    ("嗨，设备状态怎样", "EQUIPMENT_STATUS_QUERY"),
    ("hello查一下订单", "ORDER_LIST"),
    ("谢谢，再帮我看看质检", "QUALITY_CHECK_QUERY"),
    ("好的，那帮我查考勤", "ATTENDANCE_TODAY"),
    ("OK帮我打个卡", "CLOCK_IN"),
    ("嗯帮我看一下告警", "ALERT_LIST"),
    ("好的看一下发货情况", "SHIPMENT_QUERY"),
    ("嗨帮我查一下供应商", "SUPPLIER_LIST"),
    ("你好我要查生产报表", "REPORT_PRODUCTION"),
    ("hi看一下财务数据", "REPORT_FINANCE"),
]

# Hard negatives for CONTEXT_CONTINUE: look like context but have specific intent
CONTEXT_CONTINUE_HARD_NEGATIVES = [
    ("继续生产这批", "PROCESSING_BATCH_RESUME"),
    ("继续追踪这个批次", "TRACE_BATCH"),
    ("详细的质检报告", "QUALITY_CHECK_QUERY"),
    ("详细设备信息", "EQUIPMENT_DETAIL"),
    ("换成自动排产", "SCHEDULING_SET_AUTO"),
    ("更新订单状态", "ORDER_UPDATE"),
    ("刷新设备数据", "EQUIPMENT_STATUS_QUERY"),
    ("再查一下库存", "MATERIAL_BATCH_QUERY"),
    ("再来一批生产任务", "PROCESSING_BATCH_CREATE"),
    ("重新执行质检", "QUALITY_CHECK_EXECUTE"),
]

# ===========================================================================
# 5c. PATTERN-SPECIFIC AUGMENTATION SAMPLES (~640 total)
# Augment existing intents with dialect, rhetorical, double-negative, etc.
# ===========================================================================
PATTERN_AUGMENTATION = {
    # --- AA11: Dialect expressions (方言) → existing intents ---
    "DIALECT": [
        ("仓库里头还有好多货伐", "MATERIAL_BATCH_QUERY"),
        ("这批货搞得定不", "PROCESSING_BATCH_LIST"),
        ("机器歇菜了", "EQUIPMENT_STATUS_QUERY"),
        ("今个儿出了多少活", "REPORT_PRODUCTION"),
        ("物料齐活了没", "MATERIAL_BATCH_QUERY"),
        ("库存还有多少嘞", "MATERIAL_BATCH_QUERY"),
        ("设备咋就不转了咧", "EQUIPMENT_STATUS_QUERY"),
        ("这批货发出去了没得", "SHIPMENT_QUERY"),
        ("打卡了么得", "ATTENDANCE_TODAY"),
        ("质检过了没有嘛", "QUALITY_CHECK_QUERY"),
        ("原料用完了伐", "MATERIAL_BATCH_QUERY"),
        ("订单弄好了没咧", "ORDER_STATUS"),
        ("今天来了多少人嘞", "ATTENDANCE_TODAY"),
        ("产线上跑的啥子", "PROCESSING_BATCH_LIST"),
        ("供应商那边咋说的", "SUPPLIER_EVALUATE"),
        ("生产计划排好了没有嘛", "SCHEDULING_LIST"),
        ("告警咋这么多嘞", "ALERT_LIST"),
        ("采购单下了没得", "PROCUREMENT_LIST"),
        ("成本这个月高了没有嘛", "COST_QUERY"),
        ("考勤数据对得上不嘛", "ATTENDANCE_STATS"),
        ("客户那边催货了没得", "ORDER_LIST"),
        ("报表整出来了伐", "REPORT_PRODUCTION"),
        ("排班搞定了没咧", "SCHEDULING_LIST"),
        ("仓库温度高了没嘞", "COLD_CHAIN_TEMPERATURE"),
        ("物料到齐了伐", "MATERIAL_BATCH_QUERY"),
    ],
    # --- AB3: Rhetorical questions (反问句) ---
    "RHETORICAL": [
        ("难道猪肉库存真的没了？", "MATERIAL_BATCH_QUERY"),
        ("难道设备还没修好？", "EQUIPMENT_STATUS_QUERY"),
        ("这批货难道不用质检吗", "QUALITY_CHECK_QUERY"),
        ("还没发货难道订单都不要了", "ORDER_LIST"),
        ("连基本的产量都不达标吗", "REPORT_PRODUCTION"),
        ("难道没人来上班吗", "ATTENDANCE_TODAY"),
        ("这都不查一下吗", "MATERIAL_BATCH_QUERY"),
        ("告警都不处理的吗", "ALERT_LIST"),
        ("难道供应商还没送货？", "SUPPLIER_EVALUATE"),
        ("成本这么高都不管吗", "COST_QUERY"),
        ("质检合格率这么低不查吗", "QUALITY_STATS"),
        ("发货效率这么差吗", "SHIPMENT_STATS"),
        ("难道不用排产了？", "SCHEDULING_LIST"),
        ("采购单难道还没批？", "PROCUREMENT_LIST"),
        ("设备故障率难道不高吗", "EQUIPMENT_STATS"),
        ("库存不是应该够的吗", "MATERIAL_LOW_STOCK_ALERT"),
        ("这台设备难道不需要保养？", "EQUIPMENT_MAINTENANCE"),
        ("订单难道都完成了？", "ORDER_LIST"),
        ("难道今天没有生产任务？", "PROCESSING_BATCH_LIST"),
        ("考勤数据难道不准确吗", "ATTENDANCE_STATS"),
        ("这批原料不是已经过期了吗", "MATERIAL_EXPIRED_QUERY"),
        ("质检报告难道还没出？", "QUALITY_CHECK_QUERY"),
        ("排班不是已经排好了吗", "SCHEDULING_LIST"),
        ("客户投诉难道不处理吗", "CUSTOMER_LIST"),
        ("财务报表难道还没做？", "REPORT_FINANCE"),
    ],
    # --- AB4: Double negation (双重否定) ---
    "DOUBLE_NEGATION": [
        ("不能不查库存", "MATERIAL_BATCH_QUERY"),
        ("没有不需要质检的批次吧", "QUALITY_CHECK_QUERY"),
        ("不是不能打卡，我就是忘了", "CLOCK_IN"),
        ("这台设备不能不维护", "EQUIPMENT_MAINTENANCE"),
        ("订单不得不处理一下", "ORDER_LIST"),
        ("不得不看一下库存", "MATERIAL_BATCH_QUERY"),
        ("没有不可以查的数据吧", "REPORT_DASHBOARD_OVERVIEW"),
        ("产量不能不统计", "REPORT_PRODUCTION"),
        ("考勤不得不查一下", "ATTENDANCE_STATS"),
        ("设备状态不能不关注", "EQUIPMENT_STATUS_QUERY"),
        ("告警不能不处理", "ALERT_LIST"),
        ("不得不安排一下排班", "SCHEDULING_LIST"),
        ("供应商评分不能不看", "SUPPLIER_EVALUATE"),
        ("采购计划不得不调整", "PROCUREMENT_LIST"),
        ("发货时间不能不确认", "SHIPMENT_QUERY"),
        ("质检标准不能不遵守", "QUALITY_STATS"),
        ("成本分析不得不做", "COST_QUERY"),
        ("生产进度不能不跟踪", "PROCESSING_BATCH_LIST"),
        ("库存预警不能不重视", "MATERIAL_LOW_STOCK_ALERT"),
        ("财务数据不得不核实", "REPORT_FINANCE"),
        ("不是不查，是太忙了，现在查库存", "MATERIAL_BATCH_QUERY"),
        ("不能不承认设备确实有问题", "EQUIPMENT_STATUS_QUERY"),
        ("没有不重要的质检记录", "QUALITY_CHECK_QUERY"),
        ("不得不说今天产量不错", "REPORT_PRODUCTION"),
        ("不能不关注这个告警", "ALERT_ACTIVE"),
    ],
    # --- W2: Chinese-English mixed (中英混合) ---
    "MIXED_LANG": [
        ("check一下inventory", "MATERIAL_BATCH_QUERY"),
        ("帮我check库存", "MATERIAL_BATCH_QUERY"),
        ("production status怎么样", "PRODUCTION_STATUS_QUERY"),
        ("quality report看一下", "QUALITY_CHECK_QUERY"),
        ("order list拉一下", "ORDER_LIST"),
        ("equipment status查一下", "EQUIPMENT_STATUS_QUERY"),
        ("shipment tracking", "SHIPMENT_QUERY"),
        ("alert list有没有新的", "ALERT_LIST"),
        ("attendance data帮我看看", "ATTENDANCE_STATS"),
        ("schedule查一下", "SCHEDULING_LIST"),
        ("supplier list", "SUPPLIER_LIST"),
        ("cost analysis", "COST_QUERY"),
        ("stock不够了", "MATERIAL_LOW_STOCK_ALERT"),
        ("KPI dashboard", "REPORT_KPI"),
        ("maintenance schedule", "EQUIPMENT_MAINTENANCE"),
        ("production plan更新了没", "PROCESSING_BATCH_LIST"),
        ("delivery status查一下", "SHIPMENT_QUERY"),
        ("inventory report", "REPORT_INVENTORY"),
        ("quality check做了没", "QUALITY_CHECK_EXECUTE"),
        ("batch detail看一下", "PROCESSING_BATCH_DETAIL"),
    ],
    # --- Y2: Implicit intent (隐晦意图) ---
    "IMPLICIT": [
        ("快过期了怎么办", "MATERIAL_EXPIRING_ALERT"),
        ("原料不够了", "MATERIAL_LOW_STOCK_ALERT"),
        ("客户一直在催", "ORDER_LIST"),
        ("温度好像不对", "COLD_CHAIN_TEMPERATURE"),
        ("产量上不去", "REPORT_PRODUCTION"),
        ("机器好像有异响", "EQUIPMENT_STATUS_QUERY"),
        ("人手不够用", "ATTENDANCE_TODAY"),
        ("成本控制不住", "COST_QUERY"),
        ("合格率一直在降", "QUALITY_STATS"),
        ("发货效率太低了", "SHIPMENT_STATS"),
        ("库存积压严重", "MATERIAL_BATCH_QUERY"),
        ("排产总是排不开", "SCHEDULING_LIST"),
        ("供应商不太靠谱", "SUPPLIER_EVALUATE"),
        ("告警太频繁了", "ALERT_LIST"),
        ("生产跟不上订单", "PROCESSING_BATCH_LIST"),
        ("冷库好像出问题了", "COLD_CHAIN_TEMPERATURE"),
        ("这批货质量堪忧", "QUALITY_CHECK_QUERY"),
        ("设备老化严重", "EQUIPMENT_MAINTENANCE"),
        ("财务状况不太乐观", "REPORT_FINANCE"),
        ("员工流动性太大", "ATTENDANCE_STATS"),
        ("仓库快满了", "MATERIAL_BATCH_QUERY"),
        ("交货时间要延迟了", "SHIPMENT_QUERY"),
        ("采购成本涨了不少", "COST_QUERY"),
        ("这个月盈利不理想", "REPORT_FINANCE"),
        ("设备利用率不高", "EQUIPMENT_STATS"),
    ],
    # --- Z7: Range queries (范围查询) ---
    "RANGE_QUERY": [
        ("温度2到8度的冷库", "COLD_CHAIN_TEMPERATURE"),
        ("库存100到500公斤之间的", "MATERIAL_BATCH_QUERY"),
        ("合格率90%以上的产品", "QUALITY_STATS"),
        ("日产量在500到1000之间", "REPORT_PRODUCTION"),
        ("价格50到100元的原料", "MATERIAL_BATCH_QUERY"),
        ("本周一到周五的考勤", "ATTENDANCE_HISTORY"),
        ("订单金额1万到5万的", "ORDER_LIST"),
        ("设备运行时间超过8小时", "EQUIPMENT_STATS"),
        ("保质期还剩30天内的", "MATERIAL_EXPIRING_ALERT"),
        ("供应商评分80分以上", "SUPPLIER_RANKING"),
        ("产量低于目标80%的产线", "REPORT_PRODUCTION"),
        ("成本超过预算10%的项目", "COST_QUERY"),
        ("库存低于安全线的原料", "MATERIAL_LOW_STOCK_ALERT"),
        ("温度超标的冷藏车", "COLD_CHAIN_TEMPERATURE"),
        ("延迟3天以上的订单", "ORDER_LIST"),
        ("在途超过7天的发货", "SHIPMENT_QUERY"),
        ("频次高于3次的告警", "ALERT_LIST"),
        ("加班超过20小时的员工", "ATTENDANCE_STATS"),
        ("合格率低于85%的批次", "QUALITY_STATS"),
        ("利润率在5%到10%之间", "REPORT_FINANCE"),
        ("采购额10万以上的供应商", "SUPPLIER_LIST"),
        ("产能利用率50%以下的设备", "EQUIPMENT_STATS"),
        ("库龄超过90天的物料", "MATERIAL_EXPIRED_QUERY"),
        ("发货量最大的前5个客户", "SHIPMENT_BY_CUSTOMER"),
        ("温控范围-18到-25度", "COLD_CHAIN_TEMPERATURE"),
    ],
    # --- Z5: Negation redirect (否定重定向) → second clause intent ---
    "NEGATION_REDIRECT": [
        ("不是查库存，是查订单", "ORDER_LIST"),
        ("我不是要打卡，我是查考勤", "ATTENDANCE_HISTORY"),
        ("别给我看设备，我要看告警", "ALERT_LIST"),
        ("不看生产数据，看财务的", "REPORT_FINANCE"),
        ("不要创建，我只是想查一下", "PROCESSING_BATCH_LIST"),
        ("我说的不是供应商，是客户", "CUSTOMER_LIST"),
        ("不是质检，是质量统计", "QUALITY_STATS"),
        ("我不查库存，我查批次", "PROCESSING_BATCH_LIST"),
        ("不要报表，给我看明细", "PROCESSING_BATCH_DETAIL"),
        ("不是今天的，查上个月的", "REPORT_PRODUCTION"),
        ("不是设备告警，是质检问题", "QUALITY_CHECK_QUERY"),
        ("别查库存了，看看排产", "SCHEDULING_LIST"),
        ("不是出库，是入库记录", "MATERIAL_BATCH_QUERY"),
        ("我不要看KPI，我要看产量", "REPORT_PRODUCTION"),
        ("不是采购，我说的是销售", "ORDER_LIST"),
        ("不要质检报告，给我看产量报告", "REPORT_PRODUCTION"),
        ("不查设备了，看看考勤", "ATTENDANCE_TODAY"),
        ("不是这个供应商，换个供应商查", "SUPPLIER_SEARCH"),
        ("别看告警了，查一下发货", "SHIPMENT_QUERY"),
        ("不是这批货，查另一批", "PROCESSING_BATCH_LIST"),
        ("不是整体数据，分部门看", "ATTENDANCE_STATS_BY_DEPT"),
        ("别看月度的，给我看周报", "REPORT_PRODUCTION"),
        ("不要饼图，换成柱状图看", "REPORT_PRODUCTION"),
        ("不是查客户，是查供应商", "SUPPLIER_LIST"),
        ("不要自动排产，手动排", "SCHEDULING_SET_MANUAL"),
        ("不是当前批次，是历史批次", "PROCESSING_BATCH_LIST"),
        ("不看效率，看成本", "COST_QUERY"),
        ("不是设备状态，是维保记录", "EQUIPMENT_MAINTENANCE"),
        ("不要删除，我要修改", "ORDER_UPDATE"),
        ("不是按日期查，按客户查", "SHIPMENT_BY_CUSTOMER"),
    ],
    # --- AB1: Passive voice (被动句) ---
    "PASSIVE": [
        ("被退回的原材料有哪些", "MATERIAL_BATCH_QUERY"),
        ("被暂停的生产批次", "PROCESSING_BATCH_LIST"),
        ("被客户取消的订单", "ORDER_LIST"),
        ("被系统告警的设备", "ALERT_LIST"),
        ("被质检判为不合格的批次", "QUALITY_CHECK_QUERY"),
        ("被供应商延迟的采购订单", "PROCUREMENT_LIST"),
        ("被冻结的库存", "MATERIAL_BATCH_QUERY"),
        ("被标记为过期的原料", "MATERIAL_EXPIRED_QUERY"),
        ("被列入黑名单的供应商", "SUPPLIER_LIST"),
        ("被投诉的产品批次", "QUALITY_CHECK_QUERY"),
        ("被分配到A车间的工人", "PROCESSING_BATCH_WORKERS"),
        ("被安排加班的员工", "ATTENDANCE_STATS"),
        ("被退货的产品", "SHIPMENT_QUERY"),
        ("被调整过的排产计划", "SCHEDULING_LIST"),
        ("被暂停维修的设备", "EQUIPMENT_MAINTENANCE"),
        ("被标记为紧急的告警", "ALERT_ACTIVE"),
        ("被审批通过的采购单", "PROCUREMENT_LIST"),
        ("被安排了质检的批次", "QUALITY_CHECK_QUERY"),
        ("被扣了绩效的员工", "ATTENDANCE_STATS"),
        ("被降级的供应商", "SUPPLIER_EVALUATE"),
        ("被预留的原材料", "MATERIAL_BATCH_RESERVE"),
        ("被召回的产品批次", "QUALITY_CHECK_QUERY"),
        ("被取消的发货计划", "SHIPMENT_QUERY"),
        ("被修改过的订单", "ORDER_LIST"),
        ("被系统自动创建的批次", "PROCESSING_BATCH_LIST"),
        ("被预警的低库存物料", "MATERIAL_LOW_STOCK_ALERT"),
        ("被拒收的进货", "MATERIAL_BATCH_QUERY"),
        ("被锁定的账号", "USER_DISABLE"),
        ("被暂停的自动排产", "SCHEDULING_SET_DISABLED"),
        ("被标记异常的考勤记录", "ATTENDANCE_ANOMALY"),
    ],
    # --- AB2: Topic-comment structure (话题-述题) ---
    "TOPIC_COMMENT": [
        ("库存嘛，查一下", "MATERIAL_BATCH_QUERY"),
        ("订单的话，最近有多少", "ORDER_LIST"),
        ("质检这块，怎么样了", "QUALITY_CHECK_QUERY"),
        ("设备那边，有没有问题", "EQUIPMENT_STATUS_QUERY"),
        ("考勤嘛，帮我看看", "ATTENDANCE_HISTORY"),
        ("排班的话，明天安排好了没", "SCHEDULING_LIST"),
        ("生产那块，进度怎样了", "PROCESSING_BATCH_LIST"),
        ("告警这边，处理得怎么样", "ALERT_LIST"),
        ("发货嘛，催催", "SHIPMENT_QUERY"),
        ("供应商这块，评分怎么样", "SUPPLIER_EVALUATE"),
        ("成本方面，这个月超没超", "COST_QUERY"),
        ("原材料嘛，够不够用", "MATERIAL_BATCH_QUERY"),
        ("客户那边，有没有新的", "CUSTOMER_LIST"),
        ("财务嘛，月底了看看", "REPORT_FINANCE"),
        ("产量方面，达标了没", "REPORT_PRODUCTION"),
        ("采购这块，有没有新单", "PROCUREMENT_LIST"),
        ("冷链这边，温度正常吗", "COLD_CHAIN_TEMPERATURE"),
        ("溯源嘛，查查这批货", "TRACE_BATCH"),
        ("效率方面，提高了没", "REPORT_EFFICIENCY"),
        ("人事那块，新招了几个", "ATTENDANCE_STATS"),
        ("报表嘛，老板要看", "REPORT_DASHBOARD_OVERVIEW"),
        ("维修这块，安排了没", "EQUIPMENT_MAINTENANCE"),
        ("盘点嘛，做一下", "MATERIAL_BATCH_QUERY"),
        ("打卡嘛，帮我签一下", "CLOCK_IN"),
        ("质量方面，合格率怎样", "QUALITY_STATS"),
        ("物流嘛，到哪了", "SHIPMENT_QUERY"),
        ("排产的话，明天做什么", "SCHEDULING_LIST"),
        ("库房这边，满不满", "MATERIAL_BATCH_QUERY"),
        ("绩效嘛，这个月怎么算", "ATTENDANCE_STATS"),
        ("设备保养，该做了吧", "EQUIPMENT_MAINTENANCE"),
    ],
    # --- AB5: Sentence-final particles (句末语气词) ---
    "PARTICLES": [
        ("库存查一下嘛", "MATERIAL_BATCH_QUERY"),
        ("帮我打个卡啦", "CLOCK_IN"),
        ("发货呗，还等什么", "SHIPMENT_CREATE"),
        ("质检结果出来了咯", "QUALITY_CHECK_QUERY"),
        ("生产进度嘛，看看就行", "PROCESSING_BATCH_LIST"),
        ("告警处理掉算了", "ALERT_ACTIVE"),
        ("查个库存呗", "MATERIAL_BATCH_QUERY"),
        ("看看订单呗", "ORDER_LIST"),
        ("打个卡咯", "CLOCK_IN"),
        ("出个报表嘛", "REPORT_PRODUCTION"),
        ("查一下设备吧", "EQUIPMENT_STATUS_QUERY"),
        ("帮忙看看考勤啦", "ATTENDANCE_TODAY"),
        ("排产安排下呗", "SCHEDULING_LIST"),
        ("采购单下了呀", "PROCUREMENT_LIST"),
        ("温度看一下嘛", "COLD_CHAIN_TEMPERATURE"),
        ("告警帮忙处理啊", "ALERT_LIST"),
        ("供应商评估一下嘛", "SUPPLIER_EVALUATE"),
        ("发货赶紧安排呗", "SHIPMENT_CREATE"),
        ("成本算一下咯", "COST_QUERY"),
        ("质检做一下嘛", "QUALITY_CHECK_EXECUTE"),
        ("客户联系一下呗", "CUSTOMER_LIST"),
        ("绩效看看嘛", "ATTENDANCE_STATS"),
        ("报表拉一下呗", "REPORT_DASHBOARD_OVERVIEW"),
        ("批次信息查查嘛", "PROCESSING_BATCH_DETAIL"),
        ("维修安排下呗", "EQUIPMENT_MAINTENANCE"),
        ("签到一下嘛", "CLOCK_IN"),
        ("产量统计下呗", "REPORT_PRODUCTION"),
        ("财务看看啦", "REPORT_FINANCE"),
        ("物料够不够啊", "MATERIAL_BATCH_QUERY"),
        ("设备保养了没呀", "EQUIPMENT_MAINTENANCE"),
    ],
    # --- AB6: Causative constructions (使役/让字句) ---
    "CAUSATIVE": [
        ("让设备停下来", "EQUIPMENT_STOP"),
        ("叫张三去打卡", "CLOCK_IN"),
        ("让仓库备一批猪肉", "MATERIAL_BATCH_CREATE"),
        ("叫质检员去检一下那批货", "QUALITY_CHECK_EXECUTE"),
        ("让排班系统自动跑一下", "SCHEDULING_SET_AUTO"),
        ("让机器先停一下", "EQUIPMENT_STOP"),
        ("叫他们把货发了", "SHIPMENT_CREATE"),
        ("让采购部下单", "PROCUREMENT_LIST"),
        ("使设备恢复运行", "EQUIPMENT_START"),
        ("令生产暂停", "PROCESSING_BATCH_PAUSE"),
        ("让系统重新计算", "REPORT_PRODUCTION"),
        ("叫工人去车间", "PROCESSING_WORKER_ASSIGN"),
        ("让告警静音", "ALERT_ACTIVE"),
        ("叫他查一下库存", "MATERIAL_BATCH_QUERY"),
        ("让维修工去看看设备", "EQUIPMENT_MAINTENANCE"),
        ("使产线恢复", "PROCESSING_BATCH_RESUME"),
        ("让财务出个报表", "REPORT_FINANCE"),
        ("叫仓管清点一下", "MATERIAL_BATCH_QUERY"),
        ("让质检赶紧出结果", "QUALITY_CHECK_QUERY"),
        ("叫他们准备发货", "SHIPMENT_CREATE"),
        ("让供应商赶紧送货", "SUPPLIER_EVALUATE"),
        ("叫人来处理告警", "ALERT_LIST"),
        ("让系统自动排产", "SCHEDULING_SET_AUTO"),
        ("叫他去签到", "CLOCK_IN"),
        ("让老板看看报表", "REPORT_DASHBOARD_OVERVIEW"),
    ],
    # --- W1: Typos / phonetic errors (错别字) ---
    "TYPOS": [
        ("库纯有多少", "MATERIAL_BATCH_QUERY"),
        ("酷存查一下", "MATERIAL_BATCH_QUERY"),
        ("定单列表", "ORDER_LIST"),
        ("射备状态", "EQUIPMENT_STATUS_QUERY"),
        ("制检报告", "QUALITY_CHECK_QUERY"),
        ("考琴数据", "ATTENDANCE_STATS"),
        ("声产批次", "PROCESSING_BATCH_LIST"),
        ("才购订单", "PROCUREMENT_LIST"),
        ("同计数据", "REPORT_PRODUCTION"),
        ("报标拉一下", "REPORT_PRODUCTION"),
        ("签道了没", "CLOCK_IN"),
        ("大卡打了没", "CLOCK_IN"),
        ("发祸情况", "SHIPMENT_QUERY"),
        ("公应商列表", "SUPPLIER_LIST"),
        ("苍库温度", "COLD_CHAIN_TEMPERATURE"),
        ("牌产计划", "SCHEDULING_LIST"),
        ("包养设备", "EQUIPMENT_MAINTENANCE"),
        ("诉源信息", "TRACE_BATCH"),
        ("记效数据", "ATTENDANCE_STATS"),
        ("工需流程", "PROCESSING_BATCH_DETAIL"),
        ("版次安排", "SCHEDULING_LIST"),
        ("判点库存", "MATERIAL_BATCH_QUERY"),
        ("身核通过了没", "ORDER_UPDATE"),
        ("兼控数据", "EQUIPMENT_STATUS_QUERY"),
        ("乘本分析", "COST_QUERY"),
    ],
    # --- Z1: Pronoun / anaphora (代词回指) ---
    "PRONOUN": [
        ("上一个批次的详情", "PROCESSING_BATCH_DETAIL"),
        ("刚才那个订单发货了吗", "ORDER_STATUS"),
        ("再查一下那个供应商", "SUPPLIER_SEARCH"),
        ("还是那个批次，看看质检结果", "QUALITY_CHECK_QUERY"),
        ("同一个的出库记录呢", "MATERIAL_BATCH_QUERY"),
        ("那批货到了没", "SHIPMENT_QUERY"),
        ("这台设备什么型号", "EQUIPMENT_DETAIL"),
        ("上次的报表再拉一份", "REPORT_PRODUCTION"),
        ("那个告警处理了没", "ALERT_ACTIVE"),
        ("之前那个客户又来了", "CUSTOMER_SEARCH"),
        ("这个员工请假了吗", "ATTENDANCE_STATUS"),
        ("刚才说的那个成本数据", "COST_QUERY"),
        ("那条产线的效率", "REPORT_EFFICIENCY"),
        ("上次检测的那批原料", "QUALITY_CHECK_QUERY"),
        ("之前排的那个班", "SCHEDULING_LIST"),
        ("那个采购单审批了没", "PROCUREMENT_LIST"),
        ("这个月的财务数据", "REPORT_FINANCE"),
        ("刚才查的那个库存", "MATERIAL_BATCH_QUERY"),
        ("那个维修工单完成了吗", "EQUIPMENT_MAINTENANCE"),
        ("上一次发货的记录", "SHIPMENT_QUERY"),
        ("之前说的那个问题", "QUALITY_CHECK_QUERY"),
        ("那位供应商的评分", "SUPPLIER_EVALUATE"),
        ("这批原料的溯源", "TRACE_BATCH"),
        ("昨天查的那个数据", "REPORT_DASHBOARD_OVERVIEW"),
        ("刚才那个不合格品", "QUALITY_CRITICAL_ITEMS"),
    ],
    # --- Z3-Z4: Abbreviations / industry jargon (缩写/术语) ---
    "ABBREVIATIONS": [
        ("KPI看一下", "REPORT_KPI"),
        ("OA审批记录", "ORDER_LIST"),
        ("ERP里的库存数据", "MATERIAL_BATCH_QUERY"),
        ("SOP流程查询", "FOOD_KNOWLEDGE_QUERY"),
        ("QC报告拉一下", "QUALITY_CHECK_QUERY"),
        ("SKU库存明细", "MATERIAL_BATCH_QUERY"),
        ("WIP在制品数量", "PROCESSING_BATCH_LIST"),
        ("OEE设备综合效率", "EQUIPMENT_STATS"),
        ("BOM清单查询", "MATERIAL_BATCH_QUERY"),
        ("MOQ是多少", "SUPPLIER_EVALUATE"),
        ("FOB价格查询", "COST_QUERY"),
        ("FIFO先进先出", "MATERIAL_FIFO_RECOMMEND"),
        ("MRP物料需求计算", "MRP_CALCULATION"),
        ("CRM客户管理", "CUSTOMER_LIST"),
        ("IoT设备数据", "EQUIPMENT_STATUS_QUERY"),
        ("AGV运行状态", "EQUIPMENT_STATUS_QUERY"),
        ("PLC控制器", "EQUIPMENT_DETAIL"),
        ("HACCP检查", "QUALITY_CHECK_QUERY"),
        ("GMP标准", "FOOD_KNOWLEDGE_QUERY"),
        ("SCM数据", "REPORT_DASHBOARD_OVERVIEW"),
        ("EHS安全记录", "FOOD_KNOWLEDGE_QUERY"),
        ("PDCA循环", "QUALITY_STATS"),
        ("SPC控制图", "QUALITY_STATS"),
        ("TPM设备管理", "EQUIPMENT_MAINTENANCE"),
        ("DOE实验设计", "QUALITY_CHECK_QUERY"),
        ("RMA退货处理", "SHIPMENT_QUERY"),
        ("VMI供应商库存", "SUPPLIER_LIST"),
        ("JIT准时制", "SCHEDULING_LIST"),
        ("TQM全面质量", "QUALITY_STATS"),
        ("AQL抽检标准", "QUALITY_CHECK_EXECUTE"),
    ],
    # --- AA9: Hypothetical / conditional (假设条件) ---
    "HYPOTHETICAL": [
        ("如果明天产量翻倍需要多少原料", "MATERIAL_BATCH_QUERY"),
        ("万一冷库断电怎么办", "FOOD_KNOWLEDGE_QUERY"),
        ("假如供应商延迟交货影响大吗", "SUPPLIER_EVALUATE"),
        ("要是质检不通过这批货怎么处理", "FOOD_KNOWLEDGE_QUERY"),
        ("如果新增一条产线需要多少人", "SCHEDULING_LIST"),
        ("假如停电了设备怎么保护", "FOOD_KNOWLEDGE_QUERY"),
        ("万一原料不够怎么调配", "MATERIAL_LOW_STOCK_ALERT"),
        ("如果客户退货怎么处理", "FOOD_KNOWLEDGE_QUERY"),
        ("要是设备故障率升高怎么办", "FOOD_KNOWLEDGE_QUERY"),
        ("假设产能提升50%需要什么", "FOOD_KNOWLEDGE_QUERY"),
        ("如果温度超标食品还能用吗", "FOOD_KNOWLEDGE_QUERY"),
        ("万一原料被污染了怎么处理", "FOOD_KNOWLEDGE_QUERY"),
        ("假如订单量翻倍能接吗", "SCHEDULING_LIST"),
        ("如果质检标准提高影响产量吗", "FOOD_KNOWLEDGE_QUERY"),
        ("要是仓库满了怎么办", "FOOD_KNOWLEDGE_QUERY"),
        ("假设增加一个班次怎么排", "SCHEDULING_LIST"),
        ("如果供应商涨价怎么应对", "FOOD_KNOWLEDGE_QUERY"),
        ("万一系统崩溃数据丢失怎么办", "FOOD_KNOWLEDGE_QUERY"),
        ("假如员工大量请假怎么排班", "SCHEDULING_LIST"),
        ("如果冷链中断超过2小时", "FOOD_KNOWLEDGE_QUERY"),
        ("要是发现食品安全问题", "FOOD_KNOWLEDGE_QUERY"),
        ("假设原材料涨价30%", "COST_QUERY"),
        ("如果设备突然停机", "FOOD_KNOWLEDGE_QUERY"),
        ("万一批次混淆了怎么追溯", "FOOD_KNOWLEDGE_QUERY"),
        ("要是审核不通过怎么改", "FOOD_KNOWLEDGE_QUERY"),
    ],
    # --- AB15: Comparative / superlative (比较级) ---
    "COMPARATIVE": [
        ("产量最高的产线", "REPORT_PRODUCTION"),
        ("合格率最好的车间", "QUALITY_STATS"),
        ("库存最多的原料", "MATERIAL_BATCH_QUERY"),
        ("订单金额最大的客户", "CUSTOMER_STATS"),
        ("最近一周产量最高的是哪天", "REPORT_PRODUCTION"),
        ("效率最高的设备", "EQUIPMENT_STATS"),
        ("评分最高的供应商", "SUPPLIER_RANKING"),
        ("出勤率最低的部门", "ATTENDANCE_STATS_BY_DEPT"),
        ("不合格率最高的产品", "QUALITY_STATS"),
        ("发货最多的是哪个客户", "SHIPMENT_BY_CUSTOMER"),
        ("成本最高的环节", "COST_QUERY"),
        ("用量最大的原料", "MATERIAL_BATCH_QUERY"),
        ("告警最多的设备", "ALERT_BY_EQUIPMENT"),
        ("最近哪天产量最低", "REPORT_PRODUCTION"),
        ("哪个供应商价格最低", "SUPPLIER_RANKING"),
        ("产能利用率最高的是哪条线", "REPORT_EFFICIENCY"),
        ("废品率最高的工序", "QUALITY_STATS"),
        ("配送最快的物流", "SHIPMENT_STATS"),
        ("绩效最好的员工", "ATTENDANCE_STATS"),
        ("库龄最长的物料", "MATERIAL_EXPIRED_QUERY"),
        ("哪个月的销售额最高", "REPORT_KPI"),
        ("最大的客户是谁", "CUSTOMER_STATS"),
        ("产量比上个月高了多少", "REPORT_PRODUCTION"),
        ("今天的产量比昨天多吗", "REPORT_PRODUCTION"),
        ("这个月比上个月好吗", "REPORT_KPI"),
        ("哪条线的效率更高", "REPORT_EFFICIENCY"),
        ("哪个供应商更靠谱", "SUPPLIER_EVALUATE"),
        ("质检合格率有没有提高", "QUALITY_STATS"),
        ("成本比预算高还是低", "COST_QUERY"),
        ("库存周转率最高的", "REPORT_INVENTORY"),
    ],
    # --- AA12: Verb-noun domain collision (动名词冲突) ---
    "VERB_NOUN_COLLISION": [
        ("检测设备是否在线", "EQUIPMENT_STATUS_QUERY"),
        ("生产检测报告", "QUALITY_CHECK_QUERY"),
        ("采购部门的考勤", "ATTENDANCE_STATS_BY_DEPT"),
        ("设备维修订单", "EQUIPMENT_MAINTENANCE"),
        ("加工标准查询", "FOOD_KNOWLEDGE_QUERY"),
        ("出库检验记录", "QUALITY_CHECK_QUERY"),
        ("创建时间查询", "PROCESSING_BATCH_LIST"),
        ("发货检验报告", "QUALITY_CHECK_QUERY"),
        ("生产安全标准", "FOOD_KNOWLEDGE_QUERY"),
        ("质检生产线", "EQUIPMENT_STATUS_QUERY"),
        ("采购入库记录", "MATERIAL_BATCH_QUERY"),
        ("订单生产进度", "PROCESSING_BATCH_LIST"),
        ("维修采购清单", "PROCUREMENT_LIST"),
        ("包装质检标准", "FOOD_KNOWLEDGE_QUERY"),
        ("物流配送计划", "SHIPMENT_QUERY"),
        ("仓储管理报表", "REPORT_INVENTORY"),
        ("设备采购成本", "COST_QUERY"),
        ("生产线排产", "SCHEDULING_LIST"),
        ("质检审核流程", "QUALITY_CHECK_QUERY"),
        ("供应商采购记录", "PROCUREMENT_LIST"),
        ("客户订单统计", "ORDER_LIST"),
        ("设备运行报告", "EQUIPMENT_STATS"),
        ("人工成本统计", "COST_QUERY"),
        ("原料入库检测", "QUALITY_CHECK_EXECUTE"),
        ("成品出库记录", "SHIPMENT_QUERY"),
        ("维修保养计划", "EQUIPMENT_MAINTENANCE"),
        ("生产批次追溯", "TRACE_BATCH"),
        ("采购审批状态", "PROCUREMENT_LIST"),
        ("设备巡检记录", "EQUIPMENT_MAINTENANCE"),
        ("仓库盘点记录", "MATERIAL_BATCH_QUERY"),
    ],
}

# ===========================================================================
# Test/placeholder intents to exclude
# ===========================================================================
EXCLUDE_PATTERNS = [
    r'^E2E_',
    r'^TEST_',
    r'^FACTORY_TEST_',
    r'^PLATFORM_SHARED_',
]


def should_exclude(intent_code: str) -> bool:
    return any(re.match(p, intent_code) for p in EXCLUDE_PATTERNS)


# ===========================================================================
# HELPER FUNCTIONS
# ===========================================================================

def get_category_prefix(intent_code: str) -> str:
    """Extract the category prefix from an intent code.
    E.g., 'EQUIPMENT_STATUS_QUERY' -> 'EQUIPMENT'
          'MATERIAL_BATCH_QUERY' -> 'MATERIAL'
          'CLOCK_IN' -> 'CLOCK'
    """
    parts = intent_code.split("_")
    if len(parts) >= 2:
        return parts[0]
    return intent_code


def apply_synonym_replacement(text: str) -> str:
    """Replace domain terms with random synonyms."""
    result = text
    for term, synonyms in DOMAIN_SYNONYMS.items():
        if term in result:
            replacement = random.choice(synonyms)
            if replacement != term:
                result = result.replace(term, replacement, 1)
                break  # One replacement per call to keep it natural
    return result


def apply_typo(text: str) -> str:
    """Apply a random typo if probability hits."""
    if random.random() > TYPO_RATE:
        return text
    for term, typos in COMMON_TYPOS.items():
        if term in text:
            return text.replace(term, random.choice(typos), 1)
    return text


def apply_template(keyword: str) -> str:
    """Apply a random conversational template to a keyword."""
    template = random.choice(ALL_TEMPLATES)
    return template.format(kw=keyword)


def augment_keyword_v2(keyword: str) -> list[str]:
    """Generate augmented samples from a single keyword using v2 strategy."""
    samples = set()
    samples.add(keyword)

    # Skip heavy augmentation for very long phrases (already sentence-like)
    if len(keyword) > 20:
        samples.add(f"帮我{keyword}")
        samples.add(f"{keyword}吧")
        # Synonym variant
        syn = apply_synonym_replacement(keyword)
        if syn != keyword:
            samples.add(syn)
        return list(samples)

    # Template-based augmentation: pick 4-6 random templates
    n_templates = random.randint(4, 6)
    chosen_templates = random.sample(ALL_TEMPLATES, min(n_templates, len(ALL_TEMPLATES)))
    for tmpl in chosen_templates:
        samples.add(tmpl.format(kw=keyword))

    # Synonym replacement variants (2-3)
    for _ in range(random.randint(2, 3)):
        syn = apply_synonym_replacement(keyword)
        if syn != keyword:
            samples.add(syn)
            # Also apply a template to the synonym variant
            tmpl = random.choice(ALL_TEMPLATES)
            samples.add(tmpl.format(kw=syn))

    # Typo variant (10% chance per keyword)
    typo = apply_typo(keyword)
    if typo != keyword:
        samples.add(typo)

    return list(samples)


def build_negative_keyword_map(intents: list[dict]) -> dict[str, list[str]]:
    """Build a mapping: keyword -> list of intent_codes that own it.
    Used for cross-intent hard negatives via negative_keywords.
    """
    kw_to_intents = defaultdict(list)
    for intent in intents:
        code = intent['intent_code']
        for kw in intent.get('keywords', []):
            if isinstance(kw, str) and kw.strip():
                kw_to_intents[kw.strip()].append(code)
    return kw_to_intents


def generate_cross_intent_negatives(intents: list[dict], kw_to_intents: dict) -> list[dict]:
    """Use negative_keywords to generate hard negatives.

    For each intent, its negative_keywords are words that should NOT trigger
    this intent. We find which other intent "owns" each negative keyword
    and generate samples attributed to the owning intent.
    """
    samples = []
    for intent in intents:
        code = intent['intent_code']
        neg_kws = intent.get('negative_keywords', [])
        if not neg_kws:
            continue

        for neg_kw in neg_kws:
            if not isinstance(neg_kw, str) or not neg_kw.strip():
                continue
            neg_kw = neg_kw.strip()

            # Find which intent owns this negative keyword
            owners = kw_to_intents.get(neg_kw, [])
            for owner in owners:
                if owner != code:
                    # This keyword belongs to `owner`, not `code`
                    # Generate a sample labeled as `owner`
                    samples.append({"text": neg_kw, "label": owner})
                    # Also generate a template variant
                    tmpl_text = apply_template(neg_kw)
                    samples.append({"text": tmpl_text, "label": owner})
                    break  # one owner is enough

    return samples


def generate_training_data():
    data_dir = Path(__file__).parent / "data"
    input_path = data_dir / "intents_export.jsonl"
    output_path = data_dir / "full_training_data.jsonl"
    label_mapping_path = data_dir / "label_mapping.json"

    intents = []
    with open(input_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            intents.append(json.loads(line))

    print(f"Loaded {len(intents)} intents from {input_path}")

    # Filter out test intents
    intents = [i for i in intents if not should_exclude(i['intent_code'])]
    print(f"After filtering test/placeholder: {len(intents)} intents")

    # --- Inject synthetic intents for new classes ---
    NEW_SYNTHETIC_INTENTS = [
        {"intent_code": "OUT_OF_DOMAIN", "intent_name": "域外无关输入", "keywords": [], "negative_keywords": []},
        {"intent_code": "CONTEXT_CONTINUE", "intent_name": "上下文继续", "keywords": [], "negative_keywords": []},
    ]
    for syn_intent in NEW_SYNTHETIC_INTENTS:
        if not any(i['intent_code'] == syn_intent['intent_code'] for i in intents):
            intents.append(syn_intent)
            print(f"  + Added synthetic intent: {syn_intent['intent_code']}")

    # Build label mapping (sorted for determinism)
    label_to_id = {}
    for i, intent in enumerate(sorted(intents, key=lambda x: x['intent_code'])):
        label_to_id[intent['intent_code']] = i

    label_mapping = {
        "label_to_id": label_to_id,
        "id_to_label": {str(v): k for k, v in label_to_id.items()},
        "intent_names": {
            intent['intent_code']: intent['intent_name']
            for intent in intents
        },
        "num_labels": len(label_to_id),
    }

    # Build keyword ownership map for cross-intent negatives
    kw_to_intents = build_negative_keyword_map(intents)

    # Generate cross-intent hard negatives from negative_keywords
    cross_negatives = generate_cross_intent_negatives(intents, kw_to_intents)
    cross_neg_by_label = defaultdict(list)
    for s in cross_negatives:
        cross_neg_by_label[s['label']].append(s['text'])

    # Collect hard negatives from confusion clusters
    hard_neg_by_label = defaultdict(list)
    for pair, pairs_samples in HARD_NEGATIVES.items():
        for text, label in pairs_samples:
            hard_neg_by_label[label].append(text)

    # -----------------------------------------------------------------------
    # Main generation loop
    # -----------------------------------------------------------------------
    MIN_SAMPLES = 100
    MAX_SAMPLES = 150

    all_samples = []
    stats = {"total": 0, "per_intent": {}, "by_category": defaultdict(int)}

    # --- Pre-collect pattern augmentation samples by target intent ---
    pattern_aug_by_label = defaultdict(list)
    for pattern_name, pairs in PATTERN_AUGMENTATION.items():
        for text, label in pairs:
            pattern_aug_by_label[label].append(text)

    for intent in intents:
        code = intent['intent_code']
        name = intent['intent_name']
        keywords = intent.get('keywords', [])
        category = get_category_prefix(code)

        intent_samples = set()

        # --- NEW: Handle OUT_OF_DOMAIN ---
        if code == "OUT_OF_DOMAIN":
            intent_samples.update(OUT_OF_DOMAIN_SAMPLES)
            # Add hard negatives for other intents (these are NOT OUT_OF_DOMAIN)
            # The OUT_OF_DOMAIN samples are already set above
            count = len(intent_samples)
            intent_samples_list = list(intent_samples)
            for sample_text in intent_samples_list:
                all_samples.append({"text": sample_text, "label": code})
            # Also add hard negatives to their correct intents
            for text, label in OUT_OF_DOMAIN_HARD_NEGATIVES:
                all_samples.append({"text": text, "label": label})
            stats["per_intent"][code] = count
            stats["total"] += count
            stats["by_category"]["OUT"] += count
            continue

        # --- NEW: Handle CONTEXT_CONTINUE ---
        if code == "CONTEXT_CONTINUE":
            intent_samples.update(CONTEXT_CONTINUE_SAMPLES)
            count = len(intent_samples)
            intent_samples_list = list(intent_samples)
            for sample_text in intent_samples_list:
                all_samples.append({"text": sample_text, "label": code})
            # Also add hard negatives to their correct intents
            for text, label in CONTEXT_CONTINUE_HARD_NEGATIVES:
                all_samples.append({"text": text, "label": label})
            stats["per_intent"][code] = count
            stats["total"] += count
            stats["by_category"]["CONTEXT"] += count
            continue

        # --- A. Keyword-based augmentation ---
        for kw in keywords:
            if isinstance(kw, str) and len(kw.strip()) > 0:
                augmented = augment_keyword_v2(kw.strip())
                intent_samples.update(augmented)

        # --- B. Intent name as sample ---
        if name:
            intent_samples.add(name)
            intent_samples.add(f"查看{name}")
            intent_samples.add(f"帮我{name}")
            intent_samples.add(f"我要{name}")
            intent_samples.add(f"{name}一下")

        # --- C. Category-specific natural language samples ---
        cat_samples = CATEGORY_SAMPLES.get(category, [])
        if cat_samples:
            n_cat = min(len(cat_samples), random.randint(5, 10))
            chosen_cat = random.sample(cat_samples, n_cat)
            intent_samples.update(chosen_cat)

        # --- D. Hard negatives from confusion clusters ---
        if code in hard_neg_by_label:
            intent_samples.update(hard_neg_by_label[code])

        # --- E. Cross-intent negatives (from negative_keywords) ---
        if code in cross_neg_by_label:
            for neg_text in cross_neg_by_label[code][:10]:
                intent_samples.add(neg_text)

        # --- E2. Pattern augmentation samples (dialect, rhetorical, etc.) ---
        if code in pattern_aug_by_label:
            intent_samples.update(pattern_aug_by_label[code])

        # --- F. Additional synonym + template combos to reach minimum ---
        # Generate more samples if we are below minimum
        attempts = 0
        base_kws = [kw.strip() for kw in keywords if isinstance(kw, str) and kw.strip()]
        while len(intent_samples) < MIN_SAMPLES and attempts < 500:
            attempts += 1
            if base_kws:
                kw = random.choice(base_kws)
                # Random strategy
                strategy = random.randint(0, 5)
                if strategy == 0:
                    # Template
                    text = apply_template(kw)
                elif strategy == 1:
                    # Synonym + template
                    syn = apply_synonym_replacement(kw)
                    text = apply_template(syn)
                elif strategy == 2:
                    # Typo variant
                    text = apply_typo(kw)
                    if text == kw:
                        text = apply_template(kw)
                elif strategy == 3:
                    # Combined: time + synonym
                    syn = apply_synonym_replacement(kw)
                    tmpl = random.choice(TIME_TEMPLATES)
                    text = tmpl.format(kw=syn)
                elif strategy == 4:
                    # Context template
                    tmpl = random.choice(CONTEXT_TEMPLATES)
                    text = tmpl.format(kw=kw)
                else:
                    # Urgency + synonym
                    syn = apply_synonym_replacement(kw)
                    tmpl = random.choice(URGENCY_TEMPLATES)
                    text = tmpl.format(kw=syn)
                intent_samples.add(text)
            else:
                # No keywords - use intent name
                if name:
                    text = apply_template(name)
                    intent_samples.add(text)
                else:
                    break

        # Convert to list and cap
        intent_samples_list = list(intent_samples)
        if len(intent_samples_list) > MAX_SAMPLES:
            intent_samples_list = random.sample(intent_samples_list, MAX_SAMPLES)

        for sample_text in intent_samples_list:
            all_samples.append({"text": sample_text, "label": code})

        count = len(intent_samples_list)
        stats["per_intent"][code] = count
        stats["total"] += count
        stats["by_category"][category] += count

    # Shuffle
    random.shuffle(all_samples)

    # Write training data
    with open(output_path, 'w', encoding='utf-8') as f:
        for sample in all_samples:
            f.write(json.dumps(sample, ensure_ascii=False) + '\n')

    # Write label mapping
    with open(label_mapping_path, 'w', encoding='utf-8') as f:
        json.dump(label_mapping, f, ensure_ascii=False, indent=2)

    # -----------------------------------------------------------------------
    # Print detailed stats
    # -----------------------------------------------------------------------
    counts = list(stats["per_intent"].values())
    print(f"\n{'='*60}")
    print(f"Training data generated (v2)")
    print(f"{'='*60}")
    print(f"  Total samples:       {stats['total']}")
    print(f"  Intents:             {len(stats['per_intent'])}")
    print(f"  Min samples/intent:  {min(counts)}")
    print(f"  Max samples/intent:  {max(counts)}")
    print(f"  Avg samples/intent:  {sum(counts)/len(counts):.1f}")
    print(f"  Median:              {sorted(counts)[len(counts)//2]}")

    print(f"\n  Category breakdown:")
    for cat, count in sorted(stats["by_category"].items(), key=lambda x: -x[1]):
        n_intents = sum(1 for c in stats["per_intent"] if get_category_prefix(c) == cat)
        print(f"    {cat:30s}  {count:5d} samples  ({n_intents} intents)")

    print(f"\n  Bottom 10 by sample count:")
    for code, count in sorted(stats["per_intent"].items(), key=lambda x: x[1])[:10]:
        print(f"    {code:45s}  {count}")

    print(f"\n  Top 10 by sample count:")
    for code, count in sorted(stats["per_intent"].items(), key=lambda x: -x[1])[:10]:
        print(f"    {code:45s}  {count}")

    # Check for intents below minimum
    below_min = {c: n for c, n in stats["per_intent"].items() if n < MIN_SAMPLES}
    if below_min:
        print(f"\n  WARNING: {len(below_min)} intents below {MIN_SAMPLES} samples:")
        for code, count in sorted(below_min.items(), key=lambda x: x[1]):
            print(f"    {code:45s}  {count}")
    else:
        print(f"\n  All intents have >= {MIN_SAMPLES} samples.")

    print(f"\n  Output:        {output_path}")
    print(f"  Label mapping: {label_mapping_path}")
    print(f"{'='*60}")


if __name__ == "__main__":
    generate_training_data()
