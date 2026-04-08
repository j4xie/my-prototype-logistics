"""餐饮 SmartBI 命名空间

本目录是 SmartBI 餐饮分析模块的所有 service 实现.

═══════════════════════════════════════════════════════════
隔离铁律 (与 shared/__init__.py + services/factory/__init__.py 一致)
═══════════════════════════════════════════════════════════

✅ 允许 import:
   - shared.*                  (公用底层)
   - services.food_industry_detector  (公用领域识别)
   - services.food_context_bridge     (公用上下文桥接)
   - 第三方库: pandas, numpy, sqlalchemy, ...

❌ 禁止 import:
   - services.factory.*         (跨 domain 污染)
   - 任何工厂专有的 entity / playbook / benchmark

═══════════════════════════════════════════════════════════
数据隔离
═══════════════════════════════════════════════════════════

所有 DB 操作必须满足:
  - business_config_overrides: WHERE domain = 'restaurant'
  - alias_review_queue: WHERE domain = 'restaurant'
  - 餐饮专有表: 表前缀 restaurant_* (例: restaurant_dish_alias)
  - 配置 key 前缀: 'restaurant.' (例: 'restaurant.cogs.美团外卖')

═══════════════════════════════════════════════════════════
模块清单 (Week 1 - Week 7 渐进交付)
═══════════════════════════════════════════════════════════

Week 1 (本批):
  ✅ menu_normalizer.py            — 改进 1 菜品命名归一 (规则层)

Week 2 (邓总救命组合):
  - analyzer.py                    — 主入口 (替代现 restaurant_analyzer.py)
  - channel_margin_calculator.py   — 改进 6 渠道毛利率 (4 层 COGS)
  - bom_resolver.py                — BOM 80% 三层学习主入口

Week 3 (BOM 三层学习):
  - loss_factor_regressor.py       — Layer A 损耗系数回归
  - category_price_calibrator.py   — Layer A 类目均价校准
  - substitution_tracker.py        — Layer A 替代记录 (ASR + 手动)
  - cost_anomaly_detector.py       — Layer B 异常告警
  - honest_boundary_report.py      — Layer C 诚实边界声明

Week 4 (青花椒成交组合):
  - same_store_comparator.py       — 同店同比 (自动降级)
  - store_pnl_one_pager.py         — 单店 P&L 一页纸
  - dining_period_heatmap.py       — 营业时段热力图
  - party_size_distributor.py      — 客单分布

Week 5+ (扩展):
  - review_analyzer.py             — 改进 7+8 大众点评分析
  - stored_value_analyzer.py       — 改进 10 充卡依赖度
  - long_tail_sku_detector.py      — 改进 9 长尾 SKU
  - member_rfm.py                  — 会员 RFM
  - monthly_calibration_report.py  — Layer A 月度报告
"""
from .menu_normalizer import RestaurantMenuNormalizer
from .sku_form_manager import SkuFormEntry, SkuFormIngredient, SkuFormManager
from .monthly_purchase_calibrator import (
    CalibrationResult,
    MonthlyPurchaseCalibrator,
    MonthlyPurchaseEntry,
)
from .review_analyzer import (
    DishMention,
    PeriodRating,
    RatingTrend,
    ReviewAnalyzer,
    ReviewAnalysisReport,
)
from .review_analyzer_llm import LlmReviewAnalyzer
from .monthly_calibration_report import (
    CalibrationAnomaly,
    CalibrationHistoryReport,
    CalibrationSnapshot,
    CategoryVolatility,
    MonthlyCalibrationReporter,
)
from .member_rfm import (
    MemberRfmAnalyzer,
    MemberScore,
    RfmReport,
)

__all__ = [
    "RestaurantMenuNormalizer",
    # Week 4.4 — BOM Layer 2 + Layer 3
    "SkuFormManager",
    "SkuFormEntry",
    "SkuFormIngredient",
    "MonthlyPurchaseCalibrator",
    "MonthlyPurchaseEntry",
    "CalibrationResult",
    # Week 4.5 — 评论分析 改进 7+8
    "ReviewAnalyzer",
    "ReviewAnalysisReport",
    "DishMention",
    "RatingTrend",
    "PeriodRating",
    # W5.5 — LLM 驱动评论分析
    "LlmReviewAnalyzer",
    # W5.4 — 会员 RFM
    "MemberRfmAnalyzer",
    "RfmReport",
    "MemberScore",
    # W5.7 — Layer A 月度校准历史报告
    "MonthlyCalibrationReporter",
    "CalibrationHistoryReport",
    "CalibrationSnapshot",
    "CategoryVolatility",
    "CalibrationAnomaly",
]
