from __future__ import annotations

"""Channel margin section — computes margin by order channel (堂食/外卖/团购)."""

import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class ChannelMarginHandler(AbstractSectionHandler):
    """Channel-level margin breakdown (堂食 / 外卖 / 团购 等).

    Requires POS DataFrame with order_method and revenue columns. Shared
    across a batch via ``context["pos_df"]``, or passed directly in
    ``request.params["pos_df"]``.

    This handler delegates to the private
    ``RestaurantAnalyzerV2._compute_channel_margin`` helper rather than
    re-implementing the wiring for BomResolver + DynamicConfigResolver +
    ChannelMarginCalculator. The analyzer instance is cached per
    ``(factory_id, sub_sector)`` to avoid re-initializing heavyweight
    dependencies on every call.

    Supported params (all optional, with sensible Chinese-POS defaults):
      - ``pos_df``: pandas DataFrame
      - ``order_method_col`` (default "订单来源")
      - ``revenue_col`` (default "实收额")
    """
    section_name = "channel_margin"

    def __init__(self) -> None:
        # Lazy cache: (factory_id, sub_sector) -> RestaurantAnalyzerV2
        # Keeps BomResolver + ChannelMarginCalculator hot across calls.
        self._analyzer_cache: dict[tuple[str, str], Any] = {}

    def compute(self, request: SectionRequest, context: dict[str, Any]) -> SectionResponse:
        started = time.time()
        # NOTE: use explicit `is None` checks — pandas DataFrames raise
        # ValueError on `or` / truthiness.
        pos_df = context.get("pos_df")
        if pos_df is None:
            pos_df = request.params.get("pos_df")
        if pos_df is None:
            return self.skipped(request, "未提供 POS DataFrame", started)

        order_method_col = request.params.get("order_method_col", "订单来源")
        revenue_col = request.params.get("revenue_col", "实收额")
        venue_list = request.params.get("venue_list")  # Optional[list[str]], QW2

        if not hasattr(pos_df, "columns"):
            return self.skipped(request, "pos_df 不是 DataFrame (缺 columns 属性)", started)
        if order_method_col not in pos_df.columns:
            return self.skipped(request, f"POS 缺列 {order_method_col!r}", started)
        if revenue_col not in pos_df.columns:
            return self.skipped(request, f"POS 缺列 {revenue_col!r}", started)

        # Lazy-import the analyzer to avoid eagerly pulling in the full
        # smartbi.services.* dependency graph at module load time.
        try:
            from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2
        except Exception as e:
            return self.skipped(request, f"无法加载 RestaurantAnalyzerV2: {e}", started)

        cache_key = (request.factory_id, request.sub_sector)
        analyzer = self._analyzer_cache.get(cache_key)
        if analyzer is None:
            try:
                analyzer = RestaurantAnalyzerV2(
                    factory_id=request.factory_id,
                    sub_sector=request.sub_sector,
                )
                self._analyzer_cache[cache_key] = analyzer
            except Exception as e:
                return self.skipped(request, f"无法构建 RestaurantAnalyzerV2: {e}", started)

        try:
            section_data = analyzer._compute_channel_margin(
                pos_df=pos_df,
                order_method_col=order_method_col,
                revenue_col=revenue_col,
                store_id=request.store_id,
                period=request.period,
                venue_list=venue_list,
            )
        except Exception as e:
            return self.skipped(request, f"channel margin 计算失败: {e}", started)

        if not isinstance(section_data, dict):
            return self.skipped(
                request,
                f"_compute_channel_margin 返回非 dict 类型: {type(section_data).__name__}",
                started,
            )

        return self.ok(request, data=section_data, started=started)
