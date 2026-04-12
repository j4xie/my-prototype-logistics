from __future__ import annotations

"""Menu name normalization — applies dish alias rules to POS DataFrame.


Wraps :class:`RestaurantMenuNormalizer` via the
``RestaurantAnalyzerV2._normalize_menu`` helper. The helper queries the
``restaurant_dish_alias`` table (when a DB session is available) and applies
confirmed aliases, then reports the reduction stats. When no DB is available
the underlying ``apply()`` is a no-op and the metadata still gets returned.

Supported params:
  - ``pos_df``: pandas DataFrame
  - ``product_col`` (default "商品名称")
"""

import time
from typing import Any

from smartbi.services.restaurant.sections.base import (
    AbstractSectionHandler,
    SectionRequest,
    SectionResponse,
)


class MenuNormalizationHandler(AbstractSectionHandler):
    """Wraps :class:`RestaurantMenuNormalizer` via the legacy analyzer helper."""
    section_name = "menu_normalization"

    def __init__(self) -> None:
        # Cache analyzers per (factory_id, sub_sector). The normalizer needs a
        # factory_id at construction time and an optional db_session, both of
        # which the cached analyzer carries.
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

        if not hasattr(pos_df, "columns"):
            return self.skipped(request, "pos_df 不是 DataFrame (缺 columns 属性)", started)
        if product_col not in pos_df.columns:
            return self.skipped(request, f"POS 缺列 {product_col!r}", started)

        try:
            analyzer = self._get_analyzer(request.factory_id, request.sub_sector)
        except Exception as e:
            return self.skipped(request, f"无法构建 RestaurantAnalyzerV2: {e}", started)

        try:
            section_data = analyzer._normalize_menu(pos_df, product_col)
        except Exception as e:
            return self.skipped(request, f"menu 归一失败: {e}", started)

        if not isinstance(section_data, dict):
            return self.skipped(
                request,
                f"_normalize_menu 返回非 dict 类型: {type(section_data).__name__}",
                started,
            )

        return self.ok(request, data=section_data, started=started)

    def _get_analyzer(self, factory_id: str, sub_sector: str):
        """Lazy-build + cache RestaurantAnalyzerV2 per (factory_id, sub_sector)."""
        key = (factory_id, sub_sector)
        analyzer = self._analyzer_cache.get(key)
        if analyzer is None:
            from smartbi.services.restaurant.analyzer import RestaurantAnalyzerV2
            analyzer = RestaurantAnalyzerV2(
                factory_id=factory_id,
                sub_sector=sub_sector,
            )
            self._analyzer_cache[key] = analyzer
        return analyzer
