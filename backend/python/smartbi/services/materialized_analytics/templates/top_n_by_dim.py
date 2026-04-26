"""TopNByDim — Top 5/10/20 dimensions by primary measure.

Example: Top 5 门店 by 销售金额. Produces a bar chart + data table.
Most useful template — 80% of user "ranking" questions answered here.
"""
from __future__ import annotations

from typing import ClassVar

from smartbi.capability.contract import RequiresSpec

from ..compute.base import ComputeBackend
from ..restaurant.action_rec_formatter import (
    dim_aware_top_n_action_rec,
    format_action_rec,
)
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register


@register
class TopNByDim(AnalysisTemplate):
    TOP_N = 10

    sample_queries = [
        "Top 排名",
        "门店排行",
        "区域排名",
        "分类头部",
        "排名前几",
    ]

    # 通用 Top-N — 依赖运行时 schema 的 dimensions + primary_measure.
    # 任何含维度+度量的表都适用,不绑定具体 canonical 字段.
    requires: ClassVar[RequiresSpec | None] = None

    @property
    def code(self) -> str:
        return "top_n_by_dim"

    @property
    def title(self) -> str:
        return "Top 10 维度排名"

    def applies(self, schema: DataSchema) -> bool:
        return bool(schema.dimensions) and schema.primary_measure is not None

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        measure = schema.primary_measure
        # Run on every dimension; pick the one with the most variation as "primary dim"
        by_dim = {}
        for dim in schema.dimensions[:4]:  # cap to avoid combinatorial blow-up
            top = backend.top_n(dim, measure, self.TOP_N)
            if len(top) >= 2:  # skip single-label dims (useless chart)
                by_dim[dim] = top

        if not by_dim:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no dimension with >=2 distinct labels",
            )

        # Pick dim with highest spread (max - min of totals) as primary
        primary_dim = max(
            by_dim.keys(),
            key=lambda d: (by_dim[d][0]["total"] - by_dim[d][-1]["total"]) if by_dim[d] else 0,
        )
        top_rows = by_dim[primary_dim]
        total_of_top = sum(r["total"] for r in top_rows)

        # Apr 26 2026 phase 4 P1.d: skip when all values are 0 — produces
        # useless "Top 1 X 0 元 / 占比 0%" output that displaced better
        # routing for qhj 4216 卡详情 (all 余额/本金 = 0). When data has no
        # signal, applies=False signals downstream to keep current upload
        # OR fall through to LLM rather than serving zero-value cache.
        if total_of_top == 0:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False,
                skip_reason=f"all {primary_dim} totals are 0 — no analytical signal",
            )

        chart_config = {
            "type": "bar",
            "title": {"text": f"Top {len(top_rows)} {primary_dim} (按 {measure})", "left": "center"},
            "xAxis": {"type": "category", "data": [r["label"] for r in top_rows],
                      "axisLabel": {"rotate": 30}},
            "yAxis": {"type": "value", "name": measure},
            "series": [{
                "name": measure, "type": "bar",
                "data": [r["total"] for r in top_rows],
                "label": {"show": True, "position": "top", "formatter": "{c}"},
            }],
            "tooltip": {"trigger": "axis"},
            "grid": {"left": "3%", "right": "4%", "bottom": "3%", "containLabel": True},
        }

        top_label = top_rows[0]["label"]
        top_share_pct = (top_rows[0]["total"] / total_of_top * 100) if total_of_top > 0 else 0
        dominance = "独占" if top_share_pct >= 30 else "占比"

        # Spec §4.3: drive bottom of top-N to learn from leader.
        # Apr 26 phase 5 UX: dim-aware variation — different dim types
        # (门店/商品/渠道/时段/等级) call for different operational actions.
        bottom_label = top_rows[-1]["label"] if len(top_rows) >= 3 else None
        if bottom_label and len(top_rows) >= 3:
            top_val = top_rows[0]["total"]
            bot_val = top_rows[-1]["total"]
            gap_pct = round((top_val - bot_val) / top_val * 100, 0) if top_val > 0 else 0
            action_rec = dim_aware_top_n_action_rec(
                primary_dim=primary_dim,
                measure=measure,
                top_label=str(top_label),
                bottom_label=str(bottom_label),
                gap_pct=gap_pct,
            )
        else:
            action_rec = format_action_rec(
                object_target=f"Top「{top_label}」 ({dominance} {top_share_pct:.1f}%)",
                benefit_range=f"复盘 Top 成功要素并输出到其他 {primary_dim} 可拉升 {measure} 5-10%",
                prerequisite=f"Top {primary_dim} 案例总结 + 培训 + 跨域复制",
                timeline="本月内",
            )
        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "primary_dim": primary_dim,
                "measure": measure,
                "top_rows": top_rows,
                "all_dims": {d: by_dim[d] for d in by_dim},
                "top_total": total_of_top,
            },
            chart_config=chart_config,
            kpis={
                "top_label": top_label,
                "top_value": top_rows[0]["total"],
                "top_share_pct": round(top_share_pct, 2),
                "dim_count": len(by_dim),
            },
            insight_text=(
                f"{primary_dim} Top {len(top_rows)}:{top_label} {dominance} "
                f"{top_share_pct:.1f}%,余下梯队收敛明显。 {action_rec}"
            ),
        )
