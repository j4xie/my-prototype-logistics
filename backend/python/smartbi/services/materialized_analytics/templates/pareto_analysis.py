"""ParetoAnalysis — 80/20 rule test.

For primary dim × primary measure, compute what % of labels contribute
what % of total. Classic 20% labels → 80% revenue insight.
"""
from __future__ import annotations

import re as _re
from typing import ClassVar

from smartbi.capability.contract import RequiresSpec

from ..compute.base import ComputeBackend
from ..restaurant.action_rec_formatter import format_action_rec
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_NUM_LIKE = _re.compile(r'^-?\d+(\.\d+)?$')


def _is_numeric_label(v):
    if isinstance(v, (int, float)):
        return True
    if isinstance(v, str) and _NUM_LIKE.match(v.strip()):
        return True
    return False


def _filter_numeric_rows(rows):
    return [r for r in rows if not _is_numeric_label(r.get('label'))]


@register
class ParetoAnalysis(AnalysisTemplate):

    sample_queries = [
        "80/20 分析",
        "帕累托贡献",
        "头部贡献占比",
        "核心客户 80%",
        "二八法则",
    ]

    # 通用 80/20 分析 — 任意维度 × primary_measure (>=5 distinct labels).
    # 不绑特定 canonical, applies() 已自校验.
    requires: ClassVar[RequiresSpec | None] = None

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
            rows = _filter_numeric_rows(rows)
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

        # Spec §4.3: focus resources on the top-80 group, prune long-tail
        top_label = best_rows[0]["label"] if best_rows else "-"
        if labels_for_80_pct <= 30:
            action_rec = format_action_rec(
                object_target=f"末尾 {len(best_rows) - labels_for_80} 个 {best_dim} (合计仅占 20% 的 {measure})",
                benefit_range="精简末尾长尾 + 资源向 Top 倾斜可提升整体效率 5-12%",
                prerequisite=f"分析末尾 {best_dim} 的成本占用 + 评估退出影响 + Top 资源加配",
                timeline="本季度内",
            )
        else:
            action_rec = format_action_rec(
                object_target=f"Top {labels_for_80} 个 {best_dim} (含「{top_label}」)",
                benefit_range=f"把长尾资源整合给 Top 集群可拉高头部 {measure} 8-15%",
                prerequisite=f"复盘 Top 头部成功要素 + SOP 输出到末位 {best_dim}",
                timeline="本季度内",
            )
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
                f"({labels_for_80_pct}%) 贡献了 80% 的 {measure}。 {action_rec}"
            ),
        )
