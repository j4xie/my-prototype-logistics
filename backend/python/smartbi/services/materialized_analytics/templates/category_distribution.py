"""CategoryDistribution — share of primary measure by each dimension.

For each dim, pie chart showing % contribution. Quickly tells user
"品类 A 占 60% 营收" type stories.
"""
from __future__ import annotations

from ..compute.base import ComputeBackend
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register


@register
class CategoryDistribution(AnalysisTemplate):

    @property
    def code(self) -> str:
        return "category_distribution"

    @property
    def title(self) -> str:
        return "分类占比"

    def applies(self, schema: DataSchema) -> bool:
        return bool(schema.dimensions) and schema.primary_measure is not None

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        measure = schema.primary_measure
        shares_by_dim = {}

        for dim in schema.dimensions[:4]:
            rows = backend.group_sum(dim, measure)
            # Need 2-15 categories to be meaningful (else not a "distribution")
            if 2 <= len(rows) <= 15:
                total = sum(r["total"] for r in rows)
                if total > 0:
                    shares_by_dim[dim] = [
                        {"label": r["label"], "total": r["total"],
                         "share": round(r["total"] / total * 100, 2)}
                        for r in rows
                    ]

        if not shares_by_dim:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no dim with 2-15 categories",
            )

        # Primary dim: the one with most balanced distribution (least skewed)
        primary_dim = min(
            shares_by_dim.keys(),
            key=lambda d: shares_by_dim[d][0]["share"],
        )
        primary = shares_by_dim[primary_dim]

        chart_config = {
            "type": "pie",
            "title": {"text": f"{primary_dim} 占比 (按 {measure})", "left": "center"},
            "tooltip": {"trigger": "item", "formatter": "{b}: {c} ({d}%)"},
            "series": [{
                "name": measure, "type": "pie", "radius": "60%",
                "data": [{"name": r["label"], "value": r["total"]} for r in primary],
                "label": {"formatter": "{b}: {d}%"},
            }],
        }

        return TemplateResult(
            code=self.code, title=self.title,
            data={
                "primary_dim": primary_dim,
                "measure": measure,
                "shares": primary,
                "all_dims": shares_by_dim,
            },
            chart_config=chart_config,
            kpis={
                "top_share_pct": primary[0]["share"],
                "top_label": primary[0]["label"],
                "category_count": len(primary),
            },
            insight_text=(
                f"按 {primary_dim} 分类占比:Top 1 {primary[0]['label']} "
                f"占 {primary[0]['share']}%,共 {len(primary)} 个分类。"
            ),
        )
