"""StaffPerformance — 服务员/销售员/收银员业绩排名 Top 10.

Detects whichever role column is present (preference: 服务员 > 销售员 > 收银员),
then ranks staff by revenue (sum of primary_measure). Also reports order count
per staff and avg-per-order.
"""
from __future__ import annotations

from typing import Any, Dict, List

import polars as pl

from ..compute.base import ComputeBackend
from ..restaurant.pos_placeholders import POS_STAFF_PLACEHOLDERS
from ..restaurant.schema_helpers import measure_annotation, preferred_revenue_col
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_ROLE_COLS = ["服务员", "销售员", "收银员"]
_TOP_N = 10


@register
class StaffPerformance(AnalysisTemplate):

    sample_queries = [
        "服务员业绩排名 Top 10",
        "销售员排行",
        "员工绩效排名",
        "Top 1 服务员是谁",
        "谁卖得最多",
        "收银员业绩",
        "员工里谁最厉害",
        "最厉害的员工",
        "业绩冠军员工",
        "谁是销售冠军",
    ]

    @property
    def code(self) -> str:
        return "staff_performance"

    @property
    def title(self) -> str:
        return "员工业绩排名"

    def applies(self, schema: DataSchema) -> bool:
        field_names = {f.name for f in schema.fields}
        has_role = any(col in field_names for col in _ROLE_COLS)
        return has_role and schema.primary_measure is not None

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        # W4-Q3: prefer 实收额 (net) over 应收金额/营业额 (gross). qhj 实收 ≈ 60% of 营业额
        # because of platform commissions; gross would overstate staff revenue by ~40%.
        measure = preferred_revenue_col(backend._df.columns, schema.primary_measure)
        if measure is None:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no revenue column found",
            )
        field_names = {f.name for f in schema.fields}

        # Pick first matching role column in preference order
        role_col = next((col for col in _ROLE_COLS if col in field_names), None)
        if role_col is None:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no staff role column found",
            )

        # Aggregate: count orders + sum revenue, exclude null/empty staff names + role-label noise.
        # Data-quality filter: some uploads have cell values like "收银"/"收银员"/"服务员" mixed into
        # the 服务员 column (data entry error or merged cells). These are role-label contamination,
        # not real names. Filter at template level since classifier can only fix COLUMN roles, not
        # cell VALUES. Meta-rows like 合计/总计 already filtered by PolarsBackend._META_LABELS.
        # Apr 25 2026 D1.C4: Denylist moved to shared restaurant.pos_placeholders module
        # so other templates (kitchen_dispatch / monthly_anomaly with staff dim) reuse it.
        _staff_noise = list(POS_STAFF_PLACEHOLDERS)
        ranking_df = (
            backend._df
            .filter(
                pl.col(role_col).is_not_null()
                & (pl.col(role_col).cast(pl.Utf8) != "")
                & (~pl.col(role_col).cast(pl.Utf8).is_in(_staff_noise))
            )
            .group_by(role_col)
            .agg([
                pl.len().alias("orders"),
                pl.col(measure).cast(pl.Float64, strict=False).sum().alias("revenue"),
            ])
            .sort("revenue", descending=True)
            .head(_TOP_N)
        )

        if ranking_df.is_empty():
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason=f"no non-null rows in {role_col}",
            )

        # Total distinct staff (before Top N cap) for KPI.
        # Apr 25 2026 D1.C4 fix: previously this counted ALL non-null distinct
        # values including 收银/点菜 placeholders, leading to "共 3 位服务员"
        # when only 1 was a real human. Apply the same denylist as ranking.
        total_staff = (
            backend._df
            .filter(
                pl.col(role_col).is_not_null()
                & (pl.col(role_col).cast(pl.Utf8) != "")
                & (~pl.col(role_col).cast(pl.Utf8).is_in(_staff_noise))
            )
            .select(pl.col(role_col).n_unique())
            .item()
        )

        # Build ranking list with avg_per_order
        ranking: List[Dict[str, Any]] = []
        for row in ranking_df.to_dicts():
            rev = float(row["revenue"] or 0.0)
            cnt = int(row["orders"])
            avg = round(rev / cnt, 2) if cnt > 0 else 0.0
            ranking.append({
                "staff": row[role_col],
                "orders": cnt,
                "revenue": rev,
                "avg_per_order": avg,
            })

        top = ranking[0]
        top_staff = top["staff"]
        top_revenue = top["revenue"]
        top_orders = top["orders"]

        # ECharts horizontal bar (rotated labels)
        staff_names = [r["staff"] for r in ranking]
        revenues = [r["revenue"] for r in ranking]

        chart_config = {
            "type": "bar",
            "title": {"text": f"{role_col}业绩排名 Top {len(ranking)}", "left": "center"},
            "xAxis": {"type": "value", "name": measure},
            "yAxis": {
                "type": "category",
                "data": staff_names[::-1],  # highest at top in horizontal bar
                "axisLabel": {"rotate": 0},
            },
            "series": [{
                "name": measure,
                "type": "bar",
                "data": revenues[::-1],
                "label": {"show": True, "position": "right"},
            }],
            "tooltip": {"trigger": "axis"},
            "grid": {"left": "3%", "right": "8%", "bottom": "3%", "containLabel": True},
        }

        insight_text = (
            f"{role_col} Top 1:{top_staff} (销售额 {top_revenue:,.0f} 元,{top_orders:,} 单);"
            f"共 {total_staff} 位{role_col}参与服务。"
            f" {measure_annotation(measure)}"
        )

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "role_type": role_col,
                "ranking": ranking,
                "total_staff": total_staff,
            },
            chart_config=chart_config,
            kpis={
                "role_type": role_col,
                "top_staff": top_staff,
                "top_revenue": top_revenue,
                "staff_count": total_staff,
            },
            insight_text=insight_text,
        )
