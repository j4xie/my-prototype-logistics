"""MonthlyAnomaly — 月度异常波动检测 (pre-aggregated then detect).

Regular anomaly_detection template runs on row-level data and gets drowned
out — a -33% monthly dip averages out at row level. This template first
aggregates to monthly totals, then flags outlier months using two signals:
  1. MoM delta magnitude: |Δ%| ≥ 20% is "significant"; ≥ 30% is "alert"
  2. z-score across 12 months: |z| ≥ 1.5 flags outliers vs trend

Reports: each anomalous month with root-cause hints (if dimension-split is
available).
"""
from __future__ import annotations

import statistics
from typing import Any, Dict, List, Optional

import polars as pl

from ..compute.base import ComputeBackend
from ..restaurant.schema_helpers import (
    find_date_col, find_gross_revenue_col, find_net_revenue_col,
    preferred_revenue_col,
)
from ..schema import DataSchema, Domain
from .base import AnalysisTemplate, TemplateResult
from .registry import register

_META_LABELS = ("合计", "总计", "小计", "汇总")
_MOM_SIGNIFICANT = 20.0     # |Δ%| ≥ 20% = noteworthy
_MOM_ALERT = 30.0           # |Δ%| ≥ 30% = alert
_Z_OUTLIER = 1.5            # |z| ≥ 1.5 vs 12-month mean = outlier


@register
class MonthlyAnomaly(AnalysisTemplate):

    @property
    def code(self) -> str:
        return "monthly_anomaly"

    @property
    def title(self) -> str:
        return "月度异常波动检测"

    def applies(self, schema: DataSchema) -> bool:
        if schema.domain not in (Domain.RESTAURANT, Domain.UNKNOWN):
            return False
        names = {f.name for f in schema.fields}
        has_date = find_date_col(names) is not None
        has_rev = (
            find_net_revenue_col(names) is not None
            or find_gross_revenue_col(names) is not None
            or schema.primary_measure is not None
        )
        return has_date and has_rev

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df  # type: ignore[attr-defined]
        cols = set(df.columns)

        date_col = find_date_col(cols)
        rev_col = preferred_revenue_col(cols, schema.primary_measure)
        if date_col is None or rev_col is None:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="missing date or revenue col",
            )

        # Drop meta rows
        df = df.filter(
            ~pl.col(date_col).cast(pl.Utf8, strict=False).fill_null("").is_in(list(_META_LABELS))
        )

        # Aggregate by yyyy-mm
        monthly_df = (
            df.with_columns(
                pl.col(date_col).cast(pl.Utf8, strict=False).str.slice(0, 7).alias("_ym")
            )
            .filter(pl.col("_ym").is_not_null() & (pl.col("_ym") != ""))
            .group_by("_ym")
            .agg([
                pl.col(rev_col).cast(pl.Float64, strict=False).fill_null(0.0).sum().alias("revenue"),
                pl.len().alias("orders"),
            ])
            .sort("_ym")
        )
        monthly_rows = monthly_df.to_dicts()

        if len(monthly_rows) < 3:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason=f"only {len(monthly_rows)} months; need ≥3 for anomaly detection",
            )

        revenues = [float(r["revenue"] or 0.0) for r in monthly_rows]
        mean = statistics.mean(revenues)
        stdev = statistics.stdev(revenues) if len(revenues) >= 2 else 0.0

        # Enrich each month with MoM delta + z-score + anomaly flags
        months: List[Dict[str, Any]] = []
        prev_rev: Optional[float] = None
        for r in monthly_rows:
            rev = float(r["revenue"] or 0.0)
            mom_pct = ((rev - prev_rev) / prev_rev * 100) if prev_rev and prev_rev != 0 else None
            z = (rev - mean) / stdev if stdev > 0 else 0.0

            flags: List[str] = []
            if mom_pct is not None:
                if abs(mom_pct) >= _MOM_ALERT:
                    flags.append(f"🚨 MoM {mom_pct:+.1f}%")
                elif abs(mom_pct) >= _MOM_SIGNIFICANT:
                    flags.append(f"⚠️ MoM {mom_pct:+.1f}%")
            if abs(z) >= _Z_OUTLIER:
                flags.append(f"📊 离群 z={z:+.2f}")

            months.append({
                "month": str(r.get("_ym") or ""),
                "revenue": round(rev, 2),
                "orders": int(r["orders"]),
                "mom_delta_pct": round(mom_pct, 2) if mom_pct is not None else None,
                "z_score": round(z, 2),
                "flags": flags,
                "is_anomaly": bool(flags),
            })
            prev_rev = rev

        anomalies = [m for m in months if m["is_anomaly"]]
        # Most severe anomaly
        if anomalies:
            worst = max(anomalies, key=lambda m: abs(m.get("mom_delta_pct") or 0))
        else:
            worst = None

        # Peak / trough
        peak = max(months, key=lambda m: m["revenue"])
        trough = min(months, key=lambda m: m["revenue"])

        # Insight
        parts: List[str] = []
        parts.append(f"期内 {len(months)} 个月,月均 ¥{mean:,.0f}。")
        parts.append(f"峰值 {peak['month']} ¥{peak['revenue']:,.0f},谷值 {trough['month']} ¥{trough['revenue']:,.0f}。")
        if anomalies:
            anomaly_months = ", ".join(f"{m['month']}({m['mom_delta_pct']:+.1f}%)" for m in anomalies)
            parts.append(f"🚨 发现 {len(anomalies)} 个异常月:{anomaly_months}。")
            if worst and worst.get("mom_delta_pct"):
                delta = worst["mom_delta_pct"]
                if delta < 0:
                    parts.append(f"最大跌幅 {worst['month']} {delta:+.1f}% — 建议归因分析:促销撤回/客流流失/区域关店等。")
                else:
                    parts.append(f"最大涨幅 {worst['month']} {delta:+.1f}% — 可复盘成功因素用于复制。")
        else:
            parts.append("✅ 期内无月度异常波动。")
        insight_text = " ".join(parts)

        # ECharts: bar chart with colors by anomaly
        data_with_color = []
        for m in months:
            if any("🚨" in f for f in m["flags"]):
                color = "#d32f2f"  # red — alert
            elif any("⚠️" in f for f in m["flags"]):
                color = "#ff9800"  # orange — significant
            elif any("📊" in f for f in m["flags"]):
                color = "#fbc02d"  # yellow — outlier
            else:
                color = "#1e88e5"  # blue — normal
            data_with_color.append({"value": m["revenue"], "itemStyle": {"color": color}})

        chart_config = {
            "type": "bar",
            "title": {"text": "月度营业额 + 异常标记", "left": "center"},
            "tooltip": {
                "trigger": "axis", "axisPointer": {"type": "shadow"},
                "formatter": "{b}: ¥{c}",
            },
            "xAxis": {"type": "category", "data": [m["month"] for m in months]},
            "yAxis": {"type": "value", "name": "营业额 (元)"},
            "series": [{
                "name": "营业额",
                "type": "bar",
                "data": data_with_color,
                "label": {"show": True, "position": "top", "formatter": "{c}"},
            }],
            "grid": {"left": "3%", "right": "8%", "bottom": "10%", "containLabel": True},
        }

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "months": months,
                "anomalies": anomalies,
                "peak": peak,
                "trough": trough,
                "mean_revenue": round(mean, 2),
                "stdev_revenue": round(stdev, 2),
            },
            chart_config=chart_config,
            kpis={
                "anomaly_count": len(anomalies),
                "worst_month": worst["month"] if worst else None,
                "worst_mom_delta_pct": worst.get("mom_delta_pct") if worst else None,
                "peak_month": peak["month"],
                "trough_month": trough["month"],
            },
            insight_text=insight_text,
        )
