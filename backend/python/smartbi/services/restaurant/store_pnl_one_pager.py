"""单店 P&L 一页纸 — Week 4.1 (销售杀手)

设计依据 (来自 Researcher C "漏项 #3"):
  - 老板每天第一眼看的不是图表, 是"这个月赚/亏多少, 为什么"
  - 单店 P&L 一页纸 = 工程成本 <1 周, 销售价值爆炸
  - 本质: 拼装现有 18 方法 + W2-3 的 diagnostics + benchmark_alerts 成一张纸

这不是新计算, 是**编排层** — 把已经算好的数据拼成老板能懂的结构:

  ┌────────────────────────────────────────────┐
  │ 鼎鲜火锅·义乌 2026-02 经营 P&L           │
  │ ─────────────────────────────────────  │
  │ 营业收入     ¥731,048   环比 -47.4% 🔻   │
  │ 食材成本     ¥335,213   占比 45.85% 🟡    │
  │ 人力成本     ¥237,660   占比 32.51% 🟡    │
  │ 房租        ¥57,328    占比 7.84%        │
  │ ──────────────────                      │
  │ 净利润       -¥49,724   🔴 亏损 6.80%    │
  │                                          │
  │ 诊断 TOP 3:                              │
  │ 🔴 成本弹性指数 0.561 (健康 ≥0.85)       │
  │ 🟡 食材成本率超上限, 年损 ¥250K          │
  │ 🟡 人力成本率超上限, 年损 ¥220K          │
  │                                          │
  │ 同店同比 / 渠道毛利率 / 诊断建议 / ...    │
  └────────────────────────────────────────────┘

使用示例:
    >>> from services.restaurant.store_pnl_one_pager import StorePnlOnePager
    >>> pager = StorePnlOnePager()
    >>> report = pager.build(
    ...     financial_metrics={"revenue": 731047, ...},
    ...     diagnostics=[...],
    ...     benchmark_alerts=[...],
    ...     channel_margin={...},
    ...     temporal_comparison=None,  # 可选
    ...     store_name="鼎鲜火锅·义乌",
    ...     period="2026-02",
    ...     sub_sector="火锅",
    ... )
    >>> print(report.to_dict())
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal, Optional

logger = logging.getLogger(__name__)


# ── Result types ────────────────────────────────────────────


@dataclass
class PnlLineItem:
    """P&L 单行: 科目 + 金额 + 占比 + 环比"""
    label: str                           # 例: "营业收入"
    amount: float                        # 金额
    pct_of_revenue: Optional[float]      # 占营收比例 (0-1)
    change_pct: Optional[float]          # 环比变化 (0-1)
    status_emoji: str                    # 🟢/🟡/🔴/🔻/➡️
    note: Optional[str] = None           # 补充说明

    def to_dict(self) -> dict:
        return {
            "label": self.label,
            "amount": round(self.amount, 2),
            "pctOfRevenue": round(self.pct_of_revenue, 4) if self.pct_of_revenue is not None else None,
            "changePct": round(self.change_pct, 4) if self.change_pct is not None else None,
            "statusEmoji": self.status_emoji,
            "note": self.note,
        }


@dataclass
class DiagnosticBrief:
    """诊断简报 (for 一页纸的 TOP 3 诊断区)"""
    severity_emoji: str                  # 🔴/🟡/ℹ️
    title: str                           # 例: "成本弹性指数 0.561 (健康 ≥0.85)"
    one_liner: str                       # 一句话总结
    action_hint: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "severityEmoji": self.severity_emoji,
            "title": self.title,
            "oneLiner": self.one_liner,
            "actionHint": self.action_hint,
        }


@dataclass
class ChannelSummaryRow:
    """渠道一页纸简短摘要"""
    channel: str
    revenue: float
    revenue_pct: float                   # 占总营收比例
    gross_margin_pct: float
    emoji: str                           # 🟢/🟡/🔴

    def to_dict(self) -> dict:
        return {
            "channel": self.channel,
            "revenue": round(self.revenue, 2),
            "revenuePct": round(self.revenue_pct, 4),
            "grossMarginPct": round(self.gross_margin_pct, 4),
            "emoji": self.emoji,
        }


@dataclass
class StorePnlOnePagerReport:
    """单店 P&L 一页纸完整结构"""
    store_name: str
    period: str
    sub_sector: str

    # P&L 主表 (4-6 行: 营收/食材/人力/租金/其他/净利)
    pnl_lines: list[PnlLineItem]
    headline: str                        # 顶部大字, 例 "2026-02 净亏 ¥49,724 (-6.80%)"
    headline_color: Literal["green", "yellow", "red"]

    # 关键指标 (3-4 个 KPI)
    kpi_food_cost_ratio: Optional[float]
    kpi_labor_cost_ratio: Optional[float]
    kpi_cost_rigidity: Optional[float]
    kpi_net_margin: Optional[float]

    # 诊断 TOP 3 (from diagnostics_engine output)
    top_diagnostics: list[DiagnosticBrief]

    # 渠道分布 (TOP 5 渠道简短摘要)
    top_channels: list[ChannelSummaryRow]

    # 同店同比 (from temporal_comparator, 可选)
    temporal_summary: Optional[str]      # 例: "同店同比: 营收 -47.4% 🔻"

    # 底部建议 (3-5 条 one-liner)
    recommendations: list[str]

    # 元数据
    generated_at: str                    # ISO 时间
    data_sources_used: list[str]         # ['financial', 'pos', 'diagnostics', ...]

    def to_dict(self) -> dict:
        return {
            "storeName": self.store_name,
            "period": self.period,
            "subSector": self.sub_sector,
            "headline": self.headline,
            "headlineColor": self.headline_color,
            "pnlLines": [line.to_dict() for line in self.pnl_lines],
            "kpiFoodCostRatio": self.kpi_food_cost_ratio,
            "kpiLaborCostRatio": self.kpi_labor_cost_ratio,
            "kpiCostRigidity": self.kpi_cost_rigidity,
            "kpiNetMargin": self.kpi_net_margin,
            "topDiagnostics": [d.to_dict() for d in self.top_diagnostics],
            "topChannels": [c.to_dict() for c in self.top_channels],
            "temporalSummary": self.temporal_summary,
            "recommendations": self.recommendations,
            "generatedAt": self.generated_at,
            "dataSourcesUsed": self.data_sources_used,
        }


# ── Main builder ────────────────────────────────────────────


class StorePnlOnePager:
    """单店 P&L 一页纸构建器 — 编排层

    不做新计算, 只拼装已有数据. 输入:
      - financial_metrics (from FinancialMetrics dataclass in V2 analyzer)
      - diagnostics (from DiagnosticsEngine)
      - benchmark_alerts (from BenchmarkAlertEngine)
      - channel_margin (from ChannelMarginCalculator)
      - temporal_comparison (from TemporalComparator, 可选)
      - store_name / period / sub_sector
    """

    def build(
        self,
        financial_metrics: Optional[dict] = None,
        diagnostics: Optional[list[dict]] = None,
        benchmark_alerts: Optional[list[dict]] = None,
        channel_margin: Optional[dict] = None,
        temporal_comparison: Optional[dict] = None,
        store_name: str = "本店",
        period: str = "current",
        sub_sector: str = "餐饮连锁",
    ) -> StorePnlOnePagerReport:
        """构建 P&L 一页纸

        Args:
            financial_metrics: FinancialMetrics.to_dict() 输出
            diagnostics: list of Diagnosis.to_dict()
            benchmark_alerts: list of BenchmarkAlert.to_dict()
            channel_margin: ChannelMarginReport.to_dict()
            temporal_comparison: TemporalComparison.to_dict() 或 None
            store_name: 门店名
            period: 期间标签
            sub_sector: 子行业

        Returns:
            StorePnlOnePagerReport 完整结构
        """
        from datetime import datetime

        data_sources: list[str] = []
        pnl_lines: list[PnlLineItem] = []

        # ─── 构建 P&L 主表 ───
        if financial_metrics:
            data_sources.append("financial")
            pnl_lines = self._build_pnl_lines(financial_metrics)

        # ─── 构建 headline ───
        headline, headline_color = self._build_headline(
            financial_metrics, period, store_name
        )

        # ─── KPI ───
        fm = financial_metrics or {}
        kpi_food = fm.get("foodCostRatio")
        kpi_labor = fm.get("laborCostRatio")
        kpi_rigidity = fm.get("costRigidity")
        kpi_net = fm.get("restaurantNetMargin")

        # ─── 诊断 TOP 3 ───
        top_diags: list[DiagnosticBrief] = []
        if diagnostics:
            data_sources.append("diagnostics")
            top_diags = self._build_top_diagnostics(diagnostics, max_count=3)

        # 如果 diagnostics 少于 3 个, 补充 benchmark_alerts 里最严重的
        if benchmark_alerts and len(top_diags) < 3:
            data_sources.append("benchmark_alerts")
            alert_briefs = self._benchmark_alerts_to_briefs(
                benchmark_alerts, max_count=3 - len(top_diags)
            )
            top_diags.extend(alert_briefs)

        # ─── 渠道 TOP 5 ───
        top_channels: list[ChannelSummaryRow] = []
        if channel_margin:
            data_sources.append("channel_margin")
            top_channels = self._build_top_channels(channel_margin, max_count=5)

        # ─── 同店同比 summary ───
        temporal_summary: Optional[str] = None
        if temporal_comparison:
            data_sources.append("temporal")
            temporal_summary = self._build_temporal_summary(temporal_comparison)

        # ─── 建议 ───
        recommendations = self._build_recommendations(
            financial_metrics, diagnostics, benchmark_alerts, channel_margin
        )

        return StorePnlOnePagerReport(
            store_name=store_name,
            period=period,
            sub_sector=sub_sector,
            pnl_lines=pnl_lines,
            headline=headline,
            headline_color=headline_color,
            kpi_food_cost_ratio=kpi_food,
            kpi_labor_cost_ratio=kpi_labor,
            kpi_cost_rigidity=kpi_rigidity,
            kpi_net_margin=kpi_net,
            top_diagnostics=top_diags,
            top_channels=top_channels,
            temporal_summary=temporal_summary,
            recommendations=recommendations,
            generated_at=datetime.now().isoformat(timespec="seconds"),
            data_sources_used=data_sources,
        )

    # ── P&L 主表构建 ───────────────────────────────────

    def _build_pnl_lines(self, fm: dict) -> list[PnlLineItem]:
        """从 financial_metrics 构建 P&L 行"""
        revenue = fm.get("revenue", 0) or 0
        food_cost = fm.get("foodCost")
        labor_cost = fm.get("laborCost")
        rent = fm.get("rent")
        other_cost = fm.get("otherCost")
        net_profit = fm.get("netProfit")

        revenue_change_pct = fm.get("revenueChangePct")
        food_change_pct = fm.get("foodCostChangePct")
        labor_change_pct = fm.get("laborCostChangePct")

        lines: list[PnlLineItem] = []

        # 营收
        revenue_emoji = self._emoji_for_change(revenue_change_pct, higher_is_better=True)
        lines.append(
            PnlLineItem(
                label="营业收入",
                amount=revenue,
                pct_of_revenue=1.0,
                change_pct=revenue_change_pct,
                status_emoji=revenue_emoji,
            )
        )

        # 食材成本
        if food_cost is not None:
            food_pct = food_cost / revenue if revenue > 0 else None
            food_emoji = self._emoji_for_cost_ratio(food_pct, threshold_warning=0.45, threshold_critical=0.48)
            lines.append(
                PnlLineItem(
                    label="食材成本",
                    amount=food_cost,
                    pct_of_revenue=food_pct,
                    change_pct=food_change_pct,
                    status_emoji=food_emoji,
                )
            )

        # 人力成本
        if labor_cost is not None:
            labor_pct = labor_cost / revenue if revenue > 0 else None
            labor_emoji = self._emoji_for_cost_ratio(labor_pct, threshold_warning=0.30, threshold_critical=0.35)
            lines.append(
                PnlLineItem(
                    label="人力成本",
                    amount=labor_cost,
                    pct_of_revenue=labor_pct,
                    change_pct=labor_change_pct,
                    status_emoji=labor_emoji,
                )
            )

        # 房租
        if rent is not None:
            rent_pct = rent / revenue if revenue > 0 else None
            rent_emoji = self._emoji_for_cost_ratio(rent_pct, threshold_warning=0.15, threshold_critical=0.20)
            lines.append(
                PnlLineItem(
                    label="房租",
                    amount=rent,
                    pct_of_revenue=rent_pct,
                    change_pct=None,
                    status_emoji=rent_emoji,
                )
            )

        # 其他成本
        if other_cost is not None:
            other_pct = other_cost / revenue if revenue > 0 else None
            lines.append(
                PnlLineItem(
                    label="其他成本",
                    amount=other_cost,
                    pct_of_revenue=other_pct,
                    change_pct=None,
                    status_emoji="➖",
                )
            )

        # 净利润 (加粗, 用红/绿区分)
        if net_profit is not None:
            net_margin = net_profit / revenue if revenue > 0 else None
            if net_profit > 0:
                net_emoji = "🟢"
                note = f"盈利 {net_margin * 100:.2f}%" if net_margin else "盈利"
            else:
                net_emoji = "🔴"
                note = f"亏损 {abs(net_margin) * 100:.2f}%" if net_margin else "亏损"
            lines.append(
                PnlLineItem(
                    label="净利润",
                    amount=net_profit,
                    pct_of_revenue=net_margin,
                    change_pct=None,
                    status_emoji=net_emoji,
                    note=note,
                )
            )

        return lines

    # ── Headline 构建 ───────────────────────────────────

    def _build_headline(
        self, fm: Optional[dict], period: str, store_name: str
    ) -> tuple[str, Literal["green", "yellow", "red"]]:
        """顶部大字 headline"""
        if not fm:
            return (f"{store_name} {period} 经营 P&L", "yellow")

        revenue = fm.get("revenue") or 0
        net_profit = fm.get("netProfit")
        if net_profit is None:
            return (f"{store_name} {period} 营收 ¥{revenue:,.0f}", "yellow")

        if net_profit > 0:
            margin = net_profit / revenue * 100 if revenue > 0 else 0
            return (
                f"{store_name} {period} 盈利 ¥{net_profit:,.0f} ({margin:.2f}%)",
                "green" if margin >= 5 else "yellow",
            )
        else:
            margin = abs(net_profit) / revenue * 100 if revenue > 0 else 0
            return (
                f"{store_name} {period} 净亏 ¥{abs(net_profit):,.0f} (-{margin:.2f}%)",
                "red",
            )

    # ── 诊断 TOP 3 ──────────────────────────────────────

    def _build_top_diagnostics(
        self, diagnostics: list[dict], max_count: int = 3
    ) -> list[DiagnosticBrief]:
        """从 DiagnosticsEngine 输出取 TOP N 严重"""
        severity_order = {"critical": 0, "warning": 1, "info": 2}
        sorted_diags = sorted(
            diagnostics,
            key=lambda d: (
                severity_order.get(d.get("severity", "info"), 99),
                -abs(d.get("deltaPct", 0) or 0),
            ),
        )[:max_count]

        briefs: list[DiagnosticBrief] = []
        for d in sorted_diags:
            severity = d.get("severity", "info")
            emoji = {"critical": "🔴", "warning": "🟡", "info": "ℹ️"}.get(severity, "ℹ️")
            name = d.get("metricNameZh", "")
            value = d.get("actualValue", "?")
            status = d.get("status", "")
            title = f"{name} {value} ({status})"
            one_liner = d.get("descriptionZh", "") or name
            suggestions = d.get("suggestionZh", [])
            action_hint = (
                suggestions[0][:80] if suggestions and len(suggestions) > 0 else None
            )
            briefs.append(
                DiagnosticBrief(
                    severity_emoji=emoji,
                    title=title[:80],
                    one_liner=one_liner[:120],
                    action_hint=action_hint,
                )
            )
        return briefs

    def _benchmark_alerts_to_briefs(
        self, alerts: list[dict], max_count: int
    ) -> list[DiagnosticBrief]:
        """把 benchmark_alerts 转成诊断简报 (补充 top_diagnostics)"""
        severity_order = {"red": 0, "yellow": 1, "info": 2}
        sorted_alerts = sorted(
            alerts,
            key=lambda a: (
                severity_order.get(a.get("severity", "info"), 99),
                -abs(a.get("deltaPpFromMedian", 0) or 0),
            ),
        )[:max_count]

        briefs: list[DiagnosticBrief] = []
        for a in sorted_alerts:
            severity = a.get("severity", "info")
            emoji = {"red": "🔴", "yellow": "🟡", "info": "ℹ️"}.get(severity, "ℹ️")
            name = a.get("metricNameZh", "")
            actual = a.get("actualValue", 0)
            median = a.get("median", 0)
            impact = a.get("estimatedYearlyImpact")
            impact_str = (
                f"年损 ¥{abs(impact):,.0f}" if impact else ""
            )
            title = f"{name} {actual:.2f} (基准 {median:.2f}) {impact_str}"
            one_liner = a.get("messageZh", "")[:120]
            action_hint = a.get("actionHint")
            briefs.append(
                DiagnosticBrief(
                    severity_emoji=emoji,
                    title=title[:100],
                    one_liner=one_liner,
                    action_hint=action_hint,
                )
            )
        return briefs

    # ── 渠道 TOP 5 ──────────────────────────────────────

    def _build_top_channels(
        self, channel_margin: dict, max_count: int = 5
    ) -> list[ChannelSummaryRow]:
        """从 ChannelMarginReport 取 TOP N 渠道"""
        rows = channel_margin.get("rows", [])
        total_revenue = channel_margin.get("totalRevenue", 0) or 0
        if total_revenue <= 0:
            return []

        sorted_rows = sorted(rows, key=lambda r: -(r.get("revenue", 0) or 0))[:max_count]

        summaries: list[ChannelSummaryRow] = []
        for r in sorted_rows:
            margin_pct = r.get("grossMarginPct", 0) or 0
            if margin_pct >= 0.30:
                emoji = "🟢"
            elif margin_pct >= 0.15:
                emoji = "🟡"
            else:
                emoji = "🔴"
            revenue = r.get("revenue", 0) or 0
            summaries.append(
                ChannelSummaryRow(
                    channel=str(r.get("channel", "")),
                    revenue=revenue,
                    revenue_pct=revenue / total_revenue,
                    gross_margin_pct=margin_pct,
                    emoji=emoji,
                )
            )
        return summaries

    # ── 同店同比 summary ────────────────────────────────

    def _build_temporal_summary(self, tc: dict) -> str:
        """从 TemporalComparison 提取一句话摘要"""
        mode = tc.get("mode", "")
        if mode == "insufficient":
            return "历史数据不足, 无法做趋势对比"

        current = tc.get("currentPeriod", "")
        compare = tc.get("comparePeriod", "")
        mode_label = {"yoy": "同店同比", "qoq": "季度环比", "mom": "月度环比"}.get(mode, mode)

        # 取 revenue metric 的全店汇总 delta
        deltas = tc.get("deltas", [])
        if not deltas:
            return f"{mode_label} ({current} vs {compare}): 无数据"

        # 汇总 revenue-like metric
        revenue_deltas = [
            d for d in deltas
            if "revenue" in d.get("metric", "").lower()
            or "营收" in d.get("metric", "")
            or "实收" in d.get("metric", "")
        ]
        target_deltas = revenue_deltas if revenue_deltas else deltas

        total_current = sum(d.get("currentValue", 0) or 0 for d in target_deltas)
        total_compare = sum(d.get("compareValue", 0) or 0 for d in target_deltas)
        if total_compare <= 0:
            return f"{mode_label} ({current} vs {compare}): 对比期无数据"

        overall_delta_pct = (total_current - total_compare) / total_compare
        emoji = "🔻" if overall_delta_pct < -0.05 else ("🟢" if overall_delta_pct > 0.05 else "➡️")
        return (
            f"{mode_label} ({current} vs {compare}): "
            f"营收 {overall_delta_pct * 100:+.1f}% {emoji}, "
            f"共 {tc.get('groupCount', 0)} 家门店"
        )

    # ── 建议 ────────────────────────────────────────────

    def _build_recommendations(
        self,
        fm: Optional[dict],
        diagnostics: Optional[list[dict]],
        benchmark_alerts: Optional[list[dict]],
        channel_margin: Optional[dict],
    ) -> list[str]:
        """合并所有建议源, 去重 + 精选 5 条"""
        recs: list[str] = []

        # 1. 诊断建议 (P0 action)
        if diagnostics:
            for d in diagnostics[:2]:
                suggestions = d.get("suggestionZh", [])
                if suggestions:
                    # 取首条 P0 action
                    first = suggestions[0]
                    if len(first) <= 120:
                        recs.append(f"📋 {first}")

        # 2. 对标预警的建议
        if benchmark_alerts:
            for a in benchmark_alerts[:2]:
                hint = a.get("actionHint")
                if hint:
                    recs.append(f"🎯 {hint}")

        # 3. 渠道 advice
        if channel_margin:
            advice_list = channel_margin.get("adviceZh", [])
            for advice in advice_list[:1]:
                recs.append(f"💡 {advice[:120]}")

        # 去重 + 限制 5 条
        seen = set()
        unique: list[str] = []
        for r in recs:
            if r not in seen:
                seen.add(r)
                unique.append(r)
            if len(unique) >= 5:
                break
        return unique

    # ── Emoji 辅助 ──────────────────────────────────────

    @staticmethod
    def _emoji_for_change(change_pct: Optional[float], higher_is_better: bool = True) -> str:
        """根据变化方向选 emoji"""
        if change_pct is None:
            return "➖"
        if abs(change_pct) < 0.02:
            return "➡️"
        if higher_is_better:
            return "🟢" if change_pct > 0 else "🔻"
        else:
            return "🟢" if change_pct < 0 else "🔻"

    @staticmethod
    def _emoji_for_cost_ratio(
        pct: Optional[float],
        threshold_warning: float,
        threshold_critical: float,
    ) -> str:
        """根据成本占比选 emoji"""
        if pct is None:
            return "➖"
        if pct >= threshold_critical:
            return "🔴"
        if pct >= threshold_warning:
            return "🟡"
        return "🟢"
