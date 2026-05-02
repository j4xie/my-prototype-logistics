# Drill-Down Spec — Cycle 2 Spec-Reviewer Findings

**Auditor**: spec-reviewer subagent (cycle 2 — fresh eyes)
**Date**: 2026-05-02
**Spec under review**: `docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md` (1916 LOC, commit `39dd278f3`)
**Cycle 1 findings**: `docs/superpowers/specs/2026-05-02-phase2a-drill-down-audit-cycle1.md` (1 critical + 6 important + 7 nits, all addressed in `39dd278f3`)
**Method**: Spot-check Java line refs (verified 5+ citations); verify Pydantic/SQL pattern consistency with sister specs; cross-section consistency check; Rule 1-9 compliance scan; pseudocode correctness review.

---

## Summary

| Severity | Count | Action |
|---|---|---|
| Critical | 2 | Must fix before spec PR merge |
| Important | 6 | Should fix before merge |
| Nit | 4 | Optional |

Total: **12 findings**.

Java line ref accuracy: **8/9 verified correct**, 1 minor offset (R5).

---

## Critical (2)

### R1 — ApiResponse envelope is 8 fields, not 5; spec systematically wrong about error/success body shape

**Location**: §1.1 line 77, §1.7 line 150, §3.8 lines 1064-1071, §3.8 line 1097-1103, §6.3 line 1651, §4.3 lines 1395-1396, §4.3 line 1401

**Problem**: Spec repeatedly claims `ApiResponse` has **5 fields** and that controller catch produces a 5-field error envelope (no hint/hintTarget). Verified against `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/common/ApiResponse.java`:

```java
@Data
public class ApiResponse<T> implements Serializable {
    private Integer code;          // line 25
    private String message;        // line 28
    private T data;                // line 31
    private LocalDateTime timestamp; // line 34
    private Boolean success;       // line 37
    // UX 2026-04-18 进阶: optional fields rendered by frontend interceptor
    private String actionHint;     // line 41
    private String severity;       // line 44
    private String hintTarget;     // line 47
}
```

ApiResponse has **8 fields**, not 5. The 3 extra fields (`actionHint`, `severity`, `hintTarget`) were added 2026-04-18 (well before this spec).

**No `@JsonInclude(NON_NULL)` on ApiResponse**, and `application*.properties` files have NO `spring.jackson.default-property-inclusion=non_null` setting. Confirmed via grep — only `spring.jackson.time-zone`, `spring.jackson.date-format`, etc. So Jackson emits ALL 8 fields including the 3 nulls.

Sister spec PR #48 (query-templates) **explicitly documents the 8-field envelope** at §2.3:
```
code, message, data, timestamp, success, actionHint, severity, hintTarget
```
And query-templates Python impl `query_templates_write.py` line 257-273 emits these as `None`. The drill-down spec contradicts the sister spec it claims to inherit from (§9.1 cite).

**Concrete impact**:
- §3.8 example error body is wrong shape — actual Java response includes `actionHint: null, severity: null, hintTarget: null`
- `_wrap_drilldown_error` at §3.8 line 1097-1103 produces a 5-key dict; F999 error golden will have 8 keys → dict-eq mismatch
- All 9 success goldens will also have these 3 null keys; `wrap_response` (cited but not defined here) needs to emit them too
- Test at §4.3 line 1395-1396 `assert "hintTarget" not in body` will FAIL because hintTarget IS in the Java response (with null value)
- Spec §1.7 D5 description "5 fields, no hint/hintTarget" is materially false

**Fix**:
1. Update §1.1 line 77: `ApiResponse.java:25-47` (8 fields: code, message, data, timestamp, success, actionHint, severity, hintTarget)
2. Update §3.8 example body (line 1064-1071) to include 8 fields with 3 nulls
3. Update `_wrap_drilldown_error` (line 1097-1103) to emit 8 keys
4. Update §6.3 line 1651 to "8 fields"
5. Update §4.3 test assertions: replace `assert "hintTarget" not in body` with `assert body["hintTarget"] is None`; verify body has exactly 8 keys
6. Update §1.7 D5 (line 150): "Visible body 8 fields total — `actionHint, severity, hintTarget` flatten to null because controller catch uses `ApiResponse.error(String)` factory which doesn't set them"
7. Note in §3.7 wrapper: `wrap_response` helper (sister-shared) MUST emit the 3 nulls too — verify sister `wrap_response` impl already does this

**Severity rationale**: This is a structural spec bug — the wire format is wrong. F999 goldens would catch it at impl time, but the spec describes the wrong target. An impl chat following this spec literally would write code that fails byte-shape gate on first run. Worse, the spec's "no hint/hintTarget" claim is propagated across §1.7 / §3.8 / §6.3 / §4.3 / §10 making it look like an intentional design decision, when actually it's a misread of the Java code.

### R2 — `_drilldown_record_usage` hardcodes `cost_amount=Decimal("0")` but Java computes via `calculateCost()`

**Location**: §3.6 line 866 (helper signature default), §3.7 line 1008 (wrapper call), §1.6 line 129 ("costAmount=0")

**Problem**: Spec assumes Java `recordUsage(factoryId, null, "DRILLDOWN", 0, false)` (line 1066) produces `cost_amount=0` in the DB row. Verified against `SmartBIServiceImpl.java:1161-1176`:

```java
public void recordUsage(String factoryId, Long userId, String actionType, int tokenCount, boolean cacheHit) {
    SmartBiUsageRecord record = SmartBiUsageRecord.builder()
            .factoryId(factoryId).userId(userId).actionType(...)
            .tokenCount(tokenCount).cacheHit(cacheHit).success(true).build();

    // 计算费用
    BigDecimal cost = calculateCost(factoryId, tokenCount, cacheHit);
    record.setCostAmount(cost);  // ← Java DOES NOT pass 0 — it COMPUTES

    usageRepository.save(record);
}
```

And `calculateCost` (line 1954-1970):
```java
private BigDecimal calculateCost(String factoryId, int tokenCount, boolean cacheHit) {
    if (cacheHit) return BigDecimal.ZERO;
    Optional<SmartBiBillingConfig> configOpt = billingRepository.findByFactoryId(factoryId);
    if (configOpt.isEmpty()) return BigDecimal.ZERO;
    SmartBiBillingConfig config = configOpt.get();
    if (config.isUnlimitedMode()) return BigDecimal.ZERO;
    return config.getPricePerQuery();   // ← can be NON-ZERO
}
```

For a factory with `SmartBiBillingConfig` row that is NOT in `unlimitedMode`, `cost_amount = config.getPricePerQuery()` which is a non-zero value, even for DRILLDOWN with `tokenCount=0`. Python hardcoding `Decimal("0")` will produce a different DB row state for any such factory.

This is a silent byte-parity violation at the DB write level. The cost_amount is not in the API response, but downstream analytics (billing reports, usage dashboards) read this column and will diverge between Java and Python ports.

**Fix options**:
- **(a) Port `calculateCost` to Python**: Add `_drilldown_calculate_cost(conn, factory_id, token_count, cache_hit) -> Decimal` helper that mirrors Java line 1954-1970. Query `smart_bi_billing_config` table by factory_id. Pass result to `_drilldown_record_usage`.
- **(b) Document as known divergence**: Add to §8.3 "Already-known caveats" — Python passes 0 unconditionally, accepting that factories with non-unlimited billing configs will have under-counted costs in DRILLDOWN rows. Note this is a downstream analytics concern.

Recommend (a) for true parity; (b) is acceptable IF organizer agrees (downstream analytics impact must be assessed). Either way, spec must EXPLICITLY address this — currently it implies Java passes 0 directly which is false.

**Severity rationale**: This is a real Java→Python divergence at the DB write level that the spec misrepresents as parity. Even if F999 happens to have no billing_config row (testing reveals no diff), F001 / production factories WILL have rows. The spec's claim "Args mirror Java exactly" (§1.6 line 128) is false for cost_amount.

---

## Important (6)

### R3 — `level` and other DTO fields not in controller-level DrillDownRequestDTO; Pydantic model accepts them

**Location**: §3.10 lines 1159-1164, §1.5 line 123 ("Sort/limit/includeChildren"), §8.5 Q5 (line 1783)

**Problem**: Verified against `SmartBIAnalysisController.java:788-798` — `DrillDownRequestDTO` is an inner class with **only 7 fields**:
```java
@Data
public static class DrillDownRequestDTO {
    private String dimension;
    private String value;
    private String parentDimension;
    private String parentValue;
    private LocalDate startDate;
    private LocalDate endDate;
    private Map<String, Object> filters;
}
```

The DTO does NOT have: `level`, `parentContext`, `sortBy`, `sortDirection`, `limit`, `includeChildren`, `parentContext2`. The controller builder (line 541-550) does NOT pass `level` to the service-level `DrillDownRequest.builder()`. Therefore service-level `DrillDownRequest.level` always uses `@Builder.Default = 1` (line 96-97 of `DrillDownRequest.java`).

This means:
- Frontend cannot send `level` via HTTP — it's always 1 from Java
- Frontend cannot send `parentContext` — also always None
- Spec §3.10 Pydantic model accepting `level: Optional[int] = None` with **None default** diverges from Java's effective default of `1`

Concrete impact:
- Region L2 path (line 582-587 of service: `else if (level == null || level <= 1)`) — Java with `level=1` takes L2 branch when filterValue is set. Python with Pydantic default `level=None` ALSO takes L2 branch (`level is None or level <= 1`). Behavior matches by accident.
- Region L3 dead path (`else` branch) — only reachable when `level > 1`. Java HTTP cannot reach this; Python Pydantic accepting `level: int` from request body CAN. Drill-down golden recording with `level=2` per §4.1 line 1199, 1204 must FAIL Java-side because Java DTO doesn't accept `level` from JSON. Goldens with level >1 are unrecordable from real HTTP.

The spec at §4.1 expects to record `drill-down-F999-region-L3-dead.json` with `level=2` — this golden cannot be recorded because the DTO doesn't accept `level`! Either:
- Java would silently ignore the JSON `level` field (Spring Jackson default behavior with unknown fields) → Java's `level` stays at default `1` → L3 dead path never hits even in golden recording
- OR controller's DTO needs `level` added (out of scope for spec)

The §8.5 Q5 wording ("verify controller DTO definition") frames this as an unresolved question — but it's resolvable now and the answer changes test plan.

**Fix**:
1. Update §3.10 docstring/comments to clarify: controller DTO does NOT include `level`/`sortBy`/etc; these Python fields are dead-pass-through (accepted but ignored). Drop `parentContext` field from Pydantic model entirely (controller never sets it; service-level field is internal).
2. Update §4.1 to drop `drill-down-F999-region-L3-dead.json` and `drill-down-F999-time-L1.json` (level=1) from F999 goldens, OR document that goldens are recorded by directly invoking service-level method (bypassing controller) — which adds setup complexity.
3. Resolve §8.5 Q5 inline: "Controller DTO does NOT have `level` field. Java service receives `@Builder.Default level=1`. Python Pydantic should default to `1` (or accept None and treat as 1 in dispatchers) to maintain parity."
4. Re-verify §3.5 region/time dim processor branching: Java `level=1` → L2 path for region with filterValue, MONTH for time. Python should match this.

**Severity rationale**: Drives test plan (golden recording) and spec correctness about what level values production traffic produces. If impl chat tries to record L3 dead golden via HTTP, will fail to reproduce.

### R4 — Pseudocode references `wrap_response` helper that's neither defined in spec nor verified to exist in sister modules

**Location**: §3.9 line 1128, §2.3 import block line 207

**Problem**: §3.9 says:
```python
result = await _process_drilldown_tx(...)
return wrap_response(result)        # sister-shared helper, ApiResponse success envelope
```

And §2.3 imports `from smartbi_compat.schema_compat import wrap_response, wrap_error`.

But:
1. The spec doesn't define `wrap_response` shape (does it produce 5 or 8 fields? Per R1 it should be 8.)
2. The actual `_wrap_drilldown_error` is defined inline in §3.8 (NOT imported from `schema_compat`) — inconsistent with §2.3 importing `wrap_error` from same module
3. Need to verify `smartbi_compat/schema_compat.py` actually has `wrap_response` with the right shape

A grep shows no obvious `schema_compat.py` in the repo — let me check (verify in impl phase). If module doesn't exist, this is a fabricated import.

**Fix**: Either define `wrap_response` inline in §3.8 (consistent with `_wrap_drilldown_error`), OR verify and cite the source file path + line for the existing `wrap_response` helper. Drop §2.3 reference to `wrap_error` since spec defines `_wrap_drilldown_error` inline.

**Severity rationale**: Spec implies a sister-shared helper exists when it might not; impl chat would either need to grep for it or fabricate it. Affects PR-A scope.

### R5 — `engine.begin()` pattern is NEW for Phase 2A — spec misstates "matches sister patterns"

**Location**: §3.7 lines 936, 1019-1023, §3.7 line 945

**Problem**: Spec §3.7 says:
> **Choice**: Sync SQLAlchemy + `_to_thread` shim
> **Rationale**: Matches sister `analysis_region.py` / `analysis_sales.py` patterns (Phase 2A consistency).

Verified via grep: `engine.begin()` does NOT appear in any `smartbi_compat/*.py` file. Sister modules use:
- `analysis_sales.py`: `engine.connect()` (read-only context — NO transaction commit)
- `query_templates_write.py`: `get_db_context()` from `smartbi.database.connection` + explicit `db.commit()`
- `dashboard.py`, `analysis.py`: `get_db_context()` pattern

Drill-down is the FIRST module in `smartbi_compat/` to use `engine.begin()`. The spec's claim of "Matches sister patterns" is misleading — it matches the `_to_thread` pattern, but NOT the transaction wrapper pattern (which is novel for read+write).

The `get_db_context()` pattern (used by query-templates which IS the cited sister for write side-effect inheritance per §1.7) would also work. The spec doesn't justify why it chose `engine.begin()` over `get_db_context()`.

Additionally, §3.7 line 945-946 says "SQLAlchemy `engine.begin()` defaults match Java @Transactional defaults (REQUIRED + connection's default isolation, typically READ_COMMITTED on PG)". `engine.begin()` doesn't have "REQUIRED propagation" — it always begins a NEW transaction (no parent join). For a top-level entry like drill-down this doesn't matter, but the wording is technically misleading.

**Fix**:
1. Update §3.7 rationale: "Sync SQLAlchemy + `_to_thread` shim — matches sister `analysis_region.py` / `analysis_sales.py` for the threading shim. The `engine.begin()` (read+write tx) wrapper is **NEW for Phase 2A** — first introduction in drill-down. Alternative `get_db_context()` from `smartbi.database.connection` (used by query-templates-write) considered but rejected because [reason: e.g., explicit tx scope is cleaner for mixed read+write]."
2. Update line 945: Drop "REQUIRED propagation" wording. Replace with "engine.begin() begins a new top-level transaction; commits on context exit; rolls back on exception. Matches Java @Transactional default behavior for top-level entries."

**Severity rationale**: Sets a precedent for future Tier 3 sister specs. If "matches sister patterns" is the justification, future specs will copy it without realizing they're inheriting a NEW pattern. Also the technical inaccuracy about REQUIRED propagation could mislead an impl chat designing a more complex tx topology.

### R6 — Behavior divergence on null/missing `dimension` not addressed (Pydantic 422 vs Java 200+sanitized NPE)

**Location**: §3.10 line 1151, §8.5 (open questions list)

**Problem**: Spec §3.10 declares `dimension: str = Field(..., min_length=1, ...)` — Pydantic v2 returns **HTTP 422** on missing/null/empty dimension.

Java side:
- Controller does NOT use `@Valid` on `DrillDownRequestDTO` (verified — only `SchemaApplyRequest` at line 718 uses `@Valid`)
- Service receives null/missing dimension → calls `request.getDimension().toLowerCase()` → NullPointerException
- Caught at line 582 → `ApiResponse.error("Drill-down failed: " + ErrorSanitizer.sanitize(e))`
- ErrorSanitizer for `NullPointerException` matches `SENSITIVE_EXCEPTION_PATTERN` → returns `DEFAULT_ERROR_MESSAGE = "操作失败，请稍后重试"`
- HTTP 200, body `{ code: 400, message: "Drill-down failed: 操作失败，请稍后重试", success: false, ... }`

Pydantic 422 vs Java 200 + body code=400 is a behavior divergence.

**Fix**: Add to §8.5 open questions OR §3.10 explicit handling:
- Option A: Loosen Pydantic validation to `dimension: Optional[str] = None`, then validate in `_process_drilldown_tx` and raise `DrilldownBusinessException(400, ...)` to match Java NPE→sanitized error path. Inelegant but byte-parity.
- Option B: Accept divergence (Pydantic 422 for malformed input is more correct). Document in §8.3 caveats.

Recommend Option B + spec doc — Pydantic 422 is industry-standard for malformed JSON. Sister Python modules likely accept this divergence already.

**Severity rationale**: Test plan §5.1 doesn't cover this case; impl chat would discover divergence at smoke compare time.

### R6b — Behavior divergence on malformed JSON body / wrong content-type not addressed

**Location**: spec gaps — no §

**Problem**: Spec §5 test plan doesn't cover:
- Empty request body → Pydantic 422 vs Java NPE wrapping
- Wrong Content-Type (e.g., text/plain) → FastAPI 415 vs Spring 415 (both should return 4xx but with different message shapes)
- Malformed JSON → FastAPI 422 vs Spring 400

These are common edge cases for any HTTP endpoint port. Not strictly Tier 3 specific but should be acknowledged.

**Fix**: Add to §8.5 open questions list: "Malformed JSON / wrong content-type: Python FastAPI returns 4xx with FastAPI's default error shape, NOT Java's ApiResponse envelope. Document as accepted divergence in §8.3 OR add custom exception handlers to wrap as ApiResponse.error."

### R7 — Pydantic version stated incorrectly in §8.5 Q4

**Location**: §8.5 Q4 line 1782

**Problem**: §8.5 Q4 says:
> "Pydantic v1 vs v2 behavior differs — confirm project's Pydantic version (likely v1 per Phase 2A baseline)."

Verified `backend/python/requirements.txt:27` — `pydantic>=2.5,<3`. Project uses Pydantic v2.5+, NOT v1.

**Fix**: Update §8.5 Q4 to "Project uses Pydantic v2.5+ per `requirements.txt:27`. Sister specs (region, sales) confirm v2 idioms (`Field(..., min_length=1)`, `model_dump()`, etc.)." Drop the open question — it's resolved.

**Severity rationale**: Affects impl chat's choice of Pydantic API (v1 `parse_obj` vs v2 `model_validate`); wrong information in spec.

### R8 — Mock fixtures in §5.3 don't match the helper docstrings — could mislead impl chat

**Location**: §5.3 lines 1554, 1559

**Problem**: §5.3 mock fixtures define:
```python
def fake_dept_detail(conn, fid, dept, sd, ed): return {"name": dept, "members": []}
def fake_salesperson_metrics(conn, fid, sp, sd, ed): return {"name": sp, "metric": 0}
```

But H3 docstring (§3.4 lines 484-501) says department detail returns aggregate metrics (total_amount, total_target, completion_rate, alert_level) plus salesperson breakdown. H5 docstring (§3.4 lines 538-554) says salesperson metrics returns 10-field MetricResult dict (metricCode, metricName, value, formattedValue, unit, changePercent, changeDirection, alertLevel, dimensionValue, description).

The mocks don't reflect the actual shapes — could mislead impl chat about expected dict keys when writing tests that depend on response shape (e.g., a test checking that "completion_rate" is in dept detail output).

**Fix**: Either fully populate mock returns to match H3/H5 docstrings, OR add comment "fakes are stubs; actual shape per H3/H5 docstring; F999 golden contract test exercises real shape via golden compare."

**Severity rationale**: Test plan ergonomics. Impl chat may waste time figuring out why mock-based tests have different shape than golden-based tests.

---

## Nit (4)

### R9 — Java line ref off by 3 lines for `handleDrillDownIntent`

**Location**: §9.3 row line 1835, §1.5 line 121

**Problem**: Spec cites `SmartBIServiceImpl.java:1731-1741` for `handleDrillDownIntent`. Verified — method signature is at line 1728, body is 1728-1742. Cite should be 1728-1742 (or 1726-1742 to include javadoc).

**Fix**: Update cite to `1728-1742`.

### R10 — Stale "from JWT payload userId" comment in `_drilldown_record_usage` after I3 fix

**Location**: §3.6 line 862

**Problem**: After cycle 1 I3 fix removed `user_id` from `_process_drilldown_tx` wrapper signature, the helper §3.6 still has:
```python
user_id: Optional[int] = None,       # from JWT payload userId; Java passes null at line 1066
```

The "from JWT payload userId" part is misleading because:
- The wrapper never reads from JWT
- The wrapper always passes `user_id=None`
- The helper's default `None` is correct; the comment about JWT is stale

**Fix**: Update comment to: `# Java passes null at line 1066 (not JWT-derived; see D7)`.

### R11 — §6.3 last paragraph claims DateRange "drill-down does not emit" — true but worth being explicit it's NOT in the response envelope either

**Location**: §6.3 line 1663

**Problem**: §6.3 says drill-down doesn't emit DateRange. Verified — `processDrillDown` consumes `startDate`/`endDate` as locals, doesn't put them in result map. Per-dim outputs (RankingItem etc.) also don't include DateRange.

But the spec doesn't explicitly say what the impl chat should do if H4 product distribution chart's nested ChartConfig happens to include date-range info as part of chart axis labels. Worth a one-line clarification.

**Fix**: Add: "Drill-down response has no top-level `dateRange` field. ChartConfig from H4 (product distribution) may have date-range info embedded in axis labels or title — those are strings, not DateRange objects."

### R12 — `parentContext` always None in production traffic — spec acknowledges but doesn't simplify the helper

**Location**: §3.2 line 331-347, §3.10 line 1153

**Problem**: Spec §3.10 line 1167-1171 correctly notes `parentContext` is never set from controller path or AI orchestration path. So `_compute_drill_path` ALWAYS gets `parent_context=None` in production. The spec keeps `parent_context` as a parameter for forward-compat.

The keep-it-as-parameter decision is fine. But §3.2 line 350-355 lists 6 edge cases for `_compute_drill_path` testing — only 1 (`both None → "全部"`) is reachable from production HTTP traffic. The other 5 cases are testing unreachable code paths.

This is OK if intentional — but the spec doesn't note it. Tests will pass but cover dead branches.

**Fix**: Add note to §3.2: "5/6 edge cases below are unreachable from production HTTP (parent_context always None — see §3.10 note). Tests cover for parity with internal callers (e.g., `handleDrillDownIntent` AI orchestration may set parent_context)." Verify whether `handleDrillDownIntent` actually sets parent_context (per my read of line 1728-1742, it doesn't either) — if not, all 5 are unreachable in production.

---

## Cross-cutting observations

1. **Java line ref accuracy: 8/9 verified correct** — only R9 has a 3-line offset. Strong baseline for spec credibility.
2. **Cycle 1 fixes verified in `39dd278f3`**: C1 (salesperson row removed from §1.5), I1/I2 (file paths corrected), I3 (`user_id` removed from wrapper signature), I4 (`parentValue2` removed), I5 (alias comments dropped), I6 (Rule 9 status updated), I7 (TBD resolved), N3 (asyncpg → SQLAlchemy comment updated). N1, N2, N4, N5, N6, N7 deferred per cycle 1 plan.
3. **R1 is the highest-impact finding** — affects every golden, every test, and the entire visible response shape understanding. Cycle 1 self-review missed it because cycle 1 author probably read ApiResponse only as far as the `error()` factory (lines 82-94) without scrolling up to see the field declarations (lines 25-47) — and the `success` factory at lines 50-66 also doesn't set the 3 new fields, masking them from the factory pattern reading.
4. **R2 (cost_amount) and R3 (level not in DTO) have similar root cause** — spec assumes Java code paths produce specific values without verifying the chain (recordUsage → calculateCost; controller DTO → service DTO @Builder.Default).

---

## Recommendation

**fix-then-ship**

R1 + R2 are critical and require concrete spec text edits before merge — both are factual misstatements about Java behavior that an impl chat would hit on first golden recording. R3-R8 are important and should fix together with R1+R2 (similar editing surface in §3.x and §8.x). R9-R12 nits can be batched into the same edit pass without much overhead.

No structural redesign needed — the spec's overall architecture (5 dim dispatch + write side-effect in shared tx + D1 ownership of 5 helpers) remains sound. The fixes are scoped to:
- §1.1 / §3.8 / §6.3 / §4.3 envelope shape (R1)
- §3.6 / §3.7 / §1.6 / §8.3 cost_amount + Java recordUsage chain (R2)
- §3.10 / §1.5 / §8.5 / §4.1 controller DTO field set (R3)
- §3.7 / §3.9 helper imports + tx pattern justification (R4 + R5)
- §8.5 Pydantic version (R7)
- §5.3 mock fixtures (R8)
- §3.6 / §3.2 / §9.3 minor cleanups (R9-R12)

Estimated edit scope: ~80-120 lines edited, 2-3 hours of spec author work. Then dispatch cycle 3 cross-spec reviewer.

Once R1+R2 are addressed, the spec is ship-ready for impl PR-A planning.
