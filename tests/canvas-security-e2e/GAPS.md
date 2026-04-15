# Canvas E2E Test Gaps — Infrastructure-Blocked

**Status**: 99/99 PASS baseline (2026-04-16). Below are the gray areas that
remain after R7 E/F/G1/G3 closure work. 2 of the original 3 gaps closed;
scheduler fire observability (G2) remains deferred.

Recording what's left here so future devs don't waste time re-discovering
the blocker and so smoke-padding tests aren't added to fake closure (which
would violate `depth-first-e2e` skill Rule 1).

---

## Closed this session (2026-04-16)

**G1 — per-role matrix differential** — was based on a wrong premise. Probe
discovered GET /config/modules/{X}/effective returns identical data for
admin vs production_manager (role-agnostic at read layer). Real role
differential lives in WRITE operations, now covered by **J5-L6 deep test**
(admin PUT formula HTTP 200 vs production_manager HTTP 403).

**G3 — trigger chain actual firing** — closed by adding execution
observability: last_executed_at / last_execution_status / execution_count
columns on factory_trigger_chains, written by TriggerChainExecutor.executeChain
via @Transactional(REQUIRES_NEW) for event-dispatch tx isolation. E2E
**J2-9 deep test** fires SalesOrderCreatedEvent → asserts execution_count
bumped.

**F — sales_order_prepayment_records_items parent_id UUID→VARCHAR** —
applied directly to prod (2 rows preserved), idempotent Flyway migration
V20260416_02 for replay safety.

**E — nightly cron on 47 server** — installed with CANVAS_E2E_SKIP_UI=1
flag so API-only subset (~87/99 assertions) runs at 02:00 CST daily.

---

## Gap — Scheduler actual execution (cron fires → tool runs)

**What's untested**: Whether a configured scheduler actually FIRES the tool
at the cron boundary, not just that the config persists.

**What IS tested**:
- J2-7a (medium): PUT scheduler with valid cron → HTTP 200 (config saved)
- J2-7b (medium): PUT scheduler with too-frequent cron → HTTP ≥400 (DDoS guard)
- J2-7c (medium): PUT to disable scheduler → HTTP 200 (cleanup path)

**Probe findings (2026-04-15)**:
- `DynamicSchedulerService.executeTask()` (engine/DynamicSchedulerService.java:107)
  executes via `toolRegistry.getExecutor().execute()`. **No persistence**: no
  `lastExecutedAt` field on `FactorySchedulerConfig`, no
  `scheduler_execution_log` table, no public counter for `activeTasks`.
- Evidence of execution is ONLY in backend log file:
  `log.info("Scheduled task: {} [{}] cron={}", key, config.getToolOrMethod(), config.getCronExpression())`
  Not accessible via API from E2E.
- Scheduled tools write to DRAFT (via `configService.toggleModule` etc).
  DRAFT state is **not visible via any GET endpoint** — `/config/modules/bom/draft`
  returns 404, `/config-changes` only tracks DROOLS_RULE entries (probe
  confirmed 0 delta after `canvas_toggle_module` call).

**Unblock path** (pick one):
1. **Add scheduler execution log**: persist `lastExecutedAt`, `lastExecutionStatus`,
   `executionCount` to `factory_scheduler_config` table. Expose via GET.
   Then a deep test sets cron for 60s from now, waits 65s, reads the config,
   asserts `executionCount` incremented AND `lastExecutedAt` within window.
2. **Add a canvas tool with immediate observable side effect** that doesn't
   require publish: e.g., `canvas_health_ping` that writes to a ping table
   with timestamp. Schedule it, wait, check ping table.
3. **Add GET /config-drafts/{moduleCode}**: expose DRAFT state so existing
   `canvas_toggle_module` can be used as the scheduled tool with observable
   DRAFT toggle.

**Estimated cost**: Option 1 is cleanest. All options need backend work.

**Note**: J6-A5 (deep) already proves the `canvas_toggle_module` →
`configService.toggleModule` → DB path works when invoked via apply-diffs.
So the ONLY untested piece is Quartz cron trigger → executeTask — a thin,
well-tested Spring primitive. Coverage here is defense-in-depth, not a
silent-data-loss class risk.

The G3 pattern (entity columns + @Transactional(REQUIRES_NEW) persist + E2E
deep test that reads back the counter) is symmetric and ready for future
application to scheduler when prioritized.

---

## Why we're NOT adding "fake deep" tests

Per `depth-first-e2e` skill Rule 1 and Rule 2, deep tests must perform a real
roundtrip (fill + submit + readback) with a specific observable assertion.
A "test that sets scheduler cron and verifies PUT returned 200" is exactly
J2-7a already — labeling it deep would be smoke-padding and violates the skill.

The 3 gaps above each require backend/fixture work that is **outside the E2E
test code's scope**. Documenting them here preserves visibility without
inflating the depth metrics dishonestly.

---

## Related context

- Current baseline: **99/99 PASS** / 0 FAIL / 0 WARN across 7 journeys
- Deep coverage additions through R7 E/F/G1/G3:
  - R3 P0-4: J1-E (custom field roundtrip)
  - R4 P0-4/5/6: J1-F/G/H (sub-table CRUD roundtrip)
  - R4 P0-5 symmetric: J4-9/10/11 (cross-tenant sub-table CRUD)
  - R6 P0-1: J1-I (aggregate formula roundtrip)
  - Session wrap J6-A5 (AI tool exec), J5-L5 (matrix overlay materiality)
  - R7 G1 **J5-L6** (role differential on writes)
  - R7 G3 **J2-9** (trigger chain actual firing via SalesOrderCreatedEvent)
