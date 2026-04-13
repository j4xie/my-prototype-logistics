"""通用对标预警引擎 — 13 个 sub_sector benchmark YAML 的零成本最大杠杆

核心思路 (来自 Researcher C):
  14 个 benchmark YAML 已经躺在 knowledge/restaurant/benchmarks/, 但从未被对标预警系统使用.
  本引擎自动遍历 benchmark, 跟客户实测对比, 生成"您 X% 高于行业 Y%, 一年多支出 Z 元"的预警.

设计目标:
  - 销售可话能力 ⭐⭐⭐⭐⭐ (邓总 demo 时直接拿出来"哇")
  - 实现成本 ⭐ (复用现有 benchmark, 几乎不写新代码)
  - 客户感知价值 ⭐⭐⭐⭐⭐

数据流:
  customer_metrics (单店或多店实测)
       ↓
  benchmark.yaml (行业范围/中位数)
       ↓
  对比 → 预警 → 估算"一年损失金额"
       ↓
  BenchmarkAlert 列表 (按严重度排序)

使用示例:
    >>> engine = BenchmarkAlertEngine(domain="restaurant", sub_sector="火锅")
    >>> alerts = engine.alert_for_store(
    ...     store_name="鼎鲜火锅·义乌",
    ...     metrics={"food_cost_ratio": 45.85, "labor_cost_ratio": 32.51},
    ...     monthly_revenue=731047.52,
    ... )
    >>> for a in alerts:
    ...     print(a.message_zh)
    人力成本率 32.51% 接近行业上限 (火锅基准 25-35%, 中位 30%),
    比中位高 2.51 个百分点, 一年多支出约 ¥21,996, 建议立即重排班.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal, Optional

import yaml

logger = logging.getLogger(__name__)


# ── Type definitions ────────────────────────────────────────

Domain = Literal["restaurant", "factory"]
Severity = Literal["red", "yellow", "info"]


@dataclass
class BenchmarkAlert:
    """单个对标预警

    Attributes:
        metric_key: benchmark metric key, 例 'food_cost_ratio'
        metric_name_zh: 中文名
        store_name: 触发预警的门店 (None = 工厂级)
        actual_value: 实测值
        median: 行业中位数
        range_low/range_high: 行业范围
        delta_pp_from_median: 相对中位数偏差 (绝对值, 百分点单位)
        delta_pp_from_high: 相对范围上限偏差 (>0 = 超出上限)
        severity: 'red'/'yellow'/'info'
        higher_is_worse: 越高越糟
        estimated_yearly_impact: 估算的"一年多/少支出"金额, None 表示无营收数据
        message_zh: 完整可话术
        action_hint: 简短行动建议
        source: benchmark 来源
"""
    metric_key: str
    metric_name_zh: str
    store_name: Optional[str]
    actual_value: float
    median: float
    range_low: float
    range_high: float
    delta_pp_from_median: float
    delta_pp_from_high: float
    severity: Severity
    higher_is_worse: bool
    estimated_yearly_impact: Optional[float] = None
    message_zh: str = ""
    action_hint: str = ""
    source: str = ""

    def to_dict(self) -> dict:
        result = {
            "metricKey": self.metric_key,
            "metricNameZh": self.metric_name_zh,
            "storeName": self.store_name,
            "actualValue": self.actual_value,
            "median": self.median,
            "rangeLow": self.range_low,
            "rangeHigh": self.range_high,
            "deltaPpFromMedian": self.delta_pp_from_median,
            "deltaPpFromHigh": self.delta_pp_from_high,
            "severity": self.severity,
            "higherIsWorse": self.higher_is_worse,
            "estimatedYearlyImpact": self.estimated_yearly_impact,
            "messageZh": self.message_zh,
            "actionHint": self.action_hint,
            "source": self.source,
        }
        result["barShape"] = self._compute_bar_shape()
        return result

    def _compute_bar_shape(self) -> dict:
        """Pre-compute scale + fill ratio + marker position for frontend bar rendering.

        Frontend uses this to render a horizontal comparison bar without
        re-doing the math. Scale starts at 0 and extends to
        max(actual, range_high or actual) * 1.1 for visual headroom.
        """
        range_h = self.range_high if self.range_high is not None else self.actual_value
        scale_max = max(self.actual_value, range_h) * 1.1
        scale_min = 0
        denom = scale_max - scale_min if scale_max > scale_min else 1

        return {
            "actual": round(self.actual_value, 4),
            "median": round(self.median, 4) if self.median is not None else None,
            "rangeLow": round(self.range_low, 4) if self.range_low is not None else None,
            "rangeHigh": round(self.range_high, 4) if self.range_high is not None else None,
            "scaleMin": scale_min,
            "scaleMax": round(scale_max, 4),
            "fillRatio": round((self.actual_value - scale_min) / denom, 4),
            "markerPosition": (
                round((self.median - scale_min) / denom, 4)
                if self.median is not None else None
            ),
        }


# ── Main engine ─────────────────────────────────────────────


class BenchmarkAlertEngine:
    """通用对标预警引擎

    每个 (domain, sub_sector) 实例化一次, 共享 benchmark 缓存.
    """

    # 简短行动建议 (按 metric_key 映射)
    _ACTION_HINTS = {
        "food_cost_ratio": "建议优化供应商集中度 / 减少损耗",
        "labor_cost_ratio": "建议立即重排班, 调整全职兼职比例",
        "rent_ratio": "建议核查租约可降空间, 评估异店客流转化",
        "discount_rate": "建议评估打折活动 ROI, 削减低 ROI 渠道",
        "waste_loss_rate": "建议加强 FIFO 管理, 排查过期食材",
        "average_ticket": "建议设计高客单菜品组合 / 提升套餐附加率",
        "table_turnover": "建议优化高峰时段服务流程 / 加强排队引导",
        "restaurant_net_margin": "综合优化食材+人力+租金三大块",
    }

    def __init__(
        self,
        domain: Domain,
        sub_sector: str,
        kb_root: Optional[Path] = None,
    ):
        if domain not in ("restaurant", "factory"):
            raise ValueError(
                f"domain 必须是 'restaurant' 或 'factory', 收到 {domain!r}"
            )
        if not sub_sector:
            raise ValueError("benchmark 预警必须指定 sub_sector")

        self.domain: Domain = domain
        self.sub_sector = sub_sector
        self.kb_root = kb_root or (Path(__file__).parent.parent / "knowledge" / domain)
        self._benchmarks: dict = {}
        self._load_benchmarks()

    # ── Public API ──────────────────────────────────────

    def alert_for_store(
        self,
        store_name: str,
        metrics: dict[str, float],
        monthly_revenue: Optional[float] = None,
    ) -> list[BenchmarkAlert]:
        """对单店 metric 跑预警

        Args:
            store_name: 门店名 (用于报告)
            metrics: {metric_key: actual_value}
            monthly_revenue: 月营收 (用于估算"一年多支出"金额, None 时跳过估算)

        Returns:
            按 severity 降序的预警列表
        """
        alerts: list[BenchmarkAlert] = []
        for metric_key, actual in metrics.items():
            alert = self._evaluate_one(
                metric_key, actual, store_name, monthly_revenue
            )
            if alert is not None:
                alerts.append(alert)

        severity_order = {"red": 0, "yellow": 1, "info": 2}
        alerts.sort(key=lambda a: (severity_order.get(a.severity, 99), -abs(a.delta_pp_from_median)))
        return alerts

    def alert_for_chain(
        self,
        store_metrics: dict[str, dict[str, float]],
        revenue_per_store: Optional[dict[str, float]] = None,
    ) -> dict[str, list[BenchmarkAlert]]:
        """对连锁多店跑预警

        Args:
            store_metrics: {store_name: {metric_key: value}}
            revenue_per_store: {store_name: monthly_revenue}, 可选

        Returns:
            {store_name: [BenchmarkAlert, ...]}
        """
        result = {}
        for store, metrics in store_metrics.items():
            revenue = (revenue_per_store or {}).get(store)
            result[store] = self.alert_for_store(store, metrics, revenue)
        return result

    def list_benchmark_metrics(self) -> list[str]:
        """列出所有可对标的 metric (调试用)"""
        return list(self._benchmarks.get("metrics", {}).keys())

    # ── 内部: 评估单个 metric ───────────────────────────

    def _evaluate_one(
        self,
        metric_key: str,
        actual_value: float,
        store_name: str,
        monthly_revenue: Optional[float],
    ) -> Optional[BenchmarkAlert]:
        """评估单个 metric, 返回 None 当未注册或健康"""
        benchmark = self._benchmarks.get("metrics", {}).get(metric_key)
        if benchmark is None:
            return None

        range_list = benchmark.get("range")
        median = benchmark.get("median")
        if not range_list or len(range_list) != 2 or median is None:
            return None

        low, high = float(range_list[0]), float(range_list[1])
        median = float(median)
        higher_is_worse = benchmark.get("higher_is_worse", True)
        name_zh = benchmark.get("name", metric_key)
        unit = benchmark.get("unit", "%")
        source = benchmark.get("source", "")

        delta_pp_median = actual_value - median
        delta_pp_high = actual_value - high

        # 评估 severity (3 档)
        severity = self._evaluate_severity(
            actual_value, low, high, median, higher_is_worse
        )

        # 健康项不返回 (减少噪音)
        if severity == "info":
            # 例外: actual 朝"好"方向时 info, 不返回
            is_good = (
                (higher_is_worse and actual_value < median - (median - low) * 0.3)
                or (not higher_is_worse and actual_value > median + (high - median) * 0.3)
            )
            if is_good:
                return None
            # 健康范围内, 也不返回
            if low <= actual_value <= high:
                return None

        # 估算年度影响金额
        yearly_impact = None
        if monthly_revenue and monthly_revenue > 0:
            yearly_impact = self._estimate_yearly_impact(
                metric_key, actual_value, median, monthly_revenue, higher_is_worse
            )

        # 生成中文消息
        message_zh = self._render_message(
            store_name=store_name,
            name_zh=name_zh,
            actual=actual_value,
            median=median,
            high=high,
            low=low,
            unit=unit,
            severity=severity,
            higher_is_worse=higher_is_worse,
            yearly_impact=yearly_impact,
        )

        action_hint = self._ACTION_HINTS.get(metric_key, "")

        return BenchmarkAlert(
            metric_key=metric_key,
            metric_name_zh=name_zh,
            store_name=store_name,
            actual_value=actual_value,
            median=median,
            range_low=low,
            range_high=high,
            delta_pp_from_median=round(delta_pp_median, 4),
            delta_pp_from_high=round(delta_pp_high, 4),
            severity=severity,
            higher_is_worse=higher_is_worse,
            estimated_yearly_impact=round(yearly_impact, 2) if yearly_impact else None,
            message_zh=message_zh,
            action_hint=action_hint,
            source=source,
        )

    @staticmethod
    def _evaluate_severity(
        actual: float,
        low: float,
        high: float,
        median: float,
        higher_is_worse: bool,
    ) -> Severity:
        """评估严重度 — 用 range_position 衡量, 比中位数偏移更直观

        range_position = (actual - low) / (high - low)
            0.0 = 最低端
            0.5 = 范围中位 (但不一定等于 median)
            1.0 = 最高端
            >1.0 = 超出范围

        higher_is_worse=True (越高越糟):
            range_position > 1.25  → red    (严重超标, 超出上限 25% 范围宽度)
            range_position > 1.0   → yellow (超标)
            range_position > 0.7   → yellow (接近上限警戒, 在范围 70%+ 位置)
            else → info

        higher_is_worse=False (越低越糟):
            对称逻辑
        """
        range_width = high - low
        if range_width <= 0:
            return "info"

        range_position = (actual - low) / range_width

        if higher_is_worse:
            if range_position > 1.25:
                return "red"
            if range_position > 1.0:
                return "yellow"
            if range_position > 0.7:
                return "yellow"
            return "info"
        else:
            if range_position < -0.25:
                return "red"
            if range_position < 0.0:
                return "yellow"
            if range_position < 0.3:
                return "yellow"
            return "info"

    @staticmethod
    def _estimate_yearly_impact(
        metric_key: str,
        actual: float,
        median: float,
        monthly_revenue: float,
        higher_is_worse: bool,
    ) -> Optional[float]:
        """估算"一年多/少支出"金额

        CONTRACT: actual 和 median 必须是百分比形式 (例 32.51 表示 32.51%),
        不接受 0-1 比率形式. 调用方 (RestaurantAnalyzerV2._extract_financial_metrics)
        已统一乘以 100. 旧的 0-1 自动检测已废除, 因为会把 net_margin=0.06 (6%)
        误判为 6e-4 导致估算错误.

        逻辑:
            - 比例类 metric (food_cost_ratio, labor_cost_ratio, rent_ratio, discount_rate):
              年度影响 = (actual - median) / 100 * monthly_revenue * 12
            - 翻台率类 metric: 不直接估算金额 (需要更多业务参数)
        """
        # 只对成本/费用类比例 metric 估算
        ratio_metrics = {
            "food_cost_ratio",
            "labor_cost_ratio",
            "rent_ratio",
            "discount_rate",
            "waste_loss_rate",
            "stored_value_dependency",
        }
        if metric_key not in ratio_metrics:
            return None

        if not higher_is_worse:
            return None  # 不估算"少赚"

        # 检测单位错误: 比率类 metric 的百分比值一般在 0.5-80 区间, <1 几乎确定是 0-1 比率形式
        if 0 <= actual <= 1 and 0 <= median <= 1:
            logger.warning(
                f"_estimate_yearly_impact: metric {metric_key} actual={actual}, "
                f"median={median} look like 0-1 ratio, but contract expects percentage (>1). "
                f"Caller must multiply by 100. Treating as percentage anyway to avoid silent corruption."
            )

        # 百分比形式 (合约要求)
        delta_ratio = (actual - median) / 100

        return delta_ratio * monthly_revenue * 12

    @staticmethod
    def _render_message(
        store_name: str,
        name_zh: str,
        actual: float,
        median: float,
        high: float,
        low: float,
        unit: str,
        severity: Severity,
        higher_is_worse: bool,
        yearly_impact: Optional[float],
    ) -> str:
        """生成完整中文消息文案"""
        # 格式化数值
        def fmt(v: float) -> str:
            if 0 <= v <= 1 and unit == "%":
                return f"{v * 100:.2f}{unit}"
            if unit == "%":
                return f"{v:.2f}{unit}"
            return f"{v:.2f}{unit}"

        actual_str = fmt(actual)
        median_str = fmt(median)
        range_str = f"{fmt(low)}-{fmt(high)}"

        # 偏差方向
        if higher_is_worse:
            if actual > high:
                diff_zh = f"超出行业上限 {fmt(actual - high)}"
            elif actual > median:
                diff_zh = f"高于中位数 {fmt(actual - median)}"
            else:
                diff_zh = f"低于中位数 {fmt(median - actual)}"
        else:
            if actual < low:
                diff_zh = f"低于行业下限 {fmt(low - actual)}"
            elif actual < median:
                diff_zh = f"低于中位数 {fmt(median - actual)}"
            else:
                diff_zh = f"高于中位数 {fmt(actual - median)}"

        # 严重度前缀
        sev_prefix = {
            "red": "🔴 严重超标",
            "yellow": "🟡 警戒",
            "info": "🟢 注意",
        }.get(severity, "")

        msg = (
            f"{sev_prefix} | {store_name} 的{name_zh} {actual_str} "
            f"(行业基准 {range_str}, 中位 {median_str}), {diff_zh}"
        )

        if yearly_impact and abs(yearly_impact) > 1000:
            msg += f", 估算一年多支出约 ¥{abs(yearly_impact):,.0f}"

        return msg

    # ── 内部: 加载 benchmark ────────────────────────────

    def _load_benchmarks(self) -> None:
        """加载 benchmarks/_common.yaml + sub_sector.yaml, 合并"""
        common_path = self.kb_root / "benchmarks" / "_common.yaml"
        sub_path = self.kb_root / "benchmarks" / f"{self.sub_sector}.yaml"

        common = {}
        sub = {}

        if common_path.exists():
            try:
                with open(common_path, encoding="utf-8") as f:
                    common = yaml.safe_load(f) or {}
            except Exception as e:
                logger.error(f"加载 _common.yaml 失败: {e}")

        if sub_path.exists():
            try:
                with open(sub_path, encoding="utf-8") as f:
                    sub = yaml.safe_load(f) or {}
            except Exception as e:
                logger.error(f"加载 {self.sub_sector}.yaml 失败: {e}")
        else:
            logger.warning(f"sub_sector benchmark 不存在: {sub_path}")

        # 合并: sub_sector 覆盖 common
        merged_metrics = {}
        for key, val in (common.get("metrics") or {}).items():
            merged_metrics[key] = dict(val) if isinstance(val, dict) else val
        for key, val in (sub.get("metrics") or {}).items():
            if key in merged_metrics and isinstance(merged_metrics[key], dict):
                merged_metrics[key].update(val if isinstance(val, dict) else {})
            else:
                merged_metrics[key] = dict(val) if isinstance(val, dict) else val

        self._benchmarks = {
            "sub_sector": self.sub_sector,
            "metrics": merged_metrics,
        }
        logger.debug(
            f"[{self.domain}] {self.sub_sector} 加载 {len(merged_metrics)} 个 benchmark metric"
        )
