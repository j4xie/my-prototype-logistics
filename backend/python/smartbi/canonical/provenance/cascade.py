"""Inheritance cascade engine for field_provenance — Day 13-15.

Per spec 04-C v1.4 §4.1 / §4.2 / §4.3 / §4.4. Implements 3 of the 5
inheritance types from §4.1:

- 维度继承 (dimensional cascade): :func:`compute_dish_margin` reads
  ``cost_per_unit`` from ``field_provenance`` and joins against
  ``agg_product_period`` sales to compute a per-period margin. The result
  ``confidence`` is ``min(cost_confidence, sales_confidence)`` per
  spec S-14 — we don't assume sales are 100% reliable.

- 空缺降级 (gap fallback): :func:`_get_industry_default_cost` synthesises a
  ``ProvenanceValue`` from ``dim_product.category × cost_rate ×
  avg_unit_price`` when no recipe exists. Returns ``None`` (NOT 0) when
  the product was never sold per spec C-9 — UI shows "未销售过, 无法估算"
  rather than misleading 0.

- 时间继承 (time inheritance): :func:`infer_product_summary_period` borrows
  the period window from neighbouring ``bill_flow`` uploads (within
  ±N days, configurable via ``factory_provenance_config.time_inheritance_
  window_days``) when a product_summary upload lacks explicit dates.

粒度继承 (granularity cascade) and 属性继承 (attribute cascade) are deferred
to Day 16+: both can be implemented as aggregate-on-read views without new
schema changes.
"""
from __future__ import annotations

import json
import logging
from datetime import date
from typing import TYPE_CHECKING, Any, Dict, Optional, Tuple

from smartbi.canonical.provenance.industry_defaults import get_industry_default
from smartbi.canonical.provenance.types import ProvenanceValue
from smartbi.canonical.provenance.writer import read_authoritative_value

if TYPE_CHECKING:
    import asyncpg  # pragma: no cover — type-only import

logger = logging.getLogger(__name__)


def _coerce_field_value_to_float(raw: Any) -> Optional[float]:
    """JSONB-stored field_value → ``float`` defensively.

    asyncpg's JSONB codec may surface ``field_value`` as either a Python
    primitive (when a global jsonb codec is registered) or a JSON-encoded
    string (default). The provenance writer json-dumps the value before
    insert, so a numeric stored value comes back as either ``"12.5"`` or
    ``12.5`` depending on codec. Decode defensively. Returns ``None`` if
    the value cannot be coerced — caller decides how to handle.
    """
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    if isinstance(raw, str):
        try:
            decoded = json.loads(raw)
        except (TypeError, ValueError, json.JSONDecodeError):
            try:
                return float(raw)
            except (TypeError, ValueError):
                return None
        if isinstance(decoded, (int, float)):
            return float(decoded)
    return None


async def _get_industry_default_cost(
    conn: "asyncpg.Connection",
    factory_id: str,
    product_id: int,
) -> Optional[ProvenanceValue]:
    """配方表无该菜 → 推断品类 → 取行业默认成本率 + avg_price 推算 cost_per_unit.

    Per spec §4.3 v1.4 (lines 850-885) + v1.2 C-9 fix:
    - 该 product 从未销售 (avg_price IS NULL or 0) → return None.
      DO NOT return 0 — the UI shows "未销售过, 无法估算" instead of a
      misleading zero.

    Returns a synthetic ``ProvenanceValue`` (NOT persisted to DB; sentinel
    ``source_upload_id=0``, ``source_type="industry_default"``,
    ``mapper_method="rule"``, ``confidence=0.5``).
    """
    # 1. dim_product.category lookup. RLS filters by current tenant
    # automatically, but we still pass the factory_id-bound product_id so
    # an unscoped query (forgetting to set ``app.factory_id``) returns
    # nothing rather than leaking another tenant's category.
    cat_row = await conn.fetchrow(
        "SELECT category FROM dim_product WHERE product_id = $1",
        product_id,
    )
    category = (
        cat_row["category"]
        if cat_row and cat_row["category"]
        else "_default"
    )

    # 2. 行业默认成本率 (factory override 优先于 global hardcode).
    cost_ratio = await get_industry_default(
        conn, factory_id, "cost_rate", category
    )
    if cost_ratio is None:
        # Should not happen for cost_rate — get_industry_default always
        # returns a value (falls back to _default). Defensive guard.
        return None

    # 3. avg unit price across all historical sales of this product.
    avg_price_raw = await conn.fetchval(
        """
        SELECT AVG(avg_unit_price)
          FROM agg_product_period
         WHERE factory_id = $1 AND product_id = $2
        """,
        factory_id, product_id,
    )

    # v1.2 C-9: no sales history → cannot estimate cost.
    if avg_price_raw is None:
        return None
    avg_price = float(avg_price_raw)
    if avg_price <= 0:
        return None

    return ProvenanceValue(
        field_value=avg_price * float(cost_ratio),
        confidence=0.5,  # industry default 中等置信度
        source_upload_id=0,  # sentinel: non-upload synthetic source
        source_type="industry_default",
        mapper_method="rule",
        valid_from=None,
        valid_to=None,
        notes=(
            f"industry_default cost_rate={cost_ratio} category={category}"
        ),
    )


async def compute_dish_margin(
    conn: "asyncpg.Connection",
    factory_id: str,
    product_id: int,
    date_range: Tuple[date, date],
) -> Dict[str, Any]:
    """计算菜品毛利, 自动 cascade 配方成本 → 行业默认 → unavailable.

    Per spec §4.2 v1.4 (lines 686-750). Inheritance chain:
      1. ``read_authoritative_value(entity='product', field='cost_per_unit')``
         — returns the recipe-derived value if any (manual / inferred /
         industry_default already-persisted, etc).
      2. ``_get_industry_default_cost`` — synthetic value from category ×
         cost_rate × avg_unit_price.
      3. ``status="unavailable"`` — neither a recipe nor any sales history.

    Confidence is ``min(cost_conf, sales_conf)`` per spec S-14.
    Sales confidence is a coarse heuristic: ``min(0.95, 0.5 + 0.1 *
    upload_count)`` — caps at 0.95 even with many uploads (we never claim
    sales = 100% reliable from POS exports alone).

    Note on multi-store: ``agg_product_period`` Silver layer keeps per-store
    rows (the compound ``revenue@store_<id>`` naming applies to provenance
    only, not to this Silver fact table). This function ``SUM``s across
    all stores for the date range, since margin computation typically
    reports a factory-wide number. A per-store variant can extend the
    ``store_id`` filter later if needed.

    Args:
        conn: An asyncpg connection. Caller MUST already have set
              ``app.factory_id`` for tenant isolation.
        factory_id: Tenant identifier (matches ``app.factory_id``).
        product_id: Target product (``dim_product.product_id``).
        date_range: ``(start_date, end_date)`` inclusive.

    Returns:
        Dict with one of two shapes:
          - ``{"status": "unavailable", "reason": ..., "confidence": 0.0,
                "product_id": ...}``
          - ``{"status": "ok", "product_id", "revenue", "cost", "margin",
                "margin_rate", "confidence", "cost_source",
                "cost_confidence", "sales_confidence"}``
    """
    start_date, end_date = date_range

    # 1. cost lookup (recipe via field_provenance — manual, inferred, or
    # already-persisted industry_default from a prior sweep).
    cost_prov = await read_authoritative_value(
        conn,
        factory_id=factory_id,
        entity_type="product",
        entity_id=product_id,
        field_name="cost_per_unit",
        as_of=end_date,
    )
    if cost_prov is None:
        cost_prov = await _get_industry_default_cost(
            conn, factory_id, product_id
        )

    if cost_prov is None:
        # v1.2 C-9: real "no recipe AND no sales" → unavailable.
        return {
            "product_id": product_id,
            "status": "unavailable",
            "reason": "无配方且从未销售, 无法估算成本",
            "confidence": 0.0,
        }

    cost_per_unit = _coerce_field_value_to_float(cost_prov.field_value)
    if cost_per_unit is None:
        # field_value cannot be coerced (corrupt JSONB?) — surface as
        # unavailable rather than silently treating as 0.
        return {
            "product_id": product_id,
            "status": "unavailable",
            "reason": (
                "cost_per_unit 字段值无法解析为数字 "
                f"(raw={cost_prov.field_value!r})"
            ),
            "confidence": 0.0,
        }

    # 2. sales aggregate from agg_product_period.
    sales_row = await conn.fetchrow(
        """
        SELECT COALESCE(SUM(revenue), 0)        AS total_rev,
               COALESCE(SUM(qty_sold), 0)       AS total_qty,
               COUNT(DISTINCT upload_id)        AS upload_count
          FROM agg_product_period
         WHERE factory_id = $1
           AND product_id = $2
           AND period_start >= $3
           AND period_end <= $4
        """,
        factory_id, product_id, start_date, end_date,
    )

    revenue = float(sales_row["total_rev"] or 0)
    qty = float(sales_row["total_qty"] or 0)
    upload_count = int(sales_row["upload_count"] or 0)

    cost = cost_per_unit * qty
    margin = revenue - cost
    margin_rate = (margin / revenue) if revenue else 0.0

    # Spec S-14: sales_conf = min(0.95, 0.5 + 0.1 * upload_count).
    # Caps at 0.95 even with many uploads (we never claim 100%).
    sales_confidence = min(0.95, 0.5 + 0.1 * upload_count)
    result_confidence = min(float(cost_prov.confidence), sales_confidence)

    return {
        "product_id": product_id,
        "status": "ok",
        "revenue": revenue,
        "cost": cost,
        "margin": margin,
        "margin_rate": margin_rate,
        "confidence": result_confidence,
        "cost_source": cost_prov.source_type,
        "cost_confidence": float(cost_prov.confidence),
        "sales_confidence": sales_confidence,
    }


async def infer_product_summary_period(
    conn: "asyncpg.Connection",
    factory_id: str,
    product_summary_upload_id: int,
) -> Optional[Tuple[date, date]]:
    """商品汇总没日期, 但同 factory 同时段有账单流水 → 借用账单时间窗.

    Per spec §4.4 v1.4 (lines 893-932). Steps:
      1. 取 product_summary upload 的 ``created_at`` (上传时间).
      2. 找同 factory 同 ±N 天上传的 ``bill_flow`` upload (N from
         ``factory_provenance_config.time_inheritance_window_days``,
         default 7 — spec S-15).
      3. 取它们的 ``merge_inferred_period_start/end`` (Sheet Merger 已设).
      4. 求并集 ``(min(start), max(end))`` 作为推断时间窗.

    Returns ``None`` if:
      - The upload row doesn't exist (invalid upload_id).
      - No neighbouring bill_flow upload has a merge_inferred_period.

    Note on ``detected_table_type`` column: we use the same string
    constant ``'bill_flow'`` that ``sheet_merger.py`` writes — verified
    against ``smartbi.database.models.PgExcelUpload.detected_table_type``
    (VARCHAR(50)).
    """
    # 1. upload date.
    upload_date = await conn.fetchval(
        "SELECT created_at::date FROM smart_bi_pg_excel_uploads WHERE id = $1",
        product_summary_upload_id,
    )
    if upload_date is None:
        return None

    # 2. config window. Reuse conflict_resolver's cached config so we don't
    # hit factory_provenance_config twice in a hot path.
    from smartbi.canonical.provenance.conflict_resolver import _get_factory_config
    factory_config = await _get_factory_config(conn, factory_id)
    window_days = int(
        factory_config.get("time_inheritance_window_days", 7)
    )

    # 3. neighbouring bill_flow uploads. Window_days is inlined into the
    # SQL because PG INTERVAL '$N days' isn't legal syntax — we cast to
    # int above to defang any injection (factory_config is server-controlled
    # data anyway, but defense in depth).
    bill_uploads = await conn.fetch(
        f"""
        SELECT merge_inferred_period_start AS p_start,
               merge_inferred_period_end   AS p_end
          FROM smart_bi_pg_excel_uploads
         WHERE factory_id = $1
           AND detected_table_type = 'bill_flow'
           AND created_at::date BETWEEN
                 ($2::date - INTERVAL '{window_days} days')
             AND ($2::date + INTERVAL '{window_days} days')
           AND merge_inferred_period_start IS NOT NULL
        """,
        factory_id, upload_date,
    )

    if not bill_uploads:
        return None

    # 4. union (min start, max end). Filter rows where either endpoint is
    # NULL even if the WHERE p_start IS NOT NULL passed (p_end may still
    # be NULL). asyncpg returns date objects for DATE columns.
    starts = [b["p_start"] for b in bill_uploads if b["p_start"] is not None]
    ends = [b["p_end"] for b in bill_uploads if b["p_end"] is not None]
    if not starts or not ends:
        return None

    return (min(starts), max(ends))
