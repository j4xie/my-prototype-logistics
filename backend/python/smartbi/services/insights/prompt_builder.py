from __future__ import annotations
"""
Prompt construction: system role prompts per scenario, tiered prompt
templates (small/medium/large), benchmark formatting, and data-size
tiering helpers.
"""


# ---------------------------------------------------------------------------
# Scenario system roles
# ---------------------------------------------------------------------------

SCENARIO_SYSTEM_ROLES = {
    'financial': (
        "你是一位服务于食品加工企业CFO的资深财务分析师。"
        "你的职责是从经营数据中挖掘可执行的财务洞察。"
        "写作风格：数据驱动（每条结论必须引用具体数字）、因果明确（不仅说是什么更要说为什么）、"
        "建议可落地（含量化目标和时间节点）。"
        "行业参考范围（食品加工业通用，各子行业差异大）：毛利率15-35%、净利率3-8%、管理费用率5-10%、销售费用率8-15%。"
        "注意：禽类加工毛利约6-10%，乳制品10-15%，预制菜15-25%，调味品35-43%。请结合数据实际判断，勿机械对标。"
    ),
    'sales': (
        "你是一位服务于食品加工企业CMO的资深销售分析师。"
        "你的职责是从销售数据中发现增长机会和客户洞察。"
        "分析侧重：渠道效率、客户结构、区域表现、产品组合贡献度、退货异常。"
        "行业参考：食品行业平均客户保留率70-85%，渠道返利率3-8%，经销商集中度前5占比30-50%。"
    ),
    'production': (
        "你是一位服务于食品加工企业COO的资深生产运营分析师。"
        "你的职责是从生产数据中找出效率瓶颈和改进方向。"
        "分析侧重：OEE拆解(可用率×性能率×良品率)、能耗效率、产能利用率、废品率趋势。"
        "行业参考：食品加工OEE 60-85%、良品率95-99.5%、能耗成本占比5-15%。"
    ),
    'supply_chain': (
        "你是一位服务于食品加工企业供应链总监的资深供应链分析师。"
        "你的职责是从供应链数据中优化库存和采购效率。"
        "分析侧重：库存周转天数、供应商集中度、采购成本波动、缺货风险、物流时效。"
        "行业参考：食品行业存货周转30-90天、应收账款15-60天、原料成本占比50-70%。"
    ),
    'restaurant_operations': (
        "你是一位服务于餐饮连锁品牌运营总监的资深餐饮数据分析师。"
        "精通大众点评/美团榜单评选规则和餐饮行业KPI体系。"
        "分析侧重：菜品四象限(Menu Engineering)、门店横向对比、食品成本率、"
        "套餐效率、客单价结构、采购成本波动。"
        "参考大众点评必吃榜/黑珍珠/点评榜单评选标准，评估门店上榜潜力和改进方向。"
        "写作风格：数据驱动（引用具体数字和门店/菜品名）、结论明确、建议可执行。"
    ),
    'general': (
        "你是一位服务于食品加工企业管理层的资深数据分析师。"
        "你的职责是从数据中挖掘可执行的业务洞察。"
        "写作风格：数据驱动、因果明确、建议可落地。"
    ),
}


def get_scenario_system_role(scenario: str) -> str:
    """Get the LLM system role prompt based on detected scenario."""
    return SCENARIO_SYSTEM_ROLES.get(scenario, SCENARIO_SYSTEM_ROLES['general'])


# ---------------------------------------------------------------------------
# Scenario benchmarks
# ---------------------------------------------------------------------------

SCENARIO_BENCHMARKS = {
    'restaurant_operations': (
        "餐饮连锁对标基准：食材成本率28-38%(火锅30-40%)、人力成本率22-32%、"
        "翻台率2.0-4.5次/天(火锅2.5-5.0)、客单价50-120元、净利率3-12%、"
        "套餐附加率15-40%、折扣率5-20%。\n"
        "菜品四象限(Menu Engineering)：Star(高销量+高利润)=主推、"
        "Plow(高销量+低利润)=提价或缩份量、Puzzle(低销量+高利润)=加推广、"
        "Dog(低销量+低利润)=考虑下架。\n"
        "大众点评必吃榜门槛：口味优选+稳定经营365天+日常消费水平+真实评价。"
        "上榜评估维度：招牌菜集中度、退货率、价格定位、出品稳定性。"
    ),
    'production': (
        "生产对标基准：OEE 60-85%（食品加工业）、良品率 95-99.5%、废品率 1-5%、"
        "设备可用率 85-95%、能耗成本占总成本 5-15%、人均产出 行业中位数参考。"
    ),
    'sales': (
        "销售对标基准：客户保留率 70-85%、渠道返利率 3-8%、前5大客户占比 30-50%、"
        "客单价增长率 3-8%/年、退货率 <3%。"
    ),
    'supply_chain': (
        "供应链对标基准：存货周转 30-90天、应收周转 15-60天、采购集中度前3供应商 <40%、"
        "缺货率 <2%、物流准时率 >95%。"
    ),
}

_DEFAULT_BENCHMARK = (
    "财务参考范围（食品加工通用，子行业差异大）：毛利率15-35%、净利率3-8%、管理费用率5-10%、销售费用率8-15%。"
    "请根据数据实际判断所属子行业特征，避免机械对标。"
)


def get_scenario_benchmarks(scenario: str) -> str:
    """Get scenario-specific benchmark text for the prompt."""
    return SCENARIO_BENCHMARKS.get(scenario, _DEFAULT_BENCHMARK)


# ---------------------------------------------------------------------------
# Data-size tiering
# ---------------------------------------------------------------------------

def get_tiered_config(row_count: int) -> dict:
    """Return ``max_tokens`` and ``tier`` label based on row count.

    Tiers:
      small  (< 50 rows)   : max_tokens=1500
      medium (50-199 rows)  : max_tokens=2500
      large  (>= 200 rows)  : max_tokens=4000
    """
    if row_count < 50:
        return {"max_tokens": 1500, "tier": "small"}
    elif row_count < 200:
        return {"max_tokens": 2500, "tier": "medium"}
    else:
        return {"max_tokens": 4000, "tier": "large"}


# ---------------------------------------------------------------------------
# Cacheable system prompt (for DashScope context caching > 1024 tokens)
# ---------------------------------------------------------------------------

_OUTPUT_SCHEMAS = {
    "small": """{
    "executive_summary": "一句话核心结论（不超过50字，包含关键数字）",
    "insights": [
        {
            "dimension": "what_happened|recommendation",
            "type": "trend|anomaly|comparison|kpi|recommendation",
            "title": "洞察标题（不超过15字）",
            "text": "简洁描述（40-80字，含具体数字）",
            "metric": "相关指标名称",
            "sentiment": "positive|negative|neutral",
            "importance": 1-10,
            "confidence": 0.5-1.0,
            "action_items": ["建议1"],
            "recommendation": "改进建议"
        }
    ],
    "risk_alerts": [{"title": "风险", "description": "描述", "severity": "high|medium|low", "mitigation": "措施"}],
    "opportunities": [{"title": "机会", "description": "描述", "potential_impact": "收益", "action_required": "步骤"}]
}""",
    "medium": """{
    "executive_summary": "一句话管理摘要（不超过60字，包含核心数字）",
    "insights": [
        {
            "dimension": "what_happened|why_happened|recommendation",
            "type": "trend|anomaly|comparison|kpi|recommendation",
            "title": "洞察标题（不超过15字）",
            "text": "详细分析（60-120字，含具体数字和归因）",
            "metric": "相关指标名称",
            "sentiment": "positive|negative|neutral",
            "importance": 1-10,
            "confidence": 0.5-1.0,
            "action_items": ["可执行建议1", "可执行建议2"],
            "recommendation": "改进建议（含预期效果）"
        }
    ],
    "risk_alerts": [{"title": "风险名称", "description": "风险描述", "severity": "high|medium|low", "mitigation": "缓解措施"}],
    "opportunities": [{"title": "机会名称", "description": "机会描述", "potential_impact": "预期收益", "action_required": "落地步骤"}]
}""",
    "large": """{
    "executive_summary": "直接回答用户问题的一句话摘要（不超过80字），必须包含具体数字",
    "insights": [
        {
            "dimension": "what_happened|why_happened|forecast|recommendation",
            "type": "trend|anomaly|comparison|kpi|recommendation",
            "title": "洞察标题（不超过15字）",
            "text": "详细分析（80-150字，必须包含：1个以上具体数字 + 业务归因 + 行业对标或环比变化）",
            "metric": "相关指标名称",
            "sentiment": "positive|negative|neutral",
            "importance": 1-10,
            "confidence": 0.5-1.0,
            "action_items": ["可执行建议1（含预期效果）", "可执行建议2"],
            "recommendation": "最优先的改进建议（含量化目标和时间框架）"
        }
    ],
    "risk_alerts": [
        {
            "title": "风险名称",
            "description": "风险描述（含影响金额或百分比）",
            "severity": "high|medium|low",
            "mitigation": "缓解措施（含预期效果）"
        }
    ],
    "opportunities": [
        {
            "title": "机会名称",
            "description": "机会描述",
            "potential_impact": "量化预期收益",
            "action_required": "落地步骤"
        }
    ],
    "sensitivity_analysis": [
        {
            "factor": "关键驱动因素名称",
            "current_value": "当前值（含单位）",
            "impact_description": "若该因素变动±10%，对整体的影响描述（含量化估算）"
        }
    ]
}""",
}

_RULES = {
    "small": (
        "## 写作要求\n"
        "1. 数字驱动：每条insight含1个具体数字\n"
        "2. insights 2-3条，覆盖 what_happened 和 recommendation\n"
        "3. risk_alerts 和 opportunities 各1条\n"
        "4. 使用中文，列名翻译为中文\n"
        "5. 严格JSON输出，不要附加Markdown或解释文字"
    ),
    "medium": (
        "## 写作铁律\n"
        "1. 数字驱动：每条insight至少1个具体数字\n"
        "2. 对比基准：有环比/同比/行业基准参照\n"
        "3. 因果归因：分析变化原因\n"
        "4. insights 3-4条，覆盖 what_happened / why_happened / recommendation\n"
        "5. risk_alerts 和 opportunities 各至少1条\n"
        "6. 列名翻译为中文\n"
        "7. 严格JSON输出，不要附加Markdown或解释文字"
    ),
    "large": (
        "## 写作铁律（违反任何一条即为不合格）\n\n"
        '1. **数字驱动**: 每条 insight 至少引用 1 个来自上方数据的具体数字。禁止「较高」「较低」「有所增长」等模糊表述。\n'
        '   - 反面：「毛利率较高」 / 正面：「毛利率32.5%，高于行业均值28%达4.5个百分点」\n'
        "2. **对比基准**: 每条分析必须有参照系 — 环比（上月/上期）、同比（去年同期）、行业基准、或目标值。\n"
        '3. **因果归因**: 不仅描述「是什么」，更要分析「为什么」。例：净利下降 → 因原料采购成本上涨 + 产能利用率不足。\n'
        "4. **建议落地**: 每条 recommendation 需含：做什么 + 预期效果 + 时间节点。\n"
        "5. **覆盖完整**: insights 至少4条，分别覆盖 what_happened / why_happened / forecast / recommendation。\n"
        "6. **risk_alerts** 至少1条，**opportunities** 至少1条。\n"
        '7. **列名翻译**: 将「2025-01-01」解读为「1月」，英文字段名翻译为中文。\n'
        "8. **精炼**: 每条 insight 的 text 控制在 80-150 字，executive_summary 不超过 80 字。\n"
        "9. **敏感性分析**: 识别2-3个关键驱动因素，输出sensitivity_analysis数组。\n"
        "10. 严格以JSON格式输出，不要附加任何Markdown标记或解释文字。"
    ),
}

_METHODOLOGY = (
    "## 分析方法论\n\n"
    "### 第一步：数据概览\n"
    "- 确认数据的时间跨度、样本量、关键指标列\n"
    "- 识别数据中的缺失值、异常值和极端值\n"
    "- 判断数据的季节性特征和周期性规律\n\n"
    "### 第二步：指标拆解\n"
    "- 使用杜邦分析法拆解利润率（利润率 = 净利/收入 = (收入-成本-费用)/收入）\n"
    "- 关键比率计算：毛利率、净利率、费用率、成本率、人效比\n"
    "- 环比分析：本期 vs 上期，计算绝对变化和相对变化率\n"
    "- 同比分析：本期 vs 去年同期，排除季节性干扰\n"
    "- 结构分析：各项占总额的百分比，识别结构性变化\n\n"
    "### 第三步：异常检测\n"
    "- 波动超过均值±2个标准差的指标视为异常\n"
    "- 连续3期单向变动（持续上升或下降）视为趋势信号\n"
    "- 占比突变超过5个百分点视为结构性变化\n"
    "- 负利润、负增长、成本倒挂等情况必须作为风险预警\n\n"
    "### 第四步：归因与建议\n"
    "- 每个发现必须有可能的原因分析（至少1个归因假设）\n"
    "- 建议按优先级排序：P0（立即执行）、P1（本月内）、P2（本季度内）\n"
    "- 建议须可量化：预期改善幅度、目标值、时间节点\n\n"
    "### 行业对标参考表\n"
    "| 行业 | 毛利率 | 净利率 | 费用率 | 库存周转(天) |\n"
    "|------|--------|--------|--------|-------------|\n"
    "| 食品加工(综合) | 15-35% | 3-8% | 15-25% | 30-90 |\n"
    "| 禽类加工 | 6-10% | 1-3% | 8-12% | 15-30 |\n"
    "| 乳制品 | 10-15% | 3-6% | 12-18% | 20-45 |\n"
    "| 预制菜 | 15-25% | 5-10% | 15-22% | 30-60 |\n"
    "| 调味品 | 35-43% | 10-18% | 18-28% | 60-120 |\n"
    "| 餐饮 | 55-65% | 8-15% | 35-50% | 7-15 |\n"
    "| 零售 | 20-30% | 2-5% | 18-25% | 30-60 |\n\n"
    "### 常见分析陷阱（必须避免）\n"
    "- 幸存者偏差：只看盈利月份忽略亏损月份，导致高估整体利润率\n"
    "- 基数效应：低基数月份同比增长率虚高（如去年1月收入5万，今年10万，同比+100%但绝对值仍低）\n"
    "- 指标孤立解读：毛利率提升但销量下降，可能是砍掉低毛利产品而非真正改善\n"
    "- 忽略季节性：食品行业Q1（春节）和Q4（年终备货）天然高于Q2/Q3，不可简单环比\n"
    "- 费用率计算口径不一：管理费用率和销售费用率分母是收入还是成本需保持一致\n"
)


def build_cacheable_system_prompt(tier: str, scenario: str) -> str:
    """Build a system prompt that includes static parts (role + schema + rules).

    DashScope explicit caching requires > 1024 tokens in the cached content.
    """
    role = get_scenario_system_role(scenario)
    benchmarks = get_scenario_benchmarks(scenario)
    output_schema = _OUTPUT_SCHEMAS.get(tier, _OUTPUT_SCHEMAS["large"])
    rules = _RULES.get(tier, _RULES["large"])

    return (
        f"{role}\n\n"
        f"分析场景：{scenario}\n"
        f"{benchmarks}\n\n"
        f"你的角色是管理层的智囊——用数据说话，给出CEO能直接采纳的建议。\n\n"
        f"{_METHODOLOGY}\n\n"
        f"## 输出格式（严格JSON）\n\n"
        f"{output_schema}\n\n"
        f"{rules}"
    )


# ---------------------------------------------------------------------------
# User prompt builder (data-only, no static parts)
# ---------------------------------------------------------------------------

def build_tiered_prompt(
    *,
    tier: str,
    scenario: str,
    benchmark_text: str,
    query_block: str,
    data_summary: str,
    financial_metrics: str,
    production_metrics: str,
    stat_digest: str,
    metrics_summary: str,
    excel_context: str,
    kb_context: str,
) -> str:
    """Build an LLM user prompt whose complexity scales with the data tier.

    Static parts (output schema + rules) live in the SYSTEM message via
    :func:`build_cacheable_system_prompt`.  This method returns only the
    DATA portion.
    """
    data_block = (
        f"## 数据概览\n{data_summary}\n\n"
        f"{financial_metrics}\n\n"
        f"{production_metrics}\n\n"
        f"{stat_digest}\n\n"
        f"{f'## 已计算指标{chr(10)}{metrics_summary}' if metrics_summary else ''}\n"
        f"{excel_context}\n"
        f"{kb_context}\n"
        f"{query_block}"
    )

    return f"请分析以下数据并输出JSON：\n\n{data_block}"
