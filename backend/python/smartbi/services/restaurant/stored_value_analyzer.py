"""充卡/储值依赖度分析 — 改进 10 (Week 4.3)

设计依据 (来自 Researcher B 邓总真实 P&L 发现):
  - 邓总火锅 充卡赠送 ¥51,680 (7.07% of revenue), 隐性折扣
  - 记账时常被埋在"营业费用" 而非"折扣额" 里, 容易被忽视
  - 充卡赠送越多, 现金流越依赖"先收钱后服务", 风险越高

阈值 (P3.5A QW1, 2026-04-10 — 匹配真实火锅行业实测):
  - <5%  健康
  - 5-7% 警戒
  - >=7% 严重依赖 (财务风险 / 流动性风险)

使用示例:
    >>> analyzer = StoredValueAnalyzer()
    >>> result = analyzer.analyze(
    ...     stored_value_giveaway=51680.61,
    ...     stored_value_charge=200000.0,  # 当月新充值
    ...     revenue=731047.52,
    ...     previous_stored_value_balance=500000.0,  # 上月末储值余额
    ... )
    >>> print(result.dependency_pct)  # 0.0707
    >>> print(result.severity)  # 'critical' (>=7% threshold, P3.5A QW1)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal, Optional

from smartbi.services.finance.margin_spec import StoredValueTreatment

logger = logging.getLogger(__name__)


Severity = Literal["info", "warning", "critical"]


@dataclass
class StoredValueReport:
    """充卡依赖度分析报告"""
    stored_value_giveaway: float         # 充卡赠送 (期间)
    stored_value_charge: Optional[float]  # 充卡新充 (期间)
    revenue: float                       # 期间营收
    previous_balance: Optional[float]    # 上月末储值余额

    dependency_pct: float                # 充卡赠送 / 营收
    charge_to_revenue_ratio: Optional[float]  # 充卡新充 / 营收
    estimated_cashflow_dependency: Optional[float]  # 依赖充卡的现金流比例

    severity: Severity
    message_zh: str
    warnings: list[str]
    recommendations: list[str]
    mode: Optional[str] = None  # StoredValueTreatment.value (PREPAID/REVENUE/EXCLUDED)

    def to_dict(self) -> dict:
        return {
            "storedValueGiveaway": round(self.stored_value_giveaway, 2),
            "storedValueCharge": round(self.stored_value_charge, 2) if self.stored_value_charge is not None else None,
            "revenue": round(self.revenue, 2),
            "previousBalance": round(self.previous_balance, 2) if self.previous_balance is not None else None,
            "dependencyPct": round(self.dependency_pct, 4),
            "chargeToRevenueRatio": round(self.charge_to_revenue_ratio, 4) if self.charge_to_revenue_ratio is not None else None,  # noqa: E501
            "estimatedCashflowDependency": round(self.estimated_cashflow_dependency, 4) if self.estimated_cashflow_dependency is not None else None,  # noqa: E501
            "severity": self.severity,
            "messageZh": self.message_zh,
            "warnings": self.warnings,
            "recommendations": self.recommendations,
            "mode": self.mode,
        }


class StoredValueAnalyzer:
    """充卡/储值依赖度分析器"""

    def analyze(
        self,
        stored_value_giveaway: float,
        revenue: float,
        stored_value_charge: Optional[float] = None,
        previous_balance: Optional[float] = None,
        mode: StoredValueTreatment = StoredValueTreatment.PREPAID,
    ) -> StoredValueReport:
        """分析充卡依赖度

        Args:
            stored_value_giveaway: 当期充卡赠送金额
            revenue: 当期营业收入
            stored_value_charge: 当期充卡新充 (可选)
            previous_balance: 上期末储值余额 (可选)
            mode: 充卡收入确认方式 (P3.5B F3):
              - PREPAID (default): 充卡 = 预收款负债, 消费时才确认收入
              - REVENUE: 充卡直接确认收入, 赠送作为营销费用
              - EXCLUDED: 充卡不纳入收入, 无依赖风险
        """
        if revenue <= 0:
            return self._empty("营收为 0, 无法计算依赖度")

        dependency_pct = stored_value_giveaway / revenue
        charge_ratio = (
            stored_value_charge / revenue
            if stored_value_charge is not None and stored_value_charge > 0
            else None
        )

        # 估算现金流依赖度 (当期充卡 + 上期余额 消费 占营收比例)
        estimated_cashflow = None
        if charge_ratio is not None:
            estimated_cashflow = charge_ratio

        # 评估严重度 — EXCLUDED mode 无依赖风险, 直接 info
        if mode == StoredValueTreatment.EXCLUDED:
            severity: Severity = "info"
            message_zh = (
                f"充卡赠送 ¥{stored_value_giveaway:,.0f} 已从收入中排除, 无依赖风险"
            )
        else:
            # PREPAID or REVENUE: compute severity from ratio (existing logic)
            severity, severity_label = self._evaluate_severity(dependency_pct)

            if mode == StoredValueTreatment.REVENUE:
                # REVENUE mode: emphasize marketing expense narrative
                message_zh = (
                    f"收入直接确认模式: 充卡赠送 {dependency_pct * 100:.1f}% 作为营销费用, "
                    f"占比{'过高' if severity != 'info' else '正常'}"
                )
            else:
                # PREPAID (default): liability / cashflow risk narrative
                message_zh = (
                    f"{severity_label} | 充卡赠送 ¥{stored_value_giveaway:,.0f} "
                    f"占营收 {dependency_pct * 100:.2f}%"
                )
            if charge_ratio is not None:
                message_zh += f", 充卡新充占营收 {charge_ratio * 100:.1f}%"

        # 警告 + 建议
        warnings = self._build_warnings(dependency_pct, charge_ratio)
        recs = self._build_recommendations(dependency_pct, charge_ratio, severity)

        return StoredValueReport(
            stored_value_giveaway=stored_value_giveaway,
            stored_value_charge=stored_value_charge,
            revenue=revenue,
            previous_balance=previous_balance,
            dependency_pct=dependency_pct,
            charge_to_revenue_ratio=charge_ratio,
            estimated_cashflow_dependency=estimated_cashflow,
            severity=severity,
            message_zh=message_zh,
            warnings=warnings,
            recommendations=recs,
            mode=mode.value,
        )

    def _evaluate_severity(self, dependency_pct: float) -> tuple[Severity, str]:
        """阈值: <5% info / 5-7% warning / >=7% critical

        P3.5A QW1 (2026-04-10): 真实火锅头部品牌 (鼎鲜 2026-02 实测 7.07%)
        显示 7%+ 已是流动性风险, 而非仅 KPI 警戒。原阈值 10% 过宽,
        完全错过鼎鲜场景. 新阈值: 5% warning / 7% critical.
        """
        if dependency_pct >= 0.07:  # 原 0.10 → 降低至 0.07 以覆盖实际火锅风险
            return ("critical", "🔴 严重依赖")
        if dependency_pct >= 0.05:  # 警戒区间保持 5% 下限
            return ("warning", "🟡 警戒")
        return ("info", "🟢 健康")

    def _build_warnings(
        self, dep_pct: float, charge_ratio: Optional[float]
    ) -> list[str]:
        warnings: list[str] = []
        if dep_pct >= 0.07:  # 与 _evaluate_severity critical 阈值保持一致 (P3.5A QW1)
            warnings.append(
                f"充卡赠送占比 {dep_pct * 100:.2f}% 严重过高 (健康 <5%), "
                f"相当于每 100 元营收送出 ¥{dep_pct * 100:.0f} 的隐性折扣"
            )
        if dep_pct >= 0.05:
            warnings.append(
                f"充卡赠送 {dep_pct * 100:.2f}% 属于隐性折扣, 容易被埋在'营业费用' 忽视"
            )
        if charge_ratio and charge_ratio > 0.30:
            warnings.append(
                f"充卡新充占营收 {charge_ratio * 100:.0f}%, 现金流高度依赖未来消费. "
                f"一旦充卡活动停, 现金流将骤降"
            )
        return warnings

    def _build_recommendations(
        self, dep_pct: float, charge_ratio: Optional[float], severity: Severity
    ) -> list[str]:
        recs: list[str] = []
        if severity == "critical":
            recs.append("立即评估充卡赠送 ROI: 充卡客户复购率 vs 普通客户的 LTV 差")
            recs.append("减少赠送力度 (从 N% 降到 3-5%), 观察流失率")
        if severity == "warning":
            recs.append("监控充卡 ROI: 如果充卡客户复购率不显著高于普通客户, 停止赠送")
        if charge_ratio and charge_ratio > 0.30:
            recs.append("建立现金流应急预案: 如充卡活动停止, 60 天内仍能支付固定成本")
        if dep_pct < 0.05:
            recs.append("充卡依赖度健康, 不需要额外行动")
        return recs

    def _empty(self, reason: str) -> StoredValueReport:
        return StoredValueReport(
            stored_value_giveaway=0,
            stored_value_charge=None,
            revenue=0,
            previous_balance=None,
            dependency_pct=0,
            charge_to_revenue_ratio=None,
            estimated_cashflow_dependency=None,
            severity="info",
            message_zh=f"无法分析: {reason}",
            warnings=[],
            recommendations=[],
            mode=None,
        )
