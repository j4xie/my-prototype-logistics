#!/usr/bin/env python3
"""
Group D: Evaluation queries for food knowledge base RAG system.

Categories covered (48 non-adversarial across 11 categories):
  aquatic(5), beverage(4), grain(5), edible_oil(4), condiment(5),
  bakery(5), frozen_food(4), canned_food(4), central_kitchen(4),
  catering(4), prefab_food(4)

Plus 6 adversarial queries = 54 total.

Style distribution (non-adversarial, 48 queries):
  ~35% 标准    (17)
  ~15% 口语化  (7)
  ~15% 场景化  (7)
  ~10% 模糊    (2)
  ~5%  否定式  (2)
  ~5%  多意图  (2)
  ~5%  对比式  (3)
  ~10% other   (4: 错别字x2, 追问式x2)

Difficulty distribution (non-adversarial):
  ~50% easy   (25)
  ~35% medium (16)
  ~15% hard   (7)

Usage:
  from eval_queries_group_d import QUERIES
"""

from typing import List, Dict

QUERIES: List[Dict] = [
    # ══════════════════════════════════════════════════════════════════
    # 1. aquatic — 水产品 (4 queries)
    # ══════════════════════════════════════════════════════════════════
    {
        "query": "水产品加工中组胺含量的限量标准是多少",
        "expected_title_keywords": ["水产", "组胺", "鱼", "海鲜"],
        "category": "aquatic",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "虾仁解冻后表面发黏还能继续用吗",
        "expected_title_keywords": ["虾", "水产", "海鲜", "鱼"],
        "category": "aquatic",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "鱼类加工和虾类加工在微生物控制上有什么区别",
        "expected_title_keywords": ["鱼", "虾", "水产", "海鲜"],
        "category": "aquatic",
        "difficulty": "medium",
        "style": "对比式",
    },
    {
        "query": "活鲜水产品运输途中的暂养水温应该控制在什么范围",
        "expected_title_keywords": ["水产", "海鲜", "鱼", "虾"],
        "category": "aquatic",
        "difficulty": "easy",
        "style": "场景化",
    },
    {
        "query": "海鲜干货里面的重金属什么的有要求吗",
        "expected_title_keywords": ["水产", "海鲜", "鱼", "虾"],
        "category": "aquatic",
        "difficulty": "medium",
        "style": "模糊",
    },

    # ══════════════════════════════════════════════════════════════════
    # 2. beverage — 饮料 (4 queries)
    # ══════════════════════════════════════════════════════════════════
    {
        "query": "果汁饮料的果汁含量最低要求是百分之多少",
        "expected_title_keywords": ["饮料", "果汁"],
        "category": "beverage",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "矿泉水和纯净水在生产工艺上有哪些不同",
        "expected_title_keywords": ["矿泉水", "饮料"],
        "category": "beverage",
        "difficulty": "medium",
        "style": "对比式",
    },
    {
        "query": "碳酸饮料里面那个气是怎么加进去的，有没有安全问题",
        "expected_title_keywords": ["碳酸", "饮料"],
        "category": "beverage",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "饮料生产车间CIP清洗系统的操作规范",
        "expected_title_keywords": ["饮料", "果汁", "矿泉水"],
        "category": "beverage",
        "difficulty": "easy",
        "style": "标准",
    },

    # ══════════════════════════════════════════════════════════════════
    # 3. grain — 粮食 (4 queries)
    # ══════════════════════════════════════════════════════════════════
    {
        "query": "大米加工过程中真菌毒素的检测标准",
        "expected_title_keywords": ["大米", "粮食", "谷物", "粮油"],
        "category": "grain",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "面粉里黄曲霉毒素超标了怎么处理",
        "expected_title_keywords": ["面粉", "粮食", "谷物", "粮油"],
        "category": "grain",
        "difficulty": "medium",
        "style": "场景化",
    },
    {
        "query": "谷物储存时防止霉变的温湿度要求",
        "expected_title_keywords": ["谷物", "粮食", "大米", "面粉", "粮油"],
        "category": "grain",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "稻谷加工成精米的出米率正常是多少，低了是不是掺假",
        "expected_title_keywords": ["大米", "粮食", "谷物", "粮油"],
        "category": "grain",
        "difficulty": "hard",
        "style": "追问式",
    },
    {
        "query": "面粉里面那个漂白的东西叫什么，现在还让用吗",
        "expected_title_keywords": ["面粉", "粮食", "谷物", "粮油"],
        "category": "grain",
        "difficulty": "medium",
        "style": "模糊",
    },

    # ══════════════════════════════════════════════════════════════════
    # 4. edible_oil — 食用油 (4 queries)
    # ══════════════════════════════════════════════════════════════════
    {
        "query": "食用植物油酸价和过氧化值的限量指标",
        "expected_title_keywords": ["食用油", "植物油", "酸价", "过氧化值"],
        "category": "edible_oil",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "炸东西的油用了几次就不能再用了",
        "expected_title_keywords": ["食用油", "植物油", "酸价", "过氧化值"],
        "category": "edible_oil",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "油脂氧化会产生哪些有害物质，对人体有什么影响",
        "expected_title_keywords": ["食用油", "植物油", "过氧化值"],
        "category": "edible_oil",
        "difficulty": "medium",
        "style": "标准",
    },
    {
        "query": "压榨油和浸出油哪个更安全，国家标准怎么规定的",
        "expected_title_keywords": ["食用油", "植物油"],
        "category": "edible_oil",
        "difficulty": "hard",
        "style": "对比式",
    },

    # ══════════════════════════════════════════════════════════════════
    # 5. condiment — 调味品 (4 queries)
    # ══════════════════════════════════════════════════════════════════
    {
        "query": "酿造酱油和配制酱油的区分标准是什么",
        "expected_title_keywords": ["酱油", "调味品"],
        "category": "condiment",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "酱油颜色深浅跟质量有关系吗",
        "expected_title_keywords": ["酱油", "调味品"],
        "category": "condiment",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "味精加热后会不会产生有害物质",
        "expected_title_keywords": ["味精", "调味品"],
        "category": "condiment",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "复合调味料的生产许可审查需要哪些条件",
        "expected_title_keywords": ["复合调味", "调味品"],
        "category": "condiment",
        "difficulty": "medium",
        "style": "标准",
    },
    {
        "query": "酿造酱油的氨基酸太氮含量标准是多少",
        "expected_title_keywords": ["酱油", "调味品"],
        "category": "condiment",
        "difficulty": "easy",
        "style": "错别字",
    },

    # ══════════════════════════════════════════════════════════════════
    # 6. bakery — 烘焙 (4 queries)
    # ══════════════════════════════════════════════════════════════════
    {
        "query": "面包保质期一般怎么确定，有没有国家标准",
        "expected_title_keywords": ["面包", "烘焙", "糕点"],
        "category": "bakery",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "蛋糕裱花间的温度和卫生要求",
        "expected_title_keywords": ["蛋糕", "糕点", "烘焙"],
        "category": "bakery",
        "difficulty": "easy",
        "style": "场景化",
    },
    {
        "query": "饼干生产中铝的残留量不能超过多少",
        "expected_title_keywords": ["饼干", "烘焙", "糕点"],
        "category": "bakery",
        "difficulty": "medium",
        "style": "否定式",
    },
    {
        "query": "烘焙食品中丙烯酰胺的控制措施有哪些",
        "expected_title_keywords": ["烘焙", "面包", "糕点", "饼干"],
        "category": "bakery",
        "difficulty": "hard",
        "style": "标准",
    },
    {
        "query": "糕点里的反式脂肪酸不能趄过多少",
        "expected_title_keywords": ["糕点", "烘焙", "面包", "蛋糕"],
        "category": "bakery",
        "difficulty": "easy",
        "style": "错别字",
    },

    # ══════════════════════════════════════════════════════════════════
    # 7. frozen_food — 速冻食品 (4 queries)
    # ══════════════════════════════════════════════════════════════════
    {
        "query": "速冻水饺的储存温度要求",
        "expected_title_keywords": ["速冻", "冷冻", "速冻食品"],
        "category": "frozen_food",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "IQF单体速冻技术相比传统冷冻有什么优势",
        "expected_title_keywords": ["速冻", "冷冻", "速冻食品"],
        "category": "frozen_food",
        "difficulty": "hard",
        "style": "对比式",
    },
    {
        "query": "速冻食品化了又冻回去还能吃吗，有什么风险",
        "expected_title_keywords": ["速冻", "冷冻", "速冻食品"],
        "category": "frozen_food",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "速冻肉丸的微生物限量指标是多少",
        "expected_title_keywords": ["速冻", "冷冻", "速冻食品"],
        "category": "frozen_food",
        "difficulty": "easy",
        "style": "标准",
    },

    # ══════════════════════════════════════════════════════════════════
    # 8. canned_food — 罐头 (4 queries)
    # ══════════════════════════════════════════════════════════════════
    {
        "query": "罐头食品商业无菌检验的标准方法",
        "expected_title_keywords": ["罐头", "商业无菌", "杀菌"],
        "category": "canned_food",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "罐头杀菌的F值是什么意思，怎么计算",
        "expected_title_keywords": ["罐头", "杀菌", "商业无菌"],
        "category": "canned_food",
        "difficulty": "hard",
        "style": "追问式",
    },
    {
        "query": "罐头胀罐是不是一定说明变质了",
        "expected_title_keywords": ["罐头", "密封", "商业无菌"],
        "category": "canned_food",
        "difficulty": "medium",
        "style": "否定式",
    },
    {
        "query": "我们厂刚开始做水果罐头，密封性检测应该怎么做",
        "expected_title_keywords": ["罐头", "密封", "杀菌"],
        "category": "canned_food",
        "difficulty": "easy",
        "style": "场景化",
    },

    # ══════════════════════════════════════════════════════════════════
    # 9. central_kitchen — 中央厨房 (4 queries)
    # ══════════════════════════════════════════════════════════════════
    {
        "query": "中央厨房的功能分区设计要求有哪些",
        "expected_title_keywords": ["中央厨房", "团餐", "集体供餐"],
        "category": "central_kitchen",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "团餐配送过程中温度断链了怎么补救",
        "expected_title_keywords": ["团餐", "中央厨房", "配送", "集体供餐"],
        "category": "central_kitchen",
        "difficulty": "medium",
        "style": "场景化",
    },
    {
        "query": "集体供餐的留样制度具体要怎么执行",
        "expected_title_keywords": ["集体供餐", "中央厨房", "团餐"],
        "category": "central_kitchen",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "我们中央厨房想同时做冷餐和热餐，车间布局该怎么设计",
        "expected_title_keywords": ["中央厨房", "团餐", "集体供餐"],
        "category": "central_kitchen",
        "difficulty": "hard",
        "style": "场景化",
    },

    # ══════════════════════════════════════════════════════════════════
    # 10. catering — 餐饮服务 (4 queries)
    # ══════════════════════════════════════════════════════════════════
    {
        "query": "餐饮服务单位食品安全管理人员的职责有哪些",
        "expected_title_keywords": ["餐饮", "餐饮服务", "食堂"],
        "category": "catering",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "食堂后厨明厨亮灶的设备安装标准",
        "expected_title_keywords": ["明厨亮灶", "食堂", "餐饮"],
        "category": "catering",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "饭店厨房的抽油烟机多久洗一次才符合规定",
        "expected_title_keywords": ["餐饮", "餐饮服务", "食堂"],
        "category": "catering",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "学校食堂和社会餐饮在监管要求上有什么不同",
        "expected_title_keywords": ["食堂", "餐饮", "餐饮服务"],
        "category": "catering",
        "difficulty": "hard",
        "style": "多意图",
    },

    # ══════════════════════════════════════════════════════════════════
    # 11. prefab_food — 预制菜 (4 queries)
    # ══════════════════════════════════════════════════════════════════
    {
        "query": "预制菜的分类标准，即食和即热有什么区别",
        "expected_title_keywords": ["预制菜", "即食", "预制食品"],
        "category": "prefab_food",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "预制菜出厂前需要做哪些检验项目",
        "expected_title_keywords": ["预制菜", "预制食品", "即食"],
        "category": "prefab_food",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "网上买的那种加热就能吃的菜保质期一般多久",
        "expected_title_keywords": ["预制菜", "即食", "预制食品"],
        "category": "prefab_food",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "预制菜生产企业需要拿什么证照，跟普通食品厂一样吗",
        "expected_title_keywords": ["预制菜", "预制食品", "即食"],
        "category": "prefab_food",
        "difficulty": "medium",
        "style": "多意图",
    },

    # ══════════════════════════════════════════════════════════════════
    # 12. ADVERSARIAL queries (6 queries)
    # ══════════════════════════════════════════════════════════════════

    # --- Out of scope (2) ---
    {
        "query": "宠物食品的营养标准和安全要求是什么",
        "expected_title_keywords": ["__NONE__"],
        "category": "adversarial",
        "difficulty": "hard",
        "style": "对抗性",
    },
    {
        "query": "化妆品中防腐剂的安全限量是多少",
        "expected_title_keywords": ["__NONE__"],
        "category": "adversarial",
        "difficulty": "hard",
        "style": "对抗性",
    },

    # --- Extremely vague (2) ---
    {
        "query": "食品安全怎么办",
        "expected_title_keywords": ["__NONE__"],
        "category": "adversarial",
        "difficulty": "hard",
        "style": "对抗性",
    },
    {
        "query": "这个标准是什么意思，我看不懂",
        "expected_title_keywords": ["__NONE__"],
        "category": "adversarial",
        "difficulty": "hard",
        "style": "对抗性",
    },

    # --- Wrong assumptions (2) ---
    {
        "query": "为什么中国允许在婴儿奶粉中添加三聚氰胺",
        "expected_title_keywords": ["__NONE__"],
        "category": "adversarial",
        "difficulty": "hard",
        "style": "对抗性",
    },
    {
        "query": "听说苏丹红是合法的食品添加剂，用量标准是多少",
        "expected_title_keywords": ["__NONE__"],
        "category": "adversarial",
        "difficulty": "hard",
        "style": "对抗性",
    },
]

# ── Validation ──────────────────────────────────────────────────────
assert len(QUERIES) == 54, f"Expected 54 queries, got {len(QUERIES)}"

_category_counts = {}
for q in QUERIES:
    _category_counts[q["category"]] = _category_counts.get(q["category"], 0) + 1

_expected_categories = {
    "aquatic": 5, "beverage": 4, "grain": 5, "edible_oil": 4,
    "condiment": 5, "bakery": 5, "frozen_food": 4, "canned_food": 4,
    "central_kitchen": 4, "catering": 4, "prefab_food": 4,
    "adversarial": 6,
}
for cat, expected_count in _expected_categories.items():
    actual = _category_counts.get(cat, 0)
    assert actual == expected_count, (
        f"Category '{cat}': expected {expected_count}, got {actual}"
    )

# Validate required fields
_valid_difficulties = {"easy", "medium", "hard"}
_valid_styles = {
    "标准", "口语化", "场景化", "模糊", "否定式",
    "多意图", "对比式", "错别字", "追问式", "对抗性",
}
for i, q in enumerate(QUERIES):
    assert "query" in q, f"Query {i} missing 'query'"
    assert "expected_title_keywords" in q, f"Query {i} missing 'expected_title_keywords'"
    assert "category" in q, f"Query {i} missing 'category'"
    assert "difficulty" in q, f"Query {i} missing 'difficulty'"
    assert "style" in q, f"Query {i} missing 'style'"
    assert q["difficulty"] in _valid_difficulties, (
        f"Query {i} invalid difficulty: {q['difficulty']}"
    )
    assert q["style"] in _valid_styles, (
        f"Query {i} invalid style: {q['style']}"
    )
    assert isinstance(q["expected_title_keywords"], list), (
        f"Query {i} expected_title_keywords must be a list"
    )
    assert len(q["expected_title_keywords"]) >= 1, (
        f"Query {i} expected_title_keywords must have at least 1 element"
    )


if __name__ == "__main__":
    # Print summary when run directly
    print(f"Total queries: {len(QUERIES)}")
    print(f"\nBy category:")
    for cat in sorted(_category_counts):
        print(f"  {cat:20s}: {_category_counts[cat]}")

    difficulty_counts = {}
    style_counts = {}
    for q in QUERIES:
        difficulty_counts[q["difficulty"]] = difficulty_counts.get(q["difficulty"], 0) + 1
        style_counts[q["style"]] = style_counts.get(q["style"], 0) + 1

    print(f"\nBy difficulty:")
    for d in sorted(difficulty_counts):
        print(f"  {d:10s}: {difficulty_counts[d]}")

    print(f"\nBy style:")
    for s in sorted(style_counts, key=lambda x: -style_counts[x]):
        pct = style_counts[s] / len(QUERIES) * 100
        print(f"  {s:10s}: {style_counts[s]:3d} ({pct:.0f}%)")

    print("\nAll validations passed.")
