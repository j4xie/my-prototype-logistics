"""Phase 2A /analysis/inventory per-type endpoint port.

Implements 3 modes (turnover / expiry / aging). Default mode (`getInventoryHealth`)
returns 501 envelope in PR-A; PR-B will replace with real DashboardResponse.

Java reference:
  - Controller: SmartBIAnalysisController.getInventoryAnalysis line 411-448
  - Service: InventoryHealthAnalysisServiceImpl line 50-1352 (1352 LOC)

Spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-inventory-design.md
PR-A0 dependency: _fetch_all helper in analysis_finance.py (committed d1c4f72d4).

Out of scope (PR-B/PR-C):
  - getInventoryHealth (default mode, DashboardResponse)
  - getHealthScore (T-INV-9 asymmetric null)
  - getLossTrendChart (T-INV-8 mock-zero literal mirror)
  - getHealthRadarChart, getLossAnalysis, getLossReasonChart (not controller-dispatched)
  - PR-C arithmetic depth tests
"""
from __future__ import annotations

import logging
from datetime import date, datetime, time
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, Depends, Query

from smartbi_compat.api.analysis_finance import (
    _decimal_to_number,
    _to_decimal,
    _utc_now_iso,
    _fetch_all,
)
from smartbi_compat.schema_compat import wrap_response
from smartbi_compat.auth import verify_jwt_and_factory, AuthContext
# Java HashMap iter-order helper for value-tied entries on Collectors.groupingBy
# outputs. See backend/python/smartbi_compat/_java_compat.py for full doc.
from smartbi_compat._java_compat import (
    _format_decimal_half_up,
    _sort_entries_java_iter_then_value_desc,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Section 1: Constants + scale (T-INV-1: 8 thresholds + 4 aging boundaries)
# Mirror Java InventoryHealthAnalysisServiceImpl L58-83.
# ⚠ T-INV-1 alert thresholds — 4 named helpers + 4 inline (see §3.6).
# ⚠ Cycle 4 MAJOR 4 — threshold UNIT scale notes:
#   Turnover thresholds (6/12) compare against rate in 次/年 (raw scale).
#   InventoryDays thresholds (30/60) compare against days (raw scale).
#   ExpiryRisk thresholds (10/15) compare against PERCENTAGE (already × 100).
#   LossRate thresholds (2/5) compare against PERCENTAGE (already × 100).
#   Slow-moving inline (10/20) compare against PERCENTAGE (already × 100).
#   Aging boundary (30/60/90) compare against days (raw scale).
# ============================================================

# Mirror Java InventoryHealthAnalysisServiceImpl L58-83

_SCALE = Decimal("0.0001")     # SCALE=4 (Java line 58)
_DISPLAY_SCALE = Decimal("0.01")       # DISPLAY_SCALE=2 (Java line 59)
_QUANTIZE_HALF_UP = ROUND_HALF_UP         # Java RoundingMode.HALF_UP (line 60)

# T-INV-1 alert thresholds — 4 named helpers + 4 inline (see §3.6)
#
# ⚠️ Cycle 4 MAJOR 4 fix — threshold UNIT scale notes:
#   Turnover thresholds (6/12) compare against rate in 次/年 (raw scale).
#   InventoryDays thresholds (30/60) compare against days (raw scale).
#   ExpiryRisk thresholds (10/15) compare against PERCENTAGE (already × 100).
#   LossRate thresholds (2/5) compare against PERCENTAGE (already × 100).
#   Slow-moving inline (10/20) compare against PERCENTAGE (already × 100).
#   Aging boundary (30/60/90) compare against days (raw scale).
#
# Easy to confuse a rate-scale threshold with a percentage-scale threshold —
# Java getHealthScore (§3.9) inline arithmetic is the trap site.
#
# Named helper thresholds:
_TURNOVER_RED = Decimal("6")      # Java line 64, regular dir (lower=worse)
_TURNOVER_YELLOW = Decimal("12")     # Java line 66
_INVENTORY_DAYS_RED = Decimal("60")     # Java L1308 inline new BigDecimal("60"), INVERSE
_INVENTORY_DAYS_YELLOW = Decimal("30")     # Java L1311 inline, INVERSE
_EXPIRY_RISK_RED = Decimal("15")     # Java line 68, INVERSE (strict `>`)
_EXPIRY_RISK_YELLOW = Decimal("10")     # Java line 70, INVERSE (strict `>`)
_LOSS_RATE_RED = Decimal("5")      # Java line 72, INVERSE (strict `>`)
_LOSS_RATE_YELLOW = Decimal("2")      # Java line 74, INVERSE (strict `>`)

# Aging segment boundaries (days) — Java line 77-79
_AGING_FRESH = 30   # 0-30 days bucket upper bound
_AGING_NORMAL = 60   # 31-60 days bucket upper bound
_AGING_WARNING = 90   # 61-90 days bucket upper bound; ageDays > 90 = "90天以上"

# Expiry warning — Java line 82-83
_DEFAULT_EXPIRY_WARNING_DAYS = 30
_HIGH_RISK_EXPIRY_DAYS = 7

# Slow-moving rate inline thresholds (Java L747-751, getAgingMetrics ternary)
# NOT a named helper, inline in _get_aging_metrics; constants exported for PR-C boundary tests
_SLOW_MOVING_RED_INLINE = Decimal("20")  # > 20% RED
_SLOW_MOVING_YELLOW_INLINE = Decimal("10")  # > 10% YELLOW

# Health score overall alert (Java L903-910, getHealthScore inline)
# 用于 PR-B health score 总体 alert
_HEALTH_SCORE_GREEN_MIN = Decimal("80")    # >= 80 GREEN
_HEALTH_SCORE_YELLOW_MIN = Decimal("60")    # >= 60 YELLOW

# Per-batch ranking inline thresholds (Java L398-404 + L799-805)
# `getExpiringBatchesRanking` per-row alert
_EXPIRING_RANKING_RED_DAYS = 7    # daysUntilExpiry <= 7 RED
_EXPIRING_RANKING_YELLOW_DAYS = 15   # daysUntilExpiry <= 15 YELLOW
# `getLongAgingBatchesRanking` per-row alert
_LONG_AGING_RANKING_RED_DAYS = 120   # ageDays > 120 RED
_LONG_AGING_RANKING_YELLOW_DAYS = 90    # ageDays > 90 YELLOW (uses AGING_WARNING constant)


# ============================================================
# Section 2: SQL helpers (T-INV-12 ORDER BY truth, Rule 5 + Rule 6)
# ============================================================

async def _query_material_batches_by_status(
    factory_id: str, status: str = "AVAILABLE"
) -> list[dict]:
    """Mirror Java MaterialBatchRepository.findByFactoryIdAndStatus (L146).

    JPA derived query, NO ORDER BY in Java → row order unstable. Python adds
    explicit ORDER BY id for byte-shape determinism (T-INV-12 lock).

    Soft-delete: WHERE deleted_at IS NULL (mirror @Where annotation if present).
    Status: parameter (Java callers all pass MaterialBatchStatus.AVAILABLE).

    Rule 5: SELECT * future-proof for schema additions.
    Rule 6: input boundary None-check.

    NOTE (PR-N-3 fix): Java entity field is ``receiptDate`` but the actual DB
    column is ``inbound_date`` (per ``@Column(name = "inbound_date")`` on
    MaterialBatch.java). Without the alias, ``batch.get("receipt_date")``
    returns None for every row, sending the entire inventory into the
    "90天以上" aging bucket (and emptying the long-aging ranking / suggestions).
    Mirrors the same fix shipped by PR-H (#86) for procurement.
    """
    if factory_id is None:
        raise ValueError("_query_material_batches_by_status: factory_id required")
    sql = """
        SELECT *, inbound_date AS receipt_date
        FROM material_batches
        WHERE factory_id = $1
          AND status = $2
          AND deleted_at IS NULL
        ORDER BY id
    """
    return await _fetch_all(sql, factory_id, status)


async def _query_material_consumptions_in_range(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java MaterialConsumptionRepository.findByTimeRange (L40-44).

    @Query JPQL `WHERE m.factoryId = :factoryId AND m.consumptionTime BETWEEN :startTime AND :endTime`
    — NO ORDER BY → Python adds `ORDER BY id` (T-INV-12 lock).

    ⚠️ T-INV-7 atTime(23, 59, 59) trap — Java callers convert LocalDate to LocalDateTime
    via `startDate.atStartOfDay()` (00:00:00) and `endDate.atTime(23, 59, 59)`
    (NOT 23:59:59.999999 — 1-second gap before midnight). Python equivalent:
        start_dt = datetime.combine(start_date, time.min)         # 00:00:00
        end_dt = datetime.combine(end_date, time(23, 59, 59))     # 23:59:59 (no microseconds)
    """
    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_material_consumptions_in_range: start_date/end_date required "
            f"(got start_date={start_date!r}, end_date={end_date!r})"
        )
    start_dt = datetime.combine(start_date, time.min)
    end_dt = datetime.combine(end_date, time(23, 59, 59))
    sql = """
        SELECT *
        FROM material_consumptions
        WHERE factory_id = $1
          AND consumption_time BETWEEN $2 AND $3
        ORDER BY id
    """
    return await _fetch_all(sql, factory_id, start_dt, end_dt)


async def _query_expiring_batches(
    factory_id: str, warning_date: date
) -> list[dict]:
    """Mirror Java MaterialBatchRepository.findExpiringBatches (L173-177).

    @Query JPQL `WHERE m.factoryId = :factoryId AND m.expireDate BETWEEN CURRENT_DATE AND :warningDate ORDER BY m.expireDate ASC`  # noqa: E501
    — **YES ORDER BY** (single col `expire_date ASC`). Python mirror exact, NO secondary id.

    ⚠️ Java side `CURRENT_DATE` = SQL function (server time at query exec). Python
    mirrors: pass `date.today()` from Python, OR use SQL `CURRENT_DATE`. **决策**:
    Python 用 SQL `CURRENT_DATE` mirror exactly (避免 Python `date.today()` 跟 server
    timezone 偏差导致 byte parity drift).

    ⚠️ Note: Java does NOT filter by status='AVAILABLE' here. So expiring query
    returns batches of ANY status. Python mirror.
    """
    if warning_date is None:
        raise ValueError("_query_expiring_batches: warning_date required")
    sql = """
        SELECT *
        FROM material_batches
        WHERE factory_id = $1
          AND expire_date BETWEEN CURRENT_DATE AND $2
          AND deleted_at IS NULL
        ORDER BY expire_date ASC
    """
    return await _fetch_all(sql, factory_id, warning_date)


async def _query_expired_batches(factory_id: str) -> list[dict]:
    """Mirror Java MaterialBatchRepository.findExpiredBatches (L182-185).

    @Query JPQL `WHERE m.factoryId = :factoryId AND m.status != 'EXPIRED' AND m.expireDate < CURRENT_DATE`
    — NO ORDER BY → Python adds `ORDER BY id`.

    ⚠️ Note Java filter `status != 'EXPIRED'` — counts already-expired-by-date batches
    that haven't been transitioned to EXPIRED status yet. Python mirror exactly.
    """
    sql = """
        SELECT *
        FROM material_batches
        WHERE factory_id = $1
          AND status != 'EXPIRED'
          AND expire_date < CURRENT_DATE
          AND deleted_at IS NULL
        ORDER BY id
    """
    return await _fetch_all(sql, factory_id)


async def _query_inventory_value_total(factory_id: str) -> Decimal:
    """Mirror Java MaterialBatchRepository.calculateInventoryValue (L195-197).

    @Query JPQL: SELECT SUM((m.receiptQuantity - m.usedQuantity - m.reservedQuantity) * m.unitPrice)
                 FROM MaterialBatch m WHERE m.factoryId = :factoryId AND m.status = 'AVAILABLE'

    ⚠️ Java returns null when no rows (BigDecimal — Java NullPointer-prone). Caller
    must null-coalesce to ZERO. Python mirror: NULL aggregate → coalesce to Decimal('0').

    ⚠️ T-INV-13 — formula matches getCurrentQuantity() @Transient.
    SQL nulls inside SUM expression: PostgreSQL treats NULL arithmetic as NULL → that
    row contributes nothing. Same as Java's null-safe @Transient (which returns ZERO
    if receiptQuantity null). **Caveat**: Java @Transient also coalesces usedQuantity
    and reservedQuantity to ZERO before subtract; SQL `(NULL - x - y) * unitPrice`
    propagates NULL. **Java DB query and Java @Transient method 在 receiptQuantity 非 null
    但 usedQuantity 或 reservedQuantity null 时 behavior 不同**:
      - @Transient: receiptQuantity - 0 - 0 = receiptQuantity (counts the row)
      - SQL: receiptQuantity - NULL - NULL = NULL (drops the row)

    本 spec **Python 端 mirror Java SQL behavior** (因 controller default mode
    KPI 卡用 `_query_inventory_value_total` SQL 路径而非 in-memory iteration).
    所有 in-memory iteration 路径 (calculateTotalInventoryValue 1058-1063)
    用 `_get_current_quantity()` 严格 mirror @Transient null-coalesce (T-INV-13).

    **PR-C 测试**: `TestInventoryGetCurrentQuantityFormula` 锁定 in-memory path;
    `_query_inventory_value_total` 不需要单独 test (mirror SQL 即可).
    """
    sql = """
        SELECT COALESCE(
            SUM((m.receipt_quantity - m.used_quantity - m.reserved_quantity) * m.unit_price),
            0
        ) AS inventory_value
        FROM material_batches m
        WHERE m.factory_id = $1
          AND m.status = 'AVAILABLE'
          AND m.deleted_at IS NULL
    """
    rows = await _fetch_all(sql, factory_id)
    if not rows or rows[0].get("inventory_value") is None:
        return Decimal("0")
    return _to_decimal(rows[0]["inventory_value"])


async def _query_batch_adjustments_in_range(
    batch_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java MaterialBatchAdjustmentRepository.findByMaterialBatchIdAnd
    AdjustmentTimeBetweenOrderByAdjustmentTimeDesc.

    Derived method name has `OrderByAdjustmentTimeDesc` → **YES ORDER BY**.
    Python mirror exactly: `ORDER BY adjustment_time DESC` (NO secondary id).

    ⚠️ T-INV-7 atTime(23, 59, 59) — same boundary trap as
    _query_material_consumptions_in_range.

    **Usage** (Cycle 4 NIT 10 fix — corrected from earlier "all unused" claim):
    - **PR-A**: NOT called. PR-A impl chat may omit this helper.
    - **PR-B**: REQUIRED — `_calculate_loss_rate_for_health_score` (§3.9) calls this
      helper to fetch per-batch adjustments for LOSS_RATE computation feeding
      `_get_health_score` dimension 3. (Java getHealthScore L866 calls public
      getLossAnalysis L498-503 which calls findByMaterialBatchIdAnd...
      Python mirrors via this private helper inside `_calculate_loss_rate_for_health_score`.)
    - **PR-C**: indirectly tested via TestInventoryHealthScoreAsymmetric +
      TestInventoryHealthScoreTierArithmetic (loss rate is one of 4 health
      score dimensions).
    """
    if start_date is None or end_date is None:
        raise ValueError("_query_batch_adjustments_in_range: dates required")
    start_dt = datetime.combine(start_date, time.min)
    end_dt = datetime.combine(end_date, time(23, 59, 59))
    sql = """
        SELECT *
        FROM material_batch_adjustments
        WHERE material_batch_id = $1
          AND adjustment_time BETWEEN $2 AND $3
        ORDER BY adjustment_time DESC
    """
    return await _fetch_all(sql, batch_id, start_dt, end_dt)


# ============================================================
# Section 3: Shared logic helpers (T-INV-13 @Transient null-safe)
# ============================================================

def _get_current_quantity(batch: dict) -> Decimal:
    """Mirror Java MaterialBatch.getCurrentQuantity() @Transient (MaterialBatch.java:167-175).

    Formula: receiptQuantity - usedQuantity - reservedQuantity
    Null-safe:
      - receiptQuantity null → return ZERO (Java line 169-171)
      - usedQuantity null → 0 default (Java line 172)
      - reservedQuantity null → 0 default (Java line 173)

    ⚠️ T-INV-13 — Java SQL `calculateInventoryValue` (L195-197) 跟此 @Transient method
    对 null component 的处理**不同** (SQL: NULL propagates → row drops; @Transient:
    null coalesce ZERO → row counts). Spec 决策: in-memory path (calculateTotalInventoryValue
    L1058-1063) 用本 helper mirror @Transient; SQL path (_query_inventory_value_total)
    mirror Java SQL behavior. 两路径 byte-parity 各自对齐 Java.
    """
    rq = batch.get("receipt_quantity")
    if rq is None:
        return Decimal("0")
    used = batch.get("used_quantity")
    reserved = batch.get("reserved_quantity")
    used_dec = _to_decimal(used) if used is not None else Decimal("0")
    reserved_dec = _to_decimal(reserved) if reserved is not None else Decimal("0")
    return _to_decimal(rq) - used_dec - reserved_dec


def _calculate_total_inventory_value(batches: list[dict]) -> Decimal:
    """Mirror Java InventoryHealthAnalysisServiceImpl.calculateTotalInventoryValue (L1058-1063).

    Java:
      batches.stream()
        .map(b -> b.getCurrentQuantity().multiply(
            b.getUnitPrice() != null ? b.getUnitPrice() : BigDecimal.ZERO))
        .reduce(BigDecimal.ZERO, BigDecimal::add)

    Python equivalent: sum(currentQuantity * unitPrice (default 0)) over batches.

    Rule 1: explicit is-None check on unit_price.
    """
    total = Decimal("0")
    for b in batches:
        cq = _get_current_quantity(b)
        up = b.get("unit_price")
        up_dec = _to_decimal(up) if up is not None else Decimal("0")
        total += cq * up_dec
    return total


def _format_currency(value: Optional[Decimal]) -> str:
    """Mirror Java formatCurrency (L1346-1351).

    Java:
      if (value == null) return "-";
      return String.format("%,.2f", value.setScale(DISPLAY_SCALE=2, HALF_UP).doubleValue());

    ⚠️ T8 styled — 千分位 + 2 位小数, NO trailing "%" or "元" (caller adds unit suffix).
    """
    if value is None:
        return "-"
    quantized = value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
    return f"{float(quantized):,.2f}"


def _convert_to_kpi_cards(metric_results: list[dict]) -> list[dict]:
    """Mirror Java convertToKPICards (L1241-1287).

    Mapping:
      AlertLevel name → status: RED→"red" / YELLOW→"yellow" / default→"green"
      ChangeDirection: UP→"up" / DOWN→"down" / default→"flat"

    KPICard JSON shape (Java @Builder field order):
      [key, title, rawValue, value, unit, changeRate, change, trend, status, description]
    """
    cards = []
    for metric in metric_results:
        alert = metric.get("alertLevel")
        if alert == "RED":
            status = "red"
        elif alert == "YELLOW":
            status = "yellow"
        else:
            status = "green"

        direction = metric.get("changeDirection")
        if direction == "UP":
            trend = "up"
        elif direction == "DOWN":
            trend = "down"
        else:
            trend = "flat"

        # Java line 1276-1278:
        # value = formattedValue if non-null else (value.toString() if non-null else "-")
        formatted = metric.get("formattedValue")
        raw_value = metric.get("value")
        if formatted is not None:
            display_value = formatted
        elif raw_value is not None:
            display_value = str(raw_value)
        else:
            display_value = "-"

        # Rule 9: KpiCard Lombok @Data + no @JsonInclude → emit all 13 fields
        # incl null. Jackson key order from F001 golden:
        # [key, title, value, rawValue, unit, change, changeRate, trend, status,
        #  compareText, description, targetValue, completionRate]
        cards.append({
            "key":            metric.get("metricCode"),
            "title":          metric.get("metricName"),
            "value":          display_value,
            "rawValue":       raw_value,
            "unit":           metric.get("unit"),
            "change":         metric.get("changeValue"),
            "changeRate":     metric.get("changePercent"),
            "trend":          trend,
            "status":         status,
            "compareText":    None,
            "description":    metric.get("description"),
            "targetValue":    None,
            "completionRate": None,
        })
    return cards


# ============================================================
# Section 4: Alert-level helpers (4 named, T-INV-1 thresholds)
# ============================================================

def _determine_turnover_alert_level(turnover_rate: Decimal) -> str:
    """Mirror Java determineTurnoverAlertLevel (L1294-1302).
    Regular direction (lower = worse): RED < 6, YELLOW < 12, GREEN."""
    if turnover_rate < _TURNOVER_RED:
        return "RED"
    if turnover_rate < _TURNOVER_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_inventory_days_alert_level(inventory_days: Decimal) -> str:
    """Mirror Java determineInventoryDaysAlertLevel (L1307-1315).
    INVERSE direction (higher = worse): RED > 60, YELLOW > 30, GREEN."""
    if inventory_days > _INVENTORY_DAYS_RED:
        return "RED"
    if inventory_days > _INVENTORY_DAYS_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_expiry_risk_alert_level(expiry_risk_rate: Decimal) -> str:
    """Mirror Java determineExpiryRiskAlertLevel (L1320-1328).
    INVERSE direction, **strict `>`**: RED > 15, YELLOW > 10, GREEN.

    PR-C boundary test:
      15.0 → YELLOW (NOT RED; strict `> 15` for RED)
      15.01 → RED
      10.0 → GREEN (NOT YELLOW; strict `> 10` for YELLOW)
      10.01 → YELLOW
    """
    if expiry_risk_rate > _EXPIRY_RISK_RED:
        return "RED"
    if expiry_risk_rate > _EXPIRY_RISK_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_loss_rate_alert_level(loss_rate: Decimal) -> str:
    """Mirror Java determineLossRateAlertLevel (L1333-1341).
    INVERSE direction, **strict `>`**: RED > 5, YELLOW > 2, GREEN.

    Used by PR-B health score path only (getLossAnalysis NOT controller-dispatched).
    """
    if loss_rate > _LOSS_RATE_RED:
        return "RED"
    if loss_rate > _LOSS_RATE_YELLOW:
        return "YELLOW"
    return "GREEN"


# ============================================================
# Section 5: Mode dispatcher + 9 sub-services (PR-A scope)
# ============================================================


# ============================================================
# Section 5a: Turnover mode (Task 9)
# Mirror Java InventoryHealthAnalysisServiceImpl L141-288 (3 sub-services).
# ============================================================


def _plus_months(d: date, n: int) -> date:
    """Mirror Java LocalDate.plusMonths(n). Calendar-month arithmetic with
    end-of-month clamping (Java Jan 31 + 1 month = Feb 28/29).

    Used by `_get_turnover_trend_chart` for MONTH iteration.
    """
    import calendar as _cal
    year = d.year
    month = d.month + n
    while month > 12:
        year += 1
        month -= 12
    while month < 1:
        year -= 1
        month += 12
    # Clamp day to last day of target month
    last_day = _cal.monthrange(year, month)[1]
    return date(year, month, min(d.day, last_day))


def _one_day():
    from datetime import timedelta
    return timedelta(days=1)


def _metric_result_of(code: str, name: str, value: Decimal, unit: str) -> dict:
    """Mirror Java MetricResult.of(code, name, value, unit) static factory.

    @Builder default emits null for unset fields EXCEPT alertLevel which
    defaults to GREEN per Java MetricResult.of behavior (golden verified).

    Key order mirrors Java Jackson serialization order (golden verified):
      [metricCode, metricName, value, formattedValue, unit, changePercent,
       changeDirection, changeValue, alertLevel, dimensionValue, description]
    """
    return {
        "metricCode":      code,
        "metricName":      name,
        "value":           _decimal_to_number(value),
        "formattedValue":  None,
        "unit":            unit,
        "changePercent":   None,
        "changeDirection": None,
        "changeValue":     None,
        "alertLevel":      "GREEN",
        "dimensionValue":  None,
        "description":     None,
    }


async def _get_turnover_analysis(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """4 metrics: TURNOVER_RATE / INVENTORY_DAYS / CONSUMPTION_AMOUNT / INVENTORY_VALUE.

    Mirror Java InventoryHealthAnalysisServiceImpl.getTurnoverAnalysis L141-203.
    Spec §3.7.1.
    """
    current_inventory_value = await _query_inventory_value_total(factory_id)
    # _query_inventory_value_total already coalesces null → Decimal('0')

    consumptions = await _query_material_consumptions_in_range(factory_id, start_date, end_date)
    total_consumption = Decimal("0")
    for c in consumptions:
        tc = c.get("total_cost")
        if tc is not None:
            total_consumption += _to_decimal(tc)

    days_between = (end_date - start_date).days + 1
    annualized = (total_consumption * Decimal("365") / Decimal(days_between)).quantize(
        _SCALE, rounding=_QUANTIZE_HALF_UP
    )

    if current_inventory_value > Decimal("0"):
        turnover_rate = (annualized / current_inventory_value).quantize(
            _SCALE, rounding=_QUANTIZE_HALF_UP
        )
    else:
        turnover_rate = Decimal("0")

    metrics: list[dict] = []

    # Metric 1: TURNOVER_RATE
    # Key order mirrors golden: [metricCode, metricName, value, formattedValue, unit,
    #   changePercent, changeDirection, changeValue, alertLevel, dimensionValue, description]
    turnover_display = turnover_rate.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
    metrics.append({
        "metricCode":      "TURNOVER_RATE",
        "metricName":      "库存周转率",
        "value":           _decimal_to_number(turnover_display),
        "formattedValue":  f"{_format_decimal_half_up(turnover_rate, 1)} 次/年",  # Java %.1f doubleValue
        "unit":            "次/年",
        "changePercent":   None,
        "changeDirection": None,
        "changeValue":     None,
        "alertLevel":      _determine_turnover_alert_level(turnover_rate),
        "dimensionValue":  None,
        "description":     None,
    })

    # Metric 2: INVENTORY_DAYS — Java fallback 999 when turnover_rate <= 0
    if turnover_rate > Decimal("0"):
        inventory_days = (Decimal("365") / turnover_rate).quantize(
            _SCALE, rounding=_QUANTIZE_HALF_UP
        )
    else:
        inventory_days = Decimal("999")
    inv_days_zero_scale = inventory_days.quantize(Decimal("1"), rounding=_QUANTIZE_HALF_UP)
    metrics.append({
        "metricCode":      "INVENTORY_DAYS",
        "metricName":      "库存天数",
        "value":           _decimal_to_number(inv_days_zero_scale),
        "formattedValue":  f"{_format_decimal_half_up(inventory_days, 0)} 天",
        "unit":            "天",
        "changePercent":   None,
        "changeDirection": None,
        "changeValue":     None,
        "alertLevel":      _determine_inventory_days_alert_level(inventory_days),
        "dimensionValue":  None,
        "description":     None,
    })

    # Metric 3: CONSUMPTION_AMOUNT (MetricResult.of factory — no formattedValue, alertLevel=GREEN)
    metrics.append(_metric_result_of("CONSUMPTION_AMOUNT", "期间消耗", total_consumption, "元"))

    # Metric 4: INVENTORY_VALUE
    metrics.append(_metric_result_of("INVENTORY_VALUE", "库存价值", current_inventory_value, "元"))

    return metrics


async def _get_turnover_trend_chart(
    factory_id: str, start_date: date, end_date: date, period: str = "MONTH"
) -> dict:
    """LINE chart with MONTH iteration. Mirror Java L207-251. Spec §3.7.2.

    ⚠️ Period parameter is **ignored** by Java impl. Python mirror: always do MONTH
    iteration (controller hardcodes "MONTH" anyway).

    trendChart key order (golden verified, Rule 8):
      [chartType, title, seriesField, data, options, xaxisField, yaxisField]
    Note: xaxisField / yaxisField — all lowercase (Java camelCase → Jackson → lowercase).
    """
    chart_data: list[dict] = []
    current = start_date.replace(day=1)

    while current <= end_date:
        # plusMonths(1).minusDays(1) — last day of current month
        month_end = _plus_months(current, 1) - _one_day()
        if month_end > end_date:
            month_end = end_date

        month_consumptions = await _query_material_consumptions_in_range(
            factory_id, current, month_end
        )
        month_consumption = Decimal("0")
        for c in month_consumptions:
            tc = c.get("total_cost")
            if tc is not None:
                month_consumption += _to_decimal(tc)

        chart_data.append({
            "month":       f"{current.year}-{current.month:02d}",
            "consumption": _decimal_to_number(
                month_consumption.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
        })
        current = _plus_months(current, 1)

    options = {
        "showDataLabels": False,
        "smooth":         True,
    }

    return {
        "chartType":   "LINE",
        "title":       "消耗趋势",
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
        "xaxisField":  "month",
        "yaxisField":  "consumption",
    }


async def _get_turnover_by_category(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Ranking sorted desc by total cost. Mirror Java L255-288. Spec §3.7.3.

    ⚠️ start_date/end_date parameters are **NOT used** by Java impl (line 258 only
    queries findByFactoryIdAndStatus, no time filter). Python mirror — accepts
    parameters for signature parity but ignores them.
    """
    batches = await _query_material_batches_by_status(factory_id, "AVAILABLE")

    category_values: dict[str, Decimal] = {}
    for b in batches:
        mtid = b.get("material_type_id")
        if mtid is not None:
            cq = _get_current_quantity(b)
            up = b.get("unit_price")
            up_dec = _to_decimal(up) if up is not None else Decimal("0")
            value = cq * up_dec
            category_values[mtid] = category_values.get(mtid, Decimal("0")) + value

    sorted_entries = sorted(category_values.items(), key=lambda kv: kv[1], reverse=True)

    rankings = []
    for rank, (mtid, value) in enumerate(sorted_entries, start=1):
        rankings.append({
            "rank":           rank,
            "name":           mtid,
            "value":          _decimal_to_number(
                value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "target":         None,
            "completionRate": None,
            "alertLevel":     "GREEN",
        })
    return rankings


async def _get_turnover_mode(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Turnover mode entry — composes 3 sub-services into 5-key envelope.

    F999 golden Jackson HashMap key order (verified): [endDate, ranking, metrics,
    trendChart, startDate]. Python dict literal mirrors exactly.
    """
    metrics = await _get_turnover_analysis(factory_id, start_date, end_date)
    ranking = await _get_turnover_by_category(factory_id, start_date, end_date)
    trend_chart = await _get_turnover_trend_chart(factory_id, start_date, end_date)
    return {
        "endDate":    end_date.isoformat(),
        "ranking":    ranking,
        "metrics":    metrics,
        "trendChart": trend_chart,
        "startDate":  start_date.isoformat(),
    }


# ============================================================
# Section 5b: Expiry mode (Task 10)
# Mirror Java InventoryHealthAnalysisServiceImpl L294-478 (3 sub-services).
# ============================================================


def _days(n: int):
    from datetime import timedelta
    return timedelta(days=n)


async def _get_expiry_risk_analysis(factory_id: str) -> list[dict]:
    """5 metrics: EXPIRY_RISK_RATE / EXPIRING_COUNT / HIGH_RISK_COUNT / EXPIRED_COUNT / EXPIRING_VALUE.

    Mirror Java InventoryHealthAnalysisServiceImpl.getExpiryRiskAnalysis L294-371.
    Spec §3.7.4. Uses `date.today()` (test monkeypatch target).
    """
    today = date.today()
    warning_date = today + _days(_DEFAULT_EXPIRY_WARNING_DAYS)
    high_risk_date = today + _days(_HIGH_RISK_EXPIRY_DAYS)

    all_batches = await _query_material_batches_by_status(factory_id, "AVAILABLE")
    expiring_batches = await _query_expiring_batches(factory_id, warning_date)
    high_risk_batches = [
        b for b in expiring_batches
        if b.get("expire_date") is not None and b["expire_date"] <= high_risk_date
    ]
    expired_batches = await _query_expired_batches(factory_id)

    total_value = _calculate_total_inventory_value(all_batches)
    expiring_value = _calculate_total_inventory_value(expiring_batches)

    if total_value > Decimal("0"):
        expiry_risk_rate = (expiring_value / total_value).quantize(
            _SCALE, rounding=_QUANTIZE_HALF_UP
        ) * Decimal("100")
    else:
        expiry_risk_rate = Decimal("0")

    metrics: list[dict] = []
    risk_display = expiry_risk_rate.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)

    # Metric 1: EXPIRY_RISK_RATE
    # Key order mirrors golden (Rule 8):
    #   [metricCode, metricName, value, formattedValue, unit, changePercent,
    #    changeDirection, changeValue, alertLevel, dimensionValue, description]
    metrics.append({
        "metricCode":      "EXPIRY_RISK_RATE",
        "metricName":      "临期风险率",
        "value":           _decimal_to_number(risk_display),
        "formattedValue":  f"{_format_decimal_half_up(expiry_risk_rate, 1)}%",
        "unit":            "%",
        "changePercent":   None,
        "changeDirection": None,
        "changeValue":     None,
        "alertLevel":      _determine_expiry_risk_alert_level(expiry_risk_rate),
        "dimensionValue":  None,
        "description":     "30天内临期库存占比",
    })

    # Metric 2: EXPIRING_COUNT (inline alert: empty→GREEN, else→YELLOW)
    expiring_count_alert = "GREEN" if not expiring_batches else "YELLOW"
    metrics.append({
        "metricCode":      "EXPIRING_COUNT",
        "metricName":      "临期批次数",
        "value":           len(expiring_batches),
        "formattedValue":  f"{len(expiring_batches)} 批",
        "unit":            "批",
        "changePercent":   None,
        "changeDirection": None,
        "changeValue":     None,
        "alertLevel":      expiring_count_alert,
        "dimensionValue":  None,
        "description":     None,
    })

    # Metric 3: HIGH_RISK_COUNT (inline alert: empty→GREEN, else→RED; description "7天内过期")
    high_risk_alert = "GREEN" if not high_risk_batches else "RED"
    metrics.append({
        "metricCode":      "HIGH_RISK_COUNT",
        "metricName":      "高风险批次",
        "value":           len(high_risk_batches),
        "formattedValue":  f"{len(high_risk_batches)} 批",
        "unit":            "批",
        "changePercent":   None,
        "changeDirection": None,
        "changeValue":     None,
        "alertLevel":      high_risk_alert,
        "dimensionValue":  None,
        "description":     "7天内过期",
    })

    # Metric 4: EXPIRED_COUNT (inline alert: empty→GREEN, else→RED)
    expired_alert = "GREEN" if not expired_batches else "RED"
    metrics.append({
        "metricCode":      "EXPIRED_COUNT",
        "metricName":      "已过期批次",
        "value":           len(expired_batches),
        "formattedValue":  f"{len(expired_batches)} 批",
        "unit":            "批",
        "changePercent":   None,
        "changeDirection": None,
        "changeValue":     None,
        "alertLevel":      expired_alert,
        "dimensionValue":  None,
        "description":     None,
    })

    # Metric 5: EXPIRING_VALUE (MetricResult.of factory — no formattedValue, alertLevel=GREEN)
    metrics.append(_metric_result_of("EXPIRING_VALUE", "临期库存价值", expiring_value, "元"))

    return metrics


async def _get_expiring_batches_ranking(
    factory_id: str, days_to_expiry: int = 30
) -> list[dict]:
    """FEFO sort by expire_date ASC, limit 20.

    Mirror Java InventoryHealthAnalysisServiceImpl.getExpiringBatchesRanking L375-417.
    Spec §3.7.5.

    Inline alert (T-INV-1 inline site #1, NOT extracted as helper):
      <= 7 days → RED, <= 15 days → YELLOW, else → GREEN
    """
    today = date.today()
    warning_date = today + _days(days_to_expiry)
    expiring_batches = await _query_expiring_batches(factory_id, warning_date)

    # Java line 385-389: filter non-null expireDate (defensive — SQL BETWEEN already
    # filters, but Java re-checks). Limit to 20. SQL already ORDER BY expire_date ASC.
    filtered = [b for b in expiring_batches if b.get("expire_date") is not None]
    sorted_batches = filtered[:20]

    rankings = []
    for rank, batch in enumerate(sorted_batches, start=1):
        days_until_expiry = (batch["expire_date"] - today).days
        cq = _get_current_quantity(batch)
        up = batch.get("unit_price")
        up_dec = _to_decimal(up) if up is not None else Decimal("0")
        value = cq * up_dec

        # Inline alert (T-INV-1 inline site #1): NOT extracted as named helper
        if days_until_expiry <= _EXPIRING_RANKING_RED_DAYS:
            alert_level = "RED"
        elif days_until_expiry <= _EXPIRING_RANKING_YELLOW_DAYS:
            alert_level = "YELLOW"
        else:
            alert_level = "GREEN"

        rankings.append({
            "rank":           rank,
            "name":           batch.get("batch_number"),
            "value":          _decimal_to_number(
                value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "target":         days_until_expiry,
            "completionRate": _decimal_to_number(
                cq.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "alertLevel":     alert_level,
        })

    return rankings


async def _get_expiry_risk_chart(factory_id: str) -> dict:
    """PIE chart, 5-bucket LinkedHashMap pre-populate.

    Mirror Java InventoryHealthAnalysisServiceImpl.getExpiryRiskChart L421-478.
    Spec §3.7.6.

    T-INV-5: 5 buckets pre-populated in exact Java LinkedHashMap insertion order.
    Bucket item shape: {status, value} (golden-verified — 2 keys, NOT bucketName/agingBucket).
    Options: {showPercentage, showLegend, colors} (golden-verified — 3 keys).

    Boundary (Java L444-453, strict `<`):
      < 7  → "紧急（<7天）"
      < 15 → "预警（7-15天）"   (7..14)
      < 30 → "关注（15-30天）"  (15..29)
      else → "正常（>30天）"    (30+ falls here)
      expireDate null → "无保质期"

    riskChart key order (golden-verified, Rule 8):
      [chartType, title, seriesField, data, options, xaxisField, yaxisField]
    Note: xaxisField / yaxisField are all-lowercase (Lombok-Jackson demangling).
    """
    today = date.today()
    all_batches = await _query_material_batches_by_status(factory_id, "AVAILABLE")

    # T-INV-5: Pre-populate dict in EXACT Java LinkedHashMap insertion order
    risk_distribution: dict = {
        "正常（>30天）":   Decimal("0"),
        "关注（15-30天）": Decimal("0"),
        "预警（7-15天）":  Decimal("0"),
        "紧急（<7天）":    Decimal("0"),
        "无保质期":        Decimal("0"),
    }

    for batch in all_batches:
        cq = _get_current_quantity(batch)
        up = batch.get("unit_price")
        up_dec = _to_decimal(up) if up is not None else Decimal("0")
        value = cq * up_dec

        expire_date = batch.get("expire_date")
        if expire_date is None:
            risk_distribution["无保质期"] += value
            continue

        days_until_expiry = (expire_date - today).days
        if days_until_expiry < 7:
            risk_distribution["紧急（<7天）"] += value
        elif days_until_expiry < 15:
            risk_distribution["预警（7-15天）"] += value
        elif days_until_expiry < 30:
            risk_distribution["关注（15-30天）"] += value
        else:
            risk_distribution["正常（>30天）"] += value

    # Java L456-463: chart_data iterates dict.entries (preserves LinkedHashMap order)
    chart_data = [
        {
            "status": status_label,
            "value":  _decimal_to_number(
                value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
        }
        for status_label, value in risk_distribution.items()
    ]

    options = {
        "showPercentage": True,
        "showLegend":     True,
        "colors":         ["#52c41a", "#faad14", "#ff7a45", "#ff4d4f", "#8c8c8c"],
    }

    # Key order mirrors golden: [chartType, title, seriesField, data, options, xaxisField, yaxisField]
    # Note: lowercase xaxisField/yaxisField (golden-verified Rule 8, Lombok-Jackson demangling)
    return {
        "chartType":   "PIE",
        "title":       "临期风险分布",
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
        "xaxisField":  "status",
        "yaxisField":  "value",
    }


async def _get_expiry_mode(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Expiry mode entry — composes 3 sub-services into 5-key envelope.

    F999 golden Jackson HashMap key order (verified):
      [riskAnalysis, endDate, riskChart, expiringBatches, startDate]
    Python dict literal mirrors exactly.
    """
    risk_analysis = await _get_expiry_risk_analysis(factory_id)
    expiring_batches = await _get_expiring_batches_ranking(factory_id, days_to_expiry=30)
    risk_chart = await _get_expiry_risk_chart(factory_id)
    return {
        "riskAnalysis":    risk_analysis,
        "endDate":         end_date.isoformat(),
        "riskChart":       risk_chart,
        "expiringBatches": expiring_batches,
        "startDate":       start_date.isoformat(),
    }


# ============================================================
# Section 5c: Aging mode (Task 11)
# Mirror Java InventoryHealthAnalysisServiceImpl L660-818 (3 sub-services).
# ============================================================


async def _get_aging_metrics(factory_id: str) -> list[dict]:
    """3 metrics: SLOW_MOVING_RATE / SLOW_MOVING_VALUE / AVG_AGING_DAYS (Optional).

    Mirror Java InventoryHealthAnalysisServiceImpl.getAgingMetrics L720-770.
    Spec §3.7.7.

    AVG_AGING_DAYS is conditionally emitted (only when batches with receipt_date exist).
    SLOW_MOVING_RATE has INLINE alert: >20 RED, >10 YELLOW, else GREEN (T-INV-1 inline site #3).
    Uses date.today() (test monkeypatch target).
    """
    today = date.today()
    all_batches = await _query_material_batches_by_status(factory_id, "AVAILABLE")
    metrics: list[dict] = []

    total_value = _calculate_total_inventory_value(all_batches)

    slow_moving_value = Decimal("0")
    for b in all_batches:
        rd = b.get("receipt_date")
        if rd is None:
            continue
        age_days = (today - rd).days
        if age_days > _AGING_WARNING:
            cq = _get_current_quantity(b)
            up = b.get("unit_price")
            up_dec = _to_decimal(up) if up is not None else Decimal("0")
            slow_moving_value += cq * up_dec

    if total_value > Decimal("0"):
        slow_moving_rate = (slow_moving_value / total_value).quantize(
            _SCALE, rounding=_QUANTIZE_HALF_UP
        ) * Decimal("100")
    else:
        slow_moving_rate = Decimal("0")

    # Inline alert (T-INV-1 inline site #3): NOT extracted as helper
    if slow_moving_rate > _SLOW_MOVING_RED_INLINE:
        slow_alert = "RED"
    elif slow_moving_rate > _SLOW_MOVING_YELLOW_INLINE:
        slow_alert = "YELLOW"
    else:
        slow_alert = "GREEN"

    rate_display = slow_moving_rate.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
    metrics.append({
        "metricCode":      "SLOW_MOVING_RATE",
        "metricName":      "呆滞库存率",
        "value":           _decimal_to_number(rate_display),
        "formattedValue":  f"{_format_decimal_half_up(slow_moving_rate, 1)}%",
        "unit":            "%",
        "changePercent":   None,
        "changeDirection": None,
        "changeValue":     None,
        "alertLevel":      slow_alert,
        "dimensionValue":  None,
        "description":     "90天以上库龄占比",
    })

    metrics.append(_metric_result_of("SLOW_MOVING_VALUE", "呆滞库存价值", slow_moving_value, "元"))

    # AVG_AGING_DAYS conditional (Java L764 isPresent check)
    age_days_list = [
        (today - b["receipt_date"]).days
        for b in all_batches
        if b.get("receipt_date") is not None
    ]
    if age_days_list:
        # Compute as Decimal mean, then setScale(0, HALF_UP) — mirror Java L766
        avg_days = (Decimal(sum(age_days_list)) / Decimal(len(age_days_list))).quantize(
            Decimal("1"), rounding=_QUANTIZE_HALF_UP
        )
        metrics.append(_metric_result_of("AVG_AGING_DAYS", "平均库龄", avg_days, "天"))

    return metrics


async def _get_inventory_aging_chart(factory_id: str) -> dict:
    """BAR chart, 4-bucket LinkedHashMap pre-populate.

    Mirror Java InventoryHealthAnalysisServiceImpl.getInventoryAgingChart L660-716.
    Spec §3.7.8.

    T-INV-5: Pre-populate 4 buckets in EXACT Java LinkedHashMap insertion order:
      ["0-30天", "31-60天", "61-90天", "90天以上"]

    Aging bucket boundaries (Java L684-692, inclusive <= upper):
      ageDays <= 30 → "0-30天"
      ageDays <= 60 → "31-60天"   (31..60)
      ageDays <= 90 → "61-90天"   (61..90)
      else          → "90天以上"  (91+)
      receipt_date null → "90天以上" (T-INV-3 special case, Java L678-680)

    Bucket item shape: {aging, value} — 2 keys (golden-verified, NOT agingRange/bucketName).
    Options: {showDataLabels, colors} — 2 keys (golden-verified).
    Key order mirrors golden (Rule 8):
      [chartType, title, seriesField, data, options, xaxisField, yaxisField]
    xaxisField/yaxisField LOWERCASE (golden-verified, Lombok-Jackson demangling).
    """
    today = date.today()
    all_batches = await _query_material_batches_by_status(factory_id, "AVAILABLE")

    # T-INV-5: pre-populate in EXACT Java LinkedHashMap insertion order
    aging_distribution: dict = {
        "0-30天":   Decimal("0"),
        "31-60天":  Decimal("0"),
        "61-90天":  Decimal("0"),
        "90天以上": Decimal("0"),
    }

    for batch in all_batches:
        cq = _get_current_quantity(batch)
        up = batch.get("unit_price")
        up_dec = _to_decimal(up) if up is not None else Decimal("0")
        value = cq * up_dec

        receipt_date = batch.get("receipt_date")
        if receipt_date is None:
            # T-INV-3: null receipt_date → "90天以上"
            aging_distribution["90天以上"] += value
            continue

        age_days = (today - receipt_date).days
        if age_days <= _AGING_FRESH:
            aging_distribution["0-30天"] += value
        elif age_days <= _AGING_NORMAL:
            aging_distribution["31-60天"] += value
        elif age_days <= _AGING_WARNING:
            aging_distribution["61-90天"] += value
        else:
            aging_distribution["90天以上"] += value

    chart_data = [
        {
            "aging": age_label,
            "value": _decimal_to_number(
                value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
        }
        for age_label, value in aging_distribution.items()
    ]

    options = {
        "showDataLabels": True,
        "colors":         ["#52c41a", "#1890ff", "#faad14", "#ff4d4f"],
    }

    return {
        "chartType":   "BAR",
        "title":       "库龄分布",
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
        "xaxisField":  "aging",
        "yaxisField":  "value",
    }


async def _get_long_aging_batches_ranking(
    factory_id: str, min_days: int = 60
) -> list[dict]:
    """Age desc sort, limit 20.

    Mirror Java InventoryHealthAnalysisServiceImpl.getLongAgingBatchesRanking L774-818.
    Spec §3.7.9.

    Filter: aging_days >= min_days (INCLUSIVE >=, T-INV-14 lock — ageDays==60 IS included).
    Sort: ageDays DESC (older batches first, Java L787-789).
    Inline alert (T-INV-1 inline site #2, NOT extracted):
      > 120 days → RED, > 90 days → YELLOW, else GREEN (INVERSE direction).

    Note: ageDays in [60, 90] → GREEN (filter passes >= 60, alert else clause).
    Uses date.today() (test monkeypatch target).
    """
    today = date.today()
    all_batches = await _query_material_batches_by_status(factory_id, "AVAILABLE")

    filtered = [
        b for b in all_batches
        if b.get("receipt_date") is not None
        and (today - b["receipt_date"]).days >= min_days
    ]

    # Java L787-789: sort by ageDays DESC (older batches first)
    filtered.sort(
        key=lambda b: (today - b["receipt_date"]).days,
        reverse=True,
    )
    long_aging = filtered[:20]

    rankings = []
    for rank, batch in enumerate(long_aging, start=1):
        age_days = (today - batch["receipt_date"]).days
        cq = _get_current_quantity(batch)
        up = batch.get("unit_price")
        up_dec = _to_decimal(up) if up is not None else Decimal("0")
        value = cq * up_dec

        # Inline alert (T-INV-1 inline site #2): NOT extracted as named helper
        if age_days > _LONG_AGING_RANKING_RED_DAYS:
            alert_level = "RED"
        elif age_days > _LONG_AGING_RANKING_YELLOW_DAYS:
            alert_level = "YELLOW"
        else:
            alert_level = "GREEN"

        rankings.append({
            "rank":           rank,
            "name":           batch.get("batch_number"),
            "value":          _decimal_to_number(
                value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "target":         age_days,
            "completionRate": _decimal_to_number(
                cq.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
            "alertLevel":     alert_level,
        })

    return rankings


async def _get_aging_mode(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Aging mode entry — composes 3 sub-services into 5-key envelope.

    F999 golden Jackson HashMap key order (verified):
      [agingMetrics, endDate, longAgingBatches, agingChart, startDate]
    Python dict literal mirrors exactly.
    """
    aging_metrics = await _get_aging_metrics(factory_id)
    aging_chart = await _get_inventory_aging_chart(factory_id)
    long_aging_batches = await _get_long_aging_batches_ranking(factory_id, min_days=60)
    return {
        "agingMetrics":     aging_metrics,
        "endDate":          end_date.isoformat(),
        "longAgingBatches": long_aging_batches,
        "agingChart":       aging_chart,
        "startDate":        start_date.isoformat(),
    }


# ============================================================
# Section 5d: Default mode (PR-B)
# Mirror Java InventoryHealthAnalysisServiceImpl.getInventoryHealth (L89-135).
# DashboardResponse @Builder + Lombok @Data — 16 fields all emitted regardless
# of population. Empty path → _build_empty_dashboard (Java L1222-1236).
#
# Outer envelope wrapper (Java controller L420-448): {overview, endDate, startDate}
# (3 keys, Jackson HashMap order from F999 golden).
#
# T-INV-9 asymmetric null + T-INV-15 inline scoring locked in `_get_health_score`.
# ============================================================


def _build_empty_dashboard() -> dict:
    """Mirror Java buildEmptyDashboard L1222-1236.

    Returns the full 16-key DashboardResponse envelope (Lombok @Data emits all
    fields regardless of population). Most fields are null/None defaults; only
    aiInsights / suggestions / lastUpdated / kpiCards / charts / rankings /
    fromCache are populated to match Java empty-state output.

    AIInsight 5-key shape verified against F999 default golden:
      {level, category, message, relatedEntity, actionSuggestion}

    Note `fromCache: False` (boolean default, NOT None) — Lombok @Data primitive.
    `lastUpdated` is ISO 8601 timestamp, volatile (stripped by `_strip_volatile`).
    """
    return {
        "period":            None,
        "startDate":         None,
        "endDate":           None,
        "kpiCards":          [],
        "metricCards":       None,
        "rankings":          {},
        "charts":            {},
        "chartList":         None,
        "aiInsights":        [{
            "level":            "YELLOW",
            "category":         "数据状态",
            "message":          "当前暂无库存数据",
            "relatedEntity":    None,
            "actionSuggestion": "请先录入原材料批次数据",
        }],
        "alerts":            None,
        "recommendations":   None,
        "suggestions":       ["请先录入库存数据以开始分析"],
        "generatedAt":       None,
        "lastUpdated":       _utc_now_iso(),
        "fromCache":         False,
        "cacheExpireAt":     None,
    }


async def _calculate_loss_rate_for_health_score(
    factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror subset of Java getLossAnalysis (L484-545) — ONLY LOSS_RATE metric.

    Public getLossAnalysis is NOT controller-dispatched (see §1.3 out-of-scope),
    but getHealthScore (Java L866-869) calls it for LOSS_RATE dimension input.

    This helper computes JUST the LOSS_RATE metric for health score consumption.
    Returns list[dict] (mirrors public getLossAnalysis return type) but with
    only the LOSS_RATE entry — health score's filter+findFirst pattern works
    transparently with this single-element list.

    Algorithm (Java L484-528, just the LOSS_RATE pieces):
      L490 allBatches = findByFactoryIdAndStatus(factoryId, AVAILABLE)
      L491 totalInventoryValue = calculateTotalInventoryValue(allBatches)
      L494-518 per batch, fetch adjustments in time range, accumulate by type:
        - "loss" type → lossAmount += abs(adjQty) * unitPrice
        - "damage" type → damageAmount += abs(adjQty) * unitPrice
        - "correction" AND adjQty < 0 → correctionAmount += abs(adjQty) * unitPrice
      L520 totalLoss = lossAmount + damageAmount + correctionAmount
      L526-528 lossRate = (totalInventoryValue > 0)
                          ? totalLoss / totalInventoryValue * 100 : 0
                          ⚠️ T-INV-2 div guard

    Returns: [{metricCode: "LOSS_RATE", value: lossRate, alertLevel: ...}]
    """
    all_batches = await _query_material_batches_by_status(factory_id, "AVAILABLE")
    total_inventory_value = _calculate_total_inventory_value(all_batches)

    loss_amount = Decimal("0")
    damage_amount = Decimal("0")
    correction_amount = Decimal("0")

    for batch in all_batches:
        adjustments = await _query_batch_adjustments_in_range(
            batch["id"], start_date, end_date
        )
        up = batch.get("unit_price")
        up_dec = _to_decimal(up) if up is not None else Decimal("0")

        for adj in adjustments:
            adj_qty = _to_decimal(adj["adjustment_quantity"])
            adj_value = abs(adj_qty) * up_dec
            adj_type = adj.get("adjustment_type")

            if adj_type == "loss":
                loss_amount += adj_value
            elif adj_type == "damage":
                damage_amount += adj_value
            elif adj_type == "correction" and adj_qty < Decimal("0"):
                correction_amount += adj_value

    total_loss = loss_amount + damage_amount + correction_amount

    if total_inventory_value > Decimal("0"):
        loss_rate = (total_loss / total_inventory_value).quantize(
            _SCALE, rounding=_QUANTIZE_HALF_UP
        ) * Decimal("100")
    else:
        loss_rate = Decimal("0")

    rate_display = loss_rate.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
    return [{
        "metricCode":      "LOSS_RATE",
        "metricName":      "损耗率",
        "value":           _decimal_to_number(rate_display),
        "formattedValue":  f"{_format_decimal_half_up(loss_rate, 2)}%",
        "unit":            "%",
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      _determine_loss_rate_alert_level(loss_rate),
        "description":     None,
    }]


async def _get_health_score(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java getHealthScore (L824-921).

    Returns single MetricResult (HEALTH_SCORE).

    ⚠️⚠️ T-INV-9 — ASYMMETRIC NULL HANDLING (Java bug, port verbatim).

    Algorithm (4 weighted dimensions, 30+30+20+20 = 100 max):

    Dimension 1 — TURNOVER (max 30 pts), Java L830-844:
      turnoverRate = getTurnoverAnalysis().filter(TURNOVER_RATE).findFirst().orElse(null)
      if (turnoverRate != null && turnoverRate.value != null):
        rate = turnoverRate.value
        if (rate >= TURNOVER_YELLOW_THRESHOLD=12)  +30
        elif (rate >= TURNOVER_RED_THRESHOLD=6)    +20
        else                                        +10
      // ⚠️ Java L835-844 has NO else branch — turnover null → 0 added (penalty)

    Dimension 2 — EXPIRY (max 30 pts), Java L846-863:
      if (expiryRisk != null && expiryRisk.value != null):
        rate < EXPIRY_YELLOW(10)  +30 | rate < EXPIRY_RED(15) +20 | else +10
      else: +30  // ⚠️ Java L862 — null → FULL POINTS

    Dimension 3 — LOSS (max 20 pts), Java L865-882:
      if (lossRate != null && lossRate.value != null):
        rate < LOSS_YELLOW(2) +20 | rate < LOSS_RED(5) +12 | else +5
      else: +20  // ⚠️ Java L881 — null → FULL POINTS

    Dimension 4 — AGING (max 20 pts), Java L884-901:
      if (slowMoving != null && slowMoving.value != null):
        rate < 10 +20 | rate < 20 +12 | else +5
      else: +20  // ⚠️ Java L899 — null → FULL POINTS

    ⚠️⚠️ T-INV-9 spec decision: PORT VERBATIM.
      All 4 metrics None: score = 0+30+20+20 = 70 (NOT 0).

    ⚠️⚠️ T-INV-15 — DO NOT reuse named alert helpers inside this function!
    The 4 named helpers use DIFFERENT comparison direction than inline scoring.
    Implementation MUST inline the comparisons exactly as Java getHealthScore L835-901.
    """
    health_score = Decimal("0")

    # Dimension 1 — TURNOVER (max 30 pts) — null → +0 (Java L835-844 NO else)
    turnover_metrics = await _get_turnover_analysis(factory_id, start_date, end_date)
    turnover_rate = next(
        (m for m in turnover_metrics if m.get("metricCode") == "TURNOVER_RATE"),
        None,
    )
    if turnover_rate is not None and turnover_rate.get("value") is not None:
        rate = _to_decimal(turnover_rate["value"])
        if rate >= _TURNOVER_YELLOW:
            health_score += Decimal("30")
        elif rate >= _TURNOVER_RED:
            health_score += Decimal("20")
        else:
            health_score += Decimal("10")
    # else: +0 (T-INV-9 asymmetric — turnover null is penalty)

    # Dimension 2 — EXPIRY (max 30 pts) — null → +30 (Java L862 FULL POINTS)
    expiry_metrics = await _get_expiry_risk_analysis(factory_id)
    expiry_risk = next(
        (m for m in expiry_metrics if m.get("metricCode") == "EXPIRY_RISK_RATE"),
        None,
    )
    if expiry_risk is not None and expiry_risk.get("value") is not None:
        rate = _to_decimal(expiry_risk["value"])
        if rate < _EXPIRY_RISK_YELLOW:
            health_score += Decimal("30")
        elif rate < _EXPIRY_RISK_RED:
            health_score += Decimal("20")
        else:
            health_score += Decimal("10")
    else:
        health_score += Decimal("30")    # T-INV-9 asymmetric

    # Dimension 3 — LOSS (max 20 pts) — null → +20 (Java L881 FULL POINTS)
    loss_metrics = await _calculate_loss_rate_for_health_score(factory_id, start_date, end_date)
    loss_rate = next(
        (m for m in loss_metrics if m.get("metricCode") == "LOSS_RATE"),
        None,
    )
    if loss_rate is not None and loss_rate.get("value") is not None:
        rate = _to_decimal(loss_rate["value"])
        if rate < _LOSS_RATE_YELLOW:
            health_score += Decimal("20")
        elif rate < _LOSS_RATE_RED:
            health_score += Decimal("12")
        else:
            health_score += Decimal("5")
    else:
        health_score += Decimal("20")    # T-INV-9 asymmetric

    # Dimension 4 — AGING (max 20 pts) — null → +20 (Java L899 FULL POINTS)
    aging_metrics = await _get_aging_metrics(factory_id)
    slow_moving = next(
        (m for m in aging_metrics if m.get("metricCode") == "SLOW_MOVING_RATE"),
        None,
    )
    if slow_moving is not None and slow_moving.get("value") is not None:
        rate = _to_decimal(slow_moving["value"])
        if rate < Decimal("10"):
            health_score += Decimal("20")
        elif rate < Decimal("20"):
            health_score += Decimal("12")
        else:
            health_score += Decimal("5")
    else:
        health_score += Decimal("20")    # T-INV-9 asymmetric

    # Overall alert (T-INV-1 inline site #4)
    if health_score >= _HEALTH_SCORE_GREEN_MIN:
        alert_level = "GREEN"
    elif health_score >= _HEALTH_SCORE_YELLOW_MIN:
        alert_level = "YELLOW"
    else:
        alert_level = "RED"

    score_zero_scale = health_score.quantize(Decimal("1"), rounding=_QUANTIZE_HALF_UP)
    return {
        "metricCode":      "HEALTH_SCORE",
        "metricName":      "库存健康评分",
        "value":           _decimal_to_number(score_zero_scale),
        "formattedValue":  f"{_format_decimal_half_up(health_score, 0)} 分",
        "unit":            "分",
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      alert_level,
        "description":     "满分100分",
    }


async def _calculate_kpi_cards(
    batches: list[dict], factory_id: str, start_date: date, end_date: date
) -> list[dict]:
    """Mirror Java calculateKpiCards (L1005-1053).

    Returns 5 KPI metrics:
      [INVENTORY_VALUE, BATCH_COUNT, TURNOVER_RATE, EXPIRY_RISK_RATE, HEALTH_SCORE]

    ⚠️ KPI 3 (TURNOVER_RATE) and KPI 4 (EXPIRY_RISK_RATE) are pulled from
    sub-service results via filter+findFirst. If sub-service returned no metric
    with that code, the KPI is **omitted** (Java line 1035 `if (turnover != null)`).
    """
    kpi_cards: list[dict] = []

    # KPI 1: INVENTORY_VALUE (computed directly from batches in-memory, NOT via
    # _query_inventory_value_total — Java line 1010-1018 uses
    # calculateTotalInventoryValue helper)
    total_value = _calculate_total_inventory_value(batches)
    kpi_cards.append({
        "metricCode":      "INVENTORY_VALUE",
        "metricName":      "库存总值",
        "value":           _decimal_to_number(
            total_value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
        ),
        "formattedValue":  _format_currency(total_value),
        "unit":            "元",
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      "GREEN",
        "description":     None,
    })

    # KPI 2: BATCH_COUNT
    kpi_cards.append({
        "metricCode":      "BATCH_COUNT",
        "metricName":      "库存批次",
        "value":           len(batches),
        "formattedValue":  f"{len(batches):,}",   # Java %,d format
        "unit":            "批",
        "dimensionValue":  None,
        "changeValue":     None,
        "changePercent":   None,
        "changeDirection": None,
        "alertLevel":      "GREEN",
        "description":     None,
    })

    # KPI 3: TURNOVER_RATE — pulled from getTurnoverAnalysis result
    turnover_metrics = await _get_turnover_analysis(factory_id, start_date, end_date)
    turnover = next(
        (m for m in turnover_metrics if m.get("metricCode") == "TURNOVER_RATE"),
        None,
    )
    if turnover is not None:
        kpi_cards.append(turnover)

    # KPI 4: EXPIRY_RISK_RATE — pulled from getExpiryRiskAnalysis result
    expiry_metrics = await _get_expiry_risk_analysis(factory_id)
    expiry_risk = next(
        (m for m in expiry_metrics if m.get("metricCode") == "EXPIRY_RISK_RATE"),
        None,
    )
    if expiry_risk is not None:
        kpi_cards.append(expiry_risk)

    # KPI 5: HEALTH_SCORE — always added (Java L1049-1050)
    health_score = await _get_health_score(factory_id, start_date, end_date)
    kpi_cards.append(health_score)

    return kpi_cards


def _build_material_category_value_chart(batches: list[dict]) -> dict:
    """Mirror Java buildMaterialCategoryValueChart (L1068-1102).

    PIE chart of top-10 material categories by total value.
    Algorithm:
      L1069-1077 categoryValues = groupingBy(materialTypeId,
                                              reducing(currentQty * unitPrice))
      L1079-1088 chartData = entries.sorted(byValue desc).limit(10)
                                      .map(entry → {category, value (DISPLAY_SCALE=2)})
      L1090-1092 options: [showPercentage=true, showLegend=true]

    xaxisField/yaxisField LOWERCASE (golden-verified, Lombok-Jackson demangling).
    """
    category_values: dict[str, Decimal] = {}
    for b in batches:
        mtid = b.get("material_type_id")
        if mtid is None:
            continue
        cq = _get_current_quantity(b)
        up = b.get("unit_price")
        up_dec = _to_decimal(up) if up is not None else Decimal("0")
        value = cq * up_dec
        category_values[mtid] = category_values.get(mtid, Decimal("0")) + value

    # Mirror Java Collectors.groupingBy + entrySet().sorted(byValue.reversed())
    # iter order for value-tied entries — Python's stable sort preserves dict
    # insertion order on ties, but Java HashMap iter is bucket-asc + reverse-
    # within-bucket due to computeIfAbsent prepending. PR-N-1 (procurement)
    # introduced this helper; shared here to fix 材料类别库存占比 sort-tie on
    # F001 prod (chart data[6-10] swap of RMT_xxx categories per task #21).
    sorted_entries = _sort_entries_java_iter_then_value_desc(category_values.items())
    chart_data = [
        {
            "category": mtid,
            "value":    _decimal_to_number(
                value.quantize(_DISPLAY_SCALE, rounding=_QUANTIZE_HALF_UP)
            ),
        }
        for mtid, value in sorted_entries[:10]
    ]

    options = {
        "showPercentage": True,
        "showLegend":     True,
    }

    return {
        "chartType":   "PIE",
        "title":       "材料类别库存占比",
        "xaxisField":  "category",
        "yaxisField":  "value",
        "seriesField": None,
        "data":        chart_data,
        "options":     options,
    }


def _generate_ai_insights(
    batches: list[dict], kpi_cards: list[dict], factory_id: str
) -> list[dict]:
    """Mirror Java generateAiInsights (L1107-1177).

    Rule-based, NO LLM. 3 conditional insights:
    1. Expiry risk:
       - rate > EXPIRY_RED_THRESHOLD (15) → RED insight
       - rate > EXPIRY_YELLOW_THRESHOLD (10) → YELLOW insight
       - else: no insight
    2. Turnover:
       - rate < TURNOVER_RED_THRESHOLD (6) → RED insight
       - rate < TURNOVER_YELLOW_THRESHOLD (12) → YELLOW insight
       - else: no insight
    3. Health score:
       - score >= 80 → GREEN insight (good)
       - else: no insight (Java only emits "good" message)

    AIInsight JSON shape (5-key, golden-verified):
      [level, category, message, relatedEntity, actionSuggestion]
    """
    insights: list[dict] = []

    # Insight 1: Expiry risk
    expiry_risk = next(
        (m for m in kpi_cards if m.get("metricCode") == "EXPIRY_RISK_RATE"),
        None,
    )
    if expiry_risk is not None and expiry_risk.get("value") is not None:
        rate = _to_decimal(expiry_risk["value"])
        if rate > _EXPIRY_RISK_RED:
            insights.append({
                "level":            "RED",
                "category":         "临期风险",
                "message":          f"临期风险率高达 {_format_decimal_half_up(rate, 1)}%，需要立即处理",
                "relatedEntity":    None,
                "actionSuggestion": "建议优先消耗临期库存，考虑促销或转让处理",
            })
        elif rate > _EXPIRY_RISK_YELLOW:
            insights.append({
                "level":            "YELLOW",
                "category":         "临期风险",
                "message":          f"临期风险率为 {_format_decimal_half_up(rate, 1)}%，需要关注",
                "relatedEntity":    None,
                "actionSuggestion": "建议制定临期库存消化计划",
            })

    # Insight 2: Turnover
    turnover = next(
        (m for m in kpi_cards if m.get("metricCode") == "TURNOVER_RATE"),
        None,
    )
    if turnover is not None and turnover.get("value") is not None:
        rate = _to_decimal(turnover["value"])
        if rate < _TURNOVER_RED:
            insights.append({
                "level":            "RED",
                "category":         "周转效率",
                "message":          f"库存周转率仅 {_format_decimal_half_up(rate, 1)} 次/年，库存积压严重",
                "relatedEntity":    None,
                "actionSuggestion": "建议减少采购量，加快库存消化，优化安全库存设置",
            })
        elif rate < _TURNOVER_YELLOW:
            insights.append({
                "level":            "YELLOW",
                "category":         "周转效率",
                "message":          f"库存周转率 {_format_decimal_half_up(rate, 1)} 次/年，有优化空间",
                "relatedEntity":    None,
                "actionSuggestion": "建议优化采购批次和频率，提高周转效率",
            })

    # Insight 3: Health score (only emits when score >= 80, NOT for low scores)
    health_score = next(
        (m for m in kpi_cards if m.get("metricCode") == "HEALTH_SCORE"),
        None,
    )
    if health_score is not None and health_score.get("value") is not None:
        score = _to_decimal(health_score["value"])
        if score >= Decimal("80"):
            insights.append({
                "level":            "GREEN",
                "category":         "整体健康",
                "message":          f"库存健康评分 {_format_decimal_half_up(score, 0)} 分，状况良好",
                "relatedEntity":    None,
                "actionSuggestion": "继续保持当前库存管理策略",
            })

    return insights


def _generate_suggestions(batches: list[dict], kpi_cards: list[dict]) -> list[str]:
    """Mirror Java generateSuggestions (L1182-1217).

    Rule-based, returns list[str]. 3 conditional suggestions:
    1. expiringCount > 0 (batches expiring within 30 days)
    2. longAgingCount > 0 (batches with ageDays > 90)
    3. turnover < TURNOVER_YELLOW_THRESHOLD (12)
    """
    suggestions: list[str] = []
    today = date.today()

    # Suggestion 1
    warning_date = today + _days(_DEFAULT_EXPIRY_WARNING_DAYS)
    expiring_count = sum(
        1 for b in batches
        if b.get("expire_date") is not None and b["expire_date"] <= warning_date
    )
    if expiring_count > 0:
        suggestions.append(f"有 {expiring_count} 批库存将在30天内过期，建议优先安排使用")

    # Suggestion 2
    long_aging_count = sum(
        1 for b in batches
        if b.get("receipt_date") is not None
        and (today - b["receipt_date"]).days > _AGING_WARNING
    )
    if long_aging_count > 0:
        suggestions.append(f"有 {long_aging_count} 批库存库龄超过90天，建议检查使用计划或考虑处理")

    # Suggestion 3
    turnover = next(
        (m for m in kpi_cards if m.get("metricCode") == "TURNOVER_RATE"),
        None,
    )
    if turnover is not None and turnover.get("value") is not None:
        rate = _to_decimal(turnover["value"])
        if rate < _TURNOVER_YELLOW:
            suggestions.append("库存周转率偏低，建议优化安全库存设置，减少不必要的采购")

    return suggestions


async def _get_inventory_health(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Mirror Java getInventoryHealth (L89-135).

    Returns full 16-key DashboardResponse envelope (Lombok @Data emission semantics).
    Empty batches → _build_empty_dashboard (also 16 keys).

    ⚠️ T-INV-11 — recursive call chain (NOT optimized):
      _get_inventory_health → _calculate_kpi_cards
        → _get_turnover_analysis (3rd query of allBatches)
        → _get_expiry_risk_analysis (3rd query of allBatches in expiry path)
        → _get_health_score
          → _get_turnover_analysis again
          → _get_expiry_risk_analysis again
          → _calculate_loss_rate_for_health_score
          → _get_aging_metrics

    ⚠️ T-INV-8 — default mode charts are exactly:
      [getInventoryAgingChart, getExpiryRiskChart, buildMaterialCategoryValueChart]
    No radar, no loss-anything.
    """
    all_batches = await _query_material_batches_by_status(factory_id, "AVAILABLE")

    if not all_batches:
        return _build_empty_dashboard()

    # Java line 101: kpiCards
    metric_results = await _calculate_kpi_cards(all_batches, factory_id, start_date, end_date)
    kpi_cards = _convert_to_kpi_cards(metric_results)

    # Java line 105-108: charts list (3 charts) + LinkedHashMap by title.replace(" ", "_")
    chart_list = [
        await _get_inventory_aging_chart(factory_id),
        await _get_expiry_risk_chart(factory_id),
        _build_material_category_value_chart(all_batches),
    ]
    charts: dict[str, dict] = {}
    for chart in chart_list:
        title = chart.get("title")
        key = title.replace(" ", "_") if title else f"chart_{len(charts)}"
        charts[key] = chart

    # Java line 115-119: rankings LinkedHashMap with keys "expiring", "aging"
    expiring_ranking = await _get_expiring_batches_ranking(factory_id, _DEFAULT_EXPIRY_WARNING_DAYS)
    aging_ranking = await _get_long_aging_batches_ranking(factory_id, _AGING_NORMAL)
    rankings = {
        "expiring": expiring_ranking,
        "aging":    aging_ranking,
    }

    # Java line 122-125: rule-based generators (NO LLM)
    ai_insights = _generate_ai_insights(all_batches, metric_results, factory_id)
    suggestions = _generate_suggestions(all_batches, metric_results)

    # 16-key envelope (Lombok @Data) — populated path
    return {
        "period":            None,
        "startDate":         None,         # inner overview's startDate is null (Java default)
        "endDate":           None,
        "kpiCards":          kpi_cards,
        "metricCards":       None,
        "rankings":          rankings,
        "charts":            charts,
        "chartList":         None,
        "aiInsights":        ai_insights,
        "alerts":            None,
        "recommendations":   None,
        "suggestions":       suggestions,
        "generatedAt":       None,
        "lastUpdated":       _utc_now_iso(),
        "fromCache":         False,
        "cacheExpireAt":     None,
    }


async def _get_default_mode(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Outer envelope wrapper for default mode.
    F999 golden Jackson HashMap order: [overview, endDate, startDate]."""
    overview = await _get_inventory_health(factory_id, start_date, end_date)
    return {
        "overview":  overview,
        "endDate":   end_date.isoformat(),
        "startDate": start_date.isoformat(),
    }


@router.get("/api/mobile/{factory_id}/smart-bi/analysis/inventory")
async def get_inventory_analysis(
    factory_id: str,
    startDate: date = Query(..., alias="startDate"),
    endDate: date = Query(..., alias="endDate"),
    analysisType: Optional[str] = Query(None, alias="analysisType"),
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java SmartBIAnalysisController.getInventoryAnalysis line 411-448.

    Branches:
      analysisType=turnover  → turnover per-type (5-key envelope, PR-A Task 9)
      analysisType=expiry    → expiry per-type (5-key envelope, PR-A Task 10)
      analysisType=aging     → aging per-type (5-key envelope, PR-A Task 11)
      analysisType empty     → default getInventoryHealth (501 in PR-A; PR-B real impl)
      analysisType=overview  → alias for empty/default (F-1 follow-up,
                               fixes UI dead-end where overview tab hit 501;
                               default mode envelope is literally keyed `overview`)
      analysisType=other     → 501 envelope (un-ported)
    """
    if analysisType == "turnover":
        result = await _get_turnover_mode(auth.factory_id, startDate, endDate)
        return wrap_response(result)
    if analysisType == "expiry":
        result = await _get_expiry_mode(auth.factory_id, startDate, endDate)
        return wrap_response(result)
    if analysisType == "aging":
        result = await _get_aging_mode(auth.factory_id, startDate, endDate)
        return wrap_response(result)
    if not analysisType or analysisType == "overview":
        # PR-B: default mode (getInventoryHealth + DashboardResponse wrapped)
        result = await _get_default_mode(auth.factory_id, startDate, endDate)
        return wrap_response(result)
    # Unknown analysisType → 501
    return wrap_response(
        data=None,
        success=False,
        code=501,
        message=f"analysisType={analysisType} 尚未 port 至 Python",
    )
