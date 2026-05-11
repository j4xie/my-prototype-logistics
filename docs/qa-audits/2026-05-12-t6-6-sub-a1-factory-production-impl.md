# T6.6 Phase B Sub-A chat-A1 — Wave 1 Production Skeleton (Option B path)

**Status**: ⛔ DRAFT — Reviewer / organizer sign-off pending. No prod deploy.
**Date**: 2026-05-12
**Author**: chat-A1 (T6.6 Phase B Sub-A Wave 1 — factory production Python port skeleton)
**Branch**: `feat/t6-6-sub-a1-factory-production`
**Worktree**: `.worktrees/t6-6-sub-a1-factory-production`
**Base SHA**: `1f07328aec` (origin/main HEAD as of dispatch)
**Dispatch**: organizer MO 2026-05-12 (chat-A1 first Wave 1 chat per PR #345 §7.1)
**Authoritative spec**: `docs/superpowers/specs/2026-05-12-t6-6-sub-a-production-impl-spec.md` (PR #345)

---

## 0. TL;DR

**Phase 1 pre-flight grep gate FAILED**: factory Silver tables required for
the chat-A1 factory branch (`fact_production_batch`,
`fact_equipment_event`, `fact_quality_inspection`) DO NOT exist in
`backend/python/smartbi/database/migrations/`. The only reference is the
explicit deferral comment in `2026_04_29_silver_facts.sql:11-12`.

Per organizer STOP-and-ping answer (2026-05-12):

* **Option B chosen** for the factory-branch blocker: defer factory impl
  to Phase 2D pending factory Silver schema migration. Spec §2.3
  fallback to `_JavaRandom` mock-mirror **rejected** because Q1
  amendment §1 says "drop `_JavaRandom` entirely" and the spec-side
  carve-out would contradict that.
* **Restaurant branch stub raises `NotImplementedError`** rather than
  emitting a placeholder `dataAvailability=NOT_APPLICABLE_FOR_TENANT`
  marker. The MO-suggested marker is NOT in spec §4.1 controlled
  vocabulary `{OK, MISSING_KITCHEN_STATION_DATA,
  MISSING_ORDER_TIMESTAMP_SPLIT, PROXY_AS_BILLS_PER_STORE}` and adding
  it would require an organizer spec amendment — not chat-A1 unilateral
  expansion.

What this PR ships:

| Artifact | Path | LOC | Purpose |
|---|---|---|---|
| `tenant.py` | `backend/python/smartbi_compat/tenant.py` | ~115 | Shared TenantType enum + `get_tenant_type` query (chat-B1 imports verbatim) |
| `analysis_production.py` | `backend/python/smartbi_compat/api/analysis_production.py` | ~165 | Polymorphic Option A router + dispatcher + 2 `NotImplementedError` stubs |
| `test_analysis_production_skeleton.py` | `backend/python/tests/test_analysis_production_skeleton.py` | ~215 | 26 unit tests covering enum / predicate / parsing / async query / dispatcher contracts / router |

What this PR intentionally does NOT ship (deferred):

* Factory branch real-DB or mock implementation (→ Phase 2D after Silver
  migration).
* Restaurant 3-metric envelope (M1 KITCHEN_STATION_UTILIZATION / M2
  AVG_PREP_TIME / M3 TABLE_TURNOVER_RATE proxy) (→ chat-A2 Wave 2).
* Router registration in `backend/python/main.py` (→ chat-A3 Wave 3,
  rationale §2.3 below).
* F999 / F001 Java golden recording (no Python branch produces output;
  spec §6.1 informational dict-eq gate has nothing to compare).
* 17-field `DashboardResponse` envelope builder helper (chat-A2 +
  Phase 2D each build their own; no shared scaffolding worth landing
  ahead of either consumer).

Test results: **26 / 26 PASS** in 0.88s on Python 3.11.7 with pytest-9.0.2.

---

## 1. tenant.py — shared module ready for chat-B1 import

### 1.1 Java predicate mirror (verified)

Java reference (`SmartBIServiceImpl.java:432-441`):

```java
private boolean isRestaurantTenant(String factoryId) {
    if (factoryRepository == null || factoryId == null) {
        return false;
    }
    try {
        return factoryRepository.findById(factoryId)
                .map(f -> f.getType() != null
                        && (f.getType() == FactoryType.RESTAURANT
                            || f.getType() == FactoryType.BRANCH))
                .orElse(false);
    } catch (Exception e) {
        log.warn("Failed to check tenant type for {}: {}", factoryId, e.getMessage());
        return false;
    }
}
```

Three semantically load-bearing properties:

1. **Restaurant tenants** = `RESTAURANT ∪ BRANCH` — only these two of
   the 5 `FactoryType` enum values qualify.
2. **Default-to-factory on failure**: missing repo bean, null
   factory_id, `orElse(false)`, and `catch (Exception)` all return
   `false` (= factory branch). This preserves the legacy manufacturing
   path.
3. **`null` type column** → still `false`: the inner predicate is
   `f.getType() != null && (...)`, so a row with `NULL` `type` collapses
   to factory.

### 1.2 Python implementation choices

`TenantType` enum mirrors all 5 Java `FactoryType` values exactly
(string values = enum names for direct `cretas_db.factories.type`
VARCHAR parse). Three property helpers:

* `is_restaurant_tenant`: True iff `RESTAURANT` or `BRANCH`.
* `is_factory_tenant`: symmetric inverse for callsite clarity.
* `envelope_discriminator`: returns `"RESTAURANT"` / `"FACTORY"` — the
  binary Q-DEC-8 Option A discriminator value (HEADQUARTERS +
  CENTRAL_KITCHEN collapse to `"FACTORY"` per Java precedent).

`from_db_value` class-method handles all 3 failure modes from the Java
predicate (None, empty string, unknown value, case variants) by
returning `FACTORY` — mirrors `orElse(false)` semantics.

`get_tenant_type(factory_id, conn)` accepts an external asyncpg
connection. Caller chooses pool acquisition strategy (router uses
`smartbi.config.get_cretas_pool` lazy-imported, matching house style
from `analysis_department.py:65` and `analysis_finance.py:1401`).

### 1.3 chat-B1 handoff

chat-B1 (Sub-B `/analysis/quality`) can import this module verbatim:

```python
from smartbi_compat.tenant import TenantType, get_tenant_type
```

No file conflicts because chat-B1's `analysis_quality.py` is a separate
file. Both chats will register their routers separately in chat-A3 /
chat-B3 wiring PRs.

---

## 2. analysis_production.py — skeleton with stable handoff hooks

### 2.1 Module structure

```text
analysis_production.py
├── _FACTORY_BRANCH_DEFERRED_MSG       (constant for grep + tests)
├── _RESTAURANT_BRANCH_DEFERRED_MSG    (constant for grep + tests)
├── _factory_production_dispatch       (raises NotImplementedError → Phase 2D)
├── _restaurant_production_dispatch    (raises NotImplementedError → chat-A2)
└── get_production_analysis            (FastAPI router GET endpoint)
```

The router function:

1. Acquires the cretas_db asyncpg pool (lazy import from
   `smartbi.config.get_cretas_pool` — matches house style).
2. Calls `get_tenant_type(factory_id, conn)` to resolve the tenant.
3. Dispatches to the appropriate `*_production_dispatch` shell.
4. On pool acquisition failure: logs WARN and falls through with
   `TenantType.FACTORY` (mirrors Java repository-failure → factory
   branch behavior). The deferred-factory `NotImplementedError` still
   fires for any caller.

### 2.2 Why stubs raise `NotImplementedError` (vs. emit empty envelope)

Option B requires the factory branch to remain truly unimplemented
until Phase 2D. Emitting a 17-field `DashboardResponse`-shaped empty
envelope would:

1. Force chat-A1 to bake in spec §1.3's exact field set / order / null
   semantics WITHOUT golden recording — exactly the brittle "spec
   drift" pattern Rule 9 audit history documents (inventory PR #53 /
   department PR #52 / region PR #56).
2. Mislead frontend consumers into thinking the endpoint is live but
   producing no data, instead of cleanly returning 500 with a known
   gap.
3. Lock in vocabulary that may be wrong (Q-DEC-9 default "omit OK" is
   accepted per PR #344 but the spec hasn't been independently
   golden-verified for factory tenant).

The `NotImplementedError` path returns FastAPI's default 500 with a
stable message string that is both grep-able (for follow-up dispatch)
and unambiguous to frontend consumers. chat-A2 and Phase 2D replace
the bodies; the dispatcher contract and router signature stay stable.

### 2.3 Why router is NOT registered in main.py

Spec §7.3 (chat-A3 Wave 3) explicitly owns router registration. Adding
`app.include_router(analysis_production.router, ...)` in chat-A1 would:

1. Expose `GET /api/mobile/{factory_id}/smart-bi/analysis/production` to
   the live test env as a 500-on-call surface, with no auth-policy
   review and no integration smoke coverage. Per HARD memory
   `feedback_no_defensive_in_verify_scripts.md` plus pause-before-push,
   that surface is premature.
2. Tempt frontend consumers to wire against a half-baked endpoint
   before chat-A2 ships restaurant data and Phase 2D ships factory
   data.

The router is **discoverable** (importable + tested) but
**dormant** (not in app.include_router). chat-A3 wires it after at
least one branch produces real output.

---

## 3. python-java-port.md Rule 1-12 application audit

Most rules don't bite a stub-only PR. Documenting positive coverage and
explicit deferrals so chat-A2 / Phase 2D can pick up the rule baton.

| Rule | Application here | Status |
|---|---|---|
| **R1** (`is not None` not `or`) | tenant.py `from_db_value` uses `if not value:` which is correct for `Optional[str]` (no Decimal-falsy hazard). `get_tenant_type` uses `if row is None:` explicitly. | ✅ Clean |
| **R2** (WEEK calendar year) | No period grouping in skeleton. | ⚪ N/A |
| **R3** (1:1 Java signature) | Dispatcher shells use `(factory_id, start_date, end_date, analysis_type)` — locked-in for chat-A2 / Phase 2D consumption. No DateRange wrapper. | ✅ Clean |
| **R4** (`_decimal_to_number`) | No Decimal output in skeleton. chat-A2 + Phase 2D will use Rule 4 in metric builders. | ⚪ Deferred |
| **R5** (`SELECT *` for shared) | Only SQL is `SELECT type FROM factories WHERE factory_id = $1` — single column lookup, not a sharable helper, so narrow column is correct (R5 legacy exception). | ✅ Clean |
| **R6** (input None-check) | `get_tenant_type` takes `factory_id: str` (non-optional). The asyncpg call passes through; no date range to guard. chat-A2 + Phase 2D restaurant SQL helpers MUST add R6 preconditions per spec §5.1. | ✅ Clean (this PR) / ⚠️ chat-A2 reminder |
| **R7** (Decimal threshold) | No alert thresholds. | ⚪ N/A |
| **R8** (Map.of key order) | No envelope output yet. chat-A2 + Phase 2D will record goldens before any literal dict shape lands. | ⚪ Deferred |
| **R9** (Lombok/Jackson quirks) | Same as R8 — no DTO mirror in skeleton. Phase 2D `DashboardResponse` envelope MUST golden-verify before committing field names (especially `xaxisField` lowercase per R9.1). | ⚪ Deferred |
| **R10** (BigDecimal divide-then-multiply) | No arithmetic. | ⚪ N/A |
| **R11** (LocalDateTime trailing microsecond) | No datetime output. | ⚪ N/A |
| **R12** (HALF_UP vs banker's) | No formatted-display strings. | ⚪ N/A |

**Conclusion**: zero rule violations in shipped code. Active reminders
documented in module docstring + `_restaurant_production_dispatch`
docstring so chat-A2 doesn't reinvent vocabulary or skip R6 / R8 / R9.

---

## 4. F999 + F001 parity gate — N/A this PR

Spec §6.1 factory-branch dict-eq gate is informational only ("not a
Phase B GO criterion"). Spec §6.2 restaurant Python-vs-Python regression
IS a GO criterion — but applies to chat-A2 output, not chat-A1.

Recording goldens against the Java endpoint while the Python side
raises `NotImplementedError` would produce a guaranteed-divergence
artifact with zero diagnostic value. Skipped per Phase 5 task closure.

When chat-A2 lands restaurant impl, that chat (or chat-AB-1 combined
parity gate) records the restaurant goldens. When Phase 2D lands
factory impl, that chat records the factory goldens. Both can follow
spec §2.4 / §3.5 commands verbatim — this PR doesn't preempt either.

---

## 5. Handoff matrix

### 5.1 chat-B1 (Sub-B Quality factory tenant) — UNBLOCKED

`tenant.py` is import-ready. chat-B1 can `from smartbi_compat.tenant
import TenantType, get_tenant_type` and use them with no further
chat-A1 coordination. Per spec §7.1 / §7.2, B1 also lands their own
`analysis_quality.py` skeleton — file does not conflict with this PR.

⚠️ Concurrent-edit guard: chat-B1 should NOT modify `tenant.py` in their
PR. If B1 discovers a tenant.py defect during impl, they STOP-and-ping
organizer rather than editing it under a B-scoped commit.

### 5.2 chat-A2 (Sub-A restaurant branch) — UNBLOCKED

When dispatched, chat-A2 should:

1. Branch off `origin/main` AFTER this PR merges.
2. Replace `_restaurant_production_dispatch` body with the 3-metric
   envelope per spec §3 + PR #337 §3.3-§3.5.
3. Add `_compute_table_turnover_proxy` SQL helper per spec §5.1 with
   Rule 6 precondition.
4. Use ONLY the spec §4.1 controlled vocabulary (`OK` /
   `MISSING_KITCHEN_STATION_DATA` / `MISSING_ORDER_TIMESTAMP_SPLIT` /
   `PROXY_AS_BILLS_PER_STORE`).
5. Record 4 restaurant goldens per spec §3.5 (`R_ILTEATRO_REAL`).
6. Update `test_analysis_production_skeleton.py` (or add
   `test_analysis_production_restaurant.py`) — the
   `test_restaurant_dispatch_raises_with_chat_a2_message` test will
   fail by design when chat-A2 lands real impl; that's the signal to
   replace it with happy-path coverage.

### 5.3 Phase 2D (factory branch + Silver migration) — BLOCKED

Phase 2D depends on a new migration (provisionally
`V20260XYZ_NN__t6_6_factory_production_silver.sql`) shipping
`fact_production_batch`, `fact_equipment_event`,
`fact_quality_inspection` tables in `smartbi_db` / `smartbi_prod_db`.
That migration is out of T6.6 Phase B scope per spec §10 — separate
dispatch.

When the migration ships, Phase 2D chat:

1. Implements `_factory_production_dispatch` per spec §2 + PR #199
   detail spec, 8 method ports.
2. Records 8 factory goldens (F999 + F001) per spec §2.4.
3. Replaces `test_factory_dispatch_raises_with_phase_2d_message`.

### 5.4 chat-A3 (envelope wiring + router registration) — partial unblock

chat-A3 can proceed with router registration in
`backend/python/main.py` as soon as EITHER chat-A2 OR Phase 2D lands a
real branch. Until then, registering exposes a 500-only endpoint with no
business value (see §2.3 rationale).

---

## 6. Verification

### 6.1 Test execution

```text
$ python -m pytest tests/test_analysis_production_skeleton.py -v
============================== 26 passed, 1 warning in 0.88s
```

Coverage:

* 6 tests on `TenantType` enum + predicates (RESTAURANT/BRANCH true;
  FACTORY/HEADQUARTERS/CENTRAL_KITCHEN false; envelope discriminator
  binary collapse).
* 10 tests on `from_db_value` parsing (6 canonical strings + 4
  None/empty/unknown variants).
* 5 async tests on `get_tenant_type` (3 happy paths + 2 missing-row /
  null-type defensive paths).
* 2 dispatcher `NotImplementedError` contract tests (factory + restaurant
  messages grep-able with key phrases).
* 3 router contract tests (path declared; GET-only; helper functions
  exported).

### 6.2 Pre-flight grep evidence

```text
$ grep -rn 'CREATE TABLE.*fact_production_batch|CREATE TABLE.*fact_equipment_event|CREATE TABLE.*fact_quality_inspection' backend/python/smartbi/database/migrations/
(no matches)

$ grep -n 'fact_production_batch' backend/python/smartbi/database/migrations/2026_04_29_silver_facts.sql
12: --   fact_production_batch (migrate from existing Java production_batches),
```

The single hit is a comment marking the table as "Deferred to v1.3".
Confirms spec §2.3 BLOCKER scenario.

### 6.3 Concurrent-edit safety (rule 5b)

Three new files only. `git status --short` ahead of any commit:

```text
?? backend/python/smartbi_compat/api/analysis_production.py
?? backend/python/smartbi_compat/tenant.py
?? backend/python/tests/test_analysis_production_skeleton.py
```

When committing: use `git commit -- <three paths>` per
`concurrent-edit-safety.md` Rule 5b to defend against parallel-chat
husky auto-stage scope creep.

---

## 7. Open questions / organizer decisions baked-in

| Question | chat-A1 decision | Source |
|---|---|---|
| Silver tables missing — `_JavaRandom` fallback or defer? | **Defer** (Option B) | Organizer answer 2026-05-12 |
| Restaurant stub marker `NOT_APPLICABLE_FOR_TENANT` or `NotImplementedError`? | **`NotImplementedError`** (preserves spec §4.1 vocab) | Organizer answer 2026-05-12 |
| Register router in main.py now? | **No** (chat-A3 scope; avoid premature 500 surface) | Spec §7.3 + §2.3 rationale |
| Record F999 / F001 goldens? | **Skip** (no Python output to compare) | Spec §6.1 + Phase 5 task closure |

No new open questions surfaced by impl. Two reminders for chat-A2 /
Phase 2D embedded in module docstrings.

---

## 8. ⛔ HOLD blocks

* ⛔ **STOP-and-ping organizer BEFORE push** per HARD
  `feedback_pause_before_deploy_or_push.md` and MO §⛔ HOLD signals.
* ⛔ **No prod deploy.** Code + tests + this audit doc only.
* ⛔ **No router registration in main.py.** Defer to chat-A3 per §2.3.
* ⛔ **No `tenant.py` schema mutation.** Future expansion (caching,
  metrics) belongs to a dedicated PR.
* ⛔ **No migration files added.** Factory Silver schema is out of
  chat-A1 scope per spec §10.

---

## 9. Cross-references

| Doc | Path | Relation |
|---|---|---|
| Sub-A impl spec | `docs/superpowers/specs/2026-05-12-t6-6-sub-a-production-impl-spec.md` (PR #345) | Authoritative input |
| Q4/Q5 module shape | `docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` (PR #337) | tenant.py + restaurant envelope spec |
| Q4/Q5 decisions | `docs/superpowers/specs/2026-05-12-t6-6-restaurant-semantics-decision.md` (PR #330) | Q-DEC-1..10 ratification |
| Q1 amendment | `docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md` | "Drop `_JavaRandom`" basis for Option B |
| Factory port detail | `docs/superpowers/specs/2026-05-09-t6-6-production-port-detail.md` (PR #199) | Phase 2D input (when migration ships) |
| Java FactoryType | `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/enums/FactoryType.java` | Enum mirror source |
| Java predicate | `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/SmartBIServiceImpl.java:427-441` | `isRestaurantTenant` mirror |
| Silver schema gap | `backend/python/smartbi/database/migrations/2026_04_29_silver_facts.sql:11-12` | Deferral evidence |
| Port rules | `.claude/rules/python-java-port.md` | Rules 1-12 applied per §3 |
| Concurrent-edit | `.claude/rules/concurrent-edit-safety.md` Rule 5b | Commit-time scope guard |

---

**End of chat-A1 Wave 1 Production Skeleton audit doc.**

*Reviewer: organizer admin-merge after sign-off. No push until verbal GO.*
