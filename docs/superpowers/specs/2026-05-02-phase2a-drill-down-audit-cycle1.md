# Drill-Down Spec — Cycle 1 Self-Review Findings

**Auditor**: Chat 3 (self-review)
**Date**: 2026-05-02
**Spec under review**: `docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md` (1917 LOC, commit `b513b0adb`)
**Method**: Read-through end-to-end; check internal consistency, factual claims (Java line refs, file paths, spec citations), pseudocode correctness, decision integrity.

---

## Summary

| Severity | Count | Action |
|---|---|---|
| Critical | 1 | Must fix before spec PR |
| Important | 6 | Should fix before spec PR |
| Nit | 7 | Optional — defer to cycle 2/3 if time pressed |

Total: 14 findings.

---

## Critical (1)

### C1 — §1.5 incorrectly lists `salesperson level>1` as out-of-scope

**Location**: §1.5 row 3

**Current text**:
> | `salesperson` dim level>1 with filterValue (calls `getSalespersonMetrics`) | technically in switch (line 2068-2073) but falls into "T2 dead level>1" — frontend never sends. Python ports verbatim for parity (D8). |

**Problem**: Java `processSalespersonDrillDown` (line 2064-2076) dispatches purely on `filterValue` presence, NOT on `level`. Re-read:

```java
if (request.getFilterValue() == null || request.getFilterValue().isEmpty()) {
    result.put("data", salesService.getSalespersonRanking(...));
} else {
    result.put("data", salesService.getSalespersonMetrics(..., request.getFilterValue(), ...));
}
```

There is NO level check. The L2 path (calls `getSalespersonMetrics`) triggers whenever filterValue is present, regardless of level. Frontend sending `{dimension:"salesperson", value:"张三"}` would hit this path normally — it's NOT "T2 dead".

The `getSalespersonMetrics` helper IS already in §3.4 H5 as in-scope (one of the 5 missing helpers). So the §1.5 row contradicts §3.4.

**Fix**: Remove the salesperson row from §1.5 entirely. The helper H5 is correctly in-scope per §3.4. Update §3.5 salesperson processor pseudocode comment to clarify "dispatches purely on filterValue, no level check".

**Severity rationale**: Self-contradiction between §1.5 (out-of-scope) and §3.4 (in-scope) would confuse the impl chat about whether to implement H5. Could lead to skipped impl + missing F999 golden + bug in production drill-down for any salesperson with filter value.

---

## Important (6)

### I1 — §9.1 broken file path: `phase2b-beta-ai-orchestration-design.md` does not exist

**Location**: §9.1 Phase 2B-β AI orchestration cite

**Current text**:
> `docs/superpowers/specs/2026-04-22-phase2b-beta-ai-orchestration-design.md` (PR #24)

**Problem**: File does not exist. Verified via `ls`. Actual related files:
- `docs/superpowers/specs/2026-04-30-phase2b-beta-design.md` ✓
- `docs/superpowers/specs/2026-04-29-phase2b-ai-intent-layer-design.md` ✓

PR # may also be incorrect — `#24` is unverified.

**Fix**: Update cite to one of the correct file paths. Recommend `2026-04-30-phase2b-beta-design.md` (contains drill-down lineage to `handleDrillDownIntent`). Drop the PR # (or verify by querying gh).

### I2 — §9.1 broken file path: `phase2a-analysis-finance-payable-design.md` does not exist

**Location**: §9.1 Wave 1 finance specs cite

**Current text**:
> `docs/superpowers/specs/2026-04-30-phase2a-analysis-finance-payable-design.md` (PR #18) — first ported finance per-type endpoint

**Problem**: File does not exist. PR #18 (per memory `payable PR #18 retrospect`) was impl-only — no separate design spec doc was created.

**Fix**: Remove this line OR replace with "PR #18 (impl-only, no spec doc) — first ported finance per-type endpoint, retrospect findings led to Rule 4 introduction".

### I3 — §3.7 wrapper accepts `user_id` parameter but always passes `None` to recordUsage — dead pass-through

**Location**: §3.7 wrapper signature line 935-939, body line 999

**Current code**:
```python
async def _process_drilldown_tx(
    factory_id: str,
    request,
    user_id: Optional[int],   # from JWT payload (passed but unused per Java behavior)
) -> dict:
    ...
    _drilldown_record_usage(
        conn=conn,
        factory_id=factory_id,
        user_id=None,            # Java passes null at line 1066 (D7)
        ...
    )
```

**Problem**: The `user_id` parameter is accepted in the wrapper signature but never used — always `None` is passed to `_drilldown_record_usage`. This is "dead pass-through" — confusing for impl chat ("why does the wrapper take user_id if it's discarded?"). The route handler in §3.9 passes `auth.user_id` to this wrapper.

Two options to resolve:
- **(a) Drop `user_id` from `_process_drilldown_tx` signature entirely**: Wrapper internally always passes None to `_drilldown_record_usage`. Route handler in §3.9 also drops `user_id=auth.user_id` from the call. Cleanest — no dead parameter.
- **(b) Keep `user_id` in signature, pass it through**: Forwards `auth.user_id` to recordUsage. Diverges from Java line 1066 (which explicitly passes null) — violates byte parity for DB write.

**Fix**: Choose (a). Update §3.7 wrapper to drop `user_id` parameter, update §3.9 route handler call to drop `user_id=auth.user_id`. Remove the "passed but unused per Java behavior" comment.

### I4 — §3.10 `parentValue2` field is speculative future-proofing — should be removed

**Location**: §3.10 Pydantic model line 1165

**Current code**:
```python
parentValue2: Optional[str] = None       # potential future field
```

**Problem**: There is no Java DTO field, no controller field, no current API consumer of `parentValue2`. Adding speculative future fields to a Pydantic model violates "no premature abstraction" principle (CLAUDE.md "Don't design for hypothetical future requirements"). If the future need arises, add then.

**Fix**: Remove the line. Total Pydantic fields: 13 (down from 14).

### I5 — §3.10 misleading "alias to internal filter_value" comments

**Location**: §3.10 Pydantic model line 1152, 1156

**Current code**:
```python
value: Optional[str] = None              # alias to internal filter_value
filters: dict = Field(default_factory=dict)  # alias to additional_filters
```

**Problem**: Comments say "alias to internal filter_value" / "alias to additional_filters" but no Pydantic alias mechanism (`Field(alias="...")`) is used. The field name is just `value` / `filters`. The "internal filter_value" is a Java-side term — Python doesn't need an internal name distinct from the Pydantic attr.

Throughout pseudocode (§3.5 dim processors, §3.7 wrapper) we use `request.value` consistently — there's no `request.filter_value` anywhere. So the comments are misleading.

**Fix**: Drop "alias to..." comments. Keep field names `value` / `filters` as-is. Update class docstring to remove "internally uses same names for clarity. Service-level mapping happens implicitly inside `_process_*_drilldown` helpers via .value / .filters property access" — this misleadingly suggests there's a mapping; there isn't.

### I6 — §9.2 Rule 9 status is "incoming" but Rule 9 is now landed (#55)

**Location**: §9.2 Rule 9 line 1827

**Current text**:
> **Rule 9** (incoming sister-spec discoveries): xaxisField/yaxisField LOWERCASE for ChartConfig (H4 product distribution chart), DateRange 7-field shape (N/A — drill-down doesn't emit DateRange), ChartConfig empty-case emits nulls (H4 verify)

**Problem**: Per `git log origin/main` `eb71ca244 rules: add Rule 9 Lombok + Jackson serialization quirks to python-java-port.md (#55)`, Rule 9 has landed in main. The "incoming" qualifier is stale.

**Fix**: Update to "**Rule 9** (landed via #55)" or just drop "(incoming sister-spec discoveries)" qualifier.

### I7 — §1.6 unresolved TBD on userId; should be resolved per D7 decision

**Location**: §1.6 side effects line 130

**Current text**:
> Other defaults: `costAmount=0`, `responseTimeMs=null`, `userId=null` (Python may have user_id from JWT — TBD §3.6)

**Problem**: §3.6 already resolves this: "Java explicitly passes `null` ... To match byte-shape exactly ... Python should also pass `user_id=None`". The TBD parenthetical in §1.6 is stale. Combined with I3, this should be cleanly resolved as: "Python `_drilldown_record_usage` receives `user_id=None` per Java parity".

**Fix**: Update §1.6 to: "Other defaults: `costAmount=0`, `responseTimeMs=null`, `userId=null` (Python passes None per D7 — see §3.6 for Java line 1066 reference)".

---

## Nit (7)

### N1 — §1.1 contract description ambiguous on "either-null" vs "both-null" default trigger

**Location**: §1.1 request body comments

**Current text**:
> "startDate": "YYYY-MM-DD",                  // optional, defaults to thisMonth() if NULL
> "endDate": "YYYY-MM-DD"                     // optional, defaults to thisMonth() if NULL

**Problem**: Could be misread as "if startDate is NULL, set startDate to thisMonth() start; if endDate is NULL, set endDate to thisMonth() end" (independent triggers). Actual Java behavior is: if EITHER is null, BOTH get replaced with thisMonth() values. §3.3 + §3.7 are correct, but §1.1 could clarify.

**Fix**: Change to "// optional; if BOTH set, use as-is. If EITHER missing/null, BOTH default to thisMonth() per Java line 1029-1033."

### N2 — §3.4 H4 misleading "same DTO as `_build_geographic_heatmap`" claim

**Location**: §3.4 H4 line 509

**Current text**:
> Returns `ChartConfig` — same DTO as sister `_build_geographic_heatmap` in `analysis_region.py`.

**Problem**: Both produce ChartConfig dicts but with DIFFERENT content. `_build_geographic_heatmap` is for region heatmap (chartType=MAP); `getProductDistributionChart` is for product distribution (likely PIE or BAR). The DTO class is the same Lombok @Data class, but the runtime values differ. "Same DTO" is technically correct but might mislead an impl chat to assume same shape.

**Fix**: Change to: "Returns `ChartConfig` — same Lombok @Data class as sister specs use for chart outputs (e.g., region's `_build_geographic_heatmap` ChartConfig with chartType=MAP). Product distribution chart uses chartType=PIE or BAR — verify via golden."

### N3 — §3.7 SQLAlchemy comment says "asyncpg defaults match Java" but uses sync SQLAlchemy

**Location**: §3.7 wrapper docstring line 942

**Current text**:
> D4: REQUIRED propagation, READ_COMMITTED isolation (asyncpg defaults match Java).

**Problem**: The chosen implementation per the same section is "Sync SQLAlchemy + `_to_thread` shim", NOT asyncpg. "asyncpg defaults" here is a leftover from an earlier brainstorm option that was rejected. Sync SQLAlchemy `engine.begin()` defaults are also REQUIRED + READ_COMMITTED, but the comment should reference the actual technology in use.

**Fix**: Change to "(SQLAlchemy `engine.begin()` defaults: REQUIRED propagation + connection's default isolation level, typically READ_COMMITTED on PG)".

### N4 — §5.1 missing F001 manual smoke test class (sister specs have one)

**Location**: §5.1 test classes

**Problem**: Sister contract test files (e.g., `test_analysis_finance_contract.py:1992` `test_f001_receivable_byte_shape_manual` skipped) include an F001 manual smoke compare class. My §5 has TestF999GoldenPerDim parameterized but no equivalent for F001. Sister discipline includes one.

**Fix**: Add `class TestF001ManualSmoke` with `@pytest.mark.skip` decorator and one test per dim (or one combined test for region L1 as smoke) per sister pattern. Cite acceptance test in §7.2 already mentions F001 manual smoke — make the test class explicit in §5.

### N5 — §6.3 Map.of(N) sites enumeration could be more concrete

**Location**: §6.3 paragraphs 1-3

**Current text**:
> Per-dim processors each `new HashMap<>()` (line 1977 / 2003 / 2024 / 2039 / 2066) — per-dim hash order.

**Problem**: This says per-dim hash order TBD-FROM-GOLDEN, but doesn't list the exact source insertion sequences for each dim. Would be more useful for impl chat to have a per-dim source-order listing as the "starting point" before golden-driven reordering.

**Fix**: Add a per-dim source-order table:
```
| Dim | Source insertion order (per dim processor + post-mutation) |
|---|---|
| region | data, nextLevel, drillPath, level, dimension |
| department | data, nextLevel, drillPath, level, dimension |
| product | data, chart, nextLevel, drillPath, level, dimension |
| time | data, period, drillPath, level, dimension |
| salesperson | data, drillPath, level, dimension |  -- NO nextLevel |
```

### N6 — §3.10 docstring redundant "internally uses same names for clarity" can be trimmed

**Location**: §3.10 model docstring lines 1147-1149

(Subsumed in I5 fix — when removing alias comments, also trim this docstring.)

### N7 — §10 cite count discrepancy (lists 8, but earlier §9.1 lists 9-ish refs)

**Location**: §10 line 1872 says "MUST cite these 8 references"

**Problem**: §10 lists 8 numbered citations; §9.1 actually has 9-ish (4 Tier 2 + 5 Wave 1 finance + 1 Wave 2 query-templates + 1 Phase 2B-β + 2 memory cites = 13 total). The "8" in §10 is a curated subset. Could clarify.

**Fix**: Add to §10 intro: "These 8 are the highest-leverage citations for cycle 3 reviewer; full list in §9.1 (13 total references including memory cites)."

---

## Findings impact summary

| If fixed | Estimated edit scope |
|---|---|
| C1 only | ~5 line delete in §1.5 + ~3 line clarification in §3.5 |
| C1 + all I | ~30-40 lines edited across §1.5 / §1.6 / §3.7 / §3.10 / §9.1 / §9.2 |
| C1 + all I + N | ~60 lines (adds §6.3 table + N4 F001 smoke test class snippet) |

Recommended action: **fix C1 + all I (7 issues) before opening spec PR**. Defer N1-N7 to cycle 2 reviewer to catch more, then bake fixes together.

---

## Cycle 1 conclusion

Spec is **fundamentally sound** — Java line refs verified, decisions D1-D8 internally consistent, Tier 3 lineage valid. Issues are mostly:
- 2 broken file paths (I1, I2)
- 1 cross-section contradiction (C1)
- 4 minor pseudocode/comment cleanups (I3-I7)
- 7 nits

No structural redesign needed. Ready for cycle 2 (spec-reviewer subagent) after C1 + I fixes.

**Next**: bake C1 + I1-I7 into spec doc, commit + push, then dispatch cycle 2 subagent.
