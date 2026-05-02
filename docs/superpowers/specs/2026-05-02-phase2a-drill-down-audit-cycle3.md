# Drill-Down Spec — Cycle 3 Cross-Spec Audit Findings

**Auditor**: cycle 3 cross-spec reviewer subagent
**Date**: 2026-05-02
**Spec under review**: `docs/superpowers/specs/2026-05-02-phase2a-drill-down-design.md` (2016 LOC, commit `028fcc657`)
**Cycle 1 findings**: `docs/superpowers/specs/2026-05-02-phase2a-drill-down-audit-cycle1.md` (1 critical + 6 important + 7 nits, all addressed in `39dd278f3`)
**Cycle 2 findings**: `docs/superpowers/specs/2026-05-02-phase2a-drill-down-audit-cycle2.md` (R1 demoted, R2 documented, R3-R12 addressed in `028fcc657`)
**Method**: Read spec end-to-end (~2016 LOC); verify every cite list reference (§9.1 + §10) against actual sister spec content; spot-check 6 Java line citations; cross-spec inheritance/precedent verification; spec internal consistency post cycles 1+2.

---

## Summary

| Severity | Count | Action |
|---|---|---|
| Critical | 2 | Must fix before spec PR merge |
| Important | 4 | Should fix before merge |
| Nit | 3 | Optional |

Total: **9 findings**.

Java line ref accuracy: **8/8 spot-checks verified** (no offset issues found in cycle 3 sample).

---

## Critical (2)

### X1 — Cycle 2 R1 fix #1 NOT applied to §1.1 line 77 (regression to 5-field claim)

**Location**: §1.1 line 77

**Current text**:
> - **ApiResponse envelope**: `ApiResponse.java:25-37` (5 fields: code, message, data, timestamp, success) + `error()` factory line 82-94

**Problem**: Cycle 2 R1 explicitly listed 7 spec-text edits as "Fix" subtasks. Fix #1 was: *"Update §1.1 line 77: `ApiResponse.java:25-47` (8 fields: code, message, data, timestamp, success, actionHint, severity, hintTarget)"*. Verified in commit `028fcc657` — this single line was MISSED. Other §1.7 / §3.8 / §4.3 / §6.3 R1-related edits applied. §1.1 line 77 still cites `ApiResponse.java:25-37` and "5 fields".

Verified Java truth: `ApiResponse.java:25-47` declares 8 fields total (verified in `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/common/ApiResponse.java:25-47`). Fields: code(25), message(28), data(31), timestamp(34), success(37), actionHint(41), severity(44), hintTarget(47).

**Fix**: Replace §1.1 line 77 with:
```
- **ApiResponse envelope**: `ApiResponse.java:25-47` (8 fields total — 5 always-set by error()/success() factories: code, message, data, timestamp, success; 3 optional UX fields added 2026-04-18: actionHint, severity, hintTarget) + `error()` factory line 82-94
```

**Severity rationale**: §1.1 is the contract section and the most-referenced part of the spec. An impl chat will read §1.1 first to understand the envelope shape, encounter the wrong line range + wrong field count, and likely propagate the error. The fact that §1.7 / §3.8 / §6.3 / §4.3 are correct but §1.1 isn't makes this even more confusing — internal inconsistency about the same fact. Cycle 2 R1 was explicitly classified as critical; this is a partial regression of that fix.

### X2 — "procurement spec PR #40 I6 fix" cited 3 times but no such "I6 fix" exists in procurement spec

**Location**: §3.4 line 418, §9.1 line 1894, §10 line 1975

**Current text** (line 418):
> 3. `_drilldown_*` prefix prevents future cross-import collision (lessons from procurement spec PR #40 I6 fix).

**Current text** (line 1894):
> `docs/superpowers/specs/2026-05-01-phase2a-analysis-procurement-design.md` (PR #40) — namespace-isolation naming convention (I6 fix), procurement spec uses `_procurement_*` prefix to avoid collisions — drill-down's `_drilldown_*` prefix (D2) directly inherits this pattern

**Current text** (line 1975):
> 3. **Tier 2 procurement spec** (PR #40) — namespace-isolation naming convention (I6 fix → drill-down D2 inheritance)

**Problem**: Verified procurement spec `docs/superpowers/specs/2026-05-01-phase2a-analysis-procurement-design.md` end-to-end. Grep confirms:
- ZERO occurrences of "I6", "I-6", "namespace-isolation", "naming convention", "collision", "prefix discipline"
- Procurement spec DOES use `_get_procurement_*` prefix (line 87 `_get_procurement_analysis`, line 99 `_get_procurement_trend_chart`, etc.) but with NO documented rationale or "I6 fix" — it's just sister-domain naming default
- No section headed "I6", no audit cycle file referenced for procurement, commit `4f7c5f6bb` (PR #40) shows the spec was a one-shot ship without I-numbered fix tracking

This is a **fabricated cross-spec citation** — the I6 fix doesn't exist in any sister spec. The drill-down spec invents a precedent that doesn't exist, then cites it 3 times to justify D2.

The underlying decision (D2 `_drilldown_*` prefix to prevent collision) is sound — but the JUSTIFICATION via "lessons from procurement spec PR #40 I6 fix" is fabrication. There IS a real precedent: procurement / sales / finance / region all use `_get_<domain>_*` prefix style; that's the convention. But there's no "I6 fix" that established this — it emerged organically.

**Fix**: Replace the 3 fabricated citations with accurate honest text:
- Line 418: Drop "(lessons from procurement spec PR #40 I6 fix)". Replace with "(consistent with sister-spec convention: each analysis domain uses its own `_<domain>_*` prefix)".
- Line 1894: Drop "namespace-isolation naming convention (I6 fix)" — replace with "uses `_get_procurement_*` domain-prefixed helpers throughout (sister-domain naming convention, not a documented I6 fix). Drill-down's `_drilldown_*` prefix (D2) follows the same convention."
- Line 1975: Drop "namespace-isolation naming convention (I6 fix → drill-down D2 inheritance)". Replace with "domain-prefixed helper convention (sister-spec pattern, drill-down D2 follows)."

**Severity rationale**: Sister-spec import audit pattern (per memory `feedback_phase2a_sister_spec_import_audit.md`) caught this exact failure mode — fabricated citations propagating across sister specs. The May 1 2026 incident (PR #47 cycle 4 review caught `_fetch_all` and `verify_factory_access` as fabricated imports across procurement #40 / department #36 / region #41) shows this kind of fabrication is a real risk pattern. A subsequent cycle 4 / final-impl reviewer following the cite trail back to procurement spec will discover the dead end and lose confidence in the spec's other citations. Worse, future Tier 3 sister specs may cite "drill-down D2 inheritance from procurement I6" and propagate the fabrication.

---

## Important (4)

### X3 — Golden count inconsistency: spec switched from 9 to 8 in §4.1 but other 7+ places still claim "9 goldens"

**Location**: line 110 (§1.4), line 1408 (§4.3), line 1509 (§5.1), line 1782 (§7.2), line 1787 (§7.2), line 1845 (§8.2), line 1872 (§8.4), line 1873 (§8.4)

**Problem**: Cycle 2 R3 fix dropped the L3-dead golden as unrecordable (controller DTO has no `level` field, Spring silently ignores `"level":2`, Java sees default level=1, takes L2 path). §4.1 line 1264 explicitly notes: "8 goldens recorded total (not 9 as originally enumerated)". §2.1 lines 164-172 enumerate 8 actual goldens (region L1, L2, dept L1, L2, product, time L1, salesperson L1, error). §4.3 parametrize block at lines 1409-1426 also shows 7 success entries + 1 error case = 8 tests.

But these places still say "9":
- Line 110: "| 9 goldens (5 dim × layer + 1 error) — see §6.1 | byte-shape gate |"
- Line 1408: "# 9 golden compare tests — example for region L1"
- Line 1509: '"""9 golden tests parameterized — each dim × layer state."""'
- Line 1782: "5. **9 F999 goldens recorded** before PR-A plan finalizes (per §4.1 commands)"
- Line 1787: "- All 9 dim-state golden tests pass via dict-eq (with `_strip_volatile`)"
- Line 1845: "| T6 | Per-dim shape variance — 9 dimension states × layers, each emits different keys | Record 9 F999 goldens (§4.1); verify each via dict-eq test (§4.3) |"
- Line 1872: "2. **Extend `record-java-golden.sh` for POST** (Option A) BEFORE 9 goldens record."
- Line 1873: "3. **Record 9 F999 goldens** BEFORE PR-A plan finalizes (per §4.1 commands)."

**Fix**: Replace all "9" → "8" at the 8 locations above. Keep §4.1 line 1264 note ("not 9 as originally enumerated") as the audit-trail.

**Severity rationale**: An impl chat following acceptance criteria (§7.2 line 1787) will be confused — what's the right number? Manual smoke test setup (§8.4 line 1872-1873) gives wrong count. The ambiguity may cause impl chat to either record an unrecordable L3 golden (wasting time) or to question whether the spec is internally consistent. Quick mass-replace fix.

### X4 — Spec uses "D5" reference in cycle 2 R1 fix but the spec body has no "D5" decision label

**Location**: cycle 2 audit-cycle2.md line 71 references "Update §1.7 D5 (line 150)" but spec §1.7 line 148-153 enumerates items 1-5 without D-letter labels for items 4 and 5.

**Current spec §1.7** (lines 148-153):
```
This spec ADDS the following Tier 3 patterns:
1. **D1 — 5 missing helpers owned by spec...
2. **D2 — `_drilldown_*` namespace prefix...
3. **D3+D4 — mixed read-write transaction wrapper**...
4. **T10 hint/hintTarget loss at controller catch boundary** ... (no D-letter)
5. **T2 dead level>1 verbatim port** ... (no D-letter)
```

**Problem**: Items 4 and 5 are unlabeled but referenced by D-letter elsewhere:
- D7 referenced 3 times (line 129, 882, 1031) — but never defined as "D7" in §1.7. Cycle 1 I7 fix mentions "see D7" — but D7 is implicit (the userId=null parity decision).
- D8 referenced once (line 748, 1833) — same issue, never defined as "D8" in §1.7.
- Cycle 2 R1 fix doc references "D5" which would be item 4 in §1.7 — but item 4 has no "D5" label.

**Fix**: Either:
- Option A: Add D-letter labels to all §1.7 items: "1. **D1 — ...** / 2. **D2 — ...** / 3. **D3+D4 — ...** / 4. **D5 — T10 hint/hintTarget loss...** / 5. **D6 — T2 dead level>1 verbatim port...** / 6. **D7 — userId=null parity (see §3.6)** / 7. **D8 — ...**" and ensure D6/D7/D8 are also defined or referenced consistently.
- Option B: Drop the "D5/D6/D7/D8" references throughout and use natural-language descriptions (e.g., "per the userId=null parity decision in §3.6" instead of "per D7"). Less invasive.

Recommend Option A — D-letter labels are cleaner audit trail for cross-cycle references, and the spec is already ~80% there.

**Severity rationale**: Internal label inconsistency makes cycles 4+ harder. A future audit cycle reading "per D7" will grep for D7 definition and find none — exactly the kind of friction cycle 3 is meant to eliminate. Lower than X1/X2 because it's stylistic.

### X5 — T11/T12 referenced 12 times across the spec but never appear in §8.1 or §8.2 trap tables

**Location**: T11/T12 referenced at lines 120, 316, 863, 906, 1620, 1678, 1680, 1791, 1839 (table inline), 1905, 1911, 1977, 1980. §8.1 trap table (lines 1830-1839) lists T1, T2, T3, T4, T5, T7, T8, T10. §8.2 (lines 1843-1849) lists T6, T9, T10-detail, Rule 9 ChartConfig, Rule 9 DateRange.

**Problem**: T11 and T12 are clearly trap IDs (referenced like T7/T8 throughout, e.g., "T11/T12 RLS app-layer" at line 316, "T11/T12 RLS finding" at line 863, "T11/T12: factory_id MUST be in INSERT" at line 1620). Per the spec's own trap-cataloging convention (region spec uses R-T1 ~ R-T13, alert spec also uses cataloged trap IDs), T11/T12 should be in §8.1 (lock-in risks) since they're about RLS application-layer enforcement which IS a lock-in commitment (NOT verify-via-golden).

The drill-down spec uses T11+T12 as if they're defined trap IDs but never formally defines them in any trap catalog table. Any auditor checking "what is T11?" finds 12 inline references but no definition.

**Fix**: Add to §8.1 trap table (after T10):
```
| T11 | RLS application-layer enforcement on `smart_bi_usage_records` (no PG RLS policy; explicit factory_id in INSERT IS the tenant isolation) | §1.5, §3.6, §5.5 |
| T12 | Cross-tenant write integrity: 4-corner test gate ensures factory_id is JWT-derived not request-body-derived (Apr 28 P0 RLS gap finding precedent) | §5.5 |
```

Or alternatively, document T11/T12 explicitly in §1.4 in scope with their own row, with §8.1 cross-referencing the §1.4 row.

**Severity rationale**: Implicit trap IDs make audit fragile. The cycle 3 audit cite list at §10 doesn't include T11/T12 — meaning the spec author themselves don't have a clear T11/T12 definition. Quick add fixes the issue.

### X6 — `engine.begin()` Tier 3 NEW pattern adoption not flagged as a Tier 3 precedent in §9.4 lineage statement

**Location**: §9.4 line 1953-1965 ("Tier 3 lineage statement")

**Current text** at line 1962-1964 lists what future Tier 3 sister specs would inherit:
```
- D1 ownership pattern for spec-owned helpers
- D2 namespace prefix discipline
- D3+D4 transaction wrapper Python idiom (`engine.begin()` + `_to_thread`)
- D7 conservative tx defaults (asyncpg matches Java REQUIRED + READ_COMMITTED)
- T10 visible-vs-internal error info distinction
```

**Problem**: §3.7 lines 1046-1051 explicitly establishes `engine.begin()` as a NEW pattern for Phase 2A (cycle 2 R5 fix correctly acknowledged this). But §9.4 lineage statement doesn't flag this newness — it just says "D3+D4 transaction wrapper Python idiom" as if it's an established convention, when in fact it's the FIRST Phase 2A use of `engine.begin()` (sister modules use `engine.connect()` for read-only and `get_db_context()` for writes).

A future Tier 3 sister spec reading §9.4 will see "transaction wrapper Python idiom" as a settled inheritance, not a pioneering decision that may need re-evaluation.

Also: §9.4 mentions "D7 conservative tx defaults (asyncpg matches Java REQUIRED + READ_COMMITTED)" — but §3.7 line 1053 + cycle 2 R5 fix correctly note this is SQLAlchemy `engine.begin()`, NOT asyncpg. The "asyncpg" wording is leftover from earlier draft (should be "SQLAlchemy `engine.begin()` defaults..."). Cycle 2 N3 noted this in §3.7 but didn't sweep §9.4.

**Fix**: Update §9.4 lines 1962-1964:
```
- D3+D4 transaction wrapper Python idiom — first Phase 2A use of SQLAlchemy `engine.begin()` for mixed read+write atomicity (sister modules use `engine.connect()` read-only or `get_db_context()` write-explicit-commit; future Tier 3 sisters should evaluate consistency vs reuse vs migration to a unified pattern)
- D7 conservative tx defaults — SQLAlchemy `engine.begin()` defaults (REQUIRED-equivalent at top-level, READ_COMMITTED isolation on PG); matches Java `@Transactional` defaults
```

**Severity rationale**: §9.4 is the future-facing inheritance contract. Misrepresenting NEW patterns as settled inheritance could mislead future Tier 3 sister specs into copy-paste without re-evaluation. Same root cause as cycle 2 R5 — sweep wasn't complete.

---

## Nit (3)

### X7 — `parentValue` Pydantic field accepted but never read by any helper (silent dead-pass-through)

**Location**: §3.10 line 1207, §1.1 line 37

**Problem**: Pydantic model accepts `parentValue: Optional[str] = None` (line 1207) per controller DTO field set, but no Python helper reads `request.parentValue`. Java service-level `DrillDownRequest` HAS `parentValue` field (line 80-83 per spec §1.1 line 75 cite of "13 fields") and the controller DOES set it via `.parentValue(request.getParentValue())` at line 546, but `processDrillDown` and the dim processors never invoke `getParentValue()`. So the field is silent dead-pass-through similar to `level`/`sortBy`/etc.

Spec §3.10 line 1213-1218 documents some fields as "dead-pass-through" but `parentValue` is in the "Fields ACTUALLY in controller DTO (7 fields)" group at lines 1203-1210, not flagged as dead-pass-through. The spec's docstring wording ("ACTUALLY in controller DTO" — implying these fields are used) is misleading for `parentValue` which is in the DTO but not consumed.

**Fix**: Add a one-line note after `parentValue: Optional[str] = None` at line 1207:
```python
parentValue: Optional[str] = None        # accepted but not read by drill-down dispatch
                                          # (Java service holds it but processDrillDown doesn't invoke getParentValue)
```

**Severity rationale**: Cosmetic. Doesn't block impl. Could cause minor confusion if impl chat tries to thread parentValue through dispatchers thinking it's load-bearing.

### X8 — `from smartbi_compat.date_range import DateRange` import in §2.3 unused (helper implemented inline)

**Location**: §2.3 line 207

**Problem**: §2.3 imports list says:
```
├── from smartbi_compat.date_range import DateRange (Python equivalent class, sister-shared)
```

But `DateRange` class in `backend/python/smartbi_compat/date_range.py:15` only has methods `custom`, `by_period`, `days`, `valid` — no `this_month()` / `thisMonth()`. The drill-down spec implements `_default_date_range_this_month()` inline (§3.3) returning a `tuple[date, date]` — does NOT instantiate `DateRange`. So the import is unused.

**Fix**: Drop the import line. Replace with comment "(NOTE: smartbi_compat.date_range.DateRange has no thisMonth() — drill-down implements `_default_date_range_this_month` inline in §3.3, returning tuple[date, date] not DateRange instance.)"

**Severity rationale**: Cosmetic. Impl chat will probably notice it's unused and remove on lint.

### X9 — `handleDrillDownIntent` cite at §9.1 line 1908 says "Tracking PR # not verified — defer to cycle 3 reviewer" — addressing this defer

**Location**: §9.1 line 1908

**Current text**:
> ... (Tracking PR # not verified — defer to cycle 3 reviewer.)

**Verification result**: Searched both `2026-04-30-phase2b-beta-design.md` (the post-audit β spec) and `2026-04-29-phase2b-ai-intent-layer-design.md` (the α intent layer spec). Neither mentions `handleDrillDownIntent` directly. The α spec PR # is uncertain; β spec is post-audit (not yet PR'd at spec time). Java method exists at `SmartBIServiceImpl.java:1728-1742` (verified). The "Phase 2B-β #24" cite at spec line 15 may be wrong — PR #24 needs verification; recent commit log shows `c440c7a7e` is PR #48 (query-templates), `91c43ec76` is PR #36 (department), no commit clearly maps to "Phase 2B-β #24".

**Fix**: Drop the "Phase 2B-β #24" suffix at §9.1 line 15. Replace with "(future Phase 2B-β AI port concern; not yet specced)". Also drop the deferred TBD at line 1908 — replace with: "Per cycle 3 verification: `handleDrillDownIntent` (`SmartBIServiceImpl.java:1728-1742`, verified) is referenced by neither `2026-04-30-phase2b-beta-design.md` nor `2026-04-29-phase2b-ai-intent-layer-design.md` directly. Future Phase 2B-β Python port (when scoped) would wrap `_process_drilldown_tx` from this PR-A; out-of-scope for Phase 2A."

**Severity rationale**: Cycle 3 was asked to resolve this. Doing so closes the loop. Doesn't block impl.

---

## Cross-cutting observations

1. **Cycle 2 R1 sweep was incomplete in 1 location** (X1) — §1.1 line 77 missed. All other R1 touchpoints (§1.7 / §3.8 / §6.3 / §4.3) are correct. Single-line miss but high-visibility (§1.1 is contract section).

2. **Cycle 2 R3 sweep was incomplete in 8 locations** (X3) — golden count "9 → 8" not propagated outside §4.1. The L3 dead golden was correctly dropped but the count constants weren't search-and-replaced.

3. **Cycle 1 I3 fix was complete** (verified — wrapper signature drops `user_id`, route handler doesn't pass `user_id`).

4. **Cycle 2 R5 sweep was incomplete in 1 location** (X6) — §3.7 properly notes engine.begin() NEW pattern, but §9.4 lineage statement doesn't carry the warning forward.

5. **Cycle 2 R10 fix complete** (verified — `_drilldown_record_usage` user_id comment updated).

6. **Cycle 2 R7 fix complete** (verified — Pydantic v2.5+ noted in §8.5 Q4).

7. **Sister spec verification** (X2): Procurement spec PR #40 verified end-to-end has NO "I6 fix" or "namespace-isolation" rationale. The drill-down spec's 3-cite citation chain is fabricated.

8. **Java line ref accuracy spot-check**:
   - `SmartBIServiceImpl.java:1018-1069` ✓ (processDrillDown verified)
   - `SmartBIServiceImpl.java:1066` ✓ (recordUsage call verified)
   - `SmartBIServiceImpl.java:1161-1176` ✓ (recordUsage definition verified)
   - `SmartBIServiceImpl.java:1172-1173` ✓ (calculateCost call inside recordUsage)
   - `SmartBIServiceImpl.java:1954-1970` ✓ (calculateCost definition)
   - `SmartBIServiceImpl.java:1728-1742` ✓ (handleDrillDownIntent — cycle 2 R9 fix verified at line 121, but stale `1731-1741` still at line 1935 §9.3 — minor regression)
   - `SmartBIServiceImpl.java:1975-1996` ✓ (processRegionDrillDown verified)
   - `SmartBIAnalysisController.java:787-798` ✓ (DrillDownRequestDTO verified — 7 fields)
   - `ApiResponse.java:25-47` ✓ (8 fields verified) — but cited as `25-37` at §1.1 line 77 (X1)

   The §9.3 line 1935 stale cite (`1731-1741` instead of `1728-1742`) is a third instance of incomplete cycle 2 sweep — same root cause as X1 + X3 + X6. **Bake this into X-series sweep**: cycle 2 fixes need a final post-edit search-and-replace verification pass.

9. **Sister spec citation verification — passed except X2**:
   - Region spec PR #41 — confirms Lombok @Data declaration order pattern (lines 651, 902, 959, 1055, 1236) ✓
   - Department spec PR #36 — confirms composite-only §1.3 lineage (lines 38, 41-43) ✓
   - Procurement spec PR #40 — `_get_procurement_*` prefix exists, but NO "I6 fix" exists — cited 3 times in drill-down spec (X2) ✗
   - Inventory spec PR #47 — uses "4-mode dispatcher" pattern (close enough to drill-down's claim of "multi-mode dispatch") ✓
   - Query-templates PR #48 — uses `get_db_context()` + commit pattern (drill-down §3.7 correctly notes the divergence) ✓
   - Budget PR #34+#38 — Map.of(2) `[color, name]` hash discovery via golden inspection at lines 325-335, 442-443 ✓

10. **`_drilldown_*` prefix collision check**: `grep -r "def _drilldown_" backend/python/smartbi_compat/` returns ZERO matches (verified). Helpers introduced by drill-down PR-A will not collide with sister modules. ✓

---

## Recommendation

**fix-then-ship**

Critical findings X1+X2 require concrete spec text edits before merge. Both are factual/cite errors that an impl chat (or future audit reviewer following cite trails) would discover and lose confidence over. Important findings X3+X4+X5+X6 are sweep-incomplete patterns from earlier cycles + a labeling consistency issue. Nits X7-X9 are stylistic and can batch with the same edit pass.

Estimated edit scope: ~30-40 lines edited across §1.1 (X1), §3.4/§9.1/§10 (X2), 8 locations for golden count (X3), §1.7 D-labels (X4), §8.1 trap table (X5), §9.4 (X6), 3 nits.

**Most-important finding summary**: X1 (§1.1 line 77 still says "5 fields") + X2 (fabricated procurement I6 fix cited 3 times) are the two blockers. X1 is a single-line regression of cycle 2's most critical fix; X2 is a sister-spec import audit class of fabrication caught early enough to repair without propagating to impl PRs.

No structural redesign needed. Spec architecture (5-dim dispatch + write side-effect in shared tx + D1 ownership + Tier 3 lineage statement) remains sound. Cycle 4 final-impl reviewer should sweep for any further incomplete-sweep patterns from cycles 1-3.
