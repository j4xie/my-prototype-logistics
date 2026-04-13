"""渠道毛利率分析 — 改进 6 真名版

设计哲学 (per Critic 最致命挑战):
  无 COGS 不能叫毛利率, 客户现场会拆穿. 但我们用 BomResolver 4 层 COGS, 可以诚实地叫"毛利率",
  只要 API 输出强制带 cogs_source + warning, 让客户清楚知道精度.

数据流:
  POS DataFrame (含 order_method 列)
       ↓ groupby
  各渠道营收
       ↓ 查 commission_rates.yaml
  渠道抽佣率
       ↓ BomResolver.resolve_cogs_for_channel
  渠道 COGS (4 层)
       ↓
  毛利率 = (营收 - 抽佣 - 配送 - 包装 - COGS) / 营收
       ↓
  ChannelMarginRow 列表 (含 cogs_source 透明度)

使用示例:
    >>> calc = ChannelMarginCalculator(
    ...     factory_id="DENG",
    ...     sub_sector="火锅",
    ...     bom_resolver=resolver,
    ...     config_resolver=cfg_resolver,
    ... )
    >>> rows = calc.calculate(df, order_method_col="订单来源", revenue_col="实收")
    >>> for row in rows:
    ...     print(row.channel, row.gross_margin_pct, row.cogs_source)
    堂食 0.5234 category_baseline
    美团外卖 0.0816 category_baseline (warning: 行业基准估算, 建议上传采购数据)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import yaml

from shared.dynamic_config_resolver import DynamicConfigResolver

from .bom_resolver import RestaurantBomResolver, CogsSource

logger = logging.getLogger(__name__)


# ── Result types ────────────────────────────────────────────


@dataclass
class ChannelMarginRow:
    """单渠道毛利率行 — API 输出会序列化此类

    强制字段 (per Critic 透明度要求):
      - cogs_source: 标注 COGS 来源 (category_baseline/sku_form/manual_override)
      - cogs_confidence: 置信度
      - warning: 当 COGS 是行业基准时的诚实提示
    """
    channel: str
    revenue: float
    order_count: int
    avg_ticket: float

    # 抽佣 + 物流 + 包装
    commission_rate: float                   # 平台抽佣率 (动态查找)
    commission_amount: float
    delivery_fee: float                      # 商家承担配送费
    packaging_cost: float                    # 包装成本

    # COGS (来自 BomResolver)
    cogs: float
    cogs_source: CogsSource
    cogs_confidence: str
    cogs_warning: Optional[str]

    # 最终毛利率
    net_revenue: float                       # = revenue - commission - delivery - packaging
    gross_profit: float                      # = net_revenue - cogs
    gross_margin_pct: float                  # = gross_profit / revenue

    # 元数据
    expected_accuracy_pp: float              # 整体精度 ±X 个百分点
    commission_source: str                   # 'sub_sector_default' / 'global_default' / 'manual_override'

    def to_dict(self) -> dict:
        return {
            "channel": self.channel,
            "revenue": round(self.revenue, 2),
            "orderCount": self.order_count,
            "avgTicket": round(self.avg_ticket, 2),
            "commissionRate": round(self.commission_rate, 4),
            "commissionAmount": round(self.commission_amount, 2),
            "deliveryFee": round(self.delivery_fee, 2),
            "packagingCost": round(self.packaging_cost, 2),
            "cogs": round(self.cogs, 2),
            "cogsSource": self.cogs_source,
            "cogsConfidence": self.cogs_confidence,
            "cogsWarning": self.cogs_warning,
            "netRevenue": round(self.net_revenue, 2),
            "grossProfit": round(self.gross_profit, 2),
            "grossMarginPct": round(self.gross_margin_pct, 4),
            "expectedAccuracyPp": self.expected_accuracy_pp,
            "commissionSource": self.commission_source,
        }


@dataclass
class ChannelMarginReport:
    """完整渠道毛利率报告"""
    factory_id: str
    sub_sector: str
    period: str
    total_revenue: float
    total_gross_profit: float
    overall_gross_margin_pct: float
    rows: list[ChannelMarginRow]
    cogs_source_summary: dict[str, int]      # {source: count}, 透明度统计
    advice_zh: list[str]                     # 给客户的建议文案

    def to_dict(self) -> dict:
        return {
            "factoryId": self.factory_id,
            "subSector": self.sub_sector,
            "period": self.period,
            "totalRevenue": round(self.total_revenue, 2),
            "totalGrossProfit": round(self.total_gross_profit, 2),
            "overallGrossMarginPct": round(self.overall_gross_margin_pct, 4),
            "rows": [r.to_dict() for r in self.rows],
            "cogsSourceSummary": self.cogs_source_summary,
            "adviceZh": self.advice_zh,
        }


# ── Calculator ──────────────────────────────────────────────


class ChannelMarginCalculator:
    """渠道毛利率计算器 (改进 6 真名版)"""

    def __init__(
        self,
        factory_id: str,
        sub_sector: str,
        bom_resolver: Optional[RestaurantBomResolver] = None,
        config_resolver: Optional[DynamicConfigResolver] = None,
        kb_root: Optional[Path] = None,
    ):
        self.factory_id = factory_id
        self.sub_sector = sub_sector
        # Allow callers to omit bom_resolver; create a default instance so the
        # calculator can be used standalone (e.g. in tests or lightweight scripts).
        if bom_resolver is None:
            bom_resolver = RestaurantBomResolver(
                factory_id=factory_id,
                sub_sector=sub_sector,
                config_resolver=config_resolver,
            )
        self.bom_resolver = bom_resolver
        self.config_resolver = config_resolver
        self.kb_root = kb_root or (Path(__file__).parent.parent.parent / "knowledge" / "restaurant")
        self._commission_yaml: dict = {}
        self._load_commission_rates()

    # ── Public API ──────────────────────────────────────

    def calculate(
        self,
        df,
        order_method_col: str,
        revenue_col: str,
        store_id: Optional[str] = None,
        period: str = "current",
        venue_list: Optional[list[str]] = None,
    ) -> ChannelMarginReport:
        """对 DataFrame 按渠道计算毛利率

        Args:
            df: pandas DataFrame, 含 POS 订单明细
            order_method_col: 订单来源/渠道列名 (例 '订单来源')
            revenue_col: 营收列名 (例 '实收额')
            store_id: 门店 ID (用于 manual override 查找)
            period: 期间标签 (例 '2026-02')
            venue_list: 可选渠道白名单 (例 ['包厢', '宴会', '外卖']).
                当传入时, 不在名单中的订单归入 '其他' 渠道.
                None = 不过滤, 使用数据中全部渠道 (向后兼容默认行为).

        Returns:
            ChannelMarginReport
        """
        if order_method_col not in df.columns or revenue_col not in df.columns:
            logger.warning(
                f"channel_margin: 缺少列 {order_method_col!r} 或 {revenue_col!r}, 跳过"
            )
            return self._empty_report(period)

        # 强制 numeric
        import pandas as pd

        df = df.copy()
        df[revenue_col] = pd.to_numeric(df[revenue_col], errors="coerce").fillna(0)
        df = df[df[order_method_col].notna()]

        # QW2: 渠道白名单过滤 — 名单外的渠道归入 '其他'
        if venue_list is not None:
            mask = df[order_method_col].isin(venue_list)
            df.loc[~mask, order_method_col] = "其他"

        # group by 渠道
        grouped = df.groupby(order_method_col).agg(
            revenue=(revenue_col, "sum"),
            order_count=(revenue_col, "count"),
        ).reset_index()

        rows: list[ChannelMarginRow] = []
        cogs_sources: dict[str, int] = {}

        for _, g in grouped.iterrows():
            channel = str(g[order_method_col])
            revenue = float(g["revenue"])
            order_count = int(g["order_count"])

            if revenue <= 0:
                continue

            row = self._calculate_one_channel(
                channel=channel,
                revenue=revenue,
                order_count=order_count,
                store_id=store_id,
            )
            rows.append(row)
            cogs_sources[row.cogs_source] = cogs_sources.get(row.cogs_source, 0) + 1

        # 排序: 营收降序
        rows.sort(key=lambda r: -r.revenue)

        # 汇总
        total_revenue = sum(r.revenue for r in rows)
        total_gross_profit = sum(r.gross_profit for r in rows)
        overall_pct = (
            total_gross_profit / total_revenue if total_revenue > 0 else 0.0
        )

        # 生成建议文案
        advice = self._generate_advice(rows, total_revenue)

        return ChannelMarginReport(
            factory_id=self.factory_id,
            sub_sector=self.sub_sector,
            period=period,
            total_revenue=total_revenue,
            total_gross_profit=total_gross_profit,
            overall_gross_margin_pct=overall_pct,
            rows=rows,
            cogs_source_summary=cogs_sources,
            advice_zh=advice,
        )

    # ── 内部: 单渠道计算 ───────────────────────────────

    def _calculate_one_channel(
        self,
        channel: str,
        revenue: float,
        order_count: int,
        store_id: Optional[str],
    ) -> ChannelMarginRow:
        """单渠道毛利率核心算法

        毛利率 = (营收 - 平台抽佣 - 配送费 - 包装成本 - COGS) / 营收
        """
        # 1. 抽佣率 (动态查找)
        commission_rate, commission_source = self._lookup_commission_rate(
            channel, store_id
        )
        commission_amount = revenue * commission_rate

        # 2. 配送费 (商家承担, 按订单数)
        delivery_per_order = self._lookup_delivery_fee(channel)
        delivery_fee = order_count * delivery_per_order

        # 3. 包装成本 (商家承担净成本)
        packaging_per_order = self._lookup_packaging_cost(channel)
        packaging_cost = order_count * packaging_per_order

        # 4. COGS (BomResolver 4 层)
        cogs_result = self.bom_resolver.resolve_cogs_for_channel(
            channel=channel,
            revenue=revenue,
            store_id=store_id,
        )
        cogs = cogs_result.cogs_amount

        # 5. 毛利计算
        net_revenue = revenue - commission_amount - delivery_fee - packaging_cost
        gross_profit = net_revenue - cogs
        gross_margin_pct = gross_profit / revenue if revenue > 0 else 0.0

        # 6. 整体精度估算: 取 COGS 精度 + 抽佣率精度 (假设 ±2pp)
        expected_accuracy = max(cogs_result.expected_accuracy_pp, 5.0)

        return ChannelMarginRow(
            channel=channel,
            revenue=revenue,
            order_count=order_count,
            avg_ticket=revenue / order_count if order_count > 0 else 0.0,
            commission_rate=commission_rate,
            commission_amount=commission_amount,
            delivery_fee=delivery_fee,
            packaging_cost=packaging_cost,
            cogs=cogs,
            cogs_source=cogs_result.source,
            cogs_confidence=cogs_result.confidence,
            cogs_warning=cogs_result.warning,
            net_revenue=net_revenue,
            gross_profit=gross_profit,
            gross_margin_pct=gross_margin_pct,
            expected_accuracy_pp=expected_accuracy,
            commission_source=commission_source,
        )

    # ── 内部: 抽佣率/配送费/包装查找 ────────────────────

    def _lookup_commission_rate(
        self,
        channel: str,
        store_id: Optional[str],
    ) -> tuple[float, str]:
        """查找渠道抽佣率, 返回 (rate, source)

        优先级:
            1. manual_override (DynamicConfigResolver)
            2. per_sub_sector (commission_rates.yaml)
            3. default_rates (commission_rates.yaml)
            4. 0.0 (兜底)
        """
        # Layer 1: manual override
        if self.config_resolver:
            key = f"restaurant.commission.{channel}"
            try:
                cv = self.config_resolver.resolve(key, store_id=store_id, yaml_fallback=None)
                if cv.value is not None and isinstance(cv.value, (int, float)):
                    return (float(cv.value), "manual_override")
            except Exception:
                pass

        # Layer 2: per_sub_sector
        per_sub = (self._commission_yaml.get("per_sub_sector") or {}).get(self.sub_sector, {})
        if channel in per_sub:
            return (float(per_sub[channel]), "sub_sector_default")

        # Layer 3: default_rates
        default_rates = self._commission_yaml.get("default_rates", {})
        if channel in default_rates:
            return (float(default_rates[channel]), "global_default")

        return (0.0, "no_data")

    def _lookup_delivery_fee(self, channel: str) -> float:
        """查找商家承担的配送费 (元/单)"""
        fees = self._commission_yaml.get("default_delivery_fees", {})
        return float(fees.get(channel, 0))

    def _lookup_packaging_cost(self, channel: str) -> float:
        """查找包装净成本 (元/单)"""
        pkg = self._commission_yaml.get("default_packaging_costs", {})
        return float(pkg.get("net_packaging_cost", 0))

    def _load_commission_rates(self) -> None:
        """加载 knowledge/restaurant/pos/commission_rates.yaml"""
        path = self.kb_root / "pos" / "commission_rates.yaml"
        if not path.exists():
            logger.warning(f"commission_rates.yaml 不存在: {path}")
            self._commission_yaml = {}
            return
        try:
            with open(path, encoding="utf-8") as f:
                self._commission_yaml = yaml.safe_load(f) or {}
            logger.debug(
                f"加载 commission_rates.yaml: "
                f"{len(self._commission_yaml.get('default_rates', {}))} 全局费率, "
                f"{len(self._commission_yaml.get('per_sub_sector', {}))} 子行业覆盖"
            )
        except Exception as e:
            logger.error(f"加载 commission_rates.yaml 失败: {e}")
            self._commission_yaml = {}

    # ── 内部: 建议文案生成 ─────────────────────────────

    def _generate_advice(
        self,
        rows: list[ChannelMarginRow],
        total_revenue: float,
    ) -> list[str]:
        """根据渠道毛利率分布生成建议"""
        advice: list[str] = []

        if not rows or total_revenue <= 0:
            return advice

        # 1. 找出毛利率最低的渠道
        sorted_by_margin = sorted(rows, key=lambda r: r.gross_margin_pct)
        worst = sorted_by_margin[0]
        if worst.gross_margin_pct < 0.15:
            advice.append(
                f"⚠️ 渠道 {worst.channel} 毛利率仅 {worst.gross_margin_pct:.1%} (低于 15% 警戒线), "
                f"营收 ¥{worst.revenue:,.0f}, 抽佣 ¥{worst.commission_amount:,.0f}, "
                f"COGS ¥{worst.cogs:,.0f}, 实际毛利 ¥{worst.gross_profit:,.0f}. "
                f"建议评估该渠道 ROI 是否值得继续运营."
            )

        # 2. 外卖渠道占比过高警告
        delivery_channels = [r for r in rows if "外卖" in r.channel or "美团" in r.channel or "饿了么" in r.channel or "抖音" in r.channel]
        delivery_revenue = sum(r.revenue for r in delivery_channels)
        delivery_pct = delivery_revenue / total_revenue if total_revenue > 0 else 0.0
        if delivery_pct > 0.7:
            avg_delivery_margin = (
                sum(r.gross_profit for r in delivery_channels) / delivery_revenue
                if delivery_revenue > 0
                else 0
            )
            avg_dine_in_margin = self._avg_dine_in_margin(rows)
            advice.append(
                f"⚠️ 外卖渠道营收占比 {delivery_pct:.0%} (>70% 高度依赖平台), "
                f"外卖平均毛利率 {avg_delivery_margin:.1%} vs 堂食 {avg_dine_in_margin:.1%}, "
                f"建议提高堂食占比或谈判降低抽佣."
            )

        # 3. cogs_source 透明度提示
        baseline_count = sum(1 for r in rows if r.cogs_source == "category_baseline")
        if baseline_count > 0:
            advice.append(
                f"📊 {baseline_count} 个渠道的 COGS 来自行业基准 (精度 ±15%). "
                f"上传月度采购汇总后, 系统可升级到 ±5% 精度."
            )

        return advice

    def _avg_dine_in_margin(self, rows: list[ChannelMarginRow]) -> float:
        """计算堂食平均毛利率"""
        dine_in = [r for r in rows if "堂食" in r.channel or "店内" in r.channel]
        if not dine_in:
            return 0.0
        total_rev = sum(r.revenue for r in dine_in)
        total_gp = sum(r.gross_profit for r in dine_in)
        return total_gp / total_rev if total_rev > 0 else 0.0

    def _empty_report(self, period: str) -> ChannelMarginReport:
        return ChannelMarginReport(
            factory_id=self.factory_id,
            sub_sector=self.sub_sector,
            period=period,
            total_revenue=0,
            total_gross_profit=0,
            overall_gross_margin_pct=0,
            rows=[],
            cogs_source_summary={},
            advice_zh=[],
        )
