
# Migration Replay Results — 2026-04-11

**Parent plan:** `2026-04-11-nginx-upstream-migration-audit.md`

**Scope:** V20260409_01 through V20260410_15 (20 migration files, the Canvas V3 batch).

**Executed:** 2026-04-11 ~07:49 CST, in-session via inline execution.

## Method

Ran on prod server (`47.100.235.168`) via `sudo -u postgres psql cretas_prod_db -f <file>` in lexicographic order. All migrations in this batch are designed to be idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`), so replaying already-applied migrations should be a no-op.

```bash
cd /tmp/cretas-migration-replay
: > replay.log
for f in $(ls V2026*.sql | sort); do
    echo "=== $f ===" | tee -a replay.log
    sudo -u postgres psql cretas_prod_db -f "$f" 2>&1 | tee -a replay.log
done
```

## Results by file

| Migration | Effect observed | Notes |
|---|---|---|
| V20260409_01 canvas_config_tables | `CREATE FUNCTION` (new) + 4 tables already existed | Function `update_updated_at()` was re-created (idempotent) |
| V20260409_02 seed_sales_order_bom_schema | `INSERT 0 0` × 2 | Already seeded (no-op) |
| V20260409_03 seed_data_spec_alignment | `UPDATE 1` × 2 | **2 rows updated** — some data drift was present |
| V20260409_04 canvas_config_grants | `DO` block | Grants re-applied |
| V20260409_05 fix_rejected_resubmit_transition | `UPDATE 1` | **1 row updated** |
| V20260410_01 factory_tool_skill_trigger_tables | 3 tables already existed, `DO` block | Grants re-applied |
| V20260410_02 seed_default_trigger_chains | `INSERT 0 1` × 4 | **4 new trigger chain rows inserted** — were missing! |
| V20260410_03 factory_validation_default_formula_scheduler_tables | 4 tables already existed, `DO` block | Grants re-applied |
| V20260410_04 seed_core_validation_rules | `INSERT 0 14`, `INSERT 0 8` | **22 new validation rules inserted** — were missing! |
| V20260410_05 seed_bulk_validation_rules | `INSERT 0 21` | **21 new bulk validation rules inserted** — were missing! |
| V20260410_06 seed_default_values | `INSERT 0 22` | **22 new default values inserted** — were missing! |
| V20260410_07 seed_scheduler_configs | `INSERT 0 12` | **12 new scheduler configs inserted** — were missing! |
| V20260410_08 module_schemas_batch1_core | `INSERT 0 0` × 5 | Already seeded |
| V20260410_09 module_schemas_batch2_operations | `INSERT 0 0` × 5 | Already seeded |
| V20260410_10 module_schemas_batch3_support | `INSERT 0 0` × 5 | Already seeded |
| V20260410_11 industry_templates | `INSERT 0 0` × 4 | Already seeded |
| V20260410_12 config_review_publish_window | 5 columns already existed, `INSERT 0 1` | Columns applied manually earlier in-session (07:30). INSERT created a **duplicate row** due to NULL factory_id in the ON CONFLICT clause — see cleanup below. |
| V20260410_13 canvas_dynamic_field_table | Table existed, 2 `CREATE INDEX` failed with "already exists" | **Migration bug**: missing `IF NOT EXISTS` on CREATE INDEX statements. Non-fatal (indexes are there). |
| V20260410_14 canvas_ddl_log_table | Table existed, 1 `CREATE INDEX` failed with "already exists" | Same migration bug. Non-fatal. |
| V20260410_15 canvas_dynamic_field_version_tracking | Column + index already existed | Applied earlier by another session ~07:30. |

## Summary

- **Real data applies**: **7 migrations** had non-empty INSERT/UPDATE effects (V20260409_03, V20260409_05, V20260410_02, V20260410_04, V20260410_05, V20260410_06, V20260410_07)
- **Total new rows inserted**: 59 (trigger chains 4 + validation rules 22 + bulk rules 21 + default values 22 + scheduler configs 12 — minus earlier double-counting)
- **Actually**: 4 + 22 + 21 + 22 + 12 = **81 new rows**. This is significant — these are the "seed" data that should have been applied during earlier deploys but weren't.
- **Rows updated**: 3 (V20260409_03 and V20260409_05)
- **Structural schema changes from replay**: 0 (all tables/columns already existed from prior partial applies)
- **Errors**: 3 benign "CREATE INDEX ... already exists" errors in V20260410_13/14 (migration bug, see below)
- **Duplicates created**: 1 in factory_scheduler_configs for `CONFIG_PUBLISH_WINDOW` (NULL factory_id → ON CONFLICT didn't deduplicate). **Cleaned up immediately after replay by deleting row id=27.**

## Post-replay cleanup

```sql
-- Duplicate CONFIG_PUBLISH_WINDOW row (ON CONFLICT can't dedupe on NULL factory_id)
DELETE FROM factory_scheduler_configs 
WHERE id = 27 AND task_code = 'CONFIG_PUBLISH_WINDOW' AND factory_id IS NULL;
-- DELETE 1
```

Verified afterwards: exactly 1 row remains for `CONFIG_PUBLISH_WINDOW`.

## Follow-up recommendations

### 1. Fix the 2 migration bugs (low priority)

**V20260410_13** (canvas_dynamic_field_table.sql) and **V20260410_14** (canvas_ddl_log_table.sql) both use `CREATE INDEX ...` without `IF NOT EXISTS`. This prevents idempotent replay. Patches should replace with `CREATE INDEX IF NOT EXISTS` so future replays don't error.

### 2. Fix V20260410_12 NULL-ON-CONFLICT handling (low priority)

**V20260410_12** (config_review_publish_window.sql) uses:
```sql
INSERT INTO factory_scheduler_configs (factory_id, task_code, ...)
VALUES (NULL, 'CONFIG_PUBLISH_WINDOW', ...)
ON CONFLICT (factory_id, task_code) DO NOTHING;
```

PostgreSQL treats `NULL = NULL` as UNKNOWN in unique constraints, so this INSERT creates duplicates on every replay. Fix: add a partial unique index:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_fschd_global_task 
  ON factory_scheduler_configs (task_code) WHERE factory_id IS NULL;
```
OR change the INSERT to use `WHERE NOT EXISTS (...)` check.

### 3. Enable automatic migration application (HIGH priority)

**The core issue** this replay exposed: the project has Flyway-style migration files but **nothing actually applies them to prod**. Today's errors — `factory_scheduler_configs does not exist` (session earlier), `review_notes does not exist` (session later), and the **81 missing seed rows** found by this replay — are all symptoms of the same gap.

Recommendations (pick one):

**Option A: Enable Spring Boot Flyway (recommended)**
Add `flyway-core` + `flyway-database-postgresql` to `pom.xml`, add `spring.flyway.enabled=true` + `spring.flyway.locations=classpath:db/migration` to `application.properties`. Flyway runs at Spring Boot startup, reads `flyway_schema_history` table, applies anything missing. First run will mark all existing migrations as "already applied" via `baseline-on-migrate=true`. Adds ~5-10s to startup.

**Option B: Pre-deploy migration step in `deploy-backend.sh`**
Add a step in `scripts/deploy/deploy-backend.sh` (before starting the new JAR) that tar's the db/migration/*.sql files, ssh's to 47, and runs `psql -f` on each. Needs its own "already applied" tracking OR rely on idempotent SQL (needs V20260410_13/14 migration bug fix first).

**Option C: Manual pre-deploy checklist**
Document that every deploy MUST run missing migrations manually first. Weakest option — relies on operator discipline.

**My recommendation: Option A**. Spring Boot's Flyway integration is battle-tested, handles tracking natively, and requires only config + dependency changes.

## Prod state after replay

- `curl https://www.cretaceousfuture.com/api/mobile/health` → **200**
- `cretas-backend-error.log` errors in last 10 min: **0**
- Schema verified: `factory_configurations` has all 5 audit columns; `canvas_dynamic_field.active_from_version` exists; `factory_scheduler_configs.cron_expression` exists
- `/tmp/cretas-migration-replay/` cleaned up

## Parent plan

`docs/superpowers/plans/2026-04-11-nginx-upstream-migration-audit.md` — see Phase B for the plan that produced this replay.
