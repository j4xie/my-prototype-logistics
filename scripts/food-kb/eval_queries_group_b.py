#!/usr/bin/env python3
"""
Group B evaluation queries for food knowledge base RAG system.

Covers 10 categories: additive, microbe, fraud_detection, novel_food,
infant_food, health_food, functional_food, ecommerce_food, food_incident, emergency.

45 queries total with diverse styles and difficulty levels.

Style distribution:
  - 标准: ~35%  (16 queries)
  - 口语化: ~15% (7 queries)
  - 场景化: ~15% (7 queries)
  - 模糊: ~10%  (4 queries)
  - 否定式: ~5%  (2 queries)
  - 多意图: ~5%  (2 queries)
  - 对比式: ~5%  (2 queries)
  - 错别字/追问式/对抗性: ~10% (5 queries)

Difficulty distribution:
  - easy: ~50%   (23 queries)
  - medium: ~35% (15 queries)
  - hard: ~15%   (7 queries)
"""

from typing import List, Dict

QUERIES: List[Dict] = [
    # ═══════════════════════════════════════════════════════════════════
    # additive (6 queries)
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "山梨酸钾在肉制品中的最大使用量是多少",
        "expected_title_keywords": ["山梨酸", "防腐剂", "添加剂"],
        "category": "additive",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "做糖果的时候能加哪些色素让颜色好看一点",
        "expected_title_keywords": ["着色剂", "色素", "GB 2760"],
        "category": "additive",
        "difficulty": "easy",
        "style": "口语化",
    },
    {
        "query": "抗氧化剂TBHQ在食用油中的限量标准及检测方法",
        "expected_title_keywords": ["抗氧化剂", "TBHQ", "食用油", "添加剂"],
        "category": "additive",
        "difficulty": "medium",
        "style": "标准",
    },
    {
        "query": "哪些甜味剂是不能用在婴幼儿食品里面的",
        "expected_title_keywords": ["甜味剂", "婴幼儿", "GB 2760", "添加剂"],
        "category": "additive",
        "difficulty": "medium",
        "style": "否定式",
    },
    {
        "query": "冰激凌里面放的那种让口感滑滑的东西叫什么，有没有限量",
        "expected_title_keywords": ["乳化剂", "增稠剂", "冰淇淋"],
        "category": "additive",
        "difficulty": "medium",
        "style": "口语化",
    },
    {
        "query": "GB 2760对膨松剂铝残留量的规定和防腐剂叠加使用的比例计算方法",
        "expected_title_keywords": ["膨松剂", "防腐剂", "GB 2760", "添加剂"],
        "category": "additive",
        "difficulty": "hard",
        "style": "多意图",
    },

    # ═══════════════════════════════════════════════════════════════════
    # microbe (6 queries)
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "沙门氏菌的检测方法和限量标准",
        "expected_title_keywords": ["沙门氏菌", "致病菌", "微生物"],
        "category": "microbe",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "车间管道和设备上长了一层滑滑的东西洗不掉是怎么回事",
        "expected_title_keywords": ["生物膜", "微生物", "清洁"],
        "category": "microbe",
        "difficulty": "medium",
        "style": "场景化",
    },
    {
        "query": "金黄色葡萄球菌中毒的潜伏期和症状",
        "expected_title_keywords": ["金黄色葡萄球菌", "致病菌", "微生物"],
        "category": "microbe",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "李斯特菌为什么在冷藏温度下还能繁殖",
        "expected_title_keywords": ["李斯特菌", "单核细胞增生", "致病菌"],
        "category": "microbe",
        "difficulty": "medium",
        "style": "追问式",
    },
    {
        "query": "大肠杆菌和大肠菌群有什么区别，检测方法一样吗",
        "expected_title_keywords": ["大肠杆菌", "大肠菌群", "菌落总数", "微生物"],
        "category": "microbe",
        "difficulty": "medium",
        "style": "对比式",
    },
    {
        "query": "食品厂环镜监控采样点应该怎么设置",
        "expected_title_keywords": ["环境监控", "微生物", "采样"],
        "category": "microbe",
        "difficulty": "easy",
        "style": "错别字",
    },

    # ═══════════════════════════════════════════════════════════════════
    # fraud_detection (4 queries)
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "怎么检测牛肉里面有没有掺猪肉",
        "expected_title_keywords": ["掺假", "DNA检测", "肉类", "鉴别"],
        "category": "fraud_detection",
        "difficulty": "easy",
        "style": "口语化",
    },
    {
        "query": "蜂蜜掺假的常用鉴别方法有哪些",
        "expected_title_keywords": ["蜂蜜", "掺假", "鉴别", "同位素"],
        "category": "fraud_detection",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "供应商送来的橄榄油颜色和以前不一样了，怀疑掺了别的油怎么验证",
        "expected_title_keywords": ["掺假", "食用油", "鉴别", "食品欺诈"],
        "category": "fraud_detection",
        "difficulty": "medium",
        "style": "场景化",
    },
    {
        "query": "苏丹红和三聚氰氨检测限是多少",
        "expected_title_keywords": ["苏丹红", "三聚氰胺", "非法添加", "食品欺诈"],
        "category": "fraud_detection",
        "difficulty": "hard",
        "style": "错别字",
    },

    # ═══════════════════════════════════════════════════════════════════
    # novel_food (4 queries)
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "新食品原料申报需要提交哪些材料",
        "expected_title_keywords": ["新食品原料", "安全性审查", "申报"],
        "category": "novel_food",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "我们公司想用一种从海藻里提取的新成分做饮料，需要走什么审批流程",
        "expected_title_keywords": ["新食品原料", "安全性审查", "审批"],
        "category": "novel_food",
        "difficulty": "medium",
        "style": "场景化",
    },
    {
        "query": "新食品原料毒理学评价分几级，各级需要做什么试验",
        "expected_title_keywords": ["新食品原料", "毒理学", "评价"],
        "category": "novel_food",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "以前没人吃过的东西能不能直接拿来做食品卖",
        "expected_title_keywords": ["新食品原料", "新资源", "安全性审查"],
        "category": "novel_food",
        "difficulty": "medium",
        "style": "模糊",
    },

    # ═══════════════════════════════════════════════════════════════════
    # infant_food (4 queries)
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "婴儿配方奶粉中DHA和ARA的含量要求",
        "expected_title_keywords": ["婴儿配方", "GB 10765", "婴幼儿"],
        "category": "infant_food",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "给六个月以下的宝宝吃的奶粉里能不能加蔗糖",
        "expected_title_keywords": ["婴儿配方", "婴幼儿", "GB 10765"],
        "category": "infant_food",
        "difficulty": "easy",
        "style": "口语化",
    },
    {
        "query": "阪崎杆菌对婴幼儿配方粉的污染风险及控制措施",
        "expected_title_keywords": ["阪崎", "婴幼儿", "配方"],
        "category": "infant_food",
        "difficulty": "medium",
        "style": "标准",
    },
    {
        "query": "辅食里能加什么不能加什么，跟成人食品的添加剂标准有什么区别",
        "expected_title_keywords": ["辅食", "婴幼儿", "特殊膳食", "添加剂"],
        "category": "infant_food",
        "difficulty": "hard",
        "style": "对比式",
    },

    # ═══════════════════════════════════════════════════════════════════
    # health_food (4 queries)
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "保健食品注册制和备案制有什么区别",
        "expected_title_keywords": ["保健食品", "注册", "备案", "双轨"],
        "category": "health_food",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "保健食品能声称哪些功能，不能说治病对吧",
        "expected_title_keywords": ["保健食品", "功能声称", "特殊食品"],
        "category": "health_food",
        "difficulty": "easy",
        "style": "口语化",
    },
    {
        "query": "我想做一款补钙的保健品要走备案还是注册",
        "expected_title_keywords": ["保健食品", "注册", "备案", "营养素"],
        "category": "health_food",
        "difficulty": "medium",
        "style": "场景化",
    },
    {
        "query": "保健食品和药品的法律监管有什么不同",
        "expected_title_keywords": ["保健食品", "特殊食品", "注册"],
        "category": "health_food",
        "difficulty": "hard",
        "style": "对抗性",
    },

    # ═══════════════════════════════════════════════════════════════════
    # functional_food (4 queries)
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "益生菌产品在保质期内活菌数最低要求是多少",
        "expected_title_keywords": ["益生菌", "功能性", "活菌"],
        "category": "functional_food",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "膳食纤维含量达到多少可以标注高膳食纤维",
        "expected_title_keywords": ["膳食纤维", "营养强化", "GB 28050", "功能"],
        "category": "functional_food",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "营养强化剂和食品添加剂是一回事吗",
        "expected_title_keywords": ["营养强化", "功能性", "特殊膳食"],
        "category": "functional_food",
        "difficulty": "medium",
        "style": "模糊",
    },
    {
        "query": "我们想在面粉里面加维生素和铁，这种算功能性食品还是普通食品",
        "expected_title_keywords": ["营养强化", "功能性", "特殊膳食"],
        "category": "functional_food",
        "difficulty": "hard",
        "style": "场景化",
    },

    # ═══════════════════════════════════════════════════════════════════
    # ecommerce_food (4 queries)
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "直播卖食品需要什么资质和许可证",
        "expected_title_keywords": ["直播", "电商", "网络食品", "电子商务"],
        "category": "ecommerce_food",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "电商平台卖家虚假宣传食品功效平台要承担什么责任",
        "expected_title_keywords": ["电商", "平台", "网络食品", "责任"],
        "category": "ecommerce_food",
        "difficulty": "medium",
        "style": "标准",
    },
    {
        "query": "网上开个店卖自己做的蛋糕需要办什么证",
        "expected_title_keywords": ["网络食品", "电商", "电子商务", "经营许可"],
        "category": "ecommerce_food",
        "difficulty": "easy",
        "style": "口语化",
    },
    {
        "query": "直播间带货的食品出了问题，主播、商家、平台分别承担什么责任",
        "expected_title_keywords": ["直播", "平台", "电商", "网络食品", "责任"],
        "category": "ecommerce_food",
        "difficulty": "hard",
        "style": "标准",
    },

    # ═══════════════════════════════════════════════════════════════════
    # food_incident (5 queries)
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "三聚氰胺事件后国家出台了哪些法规来加强乳制品监管",
        "expected_title_keywords": ["三聚氰胺", "奶粉", "食品安全事件", "食品安全法"],
        "category": "food_incident",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "瘦肉精到底是个什么东西，为什么国家禁止使用",
        "expected_title_keywords": ["瘦肉精", "克伦特罗", "食品安全事件"],
        "category": "food_incident",
        "difficulty": "easy",
        "style": "口语化",
    },
    {
        "query": "产品被抽检不合格要启动召回流程，具体怎么操作",
        "expected_title_keywords": ["召回", "食品安全事件", "应急"],
        "category": "food_incident",
        "difficulty": "medium",
        "style": "场景化",
    },
    {
        "query": "食品安全舆情出来以后企业应该怎么应对",
        "expected_title_keywords": ["舆情", "食品安全事件", "应急", "召回"],
        "category": "food_incident",
        "difficulty": "medium",
        "style": "标准",
    },
    {
        "query": "有消费者在社交媒体上说吃了我们的产品不舒服还拍了照片传播很广",
        "expected_title_keywords": ["舆情", "食品安全事件", "应急", "投诉"],
        "category": "food_incident",
        "difficulty": "hard",
        "style": "场景化",
    },

    # ═══════════════════════════════════════════════════════════════════
    # emergency (4 queries)
    # ═══════════════════════════════════════════════════════════════════
    {
        "query": "食品安全事故应急预案应该包含哪些内容",
        "expected_title_keywords": ["应急预案", "应急", "事故"],
        "category": "emergency",
        "difficulty": "easy",
        "style": "标准",
    },
    {
        "query": "企业应急演练多久搞一次，怎么评估演练效果",
        "expected_title_keywords": ["演练", "应急", "预案"],
        "category": "emergency",
        "difficulty": "medium",
        "style": "标准",
    },
    {
        "query": "出了食品安全事故第一时间应该做什么",
        "expected_title_keywords": ["应急", "事故", "处置", "响应"],
        "category": "emergency",
        "difficulty": "easy",
        "style": "模糊",
    },
    {
        "query": "食品安全事故分几个等级，不同等级响应有什么区别",
        "expected_title_keywords": ["应急", "事故", "预案", "分级"],
        "category": "emergency",
        "difficulty": "medium",
        "style": "追问式",
    },
]


# ─── Validation ──────────────────────────────────────────────────────
def _validate():
    """Validate QUERIES structure and distribution on import."""
    assert len(QUERIES) == 45, f"Expected 45 queries, got {len(QUERIES)}"

    required_keys = {"query", "expected_title_keywords", "category", "difficulty", "style"}
    valid_difficulties = {"easy", "medium", "hard"}
    valid_styles = {"标准", "口语化", "场景化", "模糊", "否定式", "多意图", "对比式", "错别字", "追问式", "对抗性"}
    valid_categories = {
        "additive", "microbe", "fraud_detection", "novel_food",
        "infant_food", "health_food", "functional_food", "ecommerce_food",
        "food_incident", "emergency",
    }

    cat_counts = {}
    style_counts = {}
    diff_counts = {}

    for i, q in enumerate(QUERIES):
        missing = required_keys - set(q.keys())
        assert not missing, f"Query {i} missing keys: {missing}"
        assert q["category"] in valid_categories, f"Query {i} invalid category: {q['category']}"
        assert q["difficulty"] in valid_difficulties, f"Query {i} invalid difficulty: {q['difficulty']}"
        assert q["style"] in valid_styles, f"Query {i} invalid style: {q['style']}"
        assert isinstance(q["expected_title_keywords"], list) and len(q["expected_title_keywords"]) >= 1, \
            f"Query {i} expected_title_keywords must be a non-empty list"

        cat_counts[q["category"]] = cat_counts.get(q["category"], 0) + 1
        style_counts[q["style"]] = style_counts.get(q["style"], 0) + 1
        diff_counts[q["difficulty"]] = diff_counts.get(q["difficulty"], 0) + 1

    # Category counts
    expected_cat_counts = {
        "additive": 6, "microbe": 6, "fraud_detection": 4, "novel_food": 4,
        "infant_food": 4, "health_food": 4, "functional_food": 4,
        "ecommerce_food": 4, "food_incident": 5, "emergency": 4,
    }
    for cat, expected in expected_cat_counts.items():
        actual = cat_counts.get(cat, 0)
        assert actual == expected, f"Category {cat}: expected {expected}, got {actual}"


_validate()


if __name__ == "__main__":
    import json

    print(f"Total queries: {len(QUERIES)}")
    print()

    # Category breakdown
    cats = {}
    for q in QUERIES:
        cats.setdefault(q["category"], []).append(q)
    print("Category breakdown:")
    for cat, qs in cats.items():
        print(f"  {cat}: {len(qs)}")

    # Style breakdown
    styles = {}
    for q in QUERIES:
        styles[q["style"]] = styles.get(q["style"], 0) + 1
    print("\nStyle breakdown:")
    for s, c in sorted(styles.items(), key=lambda x: -x[1]):
        print(f"  {s}: {c} ({c/len(QUERIES)*100:.0f}%)")

    # Difficulty breakdown
    diffs = {}
    for q in QUERIES:
        diffs[q["difficulty"]] = diffs.get(q["difficulty"], 0) + 1
    print("\nDifficulty breakdown:")
    for d, c in sorted(diffs.items(), key=lambda x: -x[1]):
        print(f"  {d}: {c} ({c/len(QUERIES)*100:.0f}%)")

    print("\nAll queries:")
    for i, q in enumerate(QUERIES, 1):
        print(f"  [{i:2d}] [{q['difficulty']:6s}] [{q['style']:4s}] [{q['category']:16s}] {q['query']}")
