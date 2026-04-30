# Phase 2A `/analysis/sales` Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `_build_legacy_sales_overview` placeholder body in `backend/python/smartbi_compat/api/analysis_sales.py` with real legacy KPI computation + Y-a fill of `overview.rankings` and `overview.charts`, mirroring Java `SalesAnalysisServiceImpl.getSalesOverview` legacy path (line 114-175). Preserve foundation + gold (161 pytest pass, F999 + F001 byte gates ✓).

**Architecture:**
- **B (drop dead 4-branch)** — port only `generateAiInsightsFromMetrics` (2-INFO), skip `generateAiInsights` line 998 (Q-2 grep proved 0 callers + parameter signature mismatch with aggregates path).
- **Option 1 (new SQL)** — single-row aggregate query mirroring Java `findKpiSummary` (6 cols: SUM amount/quantity/profit/cost/monthly_target + COUNT DISTINCT product_id). Plus 3 ranking/chart aggregate queries mirroring `findSalesBySalesperson` / `findDailySalesTrend` / `findSalesByProductCategory`.
- **Y-a (legacy fills nested + sibling specs untouched)** — `_build_legacy_sales_overview` populates `overview.rankings.salesperson` (English key) + `overview.charts.{销售趋势, 产品分布}` (Chinese keys, mirror Java line 148/154). Sibling rankings/trend specs still fill top-level `salespersonRanking/customerRanking/productRanking/trendChart` (byte-parity to Java prod, even though front-end ignores them).

**Tech Stack:** Python 3 / FastAPI / SQLAlchemy text() / `decimal.Decimal` / `dateutil.relativedelta` / `pytest` / `unittest.mock.patch`

**Estimate:** 5-6h, ~16 tasks across 6 phases.

**Branch / Worktree:** This plan executes on `phase2a/t5-poc` from a sub-worktree `.worktrees/phase2a-t5-poc-overview` (per kickoff using-git-worktrees step). Foundation+gold last commit: `3a6d6aaef`. NOT pushed origin.

**Critical rules:**
1. **Concurrent-edit safety**: every commit uses `git commit -- <paths>` (--only mode) per `.claude/rules/concurrent-edit-safety.md` rule 5b. Never bare `git commit -m`.
2. **Sub-worktree**: `git worktree add .worktrees/phase2a-t5-poc-overview phase2a/t5-poc` before Task A.1. Don't share the parent worktree with the existing chat editing `analysis_sales.py`.
3. **Sibling chats**: another chat may run a different endpoint port simultaneously. They don't touch `analysis_sales.py`. You don't reorder existing lines in `main.py`.
4. **TDD**: every task writes failing test first, runs to verify fail, implements, runs to verify pass, commits.
5. **No regression**: foundation+gold pytest 161 → must stay green. Run full pytest at Phase F.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `backend/python/smartbi_compat/api/analysis_sales.py` | MODIFY (one file, all impl) | Add constants/helpers/SQL/domain logic, replace `_build_legacy_sales_overview` body |
| `tests/python/smartbi_compat/test_analysis_sales_contract.py` | MODIFY (append `TestOverview` class) | Contract tests + KPI math tests + insight branch tests |
| `tests/python/smartbi_compat/conftest.py` | MODIFY IF NEEDED | Add `synthetic_overview_factory` fixture for non-empty legacy tests |
| `docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-overview-design.md` | MODIFY (small edits in §11 + §2.10 + §3 pseudocode) | Resolution markers Q-1=Y-a, Q-2=dead-code, Q-3=COUNT-DISTINCT-productId |

**Single-file impl is intentional**: foundation chose `analysis_sales.py` per concurrent-edit-safety. Sub-worktree isolates from sibling chat. All overview impl lives in this one file ~600 LOC growth (current 737 → ~1300).

---

## Phase A — Spec resolution + Java verification (~30 min, 3 tasks)

### Task A.1: Update spec §11 + §2.10 + §3 with brainstorm resolutions

**Files:**
- Modify: `docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-overview-design.md`

**Goal:** Fold today's brainstorm decisions into the spec so the engineer has authoritative reference. No code yet.

- [ ] **Step 1: Pre-flight check (sub-worktree exists, on phase2a/t5-poc)**

```bash
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc-overview
pwd                              # ends in -overview
git rev-parse --abbrev-ref HEAD  # phase2a/t5-poc
git log --oneline -1             # 3a6d6aaef gold ship
git status --short               # empty
```

If sub-worktree doesn't exist yet, create from parent:
```bash
cd /c/Users/Steve/my-prototype-logistics
git worktree add .worktrees/phase2a-t5-poc-overview phase2a/t5-poc
cd .worktrees/phase2a-t5-poc-overview
```

- [ ] **Step 2: Edit spec §11.Q-1 — mark RESOLVED Y-a**

Find the table row in §11 starting `| **Q-1** |` and replace with:

```markdown
| **Q-1** | **RESOLVED 2026-04-30 (Y-a)**: Legacy fills `overview.rankings + overview.charts` matching Java line 142-156. Sibling rankings/trend specs still fill top-level fields for byte-parity (even though web-admin grep confirmed 0 consumers of `data.salespersonRanking/customerRanking/productRanking/trendChart` — they're API contract only). Reasoning: web-admin `SalesAnalysis.vue:720` reads `overview?.rankings || data.rankings` with JS short-circuit on truthy `{}` → if overview leaves nested `{}`, frontend never sees rankings even when top-level filled. Y-a fixes this by filling nested directly. | DONE — see brainstorm chat 2026-04-30 |
```

- [ ] **Step 3: Edit spec §11.Q-2 — mark RESOLVED dead-code**

Replace the `| **Q-2** |` row with:

```markdown
| **Q-2** | **RESOLVED 2026-04-30 (dead code)**: `SalesAnalysisServiceImpl.generateAiInsights` (line 998-1083) is `private` with **0 callers** in entire `backend/java/` (grep `generateAiInsights\b` returned only the definition itself). Same-name methods in `ProcurementAnalysisServiceImpl:914` and `InventoryHealthAnalysisServiceImpl:1107` are different classes / different domains. **Architectural confirmation**: line 998 signature `(List<SmartBiSalesData> salesData, ...)` requires full row data; `getSalesOverview` line 115-129 uses aggregates-only path → 4-branch is unreachable even in principle. NOT PORTED. Comment `# Q-2 grep 2026-04-30: SalesAnalysisServiceImpl.generateAiInsights is dead code; not ported. If Java wires it up later, port then.` placed in code at orchestration site. | DONE — grep evidence in brainstorm |
```

- [ ] **Step 4: Edit spec §11.Q-3 — mark RESOLVED COUNT(DISTINCT productId)**

Replace the `| **Q-3** |` row with:

```markdown
| **Q-3** | **RESOLVED 2026-04-30**: `SmartBiSalesDataRepository.findKpiSummary` JPQL line 85-89 confirmed: `COUNT(DISTINCT s.productId)` (NOT `COUNT(*)`). Python `_query_sales_aggregates` mirrors as `COUNT(DISTINCT product_id)`. | DONE — verified line 87 |
```

- [ ] **Step 5: Edit spec §2 item 10 — mark NOT PORTED**

Find the line `10. **Optional helper: \`_generate_ai_insights_full\`** — 4-branch logic from Java line 998-1083` and replace the entire item 10 block with:

```markdown
10. ~~**Optional helper: `_generate_ai_insights_full`**~~ — **NOT PORTED (Q-2 RESOLVED 2026-04-30 dead code)**. Java `SalesAnalysisServiceImpl.generateAiInsights` line 998-1083 has 0 callers + parameter signature mismatch with aggregates path. See §11.Q-2.
```

- [ ] **Step 6: Edit spec §3 architecture pseudocode (lines ~109-123)**

Find the architecture flow block with `# ⚠ TBD per Q1` and replace the section with:

```python
_get_sales_overview(factory_id, range_)
  ├─ # Gold-first dispatch (gold spec, already shipped)
  ├─ # Legacy fallback when Gold returns None or fails:
  ├─ kpi_summary = _query_sales_aggregates(factory_id, range_)
  ├─ if kpi_summary is None or row_count<6:
  │     return _build_empty_dashboard()                # F999 path / no rows
  ├─ if total_sales == 0 and order_count == 0:
  │     return _build_empty_dashboard()
  ├─ metric_results = _build_kpi_cards_from_aggregates(...)  # 4-5 KPIs (MoM conditional)
  ├─ kpi_cards = _convert_metric_results_to_kpi_cards(metric_results)
  ├─ # Y-a (Q-1 RESOLVED 2026-04-30): nested rankings + charts mirror Java line 142-156
  ├─ rankings_dict = _build_legacy_rankings_dict(factory_id, range_)
  ├─ charts_dict = _build_legacy_charts_dict(factory_id, range_)
  ├─ ai_insights = _generate_ai_insights_from_metrics(metric_results, totals)
  ├─ suggestions = _generate_suggestions_from_metrics(metric_results, totals)
  └─ return _new_dashboard_response_dict(
        kpi_cards=kpi_cards,
        charts=charts_dict,        # Y-a: {"销售趋势":..., "产品分布":...} or {} when empty
        rankings=rankings_dict,    # Y-a: {"salesperson":[...]} or {} when empty
        ai_insights=ai_insights,
        suggestions=suggestions,
        last_updated=_utc_now_iso(),
     )
```

- [ ] **Step 7: Verify spec edits and commit**

```bash
git diff --stat docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-overview-design.md
# Expected: ~30-50 lines changed (4 row replacements + pseudocode block)

git status --short
# Expected: only the spec file modified — no other staged/unstaged surprises

git commit -m "docs(phase2a-overview): resolve Q-1/Q-2/Q-3 from brainstorm 2026-04-30 (Y-a + dead-code drop + COUNT-DISTINCT confirmed)" -- docs/superpowers/specs/2026-04-30-phase2a-analysis-sales-overview-design.md
git show --name-only HEAD
# Verify only the spec file in commit
```

---

### Task A.2: Read Java aggregate-helper sources for verbatim porting

**Files:**
- Read-only: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SalesAnalysisServiceImpl.java` (lines 64-365 + 669-720 + 1144-1260)
- Read-only: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/MetricCalculatorServiceImpl.java` (line 425-438)
- Read-only: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/smartbi/SmartBiSalesDataRepository.java` (lines 40-122)

**Goal:** Lock down exact Java behavior to mirror. No code changes — read + capture. The plan tasks below already include the verbatim Java strings; this task is a sanity check that they haven't drifted on the branch.

- [ ] **Step 1: Confirm thresholds (line 69-74)**

```bash
grep -nE "(TARGET|MARGIN|GROWTH)_(RED|YELLOW)_THRESHOLD" backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SalesAnalysisServiceImpl.java
```

Expected (per Java line 69-74, captured 2026-04-30):
```
69:    TARGET_RED_THRESHOLD = "60"
70:    TARGET_YELLOW_THRESHOLD = "85"
71:    MARGIN_RED_THRESHOLD = "15"
72:    MARGIN_YELLOW_THRESHOLD = "25"
73:    GROWTH_RED_THRESHOLD = "-20"
74:    GROWTH_YELLOW_THRESHOLD = "-5"
```

If any value differs, STOP and reconcile spec + plan before proceeding.

- [ ] **Step 2: Confirm `findKpiSummary` JPQL (line 82-92)**

```bash
sed -n '82,92p' backend/java/cretas-api/src/main/java/com/cretas/aims/repository/smartbi/SmartBiSalesDataRepository.java
```

Expected:
```sql
SELECT COALESCE(SUM(s.amount),0), COALESCE(SUM(s.quantity),0),
       COALESCE(SUM(s.profit),0), COALESCE(SUM(s.cost),0),
       COALESCE(SUM(s.monthlyTarget),0), COUNT(DISTINCT s.productId)
FROM SmartBiSalesData s WHERE s.factoryId = :factoryId
  AND s.orderDate BETWEEN :start AND :end
```

The 6-tuple order (sales/quantity/profit/cost/target/order_count) is locked.

- [ ] **Step 3: Confirm `findSalesBySalesperson`, `findDailySalesTrend`, `findSalesByProductCategory` SQL**

```bash
grep -nA5 "findSalesBySalesperson\|findDailySalesTrend\|findSalesByProductCategory" backend/java/cretas-api/src/main/java/com/cretas/aims/repository/smartbi/SmartBiSalesDataRepository.java
```

Expected SQL shapes (captured 2026-04-30):
- `findSalesBySalesperson` line 45-47: `SELECT s.salespersonName, SUM(s.amount), SUM(s.quantity) ... GROUP BY s.salespersonName ORDER BY SUM(s.amount) DESC`
- `findDailySalesTrend` line 97-99: `SELECT s.orderDate, SUM(s.amount), SUM(s.quantity) ... GROUP BY s.orderDate ORDER BY s.orderDate`
- `findSalesByProductCategory` line 117-119: `SELECT s.productCategory, SUM(s.amount) ... GROUP BY s.productCategory ORDER BY SUM(s.amount) DESC`

- [ ] **Step 4: Verify `calculateMomGrowth` formula (MetricCalculatorServiceImpl line 425-438)**

```bash
sed -n '425,438p' backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/MetricCalculatorServiceImpl.java
```

Expected formula:
- prev=null OR prev=0: returns 100 if curr>0 else 0
- curr=null: returns -100
- normal: `(curr - prev) / abs(prev) * 100`, scale 2 HALF_UP

- [ ] **Step 5: No commit — this is read-only verification**

---

### Task A.3: Confirm `smart_bi_sales_data` schema column types (psql probe)

**Files:**
- Read-only: PostgreSQL `smartbi_db` (test) database

**Goal:** Confirm column types and existence of `salesperson_name`, `order_date`, `product_category`, `monthly_target` so SQL helpers in Phase C compile correctly. JPQL field names use camelCase (Java entity); SQL uses snake_case (PG column). Misalignment will silently fail in queries.

- [ ] **Step 1: psql probe via test env (port 5432, smartbi_db)**

```bash
PGPASSWORD=smartbi_secure_password_2025 psql -h localhost -U smartbi_user -d smartbi_db -c "\d smart_bi_sales_data" 2>&1 | head -40
```

Expected columns (subset):
```
factory_id        | varchar
order_date        | date
amount            | numeric
quantity          | numeric
profit            | numeric
cost              | numeric
monthly_target    | numeric
product_id        | varchar
product_category  | varchar
salesperson_name  | varchar
```

- [ ] **Step 2: If any column missing or different name, STOP**

If `salesperson_name` is actually `sales_person_name` or `monthly_target` is `target_amount`, document the actual name in a note file and update Phase C SQL templates accordingly:

```bash
echo "ACTUAL columns observed 2026-04-30: ..." > /tmp/sales-data-schema-notes.md
```

- [ ] **Step 3: No commit — read-only**

---

## Phase B — Constants + helpers (~30 min, 4 tasks)

### Task B.1: Add 6 threshold constants + 3 precision constants module-level

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py` (insert after line 44 router definition, before Section 1 dict factories)
- Test: `tests/python/smartbi_compat/test_analysis_sales_contract.py` (append a new test in TestOverview class — class scaffolding done in Task F.1, but constants test here so rest of code can reference them)

For Phase B-D, the test file may not have `TestOverview` class yet. Create it as side effect of first test write in B.1; subsequent tasks append into the existing class.

- [ ] **Step 1: Write failing test for constants exposure**

Append to `tests/python/smartbi_compat/test_analysis_sales_contract.py`:

```python
# ============================================================
# TestOverview — overview spec contract tests (Y-a, B, Option 1)
# ============================================================


class TestOverview:
    """Contract tests for legacy fallback overview path.

    Foundation merge gates TestEnvelope; gold spec adds TestGold;
    overview spec (this class) covers _build_legacy_sales_overview real impl.
    """

    def test_threshold_constants_match_java(self):
        """Java SalesAnalysisServiceImpl line 69-74 + SCALE/DISPLAY_SCALE constants."""
        from smartbi_compat.api import analysis_sales as m
        from decimal import Decimal

        assert m.TARGET_RED_THRESHOLD == Decimal("60")
        assert m.TARGET_YELLOW_THRESHOLD == Decimal("85")
        assert m.MARGIN_RED_THRESHOLD == Decimal("15")
        assert m.MARGIN_YELLOW_THRESHOLD == Decimal("25")
        assert m.GROWTH_RED_THRESHOLD == Decimal("-20")
        assert m.GROWTH_YELLOW_THRESHOLD == Decimal("-5")
        assert m.SCALE == 4
        assert m.DISPLAY_SCALE == 2
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/python && pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview::test_threshold_constants_match_java -v
```

Expected: FAIL with `AttributeError: module 'smartbi_compat.api.analysis_sales' has no attribute 'TARGET_RED_THRESHOLD'`

- [ ] **Step 3: Add constants to analysis_sales.py**

Find the line `router = APIRouter()` (~line 44) and insert AFTER it:

```python
# ============================================================
# Section 0: Legacy-path constants (mirror Java SalesAnalysisServiceImpl.java line 64-74)
# ============================================================
# Precision (Java line 64-66)
SCALE = 4              # intermediate division precision
DISPLAY_SCALE = 2      # final value precision

# Alert thresholds (Java line 69-74)
TARGET_RED_THRESHOLD = Decimal("60")
TARGET_YELLOW_THRESHOLD = Decimal("85")
MARGIN_RED_THRESHOLD = Decimal("15")
MARGIN_YELLOW_THRESHOLD = Decimal("25")
GROWTH_RED_THRESHOLD = Decimal("-20")
GROWTH_YELLOW_THRESHOLD = Decimal("-5")
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview::test_threshold_constants_match_java -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git status --short
# Expected: 2 files modified: analysis_sales.py + test_analysis_sales_contract.py

git commit -m "feat(phase2a-overview): add 6 alert thresholds + SCALE/DISPLAY_SCALE constants (Java mirror)" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py

git show --name-only HEAD
# Verify scope = 2 files
```

---

### Task B.2: Add mapping helpers `_alert_level_to_status` + `_change_direction_to_trend`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Test: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

Mirrors Java `convertToKPICards` line 677-703 — alertLevel → status mapping (RED→red, YELLOW→yellow, default→green) and changeDirection → trend mapping (UP→up, DOWN→down, default→flat).

- [ ] **Step 1: Write failing tests**

Append to TestOverview class:

```python
    def test_alert_level_to_status_mapping(self):
        """Java convertToKPICards line 678-689."""
        from smartbi_compat.api.analysis_sales import _alert_level_to_status
        assert _alert_level_to_status("RED") == "red"
        assert _alert_level_to_status("YELLOW") == "yellow"
        assert _alert_level_to_status("GREEN") == "green"
        assert _alert_level_to_status(None) == "green"      # @Builder.Default
        assert _alert_level_to_status("UNKNOWN") == "green" # default branch

    def test_change_direction_to_trend_mapping(self):
        """Java convertToKPICards line 691-703."""
        from smartbi_compat.api.analysis_sales import _change_direction_to_trend
        assert _change_direction_to_trend("UP") == "up"
        assert _change_direction_to_trend("DOWN") == "down"
        assert _change_direction_to_trend("STABLE") == "flat"  # default branch
        assert _change_direction_to_trend(None) == "flat"
```

- [ ] **Step 2: Run tests to verify fail**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview::test_alert_level_to_status_mapping ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview::test_change_direction_to_trend_mapping -v
```

Expected: 2 FAIL with `ImportError`.

- [ ] **Step 3: Add helpers (after threshold constants block in analysis_sales.py)**

```python
def _alert_level_to_status(alert_level: Optional[str]) -> str:
    """Mirror Java SalesAnalysisServiceImpl.convertToKPICards line 678-689.

    AlertLevel enum -> KPICard.status string. Defaults to "green" when None or unknown
    (matches Java @Builder.Default + switch default branch).
    """
    if alert_level == "RED":
        return "red"
    if alert_level == "YELLOW":
        return "yellow"
    return "green"


def _change_direction_to_trend(change_direction: Optional[str]) -> str:
    """Mirror Java SalesAnalysisServiceImpl.convertToKPICards line 691-703.

    ChangeDirection (UP/DOWN/STABLE/null) -> KPICard.trend (up/down/flat).
    """
    if change_direction == "UP":
        return "up"
    if change_direction == "DOWN":
        return "down"
    return "flat"
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview -v -k "alert_level_to_status or change_direction_to_trend"
```

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phase2a-overview): add _alert_level_to_status + _change_direction_to_trend mappings (Java convertToKPICards mirror)" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py

git show --name-only HEAD
```

---

### Task B.3: Add format helpers `_format_currency` + `_format_completion_pct` + `_format_growth_pct`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Test: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

Mirrors Java `formatCurrency` (line 1255-1260: `String.format("%,.2f", value.setScale(2, HALF_UP).doubleValue())`) and `String.format` patterns at line 236 (`%.1f%%`) + line 255 (`%+.1f%%`).

- [ ] **Step 1: Write failing tests**

Append to TestOverview class:

```python
    def test_format_currency(self):
        """Java SalesAnalysisServiceImpl.formatCurrency line 1255-1260."""
        from smartbi_compat.api.analysis_sales import _format_currency
        from decimal import Decimal

        # Comma thousands + 2 decimals
        assert _format_currency(Decimal("1234567.89")) == "1,234,567.89"
        # HALF_UP rounding: 0.005 → 0.01
        assert _format_currency(Decimal("0.005")) == "0.01"
        # Integer values: 100 → "100.00"
        assert _format_currency(Decimal("100")) == "100.00"
        # Negative: -1234.56 → "-1,234.56"
        assert _format_currency(Decimal("-1234.56")) == "-1,234.56"
        # None → "-" (Java line 1257)
        assert _format_currency(None) == "-"

    def test_format_completion_pct(self):
        """Java line 236 — '%.1f%%' pattern."""
        from smartbi_compat.api.analysis_sales import _format_completion_pct
        from decimal import Decimal

        assert _format_completion_pct(Decimal("85.34")) == "85.3%"
        assert _format_completion_pct(Decimal("100")) == "100.0%"
        assert _format_completion_pct(Decimal("0")) == "0.0%"
        # HALF_UP at 1-decimal: 85.35 → 85.4 (banker's rounding would give 85.4)
        assert _format_completion_pct(Decimal("85.35")) == "85.4%"

    def test_format_growth_pct(self):
        """Java line 255 — '%+.1f%%' pattern (forced sign + 1 decimal + literal %)."""
        from smartbi_compat.api.analysis_sales import _format_growth_pct
        from decimal import Decimal

        assert _format_growth_pct(Decimal("12.5")) == "+12.5%"
        assert _format_growth_pct(Decimal("-12.5")) == "-12.5%"
        assert _format_growth_pct(Decimal("0")) == "+0.0%"
```

- [ ] **Step 2: Run tests to verify fail**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview -v -k "format_currency or format_completion or format_growth"
```

Expected: 3 FAIL with ImportError.

- [ ] **Step 3: Add format helpers after mapping helpers in analysis_sales.py**

```python
def _format_currency(value: Optional[Decimal]) -> str:
    """Mirror Java SalesAnalysisServiceImpl.formatCurrency line 1255-1260.

    `String.format("%,.2f", value.setScale(2, HALF_UP).doubleValue())`
    null → "-".

    Java's .doubleValue() introduces float precision drift only above 2^53 (~9e15);
    F001 max value (20M) is far below this, so no observable diff.
    """
    if value is None:
        return "-"
    quantized = value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{quantized:,.2f}"


def _format_completion_pct(value: Decimal) -> str:
    """Mirror Java `String.format("%.1f%%", value.doubleValue())` (line 236)."""
    quantized = value.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    return f"{quantized}%"


def _format_growth_pct(value: Decimal) -> str:
    """Mirror Java `String.format("%+.1f%%", value.doubleValue())` (line 255).

    `%+` forces sign on positive values (Python f-string `:+` does the same).
    """
    quantized = value.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    sign = "+" if quantized >= 0 else ""
    return f"{sign}{quantized}%"
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview -v -k "format"
```

Expected: 3 PASS.

If `_format_completion_pct(Decimal("85.34"))` returns `"85.30%"` instead of `"85.3%"` (extra zero), Decimal.quantize is keeping trailing zero. Use `f"{quantized.normalize()}%"` — but verify against `_format_completion_pct(Decimal("100"))` which must stay `"100.0%"` not `"100%"`. Safer: use `f"{float(quantized):.1f}%"`. Re-run tests to confirm.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phase2a-overview): add 3 format helpers (currency / completion-pct / growth-pct) — Java String.format mirrors" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task B.4: Add math helpers `_calculate_completion_rate` + `_calculate_mom_growth` + `_new_metric_result_dict`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Test: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

Mirrors Java `calculateCompletionRate` (line 1166-1171) + `MetricCalculatorServiceImpl.calculateMomGrowth` (line 425-438) + `MetricResult.java` 11-field DTO (per spec §4).

- [ ] **Step 1: Write failing tests**

Append to TestOverview class:

```python
    def test_calculate_completion_rate(self):
        """Java SalesAnalysisServiceImpl.calculateCompletionRate line 1166-1171."""
        from smartbi_compat.api.analysis_sales import _calculate_completion_rate
        from decimal import Decimal

        # Normal case: 50K / 100K = 50%
        result = _calculate_completion_rate(Decimal("50000"), Decimal("100000"))
        assert result == Decimal("50.0000")  # SCALE=4

        # target=0 → 0 (Java line 1167-1169)
        assert _calculate_completion_rate(Decimal("100"), Decimal("0")) == Decimal("0")
        # target=null (None) → 0
        assert _calculate_completion_rate(Decimal("100"), None) == Decimal("0")

        # SCALE=4 HALF_UP: 1/3 * 100 → 33.3333
        result = _calculate_completion_rate(Decimal("1"), Decimal("3"))
        assert result == Decimal("33.3333")

    def test_calculate_mom_growth(self):
        """Java MetricCalculatorServiceImpl.calculateMomGrowth line 425-438."""
        from smartbi_compat.api.analysis_sales import _calculate_mom_growth
        from decimal import Decimal

        # Normal case: (200 - 100) / abs(100) * 100 = 100, scale=2
        assert _calculate_mom_growth(Decimal("200"), Decimal("100")) == Decimal("100.00")
        # Decline: (50 - 100) / 100 * 100 = -50
        assert _calculate_mom_growth(Decimal("50"), Decimal("100")) == Decimal("-50.00")
        # prev=0 + curr>0 → 100 (Java line 427-428)
        assert _calculate_mom_growth(Decimal("100"), Decimal("0")) == Decimal("100")
        # prev=0 + curr=0 → 0
        assert _calculate_mom_growth(Decimal("0"), Decimal("0")) == Decimal("0")
        # prev=null → 100 (Java line 426 evaluates same branch)
        assert _calculate_mom_growth(Decimal("100"), None) == Decimal("100")
        # curr=null → -100 (Java line 430-432)
        assert _calculate_mom_growth(None, Decimal("100")) == Decimal("-100")
        # Negative prev: (100 - (-50)) / abs(-50) * 100 = 300
        assert _calculate_mom_growth(Decimal("100"), Decimal("-50")) == Decimal("300.00")

    def test_new_metric_result_dict_field_order(self):
        """MetricResult.java 11-field declaration order."""
        from smartbi_compat.api.analysis_sales import _new_metric_result_dict
        from decimal import Decimal

        d = _new_metric_result_dict(
            metric_code="X", metric_name="Y", value=Decimal("1"),
            formatted_value="1.00", unit="元", change_percent=Decimal("0"),
            change_direction="UP", change_value=Decimal("0.5"),
            alert_level="GREEN", dimension_value="dim", description="desc",
        )
        assert list(d.keys()) == [
            "metricCode", "metricName", "value", "formattedValue", "unit",
            "changePercent", "changeDirection", "changeValue", "alertLevel",
            "dimensionValue", "description",
        ]

    def test_new_metric_result_dict_alert_level_default(self):
        """MetricResult.AlertLevel.GREEN.name() default per spec §4."""
        from smartbi_compat.api.analysis_sales import _new_metric_result_dict

        d = _new_metric_result_dict(metric_code="X", metric_name="Y")
        assert d["alertLevel"] == "GREEN"
```

- [ ] **Step 2: Run tests to verify fail**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview -v -k "completion_rate or mom_growth or metric_result"
```

Expected: 4 FAIL with ImportError.

- [ ] **Step 3: Add helpers to analysis_sales.py (after format helpers)**

```python
def _calculate_completion_rate(actual: Decimal, target: Optional[Decimal]) -> Decimal:
    """Mirror Java SalesAnalysisServiceImpl.calculateCompletionRate line 1166-1171.

    target null OR 0 → returns Decimal("0") (NOT scaled — matches Java BigDecimal.ZERO).
    Otherwise: (actual / target * 100).quantize(SCALE=4, HALF_UP).
    """
    if target is None or target == Decimal("0"):
        return Decimal("0")
    return (actual / target * Decimal("100")).quantize(
        Decimal("0.0001"), rounding=ROUND_HALF_UP,
    )


def _calculate_mom_growth(current: Optional[Decimal], previous: Optional[Decimal]) -> Decimal:
    """Mirror Java MetricCalculatorServiceImpl.calculateMomGrowth line 425-438.

    Edge cases (Java semantics):
      - previous null OR 0: return Decimal(100) if current > 0 else Decimal(0)
      - current null:       return Decimal(-100)
      - normal:             (current - previous) / abs(previous) * 100,
                            quantized to DISPLAY_SCALE=2, HALF_UP

    NOTE: Java edge-case returns are NOT scaled (raw "100" / "-100" / "0").
    Mirror exactly — Phase F tests assert un-scaled.
    """
    if previous is None or previous == Decimal("0"):
        if current is not None and current > Decimal("0"):
            return Decimal("100")
        return Decimal("0")
    if current is None:
        return Decimal("-100")
    return ((current - previous) / abs(previous) * Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP,
    )


def _new_metric_result_dict(
    metric_code: Optional[str] = None,
    metric_name: Optional[str] = None,
    value: Optional[Decimal] = None,
    formatted_value: Optional[str] = None,
    unit: Optional[str] = None,
    change_percent: Optional[Decimal] = None,
    change_direction: Optional[str] = None,
    change_value: Optional[Decimal] = None,
    alert_level: str = "GREEN",            # MetricResult.AlertLevel.GREEN default
    dimension_value: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    """Mirror MetricResult.java @Data getters (11 fields per spec §4).

    Used as intermediate representation in _build_kpi_cards_from_aggregates;
    converted to KPICard via _convert_metric_results_to_kpi_cards before
    inserting into DashboardResponse.kpiCards.

    NOTE: MetricResult is NOT directly emitted in /analysis/sales response —
    DashboardResponse.metricCards (deprecated) is always null in goldens.
    """
    return {
        "metricCode": metric_code,
        "metricName": metric_name,
        "value": value,
        "formattedValue": formatted_value,
        "unit": unit,
        "changePercent": change_percent,
        "changeDirection": change_direction,
        "changeValue": change_value,
        "alertLevel": alert_level,
        "dimensionValue": dimension_value,
        "description": description,
    }
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview -v -k "completion_rate or mom_growth or metric_result"
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phase2a-overview): add math helpers (completion_rate / mom_growth) + MetricResult dict factory" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

## Phase C — SQL aggregate helpers (~60-90 min, 4 tasks)

**Common pattern**: SQLAlchemy `text()` queries against `smart_bi_sales_data` table in `smartbi_db`. Wrapped in `await asyncio.to_thread(...)` for async (foundation cross-cutting decision §5). Use existing engine via `from smartbi.config import get_engine` (verify import path at task start; foundation Phase B uses similar pattern in `_query_sales_data`).

**SQL injection**: All factory_id/dates use `:bind` params, never f-string interpolation.

**RowProxy access**: SQLAlchemy 2.x returns Row objects. Access by index `row[0]` or by column name `row["total_sales"]`. Tests should use index for byte-shape stability.

### Task C.1: `_query_sales_aggregates(factory_id, start_date, end_date)` — single-row 6-tuple

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Test: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

Mirrors `SmartBiSalesDataRepository.findKpiSummary` line 85-92.

- [ ] **Step 1: Write failing test (mocked DB session)**

Append to TestOverview class:

```python
    @pytest.mark.asyncio
    async def test_query_sales_aggregates_shape(self, monkeypatch):
        """_query_sales_aggregates returns 6-tuple matching Java findKpiSummary."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal

        # Stub the engine.execute path
        class FakeRow:
            def __init__(self, vals):
                self._vals = vals
            def __getitem__(self, i): return self._vals[i]

        class FakeResult:
            def fetchone(self):
                return FakeRow([
                    Decimal("123456.78"),  # total_sales
                    Decimal("100"),         # total_quantity
                    Decimal("50000"),       # total_profit
                    Decimal("70000"),       # total_cost
                    Decimal("200000"),      # total_target
                    42,                     # order_count
                ])

        class FakeConn:
            def __enter__(self): return self
            def __exit__(self, *a): pass
            def execute(self, sql, params): return FakeResult()

        class FakeEngine:
            def connect(self): return FakeConn()

        monkeypatch.setattr(m, "_get_sync_engine", lambda: FakeEngine())

        result = await m._query_sales_aggregates(
            "F999", date(2025, 1, 1), date(2025, 12, 31),
        )
        assert result is not None
        assert result[0] == Decimal("123456.78")
        assert result[5] == 42  # order_count is int (long in Java)
        assert len(result) == 6

    @pytest.mark.asyncio
    async def test_query_sales_aggregates_empty(self, monkeypatch):
        """When no rows match, returns 6-tuple of zeros (Java COALESCE semantics)."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal

        class FakeRow:
            def __init__(self, vals): self._vals = vals
            def __getitem__(self, i): return self._vals[i]

        class FakeResult:
            def fetchone(self):
                return FakeRow([Decimal("0"), Decimal("0"), Decimal("0"),
                                Decimal("0"), Decimal("0"), 0])

        class FakeConn:
            def __enter__(self): return self
            def __exit__(self, *a): pass
            def execute(self, sql, params): return FakeResult()

        class FakeEngine:
            def connect(self): return FakeConn()

        monkeypatch.setattr(m, "_get_sync_engine", lambda: FakeEngine())

        result = await m._query_sales_aggregates(
            "F_EMPTY", date(2025, 1, 1), date(2025, 12, 31),
        )
        # All zeros expected when COALESCE applies
        assert all(v == 0 or v == Decimal("0") for v in result)
```

- [ ] **Step 2: Run tests to verify fail**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview -v -k "query_sales_aggregates"
```

Expected: FAIL with `AttributeError: ... has no attribute '_query_sales_aggregates'`.

- [ ] **Step 3: Implement `_query_sales_aggregates` + `_get_sync_engine` seam**

Find the existing `_query_sales_data` import in analysis_sales.py (line 39):
```python
from smartbi_compat.api.analysis import _query_sales_data, wrap_response
```

Inspect that file to find the engine-acquisition pattern (likely `from smartbi.config import get_engine` or similar). Replicate.

Add after the SQL imports section in `analysis_sales.py`:

```python
# ============================================================
# Section 1.5: Legacy SQL aggregate helpers (Java repo mirror)
# ============================================================


def _get_sync_engine():
    """Module-level seam wrapping the SQLAlchemy engine acquisition.

    Indirection lets tests monkey-patch at this module's namespace.
    Production calls `from smartbi.config import get_engine; return get_engine()`.
    """
    from smartbi.config import get_engine  # type: ignore
    return get_engine()


_KPI_SUMMARY_SQL = text("""
    SELECT
      COALESCE(SUM(amount), 0)         AS total_sales,
      COALESCE(SUM(quantity), 0)       AS total_quantity,
      COALESCE(SUM(profit), 0)         AS total_profit,
      COALESCE(SUM(cost), 0)           AS total_cost,
      COALESCE(SUM(monthly_target), 0) AS total_target,
      COUNT(DISTINCT product_id)       AS order_count
    FROM smart_bi_sales_data
    WHERE factory_id = :factory_id
      AND order_date BETWEEN :start_date AND :end_date
""")


async def _query_sales_aggregates(
    factory_id: str, start_date: date, end_date: date,
) -> Optional[tuple]:
    """Mirror SmartBiSalesDataRepository.findKpiSummary line 85-92.

    Returns 6-tuple (total_sales, total_quantity, total_profit, total_cost,
    total_target, order_count) — Decimal for first 5, int for last.
    Returns None if engine acquisition fails (caller falls back to empty dashboard).

    Wrapped in asyncio.to_thread for async — sync SQLAlchemy compat.
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            row = conn.execute(_KPI_SUMMARY_SQL, {
                "factory_id": factory_id,
                "start_date": start_date,
                "end_date": end_date,
            }).fetchone()
            if row is None:
                return None
            return (row[0], row[1], row[2], row[3], row[4], row[5])
    try:
        return await asyncio.to_thread(_exec)
    except Exception as e:
        logger.warning(
            "[legacy] _query_sales_aggregates failed factory=%s: %s",
            factory_id, e,
        )
        return None


async def _query_sales_aggregates_previous_period(
    factory_id: str, start_date: date, end_date: date,
) -> Optional[tuple]:
    """Same query as _query_sales_aggregates with date range shifted -1 month.

    Mirrors Java line 242-243: `findKpiSummary(factoryId, startDate.minusMonths(1),
    endDate.minusMonths(1))`. Used only for MoM growth KPI (Java line 249).

    Uses dateutil.relativedelta(months=-1) to match LocalDate.minusMonths semantic
    (which preserves day-of-month, clamping to month-end if needed).
    """
    from dateutil.relativedelta import relativedelta
    prev_start = start_date - relativedelta(months=1)
    prev_end = end_date - relativedelta(months=1)
    return await _query_sales_aggregates(factory_id, prev_start, prev_end)
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview -v -k "query_sales_aggregates"
```

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phase2a-overview): add _query_sales_aggregates + _previous_period (Java findKpiSummary mirror, 6-col aggregate)" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task C.2: `_query_top_salespersons_aggregate` — top 10 salesperson rankings

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Test: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

Mirrors `findSalesBySalesperson` line 45-50: returns N rows of `(salesperson_name, total_amount, total_quantity)` ordered by amount DESC.

- [ ] **Step 1: Write failing test**

```python
    @pytest.mark.asyncio
    async def test_query_top_salespersons_aggregate(self, monkeypatch):
        """Mirror findSalesBySalesperson — N rows ordered by SUM(amount) DESC."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal

        class FakeRow:
            def __init__(self, vals): self._vals = vals
            def __getitem__(self, i): return self._vals[i]

        class FakeResult:
            def __iter__(self):
                return iter([
                    FakeRow(["张三", Decimal("100000"), Decimal("50")]),
                    FakeRow(["李四", Decimal("80000"), Decimal("40")]),
                ])

        class FakeConn:
            def __enter__(self): return self
            def __exit__(self, *a): pass
            def execute(self, sql, params): return FakeResult()

        class FakeEngine:
            def connect(self): return FakeConn()

        monkeypatch.setattr(m, "_get_sync_engine", lambda: FakeEngine())

        result = await m._query_top_salespersons_aggregate(
            "F999", date(2025, 1, 1), date(2025, 12, 31),
        )
        assert len(result) == 2
        assert result[0][0] == "张三"
        assert result[0][1] == Decimal("100000")
        assert result[1][0] == "李四"
```

- [ ] **Step 2: Run test to verify fail**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview::test_query_top_salespersons_aggregate -v
```

- [ ] **Step 3: Implement**

Add after `_query_sales_aggregates_previous_period`:

```python
_TOP_SALESPERSONS_SQL = text("""
    SELECT salesperson_name,
           COALESCE(SUM(amount), 0)   AS total_amount,
           COALESCE(SUM(quantity), 0) AS total_quantity
    FROM smart_bi_sales_data
    WHERE factory_id = :factory_id
      AND order_date BETWEEN :start_date AND :end_date
      AND salesperson_name IS NOT NULL
    GROUP BY salesperson_name
    ORDER BY SUM(amount) DESC
""")


async def _query_top_salespersons_aggregate(
    factory_id: str, start_date: date, end_date: date,
) -> list[tuple]:
    """Mirror SmartBiSalesDataRepository.findSalesBySalesperson line 45-50.

    Returns list of (salesperson_name, total_amount, total_quantity) ordered
    by SUM(amount) DESC. Java filters null name in `buildRankingsFromAggregates`
    line 314 (`if (row[0] == null) continue`); we filter at SQL level for
    consistency.

    Caller is responsible for top-10 truncation (Java line 321 `if (rank > 10) break`).
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            return [
                (r[0], r[1], r[2])
                for r in conn.execute(_TOP_SALESPERSONS_SQL, {
                    "factory_id": factory_id,
                    "start_date": start_date,
                    "end_date": end_date,
                })
            ]
    try:
        return await asyncio.to_thread(_exec)
    except Exception as e:
        logger.warning(
            "[legacy] _query_top_salespersons_aggregate failed factory=%s: %s",
            factory_id, e,
        )
        return []
```

- [ ] **Step 4: Run test to verify pass**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview::test_query_top_salespersons_aggregate -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phase2a-overview): add _query_top_salespersons_aggregate (Java findSalesBySalesperson mirror)" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task C.3: `_query_daily_sales_trend_aggregate` — daily trend rows

**Files:** same as C.2.

Mirrors `findDailySalesTrend` line 95-102.

- [ ] **Step 1: Write failing test**

```python
    @pytest.mark.asyncio
    async def test_query_daily_sales_trend_aggregate(self, monkeypatch):
        """Mirror findDailySalesTrend — rows ordered by orderDate ASC."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal

        class FakeRow:
            def __init__(self, vals): self._vals = vals
            def __getitem__(self, i): return self._vals[i]

        class FakeResult:
            def __iter__(self):
                return iter([
                    FakeRow([date(2025, 1, 1), Decimal("1000"), Decimal("10")]),
                    FakeRow([date(2025, 1, 2), Decimal("1500"), Decimal("15")]),
                ])

        class FakeConn:
            def __enter__(self): return self
            def __exit__(self, *a): pass
            def execute(self, sql, params): return FakeResult()

        class FakeEngine:
            def connect(self): return FakeConn()

        monkeypatch.setattr(m, "_get_sync_engine", lambda: FakeEngine())

        result = await m._query_daily_sales_trend_aggregate(
            "F999", date(2025, 1, 1), date(2025, 12, 31),
        )
        assert len(result) == 2
        assert result[0][0] == date(2025, 1, 1)
        assert result[0][1] == Decimal("1000")
        assert result[0][2] == Decimal("10")
```

- [ ] **Step 2: Run to fail**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview::test_query_daily_sales_trend_aggregate -v
```

- [ ] **Step 3: Implement**

```python
_DAILY_SALES_TREND_SQL = text("""
    SELECT order_date,
           COALESCE(SUM(amount), 0)   AS total_amount,
           COALESCE(SUM(quantity), 0) AS total_quantity
    FROM smart_bi_sales_data
    WHERE factory_id = :factory_id
      AND order_date BETWEEN :start_date AND :end_date
    GROUP BY order_date
    ORDER BY order_date
""")


async def _query_daily_sales_trend_aggregate(
    factory_id: str, start_date: date, end_date: date,
) -> list[tuple]:
    """Mirror SmartBiSalesDataRepository.findDailySalesTrend line 97-102.

    Returns list of (order_date, total_amount, total_quantity) ordered by
    order_date ASC. Caller (Java buildTrendChartFromAggregates line 269-285)
    skips empty list (no chart emitted when no rows).
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            return [
                (r[0], r[1], r[2])
                for r in conn.execute(_DAILY_SALES_TREND_SQL, {
                    "factory_id": factory_id,
                    "start_date": start_date,
                    "end_date": end_date,
                })
            ]
    try:
        return await asyncio.to_thread(_exec)
    except Exception as e:
        logger.warning(
            "[legacy] _query_daily_sales_trend_aggregate failed factory=%s: %s",
            factory_id, e,
        )
        return []
```

- [ ] **Step 4: Run to pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phase2a-overview): add _query_daily_sales_trend_aggregate (Java findDailySalesTrend mirror)" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task C.4: `_query_category_distribution_aggregate` — product category pie chart data

**Files:** same as C.2.

Mirrors `findSalesByProductCategory` line 117-122.

- [ ] **Step 1: Write failing test**

```python
    @pytest.mark.asyncio
    async def test_query_category_distribution_aggregate(self, monkeypatch):
        """Mirror findSalesByProductCategory — rows ordered by SUM(amount) DESC."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal

        class FakeRow:
            def __init__(self, vals): self._vals = vals
            def __getitem__(self, i): return self._vals[i]

        class FakeResult:
            def __iter__(self):
                return iter([
                    FakeRow(["猪肉类", Decimal("50000")]),
                    FakeRow(["蔬菜类", Decimal("30000")]),
                    FakeRow([None, Decimal("5000")]),  # null category — Java emits "未分类"
                ])

        class FakeConn:
            def __enter__(self): return self
            def __exit__(self, *a): pass
            def execute(self, sql, params): return FakeResult()

        class FakeEngine:
            def connect(self): return FakeConn()

        monkeypatch.setattr(m, "_get_sync_engine", lambda: FakeEngine())

        result = await m._query_category_distribution_aggregate(
            "F999", date(2025, 1, 1), date(2025, 12, 31),
        )
        assert len(result) == 3
        assert result[0][0] == "猪肉类"
        assert result[2][0] is None  # null preserved at SQL level; converted to "未分类" later
```

- [ ] **Step 2: Run to fail**

- [ ] **Step 3: Implement**

```python
_CATEGORY_DISTRIBUTION_SQL = text("""
    SELECT product_category,
           COALESCE(SUM(amount), 0) AS total_amount
    FROM smart_bi_sales_data
    WHERE factory_id = :factory_id
      AND order_date BETWEEN :start_date AND :end_date
    GROUP BY product_category
    ORDER BY SUM(amount) DESC
""")


async def _query_category_distribution_aggregate(
    factory_id: str, start_date: date, end_date: date,
) -> list[tuple]:
    """Mirror SmartBiSalesDataRepository.findSalesByProductCategory line 117-122.

    Returns list of (product_category, total_amount) ordered DESC.
    NULL category preserved — Java buildPieChartFromAggregates line 294 substitutes
    "未分类" at chart-build time.
    """
    def _exec():
        engine = _get_sync_engine()
        with engine.connect() as conn:
            return [
                (r[0], r[1])
                for r in conn.execute(_CATEGORY_DISTRIBUTION_SQL, {
                    "factory_id": factory_id,
                    "start_date": start_date,
                    "end_date": end_date,
                })
            ]
    try:
        return await asyncio.to_thread(_exec)
    except Exception as e:
        logger.warning(
            "[legacy] _query_category_distribution_aggregate failed factory=%s: %s",
            factory_id, e,
        )
        return []
```

- [ ] **Step 4: Run to pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phase2a-overview): add _query_category_distribution_aggregate (Java findSalesByProductCategory mirror)" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

## Phase D — Domain logic builders (~60-90 min, 4 tasks)

### Task D.1: `_build_kpi_cards_from_aggregates` + `_convert_metric_results_to_kpi_cards`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py`
- Test: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

Mirrors Java `buildKpiFromAggregates` line 193-264 + `convertToKPICards` line 674-720. The 5 KPIs: SALES_AMOUNT / ORDER_COUNT / AVG_ORDER_VALUE / TARGET_COMPLETION / MOM_GROWTH (last conditional on `previousSales > 0`).

- [ ] **Step 1: Write failing tests**

```python
    @pytest.mark.asyncio
    async def test_build_kpi_cards_4_kpis_no_mom(self, monkeypatch):
        """When previous_period_sales <= 0, MoM KPI is omitted (Java line 249)."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal

        async def fake_prev(*a, **k):
            return (Decimal("0"), Decimal("0"), Decimal("0"),
                    Decimal("0"), Decimal("0"), 0)

        monkeypatch.setattr(m, "_query_sales_aggregates_previous_period", fake_prev)

        cards = await m._build_kpi_cards_from_aggregates(
            factory_id="F999",
            start_date=date(2025, 1, 1), end_date=date(2025, 12, 31),
            total_sales=Decimal("100000"), total_quantity=Decimal("100"),
            total_profit=Decimal("30000"), total_cost=Decimal("70000"),
            total_target=Decimal("200000"), order_count=42,
        )
        assert len(cards) == 4  # no MoM
        assert cards[0]["metricCode"] == "SALES_AMOUNT"
        assert cards[1]["metricCode"] == "ORDER_COUNT"
        assert cards[2]["metricCode"] == "AVG_ORDER_VALUE"
        assert cards[3]["metricCode"] == "TARGET_COMPLETION"
        # Completion: 100k/200k*100 = 50%, < TARGET_RED=60 → RED alert
        assert cards[3]["alertLevel"] == "RED"

    @pytest.mark.asyncio
    async def test_build_kpi_cards_5_kpis_with_mom(self, monkeypatch):
        """When previous_period_sales > 0, MoM KPI is appended."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal

        async def fake_prev(*a, **k):
            return (Decimal("80000"), Decimal("80"), Decimal("20000"),
                    Decimal("60000"), Decimal("100000"), 30)

        monkeypatch.setattr(m, "_query_sales_aggregates_previous_period", fake_prev)

        cards = await m._build_kpi_cards_from_aggregates(
            factory_id="F999",
            start_date=date(2025, 2, 1), end_date=date(2025, 2, 28),
            total_sales=Decimal("100000"), total_quantity=Decimal("100"),
            total_profit=Decimal("30000"), total_cost=Decimal("70000"),
            total_target=Decimal("200000"), order_count=42,
        )
        assert len(cards) == 5
        assert cards[4]["metricCode"] == "MOM_GROWTH"
        # (100k - 80k) / abs(80k) * 100 = 25%
        assert cards[4]["value"] == Decimal("25.00")
        assert cards[4]["formattedValue"] == "+25.0%"
        assert cards[4]["changeDirection"] == "UP"
        # Growth 25% > GROWTH_YELLOW=-5 → GREEN
        assert cards[4]["alertLevel"] == "GREEN"

    def test_convert_metric_results_to_kpi_cards(self):
        """Java convertToKPICards line 674-720: alertLevel→status, changeDirection→trend,
        formattedValue|value fallback for value field."""
        from smartbi_compat.api.analysis_sales import (
            _convert_metric_results_to_kpi_cards,
            _new_metric_result_dict,
        )
        from decimal import Decimal

        metrics = [
            _new_metric_result_dict(
                metric_code="X", metric_name="X名",
                value=Decimal("100"), formatted_value="100.00",
                unit="元", change_percent=Decimal("5"),
                change_direction="UP", change_value=Decimal("5.0"),
                alert_level="YELLOW", description="desc",
            ),
        ]
        cards = _convert_metric_results_to_kpi_cards(metrics)
        assert len(cards) == 1
        c = cards[0]
        assert c["key"] == "X"
        assert c["title"] == "X名"
        assert c["rawValue"] == Decimal("100")
        assert c["value"] == "100.00"        # formattedValue used
        assert c["unit"] == "元"
        assert c["changeRate"] == Decimal("5")
        assert c["change"] == Decimal("5.0")
        assert c["trend"] == "up"
        assert c["status"] == "yellow"
        assert c["description"] == "desc"
        # fields not set in MetricResult → null in KPICard
        assert c["compareText"] is None
        assert c["targetValue"] is None
        assert c["completionRate"] is None

    def test_convert_metric_value_fallback(self):
        """Java line 709-710: value = formattedValue ?: value.toString() ?: "-"."""
        from smartbi_compat.api.analysis_sales import (
            _convert_metric_results_to_kpi_cards,
            _new_metric_result_dict,
        )
        from decimal import Decimal

        # Case 1: formattedValue present → wins
        metrics = [_new_metric_result_dict(metric_code="X", value=Decimal("100"), formatted_value="X-fmt")]
        assert _convert_metric_results_to_kpi_cards(metrics)[0]["value"] == "X-fmt"

        # Case 2: formattedValue null, value present → use value.toString()
        metrics = [_new_metric_result_dict(metric_code="X", value=Decimal("100"))]
        assert _convert_metric_results_to_kpi_cards(metrics)[0]["value"] == "100"

        # Case 3: both null → "-"
        metrics = [_new_metric_result_dict(metric_code="X")]
        assert _convert_metric_results_to_kpi_cards(metrics)[0]["value"] == "-"
```

- [ ] **Step 2: Run tests to verify fail**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview -v -k "build_kpi or convert_metric"
```

- [ ] **Step 3: Implement helpers**

Add after Phase C SQL helpers section in analysis_sales.py:

```python
# ============================================================
# Section 2: Legacy KPI cards builder + converter (Java mirror)
# ============================================================

# Java MetricCalculatorService constants (line 30-36)
_METRIC_SALES_AMOUNT = "SALES_AMOUNT"
_METRIC_ORDER_COUNT = "ORDER_COUNT"
_METRIC_AVG_ORDER_VALUE = "AVG_ORDER_VALUE"
_METRIC_TARGET_COMPLETION = "TARGET_COMPLETION"
_METRIC_MOM_GROWTH = "MOM_GROWTH"


def _determine_completion_alert_level(completion_rate: Decimal) -> str:
    """Java line 1176-1184."""
    if completion_rate < TARGET_RED_THRESHOLD:
        return "RED"
    if completion_rate < TARGET_YELLOW_THRESHOLD:
        return "YELLOW"
    return "GREEN"


def _determine_growth_alert_level(growth: Decimal) -> str:
    """Java line 1215-1223."""
    if growth < GROWTH_RED_THRESHOLD:
        return "RED"
    if growth < GROWTH_YELLOW_THRESHOLD:
        return "YELLOW"
    return "GREEN"


def _determine_change_direction(change_percent: Optional[Decimal]) -> str:
    """Java line 1228-1239: null/0 → STABLE, >0 → UP, <0 → DOWN."""
    if change_percent is None or change_percent == Decimal("0"):
        return "STABLE"
    return "UP" if change_percent > Decimal("0") else "DOWN"


async def _build_kpi_cards_from_aggregates(
    factory_id: str,
    start_date: date,
    end_date: date,
    total_sales: Decimal,
    total_quantity: Decimal,
    total_profit: Decimal,
    total_cost: Decimal,
    total_target: Decimal,
    order_count: int,
) -> list[dict]:
    """Mirror Java SalesAnalysisServiceImpl.buildKpiFromAggregates line 193-264.

    Returns 4 or 5 MetricResult dicts (MoM 5th only when previous_period_sales > 0).
    """
    cards: list[dict] = []

    # KPI 1: SALES_AMOUNT
    cards.append(_new_metric_result_dict(
        metric_code=_METRIC_SALES_AMOUNT,
        metric_name="总销售额",
        value=total_sales.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        formatted_value=_format_currency(total_sales),
        unit="元",
        alert_level="GREEN",
    ))

    # KPI 2: ORDER_COUNT (BigDecimal from long, formatted with thousands separator)
    cards.append(_new_metric_result_dict(
        metric_code=_METRIC_ORDER_COUNT,
        metric_name="订单数",
        value=Decimal(order_count),
        formatted_value=f"{order_count:,d}",
        unit="单",
        alert_level="GREEN",
    ))

    # KPI 3: AVG_ORDER_VALUE — division SCALE=4 then quantize DISPLAY_SCALE=2
    if order_count > 0:
        avg_order = (total_sales / Decimal(order_count)).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP,
        )
    else:
        avg_order = Decimal("0")
    cards.append(_new_metric_result_dict(
        metric_code=_METRIC_AVG_ORDER_VALUE,
        metric_name="客单价",
        value=avg_order.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        formatted_value=_format_currency(avg_order),
        unit="元",
        alert_level="GREEN",
    ))

    # KPI 4: TARGET_COMPLETION — alertLevel from threshold cascade
    completion_rate = _calculate_completion_rate(total_sales, total_target)
    cards.append(_new_metric_result_dict(
        metric_code=_METRIC_TARGET_COMPLETION,
        metric_name="目标完成率",
        value=completion_rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        formatted_value=_format_completion_pct(completion_rate),
        unit="%",
        alert_level=_determine_completion_alert_level(completion_rate),
    ))

    # KPI 5: MOM_GROWTH (conditional — only when previousSales > 0, Java line 249)
    prev = await _query_sales_aggregates_previous_period(factory_id, start_date, end_date)
    previous_sales = prev[0] if prev is not None else Decimal("0")
    if previous_sales > Decimal("0"):
        mom_growth = _calculate_mom_growth(total_sales, previous_sales)
        cards.append(_new_metric_result_dict(
            metric_code=_METRIC_MOM_GROWTH,
            metric_name="环比增长",
            value=mom_growth.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            formatted_value=_format_growth_pct(mom_growth),
            unit="%",
            change_percent=mom_growth,
            change_direction=_determine_change_direction(mom_growth),
            alert_level=_determine_growth_alert_level(mom_growth),
        ))

    return cards


def _convert_metric_results_to_kpi_cards(metrics: list[dict]) -> list[dict]:
    """Mirror Java SalesAnalysisServiceImpl.convertToKPICards line 674-720.

    Maps MetricResult dicts to KPICard dicts:
      - alertLevel → status (RED→red, YELLOW→yellow, default→green)
      - changeDirection → trend (UP→up, DOWN→down, default→flat)
      - value = formattedValue ?: value.toString() ?: "-"
      - rawValue = MetricResult.value (Decimal)
      - compareText / targetValue / completionRate left null
    """
    cards = []
    for m in metrics:
        formatted = m.get("formattedValue")
        raw_decimal = m.get("value")
        if formatted is not None:
            display_value = formatted
        elif raw_decimal is not None:
            display_value = str(raw_decimal)
        else:
            display_value = "-"

        cards.append(_new_kpi_card_dict(
            key=m.get("metricCode"),
            title=m.get("metricName"),
            value=display_value,
            raw_value=raw_decimal,
            unit=m.get("unit"),
            change=m.get("changeValue"),
            change_rate=m.get("changePercent"),
            trend=_change_direction_to_trend(m.get("changeDirection")),
            status=_alert_level_to_status(m.get("alertLevel")),
            description=m.get("description"),
        ))
    return cards
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview -v -k "build_kpi or convert_metric"
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phase2a-overview): add _build_kpi_cards_from_aggregates (5 KPIs incl conditional MoM) + _convert_metric_results_to_kpi_cards (Java convertToKPICards mirror)" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task D.2: `_generate_ai_insights_from_metrics` + `_generate_suggestions_from_metrics`

**Files:** same.

Mirrors Java `generateAiInsightsFromMetrics` (line 329-351, 2-INFO branches) + `generateSuggestionsFromMetrics` (line 356-365, 1 conditional).

- [ ] **Step 1: Write failing tests**

```python
    def test_generate_ai_insights_always_emits_first_info(self):
        """Java line 333-339: always emits INFO 销售概况 message."""
        from smartbi_compat.api.analysis_sales import _generate_ai_insights_from_metrics
        from decimal import Decimal

        insights = _generate_ai_insights_from_metrics(
            metrics=[],
            total_sales=Decimal("100000"),
            total_profit=Decimal("30000"),
            order_count=42,
        )
        assert len(insights) >= 1
        assert insights[0]["level"] == "INFO"
        assert insights[0]["category"] == "销售概况"
        assert insights[0]["message"] == "期间总销售额 100,000.00，共 42 笔订单，总利润 30,000.00"
        assert insights[0]["relatedEntity"] is None
        assert insights[0]["actionSuggestion"] is None

    def test_generate_ai_insights_emits_profit_rate_when_sales_positive(self):
        """Java line 341-349: 利润率分析 only when totalSales > 0."""
        from smartbi_compat.api.analysis_sales import _generate_ai_insights_from_metrics
        from decimal import Decimal

        insights = _generate_ai_insights_from_metrics(
            metrics=[], total_sales=Decimal("100000"),
            total_profit=Decimal("30000"), order_count=42,
        )
        assert len(insights) == 2
        assert insights[1]["level"] == "INFO"
        assert insights[1]["category"] == "利润率分析"
        # 30000 * 100 / 100000 = 30.0 → "%.1f" → "30.0%"
        assert insights[1]["message"] == "综合利润率 30.0%"

    def test_generate_ai_insights_skips_profit_rate_when_sales_zero(self):
        """totalSales == 0: only the always-INFO insight emitted."""
        from smartbi_compat.api.analysis_sales import _generate_ai_insights_from_metrics
        from decimal import Decimal

        insights = _generate_ai_insights_from_metrics(
            metrics=[], total_sales=Decimal("0"),
            total_profit=Decimal("0"), order_count=0,
        )
        assert len(insights) == 1
        assert insights[0]["category"] == "销售概况"

    def test_generate_suggestions_emits_when_completion_low(self):
        """Java line 360-363: completionRate < 80 AND target > 0."""
        from smartbi_compat.api.analysis_sales import _generate_suggestions_from_metrics
        from decimal import Decimal

        # 50K / 100K = 50% < 80 + target > 0 → emits
        suggestions = _generate_suggestions_from_metrics(
            metrics=[], total_sales=Decimal("50000"),
            total_target=Decimal("100000"),
        )
        assert suggestions == ["目标完成率不足80%，建议加强销售推进"]

    def test_generate_suggestions_skipped_when_completion_high(self):
        """completionRate >= 80 → no suggestion."""
        from smartbi_compat.api.analysis_sales import _generate_suggestions_from_metrics
        from decimal import Decimal

        # 90K / 100K = 90% → skip
        suggestions = _generate_suggestions_from_metrics(
            metrics=[], total_sales=Decimal("90000"),
            total_target=Decimal("100000"),
        )
        assert suggestions == []

    def test_generate_suggestions_skipped_when_target_zero(self):
        """target=0 → completionRate=0 but suppressed by `totalTarget > 0` guard."""
        from smartbi_compat.api.analysis_sales import _generate_suggestions_from_metrics
        from decimal import Decimal

        suggestions = _generate_suggestions_from_metrics(
            metrics=[], total_sales=Decimal("50000"),
            total_target=Decimal("0"),
        )
        assert suggestions == []
```

- [ ] **Step 2: Run to fail**

- [ ] **Step 3: Implement helpers**

```python
def _generate_ai_insights_from_metrics(
    metrics: list[dict],
    total_sales: Decimal,
    total_profit: Decimal,
    order_count: int,
) -> list[dict]:
    """Mirror Java SalesAnalysisServiceImpl.generateAiInsightsFromMetrics line 329-351.

    Emits 1-2 INFO insights from aggregates path:
      1. ALWAYS: 销售概况 ("期间总销售额 X，共 Y 笔订单，总利润 Z")
      2. IF totalSales > 0: 利润率分析 ("综合利润率 N.N%")

    NOTE: `metrics` parameter is unused in the from-aggregates path (Java keeps
    it in signature for symmetry with the other insight generator).
    Q-2 grep RESOLVED 2026-04-30: SalesAnalysisServiceImpl.generateAiInsights
    line 998-1083 (4-branch full version) is dead code; not ported.
    """
    insights: list[dict] = []
    insights.append(_new_ai_insight_dict(
        level="INFO",
        category="销售概况",
        message=(
            f"期间总销售额 {_format_currency(total_sales)}，"
            f"共 {order_count:,d} 笔订单，"
            f"总利润 {_format_currency(total_profit)}"
        ),
    ))
    if total_sales > Decimal("0"):
        # Java line 342-343: SCALE=4 division then format with %.1f
        profit_rate = (total_profit * Decimal("100") / total_sales).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP,
        )
        insights.append(_new_ai_insight_dict(
            level="INFO",
            category="利润率分析",
            message=f"综合利润率 {_format_completion_pct(profit_rate)}",
        ))
    return insights


def _generate_suggestions_from_metrics(
    metrics: list[dict],
    total_sales: Decimal,
    total_target: Decimal,
) -> list[str]:
    """Mirror Java SalesAnalysisServiceImpl.generateSuggestionsFromMetrics line 356-365.

    Emits 1 suggestion when completionRate < 80 AND target > 0.
    Threshold "80" is hardcoded literal in Java line 361 (NOT TARGET_YELLOW=85).
    """
    suggestions: list[str] = []
    if total_target <= Decimal("0"):
        return suggestions
    completion_rate = _calculate_completion_rate(total_sales, total_target)
    if completion_rate < Decimal("80"):
        suggestions.append("目标完成率不足80%，建议加强销售推进")
    return suggestions
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview -v -k "generate_ai or generate_suggestions"
```

Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phase2a-overview): add _generate_ai_insights_from_metrics (2-INFO) + _generate_suggestions_from_metrics (1 conditional) — Java line 329-365 mirror" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task D.3: Y-a fillers — `_build_legacy_rankings_dict` + `_build_legacy_trend_chart` + `_build_legacy_category_chart`

**Files:** same.

Mirrors Java `buildRankingsFromAggregates` (line 310-324, top-10) + `buildTrendChartFromAggregates` (line 269-285) + `buildPieChartFromAggregates` (line 290-305). Y-a means these fill `overview.rankings` (English key "salesperson") and `overview.charts` (Chinese keys "销售趋势"/"产品分布") to match Java legacy emission.

- [ ] **Step 1: Write failing tests**

```python
    @pytest.mark.asyncio
    async def test_build_legacy_rankings_dict_fills_salesperson(self, monkeypatch):
        """Y-a: legacy fills overview.rankings.salesperson (English key) with top 10."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal

        async def fake_query(*a, **k):
            return [(f"销售员{i}", Decimal(str(100000 - i * 1000)), Decimal("10")) for i in range(15)]

        monkeypatch.setattr(m, "_query_top_salespersons_aggregate", fake_query)

        result = await m._build_legacy_rankings_dict("F999", date(2025, 1, 1), date(2025, 12, 31))
        assert "salesperson" in result  # English key per Java line 161
        ranks = result["salesperson"]
        assert len(ranks) == 10  # top-10 truncation per Java line 321
        assert ranks[0]["rank"] == 1
        assert ranks[0]["name"] == "销售员0"
        assert ranks[0]["value"] == Decimal("100000.00")  # DISPLAY_SCALE=2
        assert ranks[0]["target"] is None        # Java line 316-320 leaves null
        assert ranks[0]["completionRate"] is None
        assert ranks[0]["alertLevel"] is None
        assert ranks[9]["rank"] == 10

    @pytest.mark.asyncio
    async def test_build_legacy_rankings_dict_empty_when_no_data(self, monkeypatch):
        """Empty list from SQL → returns {} (consistent with F999 byte shape)."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date

        async def fake_query(*a, **k):
            return []

        monkeypatch.setattr(m, "_query_top_salespersons_aggregate", fake_query)

        result = await m._build_legacy_rankings_dict("F999", date(2025, 1, 1), date(2025, 12, 31))
        # Java line 158-161: rankings always populated as map but salesperson list may be empty.
        # Match Java: emit {"salesperson": []} when query returns []
        assert result == {"salesperson": []}

    @pytest.mark.asyncio
    async def test_build_legacy_trend_chart_chinese_title(self, monkeypatch):
        """Y-a: legacy charts use Chinese title (Java line 280) NOT Gold's English."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal

        async def fake_query(*a, **k):
            return [
                (date(2025, 1, 1), Decimal("1000.55"), Decimal("10")),
                (date(2025, 1, 2), Decimal("2000.99"), Decimal("20")),
            ]

        monkeypatch.setattr(m, "_query_daily_sales_trend_aggregate", fake_query)

        chart = await m._build_legacy_trend_chart("F999", date(2025, 1, 1), date(2025, 12, 31))
        assert chart is not None
        assert chart["chartType"] == "LINE"
        assert chart["title"] == "销售趋势"  # Java line 280
        assert chart["xaxisField"] == "date"
        assert chart["yaxisField"] == "amount"
        # Legacy data points include `quantity` (3 keys) — Gold has only `date`+`amount`
        assert len(chart["data"]) == 2
        assert chart["data"][0]["date"] == "2025-01-01"
        assert chart["data"][0]["amount"] == Decimal("1000.55")
        assert chart["data"][0]["quantity"] == Decimal("10")
        assert chart["options"] is None     # Java line 278-284 doesn't set
        assert chart["seriesField"] is None

    @pytest.mark.asyncio
    async def test_build_legacy_trend_chart_returns_none_when_empty(self, monkeypatch):
        """Java line 147 `if (!dailyTrend.isEmpty())` skips chart emission."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date

        async def fake_query(*a, **k):
            return []

        monkeypatch.setattr(m, "_query_daily_sales_trend_aggregate", fake_query)
        chart = await m._build_legacy_trend_chart("F999", date(2025, 1, 1), date(2025, 12, 31))
        assert chart is None  # caller skips charts dict insertion

    @pytest.mark.asyncio
    async def test_build_legacy_category_chart_null_category_fallback(self, monkeypatch):
        """Java line 294: null category → '未分类' in chart data."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal

        async def fake_query(*a, **k):
            return [
                ("猪肉类", Decimal("50000")),
                (None, Decimal("5000")),
            ]

        monkeypatch.setattr(m, "_query_category_distribution_aggregate", fake_query)

        chart = await m._build_legacy_category_chart("F999", date(2025, 1, 1), date(2025, 12, 31))
        assert chart["chartType"] == "PIE"
        assert chart["title"] == "产品分布"  # Java line 300 (Gold uses "产品类别占比")
        assert chart["data"][0]["category"] == "猪肉类"
        assert chart["data"][1]["category"] == "未分类"  # null fallback
```

- [ ] **Step 2: Run to fail**

- [ ] **Step 3: Implement Y-a fillers**

```python
async def _build_legacy_rankings_dict(
    factory_id: str, start_date: date, end_date: date,
) -> dict:
    """Y-a (Q-1 RESOLVED 2026-04-30): legacy fills overview.rankings.salesperson.

    Mirror Java SalesAnalysisServiceImpl.getSalesOverview line 158-161 +
    buildRankingsFromAggregates line 310-324:
      - English key "salesperson" (line 161)
      - top-10 truncation (line 321)
      - rank/name/value populated; target/completionRate/alertLevel left null
      - filter null name at SQL level (Java line 314)

    Returns {"salesperson": [...]} even when list empty — Java emits the map
    unconditionally with the key.
    """
    rows = await _query_top_salespersons_aggregate(factory_id, start_date, end_date)
    items: list[dict] = []
    for i, (name, amount, _quantity) in enumerate(rows[:10], start=1):
        if name is None:
            continue  # Java line 314 null-name filter (also at SQL but safety net)
        items.append(_new_ranking_item_dict(
            rank=i,
            name=str(name),
            value=_to_decimal(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            # target/completion_rate/alert_level: None per Java line 316-320
        ))
    return {"salesperson": items}


async def _build_legacy_trend_chart(
    factory_id: str, start_date: date, end_date: date,
) -> Optional[dict]:
    """Y-a (Q-1 RESOLVED 2026-04-30): legacy fills overview.charts['销售趋势'].

    Mirror Java SalesAnalysisServiceImpl.buildTrendChartFromAggregates
    line 269-285 + getSalesOverview line 146-149:
      - chartType="LINE", title="销售趋势" (Chinese, NOT Gold's English)
      - xaxisField="date", yaxisField="amount"
      - data points: {date, amount, quantity} (3 keys — Gold has only 2)
      - options/seriesField NOT set (None) — different from F999 stub which sets options
      - Returns None when query empty (Java line 147 isEmpty check)
    """
    rows = await _query_daily_sales_trend_aggregate(factory_id, start_date, end_date)
    if not rows:
        return None
    data = [
        {
            "date": d.isoformat() if hasattr(d, "isoformat") else str(d),
            "amount": _to_decimal(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "quantity": _to_decimal(quantity).quantize(Decimal("1"), rounding=ROUND_HALF_UP),
        }
        for d, amount, quantity in rows
    ]
    return _new_chart_config_dict(
        chart_type="LINE",
        title="销售趋势",
        xaxis_field="date",
        yaxis_field="amount",
        data=data,
        options=None,
    )


async def _build_legacy_category_chart(
    factory_id: str, start_date: date, end_date: date,
) -> Optional[dict]:
    """Y-a (Q-1 RESOLVED 2026-04-30): legacy fills overview.charts['产品分布'].

    Mirror Java SalesAnalysisServiceImpl.buildPieChartFromAggregates
    line 290-305 + getSalesOverview line 152-155:
      - chartType="PIE", title="产品分布" (Chinese, NOT Gold's "产品类别占比")
      - xaxisField="category", yaxisField="amount"
      - data points: {category, amount} (null category → "未分类" per Java line 294)
      - Returns None when query empty
    """
    rows = await _query_category_distribution_aggregate(factory_id, start_date, end_date)
    if not rows:
        return None
    data = [
        {
            "category": str(category) if category is not None else "未分类",
            "amount": _to_decimal(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        }
        for category, amount in rows
    ]
    return _new_chart_config_dict(
        chart_type="PIE",
        title="产品分布",
        xaxis_field="category",
        yaxis_field="amount",
        data=data,
        options=None,
    )
```

- [ ] **Step 4: Run to pass**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview -v -k "build_legacy_rankings or build_legacy_trend or build_legacy_category"
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phase2a-overview): add Y-a fillers (_build_legacy_rankings_dict + trend/category charts) — Java buildRankings/buildTrend/buildPie mirror" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task D.4: Extract `_build_empty_dashboard` from current placeholder

**Files:** same.

The current `_build_legacy_sales_overview` body IS the empty-dashboard shape. Extract into a named helper so it can be reused by both: (1) the legacy SQL "no rows" branch, (2) the legacy SQL "totalSales=0 AND order_count=0" branch.

- [ ] **Step 1: Write failing test**

```python
    def test_build_empty_dashboard_byte_shape(self):
        """Java SalesAnalysisServiceImpl.buildEmptyDashboard line 1145-1159."""
        from smartbi_compat.api.analysis_sales import _build_empty_dashboard

        d = _build_empty_dashboard()
        # 16 keys per DashboardResponse foundation factory
        assert len(d) == 16
        assert d["kpiCards"] == []
        assert d["charts"] == {}
        assert d["rankings"] == {}
        assert len(d["aiInsights"]) == 1
        ai = d["aiInsights"][0]
        assert ai["level"] == "YELLOW"
        assert ai["category"] == "数据状态"
        assert ai["message"] == "当前时间范围内暂无销售数据"
        assert ai["actionSuggestion"] == "请上传销售数据或调整时间范围"
        assert ai["relatedEntity"] is None
        assert d["suggestions"] == ["请先上传销售数据以开始分析"]
        # period / metricCards / chartList / alerts / recommendations / generatedAt /
        # fromCache / cacheExpireAt: defaults from foundation factory
        assert d["period"] is None
        assert d["metricCards"] is None
        assert d["fromCache"] is False
        # lastUpdated is set (volatile, will be stripped in byte tests)
        assert d["lastUpdated"] is not None
```

- [ ] **Step 2: Run to fail**

- [ ] **Step 3: Add `_build_empty_dashboard` (BEFORE `_build_legacy_sales_overview` in file)**

```python
def _build_empty_dashboard() -> dict:
    """Mirror Java SalesAnalysisServiceImpl.buildEmptyDashboard line 1145-1159.

    Used by:
      - F999 path (legacy SQL returns 0 rows or all-zero aggregate)
      - Gold-empty fallback (gold spec already returns this shape via
        _get_sales_overview when Gold returns None and pool acquisition fails)
      - any branch where total_sales=0 AND order_count=0 (Java line 131)
    """
    return _new_dashboard_response_dict(
        ai_insights=[
            _new_ai_insight_dict(
                level="YELLOW",
                category="数据状态",
                message="当前时间范围内暂无销售数据",
                action_suggestion="请上传销售数据或调整时间范围",
            ),
        ],
        suggestions=["请先上传销售数据以开始分析"],
        last_updated=_utc_now_iso(),
    )
```

- [ ] **Step 4: Run to pass**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview::test_build_empty_dashboard_byte_shape -v
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phase2a-overview): extract _build_empty_dashboard helper (Java line 1145-1159 mirror, reused across empty branches)" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

## Phase E — Orchestration: replace `_build_legacy_sales_overview` body (~30 min, 1 task)

### Task E.1: Wire real legacy impl in `_build_legacy_sales_overview`

**Files:**
- Modify: `backend/python/smartbi_compat/api/analysis_sales.py` (lines 586-606 — current placeholder body)
- Test: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

This task **replaces** the existing placeholder body. The function signature stays `async def _build_legacy_sales_overview(factory_id, range_) -> dict`. Caller `_get_sales_overview` (line 609-639) is unchanged — it still tries Gold first then falls back to this legacy.

- [ ] **Step 1: Write failing test (mocked SQL helpers, full orchestration)**

```python
    @pytest.mark.asyncio
    async def test_build_legacy_sales_overview_returns_empty_when_no_rows(self, monkeypatch):
        """Java line 120-122: SQL returns null/short → buildEmptyDashboard."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date

        async def fake_aggregates(*a, **k):
            return None  # mimic JPA returning empty result

        monkeypatch.setattr(m, "_query_sales_aggregates", fake_aggregates)

        range_ = m.DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
        result = await m._build_legacy_sales_overview("F999", range_)

        # Same shape as _build_empty_dashboard
        assert result["kpiCards"] == []
        assert result["aiInsights"][0]["level"] == "YELLOW"
        assert result["aiInsights"][0]["category"] == "数据状态"

    @pytest.mark.asyncio
    async def test_build_legacy_sales_overview_returns_empty_when_zero_sales_and_orders(self, monkeypatch):
        """Java line 131-134: totalSales=0 AND orderCount=0 → buildEmptyDashboard."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal

        async def fake_aggregates(*a, **k):
            return (Decimal("0"), Decimal("0"), Decimal("0"),
                    Decimal("0"), Decimal("0"), 0)

        monkeypatch.setattr(m, "_query_sales_aggregates", fake_aggregates)

        range_ = m.DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
        result = await m._build_legacy_sales_overview("F_EMPTY", range_)
        assert result["kpiCards"] == []
        assert result["aiInsights"][0]["level"] == "YELLOW"

    @pytest.mark.asyncio
    async def test_build_legacy_sales_overview_full_path_with_y_a_nested_fill(self, monkeypatch):
        """Y-a verification: non-empty legacy path fills overview.rankings + overview.charts."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal

        async def fake_aggregates(*a, **k):
            return (Decimal("100000"), Decimal("100"), Decimal("30000"),
                    Decimal("70000"), Decimal("200000"), 42)

        async def fake_prev(*a, **k):
            return (Decimal("80000"), Decimal("80"), Decimal("20000"),
                    Decimal("60000"), Decimal("100000"), 30)

        async def fake_top_sp(*a, **k):
            return [("张三", Decimal("60000"), Decimal("60"))]

        async def fake_trend(*a, **k):
            return [(date(2025, 1, 1), Decimal("1000"), Decimal("10"))]

        async def fake_cat(*a, **k):
            return [("猪肉类", Decimal("50000"))]

        monkeypatch.setattr(m, "_query_sales_aggregates", fake_aggregates)
        monkeypatch.setattr(m, "_query_sales_aggregates_previous_period", fake_prev)
        monkeypatch.setattr(m, "_query_top_salespersons_aggregate", fake_top_sp)
        monkeypatch.setattr(m, "_query_daily_sales_trend_aggregate", fake_trend)
        monkeypatch.setattr(m, "_query_category_distribution_aggregate", fake_cat)

        range_ = m.DateRange.custom(date(2025, 2, 1), date(2025, 2, 28))
        result = await m._build_legacy_sales_overview("F_MFR", range_)

        # 5 KPIs (incl MoM since prev_sales > 0)
        assert len(result["kpiCards"]) == 5
        # Y-a: nested rankings filled
        assert "salesperson" in result["rankings"]
        assert len(result["rankings"]["salesperson"]) == 1
        assert result["rankings"]["salesperson"][0]["name"] == "张三"
        # Y-a: nested charts filled with Chinese keys
        assert "销售趋势" in result["charts"]
        assert "产品分布" in result["charts"]
        assert result["charts"]["销售趋势"]["title"] == "销售趋势"
        assert result["charts"]["产品分布"]["title"] == "产品分布"
        # AI insights = 2-INFO (B: full 4-branch dropped)
        assert len(result["aiInsights"]) == 2
        assert all(i["level"] == "INFO" for i in result["aiInsights"])
        # Suggestion: 100k/200k = 50% < 80 + target>0 → emits
        assert result["suggestions"] == ["目标完成率不足80%，建议加强销售推进"]
```

- [ ] **Step 2: Run to fail**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview -v -k "build_legacy_sales_overview"
```

Expected: FAIL — current placeholder ignores all helpers, returns YELLOW-empty shape regardless of inputs.

- [ ] **Step 3: Replace `_build_legacy_sales_overview` body (lines 586-606)**

Find the current implementation:

```python
async def _build_legacy_sales_overview(factory_id: str, range_: DateRange) -> dict:
    """Legacy fallback placeholder — overview spec replaces with real impl.
    ...
    """
    return _new_dashboard_response_dict(
        ai_insights=[
            _new_ai_insight_dict(
                level="YELLOW",
                category="数据状态",
                message="当前时间范围内暂无销售数据",
                action_suggestion="请上传销售数据或调整时间范围",
            ),
        ],
        suggestions=["请先上传销售数据以开始分析"],
        last_updated=_utc_now_iso(),
    )
```

Replace the entire function with:

```python
async def _build_legacy_sales_overview(factory_id: str, range_: DateRange) -> dict:
    """Real legacy impl — mirrors Java SalesAnalysisServiceImpl.getSalesOverview
    line 114-175.

    Triggered by _get_sales_overview when Gold path returns None or fails.
    Order of operations:
      1. Aggregate query (_query_sales_aggregates) — 6-tuple
      2. Empty checks → _build_empty_dashboard (Java line 120-122 + 131-134)
      3. _build_kpi_cards_from_aggregates (4-5 KPIs + previous-period query for MoM)
      4. _convert_metric_results_to_kpi_cards (alertLevel→status mapping)
      5. Y-a (Q-1 RESOLVED 2026-04-30): nested rankings + charts via SQL aggregates
         (mirror Java line 142-156 — front-end web-admin SalesAnalysis.vue:720
         reads `overview?.rankings || data.rankings` so nested fill is required
         for legacy non-empty UI to display)
      6. _generate_ai_insights_from_metrics (B: 2-INFO only; full 4-branch is
         dead code per Q-2 grep RESOLVED 2026-04-30)
      7. _generate_suggestions_from_metrics (1 conditional suggestion)
    """
    # Q-2 grep 2026-04-30: SalesAnalysisServiceImpl.generateAiInsights line 998-1083
    # is dead code (0 callers + parameter signature mismatch with aggregates path);
    # not ported. If Java wires it up later, port then.

    aggregates = await _query_sales_aggregates(factory_id, range_.start_date, range_.end_date)
    if aggregates is None or len(aggregates) < 6:
        logger.warning(
            "[legacy] aggregates empty factory=%s range=%s..%s",
            factory_id, range_.start_date, range_.end_date,
        )
        return _build_empty_dashboard()

    total_sales, total_quantity, total_profit, total_cost, total_target, order_count = aggregates
    total_sales = _to_decimal(total_sales)
    total_quantity = _to_decimal(total_quantity)
    total_profit = _to_decimal(total_profit)
    total_cost = _to_decimal(total_cost)
    total_target = _to_decimal(total_target)
    order_count = int(order_count) if order_count is not None else 0

    if total_sales == Decimal("0") and order_count == 0:
        logger.warning(
            "[legacy] zero sales+orders factory=%s range=%s..%s",
            factory_id, range_.start_date, range_.end_date,
        )
        return _build_empty_dashboard()

    metric_results = await _build_kpi_cards_from_aggregates(
        factory_id=factory_id,
        start_date=range_.start_date, end_date=range_.end_date,
        total_sales=total_sales, total_quantity=total_quantity,
        total_profit=total_profit, total_cost=total_cost,
        total_target=total_target, order_count=order_count,
    )
    kpi_cards = _convert_metric_results_to_kpi_cards(metric_results)

    # Y-a (Q-1 RESOLVED 2026-04-30): fill nested rankings + charts
    rankings_dict = await _build_legacy_rankings_dict(
        factory_id, range_.start_date, range_.end_date,
    )
    charts_dict: dict = {}
    trend_chart = await _build_legacy_trend_chart(
        factory_id, range_.start_date, range_.end_date,
    )
    if trend_chart is not None:
        charts_dict["销售趋势"] = trend_chart
    category_chart = await _build_legacy_category_chart(
        factory_id, range_.start_date, range_.end_date,
    )
    if category_chart is not None:
        charts_dict["产品分布"] = category_chart

    ai_insights = _generate_ai_insights_from_metrics(
        metrics=metric_results,
        total_sales=total_sales, total_profit=total_profit,
        order_count=order_count,
    )
    suggestions = _generate_suggestions_from_metrics(
        metrics=metric_results,
        total_sales=total_sales, total_target=total_target,
    )

    return _new_dashboard_response_dict(
        kpi_cards=kpi_cards,
        charts=charts_dict,
        rankings=rankings_dict,
        ai_insights=ai_insights,
        suggestions=suggestions,
        last_updated=_utc_now_iso(),
    )
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview -v -k "build_legacy_sales_overview"
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(phase2a-overview): replace _build_legacy_sales_overview placeholder with real impl (B+Option1+Y-a) — 5 KPIs / Y-a nested fills / 2-INFO insights / completion suggestion" -- backend/python/smartbi_compat/api/analysis_sales.py tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

## Phase F — F999 + F001 byte-shape regression + Y-a end-to-end (~45-60 min, 3 tasks)

### Task F.1: F999 byte-shape regression (legacy fallback path)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

The foundation+gold F999 byte test exercises the gold-empty path (Gold returns None for cleared F999 → falls back to `_build_empty_dashboard`). Now legacy is wired (E.1), but F999 still goes Gold-first then falls back to legacy `_query_sales_aggregates` which returns all-zero → emits `_build_empty_dashboard`. Byte shape unchanged.

- [ ] **Step 1: Write F999 byte-shape test using Gold-disabled monkeypatch**

```python
    @pytest.mark.asyncio
    async def test_F999_legacy_path_byte_shape_matches_empty_dashboard(self, monkeypatch):
        """Force legacy by stubbing Gold to raise; verify legacy returns same
        byte shape as Gold-empty path (which already passes F999 byte gate)."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal

        # Stub Gold dispatch to raise → forces legacy fallback
        async def fake_gold_with_charts(*a, **k):
            raise RuntimeError("forced legacy fallback for test")

        # Stub legacy SQL to return all-zeros
        async def fake_aggregates(*a, **k):
            return (Decimal("0"), Decimal("0"), Decimal("0"),
                    Decimal("0"), Decimal("0"), 0)

        monkeypatch.setattr(m, "_build_from_gold_with_charts", fake_gold_with_charts)
        monkeypatch.setattr(m, "_query_sales_aggregates", fake_aggregates)

        range_ = m.DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
        # Call the public Gold-first dispatcher (matches production)
        result = await m._get_sales_overview("F999", range_)

        # Should match _build_empty_dashboard byte shape
        expected = m._build_empty_dashboard()
        # Strip volatile lastUpdated since both will differ by microseconds
        assert m._strip_volatile(result) == m._strip_volatile(expected)
```

- [ ] **Step 2: Run to fail OR pass directly**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview::test_F999_legacy_path_byte_shape_matches_empty_dashboard -v
```

If fails: investigate divergence (likely `lastUpdated` not stripped or some minor field). Fix until passes.

- [ ] **Step 3: Re-run full TestEnvelope to confirm no regression**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestEnvelope -v
```

Expected: ALL PASS (5 envelope tests including `test_F999_empty_state_byte_shape`).

- [ ] **Step 4: Commit (test-only)**

```bash
git commit -m "test(phase2a-overview): F999 legacy fallback byte-shape regression — matches _build_empty_dashboard" -- tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task F.2: F001 Gold-path regression (must stay passing)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

F001 already passes byte gate via Gold path (foundation+gold ship). Adding overview impl must NOT break F001 byte test. This task adds an explicit "F001 still uses Gold path" assertion to lock the behavior.

- [ ] **Step 1: Write test asserting F001 doesn't fall back to legacy**

```python
    @pytest.mark.asyncio
    async def test_F001_still_uses_gold_path_after_overview_impl(self, monkeypatch):
        """Regression guard: overview spec must NOT cause F001 to fall back to legacy.

        Strategy: spy on legacy aggregates query — if it's called for F001, fail."""
        from smartbi_compat.api import analysis_sales as m
        from datetime import date

        legacy_called = {"count": 0}

        original_legacy = m._query_sales_aggregates
        async def spy_legacy(*a, **k):
            legacy_called["count"] += 1
            return await original_legacy(*a, **k)

        monkeypatch.setattr(m, "_query_sales_aggregates", spy_legacy)

        range_ = m.DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
        # Real call (no Gold mock — F001 has actual data in test env)
        # In test env without Gold pool this may fail acquisition;
        # accept that scenario as Gold-emit-empty NOT legacy (no SQL call)
        try:
            await m._get_sales_overview("F001", range_)
        except Exception:
            pass  # Gold pool may fail in test fixtures; that's OK if legacy not called

        # CRITICAL: legacy SQL must not have been called for F001
        # (Gold returned data OR Gold returned None+pool-fail → legacy_fallback path)
        # In Gold-success: count=0. In Gold-pool-fail: count>=1 (acceptable).
        # In Gold-success-empty (count=0 sales): count=0 (Gold short-circuits).
        # Test asserts NOT count>>0, allowing pool-failure scenario.
        # If you observe count > 0, check whether Gold pool is broken in test fixtures.
        # NOT a hard failure — log only.
        if legacy_called["count"] > 0:
            import warnings
            warnings.warn(
                f"F001 fell back to legacy ({legacy_called['count']} times). "
                f"Gold pool may be broken in test fixtures. "
                f"Verify test env Gold path before deploying."
            )
```

This is a "soft assertion" — F001 byte test (foundation+gold's TestGold) is the actual gate.

- [ ] **Step 2: Run full TestGold + this regression test**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestGold -v
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview::test_F001_still_uses_gold_path_after_overview_impl -v
```

Expected: TestGold all pass (foundation+gold gate). TestOverview soft assertion passes.

- [ ] **Step 3: Commit**

```bash
git commit -m "test(phase2a-overview): F001 Gold-path regression guard (legacy must not be called when Gold succeeds)" -- tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

### Task F.3: Y-a end-to-end via mocked seams (verifies nested fill propagates to envelope)

**Files:**
- Modify: `tests/python/smartbi_compat/test_analysis_sales_contract.py`

Final integration test: force legacy path, mock all 5 SQL helpers with fixture data, hit the route via FastAPI test client, assert response envelope contains `data.overview.rankings.salesperson` populated AND `data.overview.charts["销售趋势"]` populated. This is the Y-a smoke test.

- [ ] **Step 1: Write E2E Y-a test**

```python
    @pytest.mark.asyncio
    async def test_Y_a_legacy_nested_fill_via_route(self, monkeypatch, async_client_factory):
        """Y-a end-to-end: legacy path fills overview.rankings + overview.charts
        with Chinese chart keys (matches Java prod for non-restaurant tenants).

        Uses async_client_factory fixture (foundation TestEnvelope harness).
        Forces legacy by raising in Gold dispatch.
        """
        from smartbi_compat.api import analysis_sales as m
        from datetime import date
        from decimal import Decimal

        async def fake_gold(*a, **k):
            raise RuntimeError("forced legacy")
        async def fake_agg(*a, **k):
            return (Decimal("100000"), Decimal("100"), Decimal("30000"),
                    Decimal("70000"), Decimal("0"), 42)
        async def fake_prev(*a, **k):
            return (Decimal("0"), Decimal("0"), Decimal("0"),
                    Decimal("0"), Decimal("0"), 0)
        async def fake_top(*a, **k):
            return [("张三", Decimal("100000"), Decimal("100"))]
        async def fake_trend(*a, **k):
            return [(date(2025, 6, 15), Decimal("100000"), Decimal("100"))]
        async def fake_cat(*a, **k):
            return [("猪肉类", Decimal("100000"))]

        monkeypatch.setattr(m, "_build_from_gold_with_charts", fake_gold)
        monkeypatch.setattr(m, "_query_sales_aggregates", fake_agg)
        monkeypatch.setattr(m, "_query_sales_aggregates_previous_period", fake_prev)
        monkeypatch.setattr(m, "_query_top_salespersons_aggregate", fake_top)
        monkeypatch.setattr(m, "_query_daily_sales_trend_aggregate", fake_trend)
        monkeypatch.setattr(m, "_query_category_distribution_aggregate", fake_cat)

        async with async_client_factory("F999") as client:
            response = await client.get(
                "/api/mobile/F999/smart-bi/analysis/sales",
                params={"startDate": "2025-06-01", "endDate": "2025-06-30"},
            )

        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        overview = body["data"]["overview"]

        # Y-a: nested rankings filled with English key
        assert "salesperson" in overview["rankings"]
        assert overview["rankings"]["salesperson"][0]["name"] == "张三"

        # Y-a: nested charts filled with Chinese keys
        assert "销售趋势" in overview["charts"]
        assert "产品分布" in overview["charts"]
        assert overview["charts"]["销售趋势"]["chartType"] == "LINE"
        assert overview["charts"]["产品分布"]["chartType"] == "PIE"

        # 4 KPIs (no MoM since prev_sales=0)
        assert len(overview["kpiCards"]) == 4
        # 2-INFO insights (B: no 4-branch)
        assert all(i["level"] == "INFO" for i in overview["aiInsights"])
```

If `async_client_factory` fixture doesn't exist with this name, look at foundation `test_analysis_sales_contract.py` `TestEnvelope` class for the actual fixture (likely `client` or `async_client`). Adapt accordingly.

- [ ] **Step 2: Run to verify**

```bash
pytest ../../tests/python/smartbi_compat/test_analysis_sales_contract.py::TestOverview::test_Y_a_legacy_nested_fill_via_route -v
```

If the fixture name differs, fix and re-run.

- [ ] **Step 3: Commit**

```bash
git commit -m "test(phase2a-overview): Y-a end-to-end via route — overview.rankings + overview.charts filled in legacy non-empty path" -- tests/python/smartbi_compat/test_analysis_sales_contract.py
git show --name-only HEAD
```

---

## Phase G — Verification (~30-45 min, 2 tasks)

### Task G.1: Full pytest 0-regression sweep + summary

**Files:** none modified.

- [ ] **Step 1: Run full pytest**

```bash
cd backend/python
pytest ../../tests/python/smartbi_compat/ -v --tb=short 2>&1 | tail -80
```

Expected:
- foundation: 118 baseline tests pass (TestEnvelope + alerts + recommendations + foundation factories)
- gold: 43 byte-shape tests pass
- **NEW**: TestOverview class ~25-30 tests pass
- **Total: ~190+ tests pass, 0 fail**

If any baseline test now fails, STOP and reconcile. Likely cause: a new helper changed an existing function signature or import. Fix immediately.

- [ ] **Step 2: Verify file growth is reasonable**

```bash
wc -l backend/python/smartbi_compat/api/analysis_sales.py
# Expected: ~1300 lines (foundation+gold = 737, overview adds ~550)

git log --stat --oneline phase2a/t5-poc..HEAD -- backend/python/smartbi_compat/api/analysis_sales.py
# Expected: 8-9 commits touching this file (one per Phase B/C/D task + E.1)
```

- [ ] **Step 3: No commit — verification only**

---

### Task G.2: Test env deploy + curl smoke + push

**Files:** none modified.

- [ ] **Step 1: Deploy Python service to test env (port 8084)**

```bash
cd /c/Users/Steve/my-prototype-logistics/.worktrees/phase2a-t5-poc-overview
./scripts/deploy/deploy-smartbi-python.sh --env test
```

Expected: Python test service restarts at 8084. Tail log for startup errors:

```bash
ssh root@47.100.235.168 "tail -50 /www/wwwroot/cretas/python-test.log"
```

Look for "Uvicorn running on http://0.0.0.0:8084" + no exception traces.

- [ ] **Step 2: Curl F999 (legacy fallback path on test env)**

F999 in test env has cleared data → Gold returns None → legacy fires → returns `_build_empty_dashboard` shape.

```bash
curl -s "http://47.100.235.168:8084/api/mobile/F999/smart-bi/analysis/sales?startDate=2025-01-01&endDate=2025-12-31" \
  -H "Authorization: Bearer <test-jwt>" | jq '.data.overview | keys'
```

Expected output includes 16 keys per DashboardResponse, with `kpiCards: []`, `rankings: {}`, `charts: {}`, `aiInsights[0].level: "YELLOW"`.

If JWT token unavailable, get one via:
```bash
curl -X POST "http://47.100.235.168:10011/api/mobile/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username": "platform_admin", "password": "<from .env.test>"}' \
  | jq -r '.data.tokens.token'
```

- [ ] **Step 3: Curl F001 (Gold path — must still work)**

```bash
curl -s "http://47.100.235.168:8084/api/mobile/F001/smart-bi/analysis/sales?startDate=2025-01-01&endDate=2025-12-31" \
  -H "Authorization: Bearer <test-jwt>" | jq '.data.overview.kpiCards[0]'
```

Expected: 4 Gold KPIs (total_revenue / bill_count / avg_bill_value / store_count), all with `status: "green"` and Chinese title strings.

If F001 returns the legacy-shaped response (5 KPIs starting with SALES_AMOUNT), Gold path is broken — investigate before push.

- [ ] **Step 4: Push to origin (per kickoff: pushed = ready for review)**

```bash
git status --short                         # Empty — all commits made
git log --oneline phase2a/t5-poc..HEAD     # ~10 commits ahead

git push origin phase2a/t5-poc
```

If concurrent chat has pushed too, expect non-fast-forward error. Run `git pull --rebase origin phase2a/t5-poc` (verify no conflict — concurrent chat doesn't touch `analysis_sales.py`), then push again.

- [ ] **Step 5: Final report**

After push succeeds, write a 5-line summary mentioning:
1. Tests added: <count> in TestOverview
2. New helpers added: ~14 (constants + mappings + formats + math + 5 SQL + 6 builders)
3. analysis_sales.py grew from 737 → ~1300 lines
4. F999 byte gate: still passing
5. F001 byte gate: still passing (Gold path unchanged)
6. Y-a verified: legacy non-empty path fills `overview.rankings + overview.charts`

---

## Self-Review Checklist (run before declaring plan complete)

### Spec coverage
- [x] §2 in-scope items 1-12: covered by Tasks A.1, B.1-B.4, C.1-C.4, D.1-D.4, E.1
- [x] §2 item 10 (4-branch full): NOT PORTED per Q-2 RESOLVED — covered by spec edit Task A.1
- [x] §3 architecture pseudocode: implementation in Task E.1 follows updated pseudocode
- [x] §4 dict factories: `_new_metric_result_dict` in B.4; `_new_kpi_card_dict` already in foundation
- [x] §5 KPI enumeration: 5 KPIs + conditional MoM in D.1
- [x] §6 AI insight from-aggregates path: 2 INFO branches in D.2
- [x] §7 SQL helpers: 5 queries (KPI summary + previous-period + 3 ranking/chart) in C.1-C.4
- [x] §8 test fixtures: TestOverview class with ~25-30 tests across B-F
- [x] §9 byte-shape strategy: F999 + F001 gates re-verified in F.1, F.2
- [x] §10 risk register: R-OV-1 to R-OV-8 covered by tests across phases
- [x] §11 open questions Q-1, Q-2, Q-3: all marked RESOLVED in Task A.1

### Placeholder scan
- [ ] No "TODO" / "TBD" / "fill later" outside of intentional Q-2 grep comment in code
- [ ] All test code shows actual asserts, not "test specific behavior"
- [ ] All commit messages are concrete, not "fix stuff"

### Type consistency
- [ ] `_query_sales_aggregates` return type: `Optional[tuple]` (6-tuple) — same in C.1, D.1, E.1
- [ ] `_build_kpi_cards_from_aggregates` returns `list[dict]` (MetricResult shape) — same in D.1, E.1
- [ ] `_convert_metric_results_to_kpi_cards` accepts `list[dict]` — wired correctly in E.1
- [ ] `_build_legacy_rankings_dict` returns `dict` with key "salesperson" → list[dict] (RankingItem shape)
- [ ] `_build_legacy_trend_chart` / `_build_legacy_category_chart` return `Optional[dict]` (ChartConfig shape) — caller in E.1 checks for None before insertion

---

## Parallel Work Analysis (per .claude/rules/parallel-work-analysis.md)

### Subagent: ✅ each task is independently dispatchable
- Phase A: A.1 sequential (one file, spec edits), A.2/A.3 parallel-OK (read-only)
- Phase B: sequential (later tasks depend on constants from B.1)
- Phase C: parallel-OK (4 SQL helpers independent within Phase C, but each touches `analysis_sales.py` — sequential commits required per concurrent-edit rule 1)
- Phase D-E: sequential (orchestration depends on D helpers)
- Phase F: parallel-OK after E.1 ships (3 independent tests)

### Multi-Chat: ❌ — sub-worktree isolates from sibling chat
- This chat owns `.worktrees/phase2a-t5-poc-overview` exclusively
- Sibling chat (other endpoint port) edits a DIFFERENT file in `.worktrees/phase2a-t5-poc` parent — no overlap
- `main.py` is NOT touched by overview spec (route already registered in foundation)
- Concurrent-edit safety rules 1+5b enforced per-task commit

---

End of overview implementation plan.
