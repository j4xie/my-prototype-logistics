"""餐饮 SmartBI V2 主入口 — 编排层

设计原则:
  - 不替代 legacy services/restaurant_analyzer.py (1751 行), 而是作为**新业务编排层**
  - 专注 Week 2-3 的"邓总救命组合": cost_rigidity + 渠道毛利率 + 对标预警 + 命名归一
  - 调用 Week 1-2 的所有底层组件 (menu_normalizer + bom_resolver + diagnostics_engine + benchmark_alert_engine + channel_margin_calculator)
  - 输出 unified report dict, 含 section 标签便于前端渲染

数据流:
                ┌──────────┐
   pos_df ──────►│  V2 主入口 │
                │ analyzer.py│
   financial ──►│           │
                │  - 数据完整性 (Week 3 加)
                │  - 命名归一 (menu_normalizer.apply)
                │  - 渠道毛利率 (channel_margin_calculator)
                │  - 诊断 (diagnostics_engine)
                │  - 对标预警 (benchmark_alert_engine)
                │  - 同店同比 (Week 3 加)
                └──┬────────┘
                   │
                   ▼
              unified report dict

使用示例 (邓总场景):
    >>> v2 = RestaurantAnalyzerV2(
    ...     factory_id="DENG_HUOGUO",
    ...     sub_sector="火锅",
    ... )
    >>> report = v2.analyze(
    ...     pos_df=feb_orders_df,
    ...     financial_data={
    ...         "current": {"revenue": 731047, "food_cost": 335212, "labor_cost": 237660, ...},
    ...         "previous": {"revenue": 1390503, "food_cost": 578603, "labor_cost": 323805, ...},
    ...         "monthly_revenue": 731047,
    ...     },
    ...     store_id="DENG-001",
    ...     period="2026-02",
    ... )
    >>> print(report["sections"]["financialMetrics"]["cost_rigidity"])
    0.561
    >>> print(len(report["sections"]["diagnostics"]))
    3  # cost_rigidity warning + food_cost warning + labor_cost warning
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Optional

from sqlalchemy.orm import Session

from shared.benchmark_alert_engine import BenchmarkAlertEngine
from shared.diagnostics_engine import DiagnosticsEngine
from shared.dynamic_config_resolver import DynamicConfigResolver
from shared.temporal_comparator import TemporalComparator

from .bom_resolver import RestaurantBomResolver
from .channel_margin_calculator import ChannelMarginCalculator
from .dining_period_heatmap import DiningPeriodHeatmap
from .long_tail_sku_detector import LongTailSkuDetector
from .member_rfm import MemberRfmAnalyzer
from .menu_normalizer import RestaurantMenuNormalizer
from .monthly_calibration_report import MonthlyCalibrationReporter
from .monthly_purchase_calibrator import MonthlyPurchaseCalibrator
from .review_analyzer import ReviewAnalyzer
from .review_analyzer_llm import LlmReviewAnalyzer
from .sku_form_manager import SkuFormManager
from .multi_store_comparator import MultiStoreComparator
from .store_pnl_one_pager import StorePnlOnePager
from .stored_value_analyzer import StoredValueAnalyzer

logger = logging.getLogger(__name__)


# ── Result types ────────────────────────────────────────────


@dataclass
class FinancialMetrics:
    """从 financial_data 提取的标准化 metrics

    所有 ratio 字段都是 0-1 比率 (非百分比), 便于跟 benchmark 对比.
    """
    revenue: float
    food_cost: Optional[float] = None
    labor_cost: Optional[float] = None
    rent: Optional[float] = None
    other_cost: Optional[float] = None
    net_profit: Optional[float] = None

    food_cost_ratio: Optional[float] = None
    labor_cost_ratio: Optional[float] = None
    rent_ratio: Optional[float] = None
    restaurant_net_margin: Optional[float] = None

    cost_rigidity: Optional[float] = None
    revenue_change_pct: Optional[float] = None
    labor_cost_change_pct: Optional[float] = None
    food_cost_change_pct: Optional[float] = None

    def to_dict(self) -> dict:
        return {
            "revenue": self.revenue,
            "foodCost": self.food_cost,
            "laborCost": self.labor_cost,
            "rent": self.rent,
            "otherCost": self.other_cost,
            "netProfit": self.net_profit,
            "foodCostRatio": self.food_cost_ratio,
            "laborCostRatio": self.labor_cost_ratio,
            "rentRatio": self.rent_ratio,
            "restaurantNetMargin": self.restaurant_net_margin,
            "costRigidity": self.cost_rigidity,
            "revenueChangePct": self.revenue_change_pct,
            "laborCostChangePct": self.labor_cost_change_pct,
            "foodCostChangePct": self.food_cost_change_pct,
        }


# ── Main V2 analyzer ────────────────────────────────────────


class RestaurantAnalyzerV2:
    """餐饮 SmartBI V2 主分析器 (编排层)

    每次 web-admin 上传新数据时, 实例化一次, 调用 analyze() 一次.
    """

    def __init__(
        self,
        factory_id: str,
        sub_sector: str,
        db_session: Optional[Session] = None,
        sku_form_manager: Optional[SkuFormManager] = None,
        monthly_calibrator: Optional[MonthlyPurchaseCalibrator] = None,
    ):
        if not factory_id:
            raise ValueError("factory_id 不能为空")
        if not sub_sector:
            raise ValueError("sub_sector 必须指定 (例 '火锅' / '鱼类餐饮')")

        self.factory_id = factory_id
        self.sub_sector = sub_sector
        self.db_session = db_session

        # Week 4.4 BOM Layer 2 + 3 (可选)
        self.sku_form_manager = sku_form_manager
        self.monthly_calibrator = monthly_calibrator

        # 初始化所有底层组件
        self.config_resolver = DynamicConfigResolver(
            factory_id=factory_id, domain="restaurant", db_session=db_session
        )
        self.menu_normalizer = RestaurantMenuNormalizer(
            factory_id=factory_id, db_session=db_session
        )
        self.bom_resolver = RestaurantBomResolver(
            factory_id=factory_id,
            sub_sector=sub_sector,
            config_resolver=self.config_resolver,
            sku_form_manager=sku_form_manager,
            monthly_calibrator=monthly_calibrator,
        )
        self.diagnostics_engine = DiagnosticsEngine(
            domain="restaurant", sub_sector=sub_sector
        )
        self.benchmark_alert_engine = BenchmarkAlertEngine(
            domain="restaurant", sub_sector=sub_sector
        )
        self.channel_margin_calc = ChannelMarginCalculator(
            factory_id=factory_id,
            sub_sector=sub_sector,
            bom_resolver=self.bom_resolver,
            config_resolver=self.config_resolver,
        )

        # Week 4 新增 analyzers (stateless, 每次分析实例化即可)
        self.store_pnl_one_pager = StorePnlOnePager()
        self.dining_heatmap = DiningPeriodHeatmap()
        self.stored_value_analyzer = StoredValueAnalyzer()
        self.long_tail_detector = LongTailSkuDetector()
        self.review_analyzer = ReviewAnalyzer()
        # W5.5: LLM-based review analyzer (falls back to regex on failure)
        self.llm_review_analyzer = LlmReviewAnalyzer(fallback_analyzer=self.review_analyzer)
        self.member_rfm_analyzer = MemberRfmAnalyzer()

        # W6.4: 多店对比分析器 (stateless)
        self.multi_store_comparator = MultiStoreComparator()

        # W5.7: Layer A 月度校准历史报告 (lazy: 需要 db_session)
        self.calibration_reporter: Optional[MonthlyCalibrationReporter] = None
        if db_session is not None:
            self.calibration_reporter = MonthlyCalibrationReporter(
                db_session=db_session
            )

        # W5.6 同店同比 (Week 3 写的 module, W5 集成进来)
        self.temporal_comparator = TemporalComparator(group_col="门店名称")

    # ── 主入口 ─────────────────────────────────────────

    def analyze(
        self,
        pos_df=None,
        financial_data: Optional[dict] = None,
        store_id: Optional[str] = None,
        store_name: Optional[str] = None,
        period: str = "current",
        product_col: str = "商品名称",
        order_method_col: str = "订单来源",
        revenue_col: str = "实收额",
        datetime_col: str = "开单时间",
        quantity_col: str = "数量",
        reviews: Optional[list[dict]] = None,
        members: Optional[list[dict]] = None,  # W5.4 会员 RFM
        use_llm_reviews: bool = True,          # W5.5+: LLM default (auto-fallback to regex)
    ) -> dict:
        """V2 主分析入口

        Args:
            pos_df: POS 销售 DataFrame (可选)
            financial_data: 财务数据 dict, 结构 {
                "current": {revenue, food_cost, labor_cost, rent, ...},
                "previous": {同上},  # 可选, 用于 cost_rigidity 同环比
                "monthly_revenue": float,  # 用于 benchmark 影响估算
            }
            store_id: 门店 ID
            store_name: 门店中文名
            period: 期间标签
            product_col / order_method_col / revenue_col: POS 列名 (默认中文)

        Returns:
            完整报告 dict, 含 sections + summary + warnings
        """
        report: dict = {
            "factoryId": self.factory_id,
            "subSector": self.sub_sector,
            "storeId": store_id,
            "storeName": store_name,
            "period": period,
            "sections": {},
            "warnings": [],
            "executiveSummary": [],
        }

        # ─── Section 1: 命名归一 (POS only) ───
        if pos_df is not None and product_col in pos_df.columns:
            menu_section = self._normalize_menu(pos_df, product_col)
            report["sections"]["menuNormalization"] = menu_section

        # ─── Section 2: 渠道毛利率 (POS only) ───
        if pos_df is not None and order_method_col in pos_df.columns and revenue_col in pos_df.columns:
            channel_section = self._compute_channel_margin(
                pos_df, order_method_col, revenue_col, store_id, period
            )
            report["sections"]["channelMargin"] = channel_section

            # 渠道分析的 advice 进 executive summary
            for advice in channel_section.get("adviceZh", []):
                report["executiveSummary"].append(advice)
        else:
            if pos_df is not None:
                report["warnings"].append(
                    f"POS 数据缺少列 {order_method_col!r} 或 {revenue_col!r}, 跳过渠道毛利率分析"
                )

        # ─── Section 3: 财务诊断 + 对标预警 (financial only) ───
        if financial_data:
            metrics = self._extract_financial_metrics(financial_data)
            report["sections"]["financialMetrics"] = metrics.to_dict()

            # 跑诊断
            diagnoses = self._run_diagnostics(metrics)
            report["sections"]["diagnostics"] = [d.to_dict() for d in diagnoses]

            # 跑对标预警
            monthly_revenue = financial_data.get("monthly_revenue") or metrics.revenue
            alerts = self._run_benchmark_alerts(
                metrics, store_name or store_id or "店铺", monthly_revenue
            )
            report["sections"]["benchmarkAlerts"] = [a.to_dict() for a in alerts]

            # 把 critical/red 诊断 + 对标进 executive summary
            for d in diagnoses:
                if d.severity == "critical":
                    report["executiveSummary"].insert(
                        0, f"🔴 [{d.metric_name_zh}] {d.description_zh[:80] if d.description_zh else d.status}"
                    )
            for a in alerts[:3]:
                if a.severity in ("red", "yellow"):
                    report["executiveSummary"].append(a.message_zh)
        else:
            report["warnings"].append(
                "未提供财务数据 (financial_data), 跳过 cost_rigidity / 食材率 / 人力率 等财务诊断"
            )

        # ─── Week 4.1: 单店 P&L 一页纸 (需 financial + optional channel/pos) ───
        if financial_data:
            try:
                pnl_report = self.store_pnl_one_pager.build(
                    financial_metrics=report["sections"].get("financialMetrics", {}),
                    diagnostics=report["sections"].get("diagnostics", []),
                    benchmark_alerts=report["sections"].get("benchmarkAlerts", []),
                    channel_margin=report["sections"].get("channelMargin"),
                    temporal_comparison=None,
                    store_name=store_name or "本店",
                    period=period,
                    sub_sector=self.sub_sector,
                )
                report["sections"]["storePnlOnePager"] = pnl_report.to_dict()
                # 把 headline 放 executive summary 顶部
                if pnl_report.headline:
                    report["executiveSummary"].insert(0, f"📋 {pnl_report.headline}")
            except Exception as e:
                logger.warning(f"store_pnl_one_pager 失败: {e}")
                report["warnings"].append(f"单店 P&L 一页纸生成失败: {e}")

        # ─── Week 4.2: 营业时段热力图 (需 POS 含时间列) ───
        if pos_df is not None and datetime_col in pos_df.columns and revenue_col in pos_df.columns:
            try:
                heatmap_report = self.dining_heatmap.build(
                    df=pos_df,
                    datetime_col=datetime_col,
                    revenue_col=revenue_col,
                )
                report["sections"]["diningHeatmap"] = heatmap_report.to_dict()
            except Exception as e:
                logger.warning(f"dining_heatmap 失败: {e}")
                report["warnings"].append(f"营业时段热力图生成失败: {e}")

        # ─── Week 4.3a: 充卡依赖度 (需 financial 含 stored_value) ───
        if financial_data:
            current = financial_data.get("current") or financial_data
            giveaway = self._safe_float(current.get("stored_value_giveaway"))
            if giveaway is not None and giveaway > 0:
                try:
                    sv_report = self.stored_value_analyzer.analyze(
                        stored_value_giveaway=giveaway,
                        revenue=float(current.get("revenue", 0)),
                        stored_value_charge=self._safe_float(current.get("stored_value_charge")),
                        previous_balance=self._safe_float(current.get("previous_stored_value_balance")),
                    )
                    report["sections"]["storedValueDependency"] = sv_report.to_dict()
                    if sv_report.severity in ("warning", "critical"):
                        report["executiveSummary"].append(sv_report.message_zh)
                except Exception as e:
                    logger.warning(f"stored_value_analyzer 失败: {e}")

        # ─── Week 4.3b: 长尾 SKU 识别 (需 POS 含商品 + quantity + revenue) ───
        if pos_df is not None and product_col in pos_df.columns and revenue_col in pos_df.columns:
            try:
                menu_items = self._build_menu_items_for_long_tail(
                    pos_df, product_col, quantity_col, revenue_col
                )
                if menu_items:
                    lt_report = self.long_tail_detector.detect(
                        menu_items=menu_items, exclude_seasonal=True
                    )
                    report["sections"]["longTailSku"] = lt_report.to_dict()
                    if lt_report.recommended_delist_count > 0:
                        report["executiveSummary"].append(
                            f"🔻 长尾 SKU: 建议下架 {lt_report.recommended_delist_count} 个, "
                            f"预计年省 ¥{lt_report.estimated_cost_saving:,.0f}"
                        )
            except Exception as e:
                logger.warning(f"long_tail_detector 失败: {e}")

        # ─── W6: Auto-load reviews from DB if not provided in request ───
        if not reviews and self.db_session:
            try:
                from smartbi.database.models import RestaurantReview
                db_reviews = (
                    self.db_session.query(RestaurantReview)
                    .filter(RestaurantReview.factory_id == self.factory_id)
                    .order_by(RestaurantReview.review_time.desc())
                    .limit(500)
                    .all()
                )
                if db_reviews:
                    reviews = [
                        {
                            "id": r.review_id or r.id,
                            "rating": float(r.rating),
                            "content": r.content,
                            "created_at": r.review_time.isoformat() if r.review_time else "",
                            "store_name": r.store_name,
                            "platform": r.platform,
                        }
                        for r in db_reviews
                    ]
                    logger.info(f"Auto-loaded {len(reviews)} reviews from DB for factory {self.factory_id}")
            except Exception as e:
                logger.warning(f"Failed to auto-load reviews from DB: {e}")

        # ─── Week 4.5 / W5.5: 大众点评评论分析 (需 reviews 输入) ───
        if reviews:
            review_report = None
            used_llm = False
            if use_llm_reviews:
                try:
                    review_report = self.llm_review_analyzer.analyze(
                        reviews, min_mentions=2, max_reviews=200
                    )
                    used_llm = True
                except Exception as e:
                    logger.warning(f"LLM review_analyzer failed, fallback to regex: {e}")
                    review_report = None
                    used_llm = False
            if review_report is None:
                try:
                    review_report = self.review_analyzer.analyze(
                        reviews=reviews, min_mentions=2
                    )
                except Exception as e:
                    logger.warning(f"review_analyzer failed: {e}")
                    report["warnings"].append(f"评论分析失败: {e}")
                    review_report = None
            if review_report is not None:
                section = review_report.to_dict()
                section["usedLlm"] = used_llm
                report["sections"]["reviewAnalysis"] = section
                for alert in review_report.risk_alerts[:2]:
                    report["executiveSummary"].append(alert)

        # ─── W5.4: 会员 RFM 分析 (需 members 或 POS 含 member_id) ───
        if members:
            try:
                rfm_report = self.member_rfm_analyzer.analyze(
                    members=members, as_of_date=period
                )
                report["sections"]["memberRfm"] = rfm_report.to_dict()
                champions = rfm_report.segment_counts.get("Champions", 0)
                if champions > 0 and rfm_report.analyzed_members > 0:
                    champ_rev = rfm_report.segment_revenue.get("Champions", 0)
                    total_rev = sum(rfm_report.segment_revenue.values()) or 1
                    report["executiveSummary"].append(
                        f"🌟 Champions {champions} 人贡献 {champ_rev / total_rev * 100:.0f}% 营收"
                    )
            except Exception as e:
                logger.warning(f"member_rfm 失败: {e}")
                report["warnings"].append(f"会员 RFM 失败: {e}")

        # ─── W5.6: 同店同比 (需 POS 含时间 + 门店名称 + 实收额) ───
        if pos_df is not None and datetime_col in pos_df.columns and revenue_col in pos_df.columns:
            try:
                # Check if 门店名称 column exists
                if "门店名称" in pos_df.columns:
                    temporal_report = self.temporal_comparator.compare(
                        df=pos_df,
                        date_col=datetime_col,
                        metric_cols=[revenue_col],
                    )
                    report["sections"]["temporalComparison"] = temporal_report.to_dict()
                    if temporal_report.mode != "insufficient":
                        report["executiveSummary"].append(
                            f"📊 {temporal_report.message_zh}"
                        )
            except Exception as e:
                logger.warning(f"temporal_comparator 失败: {e}")
                report["warnings"].append(f"同店同比生成失败: {e}")

        # ─── W6.4: 多店对比 (需 POS 含 门店名称 且 ≥2 店) ───
        store_col = "门店名称"
        if pos_df is not None and store_col in pos_df.columns:
            unique_stores = pos_df[store_col].dropna().nunique()
            if unique_stores >= 2:
                try:
                    multi_report = self.multi_store_comparator.compare(
                        pos_df=pos_df,
                        revenue_col=revenue_col,
                        product_col=product_col,
                        store_col=store_col,
                        quantity_col=quantity_col,
                        reviews=reviews,
                    )
                    report["sections"]["multiStoreComparison"] = multi_report.to_dict()
                    # Top insight into executive summary
                    if multi_report.insights:
                        report["executiveSummary"].append(
                            f"🏪 {multi_report.insights[0]}"
                        )
                    # Anomalies into executive summary
                    for anomaly in multi_report.anomalies[:2]:
                        if anomaly.severity == "critical":
                            report["executiveSummary"].append(
                                f"🔴 {anomaly.message_zh}"
                            )
                except Exception as e:
                    logger.warning(f"multi_store_comparator 失败: {e}")
                    report["warnings"].append(f"多店对比分析失败: {e}")

        # ─── W5.7: Layer A 月度校准历史 (需 db_session + ≥1 月数据) ───
        if self.calibration_reporter is not None:
            try:
                history_report = self.calibration_reporter.generate(
                    factory_id=self.factory_id,
                    store_id=store_id,
                    months_back=6,
                )
                # 没数据时不添加 section, 用户感受不到 (graceful skip)
                if history_report.total_periods > 0:
                    report["sections"]["calibrationHistory"] = (
                        history_report.to_dict()
                    )
                    # 严重异常进 executive summary
                    critical_anomalies = [
                        a
                        for a in history_report.anomalies
                        if a.severity == "critical"
                    ]
                    if critical_anomalies:
                        report["executiveSummary"].append(
                            f"📅 BOM 校准历史: {len(critical_anomalies)} 个严重月份异常, "
                            "建议复盘"
                        )
                    elif history_report.total_periods >= 6 and not history_report.anomalies:
                        report["executiveSummary"].append(
                            f"✅ BOM 校准历史: {history_report.total_periods} 月走势稳定"
                        )
            except Exception as e:
                logger.warning(f"calibration_reporter 失败: {e}")
                report["warnings"].append(f"月度校准历史报告失败: {e}")

        # ─── Week 4.4: BOM Layer status (报告当前精度状态) ───
        report["sections"]["bomLayerStatus"] = self._build_bom_layer_status()

        # ─── 总结统计 ───
        report["summary"] = {
            "sectionsGenerated": list(report["sections"].keys()),
            "totalDiagnoses": len(report["sections"].get("diagnostics", [])),
            "totalAlerts": len(report["sections"].get("benchmarkAlerts", [])),
            "criticalIssues": sum(
                1 for d in report["sections"].get("diagnostics", [])
                if d.get("severity") == "critical"
            ),
            "redAlerts": sum(
                1 for a in report["sections"].get("benchmarkAlerts", [])
                if a.get("severity") == "red"
            ),
        }

        return report

    # ── Section 1: 命名归一 ───────────────────────────

    def _normalize_menu(self, pos_df, product_col: str) -> dict:
        """对 POS DataFrame 应用 menu_normalizer

        Returns:
            { 原始 unique SKU 数, 归一后 unique 数, 减少 % }
        """
        original_count = pos_df[product_col].nunique()

        # 应用已确认的别名 (从 restaurant_dish_alias 表读)
        pos_df = self.menu_normalizer.apply(pos_df, name_column=product_col)
        normalized_count = pos_df[product_col].nunique()

        reduction = original_count - normalized_count
        reduction_pct = reduction / original_count * 100 if original_count > 0 else 0

        return {
            "originalUniqueCount": int(original_count),
            "normalizedUniqueCount": int(normalized_count),
            "reduction": int(reduction),
            "reductionPct": round(reduction_pct, 2),
            "appliedAliasTable": "restaurant_dish_alias",
            "note": (
                f"已根据 dish_alias 表归并 {reduction} 个变体. "
                f"如需更多归一, 请到审核 UI 处理 propose_merges 提议."
            ),
        }

    # ── Section 2: 渠道毛利率 ─────────────────────────

    def _compute_channel_margin(
        self,
        pos_df,
        order_method_col: str,
        revenue_col: str,
        store_id: Optional[str],
        period: str,
    ) -> dict:
        """渠道毛利率 (改进 6 真名版)"""
        report = self.channel_margin_calc.calculate(
            df=pos_df,
            order_method_col=order_method_col,
            revenue_col=revenue_col,
            store_id=store_id,
            period=period,
        )
        return report.to_dict()

    # ── Section 3: 财务诊断 ───────────────────────────

    def _extract_financial_metrics(
        self, financial_data: dict
    ) -> FinancialMetrics:
        """从 financial_data 提取 + 计算所有 metrics

        Args:
            financial_data: {
                "current": {revenue, food_cost, labor_cost, rent, net_profit, ...},
                "previous": {同上},  # 可选
                ...
            }
        """
        current = financial_data.get("current") or financial_data
        previous = financial_data.get("previous")

        revenue = float(current.get("revenue", 0))
        food_cost = self._safe_float(current.get("food_cost"))
        labor_cost = self._safe_float(current.get("labor_cost"))
        rent = self._safe_float(current.get("rent"))
        other_cost = self._safe_float(current.get("other_cost"))
        net_profit = self._safe_float(current.get("net_profit"))

        # 比率
        food_cost_ratio = food_cost / revenue * 100 if food_cost and revenue > 0 else None
        labor_cost_ratio = labor_cost / revenue * 100 if labor_cost and revenue > 0 else None
        rent_ratio = rent / revenue * 100 if rent and revenue > 0 else None
        net_margin = net_profit / revenue * 100 if net_profit is not None and revenue > 0 else None

        metrics = FinancialMetrics(
            revenue=revenue,
            food_cost=food_cost,
            labor_cost=labor_cost,
            rent=rent,
            other_cost=other_cost,
            net_profit=net_profit,
            food_cost_ratio=food_cost_ratio,
            labor_cost_ratio=labor_cost_ratio,
            rent_ratio=rent_ratio,
            restaurant_net_margin=net_margin,
        )

        # cost_rigidity (需要 previous)
        if previous:
            prev_revenue = self._safe_float(previous.get("revenue"))
            prev_labor = self._safe_float(previous.get("labor_cost"))
            prev_food = self._safe_float(previous.get("food_cost"))

            if prev_revenue and prev_revenue > 0 and revenue > 0:
                rev_change = (revenue - prev_revenue) / prev_revenue
                metrics.revenue_change_pct = rev_change

                if prev_labor and prev_labor > 0 and labor_cost is not None:
                    labor_change = (labor_cost - prev_labor) / prev_labor
                    metrics.labor_cost_change_pct = labor_change

                    # cost_rigidity = labor_change / revenue_change
                    # 健康 = 0.85+ (人工跟随营收变化)
                    # 关键: 只在营收下滑时计算 (营收上升时弹性概念不适用)
                    if rev_change < -0.05:  # 营收下滑 5%+ 才计算
                        if rev_change != 0:
                            metrics.cost_rigidity = labor_change / rev_change
                        else:
                            metrics.cost_rigidity = None

                if prev_food and prev_food > 0 and food_cost is not None:
                    metrics.food_cost_change_pct = (food_cost - prev_food) / prev_food

        return metrics

    def _run_diagnostics(self, metrics: FinancialMetrics) -> list:
        """跑 DiagnosticsEngine"""
        # 转 metrics 为 dict
        metric_dict: dict[str, float] = {}

        if metrics.food_cost_ratio is not None:
            metric_dict["food_cost_ratio"] = metrics.food_cost_ratio
        if metrics.labor_cost_ratio is not None:
            metric_dict["labor_cost_ratio"] = metrics.labor_cost_ratio
        if metrics.rent_ratio is not None:
            metric_dict["rent_ratio"] = metrics.rent_ratio
        if metrics.restaurant_net_margin is not None:
            metric_dict["restaurant_net_margin"] = metrics.restaurant_net_margin
        if metrics.cost_rigidity is not None:
            metric_dict["cost_rigidity"] = metrics.cost_rigidity

        return self.diagnostics_engine.run(metric_dict)

    def _run_benchmark_alerts(
        self,
        metrics: FinancialMetrics,
        store_name: str,
        monthly_revenue: float,
    ) -> list:
        """跑 BenchmarkAlertEngine"""
        metric_dict: dict[str, float] = {}

        if metrics.food_cost_ratio is not None:
            metric_dict["food_cost_ratio"] = metrics.food_cost_ratio
        if metrics.labor_cost_ratio is not None:
            metric_dict["labor_cost_ratio"] = metrics.labor_cost_ratio
        if metrics.rent_ratio is not None:
            metric_dict["rent_ratio"] = metrics.rent_ratio
        if metrics.restaurant_net_margin is not None:
            metric_dict["restaurant_net_margin"] = metrics.restaurant_net_margin

        return self.benchmark_alert_engine.alert_for_store(
            store_name=store_name,
            metrics=metric_dict,
            monthly_revenue=monthly_revenue,
        )

    @staticmethod
    def _safe_float(v: Any) -> Optional[float]:
        """安全转换为 float, None/空字符串/异常都返回 None"""
        if v is None or v == "":
            return None
        try:
            return float(v)
        except (ValueError, TypeError):
            return None

    # ── Week 4 新增: helper 方法 ────────────────────────

    def _build_menu_items_for_long_tail(
        self,
        pos_df,
        product_col: str,
        quantity_col: str,
        revenue_col: str,
    ) -> list[dict]:
        """Week 4.3b: 把 POS DF 聚合为 menu_items list 供 LongTailSkuDetector"""
        import pandas as pd

        if quantity_col not in pos_df.columns:
            # 没有 quantity 列, 用 count 代替
            grouped = pos_df.groupby(product_col).agg(
                quantity=(revenue_col, "count"),
                revenue=(revenue_col, "sum"),
            ).reset_index()
        else:
            grouped = pos_df.groupby(product_col).agg(
                quantity=(quantity_col, "sum"),
                revenue=(revenue_col, "sum"),
            ).reset_index()

        items: list[dict] = []
        for _, row in grouped.iterrows():
            name = str(row[product_col])
            qty = float(row.get("quantity", 0) or 0)
            rev = float(row.get("revenue", 0) or 0)
            if qty <= 0 or rev <= 0:
                continue
            unit_price = rev / qty if qty > 0 else 0
            items.append({
                "name": name,
                "quantity": qty,
                "revenue": rev,
                "unitProfit": unit_price * 0.5,  # 粗估 50% 毛利 (长尾检测不需精确)
            })
        return items

    def _build_bom_layer_status(self) -> dict:
        """Week 4.4: 报告当前 BOM 精度层级状态 (用于前端展示)"""
        layer2_sku_count = 0
        layer3_period_count = 0

        if self.sku_form_manager:
            layer2_sku_count = self.sku_form_manager.count(self.factory_id)
        if self.monthly_calibrator:
            layer3_period_count = self.monthly_calibrator.count(self.factory_id)

        current_layer = "Layer 1"
        current_accuracy = 15.0
        if layer3_period_count > 0:
            current_layer = "Layer 3"
            current_accuracy = 5.0 if layer3_period_count >= 3 else 8.0
        elif layer2_sku_count > 0:
            current_layer = "Layer 2"
            current_accuracy = 8.0

        return {
            "currentLayer": current_layer,
            "currentAccuracyPp": current_accuracy,
            "layer2SkuCount": layer2_sku_count,
            "layer3PeriodCount": layer3_period_count,
            "upgradeHint": (
                "上传 TOP 20 SKU 主料清单 → Layer 2 (±8%)"
                if layer2_sku_count == 0
                else "上传 3 月采购汇总 → Layer 3 (±5%)"
                if layer3_period_count < 3
                else "已达最优 Layer 3 精度 (±5%)"
            ),
        }
