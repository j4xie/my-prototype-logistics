"""月度校准历史报告 — W5.7 (Layer A 自学习报告)

对比 monthly_purchase_calibrator (只返回当前校准):
  本模块给出 N 月的校准历史 + 类目波动曲线 + 异常突变告警

输入: factory_id, store_id, months back (默认 6)
输出: CalibrationHistoryReport 含:
  - periods: 按月排序的 CalibrationSnapshot 列表
  - factor_trend: 每月 overall_factor 走势
  - category_volatility: 每个 category 月间波动度 (stddev / mean)
  - anomalies: 单月 factor 突变超过 ±30% 的告警
  - summary: 中文 1-2 句话总结

每个月的 snapshot 给出: total_purchase / total_revenue / overall_ratio /
category_ratios / factor_vs_baseline (= overall_ratio / sub_sector_base).

类目波动: 用 coefficient of variation (CV = stddev / mean), CV > 30% 视为高波动.

异常突变: 当某月 overall_ratio 偏离全期均值 ≥30% 算 warning, ≥50% critical.
类目级别异常只在高波动类目 (CV > 20%) 中检测.

使用示例:
    >>> reporter = MonthlyCalibrationReporter(db_session=db, sub_sector_base_ratio=0.43)
    >>> report = reporter.generate(factory_id="F001", months_back=6)
    >>> print(report.summary)
    分析 6 个月数据, 平均食材成本率 42.3%
    >>> for snap in report.periods:
    ...     print(snap.period, snap.overall_ratio)
"""
from __future__ import annotations

import logging
import statistics
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# ── Data classes ────────────────────────────────────────────


@dataclass
class CalibrationSnapshot:
    """单月校准快照 (一行 restaurant_monthly_purchases)"""

    period: str  # "2026-02"
    total_purchase: float
    total_revenue: float
    overall_ratio: float
    category_ratios: dict[str, float]
    factor_vs_baseline: float  # overall_ratio / sub_sector_base_ratio

    def to_dict(self) -> dict:
        return {
            "period": self.period,
            "totalPurchase": round(self.total_purchase, 2),
            "totalRevenue": round(self.total_revenue, 2),
            "overallRatio": round(self.overall_ratio, 4),
            "categoryRatios": {
                k: round(v, 4) for k, v in self.category_ratios.items()
            },
            "factorVsBaseline": round(self.factor_vs_baseline, 4),
        }


@dataclass
class CategoryVolatility:
    """类目月间波动度"""

    category: str
    mean_ratio: float
    stddev_ratio: float
    cv_pct: float  # coefficient of variation = stddev / mean
    peak_period: str
    trough_period: str

    def to_dict(self) -> dict:
        return {
            "category": self.category,
            "meanRatio": round(self.mean_ratio, 4),
            "stddevRatio": round(self.stddev_ratio, 4),
            "cvPct": round(self.cv_pct, 4),
            "peakPeriod": self.peak_period,
            "troughPeriod": self.trough_period,
        }


@dataclass
class CalibrationAnomaly:
    """单月异常告警"""

    period: str
    category: Optional[str]  # None = overall ratio, str = 具体类目
    actual_ratio: float
    expected_ratio: float
    delta_pct: float  # 偏差比例 (-1 到 +inf), 正数 = 高于均值
    severity: str  # info / warning / critical

    def to_dict(self) -> dict:
        return {
            "period": self.period,
            "category": self.category,
            "actualRatio": round(self.actual_ratio, 4),
            "expectedRatio": round(self.expected_ratio, 4),
            "deltaPct": round(self.delta_pct, 4),
            "severity": self.severity,
        }


@dataclass
class CalibrationHistoryReport:
    """完整的历史校准报告"""

    factory_id: str
    store_id: Optional[str]
    total_periods: int
    periods: list[CalibrationSnapshot]
    factor_trend: list[dict]  # [{period, factor, ratio}]
    category_volatility: list[CategoryVolatility]
    anomalies: list[CalibrationAnomaly]
    summary: str
    insights: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "factoryId": self.factory_id,
            "storeId": self.store_id,
            "totalPeriods": self.total_periods,
            "periods": [p.to_dict() for p in self.periods],
            "factorTrend": self.factor_trend,
            "categoryVolatility": [v.to_dict() for v in self.category_volatility],
            "anomalies": [a.to_dict() for a in self.anomalies],
            "summary": self.summary,
            "insights": self.insights,
            "recommendations": self.recommendations,
        }


# ── Reporter ────────────────────────────────────────────────


class MonthlyCalibrationReporter:
    """Layer A 月度校准历史报告器

    从 restaurant_monthly_purchases 表读取所有月份, 计算每月的 snapshot,
    识别类目波动 + 异常突变.

    用法:
        >>> from smartbi.services.restaurant import MonthlyCalibrationReporter
        >>> reporter = MonthlyCalibrationReporter(db_session=db)
        >>> report = reporter.generate("F001", months_back=6)
        >>> print(report.to_dict())
    """

    # 异常阈值
    _ANOMALY_DELTA_PCT = 0.30  # 相对均值偏差 ≥30% → warning
    _CRITICAL_DELTA_PCT = 0.50  # ≥50% → critical
    _HIGH_VOLATILITY_CV = 0.20  # CV > 20% 视为高波动类目

    def __init__(self, db_session, sub_sector_base_ratio: float = 0.43):
        self.db_session = db_session
        self.sub_sector_base_ratio = sub_sector_base_ratio

    # ── Main entry ──────────────────────────────────────

    def generate(
        self,
        factory_id: str,
        store_id: Optional[str] = None,
        months_back: int = 6,
    ) -> CalibrationHistoryReport:
        """生成报告

        Args:
            factory_id: 工厂 ID
            store_id: 门店 ID, None = 整店 (聚合)
            months_back: 最近 N 个月 (默认 6)
        """
        from smartbi.database.models import RestaurantMonthlyPurchase

        # 1. 查最近 N 个月数据
        q = self.db_session.query(RestaurantMonthlyPurchase).filter(
            RestaurantMonthlyPurchase.factory_id == factory_id
        )
        if store_id is None:
            q = q.filter(RestaurantMonthlyPurchase.store_id.is_(None))
        else:
            q = q.filter(RestaurantMonthlyPurchase.store_id == store_id)
        rows = q.order_by(RestaurantMonthlyPurchase.period).all()

        if not rows:
            return self._empty(factory_id, store_id, "无月度采购数据")

        # Take last N (rows already sorted ascending by period)
        recent = rows[-months_back:] if len(rows) >= months_back else rows

        # 2. Build snapshots (skip rows with revenue=0)
        snapshots: list[CalibrationSnapshot] = []
        for r in recent:
            try:
                total_rev = float(r.total_revenue or 0)
            except (TypeError, ValueError):
                continue
            if total_rev <= 0:
                continue
            try:
                total_pur = float(r.total_purchase or 0)
            except (TypeError, ValueError):
                continue
            overall_ratio = total_pur / total_rev
            category_ratios: dict[str, float] = {}
            breakdown = r.category_breakdown or {}
            if isinstance(breakdown, dict):
                for cat, amt in breakdown.items():
                    if isinstance(amt, (int, float)) and total_rev > 0:
                        category_ratios[str(cat)] = float(amt) / total_rev
            factor_vs_base = (
                overall_ratio / self.sub_sector_base_ratio
                if self.sub_sector_base_ratio > 0
                else 1.0
            )
            snapshots.append(
                CalibrationSnapshot(
                    period=str(r.period),
                    total_purchase=total_pur,
                    total_revenue=total_rev,
                    overall_ratio=overall_ratio,
                    category_ratios=category_ratios,
                    factor_vs_baseline=factor_vs_base,
                )
            )

        if not snapshots:
            return self._empty(
                factory_id, store_id, "所有月份的 revenue 为 0 (无效数据)"
            )

        # 3. Factor trend
        factor_trend = [
            {
                "period": s.period,
                "factor": round(s.factor_vs_baseline, 4),
                "ratio": round(s.overall_ratio, 4),
            }
            for s in snapshots
        ]

        # 4. Category volatility
        volatility = self._compute_category_volatility(snapshots)

        # 5. Anomalies (overall + category-level for high-volatility cats)
        anomalies = self._detect_anomalies(snapshots, volatility)

        # 6. Insights + summary + recommendations
        summary, insights, recs = self._build_narrative(
            snapshots, volatility, anomalies
        )

        return CalibrationHistoryReport(
            factory_id=factory_id,
            store_id=store_id,
            total_periods=len(snapshots),
            periods=snapshots,
            factor_trend=factor_trend,
            category_volatility=volatility,
            anomalies=anomalies,
            summary=summary,
            insights=insights,
            recommendations=recs,
        )

    # ── Sub-computations ────────────────────────────────

    def _compute_category_volatility(
        self, snapshots: list[CalibrationSnapshot]
    ) -> list[CategoryVolatility]:
        """对每个出现过的类目计算 mean / stddev / CV / 峰谷期"""
        # Gather all categories across all snapshots
        all_cats: set[str] = set()
        for s in snapshots:
            all_cats.update(s.category_ratios.keys())

        result: list[CategoryVolatility] = []
        for cat in sorted(all_cats):
            ratios = [s.category_ratios.get(cat, 0.0) for s in snapshots]
            present = [r for r in ratios if r > 0]
            if len(present) < 2:
                continue
            mean = statistics.mean(present)
            stddev = statistics.stdev(present) if len(present) >= 2 else 0.0
            cv_pct = stddev / mean if mean > 0 else 0.0

            # Peak (highest ratio anywhere) and trough (lowest non-zero ratio)
            peak_idx = max(
                range(len(snapshots)),
                key=lambda i: snapshots[i].category_ratios.get(cat, 0.0),
            )
            trough_candidates = [
                i
                for i in range(len(snapshots))
                if snapshots[i].category_ratios.get(cat, 0.0) > 0
            ]
            if trough_candidates:
                trough_idx = min(
                    trough_candidates,
                    key=lambda i: snapshots[i].category_ratios.get(cat, 0.0),
                )
            else:
                trough_idx = peak_idx

            result.append(
                CategoryVolatility(
                    category=cat,
                    mean_ratio=mean,
                    stddev_ratio=stddev,
                    cv_pct=cv_pct,
                    peak_period=snapshots[peak_idx].period,
                    trough_period=snapshots[trough_idx].period,
                )
            )
        # 按波动度倒序排
        return sorted(result, key=lambda v: -v.cv_pct)

    def _detect_anomalies(
        self,
        snapshots: list[CalibrationSnapshot],
        volatility: list[CategoryVolatility],
    ) -> list[CalibrationAnomaly]:
        """识别 overall + category 级异常"""
        anomalies: list[CalibrationAnomaly] = []

        # Overall anomalies (需要 ≥3 月才有意义)
        overall_ratios = [s.overall_ratio for s in snapshots]
        if len(overall_ratios) >= 3:
            mean_overall = statistics.mean(overall_ratios)
            for s in snapshots:
                if mean_overall <= 0:
                    continue
                delta_pct = (s.overall_ratio - mean_overall) / mean_overall
                if abs(delta_pct) >= self._ANOMALY_DELTA_PCT:
                    severity = (
                        "critical"
                        if abs(delta_pct) >= self._CRITICAL_DELTA_PCT
                        else "warning"
                    )
                    anomalies.append(
                        CalibrationAnomaly(
                            period=s.period,
                            category=None,
                            actual_ratio=s.overall_ratio,
                            expected_ratio=mean_overall,
                            delta_pct=delta_pct,
                            severity=severity,
                        )
                    )

        # Category anomalies (only for top 5 high-volatility cats)
        for v in volatility[:5]:
            if v.cv_pct < self._HIGH_VOLATILITY_CV:
                continue  # 类目本身就稳定, 跳过
            if v.mean_ratio <= 0:
                continue
            for s in snapshots:
                r = s.category_ratios.get(v.category, 0.0)
                if r <= 0:
                    continue
                delta_pct = (r - v.mean_ratio) / v.mean_ratio
                if abs(delta_pct) >= self._ANOMALY_DELTA_PCT:
                    severity = (
                        "critical"
                        if abs(delta_pct) >= self._CRITICAL_DELTA_PCT
                        else "warning"
                    )
                    anomalies.append(
                        CalibrationAnomaly(
                            period=s.period,
                            category=v.category,
                            actual_ratio=r,
                            expected_ratio=v.mean_ratio,
                            delta_pct=delta_pct,
                            severity=severity,
                        )
                    )

        # 按绝对偏差倒序, 最多保留 15 个
        anomalies.sort(key=lambda a: -abs(a.delta_pct))
        return anomalies[:15]

    def _build_narrative(
        self,
        snapshots: list[CalibrationSnapshot],
        volatility: list[CategoryVolatility],
        anomalies: list[CalibrationAnomaly],
    ) -> tuple[str, list[str], list[str]]:
        """生成中文总结 + insights + recommendations"""
        ratios = [s.overall_ratio for s in snapshots]
        mean_ratio = statistics.mean(ratios) if ratios else 0.0

        summary = (
            f"分析 {len(snapshots)} 个月数据, "
            f"平均食材成本率 {mean_ratio * 100:.1f}%"
        )
        if mean_ratio > 0:
            summary += f", baseline factor {mean_ratio / self.sub_sector_base_ratio:.2f}"

        insights: list[str] = []
        if ratios:
            insights.append(
                f"📊 {len(snapshots)} 月平均食材率 {mean_ratio * 100:.1f}%, "
                f"最低 {min(ratios) * 100:.1f}% 最高 {max(ratios) * 100:.1f}%"
            )

        if volatility:
            top_vol = volatility[0]
            insights.append(
                f"📈 波动最大类目: {top_vol.category} (CV {top_vol.cv_pct * 100:.0f}%), "
                f"峰值 {top_vol.peak_period}, 谷值 {top_vol.trough_period}"
            )

        if anomalies:
            critical = [a for a in anomalies if a.severity == "critical"]
            if critical:
                insights.append(
                    f"🔴 发现 {len(critical)} 个严重异常 (偏差 >50%)"
                )
            else:
                insights.append(f"🟡 发现 {len(anomalies)} 个波动异常")

        recs: list[str] = []
        if volatility and volatility[0].cv_pct > 0.30:
            recs.append(
                f"📋 {volatility[0].category} 类目月波动 "
                f"{volatility[0].cv_pct * 100:.0f}% 过大, "
                f"建议锁定稳定供应商或谈判月度价格"
            )
        if anomalies:
            recs.append(
                "📋 复盘异常月份: 查询具体采购单据, 确认是集中采购/换供应商/涨价"
                "还是数据录入错误"
            )
        if len(snapshots) < 3:
            recs.append("📋 数据不足 3 月, 无法准确识别趋势, 建议持续上传月度采购")
        if len(snapshots) >= 6 and not anomalies:
            recs.append("✅ 6 个月数据走势平稳, BOM Layer 3 校准已可信任")

        return summary, insights, recs

    # ── Empty / error helpers ───────────────────────────

    def _empty(
        self, factory_id: str, store_id: Optional[str], reason: str
    ) -> CalibrationHistoryReport:
        return CalibrationHistoryReport(
            factory_id=factory_id,
            store_id=store_id,
            total_periods=0,
            periods=[],
            factor_trend=[],
            category_volatility=[],
            anomalies=[],
            summary=f"数据不足: {reason}",
            insights=[reason],
            recommendations=[],
        )
