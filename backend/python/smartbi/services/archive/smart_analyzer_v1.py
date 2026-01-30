"""
SmartBI 智能分析器

将导出的结构化数据自动识别、映射并执行智能分析。

工作流程:
1. 数据场景识别 - 判断数据属于什么业务场景（财务/销售/部门等）
2. 字段智能映射 - 将原始列名映射到标准分析字段
3. 分析方法推荐 - 基于数据特征推荐适合的分析
4. 执行分析 - 调用对应的分析服务
5. 洞察生成 - 生成业务洞察和建议
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum

import pandas as pd

logger = logging.getLogger(__name__)


class DataScenario(Enum):
    """数据业务场景"""
    PROFIT_STATEMENT = "profit_statement"      # 利润表
    BUDGET_REPORT = "budget_report"            # 预算报表
    SALES_DETAIL = "sales_detail"              # 销售明细
    DEPARTMENT_REPORT = "department_report"    # 部门报表
    COST_ANALYSIS = "cost_analysis"            # 成本分析
    RECEIVABLE_AGING = "receivable_aging"      # 应收账龄
    INVENTORY_REPORT = "inventory_report"      # 库存报表
    GENERAL_TABLE = "general_table"            # 通用表格
    UNKNOWN = "unknown"


@dataclass
class FieldMapping:
    """字段映射结果"""
    original_name: str          # 原始列名
    standard_name: str          # 标准字段名
    data_type: str              # 数据类型
    role: str                   # 字段角色: dimension, measure, time, category
    confidence: float = 1.0     # 映射置信度
    detected_by: str = "rule"   # 检测方式: rule, llm, manual


@dataclass
class ScenarioDetectionResult:
    """场景检测结果"""
    scenario: DataScenario
    confidence: float
    evidence: List[str]           # 检测依据
    sub_type: Optional[str] = None  # 子类型


@dataclass
class AnalysisRecommendation:
    """分析推荐"""
    analysis_type: str           # 分析类型
    method_name: str             # 方法名
    description: str             # 描述
    priority: int                # 优先级 (1=最高)
    required_fields: List[str]   # 需要的字段
    chart_type: str              # 推荐图表


@dataclass
class AnalysisResult:
    """分析结果"""
    success: bool
    analysis_type: str
    title: str
    data: Dict[str, Any]
    insights: List[str]          # 洞察
    warnings: List[str]          # 警告
    chart_config: Optional[Dict] = None  # 图表配置


@dataclass
class SmartAnalysisOutput:
    """智能分析完整输出"""
    scenario: ScenarioDetectionResult
    field_mappings: List[FieldMapping]
    recommendations: List[AnalysisRecommendation]
    analyses: List[AnalysisResult]
    summary: str
    processing_notes: List[str] = field(default_factory=list)


class ScenarioDetector:
    """
    数据场景检测器

    基于数据特征（列名、数据模式）判断业务场景
    """

    # 场景关键词配置
    SCENARIO_KEYWORDS = {
        DataScenario.PROFIT_STATEMENT: {
            "title": ["利润表", "损益表", "profit", "income statement", "p&l"],
            "columns": ["营业收入", "营业成本", "毛利", "净利润", "利润总额",
                       "revenue", "cost", "profit", "gross margin"],
            "patterns": ["一、营业收入", "二、营业成本", "三、毛利"]
        },
        DataScenario.BUDGET_REPORT: {
            "title": ["预算", "budget", "计划", "执行", "完成率"],
            "columns": ["预算数", "实际数", "完成率", "差异", "执行率",
                       "budget", "actual", "variance", "achievement"],
            "patterns": ["预算", "实际", "差异"]
        },
        DataScenario.SALES_DETAIL: {
            "title": ["销售", "订单", "sales", "order"],
            "columns": ["客户", "产品", "数量", "单价", "金额", "业务员",
                       "customer", "product", "quantity", "price", "amount"],
            "patterns": ["客户名称", "产品名称", "销售员"]
        },
        DataScenario.DEPARTMENT_REPORT: {
            "title": ["部门", "department", "团队", "组织"],
            "columns": ["部门", "人数", "业绩", "目标", "完成率",
                       "department", "headcount", "performance", "target"],
            "patterns": ["销售一部", "销售二部", "电商部"]
        },
        DataScenario.COST_ANALYSIS: {
            "title": ["成本", "cost", "费用", "expense"],
            "columns": ["原料", "人工", "制造费用", "折旧", "总成本",
                       "material", "labor", "overhead", "depreciation"],
            "patterns": ["直接成本", "间接成本", "成本构成"]
        }
    }

    def detect(
        self,
        metadata: Dict[str, Any],
        columns: List[Dict[str, Any]],
        sample_rows: List[Dict[str, Any]]
    ) -> ScenarioDetectionResult:
        """
        检测数据场景

        Args:
            metadata: 元信息（title, unit, period等）
            columns: 列定义
            sample_rows: 样本数据行

        Returns:
            ScenarioDetectionResult
        """
        scores = {}
        evidence_map = {}

        title = (metadata.get("title") or "").lower()
        column_names = [c.get("name", "").lower() for c in columns]

        # 提取样本数据中的文本值
        sample_texts = []
        for row in sample_rows[:10]:
            for v in row.values():
                if isinstance(v, str):
                    sample_texts.append(v.lower())

        for scenario, keywords in self.SCENARIO_KEYWORDS.items():
            score = 0
            evidences = []

            # 标题匹配
            for kw in keywords.get("title", []):
                if kw.lower() in title:
                    score += 3
                    evidences.append(f"标题包含'{kw}'")

            # 列名匹配
            for kw in keywords.get("columns", []):
                for col in column_names:
                    if kw.lower() in col:
                        score += 2
                        evidences.append(f"列名包含'{kw}'")
                        break

            # 数据模式匹配
            for pattern in keywords.get("patterns", []):
                for text in sample_texts:
                    if pattern.lower() in text:
                        score += 1
                        evidences.append(f"数据包含'{pattern}'")
                        break

            scores[scenario] = score
            evidence_map[scenario] = evidences

        # 找出最高分场景
        if scores:
            best_scenario = max(scores, key=scores.get)
            max_score = scores[best_scenario]

            if max_score > 0:
                # 计算置信度
                confidence = min(max_score / 10, 1.0)
                return ScenarioDetectionResult(
                    scenario=best_scenario,
                    confidence=confidence,
                    evidence=evidence_map[best_scenario][:5]
                )

        return ScenarioDetectionResult(
            scenario=DataScenario.GENERAL_TABLE,
            confidence=0.5,
            evidence=["未匹配到特定场景"]
        )


class FieldMapper:
    """
    字段智能映射器

    将原始列名映射到标准分析字段
    """

    # 标准字段定义
    STANDARD_FIELDS = {
        # 时间维度
        "date": {
            "candidates": ["日期", "时间", "月份", "年月", "date", "time", "period", "月", "年"],
            "role": "time",
            "data_type": "date"
        },
        # 财务指标
        "revenue": {
            "candidates": ["营业收入", "收入", "销售额", "销售收入", "revenue", "sales", "income"],
            "role": "measure",
            "data_type": "numeric"
        },
        "cost": {
            "candidates": ["营业成本", "成本", "总成本", "费用", "cost", "expense"],
            "role": "measure",
            "data_type": "numeric"
        },
        "profit": {
            "candidates": ["利润", "净利润", "毛利", "利润总额", "profit", "net income", "gross profit"],
            "role": "measure",
            "data_type": "numeric"
        },
        "budget": {
            "candidates": ["预算", "预算数", "计划", "budget", "planned", "target"],
            "role": "measure",
            "data_type": "numeric"
        },
        "actual": {
            "candidates": ["实际", "实际数", "执行", "actual", "realized"],
            "role": "measure",
            "data_type": "numeric"
        },
        # 销售相关
        "customer": {
            "candidates": ["客户", "客户名称", "customer", "client"],
            "role": "dimension",
            "data_type": "text"
        },
        "product": {
            "candidates": ["产品", "产品名称", "商品", "product", "item"],
            "role": "dimension",
            "data_type": "text"
        },
        "quantity": {
            "candidates": ["数量", "销量", "qty", "quantity", "units"],
            "role": "measure",
            "data_type": "numeric"
        },
        "price": {
            "candidates": ["单价", "价格", "price", "unit price"],
            "role": "measure",
            "data_type": "numeric"
        },
        "amount": {
            "candidates": ["金额", "销售额", "总额", "amount", "total"],
            "role": "measure",
            "data_type": "numeric"
        },
        # 组织维度
        "department": {
            "candidates": ["部门", "团队", "组织", "department", "team", "division"],
            "role": "dimension",
            "data_type": "text"
        },
        "salesperson": {
            "candidates": ["业务员", "销售员", "员工", "salesperson", "sales rep"],
            "role": "dimension",
            "data_type": "text"
        },
        # 项目/类别
        "category": {
            "candidates": ["项目", "类别", "分类", "category", "type", "item"],
            "role": "dimension",
            "data_type": "text"
        },
        # 比率
        "rate": {
            "candidates": ["完成率", "达成率", "比率", "百分比", "rate", "ratio", "%"],
            "role": "measure",
            "data_type": "percentage"
        }
    }

    def map_fields(
        self,
        columns: List[Dict[str, Any]],
        scenario: DataScenario
    ) -> List[FieldMapping]:
        """
        映射字段

        Args:
            columns: 列定义列表
            scenario: 数据场景

        Returns:
            List[FieldMapping]
        """
        mappings = []
        # 允许多个预算/实际列 (按月份等)
        multi_allowed = {"budget", "actual"}
        used_standards = set()
        budget_count = 0
        actual_count = 0

        for col in columns:
            col_name = col.get("name", "")
            col_name_lower = col_name.lower()
            original_name = col.get("original_name", col_name)
            data_type = col.get("data_type", "text")
            sub_type = col.get("sub_type")

            best_match = None
            best_confidence = 0

            # 先检查sub_type (支持多个预算/实际列)
            if sub_type == "budget":
                best_match = "budget"
                best_confidence = 0.95
                budget_count += 1
            elif sub_type == "actual":
                best_match = "actual"
                best_confidence = 0.95
                actual_count += 1

            # 基于列名检测预算/实际 (支持多列)
            if not best_match:
                if "预算" in col_name or "budget" in col_name_lower:
                    best_match = "budget"
                    best_confidence = 0.9
                    budget_count += 1
                elif "实际" in col_name or "actual" in col_name_lower:
                    best_match = "actual"
                    best_confidence = 0.9
                    actual_count += 1

            # 遍历标准字段寻找匹配 (排除已多次使用的字段)
            if not best_match:
                for std_name, std_def in self.STANDARD_FIELDS.items():
                    # 跳过已使用的单次字段
                    if std_name in used_standards and std_name not in multi_allowed:
                        continue

                    for candidate in std_def["candidates"]:
                        if candidate.lower() in col_name_lower or col_name_lower in candidate.lower():
                            confidence = 0.9 if candidate.lower() == col_name_lower else 0.7
                            if confidence > best_confidence:
                                best_match = std_name
                                best_confidence = confidence
                                break

            # 基于数据类型的默认映射
            role = "measure" if data_type == "numeric" else "dimension"
            if "日期" in col_name or "date" in col_name_lower:
                role = "time"
            elif "月" in col_name and data_type == "numeric":
                role = "measure"  # 月份数值列是度量

            mapping = FieldMapping(
                original_name=col_name,
                standard_name=best_match or col_name,
                data_type=data_type,
                role=role,
                confidence=best_confidence if best_match else 0.5,
                detected_by="rule"
            )

            mappings.append(mapping)

            if best_match and best_match not in multi_allowed:
                used_standards.add(best_match)

        return mappings


class AnalysisRecommender:
    """
    分析推荐器

    基于数据场景和可用字段推荐分析方法
    """

    # 场景-分析方法映射
    ANALYSIS_MATRIX = {
        DataScenario.PROFIT_STATEMENT: [
            {
                "type": "profit_trend",
                "method": "get_profit_trend",
                "description": "利润趋势分析",
                "required": ["revenue"],
                "optional": ["cost", "profit"],
                "chart": "line",
                "priority": 1
            },
            {
                "type": "cost_structure",
                "method": "get_cost_structure",
                "description": "成本结构分析",
                "required": ["cost"],
                "optional": [],
                "chart": "pie",
                "priority": 2
            },
            {
                "type": "yoy_comparison",
                "method": "get_yoy_mom_comparison",
                "description": "同比环比分析",
                "required": ["revenue", "date"],
                "optional": [],
                "chart": "bar_line",
                "priority": 3
            }
        ],
        DataScenario.BUDGET_REPORT: [
            {
                "type": "budget_vs_actual",
                "method": "get_budget_vs_actual",
                "description": "预算实际对比",
                "required": ["budget", "actual"],
                "optional": ["category"],
                "chart": "bar_comparison",
                "priority": 1
            },
            {
                "type": "budget_waterfall",
                "method": "get_budget_waterfall",
                "description": "预算瀑布图",
                "required": ["budget", "actual"],
                "optional": [],
                "chart": "waterfall",
                "priority": 2
            },
            {
                "type": "achievement_by_period",
                "method": "get_budget_achievement_by_period",
                "description": "预算完成率趋势",
                "required": ["budget", "actual", "date"],
                "optional": [],
                "chart": "line",
                "priority": 3
            }
        ],
        DataScenario.SALES_DETAIL: [
            {
                "type": "sales_kpis",
                "method": "get_sales_kpis",
                "description": "销售KPI概览",
                "required": ["amount"],
                "optional": ["quantity", "date"],
                "chart": "kpi_cards",
                "priority": 1
            },
            {
                "type": "product_ranking",
                "method": "get_product_ranking",
                "description": "产品销售排名",
                "required": ["product", "amount"],
                "optional": ["quantity"],
                "chart": "bar_horizontal",
                "priority": 2
            },
            {
                "type": "salesperson_ranking",
                "method": "get_salesperson_ranking",
                "description": "销售员排名",
                "required": ["salesperson", "amount"],
                "optional": [],
                "chart": "bar_horizontal",
                "priority": 3
            },
            {
                "type": "customer_analysis",
                "method": "get_customer_analysis",
                "description": "客户分析",
                "required": ["customer", "amount"],
                "optional": ["date"],
                "chart": "pie",
                "priority": 4
            }
        ],
        DataScenario.DEPARTMENT_REPORT: [
            {
                "type": "department_ranking",
                "method": "get_department_ranking",
                "description": "部门排名",
                "required": ["department"],
                "optional": ["amount", "budget"],
                "chart": "bar_horizontal",
                "priority": 1
            },
            {
                "type": "completion_rates",
                "method": "get_department_completion_rates",
                "description": "部门目标完成率",
                "required": ["department", "budget", "actual"],
                "optional": [],
                "chart": "bullet",
                "priority": 2
            }
        ],
        DataScenario.COST_ANALYSIS: [
            {
                "type": "cost_structure",
                "method": "get_cost_structure",
                "description": "成本结构分析",
                "required": ["category", "cost"],
                "optional": [],
                "chart": "pie",
                "priority": 1
            },
            {
                "type": "cost_trend",
                "method": "get_profit_trend",
                "description": "成本趋势分析",
                "required": ["cost", "date"],
                "optional": [],
                "chart": "line",
                "priority": 2
            }
        ]
    }

    def recommend(
        self,
        scenario: DataScenario,
        field_mappings: List[FieldMapping]
    ) -> List[AnalysisRecommendation]:
        """
        推荐分析方法

        Args:
            scenario: 数据场景
            field_mappings: 字段映射

        Returns:
            List[AnalysisRecommendation]
        """
        recommendations = []
        available_fields = {m.standard_name for m in field_mappings if m.confidence > 0.5}

        # 统计多值字段的数量
        field_counts = {}
        for m in field_mappings:
            if m.confidence > 0.5:
                field_counts[m.standard_name] = field_counts.get(m.standard_name, 0) + 1

        analysis_list = self.ANALYSIS_MATRIX.get(scenario, [])

        for analysis in analysis_list:
            required = set(analysis["required"])

            # 检查必需字段是否满足
            if required.issubset(available_fields):
                recommendations.append(AnalysisRecommendation(
                    analysis_type=analysis["type"],
                    method_name=analysis["method"],
                    description=analysis["description"],
                    priority=analysis["priority"],
                    required_fields=analysis["required"],
                    chart_type=analysis["chart"]
                ))

        # 如果有多个预算/实际列，添加特殊的预算分析
        if field_counts.get("budget", 0) >= 1 and field_counts.get("actual", 0) >= 1:
            if not any(r.analysis_type == "budget_vs_actual" for r in recommendations):
                recommendations.append(AnalysisRecommendation(
                    analysis_type="budget_vs_actual",
                    method_name="get_budget_vs_actual",
                    description="预算实际对比",
                    priority=1,
                    required_fields=["budget", "actual"],
                    chart_type="bar_comparison"
                ))

            if field_counts.get("budget", 0) >= 2:
                recommendations.append(AnalysisRecommendation(
                    analysis_type="budget_trend",
                    method_name="get_budget_achievement_by_period",
                    description="预算完成率趋势",
                    priority=2,
                    required_fields=["budget", "actual"],
                    chart_type="line"
                ))

        # 按优先级排序
        recommendations.sort(key=lambda x: x.priority)

        return recommendations


class InsightGenerator:
    """
    洞察生成器

    基于分析结果生成业务洞察
    """

    def generate_insights(
        self,
        analysis_type: str,
        data: Dict[str, Any],
        scenario: DataScenario
    ) -> Tuple[List[str], List[str]]:
        """
        生成洞察和警告

        Returns:
            (insights, warnings)
        """
        insights = []
        warnings = []

        if analysis_type == "budget_vs_actual":
            summary = data.get("summary", {})
            achievement = summary.get("overallAchievement", 0)
            variance = summary.get("totalVariance", 0)

            if achievement >= 100:
                insights.append(f"预算完成率达到 {achievement:.1f}%，超额完成目标")
            elif achievement >= 90:
                insights.append(f"预算完成率 {achievement:.1f}%，接近目标")
            else:
                warnings.append(f"预算完成率仅 {achievement:.1f}%，需关注")

            if variance < 0:
                warnings.append(f"存在预算缺口 {abs(variance):,.0f}，建议分析原因")

        elif analysis_type == "profit_trend":
            summary = data.get("summary", {})
            profit_margin = summary.get("avgProfitMargin", 0)

            if profit_margin > 20:
                insights.append(f"平均利润率 {profit_margin:.1f}%，盈利能力良好")
            elif profit_margin > 10:
                insights.append(f"平均利润率 {profit_margin:.1f}%，处于正常水平")
            else:
                warnings.append(f"平均利润率仅 {profit_margin:.1f}%，建议优化成本")

        elif analysis_type == "sales_kpis":
            total = data.get("totalSales", 0)
            order_count = data.get("orderCount", 0)
            aov = data.get("avgOrderValue", 0)

            insights.append(f"总销售额 {total:,.0f}，共 {order_count} 笔订单")
            if aov > 0:
                insights.append(f"平均订单金额 {aov:,.0f}")

        elif analysis_type in ["product_ranking", "salesperson_ranking"]:
            items = data.get("rankings", data.get("items", []))
            if items:
                top = items[0]
                name = top.get("name", top.get("product", top.get("salesperson", "第一名")))
                amount = top.get("amount", top.get("sales", 0))
                insights.append(f"排名第一: {name}，业绩 {amount:,.0f}")

        return insights, warnings


class SmartAnalyzer:
    """
    智能分析器主类

    整合所有组件，提供一站式分析能力

    Args:
        use_llm_scenario_detection: 是否使用 LLM 进行场景识别（默认 False）
                                   设置为 True 将使用 scenario_detector.py 中的
                                   LLMScenarioDetector 进行动态场景识别
    """

    def __init__(self, use_llm_scenario_detection: bool = False):
        self.use_llm_scenario_detection = use_llm_scenario_detection
        self.scenario_detector = ScenarioDetector()
        self.field_mapper = FieldMapper()
        self.recommender = AnalysisRecommender()
        self.insight_generator = InsightGenerator()
        self._llm_detector = None

    @property
    def llm_detector(self):
        """Lazy-load LLM scenario detector"""
        if self._llm_detector is None:
            from .scenario_detector import get_scenario_detector
            self._llm_detector = get_scenario_detector()
        return self._llm_detector

    async def detect_scenario_with_llm(
        self,
        metadata: Dict[str, Any],
        columns: List[Dict[str, Any]],
        sample_rows: List[Dict[str, Any]]
    ) -> Tuple[ScenarioDetectionResult, Any]:
        """
        使用 LLM 进行场景识别

        Args:
            metadata: 元信息
            columns: 列定义
            sample_rows: 样本数据

        Returns:
            Tuple of (legacy ScenarioDetectionResult, new ScenarioResult)
            ScenarioResult 包含更丰富的信息（维度、指标、推荐分析等）
        """
        from .scenario_detector import ScenarioResult as LLMScenarioResult

        # 提取列名
        col_names = [c.get("name", "") for c in columns]

        # 调用 LLM 场景检测
        llm_result = await self.llm_detector.detect(
            columns=col_names,
            sample_rows=sample_rows[:10],
            metadata=metadata
        )

        # 转换为旧格式以保持兼容
        legacy_result = self._convert_llm_to_legacy(llm_result)

        return legacy_result, llm_result

    def _convert_llm_to_legacy(self, llm_result) -> ScenarioDetectionResult:
        """将 LLM 结果转换为旧的 ScenarioDetectionResult 格式"""
        # 映射场景类型
        type_mapping = {
            "profit_statement": DataScenario.PROFIT_STATEMENT,
            "budget_report": DataScenario.BUDGET_REPORT,
            "sales_detail": DataScenario.SALES_DETAIL,
            "sales_summary": DataScenario.SALES_DETAIL,
            "department_performance": DataScenario.DEPARTMENT_REPORT,
            "department_report": DataScenario.DEPARTMENT_REPORT,
            "cost_analysis": DataScenario.COST_ANALYSIS,
            "receivable_aging": DataScenario.RECEIVABLE_AGING,
            "inventory_report": DataScenario.INVENTORY_REPORT,
        }

        scenario = type_mapping.get(
            llm_result.scenario_type,
            DataScenario.GENERAL_TABLE
        )

        return ScenarioDetectionResult(
            scenario=scenario,
            confidence=llm_result.confidence,
            evidence=[
                f"LLM识别: {llm_result.scenario_name}",
                f"方法: {llm_result.method}",
                f"维度: {', '.join(llm_result.dimensions[:3])}",
                f"指标: {', '.join(llm_result.measures[:3])}"
            ],
            sub_type=llm_result.scenario_type
        )

    async def analyze(
        self,
        exported_data: Dict[str, Any],
        max_analyses: int = 5,
        use_llm_detection: Optional[bool] = None
    ) -> SmartAnalysisOutput:
        """
        执行智能分析

        Args:
            exported_data: 导出的结构化数据
                - metadata: Dict
                - columns: List[Dict]
                - rows: List[Dict]
            max_analyses: 最大分析数量
            use_llm_detection: 是否使用 LLM 场景检测
                               None = 使用实例默认设置
                               True/False = 覆盖默认设置

        Returns:
            SmartAnalysisOutput
        """
        processing_notes = []

        metadata = exported_data.get("metadata", {})
        columns = exported_data.get("columns", [])
        rows = exported_data.get("rows", [])

        processing_notes.append(f"数据: {len(rows)} 行, {len(columns)} 列")

        # 决定是否使用 LLM 检测
        should_use_llm = use_llm_detection if use_llm_detection is not None else self.use_llm_scenario_detection

        # 1. 场景检测
        llm_scenario_result = None
        if should_use_llm:
            try:
                scenario_result, llm_scenario_result = await self.detect_scenario_with_llm(
                    metadata=metadata,
                    columns=columns,
                    sample_rows=rows[:20]
                )
                processing_notes.append(
                    f"场景(LLM): {llm_scenario_result.scenario_name} "
                    f"({llm_scenario_result.scenario_type}, 置信度: {llm_scenario_result.confidence:.2f})"
                )
                if llm_scenario_result.dimensions:
                    processing_notes.append(f"识别维度: {', '.join(llm_scenario_result.dimensions[:5])}")
                if llm_scenario_result.measures:
                    processing_notes.append(f"识别指标: {', '.join(llm_scenario_result.measures[:5])}")
            except Exception as e:
                logger.warning(f"LLM场景检测失败，回退到规则检测: {e}")
                scenario_result = self.scenario_detector.detect(
                    metadata=metadata,
                    columns=columns,
                    sample_rows=rows[:20]
                )
                processing_notes.append(f"场景(规则回退): {scenario_result.scenario.value} (置信度: {scenario_result.confidence:.2f})")
        else:
            scenario_result = self.scenario_detector.detect(
                metadata=metadata,
                columns=columns,
                sample_rows=rows[:20]
            )
            processing_notes.append(f"场景: {scenario_result.scenario.value} (置信度: {scenario_result.confidence:.2f})")

        # 2. 字段映射
        field_mappings = self.field_mapper.map_fields(
            columns=columns,
            scenario=scenario_result.scenario
        )

        mapped_count = sum(1 for m in field_mappings if m.confidence > 0.5)
        processing_notes.append(f"字段映射: {mapped_count}/{len(columns)} 个字段")

        # 3. 分析推荐
        recommendations = self.recommender.recommend(
            scenario=scenario_result.scenario,
            field_mappings=field_mappings
        )
        processing_notes.append(f"推荐分析: {len(recommendations)} 个")

        # 4. 执行分析
        analyses = []

        for rec in recommendations[:max_analyses]:
            try:
                result = await self._execute_analysis(
                    rec,
                    rows,
                    field_mappings,
                    scenario_result.scenario
                )
                if result:
                    analyses.append(result)
            except Exception as e:
                logger.error(f"Analysis {rec.analysis_type} failed: {e}")
                processing_notes.append(f"分析失败: {rec.analysis_type} - {str(e)}")

        # 5. 生成总结
        summary = self._generate_summary(
            scenario_result,
            analyses,
            metadata
        )

        return SmartAnalysisOutput(
            scenario=scenario_result,
            field_mappings=field_mappings,
            recommendations=recommendations,
            analyses=analyses,
            summary=summary,
            processing_notes=processing_notes
        )

    async def _execute_analysis(
        self,
        recommendation: AnalysisRecommendation,
        rows: List[Dict],
        field_mappings: List[FieldMapping],
        scenario: DataScenario
    ) -> Optional[AnalysisResult]:
        """执行单个分析"""

        # 创建字段名映射表
        field_map = {m.original_name: m.standard_name for m in field_mappings}
        reverse_map = {m.standard_name: m.original_name for m in field_mappings}

        # 转换数据为分析服务需要的格式
        converted_rows = []
        for row in rows:
            converted = {}
            for orig_name, value in row.items():
                std_name = field_map.get(orig_name, orig_name)
                converted[std_name] = value
            converted_rows.append(converted)

        # 根据分析类型执行
        analysis_type = recommendation.analysis_type

        if analysis_type == "budget_vs_actual":
            result = self._analyze_budget_vs_actual(converted_rows, reverse_map)
        elif analysis_type == "budget_trend":
            result = self._analyze_budget_trend(rows, field_mappings)
        elif analysis_type == "profit_trend":
            result = self._analyze_profit_trend(converted_rows, reverse_map)
        elif analysis_type == "sales_kpis":
            result = self._analyze_sales_kpis(converted_rows)
        elif analysis_type == "product_ranking":
            result = self._analyze_ranking(converted_rows, "product", "amount")
        elif analysis_type == "salesperson_ranking":
            result = self._analyze_ranking(converted_rows, "salesperson", "amount")
        elif analysis_type == "department_ranking":
            result = self._analyze_ranking(converted_rows, "department", "actual")
        elif analysis_type == "cost_structure":
            result = self._analyze_cost_structure(converted_rows)
        else:
            return None

        if not result:
            return None

        # 生成洞察
        insights, warnings = self.insight_generator.generate_insights(
            analysis_type, result, scenario
        )

        return AnalysisResult(
            success=True,
            analysis_type=analysis_type,
            title=recommendation.description,
            data=result,
            insights=insights,
            warnings=warnings,
            chart_config={"type": recommendation.chart_type}
        )

    def _analyze_budget_vs_actual(
        self,
        rows: List[Dict],
        reverse_map: Dict[str, str]
    ) -> Dict[str, Any]:
        """预算实际对比分析"""
        items = []
        total_budget = 0
        total_actual = 0

        # 查找预算和实际的列
        budget_cols = [k for k in (rows[0].keys() if rows else []) if "预算" in k or "budget" in k.lower()]
        actual_cols = [k for k in (rows[0].keys() if rows else []) if "实际" in k or "actual" in k.lower()]

        for row in rows:
            # 获取类别名（通常是第一列）
            category = None
            for k, v in row.items():
                if isinstance(v, str) and v:
                    category = v
                    break

            if not category:
                continue

            # 获取预算和实际值
            budget = 0
            actual = 0

            for col in budget_cols:
                val = row.get(col)
                if isinstance(val, (int, float)):
                    budget += val

            for col in actual_cols:
                val = row.get(col)
                if isinstance(val, (int, float)):
                    actual += val

            if budget > 0 or actual > 0:
                variance = actual - budget
                achievement = (actual / budget * 100) if budget > 0 else 0

                items.append({
                    "category": category,
                    "budget": budget,
                    "actual": actual,
                    "variance": variance,
                    "achievement": round(achievement, 1)
                })

                total_budget += budget
                total_actual += actual

        overall_achievement = (total_actual / total_budget * 100) if total_budget > 0 else 0

        return {
            "items": items,
            "summary": {
                "totalBudget": total_budget,
                "totalActual": total_actual,
                "totalVariance": total_actual - total_budget,
                "overallAchievement": round(overall_achievement, 1)
            }
        }

    def _analyze_budget_trend(
        self,
        rows: List[Dict],
        field_mappings: List[FieldMapping]
    ) -> Dict[str, Any]:
        """预算完成率趋势分析 (按月份)"""

        # 找出所有预算和实际列
        budget_cols = []
        actual_cols = []

        for m in field_mappings:
            if m.standard_name == "budget":
                budget_cols.append(m.original_name)
            elif m.standard_name == "actual":
                actual_cols.append(m.original_name)

        # 按月份配对
        periods = []
        achievements = []

        # 尝试从列名提取月份
        for i, (b_col, a_col) in enumerate(zip(sorted(budget_cols), sorted(actual_cols))):
            # 从列名提取月份
            period = f"期间{i+1}"
            for part in b_col.split("_"):
                if "月" in part:
                    period = part
                    break

            # 计算该月的总预算和实际
            total_budget = 0
            total_actual = 0

            for row in rows:
                b_val = row.get(b_col, 0)
                a_val = row.get(a_col, 0)

                if isinstance(b_val, (int, float)):
                    total_budget += b_val
                if isinstance(a_val, (int, float)):
                    total_actual += a_val

            if total_budget > 0:
                achievement = round(total_actual / total_budget * 100, 1)
            else:
                achievement = 0

            periods.append(period)
            achievements.append({
                "period": period,
                "budget": total_budget,
                "actual": total_actual,
                "achievement": achievement
            })

        # 计算累计
        cumulative = []
        cum_budget = 0
        cum_actual = 0

        for a in achievements:
            cum_budget += a["budget"]
            cum_actual += a["actual"]
            cum_achievement = round(cum_actual / cum_budget * 100, 1) if cum_budget > 0 else 0

            cumulative.append({
                "period": a["period"],
                "cumBudget": cum_budget,
                "cumActual": cum_actual,
                "cumAchievement": cum_achievement
            })

        return {
            "periods": periods,
            "monthly": achievements,
            "cumulative": cumulative,
            "summary": {
                "totalBudget": cum_budget,
                "totalActual": cum_actual,
                "overallAchievement": round(cum_actual / cum_budget * 100, 1) if cum_budget > 0 else 0,
                "periodCount": len(periods)
            }
        }

    def _analyze_profit_trend(
        self,
        rows: List[Dict],
        reverse_map: Dict[str, str]
    ) -> Dict[str, Any]:
        """利润趋势分析"""
        # 找出数值列
        numeric_cols = []
        if rows:
            for k, v in rows[0].items():
                if isinstance(v, (int, float)):
                    numeric_cols.append(k)

        # 尝试识别收入和成本列
        revenue_col = None
        cost_col = None

        for col in numeric_cols:
            col_lower = col.lower()
            if "收入" in col or "revenue" in col_lower or "sales" in col_lower:
                revenue_col = col
            elif "成本" in col or "cost" in col_lower:
                cost_col = col

        # 如果没找到，用前两个数值列
        if not revenue_col and numeric_cols:
            revenue_col = numeric_cols[0]
        if not cost_col and len(numeric_cols) > 1:
            cost_col = numeric_cols[1]

        periods = []
        revenues = []
        costs = []
        profits = []

        for i, row in enumerate(rows):
            # 获取期间（行号或日期）
            period = f"期间{i+1}"
            for k, v in row.items():
                if "日期" in k or "月" in k or "period" in k.lower():
                    period = str(v) if v else period
                    break

            rev = row.get(revenue_col, 0) or 0
            cost = row.get(cost_col, 0) or 0
            profit = rev - cost

            if rev > 0 or cost > 0:
                periods.append(period)
                revenues.append(rev)
                costs.append(cost)
                profits.append(profit)

        total_revenue = sum(revenues)
        total_cost = sum(costs)
        total_profit = sum(profits)
        avg_margin = (total_profit / total_revenue * 100) if total_revenue > 0 else 0

        return {
            "periods": periods,
            "revenue": revenues,
            "cost": costs,
            "profit": profits,
            "profitMargin": [
                round(p / r * 100, 1) if r > 0 else 0
                for p, r in zip(profits, revenues)
            ],
            "summary": {
                "totalRevenue": total_revenue,
                "totalCost": total_cost,
                "totalProfit": total_profit,
                "avgProfitMargin": round(avg_margin, 1)
            }
        }

    def _analyze_sales_kpis(self, rows: List[Dict]) -> Dict[str, Any]:
        """销售KPI分析"""
        total_sales = 0
        total_qty = 0
        order_count = len(rows)

        for row in rows:
            for k, v in row.items():
                if isinstance(v, (int, float)):
                    k_lower = k.lower()
                    if "金额" in k or "amount" in k_lower or "sales" in k_lower:
                        total_sales += v
                    elif "数量" in k or "qty" in k_lower or "quantity" in k_lower:
                        total_qty += v

        aov = total_sales / order_count if order_count > 0 else 0

        return {
            "totalSales": total_sales,
            "orderCount": order_count,
            "totalQuantity": total_qty,
            "avgOrderValue": round(aov, 2)
        }

    def _analyze_ranking(
        self,
        rows: List[Dict],
        group_by: str,
        value_field: str
    ) -> Dict[str, Any]:
        """排名分析"""
        aggregated = {}

        # 找到实际的列名
        group_col = None
        value_col = None

        if rows:
            for k in rows[0].keys():
                k_lower = k.lower()
                if group_by in k_lower or (group_by == "salesperson" and "业务员" in k):
                    group_col = k
                if "金额" in k or "amount" in k_lower or "实际" in k or "actual" in k_lower:
                    value_col = k

        if not group_col:
            group_col = list(rows[0].keys())[0] if rows else None

        for row in rows:
            name = row.get(group_col, "Unknown")
            if not name or not isinstance(name, str):
                continue

            value = 0
            if value_col:
                v = row.get(value_col, 0)
                if isinstance(v, (int, float)):
                    value = v
            else:
                # 累加所有数值
                for k, v in row.items():
                    if isinstance(v, (int, float)) and k != group_col:
                        value += v

            if name in aggregated:
                aggregated[name] += value
            else:
                aggregated[name] = value

        # 排序
        sorted_items = sorted(
            aggregated.items(),
            key=lambda x: x[1],
            reverse=True
        )

        rankings = [
            {"rank": i + 1, "name": name, "amount": amount}
            for i, (name, amount) in enumerate(sorted_items[:10])
        ]

        return {"rankings": rankings}

    def _analyze_cost_structure(self, rows: List[Dict]) -> Dict[str, Any]:
        """成本结构分析"""
        # 找出成本相关列
        cost_cols = {}

        if rows:
            for k in rows[0].keys():
                k_lower = k.lower()
                if any(kw in k_lower for kw in ["成本", "费用", "cost", "expense", "原料", "人工"]):
                    cost_cols[k] = 0

        # 累加
        for row in rows:
            for col in cost_cols:
                v = row.get(col, 0)
                if isinstance(v, (int, float)):
                    cost_cols[col] += v

        total = sum(cost_cols.values())

        items = [
            {
                "category": col,
                "amount": amount,
                "percentage": round(amount / total * 100, 1) if total > 0 else 0
            }
            for col, amount in sorted(cost_cols.items(), key=lambda x: -x[1])
        ]

        return {
            "items": items,
            "total": total
        }

    def _generate_summary(
        self,
        scenario: ScenarioDetectionResult,
        analyses: List[AnalysisResult],
        metadata: Dict[str, Any]
    ) -> str:
        """生成分析总结"""
        parts = []

        title = metadata.get("title", "数据")
        parts.append(f"**{title}** 智能分析报告")
        parts.append(f"\n数据场景: {scenario.scenario.value}")

        if analyses:
            parts.append(f"\n共完成 {len(analyses)} 项分析:")

            for analysis in analyses:
                parts.append(f"\n### {analysis.title}")

                if analysis.insights:
                    for insight in analysis.insights:
                        parts.append(f"- {insight}")

                if analysis.warnings:
                    for warning in analysis.warnings:
                        parts.append(f"- ⚠️ {warning}")

        return "\n".join(parts)


# ============================================================
# 便捷函数
# ============================================================

async def analyze_exported_data(
    exported_data: Dict[str, Any],
    max_analyses: int = 5
) -> SmartAnalysisOutput:
    """
    分析导出的数据

    Args:
        exported_data: DataExporter 导出的数据
        max_analyses: 最大分析数量

    Returns:
        SmartAnalysisOutput
    """
    analyzer = SmartAnalyzer()
    return await analyzer.analyze(exported_data, max_analyses)


def detect_scenario(
    metadata: Dict[str, Any],
    columns: List[Dict[str, Any]],
    sample_rows: List[Dict[str, Any]]
) -> ScenarioDetectionResult:
    """检测数据场景"""
    detector = ScenarioDetector()
    return detector.detect(metadata, columns, sample_rows)


def map_fields(
    columns: List[Dict[str, Any]],
    scenario: DataScenario
) -> List[FieldMapping]:
    """映射字段"""
    mapper = FieldMapper()
    return mapper.map_fields(columns, scenario)
