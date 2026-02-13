#!/usr/bin/env python3
"""
Group A Evaluation Queries for Food Knowledge Base RAG System.

44 queries across 11 categories (4 per category) with diverse
query styles and difficulty levels for comprehensive RAG evaluation.

Categories:
  standard, regulation, labeling, import_export, certification,
  gmo_labeling, contact_material, allergen, testing, risk_method, training

Style distribution (~):
  40% 标准, 15% 口语化, 15% 场景化, 10% 模糊,
  5% 否定式, 5% 多意图, 5% 对比式, 5% other (错别字/追问式/对抗性)

Difficulty distribution (~):
  50% easy, 35% medium, 15% hard
"""

from typing import List, TypedDict


class EvalQuery(TypedDict):
    query: str
    expected_title_keywords: List[str]
    category: str
    difficulty: str
    style: str


QUERIES: List[EvalQuery] = [
    # ═══════════════════════════════════════════════════════════════════
    # Category 1: standard — GB standards
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "GB 2760对食品添加剂的使用量有哪些限量要求",
        "expected_title_keywords": ["GB 2760", "添加剂", "限量"],
        "category": "standard",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "粮食里面黄曲霉毒素最多能有多少不超标",
        "expected_title_keywords": ["GB 2761", "真菌毒素", "黄曲霉"],
        "category": "standard",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "GB 4789里面哪些微生物指标是不需要每批都检的",
        "expected_title_keywords": ["GB 4789", "微生物", "检验"],
        "category": "standard",
        "difficulty": "medium",
        "style": "否定式",
    },
    {
        "query": "我们车间卫生好像不太达标，那个GB 14881到底怎么要求的",
        "expected_title_keywords": ["GB 14881", "卫生规范", "车间"],
        "category": "standard",
        "difficulty": "easy",
        "style": "场景化",
    },

    # ═══════════════════════════════════════════════════════════════════
    # Category 2: regulation — Food safety laws
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "食品安全法对食品生产企业的主体责任有哪些规定",
        "expected_title_keywords": ["食品安全法", "生产", "主体责任"],
        "category": "regulation",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "开个食品加工厂需要办什么许可证才能合法生产",
        "expected_title_keywords": ["生产许可", "许可", "SC", "管理办法"],
        "category": "regulation",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "产品被检测出不合格需要召回，召回流程和期限是怎么规定的",
        "expected_title_keywords": ["召回", "管理办法", "食品安全"],
        "category": "regulation",
        "difficulty": "medium",
        "style": "场景化",
    },
    {
        "query": "食品按全法实施条例对网络食品经营的特殊规定",
        "expected_title_keywords": ["实施条例", "食品安全法", "网络"],
        "category": "regulation",
        "difficulty": "hard",
        "style": "错别字",
    },

    # ═══════════════════════════════════════════════════════════════════
    # Category 3: labeling — Food labels
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "预包装食品标签上必须标注哪些内容",
        "expected_title_keywords": ["标签", "预包装", "GB 7718", "标注"],
        "category": "labeling",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "食品的营养成分表必须列出哪几项核心营养素",
        "expected_title_keywords": ["营养标签", "营养成分", "营养"],
        "category": "labeling",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "配料表上的原料排序有没有什么讲究",
        "expected_title_keywords": ["配料表", "标签", "配料", "预包装"],
        "category": "labeling",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "食品标签上的保质期和生产日期标识不清会怎样处罚",
        "expected_title_keywords": ["标签", "标识", "保质期", "预包装"],
        "category": "labeling",
        "difficulty": "hard",
        "style": "场景化",
    },

    # ═══════════════════════════════════════════════════════════════════
    # Category 4: import_export — Import/export
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "进口食品入境时需要经过哪些检验检疫程序",
        "expected_title_keywords": ["进口", "检验检疫", "进出口"],
        "category": "import_export",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "我们工厂想把产品出口到东南亚，海关那边要准备什么材料",
        "expected_title_keywords": ["出口", "海关", "进出口", "检验检疫"],
        "category": "import_export",
        "difficulty": "medium",
        "style": "场景化",
    },
    {
        "query": "进口食品和国产食品在标签要求上有什么不同",
        "expected_title_keywords": ["进口", "标签", "进出口"],
        "category": "import_export",
        "difficulty": "hard",
        "style": "对比式",
    },
    {
        "query": "出口食品企业备案登记管理规定",
        "expected_title_keywords": ["出口", "备案", "进出口", "管理"],
        "category": "import_export",
        "difficulty": "easy",
        "style": "标准",
    },

    # ═══════════════════════════════════════════════════════════════════
    # Category 5: certification — Food certifications
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "有机食品认证需要满足哪些条件和标准",
        "expected_title_keywords": ["有机", "认证"],
        "category": "certification",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "ISO 22000和FSSC 22000有什么区别，工厂该选哪个",
        "expected_title_keywords": ["ISO", "FSSC", "认证"],
        "category": "certification",
        "difficulty": "hard",
        "style": "对比式",
    },
    {
        "query": "我们厂刚建好，SC证怎么申请啊流程是什么",
        "expected_title_keywords": ["SC", "生产许可", "认证"],
        "category": "certification",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "BRC认证对食品生产企业的审核要求",
        "expected_title_keywords": ["BRC", "认证", "审核"],
        "category": "certification",
        "difficulty": "easy",
        "style": "标准",
    },

    # ═══════════════════════════════════════════════════════════════════
    # Category 6: gmo_labeling — GMO
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "转基因食品标识管理办法对标注有什么具体要求",
        "expected_title_keywords": ["转基因", "标识", "GMO"],
        "category": "gmo_labeling",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "用了转基因大豆榨的油不标出来行不行",
        "expected_title_keywords": ["转基因", "标识", "大豆"],
        "category": "gmo_labeling",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "转基因食品不做安全评估能不能直接上市",
        "expected_title_keywords": ["转基因", "安全评估", "GMO"],
        "category": "gmo_labeling",
        "difficulty": "medium",
        "style": "否定式",
    },
    {
        "query": "那个转基因的东西要不要标出来，到底有个目录吗",
        "expected_title_keywords": ["转基因", "标识", "目录"],
        "category": "gmo_labeling",
        "difficulty": "medium",
        "style": "模糊",
    },

    # ═══════════════════════════════════════════════════════════════════
    # Category 7: contact_material — Food contact materials
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "GB 4806食品接触材料通用安全标准的主要内容",
        "expected_title_keywords": ["GB 4806", "接触材料", "食品级"],
        "category": "contact_material",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "塑料餐盒装热饭会不会有有害物质迁移出来",
        "expected_title_keywords": ["塑料", "迁移", "接触材料"],
        "category": "contact_material",
        "difficulty": "medium",
        "style": "场景化",
    },
    {
        "query": "食品加工设备什么材质的不锈钢才算食品级",
        "expected_title_keywords": ["不锈钢", "食品级", "接触材料"],
        "category": "contact_material",
        "difficulty": "medium",
        "style": "场景化",
    },
    {
        "query": "食品接触材料的迁移量检测",
        "expected_title_keywords": ["迁移", "接触材料", "GB 4806", "检测"],
        "category": "contact_material",
        "difficulty": "easy",
        "style": "模糊",
    },

    # ═══════════════════════════════════════════════════════════════════
    # Category 8: allergen — Allergens
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "食品生产中过敏原管理有哪些要求",
        "expected_title_keywords": ["过敏原", "管理"],
        "category": "allergen",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "含花生成分的食品如果不标注过敏原会有什么后果",
        "expected_title_keywords": ["花生", "过敏原", "标注"],
        "category": "allergen",
        "difficulty": "medium",
        "style": "否定式",
    },
    {
        "query": "同一条生产线既做含麸质的又做不含的，怎么防止交叉污染",
        "expected_title_keywords": ["麸质", "交叉污染", "过敏原"],
        "category": "allergen",
        "difficulty": "hard",
        "style": "场景化",
    },
    {
        "query": "我国法规规定必须标注的过敏原种类有哪些",
        "expected_title_keywords": ["过敏原", "标注", "牛奶"],
        "category": "allergen",
        "difficulty": "easy",
        "style": "标准",
    },

    # ═══════════════════════════════════════════════════════════════════
    # Category 9: testing — Food testing
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "食品安全抽样检验管理办法对抽样程序的规定",
        "expected_title_keywords": ["抽样", "检验", "管理办法"],
        "category": "testing",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "现在有没有什么办法能现场快速测农药残留",
        "expected_title_keywords": ["快速检测", "农药", "检测"],
        "category": "testing",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "食品检测实验室需要什么资质才能出具有效报告",
        "expected_title_keywords": ["实验室", "检测", "资质", "检验"],
        "category": "testing",
        "difficulty": "medium",
        "style": "场景化",
    },
    {
        "query": "企业自建实验室和送第三方检测机构，哪种更靠谱成本更低",
        "expected_title_keywords": ["检测", "实验室", "第三方"],
        "category": "testing",
        "difficulty": "hard",
        "style": "多意图",
    },

    # ═══════════════════════════════════════════════════════════════════
    # Category 10: risk_method — Risk assessment
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "食品安全风险评估的基本流程和方法",
        "expected_title_keywords": ["风险评估", "危害"],
        "category": "risk_method",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "HACCP体系中危害分析具体怎么做",
        "expected_title_keywords": ["危害分析", "HACCP", "风险"],
        "category": "risk_method",
        "difficulty": "medium",
        "style": "模糊",
    },
    {
        "query": "暴露评估里怎么计算消费者每天摄入某种污染物的量",
        "expected_title_keywords": ["暴露", "评估", "摄入", "风险评估"],
        "category": "risk_method",
        "difficulty": "hard",
        "style": "追问式",
    },
    {
        "query": "食品那个风险什么评估",
        "expected_title_keywords": ["风险评估", "危害分析"],
        "category": "risk_method",
        "difficulty": "medium",
        "style": "模糊",
    },

    # ═══════════════════════════════════════════════════════════════════
    # Category 11: training — Staff training
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "食品安全管理员考核的内容和要求有哪些",
        "expected_title_keywords": ["管理员", "考核", "培训"],
        "category": "training",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "食品从业人员每年必须培训多少小时",
        "expected_title_keywords": ["培训", "从业人员", "管理员"],
        "category": "training",
        "difficulty": "easy",
        "style": "口语化",
    },
    {
        "query": "新来的车间工人上岗前要做什么培训不做行不行",
        "expected_title_keywords": ["培训", "从业人员", "上岗"],
        "category": "training",
        "difficulty": "medium",
        "style": "对抗性",
    },
    {
        "query": "食品安全培训内容应该覆盖哪些方面，不包含哪些可以省略",
        "expected_title_keywords": ["培训", "考核", "从业人员", "管理员"],
        "category": "training",
        "difficulty": "hard",
        "style": "多意图",
    },
]


# ─── Validation assertions ──────────────────────────────────────────
assert len(QUERIES) == 44, f"Expected 44 queries, got {len(QUERIES)}"

_categories = [
    "standard", "regulation", "labeling", "import_export", "certification",
    "gmo_labeling", "contact_material", "allergen", "testing", "risk_method",
    "training",
]
for cat in _categories:
    count = sum(1 for q in QUERIES if q["category"] == cat)
    assert count == 4, f"Category '{cat}' has {count} queries, expected 4"

_valid_styles = {"标准", "口语化", "场景化", "模糊", "否定式", "多意图", "对比式", "错别字", "追问式", "对抗性"}
for q in QUERIES:
    assert q["style"] in _valid_styles, f"Invalid style: {q['style']}"
    assert q["difficulty"] in ("easy", "medium", "hard"), f"Invalid difficulty: {q['difficulty']}"
    assert len(q["expected_title_keywords"]) >= 1, f"Need at least 1 keyword: {q['query']}"


if __name__ == "__main__":
    # Print distribution summary when run directly
    from collections import Counter

    print(f"Total queries: {len(QUERIES)}")
    print(f"\n--- Category distribution ---")
    for cat, count in Counter(q["category"] for q in QUERIES).most_common():
        print(f"  {cat:20s} {count}")

    print(f"\n--- Difficulty distribution ---")
    for diff, count in Counter(q["difficulty"] for q in QUERIES).most_common():
        pct = count / len(QUERIES) * 100
        print(f"  {diff:10s} {count:3d} ({pct:.0f}%)")

    print(f"\n--- Style distribution ---")
    for style, count in Counter(q["style"] for q in QUERIES).most_common():
        pct = count / len(QUERIES) * 100
        print(f"  {style:10s} {count:3d} ({pct:.0f}%)")
