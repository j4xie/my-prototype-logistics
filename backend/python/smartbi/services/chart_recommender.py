from __future__ import annotations
"""
Chart Recommender Service

Uses LLM to intelligently recommend charts based on data features and business scenarios.
Implements "LLM detection + result cache" pattern (Mode B) for efficiency.

Features:
1. LLM-powered chart recommendations
2. Structure-based caching to reduce API calls
3. Fallback to minimal rule-based recommendations
"""
import hashlib
import logging
import json
import re
import time
from typing import Any, Optional, List, Dict
from dataclasses import dataclass, asdict, field
from enum import Enum

import httpx

from config import get_settings
from services.utils.json_parser import robust_json_parse

logger = logging.getLogger(__name__)


class ChartCategory(str, Enum):
    """Chart category for grouping recommendations"""
    TREND = "trend"           # Time series analysis
    COMPARISON = "comparison" # Categorical comparison
    PROPORTION = "proportion" # Part-to-whole
    DISTRIBUTION = "distribution"  # Data distribution
    RELATIONSHIP = "relationship"  # Correlation
    FLOW = "flow"             # Process/flow analysis
    KPI = "kpi"               # Single value metrics
    HIERARCHY = "hierarchy"   # Hierarchical data


@dataclass
class ChartRecommendation:
    """
    LLM-generated chart recommendation.

    Attributes:
        chart_type: Type of chart (line, bar, pie, etc.)
        title: Suggested chart title
        reason: Why this chart is recommended
        x_axis: Field name for X-axis
        y_axis: Field name(s) for Y-axis
        series: Field name for series grouping (optional)
        priority: Recommendation priority (1=highest)
        category: Chart category for grouping
        confidence: LLM confidence score (0-1)
        config_hints: Additional configuration hints
    """
    chart_type: str
    title: str
    reason: str
    x_axis: Optional[str] = None
    y_axis: Optional[List[str]] = None
    series: Optional[str] = None
    priority: int = 1
    category: str = "comparison"
    confidence: float = 0.8
    config_hints: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return asdict(self)


@dataclass
class DataSummary:
    """
    Summary of data for chart recommendation.

    Attributes:
        columns: List of column definitions with name, type, sample values
        row_count: Number of data rows
        dimensions: Identified dimension fields (time, category, etc.)
        measures: Identified measure fields (numeric values)
        time_columns: Fields identified as time-related
        category_columns: Fields identified as categorical
    """
    columns: List[Dict[str, Any]]
    row_count: int = 0
    dimensions: List[str] = field(default_factory=list)
    measures: List[str] = field(default_factory=list)
    time_columns: List[str] = field(default_factory=list)
    category_columns: List[str] = field(default_factory=list)

    @classmethod
    def from_feature_results(cls, features: List[Dict], row_count: int = 0) -> "DataSummary":
        """
        Create DataSummary from DataFeatureResult list.

        Args:
            features: List of column feature dictionaries
            row_count: Number of data rows
        """
        dimensions = []
        measures = []
        time_columns = []
        category_columns = []

        for f in features:
            col_name = f.get("columnName", f.get("column_name", ""))
            data_type = f.get("dataType", f.get("data_type", "TEXT"))

            if data_type == "DATE":
                dimensions.append(col_name)
                time_columns.append(col_name)
            elif data_type == "NUMERIC":
                measures.append(col_name)
            elif data_type == "CATEGORICAL":
                dimensions.append(col_name)
                category_columns.append(col_name)
            elif data_type == "ID":
                dimensions.append(col_name)

        return cls(
            columns=features,
            row_count=row_count,
            dimensions=dimensions,
            measures=measures,
            time_columns=time_columns,
            category_columns=category_columns
        )


@dataclass
class ChartCacheEntry:
    """Cache entry for chart recommendations"""
    cache_key: str
    recommendations: List[ChartRecommendation]
    scenario: str
    created_at: float
    accessed_at: float
    access_count: int = 1


class ChartRecommendationCache:
    """
    Cache for chart recommendation results (Mode B).

    Uses data structure signature for cache keys,
    allowing same-structure data to reuse recommendation results.
    """

    def __init__(self, ttl_seconds: int = 3600, max_entries: int = 500):
        self._cache: Dict[str, ChartCacheEntry] = {}
        self._ttl_seconds = ttl_seconds
        self._max_entries = max_entries

    def _generate_cache_key(
        self,
        data_summary: DataSummary,
        scenario: str,
        user_intent: Optional[str] = None
    ) -> str:
        """
        Generate cache key from data structure and scenario.

        Key is based on:
        - Column names and types
        - Time/category/measure dimensions
        - Business scenario
        - User intent (if provided)
        """
        # Build signature from data structure
        col_names = sorted([
            c.get("columnName", c.get("column_name", ""))
            for c in data_summary.columns
        ])
        col_types = sorted([
            c.get("dataType", c.get("data_type", ""))
            for c in data_summary.columns
        ])

        signature_parts = [
            "|".join(col_names[:20]),
            "|".join(col_types[:20]),
            "|".join(sorted(data_summary.time_columns[:5])),
            "|".join(sorted(data_summary.category_columns[:5])),
            "|".join(sorted(data_summary.measures[:5])),
            scenario,
            user_intent or ""
        ]

        signature = "||".join(signature_parts)
        return hashlib.md5(signature.encode()).hexdigest()[:16]

    def get(
        self,
        data_summary: DataSummary,
        scenario: str,
        user_intent: Optional[str] = None
    ) -> Optional[List[ChartRecommendation]]:
        """Get cached recommendations if available."""
        cache_key = self._generate_cache_key(data_summary, scenario, user_intent)
        entry = self._cache.get(cache_key)

        if entry is None:
            return None

        # Check TTL
        if time.time() - entry.created_at > self._ttl_seconds:
            del self._cache[cache_key]
            return None

        # Update access stats
        entry.accessed_at = time.time()
        entry.access_count += 1

        logger.debug(f"Chart recommendation cache hit: {cache_key}")
        return entry.recommendations

    def set(
        self,
        data_summary: DataSummary,
        scenario: str,
        recommendations: List[ChartRecommendation],
        user_intent: Optional[str] = None
    ) -> str:
        """Cache chart recommendations."""
        cache_key = self._generate_cache_key(data_summary, scenario, user_intent)

        entry = ChartCacheEntry(
            cache_key=cache_key,
            recommendations=recommendations,
            scenario=scenario,
            created_at=time.time(),
            accessed_at=time.time()
        )

        self._cache[cache_key] = entry

        # Evict old entries if needed
        if len(self._cache) > self._max_entries:
            self._evict_old_entries()

        logger.debug(f"Chart recommendations cached: {cache_key}")
        return cache_key

    def _evict_old_entries(self):
        """Remove oldest entries when cache is full."""
        if len(self._cache) <= self._max_entries:
            return

        sorted_keys = sorted(
            self._cache.keys(),
            key=lambda k: self._cache[k].accessed_at
        )

        to_remove = max(1, len(sorted_keys) // 10)
        for key in sorted_keys[:to_remove]:
            del self._cache[key]

        logger.debug(f"Evicted {to_remove} old chart cache entries")

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        now = time.time()
        active = [e for e in self._cache.values()
                  if now - e.created_at < self._ttl_seconds]

        return {
            "total_entries": len(self._cache),
            "active_entries": len(active),
            "total_hits": sum(e.access_count - 1 for e in self._cache.values())
        }

    def clear(self):
        """Clear all cache entries."""
        self._cache.clear()
        logger.info("Chart recommendation cache cleared")


class ChartRecommender:
    """
    LLM-based chart recommender service.

    Uses LLM to analyze data features and business scenarios to recommend
    the most suitable chart types. Does not use hardcoded rule mappings.
    """

    # Available chart types with descriptions for LLM context
    CHART_TYPES = {
        "line": {
            "name": "折线图",
            "description": "展示数据随时间或顺序的变化趋势",
            "best_for": ["时间序列", "趋势分析", "多系列对比"],
            "requires": {"x_axis": True, "y_axis": True}
        },
        "bar": {
            "name": "柱状图",
            "description": "对比不同类别的数值大小",
            "best_for": ["分类对比", "排名", "分组比较"],
            "requires": {"x_axis": True, "y_axis": True}
        },
        "bar_horizontal": {
            "name": "水平柱状图",
            "description": "适合长标签的分类对比",
            "best_for": ["长标签对比", "排名展示"],
            "requires": {"x_axis": True, "y_axis": True}
        },
        "pie": {
            "name": "饼图",
            "description": "展示各部分占总体的比例",
            "best_for": ["占比分析", "构成分析"],
            "requires": {"x_axis": True, "y_axis": True},
            "constraints": "类别数建议不超过8个"
        },
        "donut": {
            "name": "环形图",
            "description": "饼图变体，中心可显示汇总信息",
            "best_for": ["占比分析", "KPI展示"],
            "requires": {"x_axis": True, "y_axis": True}
        },
        "area": {
            "name": "面积图",
            "description": "展示累计趋势和整体变化",
            "best_for": ["累计趋势", "堆叠对比"],
            "requires": {"x_axis": True, "y_axis": True}
        },
        "scatter": {
            "name": "散点图",
            "description": "展示两个变量之间的相关性",
            "best_for": ["相关性分析", "异常检测", "分布分析"],
            "requires": {"x_axis": True, "y_axis": True}
        },
        "heatmap": {
            "name": "热力图",
            "description": "展示二维数据的分布强度",
            "best_for": ["交叉分析", "密度分布", "时间热力"],
            "requires": {"x_axis": True, "y_axis": True, "series": True}
        },
        "waterfall": {
            "name": "瀑布图",
            "description": "展示数据的增减变化过程",
            "best_for": ["财务分析", "增减分析", "成本构成"],
            "requires": {"x_axis": True, "y_axis": True}
        },
        "radar": {
            "name": "雷达图",
            "description": "多维度对比分析",
            "best_for": ["多维对比", "能力评估", "均衡分析"],
            "requires": {"y_axis": True},
            "constraints": "维度数建议3-8个"
        },
        "funnel": {
            "name": "漏斗图",
            "description": "展示转化过程的阶段数据",
            "best_for": ["转化分析", "流程效率", "销售漏斗"],
            "requires": {"x_axis": True, "y_axis": True}
        },
        "gauge": {
            "name": "仪表盘",
            "description": "展示单一KPI的达成情况",
            "best_for": ["KPI展示", "目标达成", "进度监控"],
            "requires": {"y_axis": True}
        },
        "treemap": {
            "name": "矩形树图",
            "description": "展示层级数据的占比关系",
            "best_for": ["层级占比", "空间利用", "分类构成"],
            "requires": {"x_axis": True, "y_axis": True}
        },
        "sunburst": {
            "name": "旭日图",
            "description": "展示层级数据的嵌套结构",
            "best_for": ["层级结构", "多级分类", "组织架构"],
            "requires": {"x_axis": True, "y_axis": True}
        },
        "pareto": {
            "name": "帕累托图",
            "description": "80/20分析，找出主要因素",
            "best_for": ["80/20分析", "问题诊断", "优先级排序"],
            "requires": {"x_axis": True, "y_axis": True}
        },
        "dual_axis": {
            "name": "双Y轴图",
            "description": "不同量纲指标的对比分析",
            "best_for": ["多指标对比", "不同量纲", "趋势关联"],
            "requires": {"x_axis": True, "y_axis": True}
        },
        "bullet": {
            "name": "子弹图",
            "description": "目标与实际值对比",
            "best_for": ["目标达成", "KPI对比", "进度条"],
            "requires": {"x_axis": True, "y_axis": True}
        },
        "sankey": {
            "name": "桑基图",
            "description": "展示流量或能量的流向",
            "best_for": ["流向分析", "转化路径", "资源分配"],
            "requires": {"x_axis": True, "y_axis": True}
        },
        "combination": {
            "name": "组合图",
            "description": "柱状图和折线图的组合",
            "best_for": ["多指标趋势", "对比与趋势结合"],
            "requires": {"x_axis": True, "y_axis": True}
        },
        "nested_donut": {
            "name": "嵌套环形图",
            "description": "多层级的环形图",
            "best_for": ["多层级占比", "分类嵌套"],
            "requires": {"x_axis": True, "y_axis": True, "series": True}
        }
    }

    # Business scenarios for context
    SCENARIOS = {
        "sales": "销售分析 - 关注收入、订单、客户、产品、地区等",
        "finance": "财务分析 - 关注利润、成本、预算、现金流等",
        "marketing": "营销分析 - 关注转化、获客、ROI、渠道效果等",
        "operations": "运营分析 - 关注效率、产能、库存、周转等",
        "hr": "人力资源 - 关注人员、绩效、成本、流动等",
        "general": "通用分析 - 数据探索和趋势分析"
    }

    def __init__(self):
        self.settings = get_settings()
        self.client = httpx.AsyncClient(timeout=60.0)
        self._cache = ChartRecommendationCache(ttl_seconds=3600, max_entries=500)

    async def recommend(
        self,
        data_summary: DataSummary | Dict[str, Any],
        scenario: str = "general",
        user_intent: Optional[str] = None,
        max_recommendations: int = 5,
        use_cache: bool = True
    ) -> List[ChartRecommendation]:
        """
        Use LLM to recommend the best chart types for the given data.

        Implements Mode B: LLM detection + result cache
        - Check cache first (same structure → same recommendations)
        - If no cache, call LLM and cache the result

        Args:
            data_summary: Summary of data features (DataSummary or dict)
            scenario: Business scenario (sales, finance, marketing, etc.)
            user_intent: Optional user-specified analysis intent
            max_recommendations: Maximum number of recommendations to return
            use_cache: Whether to use cached results (default: True)

        Returns:
            List of ChartRecommendation sorted by priority
        """
        # Convert dict to DataSummary if needed
        if isinstance(data_summary, dict):
            data_summary = DataSummary(
                columns=data_summary.get("columns", []),
                row_count=data_summary.get("row_count", 0),
                dimensions=data_summary.get("dimensions", []),
                measures=data_summary.get("measures", []),
                time_columns=data_summary.get("time_columns", []),
                category_columns=data_summary.get("category_columns", [])
            )

        # 1. Check cache (Mode B: result cache)
        if use_cache:
            cached = self._cache.get(data_summary, scenario, user_intent)
            if cached:
                logger.info(f"Using cached chart recommendations")
                return cached[:max_recommendations]

        # 2. Fallback if no LLM configured
        if not self.settings.llm_api_key:
            logger.warning("LLM API key not configured, using minimal fallback")
            recommendations = self._minimal_fallback(data_summary, scenario)
            if use_cache:
                self._cache.set(data_summary, scenario, recommendations, user_intent)
            return recommendations

        # 3. Call LLM for new recommendations
        prompt = self._build_recommendation_prompt(
            data_summary, scenario, user_intent, max_recommendations
        )

        try:
            response = await self._call_llm(prompt)
            recommendations = self._parse_llm_response(response, data_summary)

            # Sort by priority and limit
            recommendations.sort(key=lambda x: x.priority)
            recommendations = recommendations[:max_recommendations]

            # 4. Cache the result
            if use_cache and recommendations:
                self._cache.set(data_summary, scenario, recommendations, user_intent)
                logger.info(f"Cached {len(recommendations)} chart recommendations")

            return recommendations

        except Exception as e:
            logger.error(f"LLM recommendation failed: {e}", exc_info=True)
            return self._minimal_fallback(data_summary, scenario)

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return self._cache.get_stats()

    def clear_cache(self):
        """Clear the recommendation cache."""
        self._cache.clear()

    async def recommend_for_question(
        self,
        question: str,
        data_summary: DataSummary | Dict[str, Any],
        scenario: str = "general"
    ) -> List[ChartRecommendation]:
        """
        Recommend charts based on a natural language question.

        Args:
            question: User's analysis question
            data_summary: Summary of available data
            scenario: Business scenario

        Returns:
            List of ChartRecommendation tailored to the question
        """
        return await self.recommend(
            data_summary=data_summary,
            scenario=scenario,
            user_intent=question
        )

    async def recommend_combination(
        self,
        data_summary: DataSummary | Dict[str, Any],
        scenario: str = "general",
        dashboard_layout: str = "2x2"
    ) -> Dict[str, Any]:
        """
        Recommend a combination of charts for a dashboard.

        Args:
            data_summary: Summary of data features
            scenario: Business scenario
            dashboard_layout: Dashboard layout (e.g., "2x2", "1+3", "3x2")

        Returns:
            Dashboard recommendation with layout and charts
        """
        if isinstance(data_summary, dict):
            data_summary = DataSummary(
                columns=data_summary.get("columns", []),
                row_count=data_summary.get("row_count", 0),
                dimensions=data_summary.get("dimensions", []),
                measures=data_summary.get("measures", []),
                time_columns=data_summary.get("time_columns", []),
                category_columns=data_summary.get("category_columns", [])
            )

        if not self.settings.llm_api_key:
            return self._minimal_dashboard_fallback(data_summary, dashboard_layout)

        prompt = self._build_dashboard_prompt(data_summary, scenario, dashboard_layout)

        try:
            response = await self._call_llm(prompt)
            return self._parse_dashboard_response(response, data_summary, dashboard_layout)
        except Exception as e:
            logger.error(f"Dashboard recommendation failed: {e}")
            return self._minimal_dashboard_fallback(data_summary, dashboard_layout)

    def _build_recommendation_prompt(
        self,
        data_summary: DataSummary,
        scenario: str,
        user_intent: Optional[str],
        max_recommendations: int
    ) -> str:
        """Build the LLM prompt for chart recommendation"""

        # Build column descriptions
        columns_desc = []
        for col in data_summary.columns:
            col_name = col.get("columnName", col.get("column_name", "unknown"))
            data_type = col.get("dataType", col.get("data_type", "TEXT"))
            sub_type = col.get("numericSubType", col.get("numeric_sub_type", ""))
            samples = col.get("sampleValues", col.get("sample_values", []))[:3]

            desc = f"  - {col_name}: 类型={data_type}"
            if sub_type:
                desc += f", 子类型={sub_type}"
            if samples:
                desc += f", 示例={samples}"
            columns_desc.append(desc)

        columns_text = "\n".join(columns_desc) if columns_desc else "  (无列信息)"

        # Build chart types reference
        chart_types_ref = []
        for chart_id, info in self.CHART_TYPES.items():
            chart_types_ref.append(f"  - {chart_id}: {info['name']} - {info['description']}")
        chart_types_text = "\n".join(chart_types_ref)

        # Get scenario description
        scenario_desc = self.SCENARIOS.get(scenario, self.SCENARIOS["general"])

        prompt = f"""作为专业数据分析师，请根据以下数据特征推荐最合适的图表类型。

## 数据特征

**列信息:**
{columns_text}

**数据概览:**
- 数据行数: {data_summary.row_count} 行
- 时间维度: {data_summary.time_columns or '无'}
- 分类维度: {data_summary.category_columns or '无'}
- 度量指标: {data_summary.measures or '无'}

**业务场景:** {scenario_desc}

{f'**用户需求:** {user_intent}' if user_intent else ''}

## 可用图表类型

{chart_types_text}

## 任务

请推荐最多 {max_recommendations} 个最适合的图表类型。对于每个推荐：
1. 选择最能展示数据价值的图表类型
2. 明确指定 X轴、Y轴 和系列字段
3. 给出具体的推荐理由
4. 设置优先级 (1=最推荐)

## 输出格式

请返回 JSON 格式：
```json
{{
    "recommendations": [
        {{
            "chart_type": "图表类型ID",
            "title": "推荐的图表标题",
            "reason": "推荐理由（说明为什么这个图表类型最适合展示这些数据）",
            "x_axis": "X轴字段名",
            "y_axis": ["Y轴字段名列表"],
            "series": "系列分组字段（可选，null表示无）",
            "priority": 1,
            "category": "trend/comparison/proportion/distribution/relationship/flow/kpi/hierarchy",
            "confidence": 0.9,
            "config_hints": {{}}
        }}
    ],
    "analysis_summary": "数据分析总结和图表组合建议"
}}
```

注意：
- 不要推荐数据不支持的图表类型（如没有时间维度就不推荐折线图）
- 优先推荐能直观展示业务洞察的图表
- 考虑数据量和类别数量的限制
"""
        return prompt

    def _build_dashboard_prompt(
        self,
        data_summary: DataSummary,
        scenario: str,
        layout: str
    ) -> str:
        """Build prompt for dashboard recommendation"""

        # Parse layout to get chart count
        if layout == "2x2":
            chart_count = 4
        elif layout == "1+3":
            chart_count = 4
        elif layout == "3x2":
            chart_count = 6
        else:
            chart_count = 4

        base_prompt = self._build_recommendation_prompt(
            data_summary, scenario, None, chart_count
        )

        dashboard_instruction = f"""
## 附加要求：仪表板布局

请为 {layout} 布局的仪表板推荐图表组合：
- 图表之间应该互补，覆盖不同的分析角度
- 第一个图表应该展示最重要的 KPI 或趋势
- 避免重复使用相同类型的图表
- 考虑视觉平衡和信息层次

在 JSON 输出中增加:
```json
{{
    "dashboard": {{
        "layout": "{layout}",
        "positions": [
            {{"chart_index": 0, "position": "左上/main", "size": "large/medium/small"}}
        ],
        "theme_suggestion": "推荐的配色主题"
    }}
}}
```
"""
        return base_prompt + dashboard_instruction

    async def _call_llm(self, prompt: str) -> str:
        """Call LLM API"""
        headers = {
            "Authorization": f"Bearer {self.settings.llm_api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.settings.llm_model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是专业的数据可视化分析师，擅长根据数据特征推荐最佳图表类型。"
                        "你的推荐应该基于数据的实际特征，而不是固定规则。"
                        "请用 JSON 格式回复，确保字段名和值都正确。"
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.3,
            "max_tokens": 2500
        }

        response = await self.client.post(
            f"{self.settings.llm_base_url}/chat/completions",
            headers=headers,
            json=payload
        )
        response.raise_for_status()

        result = response.json()
        return result["choices"][0]["message"]["content"]

    def _validate_column_name(
        self,
        column: Optional[str],
        actual_columns: List[str],
        fallback_columns: List[str]
    ) -> Optional[str]:
        """
        Validate and resolve column name from LLM response.

        Args:
            column: Column name from LLM
            actual_columns: Actual columns in the data
            fallback_columns: Fallback columns to use if not found

        Returns:
            Valid column name or None
        """
        if column is None:
            return fallback_columns[0] if fallback_columns else None

        # 1. Exact match
        if column in actual_columns:
            return column

        # 2. Case-insensitive match
        column_lower = column.lower()
        for col in actual_columns:
            if col.lower() == column_lower:
                return col

        # 3. Partial match
        for col in actual_columns:
            if column_lower in col.lower() or col.lower() in column_lower:
                return col

        # 4. Return fallback
        logger.warning(f"Column '{column}' not found, using fallback")
        return fallback_columns[0] if fallback_columns else None

    def _parse_llm_response(
        self,
        response: str,
        data_summary: DataSummary
    ) -> List[ChartRecommendation]:
        """Parse LLM response into ChartRecommendation objects"""
        try:
            # Fix: Use centralized robust JSON parser
            result = robust_json_parse(response, fallback={})
            if not result:
                logger.warning("Could not extract JSON from LLM response")
                return self._minimal_fallback(data_summary, "general")
            recommendations = []

            # Get actual column names for validation
            actual_columns = [
                c.get("columnName", c.get("column_name", ""))
                for c in data_summary.columns
            ]

            for rec in result.get("recommendations", []):
                # Validate chart type
                chart_type = rec.get("chart_type", "bar")
                if chart_type not in self.CHART_TYPES:
                    logger.warning(f"Unknown chart type: {chart_type}, using 'bar'")
                    chart_type = "bar"

                # Validate and resolve x_axis
                x_axis_raw = rec.get("x_axis", rec.get("xAxis"))
                x_axis = self._validate_column_name(
                    x_axis_raw,
                    actual_columns,
                    data_summary.dimensions or data_summary.category_columns
                )

                # Validate and resolve y_axis
                y_axis_raw = rec.get("y_axis", rec.get("yAxis", []))
                if isinstance(y_axis_raw, str):
                    y_axis_raw = [y_axis_raw]

                y_axis = []
                for y in y_axis_raw:
                    resolved = self._validate_column_name(y, actual_columns, data_summary.measures)
                    if resolved:
                        y_axis.append(resolved)

                # If no y_axis resolved, use measures as fallback
                if not y_axis and data_summary.measures:
                    y_axis = data_summary.measures[:2]

                # Validate series field
                series_raw = rec.get("series")
                series = self._validate_column_name(
                    series_raw,
                    actual_columns,
                    []  # No fallback for series
                ) if series_raw else None

                recommendation = ChartRecommendation(
                    chart_type=chart_type,
                    title=rec.get("title", "数据分析"),
                    reason=rec.get("reason", "LLM 推荐"),
                    x_axis=x_axis,
                    y_axis=y_axis if y_axis else None,
                    series=series,
                    priority=rec.get("priority", 1),
                    category=rec.get("category", "comparison"),
                    confidence=rec.get("confidence", 0.8),
                    config_hints=rec.get("config_hints", {})
                )
                recommendations.append(recommendation)

            if not recommendations:
                logger.warning("LLM returned no recommendations, using fallback")
                return self._minimal_fallback(data_summary, "general")

            return recommendations

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            logger.debug(f"Response was: {response[:500]}...")
            return self._minimal_fallback(data_summary, "general")
        except Exception as e:
            logger.error(f"Failed to parse LLM response: {e}")
            logger.debug(f"Response was: {response[:500]}...")
            return self._minimal_fallback(data_summary, "general")

    def _robust_json_extract(self, text: str) -> Optional[str]:
        """
        Robustly extract JSON from LLM response.

        Handles:
        - JSON in code blocks
        - Unterminated strings
        - Extra commas
        - Missing quotes

        Args:
            text: Raw LLM response text

        Returns:
            Cleaned JSON string or None if extraction fails
        """
        # 1. Try to extract from code blocks
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            parts = text.split("```")
            if len(parts) >= 2:
                text = parts[1]

        # 2. Find JSON object boundaries
        json_start = text.find('{')
        json_end = text.rfind('}')

        if json_start < 0 or json_end < json_start:
            return None

        json_str = text[json_start:json_end + 1]

        # 3. Try to fix common issues
        # Remove trailing commas before } or ]
        json_str = re.sub(r',\s*([\}\]])', r'\1', json_str)

        # Try to validate the JSON
        try:
            json.loads(json_str)
            return json_str
        except json.JSONDecodeError:
            pass

        # 4. Try truncating at last valid closing brace
        depth = 0
        last_valid_pos = -1
        in_string = False
        escape_next = False

        for i, char in enumerate(json_str):
            if escape_next:
                escape_next = False
                continue
            if char == '\\':
                escape_next = True
                continue
            if char == '"' and not escape_next:
                in_string = not in_string
                continue
            if in_string:
                continue

            if char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0:
                    last_valid_pos = i
                    break

        if last_valid_pos > 0:
            truncated = json_str[:last_valid_pos + 1]
            try:
                json.loads(truncated)
                return truncated
            except json.JSONDecodeError:
                pass

        return json_str  # Return original attempt

    def _parse_dashboard_response(
        self,
        response: str,
        data_summary: DataSummary,
        layout: str
    ) -> Dict[str, Any]:
        """Parse LLM response for dashboard recommendation"""
        try:
            recommendations = self._parse_llm_response(response, data_summary)

            # Try to extract dashboard-specific info
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0]

            json_start = json_str.find('{')
            json_end = json_str.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                result = json.loads(json_str[json_start:json_end])
                dashboard_info = result.get("dashboard", {})
            else:
                dashboard_info = {}

            return {
                "success": True,
                "layout": layout,
                "recommendations": [r.to_dict() for r in recommendations],
                "dashboard": dashboard_info,
                "method": "llm"
            }

        except Exception as e:
            logger.error(f"Dashboard parsing failed: {e}")
            return self._minimal_dashboard_fallback(data_summary, layout)

    def _minimal_fallback(
        self,
        data_summary: DataSummary,
        scenario: str
    ) -> List[ChartRecommendation]:
        """
        Minimal fallback when LLM is unavailable.
        Returns very basic recommendations based on data presence.
        """
        recommendations = []

        has_time = len(data_summary.time_columns) > 0
        has_categories = len(data_summary.category_columns) > 0
        has_measures = len(data_summary.measures) > 0

        # Basic recommendation logic (minimal, not rule-based mapping)
        if has_measures:
            if has_time and data_summary.measures:
                recommendations.append(ChartRecommendation(
                    chart_type="line",
                    title="趋势分析",
                    reason="检测到时间维度和度量指标",
                    x_axis=data_summary.time_columns[0] if data_summary.time_columns else None,
                    y_axis=data_summary.measures[:3],
                    priority=1,
                    category="trend"
                ))

            if has_categories and data_summary.measures:
                recommendations.append(ChartRecommendation(
                    chart_type="bar",
                    title="分类对比",
                    reason="检测到分类维度和度量指标",
                    x_axis=data_summary.category_columns[0] if data_summary.category_columns else None,
                    y_axis=[data_summary.measures[0]] if data_summary.measures else [],
                    priority=2,
                    category="comparison"
                ))

        if not recommendations:
            # Ultimate fallback
            recommendations.append(ChartRecommendation(
                chart_type="bar",
                title="数据概览",
                reason="基础数据展示（建议配置 LLM 获取更精准的推荐）",
                priority=1,
                category="comparison"
            ))

        return recommendations

    def _minimal_dashboard_fallback(
        self,
        data_summary: DataSummary,
        layout: str
    ) -> Dict[str, Any]:
        """Minimal dashboard fallback"""
        recommendations = self._minimal_fallback(data_summary, "general")

        return {
            "success": True,
            "layout": layout,
            "recommendations": [r.to_dict() for r in recommendations],
            "dashboard": {"layout": layout},
            "method": "fallback",
            "message": "LLM 不可用，返回基础推荐"
        }

    def get_chart_type_info(self, chart_type: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific chart type"""
        return self.CHART_TYPES.get(chart_type)

    def list_chart_types(self) -> List[Dict[str, Any]]:
        """List all available chart types with descriptions"""
        return [
            {"id": k, **v}
            for k, v in self.CHART_TYPES.items()
        ]

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


# Singleton instance
_recommender_instance: Optional[ChartRecommender] = None


def get_chart_recommender() -> ChartRecommender:
    """Get the global ChartRecommender instance"""
    global _recommender_instance
    if _recommender_instance is None:
        _recommender_instance = ChartRecommender()
    return _recommender_instance
