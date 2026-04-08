"""长尾 SKU 自动识别 — 改进 9 (Week 4.3)

设计依据 (来自 Researcher C):
  - 青花椒 700 个 SKU, TOP 50 占 80% 销量 — 长尾明显
  - 长尾 SKU = 库存 + 采购 + 培训成本浪费
  - 不叫"自动下架" (违反餐饮决策链), 叫"低效 SKU 识别"

输入: menu_quadrant items (含 quantity + revenue + unitProfit)
输出: 低效 SKU 列表 + 下架建议 + 季节性排除

使用示例:
    >>> detector = LongTailSkuDetector()
    >>> result = detector.detect(
    ...     menu_items=[...],
    ...     exclude_seasonal=True,
    ... )
    >>> print(result.recommended_delist_count)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class LowEfficiencySku:
    """低效 SKU"""
    name: str
    quantity: float
    revenue: float
    unit_price: float
    quantity_percentile: float           # 0-1 (0=最低销量)
    revenue_percentile: float            # 0-1
    score: float                         # 综合分 (越低越差)
    recommendation: str                  # "建议下架" / "保留观察" / "季节限定勿动"
    reason: str

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "quantity": round(self.quantity, 1),
            "revenue": round(self.revenue, 2),
            "unitPrice": round(self.unit_price, 2),
            "quantityPercentile": round(self.quantity_percentile, 3),
            "revenuePercentile": round(self.revenue_percentile, 3),
            "score": round(self.score, 3),
            "recommendation": self.recommendation,
            "reason": self.reason,
        }


@dataclass
class LongTailReport:
    """长尾 SKU 报告"""
    total_sku_count: int
    top_20_pct_skus_contribute: float    # TOP 20% SKU 贡献营收比例
    low_efficiency_skus: list[LowEfficiencySku]
    seasonal_excluded: list[str]         # 被季节性排除的 SKU 名
    recommended_delist_count: int
    estimated_cost_saving: float         # 估算下架后节省的库存/采购成本
    insights: list[str]
    recommendations: list[str]

    def to_dict(self) -> dict:
        return {
            "totalSkuCount": self.total_sku_count,
            "top20PctSkusContribute": round(self.top_20_pct_skus_contribute, 4),
            "lowEfficiencySkus": [s.to_dict() for s in self.low_efficiency_skus],
            "seasonalExcluded": self.seasonal_excluded,
            "recommendedDelistCount": self.recommended_delist_count,
            "estimatedCostSaving": round(self.estimated_cost_saving, 2),
            "insights": self.insights,
            "recommendations": self.recommendations,
        }


class LongTailSkuDetector:
    """长尾 SKU 检测器"""

    # 季节性关键字 (这些菜品销量低但不下架)
    SEASONAL_KEYWORDS = [
        "冰粉", "刨冰", "凉面", "凉菜",                        # 夏季
        "火锅", "羊肉", "暖汤", "炖品",                        # 冬季
        "月饼", "粽子", "汤圆", "饺子",                        # 节日
        "圣诞", "新年", "春节", "元宵",                        # 节日
        "限定", "限时", "季节", "特供",                        # 显式季节标签
    ]

    def detect(
        self,
        menu_items: list[dict],
        exclude_seasonal: bool = True,
        bottom_pct: float = 0.20,        # 后 20% 算长尾
    ) -> LongTailReport:
        """检测长尾 SKU

        Args:
            menu_items: list of {name, quantity, revenue, unitProfit}
            exclude_seasonal: 排除含季节关键字的 SKU
            bottom_pct: 后百分之多少视为长尾
        """
        if not menu_items:
            return self._empty("无菜品数据")

        total_sku_count = len(menu_items)

        # 按销量+营收降序
        sorted_items = sorted(
            menu_items,
            key=lambda i: -(i.get("quantity", 0) + i.get("revenue", 0) / 100),
        )

        # 算 TOP 20% SKU 贡献的营收占比
        top_count = max(1, int(total_sku_count * 0.20))
        top_revenue = sum(i.get("revenue", 0) for i in sorted_items[:top_count])
        total_revenue = sum(i.get("revenue", 0) for i in sorted_items)
        top_contribution = top_revenue / total_revenue if total_revenue > 0 else 0

        # 识别长尾 (后 bottom_pct)
        tail_count = max(1, int(total_sku_count * bottom_pct))
        tail_items = sorted_items[-tail_count:]

        # 算每个 item 的 percentile
        quantities = sorted([i.get("quantity", 0) for i in sorted_items])
        revenues = sorted([i.get("revenue", 0) for i in sorted_items])

        def percentile(val: float, sorted_list: list[float]) -> float:
            if not sorted_list:
                return 0.0
            for i, v in enumerate(sorted_list):
                if val <= v:
                    return i / len(sorted_list)
            return 1.0

        # 季节性 SKU 排除
        seasonal_excluded: list[str] = []
        low_efficiency: list[LowEfficiencySku] = []

        for item in tail_items:
            name = item.get("name", "")
            quantity = item.get("quantity", 0)
            revenue = item.get("revenue", 0)
            unit_price = item.get("unitProfit", 0)

            if exclude_seasonal and any(kw in name for kw in self.SEASONAL_KEYWORDS):
                seasonal_excluded.append(name)
                continue

            q_pct = percentile(quantity, quantities)
            r_pct = percentile(revenue, revenues)
            score = (q_pct + r_pct) / 2

            # 综合判定
            if score < 0.05:
                rec = "建议下架"
                reason = f"销量和营收双低 (后 {score * 100:.1f}%), 长期无起色"
            elif score < 0.10:
                rec = "保留观察 3 个月"
                reason = f"接近长尾末端 (后 {score * 100:.1f}%), 观察是否季节性"
            else:
                rec = "低效但暂保留"
                reason = f"后 {score * 100:.1f}% 分位, 不急于下架"

            low_efficiency.append(
                LowEfficiencySku(
                    name=name,
                    quantity=quantity,
                    revenue=revenue,
                    unit_price=unit_price,
                    quantity_percentile=q_pct,
                    revenue_percentile=r_pct,
                    score=score,
                    recommendation=rec,
                    reason=reason,
                )
            )

        # 排序
        low_efficiency.sort(key=lambda s: s.score)
        recommended_delist_count = sum(
            1 for s in low_efficiency if s.recommendation == "建议下架"
        )

        # 估算节省 (简化: 每个下架 SKU 节省 500 元/月 库存占用)
        estimated_saving = recommended_delist_count * 500 * 12  # 年估算

        insights = self._build_insights(
            total_sku_count, top_contribution, len(low_efficiency), len(seasonal_excluded)
        )
        recs = self._build_recommendations(
            recommended_delist_count, total_sku_count, low_efficiency
        )

        return LongTailReport(
            total_sku_count=total_sku_count,
            top_20_pct_skus_contribute=top_contribution,
            low_efficiency_skus=low_efficiency,
            seasonal_excluded=seasonal_excluded,
            recommended_delist_count=recommended_delist_count,
            estimated_cost_saving=estimated_saving,
            insights=insights,
            recommendations=recs,
        )

    def _build_insights(
        self,
        total: int,
        top_contribution: float,
        low_eff_count: int,
        seasonal_count: int,
    ) -> list[str]:
        insights: list[str] = []
        insights.append(
            f"📊 共 {total} 个 SKU, TOP 20% ({int(total * 0.2)} 个) 贡献 "
            f"{top_contribution * 100:.1f}% 营收"
        )
        if top_contribution > 0.80:
            insights.append(
                f"⚠️ 严重二八: TOP 20% 贡献 >80% 营收, 长尾过重"
            )
        if seasonal_count > 0:
            insights.append(
                f"🌿 已排除 {seasonal_count} 个疑似季节性 SKU (保留观察)"
            )
        if low_eff_count > total * 0.15:
            insights.append(
                f"🔻 低效 SKU {low_eff_count} 个 ({low_eff_count / total * 100:.0f}%), "
                f"菜单过于臃肿, 建议精简"
            )
        return insights

    def _build_recommendations(
        self,
        delist_count: int,
        total: int,
        low_eff: list[LowEfficiencySku],
    ) -> list[str]:
        recs: list[str] = []
        if delist_count > 0:
            recs.append(
                f"📋 建议下架 {delist_count} 个 SKU (后 5% 分位的双低菜品), "
                f"预计年省 ¥{delist_count * 500 * 12:,.0f} 库存/采购成本"
            )
            recs.append(
                "📋 下架前先跟厨师长沟通, 确认是否有工艺/员工餐等隐性价值"
            )
        if len(low_eff) > total * 0.20:
            recs.append("📋 菜单过长 (>20% 低效 SKU), 考虑整体菜单精简, 提升厨房效率")
        if delist_count == 0 and len(low_eff) > 0:
            recs.append("📋 低效 SKU 暂无严重到需下架, 继续观察 1-2 个月")
        return recs

    def _empty(self, reason: str) -> LongTailReport:
        return LongTailReport(
            total_sku_count=0,
            top_20_pct_skus_contribute=0,
            low_efficiency_skus=[],
            seasonal_excluded=[],
            recommended_delist_count=0,
            estimated_cost_saving=0,
            insights=[f"数据不足: {reason}"],
            recommendations=[],
        )
