# SmartBI Excel渲染管线优化 -- 最终执行计划

**日期**: 2026-03-04
**状态**: Approved for implementation
**预估总工时**: 12-14h (from original 21h, reduced via Critic corrections)

---

## Executive Summary

This plan integrates the Analyst's original 4-priority optimization plan with the Critic's corrections. Key adjustments:

1. **P0 scope reduced**: UNKNOWN rejection only affects `confirmAndPersist` (manual path, line 307). The SSE auto-upload path (line 174) calls `detectDataType()` which returns UNKNOWN gracefully -- it passes through to `persistDynamic()` which ignores DataType entirely. Real fix: add GENERAL fallback enum value.
2. **P2 LLM column trimming dropped**: 50 columns ~ 2000-3000 tokens, well within limits. Not a bottleneck.
3. **P2 DataFrame sharing claim corrected**: `/api/smartbi/chart/batch` receives data per-request in HTTP body. Dedup must happen caller-side (Vue SSE flow).
4. **P3 sampling language fixed**: "wide" = many columns, "tall" = many rows. Row sampling helps tall tables.
5. **New items added**: `_load_upload_data` limit stuck at 2000, asyncpg connection pooling, cache invalidation gap.

---

## Batch 1: Quick Wins & Error Hardening (3-4h)

### 1A. Cache key truncation bug (CONFIRMED, 1h)

**Problem**: `col_names[:20]` truncates column list in cache key. Two datasets with 25+ columns sharing the first 20 column names produce identical cache keys, returning wrong chart recommendations.

**File**: `backend/python/smartbi/services/chart_recommender.py:184`
```python
# BEFORE (line 184)
"|".join(col_names[:20]),

# AFTER
"|".join(col_names[:50]),   # or remove limit entirely
```

Also applies to the duplicate file at:
**File**: `backend/python/smartbi/services/chart/recommender.py:185`

**Test**: Upload two Excel files with >20 columns where cols 1-20 match but cols 21+ differ. Verify different chart recommendations returned.

---

### 1B. `_load_upload_data` limit discrepancy (CONFIRMED, 0.5h)

**Problem**: Default limit is 2000 rows. MEMORY.md claims it was changed to 50000 but code still shows 2000. For datasets like the 3461-row restaurant file, insight analysis operates on truncated data.

**File**: `backend/python/smartbi/api/insight.py:200`
```python
# BEFORE
async def _load_upload_data(upload_id: int, limit: int = 2000) -> List[Dict[str, Any]]:

# AFTER
async def _load_upload_data(upload_id: int, limit: int = 50000) -> List[Dict[str, Any]]:
```

**Note**: Also consider adding pagination to avoid OOM on very large uploads. For now 50000 is safe given typical Excel sizes.

**Test**: Upload a 3000+ row file, call `/api/insight/quick-summary` with upload_id, verify all rows included.

---

### 1C. asyncpg connection pooling (1h)

**Problem**: Every call to `_load_upload_data`, `chat.py`, `excel.py`, `yoy.py` creates a new `asyncpg.connect()` then closes it. This is wasteful under load.

**Files affected** (5 call sites):
- `backend/python/smartbi/api/insight.py:210`
- `backend/python/smartbi/api/chat.py:682`
- `backend/python/smartbi/api/chat.py:1044`
- `backend/python/smartbi/api/excel.py:3047`
- `backend/python/smartbi/api/yoy.py:110`

**Fix**: Create a shared connection pool in `backend/python/smartbi/config.py`:
```python
import asyncpg

_pool = None

async def get_pg_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            get_settings().postgres_url,
            min_size=2, max_size=10
        )
    return _pool
```

Replace all `conn = await asyncpg.connect(pg_url)` / `await conn.close()` with:
```python
pool = await get_pg_pool()
async with pool.acquire() as conn:
    rows = await conn.fetch(...)
```

**Test**: Run 10 concurrent insight requests, verify no connection exhaustion errors.

---

### 1D. Insight sample row reduction (0.5h)

**Problem**: `insight_generator.py:1104` sends `df.head(3)` sample rows to LLM, and `:1706` sends `df.head(5)`. These are fine for context, but `_compute_data_summary` at `:1095` iterates all numeric columns with full stats. For wide tables (50+ cols), the stats string can be large.

**File**: `backend/python/smartbi/services/insight_generator.py:1104`
```python
# Reduce from head(3) to head(2) for the LLM prompt sample
# Keep head(5) at line 1706 as it's for food context detection (needs more rows)
```

Minor optimization. Low risk.

---

## Batch 2: DataType Enum + UNKNOWN Handling (2-3h)

### 2A. Add GENERAL to DataType enum (1h)

**Problem**: `ExcelDataPersistenceService.DataType` only has SALES, FINANCE, DEPARTMENT, UNKNOWN. When `detectDataType()` cannot match sales/finance keywords, it returns UNKNOWN. The `confirmAndPersist` path (line 307) rejects UNKNOWN with error "无效的数据类型".

The SSE auto-upload path does NOT reject UNKNOWN (it passes through to `persistDynamic` which ignores DataType). So this only affects manual confirm flow.

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/ExcelDataPersistenceService.java:28`
```java
enum DataType {
    SALES("销售数据"),
    FINANCE("财务数据"),
    DEPARTMENT("部门数据"),
    GENERAL("通用数据"),      // <-- ADD
    UNKNOWN("未知数据");
```

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIUploadFlowServiceImpl.java:307`
```java
// BEFORE
if (detectedType == DataType.UNKNOWN) {
    return UploadFlowResult.failure("无效的数据类型: " + dataType);
}

// AFTER - fallback to GENERAL instead of rejecting
if (detectedType == DataType.UNKNOWN) {
    detectedType = DataType.GENERAL;
    log.info("数据类型检测为 UNKNOWN，回退为 GENERAL");
}
```

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ExcelDataPersistenceServiceImpl.java:136`
```java
// BEFORE
if (dataType == null || dataType == DataType.UNKNOWN) {
    dataType = detectDataType(parseResponse);
}
if (dataType == DataType.UNKNOWN) {
    // still proceeds but logs warning
}

// AFTER
if (dataType == null || dataType == DataType.UNKNOWN) {
    dataType = detectDataType(parseResponse);
}
if (dataType == DataType.UNKNOWN) {
    dataType = DataType.GENERAL;
}
```

**Test**: Upload a file with non-sales/non-finance headers (e.g., "员工姓名, 部门, 考勤天数"). Verify it persists successfully instead of failing with "无效的数据类型".

---

### 2B. Expand detectDataType keyword matching (1h)

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/ExcelDataPersistenceServiceImpl.java:72-117`

Add more categories to keyword detection or lower the threshold from `>= 2` matches to `>= 1` for secondary detection. Also add DEPARTMENT keyword detection (currently only SALES/FINANCE have keyword matching, but DEPARTMENT is in the enum).

---

## Batch 3: Sheet Selection & Classification (3-4h)

### 3A. Smart sheet auto-selection in Python (2h)

**Critic's point accepted**: Instead of a Java->Python round-trip `/list-sheets` API, have Python auto-select the best sheet internally during parse when no sheet_index is specified.

**File**: `backend/python/smartbi/services/excel/parser.py`

Add logic in the main `parse_with_analysis` method:
```python
# When sheet_index not specified, scan all sheets and pick the one with:
# 1. Highest row count (excluding index/metadata sheets)
# 2. TableType != INDEX_TABLE and != METADATA_TABLE
# 3. Prefer DETAIL_TABLE > DATA_TABLE > SUMMARY_TABLE
```

Leverage existing `parallel_processor.py:383` `_filter_sheets()` which already filters index sheets.

**Priority conflict noted by Critic**: METADATA_TABLE condition (`cols == 2 and rows < 50` at table_classifier.py:332) overlaps with DETAIL_TABLE condition. A 2-column, 40-row sheet could match both. Current code handles this via scoring (METADATA gets structure score 0.6, DETAIL needs rows>100 to score 0.5), so small tables won't conflict. No fix needed here.

---

### 3B. Relax METADATA_TABLE false positives (1h)

**File**: `backend/python/smartbi/services/table_classifier.py:332`

The current condition `cols == 2 and rows < 50` is overly broad. A legitimate 2-column dataset (e.g., "日期, 销售额" with 30 rows) would be classified as METADATA.

```python
# BEFORE (line 332)
if cols == 2 and rows < 50:
    scores[TableType.METADATA_TABLE] = 0.6

# AFTER - require key-value structure evidence
if cols == 2 and rows < 50:
    # Only score if first column looks like keys (high uniqueness, mostly text)
    first_col = df.iloc[:, 0]
    if first_col.dtype == object and first_col.nunique() / max(len(first_col), 1) > 0.8:
        scores[TableType.METADATA_TABLE] = 0.6
```

**Test**: Upload a 2-column "月份, 金额" file with 20 rows. Verify it classifies as DATA_TABLE not METADATA_TABLE.

---

## Batch 4: Cache Invalidation & Observability (2-3h)

### 4A. `smart_bi_analysis_cache` invalidation on re-upload (1.5h)

**Problem**: When a user re-uploads a file, the old analysis cache may still return stale results. The DB-level cache (`smart_bi_analysis_cache` table) has no invalidation strategy tied to upload events.

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/smartbi/SmartBiAnalysisCache.java`

Add invalidation in the upload flow:
**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIUploadFlowServiceImpl.java`

After successful persist, delete cache entries for the same factoryId:
```java
// After persistResult.isSuccess()
if (analysisCacheRepository != null) {
    analysisCacheRepository.deleteByFactoryId(factoryId);
}
```

Also add TTL-based cleanup for the Python file-based cache:
**File**: `backend/python/smartbi/services/analysis_cache.py`

---

### 4B. Chart recommendation cache key - include row count (0.5h)

**File**: `backend/python/smartbi/services/chart_recommender.py:183-194`

Add row count to signature to distinguish datasets with same columns but different sizes:
```python
signature_parts = [
    "|".join(col_names[:50]),    # fix from 1A
    "|".join(col_types[:20]),
    str(data_summary.row_count),  # <-- ADD
    "|".join(sorted(data_summary.time_columns[:5])),
    ...
```

---

## Items Explicitly NOT Included (Rejected from Analyst Plan)

| Analyst Proposal | Rejection Reason |
|---|---|
| P2: LLM column trimming | 50 cols ~ 2000-3000 tokens, well within 32K context. Not a bottleneck. |
| P2: DataFrame sharing in batch build | Batch build receives data per-request in HTTP body (`chart.py:160-181`). No shared state exists. Dedup is a Vue-side concern (SSE flow sends duplicate data). Out of scope for Python pipeline. |
| P0: "uploadId null" fix | Not reproduced. SSE flow at line 1731 correctly sets uploadId from `dynamicResult.getUploadId()`. |

---

## Implementation Order

```
Batch 1 (3-4h)  -->  Batch 2 (2-3h)  -->  Batch 3 (3-4h)  -->  Batch 4 (2-3h)
  [Quick wins]       [DataType fix]       [Sheet selection]     [Cache fixes]
```

Batch 1 and Batch 2 can be parallelized (Python vs Java, no file overlap).

---

## Regression Test Strategy

| Test | What it validates | Files touched |
|---|---|---|
| Upload non-sales/non-finance Excel | Batch 2A: GENERAL fallback | DataType enum, SmartBIUploadFlowServiceImpl |
| Upload 3000+ row file, check insight row count | Batch 1B: limit fix | insight.py |
| Upload two 25-col files with shared first 20 cols | Batch 1A: cache key fix | chart_recommender.py |
| Upload 2-col "月份,金额" file | Batch 3B: METADATA false positive | table_classifier.py |
| Re-upload same file, verify fresh analysis | Batch 4A: cache invalidation | SmartBIUploadFlowServiceImpl, analysis_cache.py |
| 10 concurrent `/api/insight/quick-summary` calls | Batch 1C: connection pool | insight.py, config.py |

All tests should use the existing E2E Playwright framework at `tests/e2e-smartbi/`.

---

## Parallel Work Suggestions

### Subagent: YES
- Batch 1 (Python) and Batch 2 (Java) are fully independent -- different files, different languages.

### Multi-Chat: YES (low conflict risk)
- Chat 1: Batch 1 + Batch 4 (all Python)
- Chat 2: Batch 2 + Batch 3A (Java + Python parser)
- Conflict risk: LOW -- only `table_classifier.py` could overlap between 3A and 3B.
