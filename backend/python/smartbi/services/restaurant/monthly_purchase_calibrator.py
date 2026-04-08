"""月度采购反推校准 — Layer 3 (Week 4.4, Layer A 自学习核心)

设计依据 (Image 3 三层学习架构的 Layer A):
  - 客户月底会做采购汇总 (ERP 或 Excel), 我们用这个数据反推校准 Layer 1/2
  - Layer 1 是行业类目均价 (±15%), Layer 2 是客户 SKU 表单 (±8%)
  - Layer 3 用 "月度采购 - 月初余量 + 月末余量" 算出实际消耗, 校准类目系数

校准算法 (极简版 — 整店级):
    actual_ratio = total_purchase / total_revenue
    calibration_factor = actual_ratio / layer1_predicted_ratio
    # 例: Layer 1 预测 40%, 实际 45.85% → factor = 1.146
    # 所有 Layer 1 估算 × 1.146 得到 Layer 3 校准结果

校准算法 (完整版 — 类目级):
    for each category in breakdown:
        layer1_category_cost = sum(sku_layer1_cost * monthly_sales for sku in category)
        actual_category_cost = purchase_breakdown[category]
        category_factor = actual_category_cost / layer1_category_cost
        # 例: 肉类 Layer 1 预测 60K, 实际购买 80K → factor = 1.33
        # 所有肉类 SKU Layer 1 估算 × 1.33

诚实边界 (Layer C):
  - 需要至少 1 个月完整数据
  - 最好 3 个月数据做平均, 消除单月异常
  - 如果类目 factor > 2 或 < 0.5, 说明数据异常, 不应用校准

精度:
  - 整店级 ±5%     (只需 total_purchase + total_revenue)
  - 类目级 ±8%     (需要 category_breakdown)
  - 3 月平均 ±3-5% (更稳健)

使用示例:
    >>> calibrator = MonthlyPurchaseCalibrator()
    >>> entry = MonthlyPurchaseEntry(
    ...     factory_id="DENG",
    ...     period="2026-02",
    ...     total_purchase=335212.75,
    ...     total_revenue=731047.52,
    ...     category_breakdown={
    ...         "肉类": 180000, "海鲜": 55000, "蔬菜水果": 38000,
    ...         "米面干货": 25000, "调料": 22000, "包材": 15212.75,
    ...     },
    ... )
    >>> calibrator.upload(entry)
    >>> factor = calibrator.get_overall_calibration_factor(
    ...     factory_id="DENG",
    ...     layer1_predicted_ratio=0.40,  # Layer 1 预测 40%
    ... )
    >>> print(factor)  # ≈ 1.146
"""
from __future__ import annotations

import logging
import statistics
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ── Data types ──────────────────────────────────────────────


@dataclass
class MonthlyPurchaseEntry:
    """一次月度采购汇总"""
    factory_id: str
    period: str                              # "2026-02" / "2026-Q1"
    total_purchase: float                    # 总采购额 (元)
    total_revenue: float                     # 当期营收 (用于算 ratio)
    category_breakdown: dict[str, float] = field(default_factory=dict)
    # {"肉类": 180000, "海鲜": 55000, ...}

    store_id: Optional[str] = None           # 可选: 按门店
    uploaded_at: str = field(default_factory=lambda: datetime.now().isoformat())
    uploaded_by: Optional[str] = None
    notes: Optional[str] = None

    @property
    def overall_ratio(self) -> float:
        """整店食材成本率 (0-1)"""
        if self.total_revenue <= 0:
            return 0.0
        return self.total_purchase / self.total_revenue

    @property
    def breakdown_sum(self) -> float:
        """类目明细加总 (校验用)"""
        return sum(self.category_breakdown.values())

    def is_breakdown_consistent(self, tolerance_pct: float = 0.02) -> bool:
        """检查类目明细是否等于总采购 (允许 2% 误差)"""
        if not self.category_breakdown:
            return True  # 没填明细, 跳过校验
        if self.total_purchase == 0:
            return self.breakdown_sum == 0
        delta = abs(self.breakdown_sum - self.total_purchase) / self.total_purchase
        return delta <= tolerance_pct

    def to_dict(self) -> dict:
        return {
            "factoryId": self.factory_id,
            "storeId": self.store_id,
            "period": self.period,
            "totalPurchase": round(self.total_purchase, 2),
            "totalRevenue": round(self.total_revenue, 2),
            "overallRatio": round(self.overall_ratio, 4),
            "categoryBreakdown": {
                k: round(v, 2) for k, v in self.category_breakdown.items()
            },
            "breakdownSum": round(self.breakdown_sum, 2),
            "isBreakdownConsistent": self.is_breakdown_consistent(),
            "uploadedAt": self.uploaded_at,
            "uploadedBy": self.uploaded_by,
            "notes": self.notes,
        }


@dataclass
class CalibrationResult:
    """一次校准计算的输出"""
    factory_id: str
    store_id: Optional[str]
    computed_at: str
    periods_used: list[str]                  # ["2026-01", "2026-02", "2026-03"]
    sample_size: int                         # 使用的月份数
    overall_factor: float                    # 整店 factor
    overall_actual_ratio: float              # 实际总 ratio
    category_factors: dict[str, float] = field(default_factory=dict)
    # {"肉类": 1.33, "海鲜": 0.87, ...}
    category_actual_ratios: dict[str, float] = field(default_factory=dict)
    # 每类占整店比例
    confidence: str = "medium"               # "high" (≥3 月) / "medium" (2 月) / "low" (1 月)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "factoryId": self.factory_id,
            "storeId": self.store_id,
            "computedAt": self.computed_at,
            "periodsUsed": self.periods_used,
            "sampleSize": self.sample_size,
            "overallFactor": round(self.overall_factor, 4),
            "overallActualRatio": round(self.overall_actual_ratio, 4),
            "categoryFactors": {k: round(v, 4) for k, v in self.category_factors.items()},
            "categoryActualRatios": {
                k: round(v, 4) for k, v in self.category_actual_ratios.items()
            },
            "confidence": self.confidence,
            "warnings": self.warnings,
        }


# ── Calibrator ──────────────────────────────────────────────


class MonthlyPurchaseCalibrator:
    """月度采购校准器 — Layer A 自学习引擎

    双模式 (W5.1):
      - db_session=None: in-memory (单测)
      - db_session=Session: DB 持久化 (生产, restaurant_monthly_purchases 表)

    职责:
      1. 存储月度采购汇总 (多期)
      2. 计算整店级校准因子 (total_purchase / total_revenue)
      3. 计算类目级校准因子 (category_breakdown / layer1_category_cost)
      4. 多期平均 + 异常检测
      5. 返回 CalibrationResult 供 BomResolver 使用
    """

    # 异常边界 — 超出这个范围的 factor 视为数据错误, 不应用
    _FACTOR_MIN = 0.50
    _FACTOR_MAX = 2.00

    def __init__(self, db_session: Optional[Any] = None) -> None:
        self.db_session = db_session
        # in-memory fallback: (factory_id, store_id or '') → list[MonthlyPurchaseEntry]
        self._store: dict[tuple[str, str], list[MonthlyPurchaseEntry]] = {}

    # ── Internal: DB helpers ───────────────────────────

    @staticmethod
    def _db_to_entry(row: Any) -> MonthlyPurchaseEntry:
        """Convert RestaurantMonthlyPurchase ORM row → MonthlyPurchaseEntry dataclass"""
        return MonthlyPurchaseEntry(
            factory_id=row.factory_id,
            period=row.period,
            total_purchase=float(row.total_purchase),
            total_revenue=float(row.total_revenue),
            category_breakdown=row.category_breakdown or {},
            store_id=row.store_id,
            uploaded_at=row.created_at.isoformat() if row.created_at else datetime.now().isoformat(),
            uploaded_by=row.uploaded_by,
            notes=row.notes,
        )

    def _load_entries(
        self, factory_id: str, store_id: Optional[str] = None
    ) -> list[MonthlyPurchaseEntry]:
        """统一读取入口: DB 或 memory"""
        if self.db_session is not None:
            from smartbi.database.models import RestaurantMonthlyPurchase
            q = self.db_session.query(RestaurantMonthlyPurchase).filter(
                RestaurantMonthlyPurchase.factory_id == factory_id
            )
            if store_id is None:
                q = q.filter(RestaurantMonthlyPurchase.store_id.is_(None))
            else:
                q = q.filter(RestaurantMonthlyPurchase.store_id == store_id)
            rows = q.order_by(RestaurantMonthlyPurchase.period).all()
            return [self._db_to_entry(r) for r in rows]

        key = (factory_id, store_id or "")
        return list(self._store.get(key, []))

    # ── Upload ──────────────────────────────────────────

    def upload(self, entry: MonthlyPurchaseEntry) -> None:
        """上传一条月度采购数据 (UPSERT: 同 period 覆盖)"""
        if not entry.factory_id:
            raise ValueError("factory_id 不能为空")
        if entry.total_purchase < 0 or entry.total_revenue < 0:
            raise ValueError("total_purchase 和 total_revenue 不能为负数")

        if not entry.is_breakdown_consistent():
            logger.warning(
                f"月度采购明细与总额不一致 period={entry.period}, "
                f"total={entry.total_purchase}, sum={entry.breakdown_sum}"
            )

        if self.db_session is not None:
            from smartbi.database.models import RestaurantMonthlyPurchase

            q = self.db_session.query(RestaurantMonthlyPurchase).filter(
                RestaurantMonthlyPurchase.factory_id == entry.factory_id,
                RestaurantMonthlyPurchase.period == entry.period,
            )
            if entry.store_id is None:
                q = q.filter(RestaurantMonthlyPurchase.store_id.is_(None))
            else:
                q = q.filter(RestaurantMonthlyPurchase.store_id == entry.store_id)
            existing = q.first()

            kwargs = {
                "factory_id": entry.factory_id,
                "store_id": entry.store_id,
                "period": entry.period,
                "total_purchase": entry.total_purchase,
                "total_revenue": entry.total_revenue,
                "category_breakdown": entry.category_breakdown or {},
                "uploaded_by": entry.uploaded_by,
                "notes": entry.notes,
            }

            if existing:
                for k, v in kwargs.items():
                    setattr(existing, k, v)
            else:
                new_row = RestaurantMonthlyPurchase(**kwargs)
                self.db_session.add(new_row)
            self.db_session.commit()
            return

        # in-memory mode
        key = (entry.factory_id, entry.store_id or "")
        if key not in self._store:
            self._store[key] = []
        existing = [e for e in self._store[key] if e.period != entry.period]
        existing.append(entry)
        existing.sort(key=lambda e: e.period)
        self._store[key] = existing

    def list_periods(
        self, factory_id: str, store_id: Optional[str] = None
    ) -> list[str]:
        """列出已上传的 period"""
        return [e.period for e in self._load_entries(factory_id, store_id)]

    def count(self, factory_id: str, store_id: Optional[str] = None) -> int:
        if self.db_session is not None:
            from smartbi.database.models import RestaurantMonthlyPurchase
            q = self.db_session.query(RestaurantMonthlyPurchase).filter(
                RestaurantMonthlyPurchase.factory_id == factory_id
            )
            if store_id is None:
                q = q.filter(RestaurantMonthlyPurchase.store_id.is_(None))
            else:
                q = q.filter(RestaurantMonthlyPurchase.store_id == store_id)
            return q.count()
        key = (factory_id, store_id or "")
        return len(self._store.get(key, []))

    # ── Calibration compute ─────────────────────────────

    def compute(
        self,
        factory_id: str,
        store_id: Optional[str] = None,
        max_periods: int = 3,
    ) -> Optional[CalibrationResult]:
        """计算校准结果 (取最近 max_periods 个月的平均)

        Args:
            factory_id: 工厂/门店 ID
            store_id: 可选门店过滤
            max_periods: 最多用多少个月 (默认 3 月平均)

        Returns:
            CalibrationResult, 没有数据时返回 None
        """
        entries = self._load_entries(factory_id, store_id)
        if not entries:
            return None

        # 取最近 N 个月 (period 字符串排序, "2026-02" > "2026-01")
        recent = sorted(entries, key=lambda e: e.period, reverse=True)[:max_periods]
        recent.reverse()  # 恢复时间正序

        sample_size = len(recent)
        periods_used = [e.period for e in recent]
        warnings: list[str] = []

        # ── 整店级校准 ────────────────────────────────
        overall_ratios = [e.overall_ratio for e in recent if e.total_revenue > 0]
        if not overall_ratios:
            return CalibrationResult(
                factory_id=factory_id,
                store_id=store_id,
                computed_at=datetime.now().isoformat(),
                periods_used=periods_used,
                sample_size=sample_size,
                overall_factor=1.0,
                overall_actual_ratio=0.0,
                confidence="low",
                warnings=["所有期间营收为 0, 无法校准"],
            )

        avg_actual_ratio = statistics.mean(overall_ratios)

        # 整店 factor: 相对于 Layer 1 预测 0.40 (餐饮平均食材成本率)
        # 真实使用时, 由 BomResolver 调用 get_overall_calibration_factor(layer1_predicted_ratio)
        overall_factor = 1.0  # 暂占位, 调用方传 layer1 预测

        # ── 类目级校准 ────────────────────────────────
        category_factors: dict[str, float] = {}
        category_actual_ratios: dict[str, float] = {}

        # 收集所有 category (取所有月份的 union)
        all_categories: set[str] = set()
        for e in recent:
            all_categories.update(e.category_breakdown.keys())

        for cat in all_categories:
            # 该类目的平均占比 (cat_cost / total_revenue)
            cat_ratios = []
            for e in recent:
                if cat in e.category_breakdown and e.total_revenue > 0:
                    cat_ratios.append(e.category_breakdown[cat] / e.total_revenue)

            if not cat_ratios:
                continue

            avg_cat_ratio = statistics.mean(cat_ratios)
            category_actual_ratios[cat] = avg_cat_ratio

            # 类目 factor 暂记为占比本身, 调用方需传 layer1 base 做对比
            # 这里先存 ratio, compute() 返回后由 BomResolver 做 factor 计算
            category_factors[cat] = avg_cat_ratio  # 占位

        # ── 置信度 ────────────────────────────────────
        if sample_size >= 3:
            confidence = "high"
        elif sample_size == 2:
            confidence = "medium"
        else:
            confidence = "low"
            warnings.append("只有 1 个月数据, 建议累积 3 月以上获得稳定校准")

        # ── 异常检测 ──────────────────────────────────
        if avg_actual_ratio > 0.70:
            warnings.append(
                f"整店食材成本率 {avg_actual_ratio * 100:.1f}% 异常偏高 (行业健康 <50%), "
                f"可能数据录入错误或采购异常"
            )
        if avg_actual_ratio < 0.15:
            warnings.append(
                f"整店食材成本率 {avg_actual_ratio * 100:.1f}% 异常偏低, "
                f"可能漏了某些采购类目"
            )

        # 类目异常: 单月占比和平均偏差 > 30%
        for cat in all_categories:
            cat_ratios = [
                e.category_breakdown[cat] / e.total_revenue
                for e in recent
                if cat in e.category_breakdown and e.total_revenue > 0
            ]
            if len(cat_ratios) >= 2:
                cat_mean = statistics.mean(cat_ratios)
                cat_max_delta = max(abs(r - cat_mean) / cat_mean for r in cat_ratios if cat_mean > 0)
                if cat_max_delta > 0.30:
                    warnings.append(
                        f"{cat} 类目月度波动 {cat_max_delta * 100:.0f}% > 30%, "
                        f"可能有库存囤货/集中采购"
                    )

        return CalibrationResult(
            factory_id=factory_id,
            store_id=store_id,
            computed_at=datetime.now().isoformat(),
            periods_used=periods_used,
            sample_size=sample_size,
            overall_factor=overall_factor,
            overall_actual_ratio=avg_actual_ratio,
            category_factors=category_factors,
            category_actual_ratios=category_actual_ratios,
            confidence=confidence,
            warnings=warnings,
        )

    # ── 对外 API: factor 查询 ───────────────────────────

    def get_overall_calibration_factor(
        self,
        factory_id: str,
        layer1_predicted_ratio: float,
        store_id: Optional[str] = None,
    ) -> Optional[float]:
        """算整店 factor = actual_ratio / layer1_predicted_ratio

        例: Layer 1 预测 40%, 实际 45.85% → factor = 1.146
        BomResolver 拿到 factor 后, 所有 SKU 的 Layer 1 cogs × 1.146 得到 Layer 3.

        Returns:
            factor (0.5-2.0) 或 None (数据不足/异常)
        """
        if layer1_predicted_ratio <= 0:
            return None

        result = self.compute(factory_id, store_id=store_id)
        if result is None or result.overall_actual_ratio == 0:
            return None

        factor = result.overall_actual_ratio / layer1_predicted_ratio

        # 异常检测: factor 超出 [0.5, 2.0] 视为数据错误
        if factor < self._FACTOR_MIN or factor > self._FACTOR_MAX:
            logger.warning(
                f"factory={factory_id} 校准 factor {factor:.3f} 超出合理边界 "
                f"[{self._FACTOR_MIN}, {self._FACTOR_MAX}], 不应用校准"
            )
            return None

        return factor

    def get_category_calibration_factor(
        self,
        factory_id: str,
        category: str,
        layer1_category_ratio: float,
        store_id: Optional[str] = None,
    ) -> Optional[float]:
        """算类目级 factor

        Args:
            factory_id
            category: 类目名 (例 '肉类')
            layer1_category_ratio: Layer 1 对该类目的预测占营收比 (例 0.10)
            store_id

        Returns:
            factor 或 None
        """
        if layer1_category_ratio <= 0:
            return None

        result = self.compute(factory_id, store_id=store_id)
        if result is None:
            return None

        actual_cat_ratio = result.category_actual_ratios.get(category)
        if actual_cat_ratio is None or actual_cat_ratio == 0:
            return None

        factor = actual_cat_ratio / layer1_category_ratio

        if factor < self._FACTOR_MIN or factor > self._FACTOR_MAX:
            logger.warning(
                f"factory={factory_id} cat={category} factor {factor:.3f} 异常"
            )
            return None

        return factor
