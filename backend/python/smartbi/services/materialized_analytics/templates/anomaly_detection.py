"""AnomalyDetection — ±2σ outliers on primary measure."""
from __future__ import annotations

from ..compute.base import ComputeBackend
from ..restaurant.action_rec_formatter import format_action_rec, format_data_insufficient
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register


@register
class AnomalyDetection(AnalysisTemplate):
    SIGMA = 2.0

    sample_queries = [
        "异常检测",
        "离群值",
        "突变点",
        "数据异常",
        "偏离均值的点",
    ]

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

        # Spec §4.3: drive anomaly count to root-cause review action
        if len(outliers) == 0:
            action_rec = format_action_rec(
                object_target=f"{measure} 数据 (μ={stats['mean']:,.2f},σ={stats['std']:,.2f})",
                benefit_range="无明显异常,可保持现有运营节奏 + 持续监控",
                prerequisite="持续上传周报 / 月报跟踪指标稳定性",
                timeline="本月内",
            )
        elif len(outliers) >= 5:
            action_rec = format_action_rec(
                object_target=f"{measure} ±{self.SIGMA}σ 外 {len(outliers)} 条异常",
                benefit_range="排查异常根因 + 修订 SOP 可降低再次发生 30-50%",
                prerequisite="按异常时段 / 门店逐条复盘 + 召开根因分析会",
                timeline="本周内",
            )
        else:
            action_rec = format_action_rec(
                object_target=f"{measure} 异常 {len(outliers)} 条 (Min {stats['min']:,.2f} / Max {stats['max']:,.2f})",
                benefit_range="逐条复盘异常可缩小未来波动 10-20%",
                prerequisite="对标日均 + 同期月份 + 运营事件日历交叉验证",
                timeline="本周内",
            )
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
                f"(区间 {stats['min']:,.2f} ~ {stats['max']:,.2f})。 {action_rec}"
            ),
        )
