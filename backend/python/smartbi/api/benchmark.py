"""
Food Industry Benchmark API

Exposes food processing industry benchmark data and comparison endpoints.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Industry Benchmark Data — Food Processing
# ============================================================

FOOD_PROCESSING_BENCHMARKS = {
    "industry": "食品加工业",
    "source": "中国食品工业协会 / 国家统计局行业年报",
    "year": 2024,
    "metrics": {
        "gross_margin": {
            "name": "毛利率",
            "range": [25.0, 35.0],
            "median": 30.0,
            "unit": "%",
            "description": "食品加工行业毛利率参考区间",
            "sub_sectors": {
                "肉制品": {"range": [18.0, 28.0], "median": 23.0},
                "乳制品": {"range": [28.0, 38.0], "median": 33.0},
                "调味品": {"range": [35.0, 50.0], "median": 42.0},
                "速冻食品": {"range": [22.0, 32.0], "median": 27.0},
                "烘焙食品": {"range": [30.0, 45.0], "median": 38.0},
                "饮料": {"range": [35.0, 50.0], "median": 43.0},
            },
        },
        "net_margin": {
            "name": "净利率",
            "range": [3.0, 8.0],
            "median": 5.5,
            "unit": "%",
            "description": "食品加工行业净利率参考区间",
            "sub_sectors": {
                "肉制品": {"range": [2.0, 6.0], "median": 4.0},
                "乳制品": {"range": [3.0, 8.0], "median": 5.5},
                "调味品": {"range": [8.0, 15.0], "median": 12.0},
                "速冻食品": {"range": [3.0, 7.0], "median": 5.0},
                "烘焙食品": {"range": [4.0, 10.0], "median": 7.0},
                "饮料": {"range": [5.0, 12.0], "median": 8.5},
            },
        },
        "selling_expense_ratio": {
            "name": "销售费用率",
            "range": [8.0, 15.0],
            "median": 11.0,
            "unit": "%",
            "description": "销售费用占营业收入比例",
        },
        "admin_expense_ratio": {
            "name": "管理费用率",
            "range": [5.0, 10.0],
            "median": 7.0,
            "unit": "%",
            "description": "管理费用占营业收入比例",
        },
        "rd_expense_ratio": {
            "name": "研发费用率",
            "range": [2.0, 8.0],
            "median": 3.5,
            "unit": "%",
            "description": "研发费用占营业收入比例",
        },
        "financial_expense_ratio": {
            "name": "财务费用率",
            "range": [1.0, 5.0],
            "median": 2.5,
            "unit": "%",
            "description": "财务费用占营业收入比例",
        },
        "total_expense_ratio": {
            "name": "总费用率",
            "range": [15.0, 25.0],
            "median": 20.0,
            "unit": "%",
            "description": "三项费用合计占营业收入比例",
        },
        "inventory_turnover_days": {
            "name": "存货周转天数",
            "range": [30, 90],
            "median": 55,
            "unit": "天",
            "description": "存货周转天数参考区间",
        },
        "receivable_turnover_days": {
            "name": "应收账款周转天数",
            "range": [15, 60],
            "median": 35,
            "unit": "天",
            "description": "应收账款周转天数参考区间",
        },
        "yield_rate": {
            "name": "良品率",
            "range": [95.0, 99.5],
            "median": 97.5,
            "unit": "%",
            "description": "食品生产良品率参考区间",
        },
        "raw_material_cost_ratio": {
            "name": "原料成本占比",
            "range": [50.0, 70.0],
            "median": 60.0,
            "unit": "%",
            "description": "原料成本占营业成本比例",
        },
        "oee": {
            "name": "设备综合效率(OEE)",
            "range": [60.0, 85.0],
            "median": 72.0,
            "unit": "%",
            "description": "食品加工行业OEE (可用率×性能率×良品率)",
            "sub_sectors": {
                "肉制品": {"range": [55.0, 78.0], "median": 66.0},
                "乳制品": {"range": [65.0, 88.0], "median": 76.0},
                "调味品": {"range": [60.0, 82.0], "median": 70.0},
                "速冻食品": {"range": [58.0, 80.0], "median": 68.0},
                "烘焙食品": {"range": [62.0, 85.0], "median": 73.0},
                "饮料": {"range": [70.0, 92.0], "median": 82.0},
            },
        },
        "waste_rate": {
            "name": "废品率",
            "range": [1.0, 5.0],
            "median": 2.5,
            "unit": "%",
            "description": "食品生产废品/次品率参考区间",
            "sub_sectors": {
                "肉制品": {"range": [1.5, 6.0], "median": 3.5},
                "乳制品": {"range": [0.5, 3.0], "median": 1.5},
                "烘焙食品": {"range": [2.0, 7.0], "median": 4.0},
            },
        },
        "energy_cost_ratio": {
            "name": "能耗成本占比",
            "range": [5.0, 15.0],
            "median": 9.0,
            "unit": "%",
            "description": "能耗成本(电+水+气)占总生产成本比例",
        },
        "labor_productivity": {
            "name": "人均产出",
            "range": [80.0, 200.0],
            "median": 130.0,
            "unit": "万元/人·年",
            "description": "年人均产值(营收/员工数)",
        },
        "capacity_utilization": {
            "name": "产能利用率",
            "range": [70.0, 95.0],
            "median": 82.0,
            "unit": "%",
            "description": "实际产量占设计产能比例",
        },
    },
    "food_safety_standards": {
        "GB 2760-2014": "食品安全国家标准 食品添加剂使用标准",
        "GB 14881-2013": "食品安全国家标准 食品生产通用卫生规范",
        "GB 7718-2011": "食品安全国家标准 预包装食品标签通则",
        "GB 29921-2021": "食品安全国家标准 预包装食品中致病菌限量",
        "HACCP": "危害分析与关键控制点体系",
        "ISO 22000": "食品安全管理体系",
    },
}


# ============================================================
# Request/Response Models
# ============================================================


class BenchmarkCompareRequest(BaseModel):
    """Request model for comparing actual data against benchmarks"""
    metrics: Dict[str, float]  # e.g. {"gross_margin": 28.5, "net_margin": 4.2}
    sub_sector: Optional[str] = None  # e.g. "肉制品", "乳制品"


class MetricComparison(BaseModel):
    metric_key: str
    metric_name: str
    actual_value: float
    benchmark_range: List[float]
    benchmark_median: float
    unit: str
    status: str  # "优秀" | "达标" | "偏低" | "偏高" | "未知"
    gap_from_median: float  # positive = above median
    recommendation: str


class BenchmarkCompareResponse(BaseModel):
    success: bool
    comparisons: List[MetricComparison]
    overall_score: float  # 0-100 composite health score
    summary: str


# ============================================================
# Endpoints
# ============================================================


@router.get("/benchmark/food-processing")
async def get_food_processing_benchmarks():
    """Return food processing industry benchmark data"""
    return {
        "success": True,
        "data": FOOD_PROCESSING_BENCHMARKS,
    }


@router.post("/benchmark/compare", response_model=BenchmarkCompareResponse)
async def compare_with_benchmarks(req: BenchmarkCompareRequest):
    """Compare actual metrics against industry benchmarks"""
    comparisons: List[MetricComparison] = []
    benchmarks = FOOD_PROCESSING_BENCHMARKS["metrics"]
    scores: List[float] = []

    for key, actual in req.metrics.items():
        bench = benchmarks.get(key)
        if not bench:
            continue

        # Use sub-sector benchmarks if available and requested
        low, high = bench["range"]
        median = bench["median"]
        if req.sub_sector and "sub_sectors" in bench:
            sub = bench["sub_sectors"].get(req.sub_sector)
            if sub:
                low, high = sub["range"]
                median = sub["median"]

        # Determine status
        if actual < low:
            status = "偏低"
            # Score: how far below range (0 at 50% below low)
            score = max(0, 50 * (actual / low)) if low > 0 else 30
        elif actual > high:
            # For expense ratios, higher is worse
            if "expense" in key or "费用" in bench["name"]:
                status = "偏高"
                score = max(0, 100 - 50 * ((actual - high) / high)) if high > 0 else 60
            else:
                status = "优秀"
                score = min(100, 80 + 20 * ((actual - high) / (high - low))) if high > low else 90
        else:
            status = "达标"
            # Score: 60-90 based on position in range
            if high > low:
                position = (actual - low) / (high - low)
                score = 60 + position * 30
            else:
                score = 75

        gap = actual - median

        # Generate recommendation
        rec = _generate_recommendation(key, bench["name"], actual, low, high, median, status)

        comparisons.append(MetricComparison(
            metric_key=key,
            metric_name=bench["name"],
            actual_value=round(actual, 2),
            benchmark_range=[low, high],
            benchmark_median=median,
            unit=bench["unit"],
            status=status,
            gap_from_median=round(gap, 2),
            recommendation=rec,
        ))
        scores.append(score)

    overall = round(sum(scores) / len(scores), 1) if scores else 50.0

    # Summary
    good = sum(1 for c in comparisons if c.status in ("达标", "优秀"))
    total = len(comparisons)
    summary = f"共对比 {total} 项指标，{good} 项达标/优秀"
    if total > good:
        weak = [c.metric_name for c in comparisons if c.status in ("偏低", "偏高")]
        summary += f"，需关注: {', '.join(weak)}"

    return BenchmarkCompareResponse(
        success=True,
        comparisons=comparisons,
        overall_score=overall,
        summary=summary,
    )


def _generate_recommendation(
    key: str, name: str, actual: float,
    low: float, high: float, median: float, status: str
) -> str:
    """Generate actionable recommendation for a metric"""
    if status == "优秀":
        return f"{name}{actual:.1f}%，高于行业中位数{median:.1f}%，保持现有优势"
    if status == "达标":
        gap = median - actual
        if abs(gap) < 1:
            return f"{name}{actual:.1f}%，接近行业中位数{median:.1f}%，表现稳健"
        return f"{name}{actual:.1f}%，行业区间{low:.0f}-{high:.0f}%，可向中位数{median:.1f}%靠拢"

    # 偏低 or 偏高
    if "毛利" in name and status == "偏低":
        return (
            f"{name}仅{actual:.1f}%，低于行业下限{low:.0f}%。"
            f"建议：优化原料采购(集采降本)、提升高毛利产品占比、控制生产损耗率"
        )
    if "净利" in name and status == "偏低":
        return (
            f"{name}仅{actual:.1f}%，低于行业下限{low:.0f}%。"
            f"建议：聚焦费用管控(销售+管理费用)、优化产品结构、提升产能利用率"
        )
    if "费用" in name and status == "偏高":
        return (
            f"{name}{actual:.1f}%，高于行业上限{high:.0f}%。"
            f"建议：审查费用构成、优化渠道效率、推进数字化降本"
        )
    if status == "偏低":
        return f"{name}{actual:.1f}%，低于行业区间{low:.0f}-{high:.0f}%，建议对标行业最佳实践提升"
    return f"{name}{actual:.1f}%，高于行业区间{low:.0f}-{high:.0f}%，建议分析原因并优化"
