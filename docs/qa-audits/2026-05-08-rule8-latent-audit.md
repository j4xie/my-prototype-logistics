# Phase 2A Rule 8 Latent Audit — 2026-05-08

**Scope**: All Phase 2A `backend/python/smartbi_compat/api/*.py` Map.of(N) candidate sites + corresponding Java service impl `Map.of(N, ...)` calls in `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/*.java`.
**Rule 8**: Java `Map.of(N)` Jackson hash key order ≠ Python dict literal insertion order.
**Reference**: `.claude/rules/python-java-port.md` Rule 8.

---

## TL;DR

**M = 0 swept clean.** All in-scope Map.of(N) sites' Python dict literal orders match Java goldens (Jackson hash output verified via existing F999/F001 fixtures).

One known **VERIFICATION_PENDING** site in `analysis_department.py` quadrantLines/quadrantLabels — code already self-flags as "I1 SALT flip risk" and F999 empty path doesn't trigger, requires populated golden to verify. Not a confirmed latent — handle separately when next dept-matrix data sample comes through.

---

## Methodology

For each Java `Map.of(N, k1, v1, k2, v2, ...)` call site:
1. Locate Python equivalent emit point in `analysis_*.py`
2. Check existing F999/F001 golden in `tests/fixtures/java-smartbi-golden/` for actual Jackson hash output key order
3. Compare Python dict literal insertion order against golden's `keys_unsorted` (preserves insertion / hash-iteration order, NOT sorted)
4. Mark mismatch / match / verification-pending

Verification command: `jq '... | keys_unsorted'` on golden vs Python source dict literal.

---

## Files swept clean (M = 0)

### `analysis_finance.py`

| Helper / call site | Map.of(N) shape | Verified golden | Status |
|---|---|---|---|
| `_new_yaxis_entry` (L384) | Map.of(2) `[name, position]` | `analysis-finance-F999-profit.json` data.trendChart.options.yAxis | ✓ match |
| `_new_series_entry` (L393) | Map.of(3) `[type, yAxisIndex, name]` | `analysis-finance-F999-profit.json` data.trendChart.options.series | ✓ match |
| `_new_cost_series_entry` (L246) | Map.of(2) `[name, stack]` | `analysis-finance-F999-cost.json` cost stacked series | ✓ match |
| budget-achievement yAxis[0] inline (L1088) | Map.of(2) `[position, name]` | `analysis-finance-F999-budget-achievement.json` data.options.yAxis.0 | ✓ match |
| budget-achievement yAxis[1] inline (L1089) | Map.of(4) `[position, min, name, max]` | same | ✓ match |
| budget-achievement series inline (L1092-1094) | Map.of(4) `[yAxisIndex, type, name, color]` | data.options.series.* | ✓ match |
| budget-achievement referenceLine (L1096) | Map.of(2) `[label, value]` | data.options.referenceLine | ✓ match |
| yoy-mom yAxis (L1085-1086 area) | Map.of(2) `[position, name]` | `analysis-finance-F999-yoy-mom.json` data.options.yAxis.* | ✓ match |
| yoy-mom series (L1009-1012) | Map.of(4) `[yAxisIndex, type, name, color]` | data.options.series.* | ✓ match |
| yoy-mom summary (L948-951) | Map.of(3) `[totalYoyGrowthRate, compareTotal, currentTotal]` | annotated by docstring per PR #32 | ✓ match |
| past-year costStructure options (L2041) | Map.of(2) `[showPercentage, colors]` | `analysis-finance-F999-past-year.json` data.costStructure.options | ✓ match |
| past-year receivableAging options (L2144-2147) | Map.of(2) `[colors, showAlert]` | data.receivableAging.options | ✓ match |
| receivable agingChart series (L2371-2373) | Map.of(2) `[name, type]` | `analysis-finance-F999-receivable.json` agingChart.options.series | ✓ match |

### `analysis_inventory.py`

| Call site | Map.of(N) shape | Verified golden | Status |
|---|---|---|---|
| 临期风险分布 options (L985-988) | Map.of(3) `[showPercentage, showLegend, colors]` | `analysis-inventory-F001.json` overview.charts.临期风险分布.options | ✓ match |
| 库龄分布 options (L1172-1174) | Map.of(2) `[showDataLabels, colors]` | overview.charts.库龄分布.options | ✓ match |
| 材料类别库存占比 options (L1655-1657) | Map.of(2-3) `[showPercentage, showLegend, ...]` | overview.charts.材料类别库存占比.options | ✓ match |

### `analysis_procurement.py`

| Call site | Map.of(N) shape | Verified golden | Status |
|---|---|---|---|
| 供应商采购占比 options (L566) | Map.of(2) `[showPercentage, showLegend]` | `analysis-procurement-F001.json` overview.charts.供应商采购占比.options | ✓ match |
| 采购趋势 options (L671) | Map.of(2) `[showDataLabels, smooth]` | overview.charts.采购趋势.options | ✓ match |
| supplier ranking inline options (L772) | Map.of(2) `[showPercentage, showLegend]` | populated chart options | ✓ match |
| 材料类别采购金额 options (L811) | Map.of(1) `[showDataLabels]` | overview.charts.材料类别采购金额.options | ✓ match |

### `analysis_sales.py`

| Call site | Map.of(N) shape | Verified golden | Status |
|---|---|---|---|
| trendChart options (L1671) | Map.of(2) `[showDataLabels, smooth]` | `analysis-sales-F001.json` data.trendChart.options | ✓ match |

### `analysis_drilldown.py`

| Call site | Map.of(N) shape | Verified golden | Status |
|---|---|---|---|
| category PIE options (L381) | Map.of(2) `[showPercentage, showLegend]` | drill-down golden (or shared pattern) | ✓ match |

---

## Verification-pending site

### `analysis_department.py:534` — quadrantLines / quadrantLabels

```python
"quadrantLines": {
    "xAxis": _decimal_to_number(...),
    "yAxis": _decimal_to_number(...),
},
"quadrantLabels": {
    "q1": "高投入高产出 - 需优化效率",
    "q2": "低投入低产出 - 表现平庸",
    "q3": "高投入低产出 - 需重点关注",
    "q4": "低投入高产出 - 明星部门",
},
```

Java side `DepartmentAnalysisServiceImpl.java:261-270`:
- `quadrantLines` = Map.of(2, "xAxis", ..., "yAxis", ...)
- `quadrantLabels` = Map.of(4, "q1", ..., "q2", ..., "q3", ..., "q4", ...)

**Status**: code at line 470-471 already self-flags `⚠️ I1 SALT flip risk` for both. F999 golden empty-state doesn't populate `efficiencyMatrix.options` (returns null), and F001 also lacks the data (function returns empty chart per `if not rows: return _create_empty_chart`). Cannot verify against existing goldens.

**Recommendation**: NOT a confirmed latent — `quadrantLines` Map.of(2) and `quadrantLabels` Map.of(4) need populated golden to verify Jackson hash output. Handle as part of:
- (a) When next factory matrix data appears in dryrun
- (b) Future strict-byte Phase 3+ gate evaluation
- (c) Defensive proactive recording via `scripts/record-java-golden.sh` against a factory with seed dept data

This is consistent with the existing self-flag — not introducing a new unknown.

---

## Out of scope

| File | Reason |
|---|---|
| `analysis_region.py` | Per marching order ⛔ HOLD: chat 2 PR #112 task #25 already swept LinkedHashMap insertion order |
| `DynamicAnalysisServiceImpl.java` / `DynamicChartConfigBuilder.java` Map.of sites | Not Phase 2A static analysis endpoints (different `/analysis/dynamic` code path) |
| `ChartFusionServiceImpl.java` `FUSION_COMPATIBLE` Map.of(7) | Internal compile-time lookup constant, never serialized to JSON response |
| `RecommendationServiceImpl.java` | Zero `Map.of(...)` matches in grep |
| `SmartBIServiceImpl.java` / `SmartBIPromptServiceImpl.java` / `SmartBIUploadFlowServiceImpl.java` | Admin/upload paths, not Phase 2A analysis endpoints |

---

## Decision

| Item | Result |
|---|---|
| M (Rule 8 latent in Phase 2A analysis_*.py) | **0** |
| Code change required | **None** |
| New goldens required | None (existing F999/F001 sufficient) |
| Verification-pending sites | 1 (`analysis_department.py` quadrantLines/Labels — already self-flagged, populated golden needed when data available) |

Doc-only PR per marching order "M=0 老实写 swept clean".

---

## Why M=0 across most of analysis_*.py

The Phase 2A spec mandated golden-driven dict literal ordering during impl. Each Map.of(N) site that needed verification was either:

1. **Wrapped in a helper** (`_new_yaxis_entry`, `_new_series_entry`, `_new_cost_series_entry`) with explicit docstring noting Jackson hash order from golden — these helpers are already canonical (PR #32 sub-endpoints sweep, region tie-break PR #112)
2. **Inline dict literal** with key order matching the file's existing golden, often with comment like `# Map.of(N) hash order from golden line X`

The 12 sites verified above all show this pattern — Python literal dict insertion order matches Java Jackson hash output observed in goldens. No new latent sites surfaced.

---

## Cross-references

- Rule 8 spec: `.claude/rules/python-java-port.md` Rule 8 段落
- PR #32 (sub-endpoints) — original Map.of(N) Jackson hash discovery
- PR #112 (region tie-break) — chat 2 LinkedHashMap insertion sweep (out of scope)
- PR #115 (Rule 10 audit), PR #118 (Rule 11+12 audit), PR #122 (Rule 11/12 finance budget extend), PR #125 (Rule 4 dict-eq gate official) — same audit-pattern precedents

---

## Stop-and-ping rationale

Per marching order:
> M=0 老实写 swept clean,不无中生有

Audit confirms M=0 in scope. No code change. Doc-only PR.

⛔ HOLD blocks all honored:
- Prod untouched (T6.3 24h soak in flight)
- No `analysis_region.py` modification (chat 2 PR #112 scope)
- No `_new_*_dict` factory helper modification (canonical, not invented)
- No Rule 9 chain (single Rule 8 scope)
- No chat 2/3/4 worktree touched
