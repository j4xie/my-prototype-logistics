"""AnomalyDetection — ±2σ outliers on primary measure."""
from __future__ import annotations

from ..compute.base import ComputeBackend
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register


@register
class AnomalyDetection(AnalysisTemplate):
    SIGMA = 2.0

    @property
    def code(self) -> str:
        return "anomaly_detection"

    @property
    def title(self) -> str:
        return "异常值检测"

    def applies(self, schema: DataSchema) -> bool:
        return schema.primary_measure is not None and schema.row_count >= 30

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        measure = schema.primary_measure
        stats = backend.mean_std(measure)
        outliers = backend.outliers(measure, sigma=self.SIGMA)

        return TemplateResult(
            code=self.code, title=self.title,
            data={"outliers": outliers, "stats": stats, "sigma": self.SIGMA},
            chart_config=None,  # table only, no chart
            kpis={
                "outlier_count": len(outliers),
                "mean": stats["mean"],
                "std": stats["std"],
                "min": stats["min"],
                "max": stats["max"],
            },
            insight_text=(
                f"{measure} 均值 {stats['mean']:,.2f},标准差 {stats['std']:,.2f};"
                f"±{self.SIGMA}σ 外异常 {len(outliers)} 条 "
                f"(区间 {stats['min']:,.2f} ~ {stats['max']:,.2f})。"
            ),
        )
