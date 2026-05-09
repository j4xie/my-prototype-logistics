"""DefectRateTopN — manufacturing 不良率 / 合格率 Top N 工序/产品/批次.

First manufacturing-domain template (Apr 27 2026 H4 deferred ship).
Pattern other manufacturing templates (equipment_oee, work_order_status,
batch_yield) should follow when manufacturing data arrives in prod.

Activates when dataset has:
- 不良数 / 缺陷数 / 不合格数 column (any)
- 合格数 / 良品数 / 总数 column (any)
- A dimension column (工序/产品/批次/设备)

Computes per-dim defect rate, ranks Top N (default 10) by rate desc,
returns table + bar chart + actionable insight.
"""
from __future__ import annotations

from typing import Any, ClassVar, Dict, List

import polars as pl

from smartbi.capability.contract import RequiresSpec

from ..compute.base import ComputeBackend
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_DEFECT_COL_CANDIDATES = ("不良数", "缺陷数", "不合格数", "次品数", "废品数")
_GOOD_COL_CANDIDATES = ("合格数", "良品数", "正品数", "ok数")
_TOTAL_COL_CANDIDATES = ("总数", "生产数", "产量", "投入数")
_DIM_CANDIDATES = ("工序", "工序名称", "工艺", "产品", "产品名称",
                   "批次", "批次号", "设备", "设备名称", "机台")
_TOP_N = 10


@register
class DefectRateTopN(AnalysisTemplate):

    sample_queries = [
        # Standard manufacturing quality queries
        "不良率最高的工序",
        "不良率 Top 10",
        "哪个工序不良率最高",
        "良品率最低的产品",
        "合格率排名",
        "不合格 Top 10 批次",
        "不良率排行",
        "废品率最高",
        "缺陷数最多的工序",
        "次品率排名",
        "哪批产品不良率最高",
        "工序不良率分布",
        "不良率倒数 Top 10",  # = 良品率 Top 10
        "良品率最高",
        "质检合格率排行",
    ]

    requires: ClassVar[RequiresSpec | None] = None  # custom applies()

    @property
    def code(self) -> str:
        return "defect_rate_top_n"

    @property
    def title(self) -> str:
        return "不良率 Top N (工序/产品/批次)"

    def applies(self, schema: DataSchema) -> bool:
        field_names = {f.name for f in schema.fields}
        # Need defect column (or computable from total - good)
        has_defect = any(c in field_names for c in _DEFECT_COL_CANDIDATES)
        has_total_minus_good = (
            any(c in field_names for c in _TOTAL_COL_CANDIDATES)
            and any(c in field_names for c in _GOOD_COL_CANDIDATES)
        )
        # Need a dim
        has_dim = any(c in field_names for c in _DIM_CANDIDATES)
        return (has_defect or has_total_minus_good) and has_dim

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        field_names = {f.name for f in schema.fields}

        # Pick first matching dim
        dim_col = next((c for c in _DIM_CANDIDATES if c in field_names), None)
        if dim_col is None:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no manufacturing dimension column",
            )

        # Pick defect column directly, or compute from total - good
        defect_col = next((c for c in _DEFECT_COL_CANDIDATES if c in field_names), None)
        good_col = next((c for c in _GOOD_COL_CANDIDATES if c in field_names), None)
        total_col = next((c for c in _TOTAL_COL_CANDIDATES if c in field_names), None)

        df = backend._df

        # Build defect_count + total_count expressions
        if defect_col and total_col:
            base = df.select([
                dim_col,
                pl.col(defect_col).cast(pl.Float64, strict=False).alias("defect_count"),
                pl.col(total_col).cast(pl.Float64, strict=False).alias("total_count"),
            ])
        elif defect_col and good_col:
            base = df.select([
                dim_col,
                pl.col(defect_col).cast(pl.Float64, strict=False).alias("defect_count"),
                (
                    pl.col(defect_col).cast(pl.Float64, strict=False)
                    + pl.col(good_col).cast(pl.Float64, strict=False)
                ).alias("total_count"),
            ])
        elif total_col and good_col:
            base = df.select([
                dim_col,
                (
                    pl.col(total_col).cast(pl.Float64, strict=False)
                    - pl.col(good_col).cast(pl.Float64, strict=False)
                ).alias("defect_count"),
                pl.col(total_col).cast(pl.Float64, strict=False).alias("total_count"),
            ])
        else:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="missing defect/total/good combination",
            )

        # Aggregate per dim, compute defect_rate
        agg = (
            base
            .filter(pl.col(dim_col).is_not_null() & (pl.col(dim_col).cast(pl.Utf8) != ""))
            .group_by(dim_col)
            .agg([
                pl.col("defect_count").sum().alias("defect_count"),
                pl.col("total_count").sum().alias("total_count"),
            ])
            .filter(pl.col("total_count") > 0)
            .with_columns(
                (pl.col("defect_count") / pl.col("total_count") * 100).alias("defect_rate_pct")
            )
            .sort("defect_rate_pct", descending=True)
            .head(_TOP_N)
        )

        if agg.is_empty():
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason=f"no valid rows for dim {dim_col}",
            )

        ranking: List[Dict[str, Any]] = []
        for row in agg.to_dicts():
            ranking.append({
                "dim_value": row[dim_col],
                "defect_count": int(row["defect_count"] or 0),
                "total_count": int(row["total_count"] or 0),
                "defect_rate_pct": round(float(row["defect_rate_pct"] or 0), 2),
            })

        top = ranking[0]
        bottom = ranking[-1] if len(ranking) > 1 else None

        # Bar chart: x = dim, y = defect_rate_pct, sorted desc
        chart_config = {
            "type": "bar",
            "title": {"text": f"不良率 Top {len(ranking)} ({dim_col})", "left": "center"},
            "xAxis": {
                "type": "category",
                "data": [r["dim_value"] for r in ranking],
                "axisLabel": {"rotate": 30, "overflow": "truncate", "width": 100},
            },
            "yAxis": {"type": "value", "name": "不良率 (%)", "axisLabel": {"formatter": "{value}%"}},
            "series": [{
                "name": "不良率",
                "type": "bar",
                "data": [r["defect_rate_pct"] for r in ranking],
                "label": {"show": True, "position": "top", "formatter": "{c}%"},
                "itemStyle": {"color": "#dc2626"},  # red — bad
            }],
            "tooltip": {"trigger": "axis"},
            "grid": {"left": "3%", "right": "4%", "bottom": "3%", "containLabel": True},
        }

        # Insight + action recommendation
        if bottom and top["defect_rate_pct"] - bottom["defect_rate_pct"] > 1.0:
            gap_pp = top["defect_rate_pct"] - bottom["defect_rate_pct"]
            insight_text = (
                f"## 结论\n"
                f"**{dim_col} Top 1 不良率: {top['dim_value']} = {top['defect_rate_pct']}%** "
                f"(共 {top['defect_count']:,}/{top['total_count']:,}), "
                f"与 Top {len(ranking)} 末位 {bottom['dim_value']} ({bottom['defect_rate_pct']}%) 相差 {gap_pp:.1f} pp.\n\n"
                f"## 关键发现\n"
                f"- Top 1 与末位 {dim_col} 不良率相差 {gap_pp:.1f} pp, "
                f"显示工艺/设备/操作差异显著.\n"
                f"- 全 Top {len(ranking)} 平均不良率 = {sum(r['defect_rate_pct'] for r in ranking)/len(ranking):.2f}%.\n\n"
                f"## 行动建议\n"
                f"- 立即对 **{top['dim_value']}** (不良率 {top['defect_rate_pct']}%) 启动 "
                f"工艺改善 + 操作复盘, 复制 {bottom['dim_value']} ({bottom['defect_rate_pct']}%) "
                f"标杆 SOP, **预计可降不良率 {gap_pp*0.5:.1f}-{gap_pp*0.8:.1f} pp** "
                f"(由质量主管负责, 30 天内出阶段报告).\n"
                f"- 排查 Top 3 {dim_col} 共同失效模式 (FMEA), 14 天内提交根因分析报告."
            )
        else:
            insight_text = (
                f"## 结论\n"
                f"**{dim_col} 不良率最高: {top['dim_value']} = {top['defect_rate_pct']}%** "
                f"({top['defect_count']:,}/{top['total_count']:,}).\n\n"
                f"## 关键发现\n"
                f"- 全 Top {len(ranking)} 不良率分布较平均 (差距 ≤ 1pp), 工艺一致性较好.\n\n"
                f"## 行动建议\n"
                f"- 建议从行业最佳实践对标, 找改善空间."
            )

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "dim_col": dim_col,
                "ranking": ranking,
                "top_dim": top["dim_value"],
                "top_rate_pct": top["defect_rate_pct"],
            },
            chart_config=chart_config,
            kpis={
                "top_dim": top["dim_value"],
                "top_defect_rate_pct": top["defect_rate_pct"],
                "top_defect_count": top["defect_count"],
                "dim_count": len(ranking),
                "avg_defect_rate_pct": round(
                    sum(r["defect_rate_pct"] for r in ranking) / len(ranking), 2
                ),
            },
            insight_text=insight_text,
        )
