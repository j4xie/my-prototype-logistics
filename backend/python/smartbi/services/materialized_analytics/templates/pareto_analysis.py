"""ParetoAnalysis — 80/20 rule test.

For primary dim × primary measure, compute what % of labels contribute
what % of total. Classic 20% labels → 80% revenue insight.
"""
from __future__ import annotations

from ..compute.base import ComputeBackend
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register


@register
class ParetoAnalysis(AnalysisTemplate):

    sample_queries = [
        "80/20 分析",
        "帕累托贡献",
        "头部贡献占比",
        "核心客户 80%",
        "二八法则",
    ]

    @property
    def code(self) -> str:
        return "pareto_analysis"

    @property
    def title(self) -> str:
        return "帕累托 80/20 分析"

    def applies(self, schema: DataSchema) -> bool:
        return bool(schema.dimensions) and schema.primary_measure is not None

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        measure = schema.primary_measure
        best_dim = None
        best_rows = None
        for dim in schema.dimensions[:4]:
            rows = backend.group_sum(dim, measure)
            if len(rows) >= 5:  # need enough points for Pareto to be meaningful
                best_dim = dim
                best_rows = rows
                break

        if not best_rows:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no dim with >=5 distinct labels",
            )

        total = sum(r["total"] for r in best_rows)
        if total <= 0:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="total measure is zero",
            )

        # Find how many top labels cumulatively hit 80%
        cumulative = 0.0
        labels_for_80 = 0
        for r in best_rows:
            cumulative += r["total"]
            labels_for_80 += 1
            if cumulative / total >= 0.80:
                break

        labels_for_80_pct = round(labels_for_80 / len(best_rows) * 100, 2)

        chart_config = {
            "type": "bar",
            "title": {"text": f"{best_dim} 帕累托 (按 {measure})", "left": "center"},
            "xAxis": {"type": "category", "data": [r["label"] for r in best_rows[:20]]},
            "yAxis": [
                {"type": "value", "name": measure},
                {"type": "value", "name": "累计 %", "min": 0, "max": 100},
            ],
            "series": [
                {"name": measure, "type": "bar",
                 "data": [r["total"] for r in best_rows[:20]]},
                {"name": "累计 %", "type": "line", "yAxisIndex": 1,
                 "data": [
                     round(sum(x["total"] for x in best_rows[:i+1]) / total * 100, 2)
                     for i in range(min(20, len(best_rows)))
                 ]},
            ],
            "tooltip": {"trigger": "axis"},
        }

        return TemplateResult(
            code=self.code, title=self.title,
            data={
                "dim": best_dim, "measure": measure,
                "rows": best_rows, "total": total,
                "labels_for_80pct": labels_for_80,
                "labels_for_80pct_share": labels_for_80_pct,
            },
            chart_config=chart_config,
            kpis={
                "labels_for_80pct": labels_for_80,
                "labels_for_80pct_share": labels_for_80_pct,
                "total_labels": len(best_rows),
            },
            insight_text=(
                f"{labels_for_80}/{len(best_rows)} 个 {best_dim} "
                f"({labels_for_80_pct}%) 贡献了 80% 的 {measure}。"
            ),
        )
