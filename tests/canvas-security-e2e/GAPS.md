# Canvas E2E Test Gaps — Infrastructure-Blocked

**Status**: **100/100 PASS** baseline (2026-04-16). **Zero infrastructure-blocked
gaps remain** as of R7 G2 closure.

This doc is kept as a historical record of the gray-area closure work so future
devs don't rediscover already-closed questions, and as an example of the pattern
to apply if a new observability gap surfaces.

---

## Closure summary

All 3 original gray-area gaps have been closed with deep tests:

### G1 — Permission matrix per-role differential — CLOSED 2026-04-16

**Original premise**: GET /config/modules/{X}/effective should return DIFFERENT
data per requesting role.

**Probe finding**: premise was wrong — the effective API is role-agnostic at the
read layer (admin and production_manager get identical data for all 6 probed
modules). Role enforcement lives on WRITE operations via `@RequireRole` on
mutating endpoints.

**Closure**: **J5-L6 deep** — admin PUT formula HTTP 200 vs production_manager
PUT HTTP 403. Test data setup: `UPDATE users SET is_active=true WHERE username='production_mgr2' AND factory_id='F002'`.

### G2 — Scheduler actual execution — CLOSED 2026-04-16

**Original premise**: No way to know if Spring TaskScheduler actually fires the
configured cron and invokes the tool.

**Closure**: added 4 observability columns to `factory_scheduler_configs` via
Flyway V20260416_04 (last_executed_at / last_execution_status /
last_execution_error / execution_count). `DynamicSchedulerService.executeTask`
writes them via `@Transactional(REQUIRES_NEW)` + `@Lazy` self-reference for
proxy-aware AOP. **J2-7d deep** verifies the full chain: set cron for ~5s in
future → wait up to 75s → assert execution_count bumped + lastExecutedAt set.
Verified on test: executionCount 0→2 in 75s window.

### G3 — Trigger chain actual firing — CLOSED 2026-04-16

**Original premise**: No way to know if TriggerChainExecutor actually fires the
chain when its event publishes.

**Closure**: same 4-column pattern on `factory_trigger_chains` via Flyway
V20260416_03. `TriggerChainExecutor.executeChain` writes via
`@Transactional(REQUIRES_NEW)` + `@Lazy self` (needed because event-dispatch
runs inside publisher's transaction — without REQUIRES_NEW, persist rolls back
with the parent). **J2-9 deep** creates an SO → event publishes →
SalesOrderCreatedEvent chain fires → assert execution_count bumped.

---

## Pattern reference (if a new observability gap surfaces)

The G2/G3 pattern is cheap and repeatable for any executor class that invokes
tools async outside an @Transactional boundary:

1. **Entity columns** (4 total):
   ```java
   @Column(name = "last_executed_at") private LocalDateTime lastExecutedAt;
   @Column(name = "last_execution_status", length = 20) private String lastExecutionStatus;
   @Column(name = "last_execution_error", columnDefinition = "TEXT") private String lastExecutionError;
   @Column(name = "execution_count", nullable = false) @Builder.Default private Long executionCount = 0L;
   ```

2. **Flyway migration** (idempotent):
   ```sql
   ALTER TABLE <executor_table>
     ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMP NULL,
     ADD COLUMN IF NOT EXISTS last_execution_status VARCHAR(20) NULL,
     ADD COLUMN IF NOT EXISTS last_execution_error TEXT NULL,
     ADD COLUMN IF NOT EXISTS execution_count BIGINT NOT NULL DEFAULT 0;
   CREATE INDEX IF NOT EXISTS idx_<table>_last_executed ON <table>(last_executed_at);
   ```

3. **Self-injection for @Transactional AOP**:
   ```java
   @Autowired @Lazy
   private MyExecutor self;
   ```

4. **REQUIRES_NEW persist method** (public, called via `self.persistExecutionMetadata(...)`):
   ```java
   @Transactional(propagation = Propagation.REQUIRES_NEW)
   public void persistExecutionMetadata(...) {
       // refetch entity, set fields, save
   }
   ```

5. **E2E deep test**: set config → wait → read back → assert
   `execution_count > baseline` AND `last_executed_at != null`.

---

## Current baseline (2026-04-16)

- **100/100 PASS** / 0 FAIL / 0 WARN across 7 journeys
- Deep coverage through R7 G2 closure:
  - R3 P0-4: J1-E (custom field roundtrip)
  - R4 P0-4/5/6: J1-F/G/H (sub-table CRUD roundtrip)
  - R4 P0-5 symmetric: J4-9/10/11 (cross-tenant sub-table CRUD)
  - R6 P0-1: J1-I (aggregate formula roundtrip)
  - Session wrap: J6-A5 (AI tool exec), J5-L5 (matrix overlay materiality)
  - R7 G1: **J5-L6** (role differential on writes)
  - R7 G2: **J2-7d** (scheduler cron actually fires)
  - R7 G3: **J2-9** (trigger chain actually fires via SalesOrderCreatedEvent)
