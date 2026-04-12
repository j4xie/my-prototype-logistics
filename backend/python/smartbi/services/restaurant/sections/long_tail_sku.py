from __future__ import annotations

"""Long tail SKU detection — identifies low-volume dishes as delist candidates.


Wraps ``LongTailSkuDetector.detect(menu_items, exclude_seasonal=True)``.
``menu_items`` is built from a POS DataFrame using the
``RestaurantAnalyzerV2._build_menu_items_for_long_tail`` helper, which is
the canonical aggregation logic the legacy analyzer uses. Reusing it keeps
the section's behavior bit-for-bit identical with the monolithic analyze().

Supported params (all optional, with sensible Chinese-POS defaults):
  - ``pos_df``: pandas DataFrame
  - ``product_col`` (default "商品名称")
  - ``quantity_col`` (default "数量")  - missing column is OK; helper falls back to count
  - ``revenue_col`` (default "实收额")
  - ``exclude_seasonal`` (bool, default True)
"""

import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class LongTailSkuHandler(AbstractSectionHandler):
    """Wraps :class:`LongTailSkuDetector` for the section pipeline."""
    section_name = "long_tail_sku"

    def __init__(self) -> None:
        from smartbi.services.restaurant.long_tail_sku_detector import LongTailSkuDetector
        self._detector = LongTailSkuDetector()
        # Cache analyzer instances per (factory_id, sub_sector) to avoid
        # reinitializing BomResolver/ChannelMarginCalculator on every call.
        # We only need the analyzer for its private _build_menu_items_for_long_tail
        # helper, but constructing one is non-trivial.
        self._analyzer_cache: dict[tuple[str, str], Any] = {}

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()

        # NOTE: explicit `is None` checks — pandas DataFrames raise ValueError
        # on `or` / truthiness.
        pos_df = context.get("pos_df")
        if pos_df is None:
            pos_df = request.params.get("pos_df")
        if pos_df is None:
            return self.skipped(request, "未提供 POS DataFrame", started)

        product_col = request.params.get("product_col", "商品名称")
        quantity_col = request.params.get("quantity_col", "数量")
        revenue_col = request.params.get("revenue_col", "实收额")
        exclude_seasonal = bool(request.params.get("exclude_seasonal", True))

        if not hasattr(pos_df, "columns"):
            return self.skipped(request, "pos_df 不是 DataFrame (缺 columns 属性)", started)
        if product_col not in pos_df.columns:
            return self.skipped(request, f"POS 缺列 {product_col!r}", started)
        if revenue_col not in pos_df.columns:
            return self.skipped(request, f"POS 缺列 {revenue_col!r}", started)

        # Build menu_items via the legacy analyzer helper to preserve behavior.
        try:
            analyzer = self._get_analyzer(request.factory_id, request.sub_sector)
            menu_items = analyzer._build_menu_items_for_long_tail(
                pos_df, product_col, quantity_col, revenue_col,
            )
        except Exception as e:
            return self.skipped(request, f"menu_items 构建失败: {e}", started)

        if not menu_items:
            return self.skipped(request, "POS 聚合后无有效 menu_items", started)

        try:
            report = self._detector.detect(
                menu_items=menu_items,
                exclude_seasonal=exclude_seasonal,
            )
        except Exception as e:
            return self.skipped(request, f"long_tail 检测失败: {e}", started)

        if hasattr(report, "to_dict"):
            data = report.to_dict()
        elif isinstance(report, dict):
            data = report
        else:
            return self.skipped(
                request,
                f"long_tail 返回非 dict 类型: {type(report).__name__}",
                started,
            )

        return self.ok(request, data=data, started=started)

    def _get_analyzer(self, factory_id: str, sub_sector: str):
        """Lazy-build + cache RestaurantAnalyzerV2 per (factory_id, sub_sector)."""
        key = (factory_id, sub_sector)
        analyzer = self._analyzer_cache.get(key)
        if analyzer is None:
            # Lazy-import to avoid pulling the full dependency graph at
            # module load time.
            from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2
            analyzer = RestaurantAnalyzerV2(
                factory_id=factory_id,
                sub_sector=sub_sector,
            )
            self._analyzer_cache[key] = analyzer
        return analyzer
