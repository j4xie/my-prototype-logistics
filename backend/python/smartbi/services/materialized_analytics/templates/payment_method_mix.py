"""PaymentMethodMix — 付款方式报表分析.

Triggered by uploads where each row = one store and columns are payment-
method amounts/counts (付款方式报表 format from 夯食/钱塘/花园/绍荟宴).

Columns seen: 门店名称 + [饿了么]/[美团]/[微信]/[云闪付]/[支付宝]/POS刷卡/
点评代金券/点评买单/点评套餐/抖音代金券/... — typically 80+ columns paired as
(platform amount, platform count).

This template detects payment columns by name patterns and bucketized them:
  现金 / 银行卡(POS/云闪付) / 移动支付(微信/支付宝) / 平台券(点评/美团/抖音/饿了么) /
  储值卡 / 其他

Outputs bucket shares + top individual methods + per-store breakdown.
Complements groupon_channel_breakdown which only looks at voucher platforms.
"""
from __future__ import annotations

from typing import Any, ClassVar, Dict, List, Optional

import polars as pl

from smartbi.capability.contract import RequiresSpec

from ..compute.base import ComputeBackend
from ..restaurant.action_rec_formatter import format_action_rec
from ..restaurant.schema_helpers import find_store_col
from ..schema import DataSchema, Domain
from .base import AnalysisTemplate, TemplateResult
from .registry import register

# Pattern rules — first rule that matches wins. Order = specificity.
_BUCKET_RULES = [
    ("现金", [
        lambda c: c in ("现金", "现金支付", "现金收款"),
    ]),
    ("银行卡", [
        lambda c: "POS" in c or c in ("银行卡", "云闪付", "[云闪付]", "刷卡", "POS刷卡"),
    ]),
    ("移动支付", [
        lambda c: c in ("微信", "[微信]", "支付宝", "[支付宝]", "微信支付", "支付宝支付")
                  or c.startswith("[微信") or c.startswith("[支付宝"),
    ]),
    ("储值卡/会员卡", [
        lambda c: any(k in c for k in ("储值卡", "会员卡")),
    ]),
    ("点评券", [
        lambda c: c.startswith("点评") or c.startswith("[点评"),
    ]),
    ("美团券", [
        lambda c: c.startswith("美团") or c.startswith("[美团") or c.startswith("新美大"),
    ]),
    ("抖音券", [
        lambda c: c.startswith("抖音") or c.startswith("[抖音"),
    ]),
    ("饿了么券", [
        lambda c: c.startswith("饿了么") or c.startswith("[饿了么"),
    ]),
    ("京东券", [
        lambda c: c.startswith("京东") or c.startswith("[京东"),
    ]),
]

# Non-payment columns to skip
_SKIP_COLUMNS = ("门店名称", "店铺名称", "门店", "店铺", "日期", "订单数", "单数", "备注")
# Columns with explicit "count" suffix — skip from amount sum (avoid double counting)
_COUNT_SUFFIXES = ("单数", "笔数", "次数", "数量", "份数")


def _classify(col: str) -> Optional[str]:
    """Return bucket label for a payment-method column, or None if not recognized."""
    if col in _SKIP_COLUMNS or col.endswith(_COUNT_SUFFIXES) or col.startswith("("):
        return None
    for bucket, rules in _BUCKET_RULES:
        for r in rules:
            try:
                if r(col):
                    return bucket
            except Exception:
                continue
    return None


@register
class PaymentMethodMix(AnalysisTemplate):

    sample_queries = [
        "付款方式占比",
        "支付方式分布",
        "现金移动支付比例",
        "各付款方式金额",
        "支付渠道分析",
    ]

    # spec §6.1: B 阶段引入 payment_channel 字段后再填
    requires: ClassVar[RequiresSpec | None] = None

    @property
    def code(self) -> str:
        return "payment_method_mix"

    @property
    def title(self) -> str:
        return "付款方式分布"

    def applies(self, schema: DataSchema) -> bool:
        if schema.domain not in (Domain.RESTAURANT, Domain.UNKNOWN):
            return False
        names = [f.name for f in schema.fields]
        # Need at least 3 identifiable payment-method columns + a store column
        store_found = find_store_col(names) is not None
        pm_count = sum(1 for c in names if _classify(c))
        return store_found and pm_count >= 3

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df  # type: ignore[attr-defined]
        cols = list(df.columns)
        store_col = find_store_col(cols)

        # Group columns into buckets
        bucket_cols: Dict[str, List[str]] = {}
        individual_cols: List[str] = []
        for c in cols:
            bucket = _classify(c)
            if bucket is None:
                continue
            bucket_cols.setdefault(bucket, []).append(c)
            individual_cols.append(c)

        if not bucket_cols:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no recognized payment-method columns",
            )

        # Sum each column globally, but drop sentinel rows:
        # qhj exports embed a row with payment cols aggregated into single
        # giant value. Any per-row value >10M is definitively a meta-row.
        _SENTINEL = 10_000_000.0
        col_amounts: Dict[str, float] = {}
        for c in individual_cols:
            try:
                amt = float(df.filter(
                    pl.col(c).cast(pl.Float64, strict=False).fill_null(0.0) < _SENTINEL
                ).select(
                    pl.col(c).cast(pl.Float64, strict=False).fill_null(0.0).sum()
                ).item() or 0.0)
                col_amounts[c] = amt
            except Exception:
                col_amounts[c] = 0.0

        # Bucket totals
        buckets: List[Dict[str, Any]] = []
        grand_total = 0.0
        for b, cs in bucket_cols.items():
            amt = sum(col_amounts.get(c, 0.0) for c in cs)
            buckets.append({
                "bucket": b, "amount": round(amt, 2),
                "column_count": len(cs), "columns": cs,
            })
            grand_total += amt

        for b in buckets:
            # C-rec 7 (Apr 25 2026): explicit amount basis (no per-method bills count
            # in this template — payment method mix is amount-only by design).
            b["share_pct"] = round(b["amount"] / grand_total * 100, 2) if grand_total > 0 else 0.0
            b["share_amount_pct"] = b["share_pct"]
            b["share_basis"] = "amount"
        buckets.sort(key=lambda x: x["amount"], reverse=True)

        # Top individual methods
        top_methods = sorted(
            [{"column": c, "amount": round(a, 2)} for c, a in col_amounts.items() if a > 0],
            key=lambda x: x["amount"], reverse=True,
        )[:15]
        for m in top_methods:
            m["share_pct"] = round(m["amount"] / grand_total * 100, 2) if grand_total > 0 else 0.0

        # Per-store breakdown (top stores by total payment amount)
        by_store: List[Dict[str, Any]] = []
        if store_col and individual_cols:
            sum_expr = pl.lit(0.0)
            for c in individual_cols:
                sum_expr = sum_expr + pl.col(c).cast(pl.Float64, strict=False).fill_null(0.0)
            rows = (
                df.filter(pl.col(store_col).is_not_null())
                .with_columns(sum_expr.alias("_total_pay"))
                .group_by(store_col)
                .agg(pl.col("_total_pay").sum().alias("total"))
                .sort("total", descending=True)
                .head(10).to_dicts()
            )
            by_store = [
                {"store": str(r.get(store_col) or "<空>"), "amount": round(float(r["total"] or 0.0), 2)}
                for r in rows
            ]

        # C-rec 7: explicit amount basis on every percentage
        top_bucket = buckets[0] if buckets else None
        parts = [f"付款方式合计 {grand_total:,.0f} 元[毛/收款金额] (覆盖 {len(individual_cols)} 个方式)。"]
        if top_bucket:
            parts.append(
                f"最大类别:{top_bucket['bucket']} {top_bucket['amount']:,.0f} 元 "
                f"({top_bucket['share_pct']:.1f}%[按金额])。"
            )
        if len(buckets) >= 3:
            mix_str = "、".join(f"{b['bucket']} {b['share_pct']:.1f}%[按金额]" for b in buckets[:4])
            parts.append(f"结构:{mix_str}。")

        # K2 / C-rec 8: append spec §4.3 action rec (a对象 b收益区间 c前置 d时间窗)
        # Identify voucher/coupon-heavy buckets — they carry platform commission ~20%
        # so high voucher share = margin leak opportunity
        voucher_buckets = {"点评券", "美团券", "抖音券", "饿了么券", "京东券"}
        voucher_share = sum(
            b["share_pct"] for b in buckets if b["bucket"] in voucher_buckets
        )
        cash_share = next(
            (b["share_pct"] for b in buckets if b["bucket"] == "现金"), 0.0
        )
        if voucher_share >= 30.0 and top_bucket:
            action_rec = format_action_rec(
                object_target=f"平台券类支付 ({voucher_share:.1f}%)",
                benefit_range="降低券依赖度 5-10pp 可减少平台佣金 1-2 万/月/店",
                prerequisite="对账核算佣金率 + 自有储值卡/会员卡推广承接",
                timeline="本季度内",
            )
        elif cash_share >= 20.0:
            action_rec = format_action_rec(
                object_target=f"现金支付 ({cash_share:.1f}%)",
                benefit_range="推广移动支付 + 储值卡可降现金管理成本 30-50%",
                prerequisite="移动支付二维码醒目展示 + 储值卡赠送活动",
                timeline="本月内",
            )
        elif top_bucket:
            action_rec = format_action_rec(
                object_target=f"{top_bucket['bucket']} ({top_bucket['share_pct']:.1f}%)",
                benefit_range=f"该渠道继续做厚, 预计带量 5-10% / 节约其他渠道运营投入",
                prerequisite="该渠道客户偏好画像 + 留存活动设计",
                timeline="本月内",
            )
        else:
            action_rec = ""

        if action_rec:
            parts.append(action_rec)
        insight_text = " ".join(parts)

        chart_config = None
        if buckets:
            chart_config = {
                "type": "pie",
                "title": {"text": "付款方式占比", "left": "center"},
                "tooltip": {"trigger": "item", "formatter": "{b}: {c} 元 ({d}%)"},
                "legend": {"top": 30},
                "series": [{
                    "name": "金额", "type": "pie", "radius": ["30%", "65%"],
                    "data": [
                        {"name": b["bucket"], "value": b["amount"]}
                        for b in buckets if b["amount"] > 0
                    ],
                }],
            }

        return TemplateResult(
            code=self.code, title=self.title,
            data={
                "grand_total": round(grand_total, 2),
                "buckets": buckets,
                "top_methods": top_methods,
                "by_store": by_store,
                # C-rec 7: explicit basis info
                "share_basis_note": "share_pct=按金额(收款金额)占比；本模板无每方式bills计数，bills占比不可用",
                "amount_basis": "毛/收款金额",
            },
            chart_config=chart_config,
            kpis={
                "grand_total": round(grand_total, 2),
                "top_bucket": top_bucket["bucket"] if top_bucket else None,
                "top_bucket_share_pct": top_bucket["share_pct"] if top_bucket else None,
                "top_bucket_share_amount_pct": top_bucket["share_pct"] if top_bucket else None,
                "method_count": len(individual_cols),
                "share_basis_default": "amount",
            },
            insight_text=insight_text,
        )
