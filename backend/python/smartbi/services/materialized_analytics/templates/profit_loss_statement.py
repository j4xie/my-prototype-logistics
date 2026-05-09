"""ProfitLossStatement — 利润表 (营收侧, 成本缺口显式标注).

qhj-style POS orders typically carry revenue-side columns but NO cost columns
(食材成本 / 人工成本 / 房租 / 水电). So this template honestly reports the
revenue structure pipeline:

    总营业额 (应收)
      ↓ 折扣额
      ↓ 代金券优惠
      ↓ 分摊优惠
      ↓ 外卖平台抽成(估算: 应收 - 实收)
    实收额 (到账)

and flags in the insight_text that cost-side data is missing → no true gross-
margin calculation. When cost columns DO show up (e.g., 食材成本 / 成本), the
template auto-detects them and extends the pipeline.

Breakdown optionally by 门店名称 for the chart.

Applies when either 应收金额 OR 营业额 is in schema (has a gross-revenue number).
"""
from __future__ import annotations

from typing import Any, ClassVar, Dict, List

import polars as pl

from smartbi.capability.contract import RequiresSpec

from ..compute.base import ComputeBackend
from ..restaurant.action_rec_formatter import format_action_rec, format_data_insufficient
from ..restaurant.schema_helpers import find_store_col
from ..schema import DataSchema, Domain
from .base import AnalysisTemplate, TemplateResult
from .registry import register

# Revenue pipeline columns (ordered top to bottom in the funnel)
_GROSS_CANDIDATES = ("应收金额", "营业额", "收款金额")
_NET_CANDIDATES = ("实收额", "实收", "实收金额")
_DEDUCTION_COLS = [
    ("折扣额", "折扣扣减"),
    ("代金券优惠", "代金券扣减"),
    ("分摊优惠", "分摊优惠"),
    ("优惠额", "优惠扣减"),
    ("外送费", "外送费"),
    ("服务费", "服务费"),
    ("税费", "税费"),
]
_COST_COLS = ("食材成本", "成本", "采购成本", "商品成本")
_TOP_STORES = 10


@register
class ProfitLossStatement(AnalysisTemplate):

    sample_queries = [
        "利润表",
        "毛利分析",
        "净利统计",
        "损益对比",
        "应收实收",
        "到账率",
        "毛利率",
    ]

    requires: ClassVar[RequiresSpec | None] = RequiresSpec(
        all=["date", "gross_amount", "discount_amount", "net_amount"],
        description="利润损益表",
    )

    @property
    def code(self) -> str:
        return "profit_loss_statement"

    @property
    def title(self) -> str:
        return "利润表 (营收结构)"

    def applies(self, schema: DataSchema) -> bool:
        if schema.domain not in (Domain.RESTAURANT, Domain.UNKNOWN):
            return False
        names = {f.name for f in schema.fields}
        return bool(names & set(_GROSS_CANDIDATES))

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df  # type: ignore[attr-defined]
        cols = set(df.columns)

        gross_col = next((c for c in _GROSS_CANDIDATES if c in cols), None)
        net_col = next((c for c in _NET_CANDIDATES if c in cols), None)

        if gross_col is None:
            return TemplateResult(
                code=self.code, title=self.title, data={},
                applies=False, skip_reason="no gross-revenue column present",
            )

        # Filter out grand-total sentinel rows: qhj exports embed a single
        # row with 桌位=null and revenue=92.8M (integrated sum of all orders).
        # Any row with gross > 10M is definitely a meta-aggregate, not a
        # normal single-order row — skip to prevent 3×+ inflation.
        _SENTINEL_THRESHOLD = 10_000_000.0
        try:
            df_clean = df.filter(
                pl.col(gross_col).cast(pl.Float64, strict=False).fill_null(0.0) < _SENTINEL_THRESHOLD
            )
        except Exception:
            df_clean = df

        def _sum(col: str) -> float:
            try:
                return float(df_clean.select(
                    pl.col(col).cast(pl.Float64, strict=False).fill_null(0.0).sum()
                ).item() or 0.0)
            except Exception:
                return 0.0

        gross = _sum(gross_col)
        net = _sum(net_col) if net_col else 0.0

        deductions: List[Dict[str, Any]] = []
        for col, label in _DEDUCTION_COLS:
            if col in cols:
                amt = _sum(col)
                if abs(amt) > 0.01:
                    deductions.append({"label": label, "column": col, "amount": round(amt, 2)})

        cost_found = [c for c in _COST_COLS if c in cols]
        costs: List[Dict[str, Any]] = []
        for col in cost_found:
            amt = _sum(col)
            if abs(amt) > 0.01:
                costs.append({"label": col, "column": col, "amount": round(amt, 2)})

        # Compute "implicit platform cut" = gross - net - explicit_deductions
        # Only informative when net_col present AND non-zero
        explicit_deduction = sum(d["amount"] for d in deductions)
        implicit = gross - net - explicit_deduction if (net_col and net > 0) else 0.0
        has_implicit = net_col is not None and implicit > (gross * 0.005)
        if has_implicit:
            deductions.append({
                "label": "平台抽成/其他 (估算)",
                "column": "(gross − net − explicit)",
                "amount": round(implicit, 2),
            })

        total_cost = sum(c["amount"] for c in costs)
        gross_profit = (net if net_col else (gross - explicit_deduction)) - total_cost
        has_cost = bool(costs)

        # Per-store top breakdown (optional chart)
        by_store: List[Dict[str, Any]] = []
        store_col = find_store_col(cols)
        if store_col:
            agg_exprs = [
                pl.col(gross_col).cast(pl.Float64, strict=False).fill_null(0.0).sum().alias("gross"),
            ]
            if net_col:
                agg_exprs.append(
                    pl.col(net_col).cast(pl.Float64, strict=False).fill_null(0.0).sum().alias("net")
                )
            store_rows = (
                df.filter(pl.col(store_col).is_not_null())
                .group_by(store_col)
                .agg(agg_exprs)
                .sort("gross", descending=True)
                .head(_TOP_STORES)
                .to_dicts()
            )
            for r in store_rows:
                g = float(r.get("gross") or 0.0)
                n = float(r.get("net") or 0.0) if net_col else None
                by_store.append({
                    "store": str(r.get(store_col) or "<空>"),
                    "gross": round(g, 2),
                    "net": round(n, 2) if n is not None else None,
                    "net_margin_pct": round(n / g * 100, 2) if n and g > 0 else None,
                })

        net_share = round(net / gross * 100, 2) if net_col and gross > 0 else None

        # Waterfall data (gross → deduction legs → net)
        waterfall_nodes: List[Dict[str, Any]] = [
            {"name": "应收", "value": round(gross, 2), "type": "total"},
        ]
        for d in deductions:
            waterfall_nodes.append({
                "name": d["label"], "value": round(d["amount"], 2), "type": "deduction",
            })
        if net_col:
            waterfall_nodes.append({"name": "实收", "value": round(net, 2), "type": "total"})
        for c in costs:
            waterfall_nodes.append({
                "name": c["label"], "value": round(c["amount"], 2), "type": "cost",
            })
        if has_cost:
            waterfall_nodes.append({
                "name": "毛利(估算)", "value": round(gross_profit, 2), "type": "total",
            })

        # Build insight — C-rec 7 (Apr 25 2026): explicit [毛]/[净] tags so AI
        # never blurs gross-side and net-side amounts in the same answer.
        parts: List[str] = []
        parts.append(f"应收合计 {gross:,.0f} 元[毛/应收口径]。")
        if net_col:
            parts.append(f"实收 {net:,.0f} 元[净/到账口径] (到账率 {net_share:.1f}%[按营业额])。")
        if deductions:
            top_ded = max(deductions, key=lambda d: d["amount"])
            parts.append(
                f"最大扣减项:{top_ded['label']} {top_ded['amount']:,.0f} 元[毛-净 差额口径]。"
            )
        if has_cost:
            parts.append(
                f"毛利估算 {gross_profit:,.0f} 元[毛利口径] (已扣成本 {total_cost:,.0f} 元)。"
            )
        else:
            parts.append(
                "⚠ 成本/人工/房租等数据未在上传中，无法计算真毛利/净利 — 仅展示营收结构（has_cost_data=false）。"
            )
        # Spec §4.3: drive top deduction or net-share gap into action
        if not has_cost:
            action_rec = format_data_insufficient(
                needed="补充成本 / 人工 / 房租数据 (建议上传财务月报或采购明细)",
                next_action="联系财务部对接月度成本科目导出 + 上传到本系统",
            )
        elif net_share is not None and net_share < 80:
            action_rec = format_action_rec(
                object_target=f"到账率仅 {net_share:.1f}% (毛-净差额 {gross - net:,.0f} 元)",
                benefit_range="收紧折扣阈值 + 协商平台抽成 + 减少分摊优惠可提净利率 1-3 个百分点",
                prerequisite="按扣减项目排序复盘 + 修订折扣权限 + 重谈外卖平台抽成",
                timeline="本月内",
            )
        elif deductions:
            top_ded = max(deductions, key=lambda d: d["amount"])
            ded_share = round(top_ded['amount'] / gross * 100, 1) if gross > 0 else 0
            action_rec = format_action_rec(
                object_target=f"最大扣减项「{top_ded['label']}」 ({top_ded['amount']:,.0f} 元 / {ded_share:.1f}%)",
                benefit_range=f"{top_ded['label']}收紧阈值或重谈条款可降扣减 10-25%,提净利率 0.5-2 pct",
                prerequisite=f"复盘{top_ded['label']}触发场景 + 流程加锁 + 谈判方案",
                timeline="本月内",
            )
        else:
            action_rec = format_action_rec(
                object_target=f"利润结构 (毛利估算 {gross_profit:,.0f} 元)",
                benefit_range="持续监控成本结构 + 季度对比可维持净利率 +1 pct",
                prerequisite="月度财务对账 + 季度成本结构分析",
                timeline="本月内",
            )
        insight_text = " ".join(parts) + " " + action_rec

        # ECharts — use horizontal bar for waterfall nodes (simple, robust)
        chart_config = {
            "type": "bar",
            "title": {"text": "营收结构瀑布 (从应收到实收)", "left": "center"},
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "xAxis": {
                "type": "category",
                "data": [n["name"] for n in waterfall_nodes],
                "axisLabel": {"rotate": 30, "interval": 0, "fontSize": 10},
            },
            "yAxis": {"type": "value", "name": "金额 (元)"},
            "series": [{
                "name": "金额",
                "type": "bar",
                "data": [
                    {
                        "value": n["value"],
                        "itemStyle": {
                            "color": {
                                "total": "#1e88e5",
                                "deduction": "#ef5350",
                                "cost": "#fb8c00",
                            }.get(n["type"], "#757575")
                        },
                    }
                    for n in waterfall_nodes
                ],
                "label": {"show": True, "position": "top", "formatter": "{c}"},
            }],
            "grid": {"left": "3%", "right": "8%", "bottom": "25%", "containLabel": True},
        }

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "gross_revenue": round(gross, 2),
                "net_revenue": round(net, 2) if net_col else None,
                "net_share_pct": net_share,
                "deductions": deductions,
                "costs": costs,
                "gross_profit_estimate": round(gross_profit, 2) if has_cost else None,
                "has_cost_data": has_cost,
                "by_store_top": by_store,
                "waterfall": waterfall_nodes,
                # C-rec 7: explicit basis labels so AI knows gross vs net
                "gross_basis_label": "[毛/应收口径]",
                "net_basis_label": "[净/到账口径]",
                "net_share_basis": "按营业额(应收→实收)",
            },
            chart_config=chart_config,
            kpis={
                "gross_revenue": round(gross, 2),
                "net_revenue": round(net, 2) if net_col else None,
                "net_share_pct": net_share,
                "total_deductions": round(sum(d["amount"] for d in deductions), 2),
                "has_cost_data": has_cost,
                # C-rec 7
                "gross_basis_label": "[毛/应收口径]",
                "net_basis_label": "[净/到账口径]",
            },
            insight_text=insight_text,
        )
