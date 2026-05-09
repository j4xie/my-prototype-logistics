"""餐饮 BOM 80% 主入口 — 4 层 COGS 查找

4 层 COGS 来源 (优先级从高到低):
  4. manual_override   — 客户手动覆盖单 SKU (DynamicConfigResolver session/store/factory 层)
  3. sku_form          — 客户填的 TOP 20 SKU 主料成本表单 (Layer 2, ±8%)
  2. monthly_calibrated — 月度采购反推校准 (Layer 3 Layer A 自学习, ±5%)
  1. category_baseline — knowledge/restaurant/cogs/category_costs.yaml (±15%)

交付状态:
  ✅ Week 2: Layer 1 (类目均价默认) + Layer 4 (manual override)
  ✅ Week 4.4: Layer 2 (SKU 表单 via SkuFormManager) + Layer 3 (月度校准 via MonthlyPurchaseCalibrator)

精度承诺 (per 三层学习架构 Image 3):
  Layer 1 only:                ±15% (新店开业即用)
  + Layer 2 (SKU 表单):         ±8%  (客户填 TOP 20 SKU 主料清单)
  + Layer 3 (月度校准):         ±5%  (Layer A 自学习: 月度采购反推)
  + Layer A 完整 (12 月数据):   ±6-8% (硬天花板, 不再突破)

使用示例:
    >>> resolver = RestaurantBomResolver(factory_id="QHJ", sub_sector="火锅")
    >>> result = resolver.resolve_cogs_for_sku(
    ...     sku_name="招牌青花椒鱼",
    ...     category="火锅/招牌主菜",
    ...     selling_price=69.0,
    ... )
    >>> print(result.cogs_amount, result.cogs_pct, result.source)
    27.6  0.4  category_baseline
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Optional

import yaml

from shared.dynamic_config_resolver import DynamicConfigResolver

from .monthly_purchase_calibrator import MonthlyPurchaseCalibrator
from .sku_form_manager import SkuFormManager

logger = logging.getLogger(__name__)


# ── Type definitions ────────────────────────────────────────

CogsSource = Literal[
    "category_baseline",     # Layer 1: knowledge/restaurant/cogs/category_costs.yaml
    "sku_form",              # Layer 2: 客户填的 TOP 20 SKU 表单
    "monthly_calibrated",    # Layer 3: Layer A 自学习
    "store_calibrated",      # Layer 3+: 门店级校准
    "manual_override",       # Layer 4: 客户手动覆盖
    "channel_blend",         # 渠道混合估算 (无 SKU 时回退)
    "no_data",               # 无数据
]

Confidence = Literal["high", "medium", "low", "very_low"]


@dataclass
class CogsResult:
    """带 provenance 的 COGS 估算结果"""
    sku_or_category: str
    cogs_amount: float                       # COGS 元 (单价 or 月度总额)
    cogs_pct: float                          # 占售价/营收比例 (0-1)
    source: CogsSource
    confidence: Confidence
    expected_accuracy_pp: float              # ±X 个百分点 (例: 15.0 表示 ±15%)
    sample_size: Optional[int] = None        # Layer A 自学习样本量
    last_calibrated: Optional[str] = None
    warning: Optional[str] = None            # "COGS 来自行业基准, 建议上传采购数据"
    breakdown: Optional[dict] = None         # 详细拆解

    def to_dict(self) -> dict:
        return {
            "skuOrCategory": self.sku_or_category,
            "cogsAmount": round(self.cogs_amount, 2),
            "cogsPct": round(self.cogs_pct, 4),
            "source": self.source,
            "confidence": self.confidence,
            "expectedAccuracyPp": self.expected_accuracy_pp,
            "sampleSize": self.sample_size,
            "lastCalibrated": self.last_calibrated,
            "warning": self.warning,
            "breakdown": self.breakdown,
        }


# ── Main resolver ───────────────────────────────────────────


class RestaurantBomResolver:
    """餐饮 BOM 80% 4 层查找器

    每个 (factory_id, sub_sector) 组合实例化一次, 共享 category_costs YAML 缓存.
    """

    def __init__(
        self,
        factory_id: str,
        sub_sector: str,
        config_resolver: Optional[DynamicConfigResolver] = None,
        kb_root: Optional[Path] = None,
        sku_form_manager: Optional[SkuFormManager] = None,
        monthly_calibrator: Optional[MonthlyPurchaseCalibrator] = None,
    ):
        if not factory_id:
            raise ValueError("factory_id 不能为空")
        if not sub_sector:
            raise ValueError("sub_sector 必须指定 (用于加载 category_costs)")

        self.factory_id = factory_id
        self.sub_sector = sub_sector
        self.kb_root = kb_root or (Path(__file__).parent.parent.parent / "knowledge" / "restaurant")
        self.config_resolver = config_resolver          # Layer 4 manual override
        self.sku_form_manager = sku_form_manager        # Layer 2 SKU 表单
        self.monthly_calibrator = monthly_calibrator    # Layer 3 月度采购校准

        self._category_costs: dict = {}
        self._load_category_costs()

    # ── Public API ──────────────────────────────────────

    def resolve_cogs_for_sku(
        self,
        sku_name: str,
        category: Optional[str] = None,
        selling_price: Optional[float] = None,
        store_id: Optional[str] = None,
    ) -> CogsResult:
        """4 层 COGS 查找 — SKU 粒度

        Args:
            sku_name: SKU 名 (规范化后, 例 '招牌青花椒鱼')
            category: 品类 (例 '招牌主菜', 用于 Layer 1 fallback)
            selling_price: 售价 (用于 Layer 1 类目均价 → SKU 拆分)
            store_id: 门店 ID (用于 Layer 4 store-level override)

        Returns:
            CogsResult 含来源/置信度/精度等元数据
        """
        # Layer 4: manual override (DynamicConfigResolver)
        if self.config_resolver:
            override = self._lookup_manual_override(sku_name, store_id)
            if override is not None:
                return override

        # Layer 3 (Week 4.4): sku_form — 客户填的 TOP 20 SKU 主料成本表
        if self.sku_form_manager:
            sku_form_result = self._resolve_from_sku_form(sku_name, selling_price)
            if sku_form_result is not None:
                return sku_form_result

        # Layer 2 (Week 4.4): monthly_calibrated — 月度采购反推校准
        # (Layer 1 作为 base, 乘以 calibration factor)
        if self.monthly_calibrator:
            calibrated = self._resolve_from_monthly_calibration(
                sku_name, category, selling_price, store_id
            )
            if calibrated is not None:
                return calibrated

        # Layer 1: category_baseline
        return self._resolve_from_category_baseline(sku_name, category, selling_price)

    def resolve_cogs_for_channel(
        self,
        channel: str,
        revenue: float,
        sub_sector_override: Optional[str] = None,
        store_id: Optional[str] = None,
    ) -> CogsResult:
        """渠道粒度 COGS — 用于 ChannelMarginCalculator

        当客户上传了月度采购汇总, 用 Layer 3 的真实 COGS 比例.
        否则用类目均价的加权平均估算 (基于 sub_sector 食材成本率).

        Args:
            channel: 渠道名 (例 '美团外卖')
            revenue: 该渠道月度营收 (元)
            sub_sector_override: 临时覆盖 sub_sector (默认用 self.sub_sector)
            store_id: 门店 ID

        Returns:
            CogsResult, cogs_amount = 该渠道月度 COGS 估算金额, cogs_pct = 占比
        """
        sub = sub_sector_override or self.sub_sector

        # Layer 4: manual override (channel-level)
        if self.config_resolver:
            key = f"restaurant.cogs.channel.{channel}"
            try:
                cv = self.config_resolver.resolve(key, store_id=store_id, yaml_fallback=None)
                if cv.value is not None:
                    pct = float(cv.value) if isinstance(cv.value, (int, float)) else None
                    if pct is not None:
                        return CogsResult(
                            sku_or_category=channel,
                            cogs_amount=pct * revenue,
                            cogs_pct=pct,
                            source="manual_override",
                            confidence="high",
                            expected_accuracy_pp=2.0,
                            warning=None,
                        )
            except Exception:
                pass

        # Layer 1: 用 sub_sector food_cost_ratio 中位数估算
        food_cost_pct = self._get_subsector_food_cost_ratio(sub)
        if food_cost_pct is None:
            return CogsResult(
                sku_or_category=channel,
                cogs_amount=0.0,
                cogs_pct=0.0,
                source="no_data",
                confidence="very_low",
                expected_accuracy_pp=99.0,
                warning=f"未找到 {sub} 子行业的食材成本率基准, 无法估算 COGS",
            )

        # Layer 2 (Week 4.4): 渠道级也可以受益于月度校准
        if self.monthly_calibrator and self.monthly_calibrator.count(self.factory_id, store_id) > 0:
            factor = self.monthly_calibrator.get_overall_calibration_factor(
                factory_id=self.factory_id,
                layer1_predicted_ratio=food_cost_pct,
                store_id=store_id,
            )
            if factor is not None:
                calibrated_pct = max(0.0, min(1.0, food_cost_pct * factor))
                result = self.monthly_calibrator.compute(self.factory_id, store_id)
                sample_size = result.sample_size if result else 0
                return CogsResult(
                    sku_or_category=channel,
                    cogs_amount=calibrated_pct * revenue,
                    cogs_pct=calibrated_pct,
                    source="monthly_calibrated",
                    confidence=result.confidence if result else "low",
                    expected_accuracy_pp=5.0 if sample_size >= 3 else 8.0,
                    sample_size=sample_size,
                    warning=(
                        f"渠道 COGS 已用月度采购校准 (factor={factor:.3f}, "
                        f"Layer 1 {food_cost_pct * 100:.1f}% → 校准后 {calibrated_pct * 100:.1f}%)"
                    ),
                    breakdown={
                        "subSector": sub,
                        "layer1Base": food_cost_pct,
                        "calibrationFactor": factor,
                    },
                )

        return CogsResult(
            sku_or_category=channel,
            cogs_amount=food_cost_pct * revenue,
            cogs_pct=food_cost_pct,
            source="category_baseline",
            confidence="medium",
            expected_accuracy_pp=15.0,
            warning=(
                f"COGS 来自 {sub} 行业基准 (食材成本率中位 {food_cost_pct * 100:.1f}%), "
                f"建议上传采购汇总以获得 ±5% 精度"
            ),
            breakdown={
                "subSector": sub,
                "foodCostRatioMedian": food_cost_pct,
            },
        )

    def list_categories(self) -> list[str]:
        """列出当前 sub_sector 的所有 category (调试用)"""
        sub_categories = self._category_costs.get("categories", {}).get(self.sub_sector, {})
        return list(sub_categories.keys())

    def get_category_avg_price(self, category: str) -> Optional[dict]:
        """查询某 category 的均价定义"""
        sub_data = self._category_costs.get("categories", {}).get(self.sub_sector, {})
        return sub_data.get(category)

    # ── Layer 1: category baseline ──────────────────────

    def _resolve_from_category_baseline(
        self,
        sku_name: str,
        category: Optional[str],
        selling_price: Optional[float],
    ) -> CogsResult:
        """Layer 1: 用 category_costs.yaml 默认值估算

        策略:
            1. 如果 category 命中 yaml, 用对应 avg_price 作为成本估算
            2. 如果 category 未命中, 用 sub_sector 食材成本率 × 售价
            3. 如果 selling_price 也没有, 用兜底值 (餐饮连锁默认)
        """
        sub_data = self._category_costs.get("categories", {}).get(self.sub_sector)
        if not sub_data:
            sub_data = self._category_costs.get("categories", {}).get("餐饮连锁", {})

        # 尝试匹配 category
        cat_def = None
        if category:
            cat_def = sub_data.get(category) if sub_data else None

        if cat_def and isinstance(cat_def, dict):
            avg_price = cat_def.get("avg_price")
            unit = cat_def.get("unit", "元/份")
            range_list = cat_def.get("range")

            if avg_price is not None:
                # category 命中, 直接用 avg_price 作为 COGS 估算
                cogs_amount = float(avg_price)
                cogs_pct = (
                    cogs_amount / selling_price
                    if selling_price and selling_price > 0
                    else 0.0
                )
                # Cap pct 到合理范围
                cogs_pct = max(0.0, min(1.0, cogs_pct))

                return CogsResult(
                    sku_or_category=sku_name,
                    cogs_amount=cogs_amount,
                    cogs_pct=cogs_pct,
                    source="category_baseline",
                    confidence="medium",
                    expected_accuracy_pp=15.0,
                    warning=(
                        f"COGS 来自 {self.sub_sector}/{category} 行业类目均价 "
                        f"({avg_price} {unit}, 范围 {range_list}), "
                        f"建议上传 SKU 主料成本表单获得 ±8% 精度"
                    ),
                    breakdown={
                        "subSector": self.sub_sector,
                        "category": category,
                        "categoryAvgPrice": avg_price,
                        "unit": unit,
                        "categoryRange": range_list,
                    },
                )

        # category 未命中或无 selling_price → 用 sub_sector 食材成本率
        food_cost_pct = self._get_subsector_food_cost_ratio(self.sub_sector)
        if food_cost_pct and selling_price:
            return CogsResult(
                sku_or_category=sku_name,
                cogs_amount=food_cost_pct * selling_price,
                cogs_pct=food_cost_pct,
                source="category_baseline",
                confidence="low",
                expected_accuracy_pp=20.0,
                warning=(
                    f"未匹配到 category, 用 {self.sub_sector} 平均食材成本率 "
                    f"{food_cost_pct * 100:.1f}% 估算"
                ),
                breakdown={
                    "subSector": self.sub_sector,
                    "fallbackToSubSectorRatio": True,
                    "foodCostRatioMedian": food_cost_pct,
                },
            )

        return CogsResult(
            sku_or_category=sku_name,
            cogs_amount=0.0,
            cogs_pct=0.0,
            source="no_data",
            confidence="very_low",
            expected_accuracy_pp=99.0,
            warning=f"无法估算 {sku_name} 的 COGS: 未匹配 category 且无 sub_sector 基准",
        )

    # ── Layer 3 (Week 4.4): SKU 表单查找 ────────────────

    def _resolve_from_sku_form(
        self,
        sku_name: str,
        selling_price: Optional[float],
    ) -> Optional[CogsResult]:
        """Layer 3: 从客户填的 TOP 20 SKU 表单查找

        精度 ±8% (客户自己填的主料清单, 比类目均价精确得多).
        """
        if not self.sku_form_manager:
            return None

        entry = self.sku_form_manager.lookup(self.factory_id, sku_name)
        if entry is None:
            return None

        # 算 cogs_pct: 优先用传入 selling_price, 否则用 entry 自带的
        cogs_pct = entry.cogs_pct(selling_price)
        if cogs_pct is None:
            cogs_pct = 0.0

        consistency_warning = None
        if not entry.is_consistent(tolerance_pct=0.10):
            consistency_warning = (
                f"SKU 表单明细与总价差异 > 10% "
                f"(total={entry.total_cogs_amount}, ingredients={entry.ingredient_cost_sum()})"
            )

        return CogsResult(
            sku_or_category=sku_name,
            cogs_amount=entry.total_cogs_amount,
            cogs_pct=cogs_pct,
            source="sku_form",
            confidence="high",
            expected_accuracy_pp=8.0,
            sample_size=len(entry.ingredients),
            last_calibrated=entry.uploaded_at,
            warning=consistency_warning,
            breakdown={
                "category": entry.category,
                "ingredients": [i.to_dict() for i in entry.ingredients],
                "ingredientCostSum": round(entry.ingredient_cost_sum(), 2),
                "uploadedBy": entry.uploaded_by,
                "notes": entry.notes,
            },
        )

    # ── Layer 2 (Week 4.4): 月度采购校准 ────────────────

    def _resolve_from_monthly_calibration(
        self,
        sku_name: str,
        category: Optional[str],
        selling_price: Optional[float],
        store_id: Optional[str],
    ) -> Optional[CogsResult]:
        """Layer 2: 用月度采购数据校准 Layer 1 结果

        算法 (store-level factor, 每个 SKU 共用):
          1. 先算 store-level factor = actual_ratio / sub_sector_base_ratio
             例: 邓总火锅 actual 44%, 火锅 sub_sector median 43% → factor 1.024
          2. 再拿 SKU 的 Layer 1 base (category_baseline 估算)
          3. SKU 的 cogs_amount / cogs_pct × factor = 校准后值

        关键: factor 是整店级别的 (不是 per-SKU), 这样所有 SKU 共用同一个调整系数.
        异常边界: factor 必须在 [0.5, 2.0], 否则视为数据错误, 不应用校准.

        精度 ±5% (整店级, 需 1+ 月实际采购数据).
        """
        if not self.monthly_calibrator:
            return None

        if self.monthly_calibrator.count(self.factory_id, store_id) == 0:
            return None  # 没数据, 跳过

        # Step 1: 算 store-level factor (用 sub_sector base ratio)
        sub_sector_base = self._get_subsector_food_cost_ratio(self.sub_sector)
        if sub_sector_base is None:
            return None

        factor = self.monthly_calibrator.get_overall_calibration_factor(
            factory_id=self.factory_id,
            layer1_predicted_ratio=sub_sector_base,
            store_id=store_id,
        )
        if factor is None:
            return None  # factor 异常/数据不足, 保持 Layer 1 结果

        # Step 2: 拿 SKU 的 Layer 1 base (递归调用不走 manual/form/calibration)
        layer1_base = self._resolve_from_category_baseline(
            sku_name, category, selling_price
        )
        if layer1_base.source == "no_data" or layer1_base.cogs_pct == 0:
            return None

        # Step 3: 应用整店 factor 到 SKU 级 cogs
        calibrated_amount = layer1_base.cogs_amount * factor
        calibrated_pct = max(0.0, min(1.0, layer1_base.cogs_pct * factor))

        # Step 4: 拿 result 原始信息 (periods / sample_size / warnings)
        calibration_result = self.monthly_calibrator.compute(
            factory_id=self.factory_id, store_id=store_id
        )
        sample_size = calibration_result.sample_size if calibration_result else 0
        confidence = calibration_result.confidence if calibration_result else "low"
        periods_used = calibration_result.periods_used if calibration_result else []
        calibration_warnings = calibration_result.warnings if calibration_result else []

        warning_msg = (
            f"月度校准 factor={factor:.3f} (基于 {sample_size} 月数据), "
            f"Layer 1 预测 {layer1_base.cogs_pct * 100:.1f}% → "
            f"校准后 {calibrated_pct * 100:.1f}%"
        )
        if calibration_warnings:
            warning_msg += " | " + " | ".join(calibration_warnings)

        return CogsResult(
            sku_or_category=sku_name,
            cogs_amount=calibrated_amount,
            cogs_pct=calibrated_pct,
            source="monthly_calibrated",
            confidence=confidence,
            expected_accuracy_pp=5.0 if sample_size >= 3 else 8.0,
            sample_size=sample_size,
            last_calibrated=calibration_result.computed_at if calibration_result else None,
            warning=warning_msg,
            breakdown={
                "layer1Base": {
                    "cogsAmount": layer1_base.cogs_amount,
                    "cogsPct": layer1_base.cogs_pct,
                    "source": layer1_base.source,
                },
                "calibrationFactor": factor,
                "periodsUsed": periods_used,
                "sampleSize": sample_size,
            },
        )

    # ── Layer 4: manual override ────────────────────────

    def _lookup_manual_override(
        self,
        sku_name: str,
        store_id: Optional[str],
    ) -> Optional[CogsResult]:
        """Layer 4: 通过 DynamicConfigResolver 查 manual override"""
        if not self.config_resolver:
            return None

        key = f"restaurant.cogs.sku.{sku_name}"
        try:
            cv = self.config_resolver.resolve(key, store_id=store_id, yaml_fallback=None)
        except Exception:
            return None

        if cv.value is None:
            return None

        # 支持两种格式: 数值 (绝对成本) 或 dict {amount, pct}
        if isinstance(cv.value, (int, float)):
            return CogsResult(
                sku_or_category=sku_name,
                cogs_amount=float(cv.value),
                cogs_pct=0.0,
                source="manual_override",
                confidence="high",
                expected_accuracy_pp=2.0,
                last_calibrated=str(cv.last_updated) if cv.last_updated else None,
            )

        if isinstance(cv.value, dict):
            return CogsResult(
                sku_or_category=sku_name,
                cogs_amount=float(cv.value.get("amount", 0)),
                cogs_pct=float(cv.value.get("pct", 0)),
                source="manual_override",
                confidence="high",
                expected_accuracy_pp=2.0,
                last_calibrated=str(cv.last_updated) if cv.last_updated else None,
            )
        return None

    # ── 内部: 加载 category_costs.yaml ──────────────────

    def _load_category_costs(self) -> None:
        """加载 knowledge/restaurant/cogs/category_costs.yaml"""
        path = self.kb_root / "cogs" / "category_costs.yaml"
        if not path.exists():
            logger.warning(f"category_costs.yaml 不存在: {path}")
            self._category_costs = {"categories": {}}
            return
        try:
            with open(path, encoding="utf-8") as f:
                self._category_costs = yaml.safe_load(f) or {"categories": {}}
            cat_count = sum(
                len(v) for v in self._category_costs.get("categories", {}).values() if isinstance(v, dict)
            )
            logger.debug(
                f"加载 category_costs.yaml: {len(self._category_costs.get('categories', {}))} 子行业, "
                f"{cat_count} 个类目"
            )
        except Exception as e:
            logger.error(f"加载 category_costs.yaml 失败: {e}")
            self._category_costs = {"categories": {}}

    def _get_subsector_food_cost_ratio(self, sub_sector: str) -> Optional[float]:
        """获取子行业食材成本率中位数 (从 _common.yaml + sub_sector.yaml 合并取)

        Returns:
            0-1 比率 (例 0.43 表示 43%), None 表示未找到
        """
        # 简化: 直接读 _common.yaml 的 food_cost_ratio.median
        # 严格做法应合并 sub_sector benchmark, 但 BomResolver 不应耦合 BenchmarkAlertEngine
        common_path = self.kb_root / "benchmarks" / "_common.yaml"
        sub_path = self.kb_root / "benchmarks" / f"{sub_sector}.yaml"

        median = None
        try:
            if common_path.exists():
                with open(common_path, encoding="utf-8") as f:
                    common = yaml.safe_load(f) or {}
                metric = (common.get("metrics") or {}).get("food_cost_ratio")
                if metric and "median" in metric:
                    median = float(metric["median"])

            if sub_path.exists():
                with open(sub_path, encoding="utf-8") as f:
                    sub = yaml.safe_load(f) or {}
                metric = (sub.get("metrics") or {}).get("food_cost_ratio")
                if metric and "median" in metric:
                    median = float(metric["median"])
        except Exception as e:
            logger.error(f"读取 food_cost_ratio benchmark 失败: {e}")
            return None

        if median is None:
            return None

        # 转换 % → 比率
        if median > 1:
            median = median / 100.0
        return median
