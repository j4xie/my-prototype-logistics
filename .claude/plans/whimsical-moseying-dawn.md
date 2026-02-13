# Fix SmartBI KPI Cache Collision & Drill-Down Filter Mismatch

## Context

Browser testing of the SmartBI analysis page (47.100.235.168:8086) revealed two bugs:

1. **BUG-1 (P1)**: All 8 profit table sheets show identical KPI values (81万, 32万, 13万) despite being different regional divisions
2. **BUG-2 (P2)**: Drill-down shows "No data found" on some sheets because the filter value doesn't match any data row

## BUG-1: KPI Cache Key Collision

### Root Cause

`web-admin/src/views/smart-bi/SmartBIAnalysis.vue:1021`

```typescript
const cacheKey = `${kpiSummary.rowCount}-${kpiSummary.columnCount}-${kpiSummary.columns?.length}-${financialMetrics ? 'fm' : ''}`;
```

The cache key uses only **shape metadata** (rowCount, columnCount, columns.length). All 8 profit table sheets have 264 rows with the same column structure, so they generate the same key like `"264-12-12-fm"`. The first sheet's KPIs are cached and returned for all subsequent sheets.

### Fix

Include a content hash in the cache key. The most reliable approach: use the first few column sums (which differ per sheet) as part of the key.

**File:** `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` (line ~1021)

Change the cache key to include actual column sum values:

```typescript
const colSumsKey = kpiSummary.columns
  ?.slice(0, 4)
  .map(c => c.sum?.toFixed(2) ?? 'n')
  .join(',') || '';
const cacheKey = `${kpiSummary.rowCount}-${kpiSummary.columnCount}-${kpiSummary.columns?.length}-${colSumsKey}-${financialMetrics ? JSON.stringify(financialMetrics.revenue?.total ?? '') : ''}`;
```

This ensures each sheet with different data values produces a different cache key.

## BUG-2: Drill-Down Filter Value Mismatch

### Root Cause

Two issues compound:

1. **Frontend** (`SmartBIAnalysis.vue:2172`): `filterValue = params.name` takes the raw ECharts click value. For pie charts with multi-level Excel headers, this can be a full hierarchical string like `"销售1中心2025年各分部及区域收入&净利简表_区域>净利-上海分部"`.

2. **Backend** (`cross_analyzer.py:255`): `df[df[parent_dimension] == parent_value]` uses exact string match. If the data column has short values but the chart label has a long flattened name, no match is found.

### Fix

Add fuzzy/partial matching in the Python drill-down endpoint as a fallback when exact match fails.

**File:** `backend/python/smartbi/services/cross_analyzer.py` (line ~255)

After the exact match fails (`filtered.empty`), try:
1. Substring match: check if any cell value is contained in `parent_value` or vice versa
2. Last-segment match: split `parent_value` by common separators (`_`, `-`, `>`, `：`) and try matching the last segment

```python
# Exact match first
filtered = df[df[parent_dimension] == parent_value].copy()

# Fallback: fuzzy match if exact fails
if filtered.empty and parent_value:
    # Try last segment after common separators
    for sep in ['>', '-', '_', '：', ':']:
        if sep in str(parent_value):
            last_part = str(parent_value).rsplit(sep, 1)[-1].strip()
            if last_part:
                filtered = df[df[parent_dimension] == last_part].copy()
                if not filtered.empty:
                    break

    # Try substring match (value contains cell or cell contains value)
    if filtered.empty:
        pv_str = str(parent_value)
        mask = df[parent_dimension].astype(str).apply(
            lambda x: x in pv_str or pv_str in x
        )
        filtered = df[mask].copy()
```

**File:** `backend/python/smartbi/api/chat.py` (before line 264)

Also add cleanup of the filter_value before passing to the analyzer. Strip common prefixes from multi-level headers:

```python
filter_value = request.filter_value
# Clean up multi-level header prefixes
if filter_value and '>' in filter_value:
    filter_value = filter_value.rsplit('>', 1)[-1].strip()
```

## Files to Modify

| File | Change |
|------|--------|
| `web-admin/src/views/smart-bi/SmartBIAnalysis.vue` | Fix cache key at line ~1021 |
| `backend/python/smartbi/services/cross_analyzer.py` | Add fallback fuzzy match at line ~255 |
| `backend/python/smartbi/api/chat.py` | Add filter_value cleanup before line ~264 |

## Verification

1. **KPI fix**: Open SmartBI page → switch between profit table sheets → verify KPI values differ per sheet
2. **Drill-down fix**: Click pie chart slices on Sheet 1 (收入及净利简表) and Sheet 11 (24年返利明细) → verify drill-down drawer shows data instead of "No data found"
3. **Regression**: Verify Sheet 3 drill-down still works (it was working before the fix)
