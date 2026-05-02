# Phase 2A `/analysis/region` per-type impl PR-A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Java `RegionAnalysisServiceImpl` composite path (4 sub-services + dateRange envelope) to Python `analysis_region.py`, achieving dict-eq byte-shape parity against F999 + F001 Java goldens.

**Architecture:** Single new module `backend/python/smartbi_compat/api/analysis_region.py` (~600 LOC) with one route handler, one SQL helper, one dispatcher, 4 sub-service builders, and 13 algorithm helpers. Two `main.py` lines register the router. Contract tests (~150 LOC) gate dict-eq parity against recorded Java goldens. Implementation strictly follows spec `docs/superpowers/specs/2026-05-01-phase2a-analysis-region-design.md` — 13 R-T traps already line-locked in spec.

**Tech Stack:** Python 3.8 (server venv38) / FastAPI / SQLAlchemy sync engine + `_to_thread` shim / Decimal arithmetic / pytest + monkeypatch. Imports `_decimal_to_number`, `_to_decimal`, `_new_date_range_dict`, `_utc_now_iso` from `analysis_finance.py`; imports `_to_thread`, `_calculate_mom_growth`, `_get_sync_engine` from `analysis_sales.py`.

---

## Context: Critical traps to mirror exactly (from spec §8.1)

| Trap | Where | What to lock |
|---|---|---|
| **R-T1** | `_calculate_penetration_score` | `customer_count * 10 + order_count // 10` — Python `//` (floor div), NOT `/`. `int()` coerce both args. |
| **R-T2** | `_calculate_margin_score` | `gross_margin * Decimal("3.33")` exact (NOT float 3.33). |
| **R-T3** | `_calculate_base_score` | `(region/total).quantize(4) * 100 * 3` clamped to 100. 33.33% → 99.99 (NOT 100). |
| **R-T4** | `_calculate_growth_score` | `_calculate_mom_growth(curr, prev) + 50` clamped [0,100]. |
| **R-T5** | `_previous_period_window` | `prev_start = start - timedelta(days=days_between+1); prev_end = start - timedelta(days=1)`. |
| **R-T6** | `RegionAggregation.add_sale` | `customer_count = len(customers)` set every call. |
| **R-T7** | `_normalize_province_name` | 7 regex patterns IN ORDER: 省, 市, 自治区, 特别行政区, 壮族, 回族, 维吾尔. Self-治区 BEFORE 壮族/回族/维吾尔. |
| **R-T8** | `_aggregate_by_region/province` | Null/empty → `'未分类'` bucket. |
| **R-T9** | `_determine_color_level` | Decimal compare 0.7 / 0.3 (NOT float). |
| **R-T11** | `RegionAggregation.calculate_gross_margin` | `total_amount==0` → `gross_margin` STAYS `Decimal("0")` (NOT None). |
| **R-T12** | opportunityScores dict | Lombok `@Data` declaration order: region, totalScore, growthScore, baseScore, marginScore, penetrationScore, **recommendation, opportunityLevel**, currentSales, previousSales, growthRate, grossMargin, customerCount. |
| **R-T13** | `_calculate_completion_rate` | LOCAL definition: `(actual/target).quantize(4) * 100`. Do NOT import from `analysis_sales` (which uses `(actual/target*100).quantize(4)` — different bytes). |
| **Map.of order** | heatmap.options, visualMap, top-level | KEY-ORDER-TBD-VIA-GOLDEN — record before finalizing dict literal. |

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| **Create** | `backend/python/smartbi_compat/api/analysis_region.py` | All region logic: imports, constants, `RegionAggregation`, SQL helper, 13 algorithm helpers, 4 sub-services, dispatcher, route handler |
| **Create** | `tests/python/smartbi_compat/test_analysis_region_contract.py` | F999 + F001 dict-eq gate, route-registered test, JWT/factory-mismatch tests, empty-data shape tests |
| **Create** | `tests/fixtures/java-smartbi-golden/analysis-region-F999.json` | Recorded from test env Java 10011 |
| **Create** | `tests/fixtures/java-smartbi-golden/analysis-region-F001.json` | Recorded from prod env Java 10010 |
| **Modify** | `backend/python/main.py` lines 1106-1128 (Phase 2A registration block) | Add 2 lines: `from smartbi_compat.api import analysis_region` + `app.include_router(analysis_region.router, tags=["SmartBI Compat: Analysis Region"])` |

No other files touched. Entire impl is additive.

---

## Task 1: Pre-flight — Verify worktree state and helper availability

**Files:** None modified — read-only sanity check.

- [ ] **Step 1: Confirm we're on the worktree branch with main as base**

Run: `git status && git log --oneline origin/main..HEAD`
Expected: branch `phase2a/region-impl`, no commits ahead of origin/main yet.

- [ ] **Step 2: Verify spec PRs all merged in main**

Run: `git log origin/main --oneline | grep -E "#36|#40|#41|#47" | head`
Expected: `#41 region spec`, `#36 department spec`, `#40 procurement spec`, `#47 inventory spec` all present.

- [ ] **Step 3: Verify helper functions in `analysis_finance.py` exist**

Run: `grep -n "^def _decimal_to_number\|^def _to_decimal\|^def _new_date_range_dict\|^def _utc_now_iso" backend/python/smartbi_compat/api/analysis_finance.py`
Expected lines: 103 `_new_date_range_dict`, 402 `_to_decimal`, 429 `_decimal_to_number`, 1290 `_utc_now_iso`.

- [ ] **Step 4: Verify helper functions in `analysis_sales.py` exist**

Run: `grep -n "^def _to_thread\|^def _calculate_mom_growth\|^def _get_sync_engine" backend/python/smartbi_compat/api/analysis_sales.py`
Expected lines: 50 `_to_thread`, 146 `_calculate_mom_growth`, 208 `_get_sync_engine`.

- [ ] **Step 5: Verify spec is checked in**

Run: `ls -la docs/superpowers/specs/2026-05-01-phase2a-analysis-region-design.md`
Expected: ~1821 LOC file.

---

## Task 2: Record F999 + F001 Java goldens (HARD prereq)

**Files:**
- Create: `tests/fixtures/java-smartbi-golden/analysis-region-F999.json`
- Create: `tests/fixtures/java-smartbi-golden/analysis-region-F001.json`

**Why this is task 2 not last:** Goldens reveal Map.of(N) Jackson hash orders for top-level (HashMap), `heatmap.options` (Map.of(4)), `visualMap` (Map.of(3)), and Lombok @Data declaration orders for `RankingItem`/`MetricResult`/`RegionOpportunityScore`/`ChartConfig`. Per Rule 8, Python dict literals MUST mirror golden order, NOT Java source order.

- [ ] **Step 1: Source `~/.bashrc` to load JWT_SECRET / .env vars (per concurrent-edit-safety / R2 creds notes)**

Run: `source ~/.bashrc`

- [ ] **Step 2: Read JWT secrets from server env files**

Run: `ssh root@47.100.235.168 "cat /www/wwwroot/cretas/.env.test | grep JWT_SECRET"`
And: `ssh root@47.100.235.168 "cat /www/wwwroot/cretas/.env.prod | grep JWT_SECRET"`
Save the two values to local shell variables `JWT_TEST` and `JWT_PROD`.

- [ ] **Step 3: Record F999 (test env, port 10011)**

Run:
```bash
JWT_SECRET="$JWT_TEST" ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/analysis/region?startDate=2024-01-01&endDate=2024-12-31' \
    analysis-region-F999.json
```

Expected: `tests/fixtures/java-smartbi-golden/analysis-region-F999.json` written. Script prints first 20 lines; sanity-check it has top-level keys including `ranking`, `targetCompletion`, `heatmap`, `opportunityScores`, `dateRange`, `generatedAt`.

- [ ] **Step 4: Record F001 (prod env, port 10010)**

Run:
```bash
JWT_SECRET="$JWT_PROD" ./scripts/record-java-golden.sh F001 \
    '/api/mobile/{factoryId}/smart-bi/analysis/region?startDate=2024-01-01&endDate=2024-12-31' \
    analysis-region-F001.json --prod
```

Expected: `analysis-region-F001.json` with real prod data — non-empty `ranking`, `opportunityScores`. If F001 returns empty (factory has no sales data), document and proceed with F999 only as primary gate.

- [ ] **Step 5: Verify both files are valid JSON**

Run:
```bash
jq -r 'keys[]' tests/fixtures/java-smartbi-golden/analysis-region-F999.json | sort
jq -r '.data | keys[]' tests/fixtures/java-smartbi-golden/analysis-region-F999.json | sort
```

Note: depending on `record-java-golden.sh` output shape, the response may be wrapped in `{success, data, message}` envelope. Check both forms. If wrapped, the inner `data` is what we compare.

- [ ] **Step 6: Commit goldens (WIP commit, will squash later)**

Run:
```bash
git add tests/fixtures/java-smartbi-golden/analysis-region-F999.json tests/fixtures/java-smartbi-golden/analysis-region-F001.json
git status --short
git commit -m "WIP: record region F999 + F001 java goldens" -- \
    tests/fixtures/java-smartbi-golden/analysis-region-F999.json \
    tests/fixtures/java-smartbi-golden/analysis-region-F001.json
```

(Per concurrent-edit-safety Rule 5b: explicit `-- F1 F2` form to lock commit scope.)

---

## Task 3: Decode Map.of / HashMap key orders from goldens

**Files:** None modified — analysis-only step that produces a notes block we use in Tasks 7-10.

**Output:** A markdown table noting actual key order for each Map.of(N) / HashMap site, to be embedded as a comment in `analysis_region.py` and used to write dict literals in correct order.

- [ ] **Step 1: Inspect top-level HashMap key order (6 keys)**

Run: `jq -r 'if .data then .data | keys_unsorted[] else keys_unsorted[] end' tests/fixtures/java-smartbi-golden/analysis-region-F999.json`
Expected output: 6 lines naming `ranking`, `targetCompletion`, `heatmap`, `opportunityScores`, `dateRange`, `generatedAt` in **Java HashMap hash order** (not source order).

Record actual order in scratch notes — e.g., `["ranking", "heatmap", "targetCompletion", "dateRange", "opportunityScores", "generatedAt"]`.

- [ ] **Step 2: Inspect heatmap.options Map.of(4) order**

Run: `jq -r '(.data // .) .heatmap.options | keys_unsorted[]' tests/fixtures/java-smartbi-golden/analysis-region-F999.json`
Expected: 4 keys from {`mapType`, `showLabel`, `roam`, `visualMap`} in hash order.

Record order. If F999 has empty data, options may not be present (per spec §3.9 empty case omits options); if so, get this from F001.

- [ ] **Step 3: Inspect visualMap Map.of(3) order**

Run: `jq -r '(.data // .) .heatmap.options.visualMap | keys_unsorted[]' tests/fixtures/java-smartbi-golden/analysis-region-F999.json` (or F001).
Expected: 3 keys from {`min`, `max`, `calculable`} in hash order.

Record order.

- [ ] **Step 4: Inspect RankingItem field order (Lombok @Data)**

Run: `jq -r '(.data // .) .ranking[0] | keys_unsorted[]' tests/fixtures/java-smartbi-golden/analysis-region-F001.json`
Expected: `rank, name, value, target, completionRate, alertLevel` (or whatever Lombok declaration order produces). If F001 is empty, fall back to inspecting `targetCompletion[0]` for MetricResult shape similarly.

- [ ] **Step 5: Inspect RegionOpportunityScore field order (R-T12)**

Run: `jq -r '(.data // .) .opportunityScores[0] | keys_unsorted[]' tests/fixtures/java-smartbi-golden/analysis-region-F001.json`
Expected (per spec §8.1 R-T12 lock): `region, totalScore, growthScore, baseScore, marginScore, penetrationScore, recommendation, opportunityLevel, currentSales, previousSales, growthRate, grossMargin, customerCount`.

If different from spec, note divergence — Lombok may reorder. Source of truth is golden, NOT spec.

- [ ] **Step 6: Inspect MetricResult field order (targetCompletion[0])**

Run: `jq -r '(.data // .) .targetCompletion[0] | keys_unsorted[]' tests/fixtures/java-smartbi-golden/analysis-region-F001.json`
Expected: `metricCode, metricName, value, formattedValue, unit, changePercent, changeDirection, alertLevel, dimensionValue, description` (Lombok order).

- [ ] **Step 7: Inspect ChartConfig field order (heatmap)**

Run: `jq -r '(.data // .) .heatmap | keys_unsorted[]' tests/fixtures/java-smartbi-golden/analysis-region-F001.json`
Expected (full): `chartType, title, xAxisField, yAxisField, data, options`. For empty case from F999: only 3 keys.

- [ ] **Step 8: Inspect heatmap.data[0] LinkedHashMap order (province item)**

Run: `jq -r '(.data // .) .heatmap.data[0] | keys_unsorted[]' tests/fixtures/java-smartbi-golden/analysis-region-F001.json`
Expected: `province, value, heatValue, orderCount, customerCount, colorLevel` (Java line 353 explicit `LinkedHashMap` insertion order).

- [ ] **Step 9: Inspect dateRange envelope shape**

Run: `jq -r '(.data // .) .dateRange | keys_unsorted[]' tests/fixtures/java-smartbi-golden/analysis-region-F999.json`
Expected: matches existing `_new_date_range_dict` output. Note any divergence.

- [ ] **Step 10: Inspect generatedAt format**

Run: `jq -r '(.data // .) .generatedAt' tests/fixtures/java-smartbi-golden/analysis-region-F999.json`
Expected format: ISO LocalDateTime, possibly `2024-12-15T14:23:01.123` or with timezone suffix. Will be stripped by `_strip_volatile`, but record format for parity check.

- [ ] **Step 11: Save notes inline in plan progress comments**

In your scratch notes, note all 9 orderings. They'll be referenced verbatim in Task 4 (top-level), Task 8 (heatmap), Task 10 (sub-services).

---

## Task 4: Skeleton — `analysis_region.py` imports, constants, and `RegionAggregation` dataclass

**Files:**
- Create: `backend/python/smartbi_compat/api/analysis_region.py`

- [ ] **Step 1: Write the file header + imports + APIRouter**

Create `backend/python/smartbi_compat/api/analysis_region.py` with:

```python
"""Phase 2A /analysis/region per-type real impl (composite path).

Java reference:
  - Controller: SmartBIAnalysisController.getRegionAnalysis line 181-218
  - Composite dispatcher: SmartBIServiceImpl.getComprehensiveAnalysis line 593-598 ("region" case)
  - Sub-services: RegionAnalysisServiceImpl.java
      * getRegionRanking (line 54-94)
      * getRegionTargetCompletion (line 269-314)
      * getGeographicHeatmapData (line 318-381)
      * getRegionOpportunityScores (line 385-464)

Per-type fallback path (smartBIService==null branch, line 197-211 Java) is
dead code (Spring DI never null) and OUT OF SCOPE per spec §1.3.

13 R-T traps locked per spec §8.1 — see inline pinpoints below.
Map.of(N) / HashMap key orders mirror recorded F999/F001 goldens (Rule 8).
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, Depends, Query

# Helpers from sister Phase 2A modules — DO NOT redefine locally
from smartbi_compat.api.analysis_finance import (
    _decimal_to_number,
    _to_decimal,
    _new_date_range_dict,
    _utc_now_iso,
)
# _calculate_mom_growth, _to_thread (Python 3.8 shim), _get_sync_engine
# imported from analysis_sales. _calculate_completion_rate INTENTIONALLY NOT
# imported — region defines locally per R-T13 (different arithmetic order).
from smartbi_compat.api.analysis_sales import (
    _calculate_mom_growth,
    _to_thread,
    _get_sync_engine,
)

from sqlalchemy import text

from smartbi_compat.auth import AuthContext, verify_jwt_and_factory
from smartbi_compat.date_range import DateRange
from smartbi_compat.schema_compat import wrap_response

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Constants — alert thresholds inline per Java line 459-461 (NOT alert_thresholds.py)
# ============================================================
_REGION_TARGET_COMPLETION_RED = Decimal("60")
_REGION_TARGET_COMPLETION_YELLOW = Decimal("85")

# Heatmap color level thresholds — non-integer, MUST use Decimal compare (Rule 7, R-T9)
_HEATMAP_HIGH = Decimal("0.7")
_HEATMAP_MEDIUM = Decimal("0.3")


# ============================================================
# RegionAggregation — mirror Java private static class (impl line 1175-1208)
# R-T6: customer_count synced incrementally via len(customers)
# R-T11: gross_margin stays Decimal("0") on amount=0, NOT None
# ============================================================
@dataclass
class RegionAggregation:
    total_amount: Decimal = field(default_factory=lambda: Decimal("0"))
    total_cost: Decimal = field(default_factory=lambda: Decimal("0"))
    total_target: Decimal = field(default_factory=lambda: Decimal("0"))
    gross_margin: Decimal = field(default_factory=lambda: Decimal("0"))
    order_count: int = 0
    customer_count: int = 0
    customers: set = field(default_factory=set)

    def add_sale(self, row: dict) -> None:
        # Rule 1: explicit `is not None` — Decimal("0") is Python falsy
        if row.get("amount") is not None:
            self.total_amount += _to_decimal(row["amount"])
        if row.get("cost") is not None:
            self.total_cost += _to_decimal(row["cost"])
        if row.get("monthly_target") is not None:
            self.total_target += _to_decimal(row["monthly_target"])
        self.order_count += 1
        cn = row.get("customer_name")
        # Java line 1195: `!= null && !cn.isEmpty()`
        if cn is not None and cn != "":
            self.customers.add(cn)
        # R-T6: customer_count synced every call (Java line 1198)
        self.customer_count = len(self.customers)

    def calculate_gross_margin(self) -> None:
        # R-T11: total_amount==0 → gross_margin stays Decimal("0"), NOT None
        if self.total_amount > Decimal("0"):
            gross_profit = self.total_amount - self.total_cost
            self.gross_margin = (
                (gross_profit / self.total_amount).quantize(
                    Decimal("0.0001"), ROUND_HALF_UP
                )
                * Decimal("100")
            )
```

- [ ] **Step 2: Verify file imports cleanly**

Run: `cd backend/python && python -c "from smartbi_compat.api import analysis_region; print('OK')"`
Expected: `OK` (no ImportError).

- [ ] **Step 3: Commit skeleton**

```bash
git add backend/python/smartbi_compat/api/analysis_region.py
git status --short
git commit -m "WIP: region module skeleton (imports, constants, RegionAggregation)" -- \
    backend/python/smartbi_compat/api/analysis_region.py
```

---

## Task 5: SQL helper `_query_region_full` + `_previous_period_window`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_region.py` — append new section

- [ ] **Step 1: Write the SQL helper**

Append after `RegionAggregation`:

```python
# ============================================================
# SQL helper — Rule 5 SELECT *, Rule 6 None-check precondition
# ============================================================
_REGION_FULL_SQL = text("""
    SELECT *
    FROM smart_bi_sales_data
    WHERE factory_id = :factory_id
      AND order_date BETWEEN :start_date AND :end_date
      AND deleted_at IS NULL
    ORDER BY id ASC
""")


async def _query_region_full(
    factory_id: str,
    start_date: date,
    end_date: date,
) -> list:
    """Mirror SmartBiSalesDataRepository.findByFactoryIdAndOrderDateBetween.

    Rule 5: SELECT * for sister-chat extensibility.
    Rule 6: Reject None inputs explicitly — asyncpg/SQLAlchemy silently coerce
    None → NULL, BETWEEN NULL AND NULL returns 0 rows.
    R-T10: ORDER BY id ASC matches Java JPA default fetch order on PG (verified
    by F001 golden; if golden reveals a different order, update SQL accordingly).

    Python 3.8 compat: uses _to_thread shim (NOT bare asyncio.to_thread).
    """
    if start_date is None or end_date is None:
        raise ValueError(
            f"_query_region_full: start_date/end_date required "
            f"(got {start_date}, {end_date})"
        )

    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            rows = conn.execute(_REGION_FULL_SQL, {
                "factory_id": factory_id,
                "start_date": start_date,
                "end_date": end_date,
            }).fetchall()
            return [dict(row._mapping) for row in rows]

    return await _to_thread(_exec)


# ============================================================
# Period window helper — R-T5 LOCK
# ============================================================
def _previous_period_window(start: date, end: date) -> tuple:
    """Mirror impl line 398-400: adjacent mirrored period (NOT YoY).

    days_between = (end - start).days
    prev_start = start - timedelta(days=days_between + 1)
    prev_end = start - timedelta(days=1)

    Edge: start == end (single-day) → prev_start == prev_end == start - 1 day.
    Java ChronoUnit.DAYS.between(start, end) ≡ Python (end - start).days for date.
    """
    days_between = (end - start).days
    prev_start = start - timedelta(days=days_between + 1)
    prev_end = start - timedelta(days=1)
    return prev_start, prev_end
```

- [ ] **Step 2: Quick syntax check**

Run: `python -c "from smartbi_compat.api import analysis_region; print(analysis_region._previous_period_window.__doc__[:50])"`
Expected: prints first 50 chars of docstring.

- [ ] **Step 3: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_region.py
git commit -m "WIP: region SQL helper + previous_period_window" -- \
    backend/python/smartbi_compat/api/analysis_region.py
```

---

## Task 6: Aggregation helpers `_aggregate_by_region` and `_aggregate_by_province`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_region.py`

- [ ] **Step 1: Append aggregation helpers**

```python
# ============================================================
# Aggregation helpers — R-T8 LOCK '未分类' bucket for null/empty
# ============================================================
def _aggregate_by_region(rows: list) -> dict:
    """Mirror RegionAnalysisServiceImpl.aggregateByRegion (impl line 655-674).

    Python dict (3.7+) preserves insertion order ≡ Java LinkedHashMap.
    R-T8: null/empty region → '未分类' bucket.
    """
    aggregations: dict = {}
    for row in rows:
        region = row.get("region")
        if region is None or region == "":
            region = "未分类"
        agg = aggregations.setdefault(region, RegionAggregation())
        agg.add_sale(row)
    for agg in aggregations.values():
        agg.calculate_gross_margin()
    return aggregations


def _aggregate_by_province(rows: list) -> dict:
    """Mirror impl line 679-697. Same as _aggregate_by_region but key=province."""
    aggregations: dict = {}
    for row in rows:
        province = row.get("province")
        if province is None or province == "":
            province = "未分类"
        agg = aggregations.setdefault(province, RegionAggregation())
        agg.add_sale(row)
    for agg in aggregations.values():
        agg.calculate_gross_margin()
    return aggregations
```

- [ ] **Step 2: Quick smoke**

Run: `python -c "from smartbi_compat.api.analysis_region import _aggregate_by_region; r = _aggregate_by_region([{'region': '华东', 'amount': 100}]); print(list(r.keys()))"`
Expected: `['华东']`.

- [ ] **Step 3: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_region.py
git commit -m "WIP: region aggregation helpers" -- \
    backend/python/smartbi_compat/api/analysis_region.py
```

---

## Task 7: Score helpers (R-T1 / R-T2 / R-T3 / R-T4 LOCK) + opportunity level

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_region.py`

- [ ] **Step 1: Append 5 score helpers**

```python
# ============================================================
# Score helpers — R-T1, R-T2, R-T3, R-T4 LOCK
# ============================================================
def _calculate_growth_score(current: Decimal, previous: Decimal) -> Decimal:
    """Mirror impl line 1025-1030. R-T4 LOCK.

    growthRate = calculateMomGrowth(curr, prev), then score = growthRate + 50,
    clamp [0, 100]. Boundary: growth = +50 → 100, growth = -50 → 0.
    """
    growth_rate = _calculate_mom_growth(current, previous)
    score = growth_rate + Decimal("50")
    return max(Decimal("0"), min(Decimal("100"), score))


def _calculate_base_score(region_sales: Decimal, total_sales: Decimal) -> Decimal:
    """Mirror impl line 1035-1042. R-T3 LOCK.

    ratio = (region/total).quantize(4) * 100, score = ratio * 3, .min(100).
    33.33% → 99.99 (NOT 100); 33.34%+ caps at 100.
    """
    if total_sales == Decimal("0"):
        return Decimal("0")
    ratio = (region_sales / total_sales).quantize(
        Decimal("0.0001"), ROUND_HALF_UP
    ) * Decimal("100")
    return min(Decimal("100"), ratio * Decimal("3"))


def _calculate_margin_score(gross_margin) -> Decimal:
    """Mirror impl line 1047-1053. R-T2 LOCK.

    grossMargin already × 100 (percentage units, see RegionAggregation).
    score = grossMargin * Decimal("3.33") EXACT (NOT float 3.33), clamp [0, 100].
    30% margin → score = 99.9 (NOT 100).
    """
    if gross_margin is None:
        return Decimal("0")
    score = gross_margin * Decimal("3.33")
    return max(Decimal("0"), min(Decimal("100"), score))


def _calculate_penetration_score(customer_count: int, order_count: int) -> Decimal:
    """Mirror impl line 1058-1062. R-T1 LOCK — INTEGER DIVISION.

    Java: customerCount * 10 + orderCount / 10 (Java int / int = floor div).
    Python naive port with `/` would do float division.
    Use Python `//` (floor div). int() coerce defensively against str/Decimal
    DB driver outputs.
    """
    score_int = int(customer_count) * 10 + int(order_count) // 10
    return min(Decimal("100"), Decimal(score_int))


def _calculate_total_score(g, b, m, p) -> Decimal:
    """Mirror RegionOpportunityScore.calculateTotalScore (DTO line 134-145).

    Weights: g*0.30 + b*0.25 + m*0.25 + p*0.20. Sum=1.00.
    Rule 1: explicit `is not None` for None-guard.
    """
    g = g if g is not None else Decimal("0")
    b = b if b is not None else Decimal("0")
    m = m if m is not None else Decimal("0")
    p = p if p is not None else Decimal("0")
    return (
        g * Decimal("0.30")
        + b * Decimal("0.25")
        + m * Decimal("0.25")
        + p * Decimal("0.20")
    )


def _determine_opportunity_level(total_score) -> str:
    """Mirror RegionOpportunityScore.determineOpportunityLevel (DTO line 99-111).

    score >= 70 → HIGH, 40 <= score < 70 → MEDIUM, score < 40 → LOW. None → LOW.
    """
    if total_score is None:
        return "LOW"
    if total_score >= Decimal("70"):
        return "HIGH"
    if total_score >= Decimal("40"):
        return "MEDIUM"
    return "LOW"
```

- [ ] **Step 2: Quick R-T1 boundary smoke (CRITICAL)**

Run:
```bash
python -c "from smartbi_compat.api.analysis_region import _calculate_penetration_score; from decimal import Decimal; assert _calculate_penetration_score(5, 99) == Decimal('59'), 'R-T1 broken'; print('R-T1 OK: 5*10 + 99//10 = 59')"
```
Expected: `R-T1 OK: 5*10 + 99//10 = 59` — confirms floor div. If you see 59.9, the helper used `/` instead of `//`.

- [ ] **Step 3: Quick R-T3 boundary smoke**

Run:
```bash
python -c "from smartbi_compat.api.analysis_region import _calculate_base_score; from decimal import Decimal; r = _calculate_base_score(Decimal('33.33'), Decimal('100')); print(f'33.33%% base_score = {r} (expected 99.99)')"
```
Expected: `99.99` (NOT 100).

- [ ] **Step 4: Quick R-T2 boundary smoke**

Run:
```bash
python -c "from smartbi_compat.api.analysis_region import _calculate_margin_score; from decimal import Decimal; r = _calculate_margin_score(Decimal('30')); print(f'30%% margin_score = {r} (expected 99.9)')"
```
Expected: `99.90` (NOT 100).

- [ ] **Step 5: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_region.py
git commit -m "WIP: region score helpers (R-T1/T2/T3/T4 locks)" -- \
    backend/python/smartbi_compat/api/analysis_region.py
```

---

## Task 8: Heatmap helpers (R-T7 / R-T9 LOCK)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_region.py`

- [ ] **Step 1: Append heatmap helpers**

```python
# ============================================================
# Heatmap helpers — R-T7 LOCK regex order, R-T9 LOCK Decimal compare
# ============================================================
# R-T7 LOCK: ORDER MATTERS — 自治区/特别行政区 BEFORE 壮族/回族/维吾尔
# Java line 1144-1150 sequential .replaceAll on regex anchored at end ($).
_PROVINCE_NORMALIZE_PATTERNS = [
    (re.compile(r"省$"), ""),
    (re.compile(r"市$"), ""),
    (re.compile(r"自治区$"), ""),
    (re.compile(r"特别行政区$"), ""),
    (re.compile(r"壮族$"), ""),
    (re.compile(r"回族$"), ""),
    (re.compile(r"维吾尔$"), ""),
]


def _normalize_province_name(province) -> str:
    """Mirror impl line 1138-1151. R-T7 LOCK — sequential regex application.

    Examples:
      "广西壮族自治区" → 自治区 first → "广西壮族" → 壮族 next → "广西"
      "新疆维吾尔自治区" → "新疆"
      "宁夏回族自治区" → "宁夏"
      "北京市" → "北京"
      "香港特别行政区" → "香港"
      None → "未知"
    """
    if province is None:
        return "未知"
    p = province
    for pattern, replacement in _PROVINCE_NORMALIZE_PATTERNS:
        p = pattern.sub(replacement, p)
    return p


def _determine_color_level(heat_value) -> str:
    """Mirror impl line 1156-1168. R-T9 LOCK — Decimal compare (Rule 7).

    heat_value >= 0.7 → HIGH, >= 0.3 → MEDIUM, else LOW. None → LOW.
    """
    if heat_value is None:
        return "LOW"
    if heat_value >= _HEATMAP_HIGH:
        return "HIGH"
    if heat_value >= _HEATMAP_MEDIUM:
        return "MEDIUM"
    return "LOW"
```

- [ ] **Step 2: Smoke test R-T7 ordering**

Run:
```bash
python -c "from smartbi_compat.api.analysis_region import _normalize_province_name; print(_normalize_province_name('广西壮族自治区'))"
```
Expected: `广西` (NOT `广西壮族`). If you see `广西壮族`, regex order is wrong.

- [ ] **Step 3: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_region.py
git commit -m "WIP: region heatmap helpers (R-T7/T9 locks)" -- \
    backend/python/smartbi_compat/api/analysis_region.py
```

---

## Task 9: Alerting + formatting helpers (R-T13 LOCK on `_calculate_completion_rate`)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_region.py`

**CRITICAL R-T13:** `_calculate_completion_rate` MUST be defined locally in this module. Do NOT import from `analysis_sales` — sales/department use different arithmetic order producing different bytes on non-round inputs.

- [ ] **Step 1: Append 5 alerting/formatting helpers**

```python
# ============================================================
# Alerting + formatting helpers — R-T13 LOCK on _calculate_completion_rate
# ============================================================
def _calculate_completion_rate(
    actual: Decimal, target: Optional[Decimal]
) -> Decimal:
    """Mirror RegionAnalysisServiceImpl.java:756-761 EXACTLY.

    Java: actual.divide(target, SCALE=4, HALF_UP).multiply(BigDecimal("100"))
    Order: divide-then-quantize-then-multiply (NOT department's divide-multiply-quantize).

    R-T13 LOCK: DO NOT import analysis_sales._calculate_completion_rate — that
    helper uses sales-Java order `(actual/target*100).quantize(4)` which produces
    different bytes on non-round inputs:
      actual=33.333, target=9.7:
        Region (this fn):  (33.333/9.7).quantize(4) * 100 = 3.4364 * 100 = 343.6400
        Sales/department:  (33.333 * 100 / 9.7).quantize(4) = 343.6392

    target None or 0 → returns Decimal("0") (Java line 757-759 short-circuit).
    """
    if target is None or target == Decimal("0"):
        return Decimal("0")
    return (actual / target).quantize(
        Decimal("0.0001"), ROUND_HALF_UP
    ) * Decimal("100")


def _determine_target_completion_alert(rate) -> str:
    """Mirror MetricCalculatorServiceImpl line 449-461 TARGET_COMPLETION case.

    Java impl:
      value == null  → YELLOW
      v < 60         → RED
      60 <= v < 85   → YELLOW
      v >= 85        → GREEN

    Inline 60/85 NOT alert_thresholds.py 80 — Java line 459-461 uses 60/85.
    """
    if rate is None:
        return "YELLOW"
    if rate < _REGION_TARGET_COMPLETION_RED:
        return "RED"
    if rate < _REGION_TARGET_COMPLETION_YELLOW:
        return "YELLOW"
    return "GREEN"


def _determine_direction(value, baseline) -> str:
    """Mirror impl line 1121-1133. None or any-arg-None → STABLE.

    value > baseline → UP, < → DOWN, == → STABLE.
    """
    if value is None or baseline is None:
        return "STABLE"
    if value > baseline:
        return "UP"
    if value < baseline:
        return "DOWN"
    return "STABLE"


def _format_amount(amount) -> str:
    """Mirror impl line 1111-1116.

    Java: String.format("%,.2f", amount.doubleValue()) — JVM Locale-dependent.
    Production Linux JVM = en_US → comma thousand separator → matches Python f-string.
    None → "0.00".
    """
    if amount is None:
        return "0.00"
    return f"{amount:,.2f}"


def _generate_opportunity_recommendation(
    region: str,
    total_score: Decimal,
    growth_score: Decimal,
    base_score: Decimal,
    margin_score: Decimal,
    penetration_score: Decimal,
) -> str:
    """Mirror generateOpportunityRecommendation (impl line 1067-1106).

    Templated Chinese based on level + max/min dim. LinkedHashMap insertion order
    决定 max/min tie-break (first-seen-wins).
    """
    level = _determine_opportunity_level(total_score)
    parts = []
    if level == "HIGH":
        parts.append(f"{region}是高潜力区域，")
    elif level == "MEDIUM":
        parts.append(f"{region}具有一定发展潜力，")
    else:
        parts.append(f"{region}目前发展潜力有限，")
    # LinkedHashMap insertion order: 增长率, 销售基数, 毛利率, 市场渗透
    dims = {
        "增长率": growth_score,
        "销售基数": base_score,
        "毛利率": margin_score,
        "市场渗透": penetration_score,
    }
    strongest = max(dims, key=dims.get)
    weakest = min(dims, key=dims.get)
    parts.append(f"优势在于{strongest}，")
    parts.append(f"建议重点提升{weakest}。")
    return "".join(parts)
```

- [ ] **Step 2: R-T13 byte-divergence smoke (CRITICAL)**

Run:
```bash
python -c "from smartbi_compat.api.analysis_region import _calculate_completion_rate; from decimal import Decimal; r = _calculate_completion_rate(Decimal('33.333'), Decimal('9.7')); print(f'region completion = {r} (expected 343.6400, NOT 343.6392)')"
```
Expected: `343.6400`. If you see `343.6392`, you accidentally imported sales' helper.

Also confirm sales' helper diverges:
```bash
python -c "from smartbi_compat.api.analysis_sales import _calculate_completion_rate; from decimal import Decimal; r = _calculate_completion_rate(Decimal('33.333'), Decimal('9.7')); print(f'sales completion = {r} (expected 343.6392, divergence proven)')"
```
Expected: `343.6392` — confirms two helpers must coexist.

- [ ] **Step 3: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_region.py
git commit -m "WIP: region alerting/formatting helpers (R-T13 lock — local _calculate_completion_rate)" -- \
    backend/python/smartbi_compat/api/analysis_region.py
```

---

## Task 10: Sub-services (4 builders) — dict literal key order from goldens

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_region.py`

**Use the orderings derived in Task 3** to write dict literals. The orderings below are SPEC-DEFAULT (Lombok @Data declaration) — verify against goldens and adjust if Lombok actually emits a different order.

- [ ] **Step 1: Append `_build_region_ranking`**

```python
# ============================================================
# Sub-service 1: ranking — Java line 54-94
# ============================================================
def _build_region_ranking(rows: list) -> list:
    """Mirror getRegionRanking. Empty rows → []. Sort by total_amount desc.

    Key order from RankingItem Lombok @Data: rank, name, value, target,
    completionRate, alertLevel. VERIFY VIA GOLDEN — replace with golden-derived
    order if different.
    """
    if not rows:
        return []
    aggregations = _aggregate_by_region(rows)
    sorted_entries = sorted(
        aggregations.items(),
        key=lambda kv: kv[1].total_amount,
        reverse=True,
    )
    rankings: list = []
    for rank, (region, agg) in enumerate(sorted_entries, start=1):
        completion_rate = _calculate_completion_rate(agg.total_amount, agg.total_target)
        alert_level = _determine_target_completion_alert(completion_rate)
        rankings.append({
            "rank": rank,
            "name": region,
            "value": _decimal_to_number(
                agg.total_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "target": _decimal_to_number(
                agg.total_target.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "completionRate": _decimal_to_number(
                completion_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "alertLevel": alert_level,
        })
    return rankings
```

- [ ] **Step 2: Append `_build_region_target_completion`**

```python
# ============================================================
# Sub-service 2: targetCompletion — Java line 269-314
# ============================================================
def _build_region_target_completion(rows: list) -> list:
    """Mirror getRegionTargetCompletion. Returns MetricResult, NOT RankingItem.

    metric_code = "REGION_TARGET_" + region (literal prefix).
    Sort by changePercent desc.

    Key order from MetricResult Lombok @Data: metricCode, metricName, value,
    formattedValue, unit, changePercent, changeDirection, alertLevel,
    dimensionValue, description. VERIFY VIA GOLDEN.
    """
    if not rows:
        return []
    aggregations = _aggregate_by_region(rows)
    results: list = []
    for region, agg in aggregations.items():
        completion_rate = _calculate_completion_rate(agg.total_amount, agg.total_target)
        alert_level = _determine_target_completion_alert(completion_rate)
        change_direction = _determine_direction(completion_rate, Decimal("100"))
        results.append({
            "metricCode": f"REGION_TARGET_{region}",
            "metricName": f"{region} 目标完成",
            "value": _decimal_to_number(
                agg.total_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "formattedValue": _format_amount(agg.total_amount),
            "unit": "元",
            "changePercent": _decimal_to_number(
                completion_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "changeDirection": change_direction,
            "alertLevel": alert_level,
            "dimensionValue": region,
            "description": f"目标: {_format_amount(agg.total_target)}",
        })
    results.sort(key=lambda r: r["changePercent"], reverse=True)
    return results
```

- [ ] **Step 3: Append `_build_geographic_heatmap` (Map.of(N) Rule 8)**

Use the Task 3 derived orders for `options` Map.of(4) and `visualMap` Map.of(3) — REPLACE the dict literals below with golden-actual order if different. Spec defaults in source order:

```python
# ============================================================
# Sub-service 3: heatmap — Java line 318-381
# Map.of(4) options + Map.of(3) visualMap — Rule 8 KEY-ORDER-FROM-GOLDEN
# ============================================================
def _build_geographic_heatmap(rows: list) -> dict:
    """Mirror getGeographicHeatmapData. Empty rows → 3-field ChartConfig only.

    Non-empty: full ChartConfig with options (Map.of(4)) + nested visualMap (Map.of(3)).
    KEY-ORDER from golden: see Task 3 notes; spec source order shown below.
    """
    if not rows:
        # Empty case: ChartConfig with only chartType, title, data set.
        # Lombok @Data + Jackson skip-null omits xAxisField/yAxisField/options.
        return {
            "chartType": "MAP",
            "title": "销售地理分布",
            "data": [],
        }
    province_aggs = _aggregate_by_province(rows)
    max_amount = max(
        (agg.total_amount for agg in province_aggs.values()),
        default=Decimal("1"),
    )
    map_data: list = []
    for province, agg in province_aggs.items():
        if max_amount > Decimal("0"):
            heat_value = (agg.total_amount / max_amount).quantize(
                Decimal("0.0001"), ROUND_HALF_UP
            )
        else:
            heat_value = Decimal("0")
        # heatmap.data[0] LinkedHashMap order from Java line 353-360 — explicit
        # insertion: province, value, heatValue, orderCount, customerCount, colorLevel.
        map_data.append({
            "province": _normalize_province_name(province),
            "value": _decimal_to_number(
                agg.total_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "heatValue": _decimal_to_number(
                heat_value.quantize(Decimal("0.0001"), ROUND_HALF_UP)
            ),
            "orderCount": agg.order_count,
            "customerCount": agg.customer_count,
            "colorLevel": _determine_color_level(heat_value),
        })

    # Map.of(4) options — Rule 8 KEY-ORDER-FROM-GOLDEN. Source order:
    # mapType, showLabel, roam, visualMap. Replace below with golden actual.
    options = {
        "mapType": "china",
        "showLabel": True,
        "roam": True,
        "visualMap": {
            # Map.of(3) visualMap — Rule 8 KEY-ORDER-FROM-GOLDEN. Source: min, max, calculable.
            "min": 0,
            "max": _decimal_to_number(
                max_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "calculable": True,
        },
    }

    # ChartConfig top-level Lombok @Data declaration order — VERIFY VIA GOLDEN.
    return {
        "chartType": "MAP",
        "title": "销售地理分布",
        "xAxisField": "province",
        "yAxisField": "value",
        "data": map_data,
        "options": options,
    }
```

- [ ] **Step 4: Append `_build_opportunity_scores` (R-T12 key order LOCK)**

```python
# ============================================================
# Sub-service 4: opportunityScores — Java line 385-464
# R-T12 LOCK on RegionOpportunityScore Lombok @Data declaration order
# ============================================================
def _build_opportunity_scores(rows: list, prev_rows: list) -> list:
    """Mirror getRegionOpportunityScores. Empty current rows → [].

    R-T12: dict literal key order matches RegionOpportunityScore.java declaration:
    region, totalScore, growthScore, baseScore, marginScore, penetrationScore,
    recommendation, opportunityLevel, currentSales, previousSales, growthRate,
    grossMargin, customerCount. VERIFY VIA GOLDEN before merge.
    """
    if not rows:
        return []
    current_aggs = _aggregate_by_region(rows)
    previous_aggs = _aggregate_by_region(prev_rows) if prev_rows else {}
    total_current_sales = sum(
        (agg.total_amount for agg in current_aggs.values()),
        Decimal("0"),
    )
    scores: list = []
    for region, current_agg in current_aggs.items():
        previous_agg = previous_aggs.get(region)
        previous_sales = (
            previous_agg.total_amount if previous_agg is not None else Decimal("0")
        )
        growth_score = _calculate_growth_score(current_agg.total_amount, previous_sales)
        base_score = _calculate_base_score(current_agg.total_amount, total_current_sales)
        margin_score = _calculate_margin_score(current_agg.gross_margin)
        penetration_score = _calculate_penetration_score(
            current_agg.customer_count, current_agg.order_count
        )
        total_score = _calculate_total_score(
            growth_score, base_score, margin_score, penetration_score
        )
        growth_rate = _calculate_mom_growth(current_agg.total_amount, previous_sales)
        recommendation = _generate_opportunity_recommendation(
            region, total_score, growth_score, base_score,
            margin_score, penetration_score
        )
        scores.append({
            "region": region,
            "totalScore": _decimal_to_number(
                total_score.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "growthScore": _decimal_to_number(
                growth_score.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "baseScore": _decimal_to_number(
                base_score.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "marginScore": _decimal_to_number(
                margin_score.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "penetrationScore": _decimal_to_number(
                penetration_score.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "recommendation": recommendation,
            "opportunityLevel": _determine_opportunity_level(total_score),
            "currentSales": _decimal_to_number(
                current_agg.total_amount.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "previousSales": _decimal_to_number(
                previous_sales.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "growthRate": _decimal_to_number(
                growth_rate.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "grossMargin": _decimal_to_number(
                current_agg.gross_margin.quantize(Decimal("0.01"), ROUND_HALF_UP)
            ),
            "customerCount": current_agg.customer_count,
        })
    scores.sort(key=lambda s: s["totalScore"], reverse=True)
    return scores
```

- [ ] **Step 5: Verify all 4 sub-services importable**

Run:
```bash
python -c "from smartbi_compat.api.analysis_region import _build_region_ranking, _build_region_target_completion, _build_geographic_heatmap, _build_opportunity_scores; print('all 4 importable')"
```

- [ ] **Step 6: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_region.py
git commit -m "WIP: region 4 sub-service builders (R-T12 key order from spec)" -- \
    backend/python/smartbi_compat/api/analysis_region.py
```

---

## Task 11: Verify and apply golden-actual key orders to all dict literals (Rule 8 finalization)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_region.py` — adjust dict literal key order to match goldens recorded in Task 2.

This task **operationalizes Task 3 findings**. For each Map.of(N) / HashMap / Lombok @Data site, compare spec-default order (used in Tasks 4 and 10) against actual golden order. Adjust dict literal where they differ.

- [ ] **Step 1: Compare top-level 6-key HashMap order**

Already noted in Task 3 step 1. Top-level dict literal is in the dispatcher (Task 12) — note the order to use.

- [ ] **Step 2: Compare RankingItem Lombok order vs `_build_region_ranking` literal**

Run:
```bash
jq -r '(.data // .) .ranking[0] | keys_unsorted[]' tests/fixtures/java-smartbi-golden/analysis-region-F001.json > /tmp/ranking-order.txt
cat /tmp/ranking-order.txt
```
If different from `rank, name, value, target, completionRate, alertLevel`, edit `_build_region_ranking` dict literal to match golden.

- [ ] **Step 3: Compare MetricResult order**

Run:
```bash
jq -r '(.data // .) .targetCompletion[0] | keys_unsorted[]' tests/fixtures/java-smartbi-golden/analysis-region-F001.json
```
If different from spec, edit `_build_region_target_completion`.

- [ ] **Step 4: Compare RegionOpportunityScore order (R-T12)**

Run:
```bash
jq -r '(.data // .) .opportunityScores[0] | keys_unsorted[]' tests/fixtures/java-smartbi-golden/analysis-region-F001.json
```
If different, edit `_build_opportunity_scores` dict literal.

- [ ] **Step 5: Compare ChartConfig + heatmap.options + visualMap order**

Run:
```bash
jq -r '(.data // .) .heatmap | keys_unsorted[]' tests/fixtures/java-smartbi-golden/analysis-region-F001.json
jq -r '(.data // .) .heatmap.options | keys_unsorted[]' tests/fixtures/java-smartbi-golden/analysis-region-F001.json
jq -r '(.data // .) .heatmap.options.visualMap | keys_unsorted[]' tests/fixtures/java-smartbi-golden/analysis-region-F001.json
```
Edit `_build_geographic_heatmap` dict literals to match.

- [ ] **Step 6: Re-import to verify syntactic validity**

Run: `python -c "from smartbi_compat.api import analysis_region; print('OK after key-order adjustments')"`

- [ ] **Step 7: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_region.py
git commit -m "WIP: region dict literal key orders aligned with goldens (Rule 8)" -- \
    backend/python/smartbi_compat/api/analysis_region.py
```

---

## Task 12: Dispatcher + route handler

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_region.py`

- [ ] **Step 1: Append dispatcher**

Use top-level 6-key order from Task 3 step 1 (or 11 step 1) — REPLACE the dict literal below if golden order differs from spec source order.

```python
# ============================================================
# Dispatcher — Java line 593-598 ("region" case in getComprehensiveAnalysis)
# Top-level HashMap key order from F999 golden (Rule 8) — VERIFY
# ============================================================
async def _get_region_analysis(factory_id: str, range_: DateRange) -> dict:
    """Mirror SmartBIServiceImpl.getComprehensiveAnalysis 'region' case.

    DB optimization: 2 queries (current period reused across all 4 sub-services,
    previous period for opportunity scores). Java repeats the query 4×.
    Output byte-shape unaffected.

    Top-level dict order matches recorded F999 golden (HashMap hash-bucket
    order, NOT source insertion order). Source order is: ranking,
    targetCompletion, heatmap, opportunityScores, dateRange, generatedAt.
    """
    rows = await _query_region_full(factory_id, range_.start, range_.end)
    ranking = _build_region_ranking(rows)
    target_completion = _build_region_target_completion(rows)
    heatmap = _build_geographic_heatmap(rows)

    prev_start, prev_end = _previous_period_window(range_.start, range_.end)
    prev_rows = await _query_region_full(factory_id, prev_start, prev_end)
    opportunity_scores = _build_opportunity_scores(rows, prev_rows)

    # Source order — REPLACE with golden actual order if different.
    return {
        "ranking": ranking,
        "targetCompletion": target_completion,
        "heatmap": heatmap,
        "opportunityScores": opportunity_scores,
        "dateRange": _new_date_range_dict(range_),
        "generatedAt": _utc_now_iso(),
    }
```

- [ ] **Step 2: Append route handler**

```python
# ============================================================
# Route handler — Java SmartBIAnalysisController.getRegionAnalysis line 181-218
# ============================================================
@router.get("/api/mobile/{factory_id}/smart-bi/analysis/region")
async def get_region_analysis(
    factory_id: str,
    startDate: date = Query(..., alias="startDate"),
    endDate: date = Query(..., alias="endDate"),
    region: Optional[str] = None,
    auth: AuthContext = Depends(verify_jwt_and_factory),
) -> dict:
    """Java reference: SmartBIAnalysisController.getRegionAnalysis line 181-218.

    `region` query param accepted but IGNORED — Java line 192-194 short-circuits
    to getComprehensiveAnalysis when smartBIService non-null (always true in
    prod via Spring DI).

    Returns 6-key composite Map wrapped in standard envelope.
    """
    range_ = DateRange.custom(startDate, endDate)
    result = await _get_region_analysis(auth.factory_id, range_)
    return wrap_response(result)
```

- [ ] **Step 3: Verify import end-to-end**

Run:
```bash
python -c "from smartbi_compat.api.analysis_region import router, _get_region_analysis; print(f'router routes: {len(router.routes)}')"
```
Expected: `router routes: 1`.

- [ ] **Step 4: Commit**

```bash
git add backend/python/smartbi_compat/api/analysis_region.py
git commit -m "WIP: region dispatcher + route handler" -- \
    backend/python/smartbi_compat/api/analysis_region.py
```

---

## Task 13: Wire `analysis_region` router into `main.py` (2 lines)

**Files:**
- Modify: `backend/python/main.py` lines 1106-1128 block

- [ ] **Step 1: Read current block**

Run: `cat backend/python/main.py | sed -n '1106,1128p'`
Expected: existing imports for `analysis as smartbi_compat_analysis`, `upload`, `dashboard`, `analysis_sales`, `analysis_finance`, `datasource`, `incentive_plan`, `query_templates_write`.

- [ ] **Step 2: Add import line**

Use Edit tool to insert `from smartbi_compat.api import analysis_region` after the `from smartbi_compat.api import analysis_finance` line (around line 1112).

- [ ] **Step 3: Add `include_router` line**

Insert `app.include_router(analysis_region.router, tags=["SmartBI Compat: Analysis Region"])` after the `app.include_router(analysis_finance.router, tags=["SmartBI Compat: Analysis Finance"])` line (around line 1117).

- [ ] **Step 4: Verify file imports cleanly**

Run: `cd backend/python && python -c "import importlib.util; spec = importlib.util.spec_from_file_location('main', 'main.py'); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); print(f'app routes count: {len(m.app.routes)}')"`
Expected: a route count higher than baseline; importantly no ImportError.

- [ ] **Step 5: Confirm route is registered**

Run: `cd backend/python && python -c "import importlib.util; spec = importlib.util.spec_from_file_location('main', 'main.py'); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); paths = [r.path for r in m.app.routes if hasattr(r, 'path')]; print([p for p in paths if 'analysis/region' in p])"`
Expected: `['/api/mobile/{factory_id}/smart-bi/analysis/region']`.

- [ ] **Step 6: Commit**

```bash
git add backend/python/main.py
git status --short
git commit -m "feat(phase2a): wire analysis_region router (2 lines)" -- \
    backend/python/main.py
```

---

## Task 14: Contract tests — F999 + F001 dict-eq gate + JWT/empty-data tests

**Files:**
- Create: `tests/python/smartbi_compat/test_analysis_region_contract.py`

- [ ] **Step 1: Write the test file boilerplate**

Mirror `tests/python/smartbi_compat/test_analysis_finance_contract.py` lines 1-91 — JWT_SECRET, _load_production_main, _make_token, _strip_volatile, fixtures.

```python
"""Byte-shape contract gate for /analysis/region composite path.

Java reference:
  - Controller: SmartBIAnalysisController.getRegionAnalysis line 181-218
  - Composite dispatcher: SmartBIServiceImpl.getComprehensiveAnalysis line 593-598

Mirrors test_analysis_finance_contract.py / test_analysis_sales_contract.py pattern:
  - JWT_SECRET set in os.environ BEFORE importing production code
  - Load production main via importlib (full middleware stack)
  - Hit /api/mobile/{factory_id}/smart-bi/analysis/region via TestClient
  - Compare response['data'] to recorded golden['data'] (dict-eq, generatedAt stripped)
"""
from __future__ import annotations

import importlib.util
import io
import json
import os
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

import jwt
import pytest


JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET


REPO_ROOT = Path(__file__).resolve().parents[3]
GOLDEN_DIR = REPO_ROOT / "tests" / "fixtures" / "java-smartbi-golden"


def _load_production_main():
    main_path = REPO_ROOT / "backend" / "python" / "main.py"
    sys.path.insert(0, str(REPO_ROOT / "backend" / "python"))
    spec = importlib.util.spec_from_file_location("_production_main", main_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _make_token(factory_id: str) -> str:
    payload = {
        "userId": 1,
        "username": "test_user",
        "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": datetime.now(timezone.utc).timestamp() + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


VOLATILE = frozenset({"generatedAt", "lastUpdated", "cacheExpireAt", "timestamp"})


def _strip_volatile(obj):
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in VOLATILE}
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj


@pytest.fixture(scope="module")
def production_app():
    return _load_production_main().app


@pytest.fixture
def client(production_app):
    from fastapi.testclient import TestClient
    return TestClient(production_app)
```

- [ ] **Step 2: Add `TestRouteHandler` class — route-registered + JWT/factory-mismatch tests**

```python
class TestRouteHandler:
    """Verify FastAPI router registers and JWT auth gates the endpoint."""

    def test_route_registered(self, production_app):
        paths = [r.path for r in production_app.routes if hasattr(r, "path")]
        assert "/api/mobile/{factory_id}/smart-bi/analysis/region" in paths

    def test_jwt_required_returns_401_or_403_without_token(self, client):
        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/region"
            "?startDate=2024-01-01&endDate=2024-12-31"
        )
        assert resp.status_code in (401, 403), f"got {resp.status_code}"

    def test_factory_mismatch_returns_403(self, client):
        # JWT for F001 but path F999 — verify_jwt_and_factory should reject
        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/region"
            "?startDate=2024-01-01&endDate=2024-12-31",
            headers={"Authorization": f"Bearer {_make_token('F001')}"},
        )
        assert resp.status_code == 403, f"got {resp.status_code}: {resp.text[:200]}"

    def test_region_query_param_accepted_but_ignored(self, client, monkeypatch):
        """region=华东 vs no region → identical response (Java line 192-194 short-circuit)."""
        from smartbi_compat.api import analysis_region

        async def fake_query(factory_id, start, end):
            return []
        monkeypatch.setattr(analysis_region, "_query_region_full", fake_query)

        url_with = ("/api/mobile/F999/smart-bi/analysis/region"
                    "?startDate=2024-01-01&endDate=2024-12-31&region=华东")
        url_without = ("/api/mobile/F999/smart-bi/analysis/region"
                       "?startDate=2024-01-01&endDate=2024-12-31")
        headers = {"Authorization": f"Bearer {_make_token('F999')}"}
        r1 = client.get(url_with, headers=headers)
        r2 = client.get(url_without, headers=headers)
        assert r1.status_code == 200 and r2.status_code == 200
        assert _strip_volatile(r1.json()) == _strip_volatile(r2.json())
```

- [ ] **Step 3: Add `TestEmptyData` — verify shape on empty rows**

```python
class TestEmptyData:
    """Empty rows → all sub-services return their empty shapes."""

    def test_empty_rows_returns_empty_lists_and_3_field_heatmap(self, client, monkeypatch):
        from smartbi_compat.api import analysis_region

        async def fake_query(factory_id, start, end):
            return []
        monkeypatch.setattr(analysis_region, "_query_region_full", fake_query)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/region"
            "?startDate=2024-01-01&endDate=2024-12-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["ranking"] == []
        assert data["targetCompletion"] == []
        assert data["opportunityScores"] == []
        # Heatmap empty case: only 3 fields per spec §3.9
        assert data["heatmap"]["chartType"] == "MAP"
        assert data["heatmap"]["title"] == "销售地理分布"
        assert data["heatmap"]["data"] == []
        assert "options" not in data["heatmap"], "empty heatmap should omit options"
        assert "xAxisField" not in data["heatmap"], "empty heatmap should omit xAxisField"

    def test_envelope_6_keys_present(self, client, monkeypatch):
        from smartbi_compat.api import analysis_region

        async def fake_query(factory_id, start, end):
            return []
        monkeypatch.setattr(analysis_region, "_query_region_full", fake_query)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/region"
            "?startDate=2024-01-01&endDate=2024-12-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert set(data.keys()) == {
            "ranking", "targetCompletion", "heatmap",
            "opportunityScores", "dateRange", "generatedAt",
        }
```

- [ ] **Step 4: Add `TestF999Golden` — F999 dict-eq gate (empty data path)**

```python
class TestF999Golden:
    """F999 byte-shape gate via dict-eq (empty data path)."""

    def test_f999_byte_shape_dict_eq(self, client, monkeypatch):
        from smartbi_compat.api import analysis_region

        # F999 has no sales data — fake empty rows for both current + previous
        async def fake_query(factory_id, start, end):
            return []
        monkeypatch.setattr(analysis_region, "_query_region_full", fake_query)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/region"
            "?startDate=2024-01-01&endDate=2024-12-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200
        py_data = _strip_volatile(resp.json()["data"])

        with io.open(GOLDEN_DIR / "analysis-region-F999.json", encoding="utf-8") as f:
            raw = json.load(f)
            # Golden may be wrapped in {success, data, message} envelope or raw.
            golden_data = _strip_volatile(raw.get("data", raw))

        if py_data != golden_data:
            import difflib
            py_str = json.dumps(py_data, ensure_ascii=False, indent=2, sort_keys=True)
            golden_str = json.dumps(golden_data, ensure_ascii=False, indent=2, sort_keys=True)
            diff = "\n".join(difflib.unified_diff(
                golden_str.splitlines(), py_str.splitlines(),
                fromfile="golden", tofile="python", lineterm="", n=3,
            ))
            pytest.fail(f"F999 byte-shape mismatch:\n{diff}")
```

- [ ] **Step 5: Add `TestF001Golden` — manual smoke (skipped in CI)**

```python
class TestF001Golden:
    """F001 manual smoke against real Java backend (run by hand).

    Run with:
      pytest -v tests/python/smartbi_compat/test_analysis_region_contract.py::TestF001Golden::test_f001_manual_smoke
    """

    @pytest.mark.skip(reason="manual smoke against Java backend — run by hand")
    def test_f001_manual_smoke(self, client):
        resp = client.get(
            "/api/mobile/F001/smart-bi/analysis/region"
            "?startDate=2024-01-01&endDate=2024-12-31",
            headers={"Authorization": f"Bearer {_make_token('F001')}"},
        )
        assert resp.status_code == 200
        py_data = _strip_volatile(resp.json()["data"])

        with io.open(GOLDEN_DIR / "analysis-region-F001.json", encoding="utf-8") as f:
            raw = json.load(f)
            golden_data = _strip_volatile(raw.get("data", raw))

        assert py_data == golden_data, "F001 byte-shape mismatch — re-record golden if Java logic changed"
```

- [ ] **Step 6: Run pytest locally**

Run: `cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_region_contract.py -v`
Expected: TestRouteHandler 4 tests pass, TestEmptyData 2 tests pass, TestF999Golden 1 test passes, TestF001Golden skipped → 7 passed, 1 skipped.

If F999 dict-eq fails, the diff output will pinpoint the divergence. Common fixes:
- Key order mismatch (a key present in both but ordered differently) — go back to Task 11 and re-derive from golden.
- Extra/missing keys (e.g., empty heatmap has `options` when it shouldn't, or vice versa) — verify Java source vs spec §3.9 empty-case.
- Numeric divergence (e.g., `0` vs `0.00` strings) — verify `_decimal_to_number` is applied to all Decimal outputs.

- [ ] **Step 7: Commit tests**

```bash
git add tests/python/smartbi_compat/test_analysis_region_contract.py
git commit -m "WIP: region contract tests (F999 dict-eq + JWT/empty/route)" -- \
    tests/python/smartbi_compat/test_analysis_region_contract.py
```

---

## Task 15: Test env deploy + F001 smoke compare

**Files:** None — operational deploy + smoke-only step.

- [ ] **Step 1: Deploy Python service to test env (10084)**

Run: `./scripts/deploy/deploy-smartbi-python.sh --env test`
Expected: Python service restarted on port 8084 with new code.

- [ ] **Step 2: Health check test env Python**

Run: `curl -s http://47.100.235.168:8084/health`
Expected: 200 OK with health JSON.

- [ ] **Step 3: Hit Python endpoint with F001 JWT**

```bash
JWT_SECRET="$JWT_TEST" python3 -c "import jwt, time, os; print(jwt.encode({'userId':1,'username':'smoke','factoryId':'F001','role':'factory_super_admin','exp':int(time.time())+3600}, os.environ['JWT_SECRET'], algorithm='HS256'))" > /tmp/region-jwt.txt
TOKEN=$(cat /tmp/region-jwt.txt)
curl -sS -H "Authorization: Bearer $TOKEN" \
    "http://47.100.235.168:8084/api/mobile/F001/smart-bi/analysis/region?startDate=2024-01-01&endDate=2024-12-31" \
    > /tmp/region-F001-py.json
```

Note: Python service uses cretas_db / smart_bi_sales_data — same data source as Java prod, but the test env uses test JWT secret. F001 may not have data in the test DB; if this is the case, mock-only validation is the gate.

- [ ] **Step 4: Smoke compare with F001 golden**

Run:
```bash
diff <(jq 'del(.generatedAt) | .data // .' tests/fixtures/java-smartbi-golden/analysis-region-F001.json) \
     <(jq 'del(.data.generatedAt) | .data' /tmp/region-F001-py.json)
```
Expected: empty diff (only generatedAt should differ between recordings).

If diff is non-empty:
- Numeric diffs (e.g., `0.00` vs `0`) are likely Rule 4 issues — verify `_decimal_to_number` applied.
- Key order diffs are Rule 8 issues — re-record goldens (Java logic may have changed since Task 2 record).
- Missing/extra fields are spec divergences — investigate Java source.

- [ ] **Step 5: Document any blocker findings**

If smoke compare reveals issues that can't be fixed in this PR (e.g., Locale-dependent formatAmount on test env), document in commit message and continue. Otherwise iterate Task 11 + Task 14 fixes.

---

## Task 16: Final cleanup, push, and open PR

**Files:** None — git/PR ops only.

- [ ] **Step 1: Squash WIP commits into a single ship commit**

Run: `git log --oneline origin/main..HEAD`
Expected: ~13 WIP commits.

Run interactive rebase to squash all into one:
```bash
git rebase -i origin/main
```
In the editor, change all commits except the first to `squash`. Save and exit. In the second editor, write the final commit message:
```
Phase 2A: /analysis/region per-type real impl (PR-A)

Composite path port from Java RegionAnalysisServiceImpl to Python.
Sub-services: ranking, targetCompletion, geographicHeatmap, opportunityScores.

13 R-T traps locked per spec docs/superpowers/specs/2026-05-01-phase2a-analysis-region-design.md §8.1:
- R-T1: penetration_score INTEGER division (// not /)
- R-T2: margin_score Decimal("3.33") exact (NOT float)
- R-T3: base_score 33.33% → 99.99 (NOT 100)
- R-T4: growth_score = MoM + 50, clamp [0,100]
- R-T5: previous_period_window adjacent mirrored span
- R-T6: customer_count = len(customers) sync incremental
- R-T7: 7-step regex order (自治区 BEFORE 壮族/回族/维吾尔)
- R-T8: '未分类' bucket for null/empty region or province
- R-T9: heatmap colorLevel Decimal compare (Rule 7)
- R-T11: gross_margin stays Decimal("0") on amount=0
- R-T12: RegionOpportunityScore Lombok @Data declaration order from golden
- R-T13: _calculate_completion_rate LOCAL (NOT imported from analysis_sales)
- Map.of(N) Jackson hash orders from F999/F001 goldens (Rule 8)

Files:
- backend/python/smartbi_compat/api/analysis_region.py (new, ~600 LOC)
- backend/python/main.py (+2 lines: import + include_router)
- tests/python/smartbi_compat/test_analysis_region_contract.py (new, ~150 LOC)
- tests/fixtures/java-smartbi-golden/analysis-region-F999.json (recorded)
- tests/fixtures/java-smartbi-golden/analysis-region-F001.json (recorded)
```

- [ ] **Step 2: Verify final state**

Run:
```bash
git log --oneline origin/main..HEAD
git diff --stat origin/main..HEAD
```
Expected: 1 commit, 5 files changed.

- [ ] **Step 3: Push branch**

Run: `git push -u origin phase2a/region-impl`
Expected: branch pushed, PR URL printed.

- [ ] **Step 4: Open PR**

Run:
```bash
gh pr create --base main --head phase2a/region-impl \
  --title "Phase 2A: /analysis/region per-type real impl (PR-A)" \
  --body "$(cat <<'EOF'
## Summary
- Port Java `RegionAnalysisServiceImpl` composite path (4 sub-services) to Python
- 13 R-T traps locked per spec §8.1 — see commit message
- F999 + F001 goldens recorded; F999 dict-eq gate passes; F001 manual smoke pending real-data deploy

## Test plan
- [x] Local pytest passes (TestRouteHandler 4 + TestEmptyData 2 + TestF999Golden 1 = 7 passed, 1 skipped)
- [x] R-T1 boundary smoke: `_calculate_penetration_score(5, 99) == 59`
- [x] R-T2 boundary smoke: 30% margin → 99.9
- [x] R-T3 boundary smoke: 33.33% → 99.99
- [x] R-T7 regex order: 广西壮族自治区 → 广西
- [x] R-T13 byte divergence proven: region (343.6400) != sales (343.6392)
- [x] F999 dict-eq pass after recording goldens
- [ ] Test env deploy + F001 smoke compare (Task 15) — to be confirmed before merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Print PR URL**

Run: `gh pr view --json url --jq .url`
Expected: PR URL printed for user to review.

---

## 并行工作建议

### Subagent: ✅
任务可分派给独立 subagent 执行 (适合 subagent-driven-development pattern):
- Tasks 4-12 是连续 file edit + smoke 验证, subagent 适合一次执行一个 task 然后 main session review。
- Task 2 (record goldens) 和 Task 14 (test write) 可独立 subagent。
- Task 11 (key-order alignment) 必须在 Task 10 之后。

### 多Chat: ❌
本 PR 100% 修改 `analysis_region.py` (新文件) + `main.py` (2 行). 跟其他 sister chat (department, procurement, inventory impl) **不冲突** (各自独立模块), **但本 chat 内部** 不能再分多个 chat 写同一个 `analysis_region.py` — 会触发 concurrent-edit-safety.md 规则 1/2 (worktree 已隔离, 但同 worktree 内部不要并行 edit 同一文件).

后续 sister chat (`phase2a/department-impl`, `phase2a/procurement-impl`, `phase2a/inventory-impl`) 可独立运行 — 不动 `analysis_region.py`, 各自动 `analysis_department.py` 等不同模块。

---

**Plan end. Total: 16 tasks. Estimated: 8-10h impl + smoke. After Task 16, PR awaits review + merge.**
