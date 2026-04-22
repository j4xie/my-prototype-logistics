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
from ..restaurant.schema_helpers import find_customer_col
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
        cust_col = find_customer_col(df.columns)

        # Cast measure to float; drop rows with null source or measure
        extra_exprs = []
        if cust_col:
            extra_exprs.append(
                pl.col(cust_col).cast(pl.Float64, strict=False).fill_null(0.0).alias("_cust")
            )
        df_work = (
            df
            .with_columns(
                pl.col(measure).cast(pl.Float64, strict=False).alias("_m"),
                pl.col("订单来源").cast(pl.Utf8).alias("_src"),
                *extra_exprs,
            )
            .filter(pl.col("_src").is_not_null() & pl.col("_m").is_not_null())
        )

        if df_work.is_empty():
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no valid rows after null filter",
            )

        # --- Group by source ---
        src_agg_exprs = [
            pl.len().alias("orders"),
            pl.col("_m").sum().alias("revenue"),
        ]
        if cust_col:
            src_agg_exprs.append(pl.col("_cust").sum().alias("customers"))

        src_agg = (
            df_work
            .group_by("_src")
            .agg(src_agg_exprs)
            .sort("revenue", descending=True)
        )

        total_revenue = float(df_work["_m"].sum() or 0.0)
        total_orders = df_work.height
        total_customers = float(df_work["_cust"].sum() or 0.0) if cust_col else 0.0

        by_source: List[Dict[str, Any]] = []
        for row in src_agg.to_dicts():
            src = row["_src"]
            rev = float(row["revenue"])
            cnt = int(row["orders"])
            cust = float(row.get("customers") or 0.0) if cust_col else 0.0
            share = round(rev / total_revenue * 100, 2) if total_revenue > 0 else 0.0
            # 客单价 (Q-A #15) — per-customer and per-order variants
            avg_per_order = round(rev / cnt, 2) if cnt > 0 else 0.0
            avg_per_customer = round(rev / cust, 2) if cust > 0 else None
            by_source.append({
                "source": src,
                "orders": cnt,
                "revenue": round(rev, 2),
                "share_pct": share,
                "customers": int(cust) if cust_col else None,
                "avg_per_order": avg_per_order,
                "avg_per_customer": avg_per_customer,
            })

        # --- Aggregate into buckets (也加 customers / avg 指标) ---
        # 数据结构: bucket -> [orders, revenue, customers]
        bucket_totals: Dict[str, List[float]] = {
            _BUCKET_LABEL: [0, 0.0, 0.0],
            _TAKEAWAY_LABEL: [0, 0.0, 0.0],
            _OWN_LABEL: [0, 0.0, 0.0],
            _OTHER_LABEL: [0, 0.0, 0.0],
        }
        for item in by_source:
            bucket = _source_to_bucket(item["source"])
            bucket_totals[bucket][0] += item["orders"]
            bucket_totals[bucket][1] += item["revenue"]
            if cust_col and item.get("customers") is not None:
                bucket_totals[bucket][2] += item["customers"]

        by_bucket: List[Dict[str, Any]] = []
        for bucket, (cnt, rev, cust) in bucket_totals.items():
            cnt = int(cnt)
            share = round(rev / total_revenue * 100, 2) if total_revenue > 0 else 0.0
            avg_per_order = round(rev / cnt, 2) if cnt > 0 else 0.0
            avg_per_customer = round(rev / cust, 2) if cust_col and cust > 0 else None
            by_bucket.append({
                "bucket": bucket,
                "orders": cnt,
                "revenue": round(rev, 2),
                "share_pct": share,
                "customers": int(cust) if cust_col else None,
                "avg_per_order": avg_per_order,
                "avg_per_customer": avg_per_customer,
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

        # Q-A #15 — add 客单价细分 to insight when customer column present
        dine_in_avg = next(
            (b["avg_per_customer"] for b in by_bucket if b["bucket"] == _BUCKET_LABEL),
            None,
        )
        takeaway_avg = next(
            (b["avg_per_customer"] for b in by_bucket if b["bucket"] == _TAKEAWAY_LABEL),
            None,
        )
        parts = [
            f"堂食占 {dine_in_share:.1f}%,外卖平台占 {takeaway_share:.1f}%;"
            f"最大单一来源 {top_channel} ({top_channel_share:.1f}%)。"
        ]
        if dine_in_avg is not None and takeaway_avg is not None:
            parts.append(
                f" 客单价:堂食 {dine_in_avg:.0f} 元 vs 外卖 {takeaway_avg:.0f} 元。"
            )
        elif dine_in_avg is not None:
            parts.append(f" 堂食客单价 {dine_in_avg:.0f} 元。")
        elif takeaway_avg is not None:
            parts.append(f" 外卖客单价 {takeaway_avg:.0f} 元。")
        insight_text = "".join(parts)

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "by_source": by_source,
                "by_bucket": by_bucket,
                "has_customer_data": cust_col is not None,
            },
            chart_config=chart_config,
            kpis={
                "top_channel": top_channel,
                "top_channel_share": top_channel_share,
                "takeaway_share": takeaway_share,
                "dine_in_share": dine_in_share,
                "total_channels": total_channels,
                "dine_in_avg_per_customer": dine_in_avg,
                "takeaway_avg_per_customer": takeaway_avg,
            },
            insight_text=insight_text,
        )
