"""ChannelAnalysis — 订单来源 × 渠道收入分析.

Groups orders by '订单来源' dimension into four buckets:
  堂食      = 店内桌位单
  外卖平台  = 饿了么 / 美团外卖 / 京东外卖 / 百度外卖
  自有渠道  = 微信 / 支付宝
  其他      = everything else

KPIs: top channel, takeaway share, dine-in share, total channel count.
Chart: ECharts pie by bucket revenue share.
"""
from __future__ import annotations

from typing import Any, Dict, List, Tuple

import polars as pl

from ..compute.base import ComputeBackend
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register

# Bucket membership sets (exact match against 订单来源 values)
_DINE_IN: frozenset = frozenset({"店内桌位单"})
_TAKEAWAY: frozenset = frozenset({"饿了么", "美团外卖", "京东外卖", "百度外卖"})
_OWN_CHANNEL: frozenset = frozenset({"微信", "支付宝"})

_BUCKET_LABEL = "堂食"
_TAKEAWAY_LABEL = "外卖平台"
_OWN_LABEL = "自有渠道"
_OTHER_LABEL = "其他"


def _source_to_bucket(source: str) -> str:
    if source in _DINE_IN:
        return _BUCKET_LABEL
    if source in _TAKEAWAY:
        return _TAKEAWAY_LABEL
    if source in _OWN_CHANNEL:
        return _OWN_LABEL
    return _OTHER_LABEL


@register
class ChannelAnalysis(AnalysisTemplate):

    @property
    def code(self) -> str:
        return "channel_analysis"

    @property
    def title(self) -> str:
        return "渠道订单 & 营收分析"

    def applies(self, schema: DataSchema) -> bool:
        field_names = {f.name for f in schema.fields}
        return "订单来源" in field_names and schema.primary_measure is not None

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df
        measure = schema.primary_measure

        # Cast measure to float; drop rows with null source or measure
        df_work = (
            df
            .with_columns(
                pl.col(measure).cast(pl.Float64, strict=False).alias("_m"),
                pl.col("订单来源").cast(pl.Utf8).alias("_src"),
            )
            .filter(pl.col("_src").is_not_null() & pl.col("_m").is_not_null())
        )

        if df_work.is_empty():
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no valid rows after null filter",
            )

        # --- Group by source ---
        src_agg = (
            df_work
            .group_by("_src")
            .agg([
                pl.len().alias("orders"),
                pl.col("_m").sum().alias("revenue"),
            ])
            .sort("revenue", descending=True)
        )

        total_revenue = float(df_work["_m"].sum() or 0.0)
        total_orders = df_work.height

        by_source: List[Dict[str, Any]] = []
        for row in src_agg.to_dicts():
            src = row["_src"]
            rev = float(row["revenue"])
            cnt = int(row["orders"])
            share = round(rev / total_revenue * 100, 2) if total_revenue > 0 else 0.0
            by_source.append({
                "source": src,
                "orders": cnt,
                "revenue": round(rev, 2),
                "share_pct": share,
            })

        # --- Aggregate into buckets ---
        bucket_totals: Dict[str, Tuple[int, float]] = {
            _BUCKET_LABEL: (0, 0.0),
            _TAKEAWAY_LABEL: (0, 0.0),
            _OWN_LABEL: (0, 0.0),
            _OTHER_LABEL: (0, 0.0),
        }
        for item in by_source:
            bucket = _source_to_bucket(item["source"])
            prev_cnt, prev_rev = bucket_totals[bucket]
            bucket_totals[bucket] = (prev_cnt + item["orders"], prev_rev + item["revenue"])

        by_bucket: List[Dict[str, Any]] = []
        for bucket, (cnt, rev) in bucket_totals.items():
            share = round(rev / total_revenue * 100, 2) if total_revenue > 0 else 0.0
            by_bucket.append({
                "bucket": bucket,
                "orders": cnt,
                "revenue": round(rev, 2),
                "share_pct": share,
            })

        # --- KPIs ---
        top_source = by_source[0] if by_source else None
        top_channel = top_source["source"] if top_source else ""
        top_channel_share = top_source["share_pct"] if top_source else 0.0

        dine_in_rev = bucket_totals[_BUCKET_LABEL][1]
        takeaway_rev = bucket_totals[_TAKEAWAY_LABEL][1]
        dine_in_share = round(dine_in_rev / total_revenue * 100, 2) if total_revenue > 0 else 0.0
        takeaway_share = round(takeaway_rev / total_revenue * 100, 2) if total_revenue > 0 else 0.0
        total_channels = len(by_source)

        # --- ECharts pie (by bucket revenue share) ---
        pie_data = [
            {"name": item["bucket"], "value": item["revenue"]}
            for item in by_bucket
            if item["revenue"] > 0
        ]
        chart_config: Dict[str, Any] = {
            "type": "pie",
            "title": {"text": "各渠道营收占比", "left": "center"},
            "tooltip": {"trigger": "item", "formatter": "{b}: {d}%"},
            "legend": {"orient": "vertical", "left": "left"},
            "series": [
                {
                    "name": "营收",
                    "type": "pie",
                    "radius": "55%",
                    "center": ["50%", "55%"],
                    "data": pie_data,
                    "emphasis": {
                        "itemStyle": {
                            "shadowBlur": 10,
                            "shadowOffsetX": 0,
                            "shadowColor": "rgba(0, 0, 0, 0.5)",
                        }
                    },
                }
            ],
        }

        insight_text = (
            f"堂食占 {dine_in_share:.1f}%,外卖平台占 {takeaway_share:.1f}%;"
            f"最大单一来源 {top_channel} ({top_channel_share:.1f}%)。"
        )

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "by_source": by_source,
                "by_bucket": by_bucket,
            },
            chart_config=chart_config,
            kpis={
                "top_channel": top_channel,
                "top_channel_share": top_channel_share,
                "takeaway_share": takeaway_share,
                "dine_in_share": dine_in_share,
                "total_channels": total_channels,
            },
            insight_text=insight_text,
        )
