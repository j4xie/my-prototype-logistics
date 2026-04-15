# Canvas E2E Test Gaps — Infrastructure-Blocked

**Status**: 97/97 PASS baseline (2026-04-15). Below are 3 gray areas that are
**NOT closeable by adding E2E code alone** — each requires new backend API,
new test data, or new fixture infrastructure.

Recording them here so future devs don't waste time re-discovering the blocker
and so smoke-padding tests aren't added to fake closure (which would violate
`depth-first-e2e` skill Rule 1).

---

## Gap 1 — Permission matrix per-role differential

**What's untested**: Whether the permission matrix produces DIFFERENT effective
configs for DIFFERENT roles on the same module.

**What IS tested**:
- J2-5 (smoke): effective config has visible/readonly attributes per field
- J5-L5 (deep): for admin, ≥3 sales_order fields are constrained — proves the
  matrix machinery is actively applying overlay, not default-allow

**Probe findings (2026-04-15)**:
- `/config/modules/{X}/effective` returns **HTTP 403 for finance_mgr1** on all
  9 probed modules: `sales_order`, `invoice_record`, `finance_ar`, `finance_ap`,
  `inventory`, `product`, `customer`, `supplier`, `traceability`, `equipment`.
  The endpoint is admin-class only.
- F002 test factory has **only 3 user accounts**:
  - `restaurant_admin1` (factory_super_admin) — full access
  - `finance_mgr1` (finance_manager) — blocked at `/config/modules/**` entirely
  - `zj_staff1` (operator) — MOBILE_ONLY, can't web-login
- No middle-tier role account exists in F002 that could both access the
  effective endpoint AND have a narrower permission matrix than admin.

**Unblock path** (pick one):
1. **Add a test account in F002**: e.g., `f002_production_supervisor` with
   role `production_supervisor`, seeded with a narrower permission matrix
   on `sales_order`. Then L5 becomes a real differential test.
2. **Playwright UI test**: login as restaurant_admin1, snapshot which fields
   render readonly in `/sales/orders` create form. Then login as a different
   role in a different factory with known-narrower matrix, snapshot same
   form, diff. Requires identifying/creating such a role+factory pair.
3. **Add a debug endpoint**: `/config/modules/{X}/effective?asRole=foo` that
   lets admin query the effective config **as if** they were role `foo`.
   This is the cleanest API solution but requires backend work.

**Estimated cost**: Option 1 is cheapest (~1h DB script). Option 3 is the
right long-term design but requires backend change.

---

## Gap 2 — Scheduler actual execution (cron fires → tool runs)

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

---

## Gap 3 — Trigger chain actual firing (event → chain → downstream)

**What's untested**: Whether a configured trigger chain actually EXECUTES its
steps when its event fires, and whether the downstream tool mutates state.

**What IS tested**:
- J2-2 (smoke): GET `/config/v2/trigger-chains` returns 200 with chain list

**Probe findings (2026-04-15)**:
- F002 has 5 configured chains; **only 1 enabled**:
  `fermentation_complete_quality_check` listens for `BatchCompletedEvent`
  with `condition: #moduleCode == 'production_plan'`, action:
  `quality_create_inspection` with `source: fermentation`.
- Firing this chain requires:
  1. Creating a `production_plan` record in F002
  2. Completing a batch of that plan (POST to production module)
  3. Event bus publishing `BatchCompletedEvent`
  4. Async handler matching chain condition
  5. Tool registry invoking `quality_create_inspection`
  6. New `quality_inspection` row with `source=fermentation` appears
- No `/events/fire` or similar debug endpoint found for direct event injection.
- No existing production_plan records in F002 (probe).

**Unblock path** (pick one):
1. **Create production_plan fixture in F002**: seed a test plan + add a
   "complete batch" API call. Deep test: record baseline quality_inspection
   count → complete batch → wait async → count should be +1 with source=fermentation.
   Requires knowing the production module's API surface.
2. **Add `/events/fire` debug endpoint**: admin-only POST that publishes an
   arbitrary event to the bus. Deep test fires `BatchCompletedEvent` directly,
   then observes downstream quality_inspection creation.
3. **Enable a simpler chain**: configure a chain whose trigger is a canvas
   admin action (e.g., `ModulePublishedEvent`) with a simple observable
   downstream (e.g., writing to a log table). Fire the event by publishing
   a canvas config. Much less setup than production_plan.

**Estimated cost**: Option 3 is cheapest (~2h: configure chain + add
observable side effect). Option 1 requires production module coordination.

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

- Current baseline: 97/97 PASS / 0 FAIL / 0 WARN across 7 journeys
- Depth distribution (post J6-A5 + J5-L5):
  - smoke: ~106
  - medium: ~184
  - deep: ~89
- Previous deep coverage additions:
  - R3 P0-4: J1-E (custom field roundtrip)
  - R4 P0-4/5/6: J1-F/G/H (sub-table CRUD roundtrip)
  - R4 P0-5 symmetric: J4-9/10/11 (cross-tenant sub-table CRUD)
  - R6 P0-1: J1-I (aggregate formula roundtrip)
  - Gray-area closure: J6-A5 (AI tool exec), J5-L5 (matrix overlay materiality)
