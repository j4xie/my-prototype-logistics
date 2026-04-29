"""RefundAnalysis — 退菜/损耗分析 (尽力而为).

qhj 真实数据中 订单状态 99.99% = "已结账", 无撤单/退单行.
模板按三种策略依次探测信号:

  Strategy A: 订单状态 列含非"已结账"值 — 直接计数.
  Strategy B: 系统损益额 / 人工损益额 含正数行 — 视为损耗指示器.
             (损益额为正表示系统核算/人工核算的损耗金额.)
  Strategy C: 整单备注 扫描关键字 "退"/"退菜"/"取消" — 可能退菜标记.

若三策略均无信号 → applies=False, skip_reason 说明.
"""
from __future__ import annotations

from typing import Any, ClassVar, Dict, List, Optional

import polars as pl

from smartbi.capability.contract import RequiresSpec

from ..compute.base import ComputeBackend
from ..restaurant.action_rec_formatter import format_action_rec
from ..schema import DataSchema
from .base import AnalysisTemplate, TemplateResult
from .registry import register

# Status values that indicate refund/cancellation (Strategy A)
_COMPLETED_STATUS = "已结账"

# Loss indicator columns (Strategy B)
_LOSS_COLS = ("系统损益额", "人工损益额")

# Remark column + refund keywords (Strategy C)
_REMARK_COL = "整单备注"
_REFUND_KEYWORDS = ("退", "退菜", "取消")


@register
class RefundAnalysis(AnalysisTemplate):

    sample_queries = [
        "退菜统计",
        "退单分析",
        "撤单原因",
        "损耗多少",
        "退菜次数",
    ]

    # spec §6.1: B 阶段引入 refund_amount 字段后再填
    requires: ClassVar[RequiresSpec | None] = None

    @property
    def code(self) -> str:
        return "refund_analysis"

    @property
    def title(self) -> str:
        return "退菜/损耗分析"

    def applies(self, schema: DataSchema) -> bool:
        """Need at least one candidate signal column."""
        field_names = {f.name for f in schema.fields}
        has_status = "订单状态" in field_names
        has_loss = bool(field_names & set(_LOSS_COLS))
        has_remark = _REMARK_COL in field_names
        return has_status or has_loss or has_remark

    def compute(self, backend: ComputeBackend, schema: DataSchema) -> TemplateResult:
        df = backend._df  # type: ignore[attr-defined]
        cols = set(df.columns)
        total_rows = df.height

        # ── Strategy A: 订单状态 with non-completed values ─────────────────────
        if "订单状态" in cols:
            status_series = df.select(pl.col("订单状态").cast(pl.Utf8, strict=False))
            non_completed = (
                status_series
                .filter(
                    pl.col("订单状态").is_not_null()
                    & (pl.col("订单状态") != _COMPLETED_STATUS)
                )
            )
            if non_completed.height > 0:
                return self._strategy_a(df, non_completed, total_rows)

        # ── Strategy B: loss indicator columns ─────────────────────────────────
        present_loss_cols = [c for c in _LOSS_COLS if c in cols]
        if present_loss_cols:
            loss_rows = self._find_loss_rows(df, present_loss_cols)
            if loss_rows:
                return self._strategy_b(loss_rows, present_loss_cols, total_rows)

        # ── Strategy C: remark keyword scan ────────────────────────────────────
        if _REMARK_COL in cols:
            keyword_rows = self._find_keyword_rows(df)
            if keyword_rows:
                return self._strategy_c(keyword_rows, total_rows)

        # ── All strategies exhausted — no signal ───────────────────────────────
        return TemplateResult(
            code=self.code,
            title=self.title,
            data={},
            applies=False,
            skip_reason="no refund/loss signal in data",
        )

    # ── Strategy A helpers ──────────────────────────────────────────────────────

    def _strategy_a(
        self, df: pl.DataFrame, non_completed: pl.DataFrame, total_rows: int
    ) -> TemplateResult:
        refund_count = non_completed.height
        refund_share_pct = round(refund_count / total_rows * 100, 2) if total_rows > 0 else 0.0

        # Count by status
        by_status_raw = (
            non_completed
            .group_by("订单状态")
            .agg(pl.len().alias("count"))
            .sort("count", descending=True)
            .to_dicts()
        )
        by_status: List[Dict[str, Any]] = [
            {"status": str(r["订单状态"]), "count": int(r["count"])}
            for r in by_status_raw
        ]

        chart_config = {
            "type": "bar",
            "title": {"text": "退单/撤单状态分布", "left": "center"},
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "xAxis": {
                "type": "category",
                "data": [r["status"] for r in by_status],
            },
            "yAxis": {"type": "value", "name": "订单数"},
            "series": [
                {
                    "name": "订单数",
                    "type": "bar",
                    "data": [r["count"] for r in by_status],
                    "itemStyle": {"color": "#ef5350"},
                    "label": {"show": True, "position": "top"},
                }
            ],
        }

        top_status = by_status[0]["status"] if by_status else ""
        top_count = by_status[0]["count"] if by_status else 0
        # Spec §4.3: drive refund cluster into root-cause action
        action_rec = format_action_rec(
            object_target=f"主要异常状态「{top_status}」 ({top_count} 笔)" if by_status
                else f"退单 / 撤单 {refund_count} 笔",
            benefit_range="复盘高频退单原因 + SOP 修订可降退单率 0.5-1.5 个百分点",
            prerequisite="按状态调取退单详情 + 客诉清单 + 服务员复述确认改单",
            timeline="本周内",
        )
        if by_status:
            insight_text = (
                f"共检出 {refund_count} 笔非已结账订单"
                f"（占总单数 {refund_share_pct:.1f}%）。"
                f"主要状态：{top_status} {top_count} 笔。 {action_rec}"
            )
        else:
            insight_text = (
                f"共检出 {refund_count} 笔退单/撤单（占 {refund_share_pct:.1f}%）。 {action_rec}"
            )

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "strategy_used": "A",
                "refund_count": refund_count,
                "refund_share_pct": refund_share_pct,
                "by_status": by_status,
                "total_orders": total_rows,
            },
            chart_config=chart_config,
            kpis={
                "refund_count": refund_count,
                "refund_share_pct": refund_share_pct,
                "strategy": "A",
            },
            insight_text=insight_text,
        )

    # ── Strategy B helpers ──────────────────────────────────────────────────────

    def _find_loss_rows(
        self, df: pl.DataFrame, loss_cols: List[str]
    ) -> List[Dict[str, Any]]:
        """Return rows where any loss column > 0."""
        condition = pl.lit(False)
        for col in loss_cols:
            condition = condition | (
                pl.col(col).cast(pl.Float64, strict=False).fill_null(0.0) > 0
            )
        loss_df = df.filter(condition)
        return loss_df.to_dicts() if loss_df.height > 0 else []

    def _strategy_b(
        self,
        loss_rows: List[Dict[str, Any]],
        loss_cols: List[str],
        total_rows: int,
    ) -> TemplateResult:
        refund_count = len(loss_rows)
        refund_share_pct = round(refund_count / total_rows * 100, 2) if total_rows > 0 else 0.0

        # Aggregate total loss per column
        total_loss_amount = 0.0
        by_loss_category: List[Dict[str, Any]] = []
        for col in loss_cols:
            col_total = sum(
                float(r.get(col) or 0.0)
                for r in loss_rows
                if r.get(col) is not None
            )
            total_loss_amount += col_total
            by_loss_category.append({"category": col, "total": round(col_total, 2)})

        chart_config = {
            "type": "pie",
            "title": {"text": "损耗类型分布", "left": "center"},
            "tooltip": {"trigger": "item"},
            "series": [
                {
                    "name": "损耗金额",
                    "type": "pie",
                    "radius": "60%",
                    "data": [
                        {"name": b["category"], "value": b["total"]}
                        for b in by_loss_category
                        if b["total"] > 0
                    ],
                    "label": {"formatter": "{b}: {d}%"},
                }
            ],
        }

        # Spec §4.3: drive loss amount into cost-control action
        action_rec = format_action_rec(
            object_target=f"损耗 {refund_count} 笔 / 累计 {total_loss_amount:,.0f} 元",
            benefit_range="复盘高频损耗原因 + 流程改善可降损耗 20-40%",
            prerequisite="按门店 / 班次 / 菜品分组分析损耗 + 厨师长例会复盘",
            timeline="本月内",
        )
        insight_text = (
            f"发现 {refund_count} 笔损耗记录（占 {refund_share_pct:.1f}%），"
            f"合计损益额 {total_loss_amount:,.2f} 元。"
            f"数据来源：{'、'.join(loss_cols)}。 {action_rec}"
        )

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "strategy_used": "B",
                "refund_count": refund_count,
                "refund_share_pct": refund_share_pct,
                "by_loss_category": by_loss_category,
                "total_orders": total_rows,
            },
            chart_config=chart_config,
            kpis={
                "refund_count": refund_count,
                "refund_share_pct": refund_share_pct,
                "strategy": "B",
                "total_loss_amount": round(total_loss_amount, 2),
            },
            insight_text=insight_text,
        )

    # ── Strategy C helpers ──────────────────────────────────────────────────────

    def _find_keyword_rows(self, df: pl.DataFrame) -> List[Dict[str, Any]]:
        """Return rows where 整单备注 contains any refund keyword."""
        remark_series = df.select(
            pl.col(_REMARK_COL).cast(pl.Utf8, strict=False).fill_null("")
        )
        # Build combined regex for OR of keywords
        pattern = "|".join(_REFUND_KEYWORDS)
        mask = remark_series.select(
            pl.col(_REMARK_COL).str.contains(pattern).alias("_match")
        )["_match"]
        matched = df.filter(mask)
        return matched.to_dicts() if matched.height > 0 else []

    def _strategy_c(
        self, keyword_rows: List[Dict[str, Any]], total_rows: int
    ) -> TemplateResult:
        refund_count = len(keyword_rows)
        refund_share_pct = round(refund_count / total_rows * 100, 2) if total_rows > 0 else 0.0

        # Collect sample remarks for display
        sample_remarks: List[str] = []
        for r in keyword_rows[:10]:
            remark = r.get(_REMARK_COL)
            if remark:
                sample_remarks.append(str(remark))

        chart_config = {
            "type": "bar",
            "title": {"text": "含退菜关键字备注分布 (Top 10 样本)", "left": "center"},
            "tooltip": {"trigger": "axis"},
            "xAxis": {"type": "category", "data": list(range(1, len(sample_remarks) + 1))},
            "yAxis": {"type": "value", "name": "样本序号"},
            "series": [
                {
                    "name": "备注样本",
                    "type": "bar",
                    "data": [1] * len(sample_remarks),
                    "label": {
                        "show": True, "position": "top",
                        "formatter": "{c}",
                    },
                }
            ],
        }

        # Spec §4.3: drive remark-keyword finding into manual verify + root cause
        action_rec = format_action_rec(
            object_target=f"备注疑似退菜 {refund_count} 条 (占 {refund_share_pct:.1f}%)",
            benefit_range="人工核实 + 客诉对账后定位高频退菜菜品 / 服务员,定向培训降发生率 30-50%",
            prerequisite="抽样 50 条备注复核 + 服务员 / 厨师长走访 + SOP 修订",
            timeline="本周内",
        )
        insight_text = (
            f"在 {_REMARK_COL} 中发现 {refund_count} 条含退菜关键字的记录"
            f"（占 {refund_share_pct:.1f}%）。"
            f"注意：此为模糊文本匹配，实际退菜数量需人工核实。 {action_rec}"
        )

        return TemplateResult(
            code=self.code,
            title=self.title,
            data={
                "strategy_used": "C",
                "refund_count": refund_count,
                "refund_share_pct": refund_share_pct,
                "sample_remarks": sample_remarks,
                "total_orders": total_rows,
            },
            chart_config=chart_config,
            kpis={
                "refund_count": refund_count,
                "refund_share_pct": refund_share_pct,
                "strategy": "C",
            },
            insight_text=insight_text,
        )
