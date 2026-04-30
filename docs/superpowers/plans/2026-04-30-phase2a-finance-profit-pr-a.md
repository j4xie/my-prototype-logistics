# Phase 2A `/analysis/finance` profit per-type PR-A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/analysis/finance?analysisType=profit` 501 stub with byte-shape-matching real implementation (Path A only — finance_data records). Composite path's `_get_profit_metrics` shared upgrade. F999 byte gate verifies parity with live Java.

**Architecture:** Extend `backend/python/smartbi_compat/api/analysis_finance.py` with one parametrized SQL helper (`_query_finance_data`), six leaf helpers (Map.of mirrors, alert-level deciders, period-key formatter, chart builder), profit metrics+chart real impls, per-type assembler, and route branch. Add `scripts/record-java-golden.sh` so re-recording goldens is reproducible. F999 byte-shape gate added as integration test (mocks `_query_finance_data` → []). PR-B in a follow-up handles sales fallback + arithmetic depth tests.

**Tech Stack:** FastAPI, asyncpg pool (via `smartbi.config.get_pg_pool`), pytest + monkeypatch, bash + curl + python3-jwt for golden recording.

**Spec:** `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-profit-design.md`

**Java reference root:** `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/FinanceAnalysisServiceImpl.java`

**Branch:** `phase2a/t-finance-profit` (worktree: `.worktrees/phase2a-finance-profit`)

**Base:** origin/main `38b545d0c` + spec commit `c9b7a6c75`

**Out of scope (PR-B):** sales_data fallback path, `_aggregate_profit_by_period_sales`, 17 arithmetic-depth unit tests.

---

## Concurrent-edit safety reminder

Every commit MUST use `./scripts/safe-commit.sh "msg" path1 path2` OR `git commit -m "msg" -- path1 path2` (per `.claude/rules/concurrent-edit-safety.md` rule 5b). Sister chats may have files staged in this worktree's index — `--only` mode prevents scope creep.

---

## Phase A — Golden recording infrastructure

### Task A.1: Create `scripts/record-java-golden.sh`

**Files:**
- Create: `scripts/record-java-golden.sh`

- [ ] **Step 1: Create the recorder script**

```bash
#!/usr/bin/env bash
# scripts/record-java-golden.sh
#
# Record live Java response into tests/fixtures/java-smartbi-golden/<output>.
# Reusable across sister chats (cost / receivable / budget per-type).
#
# Usage:
#   JWT_SECRET=<from .env.test> ./scripts/record-java-golden.sh \
#       <factory_id> <endpoint_path_with_{factoryId}> <output_filename> [--prod]
#
# Examples:
#   JWT_SECRET=xxx ./scripts/record-java-golden.sh F999 \
#       '/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31&analysisType=profit' \
#       analysis-finance-F999-profit.json
#
# Defaults to test env (47.100.235.168:10011); pass --prod for prod env (10010).

set -euo pipefail

USAGE="Usage: JWT_SECRET=<secret> $0 <factory_id> <endpoint_path> <output_filename> [--prod]"

FACTORY_ID="${1:?$USAGE}"
ENDPOINT="${2:?$USAGE}"
OUTPUT="${3:?$USAGE}"
ENV_FLAG="${4:-test}"

: "${JWT_SECRET:?JWT_SECRET env var required (from /www/wwwroot/cretas/.env.test on server)}"

if [[ "$ENV_FLAG" == "--prod" ]]; then
    BASE_URL="http://47.100.235.168:10010"
else
    BASE_URL="http://47.100.235.168:10011"
fi

# Generate JWT (1h expiry, factory_super_admin role)
TOKEN=$(JWT_SECRET="$JWT_SECRET" FACTORY_ID="$FACTORY_ID" python3 - <<'PY'
import jwt, os, time
print(jwt.encode({
    "userId": 1,
    "username": "golden_recorder",
    "factoryId": os.environ["FACTORY_ID"],
    "role": "factory_super_admin",
    "exp": int(time.time()) + 3600,
}, os.environ["JWT_SECRET"], algorithm="HS256"))
PY
)

REPO_ROOT="$(git rev-parse --show-toplevel)"
GOLDEN_DIR="$REPO_ROOT/tests/fixtures/java-smartbi-golden"
mkdir -p "$GOLDEN_DIR"

URL="$BASE_URL${ENDPOINT//\{factoryId\}/$FACTORY_ID}"
OUT_PATH="$GOLDEN_DIR/$OUTPUT"

echo "Recording: $URL → $OUT_PATH"

# Pretty-print to file (preserve non-ASCII, sorted on top-level by Python — matches Jackson-style write)
curl -sS --fail -H "Authorization: Bearer $TOKEN" "$URL" \
    | python3 -c "import json, sys; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))" \
    > "$OUT_PATH"

echo "OK. Top of file:"
head -20 "$OUT_PATH"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/record-java-golden.sh
```

- [ ] **Step 3: Verify python3 jwt module available locally**

```bash
python3 -c "import jwt; print(jwt.__version__)"
```

Expected: prints version (e.g. `2.x.x`). If `ModuleNotFoundError`, run `pip install pyjwt` first.

- [ ] **Step 4: Smoke the script — record an existing golden to /tmp and diff**

```bash
JWT_SECRET="$(ssh root@47.100.235.168 'grep ^JWT_SECRET= /www/wwwroot/cretas/.env.test | cut -d= -f2-')" \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31&analysisType=payable' \
    /tmp/payable-recheck.json
diff -q tests/fixtures/java-smartbi-golden/analysis-finance-F999-payable.json /tmp/payable-recheck.json || true
```

Expected: `diff` may show formatting whitespace differences (raw vs jsonified), but JSON structure should match. If output is empty/error, fix script.

- [ ] **Step 5: Commit**

```bash
./scripts/safe-commit.sh "tools(phase2a/profit): add scripts/record-java-golden.sh — generic golden recorder" \
  scripts/record-java-golden.sh
```

---

### Task A.2: Standardize per-type golden filenames (cost + receivable, F999 + F001)

**Files:**
- Rename: `tests/fixtures/java-smartbi-golden/analysis-finance-type-cost-F001.json` → `analysis-finance-F001-cost.json`
- Rename: `tests/fixtures/java-smartbi-golden/analysis-finance-type-cost-F999.json` → `analysis-finance-F999-cost.json`
- Rename: `tests/fixtures/java-smartbi-golden/analysis-finance-type-receivable-F001.json` → `analysis-finance-F001-receivable.json`
- Rename: `tests/fixtures/java-smartbi-golden/analysis-finance-type-receivable-F999.json` → `analysis-finance-F999-receivable.json`

> Sister chats (`phase2a/t-finance-cost`, `phase2a/t-finance-receivable`) will use these as starting-point goldens. Pure file rename — content unchanged in this task.

- [ ] **Step 1: Rename via git mv**

```bash
cd tests/fixtures/java-smartbi-golden
git mv analysis-finance-type-cost-F001.json       analysis-finance-F001-cost.json
git mv analysis-finance-type-cost-F999.json       analysis-finance-F999-cost.json
git mv analysis-finance-type-receivable-F001.json analysis-finance-F001-receivable.json
git mv analysis-finance-type-receivable-F999.json analysis-finance-F999-receivable.json
cd -
```

- [ ] **Step 2: Verify nothing references old names**

```bash
grep -rn "analysis-finance-type-" tests/python/ backend/python/ docs/ scripts/ 2>&1 | grep -v Binary
```

Expected: no matches. If any, those files reference old names and need to be updated (or accept they stay until sister chat handles).

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "rename(phase2a/profit): standardize per-type golden filenames F{001,999}-{cost,receivable}.json" \
  tests/fixtures/java-smartbi-golden/analysis-finance-F001-cost.json \
  tests/fixtures/java-smartbi-golden/analysis-finance-F999-cost.json \
  tests/fixtures/java-smartbi-golden/analysis-finance-F001-receivable.json \
  tests/fixtures/java-smartbi-golden/analysis-finance-F999-receivable.json \
  tests/fixtures/java-smartbi-golden/analysis-finance-type-cost-F001.json \
  tests/fixtures/java-smartbi-golden/analysis-finance-type-cost-F999.json \
  tests/fixtures/java-smartbi-golden/analysis-finance-type-receivable-F001.json \
  tests/fixtures/java-smartbi-golden/analysis-finance-type-receivable-F999.json
```

> NB: `git mv` shows up as both old (deleted) and new (added) paths — pass both to safe-commit.

---

### Task A.3: Re-record F999 profit golden via script

**Files:**
- Delete: `tests/fixtures/java-smartbi-golden/analysis-finance-type-profit-F999.json`
- Create: `tests/fixtures/java-smartbi-golden/analysis-finance-F999-profit.json`

> Existing F999 profit golden has OLD wrapper format (`{verb, path, factory, response: {...}}`). New format is raw response (matches sister payable golden). Live Java will produce 5-zero-metric + empty-trendChart since F999 has no finance_data records.

- [ ] **Step 1: Re-record F999 profit golden**

```bash
JWT_SECRET="$(ssh root@47.100.235.168 'grep ^JWT_SECRET= /www/wwwroot/cretas/.env.test | cut -d= -f2-')" \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31&analysisType=profit' \
    analysis-finance-F999-profit.json
```

Expected: File written with `data` block containing `endDate / metrics / trendChart / startDate` keys (Jackson hash order — verify in step 2).

- [ ] **Step 2: Verify recorded shape matches spec §4.1**

```bash
python3 -c "
import json
with open('tests/fixtures/java-smartbi-golden/analysis-finance-F999-profit.json') as f:
    g = json.load(f)
data = g['data']
print('data keys:', list(data.keys()))
print('metric codes:', [m['metricCode'] for m in data['metrics']])
print('trendChart keys:', list(data['trendChart'].keys()))
print('trendChart options keys:', list(data['trendChart']['options'].keys()))
print('series count:', len(data['trendChart']['options']['series']))
print('yAxis count:', len(data['trendChart']['options']['yAxis']))
print('chart data:', data['trendChart']['data'])
"
```

Expected output:
```
data keys: ['endDate', 'metrics', 'trendChart', 'startDate']
metric codes: ['GROSS_PROFIT', 'GROSS_MARGIN', 'NET_PROFIT', 'NET_MARGIN', 'ROI']
trendChart keys: ['chartType', 'title', 'seriesField', 'data', 'options', 'xaxisField', 'yaxisField']
trendChart options keys: ['yAxis', 'series']
series count: 5
yAxis count: 2
chart data: []
```

If `data keys` order differs from spec §3.6, **trust the recorded order** — Jackson hash is the ground truth, spec is best-guess. Update the spec footnote if needed but proceed with recorded order.

- [ ] **Step 3: Delete old wrapped-format file**

```bash
git rm tests/fixtures/java-smartbi-golden/analysis-finance-type-profit-F999.json
```

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/profit): re-record F999 profit golden in standard raw-response format" \
  tests/fixtures/java-smartbi-golden/analysis-finance-F999-profit.json \
  tests/fixtures/java-smartbi-golden/analysis-finance-type-profit-F999.json
```

---

### Task A.4: Re-record F999 composite golden + verify composite gate still green

**Files:**
- Modify (rewrite): `tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json`

> Per spec §4.2, current golden has `value: 0.0` (single-precision), but live Java emits `value: 0` (int) or `value: 0.00` raw — under dict-eq both pass, but recording from real Java is ground truth.

- [ ] **Step 1: Re-record F999 composite golden**

```bash
JWT_SECRET="$(ssh root@47.100.235.168 'grep ^JWT_SECRET= /www/wwwroot/cretas/.env.test | cut -d= -f2-')" \
  ./scripts/record-java-golden.sh F999 \
    '/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31' \
    analysis-finance-F999-composite.json
```

- [ ] **Step 2: Run composite contract test against new golden**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceComposite -v
```

Expected: 3 tests pass (`test_f999_composite_data_keys_match_golden` + `test_f999_composite_byte_shape` + `test_f999_unimplemented_analysisType_returns_501`). If `test_f999_composite_byte_shape` fails with new golden, debug — recorded golden is ground truth, current Python `_get_profit_metrics` stub may need a value-shape fix, or the composite top-level key order changed.

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/profit): re-record F999 composite golden from live Java" \
  tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json
```

---

## Phase B — Helpers

### Task B.1: Add `_query_finance_data` parametrized SQL

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add helper after `_filter_to_latest_upload` at ~line 481)

> Single parametrized helper for all RecordType queries. Sister chats (cost/receivable/budget) reuse this exact function. `_query_finance_payable_data` stays unchanged for backward compat.

- [ ] **Step 1: Add helper after `_filter_to_latest_upload`**

Locate `def _filter_to_latest_upload(rows: list[dict]) -> list[dict]:` in `backend/python/smartbi_compat/api/analysis_finance.py` (around line 481). Insert this **immediately after** the closing of that function:

```python
async def _query_finance_data(
    factory_id: str, record_type: str, start_date: date, end_date: date
) -> list[dict]:
    """Single parametrized query against smart_bi_finance_data — reusable across
    all RecordType branches (REVENUE / COST / AR / AP / BUDGET).

    Java reference: financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
        factoryId, RecordType.<X>, start, end). Then wraps via filterToLatestUpload
    (Java line 89-101).

    SELECT * over all known columns; callers extract by key. Sister chats use
    same function with different record_type.
    """
    pool = None
    try:
        from smartbi.config import get_pg_pool  # type: ignore
        pool = await get_pg_pool()
    except Exception as e:
        logger.warning(
            "[finance_data] pool acquisition failed factory=%s record_type=%s: %s",
            factory_id, record_type, e,
        )
        return []

    if pool is None:
        logger.warning(
            "[finance_data] pool is None factory=%s record_type=%s; returning empty rows",
            factory_id, record_type,
        )
        return []

    sql = """
        SELECT id, factory_id, upload_id, record_date, record_type,
               department, category, customer_name, supplier_name,
               material_cost, labor_cost, overhead_cost, total_cost,
               receivable_amount, collection_amount, aging_days,
               payable_amount, payment_amount,
               budget_amount, actual_amount, variance_amount,
               due_date, created_at, updated_at
        FROM smart_bi_finance_data
        WHERE factory_id = $1
          AND record_type = $2
          AND record_date BETWEEN $3 AND $4
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, factory_id, record_type, start_date, end_date)

    raw_rows = [dict(r) for r in rows]
    return _filter_to_latest_upload(raw_rows)
```

- [ ] **Step 2: Run all existing tests to verify nothing broke**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -v 2>&1 | tail -20
```

Expected: 225 pytest tests pass (same as before this task — adding helper doesn't activate it yet).

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/profit): add _query_finance_data parametrized SQL helper" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task B.2: Add Map.of mirror factories (`_new_yaxis_entry`, `_new_series_entry`)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add to Section 1 DTO factories around line 200, after `_new_kpi_card_dict`)

> Java `Map.of("name", X, "type", Y, "yAxisIndex", Z)` Jackson-serializes to **hash-key order, NOT put-order**. For Map.of with 3 entries the empirical order is `[type, yAxisIndex, name]` (per spec §3.3); for 2 entries it's put-order `[name, position]`. These factories codify the order so callers don't have to remember.

- [ ] **Step 1: Locate insertion point**

Find `def _new_kpi_card_dict(` in `backend/python/smartbi_compat/api/analysis_finance.py` (~line 227). Locate the end of that function (the `return { ... }` block).

- [ ] **Step 2: Add yAxis + series factories after `_new_kpi_card_dict`**

Insert the following directly after `_new_kpi_card_dict`'s closing brace:

```python
def _new_yaxis_entry(name: str, position: str) -> dict:
    """Mirror Java `Map.of("name", X, "position", Y)`.

    Map.of(2) Jackson-serializes in put-order: ["name", "position"].
    Used in profit trendChart options.yAxis (left/right axes).
    """
    return {"name": name, "position": position}


def _new_series_entry(type_: str, yaxis_index: int, name: str) -> dict:
    """Mirror Java `Map.of("name", X, "type", Y, "yAxisIndex", Z)`.

    Map.of(3) Jackson hash-orders to ["type", "yAxisIndex", "name"] — NOT put-order.
    Verified empirically against live Java responses (see spec §3.3).
    Used in profit trendChart options.series (5 series: 3 bar + 2 line).
    """
    return {"type": type_, "yAxisIndex": yaxis_index, "name": name}
```

- [ ] **Step 3: Run pytest to verify no regression**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -5
```

Expected: 225 passed.

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/profit): add Map.of mirror factories for trendChart yAxis/series" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task B.3: Add alert-level deciders (`_determine_gross_margin_alert`, `_determine_roi_alert`)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add after `_format_currency` around line 380)

- [ ] **Step 1: Locate insertion point**

Find `def _format_currency(v: Optional[Decimal]) -> str:` (~line 332). Locate the end of that function.

- [ ] **Step 2: Add alert-level deciders after `_format_currency`**

```python
def _determine_gross_margin_alert(gross_margin: Decimal) -> str:
    """Java `FinanceAnalysisServiceImpl.determineGrossMarginAlertLevel` line 1619-1624.

    v < 15  → RED
    v < 25  → YELLOW
    v >= 25 → GREEN
    """
    v = float(gross_margin)
    if v < 15:
        return "RED"
    if v < 25:
        return "YELLOW"
    return "GREEN"


def _determine_roi_alert(roi: Decimal) -> str:
    """Java `FinanceAnalysisServiceImpl.determineRoiAlertLevel` line 1629-1634.

    v < 0   → RED
    v < 20  → YELLOW
    v >= 20 → GREEN
    """
    v = float(roi)
    if v < 0:
        return "RED"
    if v < 20:
        return "YELLOW"
    return "GREEN"
```

- [ ] **Step 3: Run pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -5
```

Expected: 225 passed.

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/profit): add alert-level deciders for gross margin + ROI" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task B.4: Add `_get_period_key` helper

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add after the alert deciders from B.3)

- [ ] **Step 1: Add `_get_period_key` after the alert-level deciders**

```python
def _get_period_key(d: date, period: str) -> str:
    """Mirror Java `FinanceAnalysisServiceImpl.getPeriodKey` line 1472-1487.

    Period key formats:
      DAY     → yyyy-MM-dd
      WEEK    → yyyy-Www  (ISO week, 2-digit zero-padded)
      MONTH   → yyyy-MM   (default for unknown period)
      QUARTER → yyyy-Qn

    Java ISO week semantics: weeks start Monday, week-1 contains the year's
    first Thursday. Python `isocalendar()` matches.
    """
    if period == "DAY":
        return d.strftime("%Y-%m-%d")
    if period == "WEEK":
        iso_year, iso_week, _ = d.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    if period == "QUARTER":
        return f"{d.year}-Q{(d.month - 1) // 3 + 1}"
    # MONTH or default
    return d.strftime("%Y-%m")
```

- [ ] **Step 2: Run pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -5
```

Expected: 225 passed.

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/profit): add _get_period_key DAY/WEEK/MONTH/QUARTER formatter" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

## Phase C — Profit core impl

### Task C.1: Upgrade `_get_profit_metrics` stub → real impl (Path A only)

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py:519-595` (replace stub `_get_profit_metrics`)

> The current stub returns 5 hardcoded zero-metrics matching empty F999. The real impl must produce identical output for empty data (so composite gate stays green) AND correct values for non-empty data.

- [ ] **Step 1: Locate stub at line 519**

The stub starts at `async def _get_profit_metrics(factory_id: str, range_: DateRange) -> list:` and ends at line ~595 (before `_get_cost_structure_chart` at line 598).

- [ ] **Step 2: Replace stub with real impl**

Replace the entire stub function (preserving signature) with:

```python
async def _get_profit_metrics(factory_id: str, range_: DateRange) -> list:
    """Real impl mirroring Java `FinanceAnalysisServiceImpl.getProfitMetrics`
    (line 352-495). PR-A: Path A only (finance_data REVENUE/COST records).
    PR-B will add salesData fallback; for now no-finance-data → 5 zero-metrics
    (matches stub behavior for F999 empty state).

    Always returns 5 MetricResults regardless of data presence:
      GROSS_PROFIT / GROSS_MARGIN / NET_PROFIT / NET_MARGIN / ROI

    Anomaly clamps:
      gross_margin > 100% or < -100% → null (per Java line 414-416)
      net_margin   > 100% or < -100% → null (per Java line 449-453)
    """
    revenue_records = await _query_finance_data(
        factory_id, "REVENUE", range_.start_date, range_.end_date
    )
    cost_records = await _query_finance_data(
        factory_id, "COST", range_.start_date, range_.end_date
    )
    has_finance_data = bool(revenue_records or cost_records)

    if has_finance_data:
        # Java line 367-388
        total_revenue = sum(
            (
                _to_decimal(r["actual_amount"])
                for r in revenue_records
                if r.get("category") and "收入" in r["category"]
                and r.get("actual_amount") is not None
            ),
            Decimal("0"),
        )
        total_cost = sum(
            (
                abs(_to_decimal(
                    r.get("total_cost") if r.get("total_cost") is not None
                    else r.get("actual_amount")
                ))
                for r in cost_records
                if (r.get("total_cost") is not None) or (r.get("actual_amount") is not None)
            ),
            Decimal("0"),
        )
        net_profit = sum(
            (
                _to_decimal(r["actual_amount"])
                for r in revenue_records
                if r.get("category") and "净利" in r["category"]
                and r.get("actual_amount") is not None
            ),
            Decimal("0"),
        )
    else:
        # PR-A no fallback: empty path mirrors Java line 404 (`netProfit = null`).
        # PR-B will replace this branch with sales fallback.
        total_revenue = Decimal("0")
        total_cost = Decimal("0")
        net_profit = None  # null in metrics, distinct from ZERO

    # Java line 409-416 — gross profit + margin clamp
    gross_profit = total_revenue - total_cost
    if total_revenue > Decimal("0"):
        gross_margin_raw = (
            gross_profit / total_revenue * Decimal("100")
        ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    else:
        gross_margin_raw = Decimal("0")
    gross_margin = (
        None
        if (gross_margin_raw > Decimal("100") or gross_margin_raw < Decimal("-100"))
        else gross_margin_raw
    )

    # Java line 446-453 — net margin (only when net_profit available + revenue > 0)
    if net_profit is not None and total_revenue > Decimal("0"):
        net_margin_raw = (
            net_profit / total_revenue * Decimal("100")
        ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    else:
        net_margin_raw = None
    net_margin = (
        None
        if (
            net_margin_raw is not None
            and (net_margin_raw > Decimal("100") or net_margin_raw < Decimal("-100"))
        )
        else net_margin_raw
    )

    # Java line 481-483 — ROI = grossProfit / totalCost * 100
    if total_cost > Decimal("0"):
        roi = (
            gross_profit / total_cost * Decimal("100")
        ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    else:
        roi = Decimal("0")

    # Alert levels
    gross_margin_alert = (
        _determine_gross_margin_alert(gross_margin) if gross_margin is not None else "RED"
    )
    # Java line 461-466: GREEN if net_profit is null OR >= 0, RED if < 0
    if net_profit is None:
        net_profit_alert = "GREEN"
    else:
        net_profit_alert = "GREEN" if net_profit >= Decimal("0") else "RED"
    roi_alert = _determine_roi_alert(roi)

    return [
        _new_metric_result_dict(
            metric_code="GROSS_PROFIT",
            metric_name="毛利额",
            value=_decimal_to_number(gross_profit.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            formatted_value=_format_currency(gross_profit),
            unit="元",
            alert_level="GREEN",
            description="销售收入减去销售成本",
        ),
        _new_metric_result_dict(
            metric_code="GROSS_MARGIN",
            metric_name="毛利率",
            value=(
                _decimal_to_number(gross_margin.quantize(Decimal("0.01"), ROUND_HALF_UP))
                if gross_margin is not None else None
            ),
            formatted_value=(
                f"{gross_margin.quantize(Decimal('0.01'), ROUND_HALF_UP)}%"
                if gross_margin is not None else "N/A"
            ),
            unit="%",
            alert_level=gross_margin_alert,
            description="毛利额占销售收入的比例",
        ),
        _new_metric_result_dict(
            metric_code="NET_PROFIT",
            metric_name="净利润",
            value=(
                _decimal_to_number(net_profit.quantize(Decimal("0.01"), ROUND_HALF_UP))
                if net_profit is not None else None
            ),
            formatted_value=(
                _format_currency(net_profit) if net_profit is not None else "N/A"
            ),
            unit="元",
            alert_level=net_profit_alert,
            description="毛利减去各项费用后的利润",
        ),
        _new_metric_result_dict(
            metric_code="NET_MARGIN",
            metric_name="净利率",
            value=(
                _decimal_to_number(net_margin.quantize(Decimal("0.01"), ROUND_HALF_UP))
                if net_margin is not None else None
            ),
            formatted_value=(
                f"{net_margin.quantize(Decimal('0.01'), ROUND_HALF_UP)}%"
                if net_margin is not None else "N/A"
            ),
            unit="%",
            alert_level="GREEN",
            description="净利润占销售收入的比例",
        ),
        _new_metric_result_dict(
            metric_code="ROI",
            metric_name="投入产出比",
            value=_decimal_to_number(roi.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            formatted_value=f"{roi.quantize(Decimal('0.01'), ROUND_HALF_UP)}%",
            unit="%",
            alert_level=roi_alert,
            description="毛利额与成本的比率",
        ),
    ]
```

- [ ] **Step 3: Run composite gate to verify swap doesn't break it**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceComposite -v
```

Expected: All 3 tests pass. Composite gate uses `_get_profit_metrics` for `profitMetrics` field — empty F999 path returns identical 5-zero-metric shape, dict-eq.

If `test_f999_composite_byte_shape` fails, debug:
- Likely culprit: `_format_currency` produces different formatted string than the stub's hardcoded `"0.00"` (e.g., adds comma `"0,00.00"` or different decimal places)
- Quick check: `python3 -c "from decimal import Decimal; from backend.python.smartbi_compat.api.analysis_finance import _format_currency; print(repr(_format_currency(Decimal('0'))))"`
- Expected: `'0.00'`. If different (e.g., `'¥0.00'` or `'0,00'`), inspect `_format_currency` impl and align with `formattedValue: "0.00"` per spec §4.1.

- [ ] **Step 4: Run all pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -5
```

Expected: 225 passed (no regressions).

- [ ] **Step 5: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/profit): upgrade _get_profit_metrics stub → real impl (Path A finance_data only)" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task C.2: Add `_build_profit_chart_from_finance_data`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add private helper after the upgraded `_get_profit_metrics`)

- [ ] **Step 1: Add chart builder after `_get_profit_metrics`**

Locate the end of the upgraded `_get_profit_metrics` (after the closing `]` of the return). Insert:

```python
def _build_profit_chart_from_finance_data(
    revenue_rows: list[dict], cost_rows: list[dict], period: str
) -> list[dict]:
    """Mirror Java `FinanceAnalysisServiceImpl.buildProfitChartFromFinanceData`
    line 279-349.

    Aggregates revenue/cost/net-profit per period, emits 6-key chart points.
    Java uses TreeMap (sorted keys) → Python `sorted(set(...))`.

    Each point (insertion order = serialization order):
      [period, revenue, cost, grossProfit, netProfit, grossMargin]

    Notes:
      - `revenue_rows` filter: category contains "收入" (营业收入).
      - `net_profit_by_period` filter: category contains "净利" (净利润 etc).
      - `cost_rows` defensive `.abs()` (Java Bug B fix line 304).
      - `gross_margin > 100% or < -100%` → null (Java line 332-335).
      - When no "净利" record for a period, `netProfit` defaults to `gross_profit`
        (Java line 336).
    """
    revenue_by_period: dict[str, Decimal] = {}
    net_profit_by_period: dict[str, Decimal] = {}
    cost_by_period: dict[str, Decimal] = {}

    for r in revenue_rows:
        if r.get("actual_amount") is None:
            continue
        key = _get_period_key(r["record_date"], period)
        cat = r.get("category") or ""
        if "收入" in cat:
            revenue_by_period[key] = (
                revenue_by_period.get(key, Decimal("0")) + _to_decimal(r["actual_amount"])
            )
        if "净利" in cat:
            net_profit_by_period[key] = (
                net_profit_by_period.get(key, Decimal("0")) + _to_decimal(r["actual_amount"])
            )

    for c in cost_rows:
        if c.get("total_cost") is None and c.get("actual_amount") is None:
            continue
        key = _get_period_key(c["record_date"], period)
        raw = c.get("total_cost") if c.get("total_cost") is not None else c.get("actual_amount")
        cost_by_period[key] = (
            cost_by_period.get(key, Decimal("0")) + abs(_to_decimal(raw))
        )

    all_periods = sorted(set(revenue_by_period.keys()) | set(cost_by_period.keys()))
    chart_data: list[dict] = []
    for pk in all_periods:
        revenue = revenue_by_period.get(pk, Decimal("0"))
        cost = cost_by_period.get(pk, Decimal("0"))
        gross_profit = revenue - cost
        if revenue > Decimal("0"):
            gross_margin_raw = (
                gross_profit / revenue * Decimal("100")
            ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        else:
            gross_margin_raw = Decimal("0")
        gross_margin = (
            None
            if (gross_margin_raw > Decimal("100") or gross_margin_raw < Decimal("-100"))
            else gross_margin_raw
        )
        net_profit = net_profit_by_period.get(pk, gross_profit)

        chart_data.append({
            "period": pk,
            "revenue": _decimal_to_number(revenue.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "cost": _decimal_to_number(cost.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "grossProfit": _decimal_to_number(gross_profit.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "netProfit": _decimal_to_number(net_profit.quantize(Decimal("0.01"), ROUND_HALF_UP)),
            "grossMargin": (
                _decimal_to_number(gross_margin.quantize(Decimal("0.01"), ROUND_HALF_UP))
                if gross_margin is not None else None
            ),
        })
    return chart_data
```

- [ ] **Step 2: Run pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -5
```

Expected: 225 passed (helper not yet called from anywhere).

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/profit): add _build_profit_chart_from_finance_data helper" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task C.3: Add `_get_profit_trend_chart`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add after `_build_profit_chart_from_finance_data`)

- [ ] **Step 1: Add trend chart function**

Insert after `_build_profit_chart_from_finance_data`'s closing brace:

```python
async def _get_profit_trend_chart(
    factory_id: str,
    start_date: date,
    end_date: date,
    period: str = "MONTH",
) -> dict:
    """Mirror Java `FinanceAnalysisServiceImpl.getProfitTrendChart` line 220-274.

    Builds LINE_BAR chart with 5 series (3 bar: 营业收入/营业成本/毛利额,
    2 line: 净利润/毛利率) on dual yAxis (left=金额, right=毛利率%).

    PR-A: when both revenue + cost queries empty → data=[] (chart options
    still emitted in full). PR-B will add sales fallback in this same branch.

    Period defaults to MONTH (matches controller line 246 hardcoded "MONTH").
    """
    revenue_data = await _query_finance_data(
        factory_id, "REVENUE", start_date, end_date
    )
    cost_data = await _query_finance_data(
        factory_id, "COST", start_date, end_date
    )

    if revenue_data or cost_data:
        chart_data = _build_profit_chart_from_finance_data(revenue_data, cost_data, period)
    else:
        # PR-A: empty (no fallback). PR-B will add sales fallback here.
        chart_data = []

    options = {
        "yAxis": [
            _new_yaxis_entry(name="金额", position="left"),
            _new_yaxis_entry(name="毛利率(%)", position="right"),
        ],
        "series": [
            _new_series_entry(type_="bar", yaxis_index=0, name="营业收入"),
            _new_series_entry(type_="bar", yaxis_index=0, name="营业成本"),
            _new_series_entry(type_="bar", yaxis_index=0, name="毛利额"),
            _new_series_entry(type_="line", yaxis_index=0, name="净利润"),
            _new_series_entry(type_="line", yaxis_index=1, name="毛利率"),
        ],
    }

    return _new_chart_config_dict(
        chart_type="LINE_BAR",
        title="利润趋势分析",
        series_field="metric",
        data=chart_data,
        options=options,
        xaxis_field="period",
        yaxis_field="grossProfit",
    )
```

- [ ] **Step 2: Run pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -5
```

Expected: 225 passed.

- [ ] **Step 3: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/profit): add _get_profit_trend_chart (LINE_BAR, 5 series, dual yAxis)" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

## Phase D — Per-type assembler + route

### Task D.1: Add `_get_profit_analysis` assembler

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py` (add to Section 4 before `_get_payable_analysis` around line 795)

- [ ] **Step 1: Locate `_get_payable_analysis` (around line 795 — `# Section 4: Composite + per-type assembly`)**

The new function goes **immediately before** `async def _get_payable_analysis(`.

- [ ] **Step 2: Add `_get_profit_analysis`**

```python
async def _get_profit_analysis(
    factory_id: str, start_date: date, end_date: date
) -> dict:
    """Java reference: SmartBIAnalysisController.getFinanceAnalysis line 240-246.

    Java HashMap put-order: startDate / endDate / metrics / trendChart.
    Recorded F999 Jackson order in golden (verify Task A.3 step 2 output —
    if differs, MATCH the recorded order, not this docstring):
      [endDate, metrics, trendChart, startDate]

    Period hardcoded to "MONTH" (Java controller line 246).
    """
    range_ = DateRange.custom(start_date, end_date)
    metrics = await _get_profit_metrics(factory_id, range_)
    trend_chart = await _get_profit_trend_chart(
        factory_id, start_date, end_date, "MONTH"
    )

    return {
        "endDate": end_date.isoformat(),
        "metrics": metrics,
        "trendChart": trend_chart,
        "startDate": start_date.isoformat(),
    }
```

> **Important**: After Task A.3 step 2, if the recorded golden's data-key order is **not** `[endDate, metrics, trendChart, startDate]`, edit this dict literal to match the recorded order. The golden is ground truth.

- [ ] **Step 3: Run pytest**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -5
```

Expected: 225 passed (assembler not yet called from route).

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/profit): add _get_profit_analysis per-type assembler (4-key dict, Jackson order)" \
  backend/python/smartbi_compat/api/analysis_finance.py
```

---

### Task D.2: Wire route handler `analysisType=profit` branch + remove from 501 test

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_finance.py:841-843` (route handler add `if analysisType == "profit":` branch before final `return wrap_response(... 501 ...)`)
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py:146` (remove `"profit"` from `for at in [...]:` loop in `test_f999_unimplemented_analysisType_returns_501`)

- [ ] **Step 1: Locate route handler**

In `backend/python/smartbi_compat/api/analysis_finance.py`, find the existing payable branch:

```python
    if analysisType == "payable":
        result = await _get_payable_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)
```

(around line 841).

- [ ] **Step 2: Add profit branch immediately after payable branch (and before the 501 fallback)**

Insert:

```python
    if analysisType == "profit":
        result = await _get_profit_analysis(auth.factory_id, startDate, endDate)
        return wrap_response(result)

```

(blank line after `return` for separation).

- [ ] **Step 3: Remove `"profit"` from the 501 test loop**

In `tests/python/smartbi_compat/test_analysis_finance_contract.py:146`, locate:

```python
        for at in ["profit", "cost", "receivable", "budget"]:
```

Change to:

```python
        for at in ["cost", "receivable", "budget"]:
```

Also update the docstring comment one line above (line 145):

```python
        """Verify 501 path for un-ported analysisTypes (payable now real impl, excluded)."""
```

becomes:

```python
        """Verify 501 path for un-ported analysisTypes (payable + profit now real impl, excluded)."""
```

- [ ] **Step 4: Run composite + 501 tests to confirm 501 list change**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceComposite -v
```

Expected: All 3 tests pass. The 501 test now only iterates 3 types (cost/receivable/budget).

- [ ] **Step 5: Quick smoke — hit profit endpoint via TestClient and confirm 200**

```bash
cd backend/python && python -c "
import os
os.environ['JWT_SECRET'] = 'test-secret-for-phase2a-do-not-use-in-prod'
import sys
sys.path.insert(0, '.')
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location('m', 'main.py')
m = module_from_spec(spec); spec.loader.exec_module(m)

from fastapi.testclient import TestClient
import jwt, time
tok = jwt.encode({'userId':1,'username':'t','factoryId':'F999','role':'factory_super_admin','exp':int(time.time())+3600}, 'test-secret-for-phase2a-do-not-use-in-prod', algorithm='HS256')

# Mock the SQL layer to avoid DB dep
import smartbi_compat.api.analysis_finance as af
async def fake(*a, **k): return []
af._query_finance_data = fake

c = TestClient(m.app)
r = c.get('/api/mobile/F999/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31&analysisType=profit', headers={'Authorization': f'Bearer {tok}'})
print('status:', r.status_code)
print('keys:', list(r.json().get('data', {}).keys()))
print('metric_count:', len(r.json()['data']['metrics']))
print('trend_chart_keys:', list(r.json()['data']['trendChart'].keys()))
"
```

Expected output:
```
status: 200
keys: ['endDate', 'metrics', 'trendChart', 'startDate']  # or whatever order golden has
metric_count: 5
trend_chart_keys: ['chartType', 'title', 'seriesField', 'data', 'options', 'xaxisField', 'yaxisField']
```

If `status: 200` and `metric_count: 5` and `trend_chart_keys` count is 7, route is wired correctly.

- [ ] **Step 6: Commit**

```bash
./scripts/safe-commit.sh "feat(phase2a/profit): wire route handler analysisType=profit + drop profit from 501 test loop" \
  backend/python/smartbi_compat/api/analysis_finance.py \
  tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

## Phase E — Byte-shape gate test + final verify

### Task E.1: Add `TestAnalysisFinanceProfit` class

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_finance_contract.py` (append new test class after `TestAnalysisFinancePayable` at end of file ~line 230)

- [ ] **Step 1: Append `TestAnalysisFinanceProfit` to the end of the test file**

```python


class TestAnalysisFinanceProfit:
    """F999 byte-shape gate for profit per-type path (analysisType=profit, PR-A real impl)."""

    def test_f999_profit_data_keys_match_golden(self, client, monkeypatch):
        """Sanity: data keys order matches Jackson HashMap order in recorded golden.

        Mock _query_finance_data → [] for both REVENUE + COST so impl runs the
        empty-Path-A branch (matches F999 reality on test env).
        """
        async def fake_empty(_factory_id, _record_type, _start, _end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_empty,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=profit",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_data_keys = list(resp.json()["data"].keys())

        with io.open(GOLDEN_DIR / "analysis-finance-F999-profit.json", encoding="utf-8") as f:
            golden_data_keys = list(json.load(f)["data"].keys())

        assert py_data_keys == golden_data_keys, (
            f"data key order mismatch:\n"
            f"  python: {py_data_keys}\n"
            f"  golden: {golden_data_keys}"
        )

    def test_f999_profit_byte_shape(self, client, monkeypatch):
        """Full byte-shape compare on data block for empty F999 (5-zero-metric +
        empty trendChart data + full options).
        """
        async def fake_empty(_factory_id, _record_type, _start, _end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_empty,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=profit",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200

        py_data = _strip_volatile(resp.json()["data"])

        with io.open(GOLDEN_DIR / "analysis-finance-F999-profit.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["data"])

        if py_data != golden_data:
            diffs = {}
            for k in set(py_data.keys()) | set(golden_data.keys()):
                if py_data.get(k) != golden_data.get(k):
                    diffs[k] = {
                        "python": py_data.get(k),
                        "golden": golden_data.get(k),
                    }
            pytest.fail(
                f"BYTE SHAPE MISMATCH (profit) on {list(diffs.keys())}\n"
                f"{json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}"
            )
```

- [ ] **Step 2: Run TestAnalysisFinanceProfit only**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/test_analysis_finance_contract.py::TestAnalysisFinanceProfit -v
```

Expected: 2 tests pass.

If `test_f999_profit_byte_shape` fails:
- Most likely: `formattedValue` for zero metrics differs from golden (e.g. our impl emits `"0.00"` but golden has `"¥0.00"` because Java's `formatCurrency` may add prefix). Inspect diff output, fix `_format_currency` impl OR update spec finding.
- Second most likely: alert level differs (golden may show ROI alertLevel=YELLOW because ROI=0 is < 20 → YELLOW per `_determine_roi_alert`, while NET_MARGIN alert is hardcoded GREEN). Verify against the Java live recording, not against intuition.

- [ ] **Step 3: Run all pytest to confirm full suite green**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -v 2>&1 | tail -10
```

Expected: 227 passed (225 baseline + 2 new). Composite gate (3 tests) + payable gate (2 tests) + profit gate (2 tests) all green.

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/profit): add TestAnalysisFinanceProfit F999 byte-shape gate (2 tests)" \
  tests/python/smartbi_compat/test_analysis_finance_contract.py
```

---

### Task E.2: Re-record F001 profit golden against live Java

**Files:**
- Delete: `tests/fixtures/java-smartbi-golden/analysis-finance-type-profit-F001.json`
- Create: `tests/fixtures/java-smartbi-golden/analysis-finance-F001-profit.json`

> F001 may have non-empty finance_data on test env. F001 golden is for sister chats / future strict-byte gate; not enforced in CI per spec §5.4.

- [ ] **Step 1: Re-record F001 profit golden**

```bash
JWT_SECRET="$(ssh root@47.100.235.168 'grep ^JWT_SECRET= /www/wwwroot/cretas/.env.test | cut -d= -f2-')" \
  ./scripts/record-java-golden.sh F001 \
    '/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31&analysisType=profit' \
    analysis-finance-F001-profit.json
```

- [ ] **Step 2: Sanity-check file shape**

```bash
python3 -c "
import json
with open('tests/fixtures/java-smartbi-golden/analysis-finance-F001-profit.json') as f:
    g = json.load(f)
print('http code:', g.get('code'))
print('data keys:', list(g['data'].keys()) if g.get('success') else 'no data')
print('metric count:', len(g['data']['metrics']) if g.get('success') else 'n/a')
"
```

Expected: `http code: 200`, `data keys: [..., 'metrics', 'trendChart', ...]`, `metric count: 5`.

- [ ] **Step 3: Delete old wrapped F001 golden**

```bash
git rm tests/fixtures/java-smartbi-golden/analysis-finance-type-profit-F001.json
```

- [ ] **Step 4: Commit**

```bash
./scripts/safe-commit.sh "test(phase2a/profit): re-record F001 profit golden in standard format" \
  tests/fixtures/java-smartbi-golden/analysis-finance-F001-profit.json \
  tests/fixtures/java-smartbi-golden/analysis-finance-type-profit-F001.json
```

---

### Task E.3: Final scope verify + push branch

**Files:**
- N/A (verification + git push)

- [ ] **Step 1: Verify total scope matches spec ~400 LOC budget**

```bash
git diff --stat origin/main..HEAD -- 'backend/python/smartbi_compat/**' 'tests/python/**' 'scripts/record-java-golden.sh' 'tests/fixtures/java-smartbi-golden/analysis-finance-F999-profit.json' 'tests/fixtures/java-smartbi-golden/analysis-finance-F999-composite.json' | tail -5
```

Expected: total `+` count between 350 and 500 (impl + tests + script + golden re-records).

- [ ] **Step 2: Re-run full pytest one more time**

```bash
cd backend/python && python -m pytest ../../tests/python/smartbi_compat/ -q 2>&1 | tail -5
```

Expected: 227 passed.

- [ ] **Step 3: Verify git status clean**

```bash
git status --short
```

Expected: no output (working tree clean, all commits made).

- [ ] **Step 4: Verify commits look right**

```bash
git log --oneline origin/main..HEAD
```

Expected: 14 commits (1 spec from prior session + 13 from this plan: A.1 + A.2 + A.3 + A.4 + B.1 + B.2 + B.3 + B.4 + C.1 + C.2 + C.3 + D.1 + D.2 + E.1 + E.2 = 16 minus 2 already-completed = 14, give or take depending on whether A.4 and E.2 produce identical-content rewrites).

- [ ] **Step 5: Push branch to origin**

```bash
git push -u origin phase2a/t-finance-profit
```

Expected: push succeeds, GH suggests PR creation URL.

- [ ] **Step 6: Report PR-A complete**

Report to user:
- Branch pushed: `phase2a/t-finance-profit`
- Commits ahead of origin/main: <N>
- pytest: 227 passed
- F999 profit byte gate: green
- F999 composite gate: still green (no regression from real impl swap)
- Ready for PR creation + squash merge
- After PR-A merged, continue with PR-B (sales fallback + 17 arithmetic-depth tests) in same chat / same worktree

---

## Self-Review (post-write checklist)

**1. Spec coverage:**
- ✅ §2.1 PR-A files: scripts/record-java-golden.sh (A.1), golden renames (A.2), F999 golden re-records (A.3, A.4), analysis_finance.py edits (B.1-D.2), test class (E.1)
- ✅ §3.2 `_get_profit_metrics` real impl: C.1
- ✅ §3.3 `_get_profit_trend_chart` + `_build_profit_chart_from_finance_data`: C.2, C.3
- ✅ §3.4 `_query_finance_data` parametrized: B.1
- ✅ §3.6 `_get_profit_analysis` + route: D.1, D.2
- ✅ §5.1 `TestAnalysisFinanceProfit` 2 tests: E.1
- ✅ Map.of factories: B.2
- ✅ Alert-level deciders: B.3
- ✅ `_get_period_key`: B.4
- ✅ F001 golden re-record: E.2

**2. Placeholder scan:** No "TBD" / "TODO" / "Add appropriate ..." / "implement later". All steps have full code or full commands.

**3. Type consistency:**
- `_query_finance_data(factory_id: str, record_type: str, start_date: date, end_date: date) -> list[dict]` — same signature in B.1 declaration and C.1/C.3 callers ✓
- `_get_profit_metrics(factory_id: str, range_: DateRange) -> list` — matches existing stub signature ✓
- `_get_profit_trend_chart(factory_id, start_date, end_date, period="MONTH")` — matches caller in D.1 ✓
- `_get_profit_analysis(factory_id, start_date, end_date)` — matches route handler call signature in D.2 ✓
- Mock signature in E.1 (`fake_empty(_factory_id, _record_type, _start, _end)`) matches `_query_finance_data` 4-arg signature ✓

**4. Concurrent-edit safety:** Every commit step uses `./scripts/safe-commit.sh "msg" path1 path2` (per rule 5b). Multiple files in step → all listed in commit args.

**5. Risk acknowledged in spec §8:**
- Decimal precision (0.0 vs 0.00 vs 0): dict-eq tolerates; if real-impl swap fails composite gate, debug per C.1 step 3
- Map.of(3) Jackson hash order: golden recorded as ground truth; if Java upgrade changes order, re-record (explicit flow in A.1)
- F002 / qhj_prod 餐饮租户 finance Excel 没填 → empty path for now, PR-B fixes via sales fallback ✓ (in scope of PR-B, explicit out-of-scope here)

---

## Next steps after PR-A merged

1. Pull main, rebase same worktree on new origin/main.
2. Run `superpowers:writing-plans` again to draft PR-B plan (sales fallback + arithmetic depth).
3. Execute PR-B via `subagent-driven-development`.
4. Squash merge PR-B → cleanup worktree.

Sister chats blocked on this PR-A:
- `phase2a/t-finance-cost`: starts after PR-A merged — uses `_query_finance_data` + golden naming convention.
- `phase2a/t-finance-receivable`: same.
- `phase2a/t-finance-budget`: same.
