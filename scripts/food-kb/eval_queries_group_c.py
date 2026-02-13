# -*- coding: utf-8 -*-
"""
Group C 评测查询集 — 46条查询覆盖10个分类

覆盖分类:
  process (6), haccp (5), sop (5), cold_chain (4), factory_design (4),
  packaging_tech (4), traceability (4), meat (5), retail_meat (4), dairy (5)

风格分布:
  标准 ~35%, 口语化 ~15%, 场景化 ~15%, 模糊 ~10%,
  否定式 ~5%, 多意图 ~5%, 对比式 ~5%, 其他(错别字/追问式/对抗性) ~10%

难度分布:
  easy ~50%, medium ~35%, hard ~15%
"""

QUERIES = [
    # ══════════════════════════════════════════════════════════════════════
    # process — 加工工艺 (6 queries)
    # ══════════════════════════════════════════════════════════════════════
    {
        "query": "食品辐照杀菌的剂量范围和适用产品",
        "expected_title_keywords": ["辐照", "杀菌", "加工"],
        "category": "process",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "发酵肉制品的微生物发酵剂种类和发酵温度",
        "expected_title_keywords": ["发酵", "肉制品", "加工"],
        "category": "process",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "干燥的时候温度太高会不会把营养搞没了",
        "expected_title_keywords": ["干燥", "脱水", "加工", "工艺"],
        "category": "process",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "工厂想做烟熏鱼片，烟熏温度和时间怎么控制才能保证苯并芘不超标",
        "expected_title_keywords": ["烟熏", "加工", "工艺", "苯并芘"],
        "category": "process",
        "difficulty": "hard",
        "style": "场景化",
    },
    {
        "query": "腌制跟发酵有啥不一样",
        "expected_title_keywords": ["腌制", "发酵", "加工", "工艺"],
        "category": "process",
        "difficulty": "medium",
        "style": "对比式",
    },
    {
        "query": "杀菌工艺参数",
        "expected_title_keywords": ["杀菌", "加工", "热加工", "巴氏"],
        "category": "process",
        "difficulty": "easy",
        "style": "模糊",
    },

    # ══════════════════════════════════════════════════════════════════════
    # haccp — HACCP体系 (5 queries)
    # ══════════════════════════════════════════════════════════════════════
    {
        "query": "HACCP体系中CCP关键控制点的监控频率和纠偏措施",
        "expected_title_keywords": ["HACCP", "CCP", "关键控制点", "危害分析"],
        "category": "haccp",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "GMP对食品生产车间设备材质的要求是什么",
        "expected_title_keywords": ["GMP", "设备", "生产规范"],
        "category": "haccp",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "内审的时候发现不合格项怎么开CAPA",
        "expected_title_keywords": ["内审", "CAPA", "管理评审", "不合格"],
        "category": "haccp",
        "difficulty": "medium",
        "style": "场景化",
    },
    {
        "query": "ISO 22000和FSSC 22000有什么区别，哪个含金量更高",
        "expected_title_keywords": ["ISO 22000", "FSSC", "HACCP", "GFSI"],
        "category": "haccp",
        "difficulty": "medium",
        "style": "对比式",
    },
    {
        "query": "危害分析里面物理危害化学危害生物危害分别怎么识别和预防",
        "expected_title_keywords": ["危害分析", "HACCP", "物理", "化学", "生物"],
        "category": "haccp",
        "difficulty": "hard",
        "style": "多意图",
    },

    # ══════════════════════════════════════════════════════════════════════
    # sop — 标准操作规程 (5 queries)
    # ══════════════════════════════════════════════════════════════════════
    {
        "query": "食品车间清洗消毒操作规程和消毒剂浓度配比",
        "expected_title_keywords": ["清洗", "消毒", "操作规程", "消毒剂"],
        "category": "sop",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "虫害管理的灭蝇灯和鼠饵站怎么布置",
        "expected_title_keywords": ["虫害", "IPM", "灭蝇", "鼠饵"],
        "category": "sop",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "工人进车间之前要洗几遍手，消毒水泡多久",
        "expected_title_keywords": ["人员卫生", "洗手", "消毒", "操作规程"],
        "category": "sop",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "过期原料和不合格品该怎么销毁，需要留什么记录",
        "expected_title_keywords": ["废弃物", "不合格", "销毁", "操作规程"],
        "category": "sop",
        "difficulty": "medium",
        "style": "场景化",
    },
    {
        "query": "追朔体系怎么建",
        "expected_title_keywords": ["追溯", "操作规程", "批次"],
        "category": "sop",
        "difficulty": "medium",
        "style": "错别字",
    },

    # ══════════════════════════════════════════════════════════════════════
    # cold_chain — 冷链 (4 queries)
    # ══════════════════════════════════════════════════════════════════════
    {
        "query": "冷藏车运输温度监控记录仪的精度要求和安装位置",
        "expected_title_keywords": ["冷藏", "运输", "温度", "记录仪", "冷链"],
        "category": "cold_chain",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "冷链中间断了一下会怎么样，肉还能吃吗",
        "expected_title_keywords": ["断链", "冷链", "温度", "冷藏"],
        "category": "cold_chain",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "夏天35度生鲜电商配送用什么保温箱和冰袋能撑24小时",
        "expected_title_keywords": ["保温箱", "冷链", "电商", "生鲜", "冰袋", "EPP"],
        "category": "cold_chain",
        "difficulty": "hard",
        "style": "场景化",
    },
    {
        "query": "冷库化霜的时候温度升多少算正常，不会影响里面的货吧",
        "expected_title_keywords": ["冷库", "化霜", "温度", "冷链"],
        "category": "cold_chain",
        "difficulty": "medium",
        "style": "追问式",
    },

    # ══════════════════════════════════════════════════════════════════════
    # factory_design — 工厂设计 (4 queries)
    # ══════════════════════════════════════════════════════════════════════
    {
        "query": "食品工厂洁净车间的换气次数和正压控制参数",
        "expected_title_keywords": ["洁净", "车间", "HVAC", "设计", "换气"],
        "category": "factory_design",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "建一个食品加工厂选址有什么要求，离居民区多远",
        "expected_title_keywords": ["选址", "工厂", "规划", "设计", "厂房"],
        "category": "factory_design",
        "difficulty": "easy",
        "style": "口语化",
    },
    {
        "query": "车间里面人走的路和物料运的路必须分开吗，怎么设计合理",
        "expected_title_keywords": ["人流", "物流", "布局", "设计", "分区", "车间"],
        "category": "factory_design",
        "difficulty": "medium",
        "style": "场景化",
    },
    {
        "query": "食品工厂废水COD排放限值是多少，处理工艺用什么方案",
        "expected_title_keywords": ["废水", "废弃物", "环保", "工厂", "COD"],
        "category": "factory_design",
        "difficulty": "medium",
        "style": "标准",
    },

    # ══════════════════════════════════════════════════════════════════════
    # packaging_tech — 包装技术 (4 queries)
    # ══════════════════════════════════════════════════════════════════════
    {
        "query": "气调包装MAP中不同食品的气体配比标准",
        "expected_title_keywords": ["气调", "MAP", "包装"],
        "category": "packaging_tech",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "真空包装和气调包装哪个保质期更长",
        "expected_title_keywords": ["真空", "气调", "包装", "保质期"],
        "category": "packaging_tech",
        "difficulty": "medium",
        "style": "对比式",
    },
    {
        "query": "那种包装上贴的能变色的新鲜度标签是什么原理",
        "expected_title_keywords": ["智能包装", "活性包装", "新鲜度", "指示器", "TTI"],
        "category": "packaging_tech",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "有没有不用脱氧剂也能防止食品氧化变质的包装方法",
        "expected_title_keywords": ["包装", "脱氧", "真空", "活性包装", "保鲜"],
        "category": "packaging_tech",
        "difficulty": "hard",
        "style": "否定式",
    },

    # ══════════════════════════════════════════════════════════════════════
    # traceability — 追溯 (4 queries)
    # ══════════════════════════════════════════════════════════════════════
    {
        "query": "食品追溯系统中一物一码的编码规则和实施方法",
        "expected_title_keywords": ["追溯", "一物一码", "编码", "批次"],
        "category": "traceability",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "区块链技术在食品溯源中怎么用，比传统追溯系统强在哪里",
        "expected_title_keywords": ["区块链", "追溯", "溯源"],
        "category": "traceability",
        "difficulty": "medium",
        "style": "标准",
    },
    {
        "query": "出了食品安全问题要召回，怎么通过批次号快速定位受影响产品",
        "expected_title_keywords": ["追溯", "批次", "召回"],
        "category": "traceability",
        "difficulty": "hard",
        "style": "场景化",
    },
    {
        "query": "追溯数据要保存几年",
        "expected_title_keywords": ["追溯", "数据", "保存", "记录"],
        "category": "traceability",
        "difficulty": "easy",
        "style": "模糊",
    },

    # ══════════════════════════════════════════════════════════════════════
    # meat — 肉制品加工 (5 queries)
    # ══════════════════════════════════════════════════════════════════════
    {
        "query": "火腿肠乳化斩拌工艺的温度控制和加料顺序",
        "expected_title_keywords": ["火腿肠", "乳化", "肉制品", "斩拌"],
        "category": "meat",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "生猪屠宰致昏放血的标准操作流程",
        "expected_title_keywords": ["屠宰", "致昏", "放血", "生猪"],
        "category": "meat",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "做腊肉腊肠用硝酸钠还是亚硝酸纳，放多少不超标",
        "expected_title_keywords": ["腌腊", "腌制", "亚硝酸", "肉制品"],
        "category": "meat",
        "difficulty": "medium",
        "style": "错别字",
    },
    {
        "query": "肉灌好肠以后蒸煮中心温度要达到多少度才安全",
        "expected_title_keywords": ["肉制品", "蒸煮", "中心温度", "杀菌", "热加工"],
        "category": "meat",
        "difficulty": "easy",
        "style": "口语化",
    },
    {
        "query": "培根冷熏和热熏的区别是什么，为什么有的培根颜色深有的浅",
        "expected_title_keywords": ["培根", "烟熏", "冷熏", "热熏", "火腿"],
        "category": "meat",
        "difficulty": "hard",
        "style": "多意图",
    },

    # ══════════════════════════════════════════════════════════════════════
    # retail_meat — 零售肉类 (4 queries)
    # ══════════════════════════════════════════════════════════════════════
    {
        "query": "超市生鲜肉类入库验收的温度检测和感官检查标准",
        "expected_title_keywords": ["入库验收", "超市", "生鲜", "零售", "温度"],
        "category": "retail_meat",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "山姆和盒马的牛肉供应链标准谁更严格",
        "expected_title_keywords": ["山姆", "盒马", "供应链", "零售", "牛肉"],
        "category": "retail_meat",
        "difficulty": "medium",
        "style": "对比式",
    },
    {
        "query": "超市卖场里分割肉的保质期一般多久，怎么保鲜",
        "expected_title_keywords": ["分割", "保质期", "零售", "超市", "生鲜"],
        "category": "retail_meat",
        "difficulty": "medium",
        "style": "场景化",
    },
    {
        "query": "不达标的冷鲜肉到了门店会怎么处理",
        "expected_title_keywords": ["验收", "不合格", "零售", "超市", "冷鲜"],
        "category": "retail_meat",
        "difficulty": "medium",
        "style": "否定式",
    },

    # ══════════════════════════════════════════════════════════════════════
    # dairy — 乳制品 (5 queries)
    # ══════════════════════════════════════════════════════════════════════
    {
        "query": "巴氏杀菌乳HTST工艺的温度和时间参数",
        "expected_title_keywords": ["巴氏", "杀菌", "HTST", "乳制品"],
        "category": "dairy",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "UHT灭菌奶和巴氏奶在营养价值上有多大差别",
        "expected_title_keywords": ["UHT", "巴氏", "灭菌", "乳制品", "牛奶"],
        "category": "dairy",
        "difficulty": "medium",
        "style": "对比式",
    },
    {
        "query": "生乳收购的时候体细胞数超标了是不是说明奶牛生病了",
        "expected_title_keywords": ["生乳", "体细胞", "收购", "乳制品"],
        "category": "dairy",
        "difficulty": "medium",
        "style": "追问式",
    },
    {
        "query": "酸奶发酵用什么菌种，发酵温度和时间怎么控制",
        "expected_title_keywords": ["酸奶", "发酵", "菌种", "乳制品"],
        "category": "dairy",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "牛奶里面黄曲霉毒素M1的限量是多少，超标了会怎么样",
        "expected_title_keywords": ["黄曲霉", "乳制品", "生乳", "牛奶", "M1"],
        "category": "dairy",
        "difficulty": "hard",
        "style": "对抗性",
    },
]
