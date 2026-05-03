# Drill-Down Spec — Cycle 4 Final-Impl-Reviewer Findings

**Auditor**: cycle 4 final-impl-reviewer subagent (fresh eyes — read as if implementing PR-A)
**Date**: 2026-05-02
**Spec under review**: `docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md` (2029 LOC, latest commit `52a7e1bf9`)
**Cycle 1 findings**: `audit-cycle1.md` (1 critical + 6 important + 7 nits, addressed in `39dd278f3`)
**Cycle 2 findings**: `audit-cycle2.md` (R1 demoted, R2 documented, R3-R12 addressed in `028fcc657`)
**Cycle 3 findings**: `audit-cycle3.md` (X1+X2 critical + X3-X9 addressed in `52a7e1bf9`)
**Method**: Read spec end-to-end as PR-A impl chat. Verified Java line refs (8 spot-checks). Verified sister Python helper signatures and existence on origin/main. Verified `schema_compat.py` / `record-java-golden.sh` cited utilities. Verified post-cycle-3 sweep completeness on D-letters / golden counts / cite trail.

---

## Summary

| Severity | Count | Action |
|---|---|---|
| Critical | 2 | Must fix before spec PR merge — would block impl chat at PR-A plan-write phase |
| Important | 4 | Should fix before merge — impl chat would hit ambiguity / waste time |
| Nit | 3 | Optional — cosmetic / consistency |

Total: **9 findings**.

Java line ref accuracy: **6/6 spot-checks verified** (H1-H5 actual locations now grep-confirmable).

**Impl-blocker count**: 2 (Z1, Z2). These would force the impl chat to stop, search, and ask "what is the actual interface here?"

---

## Critical (2)

### Z1 — Sister helper signatures in §3.5 / §3.7 do NOT match origin/main reality (impl-blocker)

**Location**: §3.5 dim processors lines 631-651, 686-696, 716-731, 757-786, 815-832; §3.7 wrapper lines 999-1015; §2.3 imports lines 204-207

**Problem**: Spec calls sister helpers as `_get_region_ranking(conn, factory_id, start_date, end_date)` etc — passing `conn` as first arg + 4 positional args. **Verified against origin/main `backend/python/smartbi_compat/api/analysis_region.py:720` and `analysis_department.py:373`**:

```python
# analysis_region.py:720 (origin/main):
async def _get_region_analysis(factory_id: str, range_: DateRange) -> dict: ...
#                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
#                              No `conn` arg, takes DateRange not start/end pair, ASYNC

# analysis_department.py:373 (origin/main):
async def _get_department_ranking(
    factory_id: str, start_date: date, end_date: date  # No conn arg, ASYNC
) -> list[dict]: ...

# analysis_sales.py:1485, 1511, 1611 (verified in worktree):
async def _get_salesperson_ranking(factory_id: str, range_: DateRange) -> list: ...
async def _get_product_ranking(factory_id: str, range_: DateRange) -> list: ...
async def _get_sales_trend_chart(...) -> dict: ...
```

Three concrete divergences from spec assumptions:

1. **NO `conn` first arg**: All 5 sister helpers manage their own DB connections internally via `await _to_thread(_query_*, ...)`. Spec's `engine.begin() as conn` shared-conn pattern in §3.7 cannot pass `conn` to them.

2. **`async def`, not sync**: The 5 sister helpers are `async`. Spec calls them inside the sync `def _exec()` body (§3.7 lines 989-1047) — directly calling an async function from sync context returns a coroutine, doesn't await it. Would silently produce a non-dict result and crash on `result["drillPath"] = ...`.

3. **Signature shape varies**: 3/5 sales helpers take `range_: DateRange`, 1/5 (`_get_department_ranking`) takes `(factory_id, start_date, end_date)`, region only exposes `_get_region_analysis(factory_id, range_)` composite (NOT a ranking-specific helper).

**No `_get_region_ranking` exists in `analysis_region.py` on origin/main** — spec §3.5 line 581 says "or analog from `_get_region_analysis` composite path" but doesn't specify how to extract just the ranking. The composite returns `{heatmap, targetCompletion, dateRange, opportunityScores, generatedAt, ranking}` — impl chat must either (a) call composite + extract `["ranking"]` (wasteful — does 2× the work + previous-period query), or (b) refactor `_build_region_ranking` (sync rows-consumer at line 478) into a callable wrapper. Spec doesn't specify.

**Verify-real**:
```bash
git show origin/main:backend/python/smartbi_compat/api/analysis_region.py | grep -nE "^(async )?def _get_region"
# Shows: 720:async def _get_region_analysis(factory_id: str, range_: DateRange) -> dict:
# Does NOT show: _get_region_ranking

git show origin/main:backend/python/smartbi_compat/api/analysis_sales.py | grep -nE "^(async )?def _get_(product|salesperson|sales_trend)"
# Shows all 3 take range_: DateRange, all async
```

**Verify-fixed**: Spec §3.5 + §3.7 should:
1. Drop `conn` from all sister helper call sites
2. Use `await` — drop `def _exec()` outer wrapper, make `_process_drilldown_tx` a true async function with hybrid pattern: tx-scoped writes via `engine.begin()` + non-tx async sister calls
3. Specify per-sister DateRange wrapping: `range_ = DateRange.custom(start_date, end_date)` before each call expecting `range_`
4. Resolve region helper question: explicitly say "extract from `_get_region_analysis` composite via `["ranking"]` key" OR "spec-own a thin sync helper `_drilldown_get_region_ranking` in this PR" (per D1 ownership pattern)

After fix:
```bash
grep -E "_get_region_ranking\(conn" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
# Should return 0 matches
```

**Severity rationale**: This is the highest-impact finding of cycle 4. An impl chat following §3.7 verbatim writes code that (a) cannot import `_get_region_ranking` (doesn't exist), (b) calls async functions from sync context (silent coroutine leak), (c) passes positional `conn` arg that recipient doesn't accept (TypeError at runtime). Three different categories of immediate failure on first impl run. Worse, the impl chat won't know which fix to apply because the spec doesn't even acknowledge the async/sync boundary tension between `engine.begin()` and the async sister helpers. Cycle 1-3 audits all missed this because they spot-checked Java refs but not Python sister-helper signatures (the very class of failure that PR #47 cycle 4 caught for `_fetch_all` / `verify_factory_access` per `feedback_phase2a_sister_spec_import_audit.md`).

### Z2 — H1-H5 helper Java line refs are partially undefined; spec §3.4 H1 says "TBD via grep" but H2-H5 also need explicit refs

**Location**: §3.4 H1 line 433-435, H2 line 471, H3 line 498, H4 line 524, H5 line 551

**Problem**: §3.4 H1 has line 433 placeholder: *"In RegionAnalysisServiceImpl.java (line numbers TBD via grep — locate during impl)"*. H2-H5 only cite the **call site** in `SmartBIServiceImpl.java` (e.g., H4 line 524: "called from `SmartBIServiceImpl.java:2028`"), not the **implementation site** in the respective service impl files.

The impl chat needs to port verbatim — they need the actual Java method body. Verified line numbers are findable now:

| Helper | Actual location | Spec status |
|---|---|---|
| H1 `getProvinceRanking` | `RegionAnalysisServiceImpl.java:97` | TBD-via-grep (acknowledged) |
| H2 `getCityRanking` | `RegionAnalysisServiceImpl.java:146` | NOT mentioned |
| H3 `getDepartmentDetail` | `DepartmentAnalysisServiceImpl.java:113` | NOT mentioned |
| H4 `getProductDistributionChart` | `SalesAnalysisServiceImpl.java:537` | NOT mentioned |
| H5 `getSalespersonMetrics` | `SalesAnalysisServiceImpl.java:404` | NOT mentioned |

Without the impl line refs, an impl chat must:
1. Stop spec reading
2. grep the Java codebase (which the spec author already did since they cited the interface methods)
3. Find the line, read the body, port it
4. Hope they grep'd the right method (multiple `getDepartmentDetail` overloads may exist)

This is precisely the "fabricated cite" failure mode flagged by cycle 3 X2 in a different shape: incomplete cite information forces the impl chat to recreate the spec author's research, with high risk of getting it wrong (e.g., `getDepartmentDetail` returns `DashboardResponse`, not the `DepartmentDetail` DTO that spec §3.4 H3 line 510 implies — this divergence between spec ("DepartmentDetail") and Java actual ("DashboardResponse") would be caught immediately if the impl line ref had been provided).

**Verify-real**:
```bash
grep -nE "TBD via grep|line numbers TBD|TBD via golden" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
# Should show 1 match (H1 line 433) plus golden-related TBDs
```

For H3 specifically:
```bash
grep -nE "DashboardResponse|DepartmentDetail" backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/DepartmentAnalysisServiceImpl.java | head -5
# Confirms return type is DashboardResponse, not DepartmentDetail
```

**Verify-fixed**: Add a table to §3.4 with all 5 helpers' impl-site Java line refs:
```markdown
| Helper | Java method | Impl line | Return type |
|---|---|---|---|
| H1 | regionService.getProvinceRanking | RegionAnalysisServiceImpl.java:97-145 | List<RankingItem> |
| H2 | regionService.getCityRanking | RegionAnalysisServiceImpl.java:146-193 | List<RankingItem> |
| H3 | deptService.getDepartmentDetail | DepartmentAnalysisServiceImpl.java:113-... | DashboardResponse |
| H4 | salesService.getProductDistributionChart | SalesAnalysisServiceImpl.java:537-... | ChartConfig |
| H5 | salesService.getSalespersonMetrics | SalesAnalysisServiceImpl.java:404-... | List<MetricResult> |
```

After fix:
```bash
grep -nE "RegionAnalysisServiceImpl.java:9[0-9]|DepartmentAnalysisServiceImpl.java:11[0-9]|SalesAnalysisServiceImpl.java:[45][0-9][0-9]" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
# Should show 5+ refs (all 5 helpers + table rows)
```

**Severity rationale**: Per organizer focus area 2a, this was explicitly called out as a verification target. Impl chat would hit the gap at PR-A planning step ("write 5 helpers" task) and have to either pause-and-grep or guess. H5 is particularly high-risk because spec §3.4 H5 line 565 says return is "single MetricResult dict (10 fields per Lombok @Data)" — but verified Java is `List<MetricResult> getSalespersonMetrics(...)` (line 404), so the return is a LIST not a single object. Impl chat would write the wrong shape and only catch it at golden compare. (Also H3 mismatch: spec says `DepartmentDetail`, Java returns `DashboardResponse`.) Both are factual misstatements derivable from the missing line refs.

---

## Important (4)

### Z3 — `record-java-golden.sh` extension specification is vague; commands in §4.1 use a CLI shape that doesn't match the existing positional-arg script

**Location**: §4.1 lines 1247, 1252-1308; §2.2 lines 189-194; §7.2 line 1789

**Problem**: Verified `scripts/record-java-golden.sh` (67 lines) uses **positional args**: `<factory_id> <endpoint_path> <output_filename> [--prod]`. Spec §4.1 commands use mixed positional + flag args:

```bash
./scripts/record-java-golden.sh F999 \                           # positional 1
    '/api/mobile/{factoryId}/smart-bi/drill-down' \              # positional 2
    drill-down-F999-region-L1.json \                             # positional 3
    --method POST --data-json '{"dimension":"region",...}'       # NEW flag args
```

Two issues:

1. **No spec on extension shape**: Spec §4.1 says "Diff scope ~10 lines" but doesn't show the actual diff. The extension chat needs to know:
   - Should the new args go AFTER the 3 positional args, or interleave?
   - How does `--prod` arg interact (currently positional 4)?
   - Should `--data-json` accept a file path or inline JSON?
   - Should the script accept `--method GET` (default) explicitly or only require `--method POST`?

2. **Inconsistent with cycle 3 X8 nit**: Spec §2.3 says "`record-java-golden.sh` POST support" extension is needed, and §8.4 line 1882 calls it a HARD prereq. But the actual diff is left to the impl chat to design.

**Verify-real**:
```bash
cat scripts/record-java-golden.sh | wc -l       # 67 lines (existing)
grep -c "X-data\|--data-json\|POST" scripts/record-java-golden.sh   # 0 (no POST support)
grep -nE "method POST|--data-json" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md | wc -l
# Many references in spec, but no diff shown
```

**Verify-fixed**: Spec §4.1 Option A should include the actual ~10-line diff (or pseudo-diff) showing the script change. Example:

```diff
- ENV_FLAG="${4:-test}"
+ # Parse positional + optional flags
+ shift 3
+ METHOD="GET"
+ DATA_JSON=""
+ ENV_FLAG="test"
+ while [[ $# -gt 0 ]]; do
+     case "$1" in
+         --method) METHOD="$2"; shift 2;;
+         --data-json) DATA_JSON="$2"; shift 2;;
+         --prod) ENV_FLAG="--prod"; shift;;
+     esac
+ done
...
- curl -sS --fail -H "Authorization: Bearer $TOKEN" "$URL"
+ if [[ "$METHOD" == "POST" ]]; then
+     curl -sS --fail -X POST -H "Authorization: Bearer $TOKEN" \
+          -H "Content-Type: application/json" --data "$DATA_JSON" "$URL"
+ else
+     curl -sS --fail -H "Authorization: Bearer $TOKEN" "$URL"
+ fi
```

After fix:
```bash
grep -A 10 "Option A.*recommended" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md | grep -c "shift\|case \$1"
# Should show ≥1 match indicating diff is shown
```

**Severity rationale**: §8.4 lists this as **HARD prereq #2 BEFORE 8 goldens record**. Per cycle 3 X3, golden recording is itself a HARD prereq before PR-A plan finalizes. So this script extension blocks the entire PR-A workflow. Leaving it as "impl chat designs the extension" wastes 30+ minutes of an impl chat's time + adds risk of accidentally breaking existing GET-only sister-spec golden recording.

### Z4 — H5 spec says "single MetricResult dict (10 fields)" but Java returns `List<MetricResult>` — factual error

**Location**: §3.4 H5 lines 549-572

**Problem**: Spec §3.4 H5 line 565 says:

```
Returns single MetricResult dict (10 fields per Lombok @Data):
metricCode, metricName, value, formattedValue, unit, changePercent,
changeDirection, alertLevel, dimensionValue, description.
```

Verified `SalesAnalysisServiceImpl.java:404`:
```java
public List<MetricResult> getSalespersonMetrics(String factoryId, String salespersonName,
```

Returns `List<MetricResult>`, NOT a single object. Spec §3.5 salesperson processor (line 829) wraps in `{"data": ...}` — so the actual API response shape would be `{"data": [{...}, {...}, ...]}` (list), not `{"data": {...}}` (single dict).

This is the same factual-error class as Z2 (missing impl line refs led to wrong return type).

Note: §3.4 H3 has the same pattern — spec says `DepartmentDetail` DTO but Java actually returns `DashboardResponse` (verified `DepartmentAnalysisServiceImpl.java:113`).

**Verify-real**:
```bash
grep -nE "single MetricResult dict|DepartmentDetail" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
# Shows 2-3 stale claims about wrong return types

grep -nE "public.*getSalespersonMetrics|public.*getDepartmentDetail" backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/*.java
# Shows actual return types: List<MetricResult> + DashboardResponse
```

**Verify-fixed**: Update §3.4 H5 to:
```
Returns List[MetricResult] (NOT single dict). Each MetricResult has 10 Lombok @Data fields:
metricCode, metricName, value, formattedValue, unit, changePercent, changeDirection,
alertLevel, dimensionValue, description.
```

Update §3.4 H3 similarly: change "DepartmentDetail DTO (NOT a list)" to "DashboardResponse DTO (verify return type via Java line 113 + golden recording)".

After fix:
```bash
grep -nE "single MetricResult dict|Returns single DepartmentDetail" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
# Should return 0 matches
```

**Severity rationale**: Direct factual error — would cause impl chat to write Python helper returning wrong type. Caught at golden compare time but wastes review cycles. Same root-cause class as Z2 (missing impl line refs).

### Z5 — D8 label miscited at §3.5 time processor (says "D8 dead branch" but D8 = cost_amount divergence)

**Location**: §3.5 line 754

**Current text**:
```
Python mirror (T2 lock: level always 1 in production, but switch ports for parity; D8 dead branch verbatim):
```

**Problem**: Per cycle 3 X4 fix establishing D-letter labels (§1.7 lines 152-155), D6 = "T2 dead level>1 verbatim port", D8 = "cost_amount divergence". Line 754 says "D8 dead branch verbatim" which is the D6 concept, not D8. Cycle 3 X4 sweep was incomplete — same root cause as cycle 2 R1 sweep miss → cycle 3 X1.

**Verify-real**:
```bash
grep -n "D8 dead branch\|D6 dead branch" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
# Shows: 754:Python mirror (T2 lock: level always 1 in production, but switch ports for parity; D8 dead branch verbatim):
```

**Verify-fixed**: Replace `D8 dead branch verbatim` with `D6 dead branch verbatim`. Then verify:
```bash
grep -n "D8 dead branch" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
# Should return 0 matches
```

**Severity rationale**: Same incomplete-sweep failure mode as cycle 3 X1 (R1 fix missed §1.1 line 77) and cycle 3 X3 (R3 fix missed 8 places of "9 → 8"). Single-line miss but contributes to cumulative label confusion across the spec. Cycle 3 cross-cutting observation #1 explicitly noted: "Cycle 2 fixes need a final post-edit search-and-replace verification pass". This finding shows that lesson didn't fully land in cycle 3 sweeps either.

### Z6 — §1.7 D8 description says "cost_amount divergence" but tx wrapper §3.7 line 754 also references D8 for dead branch — internal inconsistency

**Location**: §1.7 line 155 + §3.5 line 754 + §1.7 line 153 (D6)

**Problem**: Combined effect of Z5 — even after fixing line 754 to D6, the §1.7 D-label set still has subtle gaps:
- D6 explicitly defined at §1.7 line 153
- D7 explicitly defined at §1.7 line 154
- D8 explicitly defined at §1.7 line 155
- But §1.7 lines 148-155 enumerate items 1-7. Items 1-4 use natural numbering (1./2./3./4.); items 5-7 add D-letters (D6, D7, D8). The first 4 items use D-letters too (D1, D2, D3+D4, D5).

Wait, re-reading §1.7:
- Item 1: D1
- Item 2: D2
- Item 3: D3+D4
- Item 4: D5
- Item 5: D6
- Item 6: D7
- Item 7: D8

So 8 D-letters total (D1, D2, D3, D4, D5, D6, D7, D8). 7 items because D3+D4 share an item. Not a logical problem, but cycle 3 X4 fix introduced this bundling that may confuse readers — D3 and D4 are co-defined in item 3 but referenced separately elsewhere.

Quick scan for D3 / D4 separate refs:
```bash
grep -n "\bD3\b\|\bD4\b" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md | head
```

D3 / D4 referenced in item 3 (§1.7 line 151), §3.7 lines 969, 985, 1052 ("D3+D4" or "D4"). These are usable but the convention "D3+D4 share definition" is unusual and may trip a reader looking up "what is D4" individually.

**Verify-real**:
```bash
grep -nE "\bD3\b" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
grep -nE "\bD4\b" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
# Both show refs but neither has standalone definition; both share item 3 of §1.7
```

**Verify-fixed**: Either:
- Option A: Split D3+D4 into two items (D3 = mixed read-write tx wrapper concept; D4 = `engine.begin()` Python idiom specifically). 8 items total.
- Option B: Add a one-line clarification at §1.7 item 3: "D3 = the cross-cutting decision (mixed read+write atomicity); D4 = the specific implementation (`engine.begin()` + `_to_thread`). Often referenced jointly as 'D3+D4'."

After fix:
```bash
grep -A 1 "D3 — \|D3+D4 —" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
# Should show clear distinction between D3 and D4 OR confirm they're intentionally bundled
```

**Severity rationale**: Cosmetic/labeling, but emerges from the same incomplete-sweep root cause. Future audit cycles or the impl chat will encounter "see D4 §3.7" and grep — landing in D3+D4 item — slight friction.

---

## Nit (3)

### Z7 — Spec body has `parentDimension` and `parentValue` listed twice (controller DTO + Java reads them in service-side `_compute_drill_path` may be confusing)

**Location**: §3.10 lines 1212-1213 vs §3.10 lines 1229-1233 (note paragraph)

**Problem**: §3.10 lists `parentDimension` and `parentValue` in the "Fields ACTUALLY in controller DTO (7 fields)" group at lines 1212-1213, with comment "accepted but not read by drill-down dispatch / (Java service holds them but processDrillDown / dim processors don't invoke getParentDimension/Value)". Then immediately at line 1229: "Controller DTO has `parentDimension` + `parentValue` but service-level `getDrillPath()` (T4) uses `parentContext`. Field name mapping is asymmetric".

The spec correctly captures that `parentValue` flows through to service DTO but `processDrillDown` doesn't read it. But there's no answer to the practical question: **does this mean Python should accept `parentValue` in Pydantic and forward to `_compute_drill_path` as `parent_context`?** Currently spec says §3.7 line 1027-1028 calls:

```python
result["drillPath"] = _compute_drill_path(
    request.parentContext, request.value
)
```

— passing `request.parentContext` (always None from HTTP because controller DTO doesn't include it) NOT `request.parentValue`. This matches Java behavior (controller doesn't populate service-level `parentContext` either), so the spec is correct.

But it does mean **`parentValue` is 100% dead in Python** — accepted via Pydantic, but never read anywhere. Cycle 3 X7 already flagged this as nit; cycle 4 affirms but notes the spec confused itself with the asymmetric note.

**Verify-real**:
```bash
grep -n "parentValue\|parent_value" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md | wc -l
# Many refs; checking they all consistently say "accepted-but-unread"
```

**Verify-fixed**: Add 1 sentence to §3.10 line 1213 comment: "Same as `parentDimension` — also dead-pass-through. T4 `_compute_drill_path` uses `parentContext` (separate field), not `parentValue`."

After fix:
```bash
grep -A 1 "parentValue: Optional\[str\]" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
# Should clarify it's not used by T4
```

**Severity rationale**: Cosmetic. Doesn't block impl. May save 30 seconds of confusion when impl chat reads §3.10.

### Z8 — `wrap_response` line range cited inconsistently (§3.8 line 1112 says "line 37-73" but actual is 37-56; `wrap_error` is 59-73)

**Location**: §3.8 line 1133

**Current text** (line 1133):
```
# `wrap_error` definition lives at backend/python/smartbi_compat/schema_compat.py:59-73
```

**Problem**: Verified `schema_compat.py` (read by audit). `wrap_response` is lines 37-56 (8 lines + 2 between). `wrap_error` is lines 59-73 (5-field error envelope). The spec correctly cites `wrap_error` at line 59-73 in §3.8 line 1133. Looking elsewhere, spec §1.7 line 152 says: "Python `wrap_error` (schema_compat.py:59-73) emits 5-field envelope" — also correct.

But §2.3 line 215-216 says:
```
└── from smartbi_compat.schema_compat import wrap_response, wrap_error
    # ^ both verified at backend/python/smartbi_compat/schema_compat.py:37-73
```

This `37-73` range covers BOTH `wrap_response` (37-56) AND `wrap_error` (59-73), which is technically correct but ambiguous. An impl chat looking up "wrap_response" via `schema_compat.py:37` would see the function — fine. But the combined range "37-73" obscures that they're separate functions.

Also: §3.8 line 1139 says "`wrap_error_with_hint` exists in `schema_compat.py:76-98` for the rare case they're needed" — verified correct.

**Verify-real**:
```bash
grep -n "schema_compat.py:" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
# Shows 5 cites, with one combined "37-73" that bundles two functions
```

**Verify-fixed**: Update §2.3 line 216 to be more precise:
```
# ^ wrap_response at schema_compat.py:37-56 (5-field success envelope)
# ^ wrap_error    at schema_compat.py:59-73 (5-field error envelope)
```

After fix:
```bash
grep -n "schema_compat.py:37-56\|schema_compat.py:37-73" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
# Should show 37-56 (precise) not 37-73 (combined)
```

**Severity rationale**: Cosmetic. Cycle 4 organizer focus area 2c asked to verify 8 F999 goldens recording protocol completeness — this is tangentially related (impl chat needs to import these helpers correctly).

### Z9 — §10 still says "8 references" but §10 cite list itself contains an unverified reference (PR #24 Phase 2B-β)

**Location**: §10 lines 1984-1992, item 7

**Current text** (line 1992):
```
7. **Phase 2B-β AI orchestration** (PR #24) — `handleDrillDownIntent` lineage (out-of-scope but cite for AI path future port)
```

**Problem**: Cycle 3 X9 verified that PR #24 is unverified — note in §9.1 line 1918 acknowledges: "The 'Phase 2B-β #24' PR # cite at spec line 15 is unverified". But §10 line 1992 still cites "(PR #24)" without the unverified caveat. Same incomplete-sweep pattern as Z5.

Also: §10 intro (line 1984) says "MUST cite these 8 references" — but the list has 8 numbered items; cycle 3 already established 9 (Tier 2 4-set + Wave 1 finance 5 + Wave 2 query-templates + Phase 2B-β + memory) + rules. The "8 references" in §10 is the curated audit-cite subset, which §10 doesn't clarify is a subset. Cycle 1 N7 noted this and the proposed clarification was to add "These 8 are the highest-leverage citations; full list in §9.1". That clarification is missing.

**Verify-real**:
```bash
grep -n "PR #24" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
# Multiple refs; some have "unverified" caveat, others don't (line 15, line 1992)

grep -n "MUST cite these 8" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md
# Line 1984 - no clarification it's a curated subset
```

**Verify-fixed**: Two-part fix:
1. Update §10 line 1992 to add "(PR # unverified per cycle 3 X9)" or drop the PR # entirely
2. Update §10 line 1984 to: "MUST cite these 8 highest-leverage references (full list of 13 in §9.1)"

After fix:
```bash
grep -nE "PR #24.*unverified|unverified.*PR #24" docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md | wc -l
# Should be ≥2 (line 15 already has caveat, plus line 1992 now)
```

**Severity rationale**: Cosmetic. Low impact on impl chat. Carries forward an incomplete-sweep symptom.

---

## Cross-cutting observations

1. **Critical findings Z1+Z2 are class "phantom interface" — spec describes a Python interface that doesn't exist on origin/main**. Per `feedback_phase2a_sister_spec_import_audit.md`, this is the same failure mode caught for inventory PR #47 cycle 4 (`_fetch_all`, `verify_factory_access` fabricated imports). Cycle 1-3 didn't catch because Java line ref verification was the focus, not Python sister helper signature verification. Cycle 4 final-impl-reviewer mandate explicitly includes this class, which is why it surfaced now.

2. **Cycle 4 focus area 2a (5 missing helpers Java line refs)** — RESOLVED via Z2 finding. Once Z2 fix lands, all 5 helpers have actual line refs. H3+H5 also surface concrete spec/Java mismatches (return types).

3. **Cycle 4 focus area 2b (T7 transaction design completeness)** — checked, mostly OK. SQL INSERT column set matches schema (V2026_01_18_01__smart_bi_tables.sql:56-74). `engine.begin()` context wraps read+write. `_to_thread` shim usage shown. Rollback-on-exception path traced. Test for T7 atomicity exists at §5.1 TestTransactionAtomicity. Only gap: Z1 surfaces that the wrapper's read-dispatch calls async sister helpers from sync `_exec()`, breaking the unified tx model — needs §3.7 redesign.

4. **Cycle 4 focus area 2c (8 F999 goldens recording protocol)** — checked. §4.1 shows verbatim commands but they depend on Z3 (script extension shape unspecified). JWT_SECRET sourcing instructions are mentioned at §4.1 line 1252 (`from /www/wwwroot/cretas/.env.test`). Output filenames consistent with §2.1 enumeration. Once Z3 + script extension lands, recording is runnable.

5. **Cycle 4 focus area 2d (4-cycle audit fix integration consistency)** — checked. Most cycle 1-3 fixes propagated. Single-line gaps remaining: Z5 (D8 vs D6 at line 754), Z9 (PR #24 caveat at line 1992). Pattern matches cycle 3 cross-cutting observation #1: "Cycle 2 fixes need a final post-edit search-and-replace verification pass" — applies to cycle 3 fixes too.

6. **§9.5 audit pattern lessons section recommendation** (organizer suggestion):
   - **Recommendation**: Add a short §9.5 (~30-40 lines) titled "Audit pattern lessons from drill-down spec 4-cycle review". Capture:
     - Incomplete-sweep failure mode (cycles 2+3+4 X1+X3+X6+X9+Z5+Z9 = 6 instances total)
     - Fabricated cite failure mode (cycle 3 X2 — procurement I6 fix)
     - Phantom interface failure mode (cycle 4 Z1+Z2 — sister helper signatures)
     - Post-edit grep verify mitigation (cycle 4 introduces verify-real / verify-fixed protocol)
     - 8-vs-5 envelope R1 demoted finding nuance (cycle 2 R1 + cycle 3 X1)
   - **Justification**: The 4-cycle audit caught **24 distinct findings** (cycle 1: 14, cycle 2: 12, cycle 3: 9, cycle 4: 9 — some overlap on related areas but each cycle found new real issues). Documenting the patterns helps future Tier 3 spec chats avoid the same failure modes. NOT over-engineering — the costs of these failures (impl-chat blockers, refactor cycles) are non-trivial.

7. **Java line ref accuracy**: 6/6 cycle 4 spot-checks verified correct (`RegionAnalysisServiceImpl.java:97, 146`; `DepartmentAnalysisServiceImpl.java:113`; `SalesAnalysisServiceImpl.java:404, 537`). Spec didn't have these refs (Z2), but the underlying Java reality is consistent and findable.

8. **Sister Python helper verification (Z1 root cause)**: 5/5 sister helpers checked on origin/main — none have the `(conn, factory_id, start, end)` signature spec assumes. All are either `(factory_id, range_)` async or `(factory_id, start_date, end_date)` async. Zero match the spec's spec'd interface. This is the most concerning class of finding because it means an impl chat following the spec literally cannot proceed past `import` step.

9. **D-letter label coverage**: D1, D2, D3, D4, D5, D6, D7, D8 all defined in §1.7 (cycle 3 X4 fix). D3+D4 share item 3 (Z6 nit). All 8 referenced consistently in spec body except line 754 (Z5 — uses D8 where D6 was meant).

---

## Recommendation

**fix-then-ship**

**Critical findings Z1 + Z2 must be addressed before spec PR merge** — they are impl-blockers that would force an impl chat to stop and ask "what is the actual interface?" within the first hour of work. Z1 is the highest-impact (sister helper signature mismatch is a fabricated-interface class failure); Z2 is the easiest-impact (5 helper line refs are grep-confirmable in 2 minutes per organizer focus area 2a).

**Important findings Z3 + Z4 + Z5 + Z6** should be batched into the same edit pass with Z1/Z2:
- Z3 fixes the script extension blocker per §8.4 prereq #2
- Z4 fixes 2 factual spec errors (H3 + H5 return types) — 2-line edits each
- Z5 + Z6 are D-label hygiene (1-2 line edits each)

**Nit findings Z7 + Z8 + Z9** are optional but trivial (1-line edits each) — bake them in same pass for cleanliness.

**Estimated edit scope**: ~80-120 lines edited across §3.4 (Z2 + Z4) / §3.5 (Z1) / §3.7 (Z1 - major restructure of `_exec` async/sync model) / §3.10 (Z7) / §4.1 (Z3 - add diff) / §1.7 (Z6) / §10 (Z9) / §2.3 (Z8) / line 754 (Z5).

**§9.5 audit pattern lessons section** — recommend adding (per organizer suggestion + cross-cutting observation #6). ~30-40 lines, lower priority than Z1-Z6 fixes.

**Most-important finding summary**: Z1 (sister helper signatures don't match origin/main reality) + Z2 (H1-H5 Java impl line refs missing for 4/5 helpers, plus 2 wrong return types in H3 + H5) are the two blockers. Z1 is a structural issue requiring §3.7 wrapper redesign (async/sync boundary at engine.begin() + sister helper async calls); Z2 is a documentation completeness issue caught by line-ref verification.

**Spec architecture** (5-dim dispatch + write side-effect in shared tx + D1 ownership of 5 helpers) **remains sound** — fixes are scoped to interface descriptions and labels, not the design.

**Cycle 4 verdict**: 9 findings is at the upper end of "ship-ready after fix" — bordering on "needs cycle 5 for one more sweep". However, Z1 is the only structural concern; the remaining 8 are documentation/labeling. If Z1's §3.7 redesign is non-trivial, organizer may want to dispatch a focused cycle 5 reviewer specifically on the Z1 fix shape (async/sync boundary in `_process_drilldown_tx`). Otherwise, ship after fix-batch.
