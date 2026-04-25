"""MonthlyTrend — daily/weekly/monthly time series of primary measure.

Auto-picks frequency: <= 62 days → daily, <= 400 days → weekly, else monthly.
"""
from __future__ import annotations

from ..compute.base import ComputeBackend
from ..restaurant.action_rec_formatter import format_action_rec
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register


@register
class MonthlyTrend(AnalysisTemplate):

    sample_queries = [
        "月度趋势",
        "营收走势",
        "按月增长",
        "营业额变化",
        "月份趋势线",
        "营收最高的月份",
        "哪个月营业额最高",
        "峰值月份",
        "最旺的月份",
        "月度销售排名",
    ]

    @property
    def code(self) -> str:
        return "monthly_trend"

    @property
    def title(self) -> str:
        return "时间趋势"

    def applies(self, schema: DataSchema) -> bool:
        return schema.time_field is not None and schema.primary_measure is not None

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        time_col = schema.time_field
        measure = schema.primary_measure

        # Probe daily first; downsample if too many points
        daily = backend.time_series(time_col, measure, "D")
        if not daily:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no valid time values",
            )

        freq_used = "D"
        series = daily
        if len(daily) > 62:
            weekly = backend.time_series(time_col, measure, "W")
            if len(weekly) > 60:
                series = backend.time_series(time_col, measure, "M")
                freq_used = "M"
            else:
                series = weekly
                freq_used = "W"

        total = sum(r["total"] for r in series)
        peak = max(series, key=lambda r: r["total"])
        trough = min(series, key=lambda r: r["total"])

        chart_config = {
            "type": "line",
            "title": {"text": f"{measure} 时间趋势 ({freq_used})", "left": "center"},
            "xAxis": {"type": "category", "data": [r["period"] for r in series]},
            "yAxis": {"type": "value", "name": measure},
            "series": [{
                "name": measure, "type": "line", "smooth": True,
                "data": [r["total"] for r in series],
                "markPoint": {"data": [
                    {"name": "峰", "coord": [peak["period"], peak["total"]]},
                    {"name": "谷", "coord": [trough["period"], trough["total"]]},
                ]},
            }],
            "tooltip": {"trigger": "axis"},
        }

        # Spec §4.3: drive trough vs peak gap into seasonal action plan
        gap_pct = round((peak["total"] - trough["total"]) / peak["total"] * 100, 0) if peak["total"] > 0 else 0
        if gap_pct >= 30:
            action_rec = format_action_rec(
                object_target=f"谷值周期 {trough['period']} (低于峰值 {gap_pct:.0f}%)",
                benefit_range=f"谷值时段定向促销 + 套餐 + 会员唤回可拉高谷值 {measure} 10-25%",
                prerequisite="复盘谷值时段成因 (淡季 / 节假日错峰 / 活动空窗) + 设计针对性方案",
                timeline="本月内",
            )
        else:
            action_rec = format_action_rec(
                object_target=f"峰值 {peak['period']} ({peak['total']:,.0f}) 与谷值 {trough['period']}",
                benefit_range=f"复刻峰值期运营手段到平日,可缩小波动 10-15%",
                prerequisite=f"对标峰值时段促销 / 排班 / 物料 + 复盘可复用方案",
                timeline="本月内",
            )
        return TemplateResult(
            code=self.code, title=self.title,
            data={"series": series, "freq": freq_used},
            chart_config=chart_config,
            kpis={
                "total_revenue": total,
                "peak_period": peak["period"],
                "peak_value": peak["total"],
                "trough_period": trough["period"],
                "trough_value": trough["total"],
                "period_count": len(series),
            },
            insight_text=(
                f"{measure} 累计 {total:,.0f} 元,峰值 {peak['period']} "
                f"({peak['total']:,.0f} 元),谷值 {trough['period']} "
                f"({trough['total']:,.0f} 元)。按{ {'D':'日','W':'周','M':'月'}.get(freq_used, freq_used) }聚合,共 {len(series)} 个周期。 {action_rec}"
            ),
        )
