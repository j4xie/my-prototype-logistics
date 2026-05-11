# Phase 2D — Silver Schema Migration + Factory Branch Impl Spec

**Status**: ⛔ DRAFT — Doc-only design spec. No code, no migrations, no DDL apply, no deploy. Dispatch input for downstream Phase 2D impl chats.
**Spec date**: 2026-05-11
**Author**: chat1 (Phase 2D design spec writer)
**Branch**: `spec/phase-2d-silver-migration-and-factory-impl`
**Worktree**: `.worktrees/phase-2d-design`
**Base SHA**: `2bed3b931e` (origin/main HEAD post PR #368 P0 fix merge)
**Audience**: organizer (review) → downstream Phase 2D impl chats (execute migration / Sub-ETL / factory branch ports)
**Trigger**: organizer dispatch 2026-05-11 — unblock current 14 R_*_REAL chains + 56 factory tenants stuck on factory `_dispatch` `NotImplementedError`

---

## 0. TL;DR

Phase 2B (T6.6) closed restaurant tenant Python port for `/analysis/production` + `/analysis/quality`. Factory tenants still hit `_factory_production_dispatch` / `_factory_quality_dispatch` which raise `NotImplementedError` (chat-A1 PR #350 + chat-B1 PR #354 Option B defer). 14 R_*_REAL chains seeded into `smartbi_prod_db.restaurant_chain_catalog` (Sub-ETL-3 V20260511_02) but absent from `cretas_prod_db.factories` tenant registry, so they default to `TenantType.FACTORY` → factory dispatcher → 500.

Phase 2D unblocks both gaps in a single coordinated swing:

| Item | This spec |
|---|---|
| Silver schema migration | 9 new tables in `smartbi_prod_db` (5 production + 5 quality, `fact_quality_inspection` shared) |
| Sub-ETL extension | New factory-tenant ingest tool reading existing Java operational tables (`production_batches`, `quality_inspections`, etc.) → load Silver layer |
| Python factory branch impl | Replace 2× `NotImplementedError` with real-DB queries (8 production + 7 quality method ports per Sub-A/B specs §2.1) |
| 14 R_*_REAL onboarding | Steve decision required — bulk INSERT into `factories.type='RESTAURANT'` OR keep as data-only IDs OR delete `restaurant_chain_catalog` (3 options in §5) |
| Phase 2D cutover | T6.7 (factory production) + T6.8 (factory quality) — mirror T6.6 cascade pattern but at factory tenant granularity |
| Effort estimate | Migration ~1pd, Sub-ETL-factory ~3-4pd, Python impl ~5pd production + ~5pd quality, cutover ~2pd. Total ~16-17pd across 4-5 chats. |
| Customer-facing risk | Low pre-customer-return; factory branch currently 500s in prod (post-T6.6) for restaurant analysis URLs accessed by factory tenants; this spec fixes that. |
| Active-E2E gate | Per HARD `feedback_active_e2e_replaces_passive_soak.md` — 15-30 min smoke per stage. |

⛔ **HOLD blocks**:

- Spec only. No migration files committed, no DDL applied, no Sub-ETL tooling shipped, no Python code edits, no nginx mutation, no deploy.
- §8 chat4 audit data section is **placeholder** — chat4 ran `scripts/etl/validate-factory-silver-schema.sql` in parallel; this spec will be **amended via follow-up PR** with the audit output when ready. Numbers like "9 tables MISSING" stated here are based on prior-state assumption (validate script comments imply factory Silver doesn't exist); amend §8 to reflect prod truth.
- §5 14 R_*_REAL onboarding decision is for Steve. This spec presents 3 options but does NOT pick one — implementer chat acts on Steve's choice in PR comment.
- STOP-and-ping organizer BEFORE pushing this spec per HARD `feedback_pause_before_deploy_or_push.md`.

---

## 1. Background

### 1.1 Phase 2B closure recap (restaurant LIVE on prod)

Per `2026-05-11-t6-6-cutover-spec.md` + PR chain:

| PR | What landed | Tenant scope |
|---|---|---|
| #350 (chat-A1) | `tenant.py` + `analysis_production.py` skeleton + Option B factory defer | Both branches `NotImplementedError` |
| #352 (chat-A2) | Restaurant production M1+M2+M3 LIVE | Restaurant branch LIVE |
| #354 (chat-B1) | `analysis_quality.py` skeleton both branches `NotImplementedError` | Both branches `NotImplementedError` |
| #358 (chat4) | Restaurant quality N1-N4 LIVE | Restaurant branch LIVE |
| #360 (chat1) | `main.py` router register + Java `PythonSmartBIClient` methods | Routing wired |
| #365 (chat3) | Parity-gate harness + restaurant golden record | Tooling |
| #367 (chat4) | `validate-factory-silver-schema.sql` audit script + restaurant N1-N4 readiness | Tooling |
| #368 (chat1, P0) | `tenant.py` SQL column `factory_id` → `id` | Bug fix |

**Phase 2B current state on prod**: restaurant-tenant `/analysis/production` + `/analysis/quality` return real envelopes for the 19 known restaurant tenants in `cretas_prod_db.factories`. Factory-tenant equivalents return 500 (`NotImplementedError`). 14 R_*_REAL chains in `smartbi_prod_db.restaurant_chain_catalog` also 500 because they default to `TenantType.FACTORY` (not in `cretas_prod_db.factories` registry).

### 1.2 Phase 2D scope

Two complementary deliverables:

1. **Factory tenant Python impl** — port the Java mock for `/analysis/production` + `/analysis/quality` factory branches to Python real-DB. Replaces the 2× `NotImplementedError` stubs.
2. **Silver schema migration + Sub-ETL-factory** — create the 9 Silver tables (5 production + 5 quality with 1 shared) and an ETL tool that reads Java operational tables (`cretas_db.production_batches`, `cretas_db.quality_inspections`, etc.) → loads `smartbi_prod_db.fact_*` Silver layer.

Plus one decision gate:

3. **14 R_*_REAL tenant registry onboarding** — Steve picks one of 3 options in §5.

### 1.3 Why a separate spec

Sub-A spec (PR #345) and Sub-B spec (PR #346) each had a `§2.3 chat-A1/B1 BLOCKER awareness` section that **deferred** factory branch to Phase 2D. That deferral was a pragmatic Option B for unblocking Phase 2B restaurant work — it did NOT design the Phase 2D resolution path. This spec is that design.

Three new concerns warranting separate-spec treatment:

1. **Schema migration ownership**: Sub-ETL-2 / Sub-ETL-3 (restaurant) only handle POS ingest. Factory tenant Silver layer needs its own loader because the source tables (Java `production_batches` etc.) have different shape than POS `fact_pos_*`.
2. **Onboarding gap is data governance, not code**: 14 R_*_REAL chains aren't in `factories` registry. That's a deliberate ETL-side seeding decision (Sub-ETL-3 V20260511_02) that didn't sync to the app-tier tenant table. Resolution requires product decision (3 options §5), not a code patch.
3. **Cutover strategy differs from T6.6**: T6.6 routed by factory_id prefix at nginx. T6.7/T6.8 will route by `cretas_db.factories.type` discriminator post Python impl — meaning all factory tenants flip at once (Python factory branch handles them all). nginx rule simpler than T6.6.

---

## 2. Silver schema migration plan

### 2.1 Required new tables

Per `scripts/etl/validate-factory-silver-schema.sql` (chat4 PR #367) + Sub-A spec §2.3 + Sub-B spec §2.3. The chat4 audit script enumerates these as MISSING (placeholder pending §8 prod confirmation):

#### 2.1.1 Production-side (5 tables)

| Table | Purpose | Sub-A spec ref |
|---|---|---|
| `fact_production_batch` | OEE inputs: `planned_runtime_minutes`, `downtime_minutes`, `theoretical_units`, `actual_units`, `good_units`, `total_units` per (date, production_line_code). Source for OEE 3-component formula (availability × performance × quality / 10000). | §2.3 M1-M3 |
| `fact_equipment_event` | Equipment downtime grain: per-event `downtime_minutes`, `downtime_reason` enum, `failure_count`. Source for `getDowntimeDistributionChart` (Sub-A §2.1 #8). | §2.3 M5-M6 |
| `fact_quality_inspection` | Per-inspection grain: `total_inspections`, `defect_count`, `first_pass_count`. **SHARED with quality branch §2.1.2** — both use the same fact table at the inspection-batch grain. | §2.3 M4 + Sub-B §2.3 N1 |
| `dim_equipment` | Equipment master: `equipment_id`, `equipment_name`, `production_line_id`, status enum (mirrors `EquipmentStatus` Java enum). Source for equipment dimension joins in `getEquipmentRanking` (Sub-A §2.1 #7). | — |
| `dim_production_line` | Production line master: `production_line_id`, `production_line_code`, `production_line_name`, `factory_id`. Source for production-line dimension joins in `getProductionLineRanking` (Sub-A §2.1 #5). | — |

#### 2.1.2 Quality-side (5 tables, `fact_quality_inspection` shared)

| Table | Purpose | Sub-B spec ref |
|---|---|---|
| `fact_quality_inspection` | Same as §2.1.1 — shared between Sub-A and Sub-B. | §2.3 N1 |
| `fact_quality_defect` | Per-defect-occurrence: `defect_type` (categorical), `inspection_id` FK, `defect_count`. Source for `getDefectTypeRanking` + `getDefectParetoChart`. | §2.3 N2 |
| `fact_rework_record` | Rework events: `rework_count`, `rework_cost` (Decimal). Source for `getReworkCost` (Sub-B §2.1 #6). | §2.3 N3 |
| `fact_disposal_record` | Disposal/scrap events: `scrap_count`, `scrap_cost`. Source for `getQualityCostDistributionChart` (Sub-B §2.1 #7). | §2.3 N3 |
| `fact_customer_complaint` | Complaint events: `complaint_count`, `complaint_severity`, `resolution_status`. Source for `getQualitySummary` complaint metrics (Sub-B §2.1 #1). | §2.3 N4 |

#### 2.1.3 Total

9 distinct tables (1 shared between production and quality branches). All in `smartbi_prod_db.public` (matches restaurant Silver convention from `2026_04_29_silver_facts.sql`).

### 2.2 Column-level schema

Each Silver table follows the conventions established by `2026_04_29_silver_facts.sql`:

```sql
-- Conventions reused from restaurant Silver:
--   - BIGSERIAL surrogate id (PRIMARY KEY)
--   - factory_id VARCHAR(50) NOT NULL — RLS enforced
--   - upload_id BIGINT — loose link to upload tracking
--   - source_type VARCHAR(20) — 'java_op_table' | 'manual_seed' | ...
--   - created_at / updated_at TIMESTAMP DEFAULT NOW()
--   - ENABLE + FORCE ROW LEVEL SECURITY with tenant_isolation policy
--   - trg_*_touch BEFORE UPDATE trigger → silver_touch_updated_at()
```

**Source-of-truth for column types**: corresponding Java entity classes in `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/`. The migration author resolves the Silver column types by reading the Java entity:

| Silver table | Java entity reference | Notes |
|---|---|---|
| `fact_production_batch` | `entity/ProductionBatch.java` | aggregate to (date, production_line) grain |
| `fact_equipment_event` | `entity/EquipmentAlert.java` + `entity/EquipmentMaintenance.java` | union event types |
| `fact_quality_inspection` | (no direct Java entity — Java mock-only) | new shape, derive from Java `QualityAnalysisServiceImpl` mock fields |
| `fact_quality_defect` | (no direct Java entity — mock-only) | derive from `QualityAnalysisServiceImpl.getDefectTypeRanking` mock |
| `fact_rework_record` | `entity/enums/ReworkStatus.java` + `entity/enums/ReworkType.java` | new fact, derive cost columns from Java mock |
| `fact_disposal_record` | `entity/DisposalRecord.java` | direct mirror |
| `fact_customer_complaint` | (no direct Java entity — mock-only) | derive from mock |
| `dim_equipment` | `entity/FactoryEquipment.java` | dimension table, low cardinality |
| `dim_production_line` | `entity/ProductionLine.java` | dimension table, low cardinality |

**Example skeleton** (Sub-ETL impl chat fills column types from Java entities):

```sql
CREATE TABLE IF NOT EXISTS fact_production_batch (
    id                BIGSERIAL PRIMARY KEY,
    factory_id        VARCHAR(50) NOT NULL,
    upload_id         BIGINT,
    source_type       VARCHAR(20) NOT NULL,   -- 'java_op_table' for Sub-ETL-factory
    source_batch_id   VARCHAR(100) NOT NULL,  -- maps to cretas_db.production_batches.batch_number
    date              DATE NOT NULL,
    production_line_code VARCHAR(50) NOT NULL,
    -- OEE inputs (per Sub-A spec §2.3 M1-M3)
    planned_runtime_minutes INT,
    downtime_minutes        INT,
    theoretical_units       INT,
    actual_units            INT,
    good_units              INT,
    total_units             INT,
    -- audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_fact_prod_batch UNIQUE (factory_id, source_type, source_batch_id),
    CONSTRAINT fk_fact_prod_batch_line FOREIGN KEY (production_line_code)
        REFERENCES dim_production_line (production_line_code) ON DELETE RESTRICT
);
ALTER TABLE fact_production_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_production_batch FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON fact_production_batch;
CREATE POLICY tenant_isolation ON fact_production_batch FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
-- Hot path: "OEE for date range" — Sub-A spec §2.3 M1 aggregate.
CREATE INDEX IF NOT EXISTS idx_fact_prod_batch_factory_date
    ON fact_production_batch (factory_id, date);
```

The remaining 8 tables follow the same template — author derives columns from `QualityInspection` mock fields / `ProductionLine` entity / etc.

### 2.3 Sub-ETL extension for factory data ingest

Mirror `2026-05-11-t6-6-etl-infra-design-spec.md` for factory side:

| Aspect | Restaurant (current Sub-ETL-2/3) | Factory (proposed Sub-ETL-factory) |
|---|---|---|
| Source | Excel POS reports + 大众点评 reviews CSV | Java operational tables `cretas_db.production_batches` / `quality_inspections` / `disposal_records` / equipment events |
| Target | `smartbi_prod_db.fact_pos_*` + `fact_restaurant_*` | `smartbi_prod_db.fact_production_batch` / `fact_equipment_event` / `fact_quality_inspection` / `fact_quality_defect` / `fact_rework_record` / `fact_disposal_record` / `fact_customer_complaint` |
| Trigger | Manual Excel upload via admin UI | Scheduled batch (daily) cross-DB transfer from `cretas_prod_db` → `smartbi_prod_db` |
| Tenant scope | 19 R/RES restaurants currently in `factories` | 56 F* factory tenants currently in `factories` (HEADQUARTERS / CENTRAL_KITCHEN included via FactoryType predicate) |
| New tooling | `scripts/etl/import-restaurant-chain.py` | NEW: `scripts/etl/import-factory-silver.py` |

**Sub-ETL-factory impl scope** (separate PR per §4.2):

1. New Python module `scripts/etl/import_factory_silver/` with sub-modules per fact table
2. Cross-DB reader uses asyncpg connection to `cretas_prod_db` (read-only) + asyncpg to `smartbi_prod_db` (write)
3. Idempotent upsert via `ON CONFLICT (factory_id, source_type, source_batch_id)` (or equivalent natural key per table)
4. CLI: `python scripts/etl/import-factory-silver.py --factory-id F001 --since 2026-01-01` or `--all-factories` for backfill
5. Cron schedule: daily 03:00 CST (low-traffic window). Phase 2D-N defers to Phase 3 if backfill is sufficient for initial cutover.

### 2.4 Migration files

Per `feedback_organizer_must_git_pull_before_deploy.md` deploy rule + `.claude/rules/server-operations.md` ⛔ Smartbi 数据库 schema 变更 (HARD RULE):

```
backend/python/smartbi/database/migrations/
├── V20260601_01__phase2d_factory_production_silver.sql   (~150 LOC)
│   ├── CREATE TABLE fact_production_batch
│   ├── CREATE TABLE fact_equipment_event
│   ├── CREATE TABLE dim_production_line
│   └── CREATE TABLE dim_equipment
├── V20260601_02__phase2d_factory_quality_silver.sql      (~200 LOC)
│   ├── CREATE TABLE fact_quality_inspection
│   ├── CREATE TABLE fact_quality_defect
│   ├── CREATE TABLE fact_rework_record
│   ├── CREATE TABLE fact_disposal_record
│   └── CREATE TABLE fact_customer_complaint
└── V20260601_03__phase2d_factory_seed_optional.sql       (~50 LOC, optional)
    └── INSERT INTO dim_production_line + dim_equipment from cretas_prod_db.* (one-time seed)
```

**Naming convention**: `V<YYYYMMDD>_<NN>__<description>.sql` per `apply-smartbi-migrations.sh` runner. Filename PK in `smartbi_migrations` tracker — distinct files even for same `YYYYMMDD_NN` would still be tracked separately (per spec §3.2).

**Deploy path** (HARD RULE per `server-operations.md`):

```bash
./scripts/deploy/deploy-smartbi-python.sh --env test
# → Step 3.5 auto-applies the 3 migrations via apply-smartbi-migrations.sh
# → If migration fails, deploy ABORT, Python NOT restarted (old schema + old code keep running)

# After test smoke verify:
./scripts/deploy/deploy-smartbi-python.sh --env prod
```

⛔ **No manual `psql -f` apply.** If runner has a bug, use the documented `SKIP_MIGRATIONS=1` escape hatch + immediately fix runner + commit.

---

## 3. Factory branch impl outline

### 3.1 Replace `analysis_production.py:_factory_production_dispatch` `NotImplementedError`

Current stub (PR #350):

```python
async def _factory_production_dispatch(
    factory_id: str, start_date: date, end_date: date, analysis_type: Optional[str],
) -> dict:
    raise NotImplementedError(_FACTORY_BRANCH_DEFERRED_MSG)
```

Phase 2D replacement: real-DB queries against the 5 Silver tables from §2.1.1, mirroring Java `ProductionAnalysisServiceImpl` 8 methods per Sub-A spec §2.1.

### 3.2 Replace `analysis_quality.py:_factory_quality_dispatch` `NotImplementedError`

Current stub (PR #354):

```python
async def _factory_quality_dispatch(
    factory_id: str, start_date: date, end_date: date, analysis_type: Optional[str],
) -> dict:
    raise NotImplementedError(_FACTORY_BRANCH_DEFERRED_MSG)
```

Phase 2D replacement: real-DB queries against the 5 Silver tables from §2.1.2, mirroring Java `QualityAnalysisServiceImpl` 7 methods per Sub-B spec §2.1.

### 3.3 Production method surface (8 entry points per Sub-A §2.1)

| # | Java method | Python equivalent | Silver table(s) read |
|---|---|---|---|
| 1 | `getOEEOverview(factoryId, startDate, endDate)` | `_factory_production_overview` | `fact_production_batch` |
| 2 | `getOEEMetrics` | `_factory_oee_metrics` | `fact_production_batch` |
| 3 | `getOEETrendChart` | `_factory_oee_trend_chart` | `fact_production_batch` (grouped by date) |
| 4 | `getProductionEfficiency` | `_factory_production_efficiency` | `fact_production_batch` |
| 5 | `getProductionLineRanking` | `_factory_production_line_ranking` | `fact_production_batch` + `dim_production_line` |
| 6 | `getEquipmentUtilization` | `_factory_equipment_utilization` | `fact_equipment_event` + `dim_equipment` |
| 7 | `getEquipmentRanking` | `_factory_equipment_ranking` | `fact_equipment_event` + `dim_equipment` |
| 8 | `getDowntimeDistributionChart` | `_factory_downtime_distribution` | `fact_equipment_event` (grouped by reason) |

### 3.4 Quality method surface (7 entry points per Sub-B §2.1)

| # | Java method | Python equivalent | Silver table(s) read |
|---|---|---|---|
| 1 | `getQualitySummary` | `_factory_quality_summary` | `fact_quality_inspection` + `fact_customer_complaint` |
| 2 | `getDefectAnalysis` | `_factory_defect_analysis` | `fact_quality_inspection` + `fact_quality_defect` |
| 3 | `getQualityTrendChart` | `_factory_quality_trend_chart` | `fact_quality_inspection` (grouped by date) |
| 4 | `getDefectTypeRanking` | `_factory_defect_type_ranking` | `fact_quality_defect` (grouped by defect_type) |
| 5 | `getDefectParetoChart` | `_factory_defect_pareto_chart` | `fact_quality_defect` (stateful cumulative loop per Sub-B §2.2) |
| 6 | `getReworkCost` | `_factory_rework_cost` | `fact_rework_record` |
| 7 | `getQualityCostDistributionChart` | `_factory_quality_cost_distribution` | `fact_rework_record` + `fact_disposal_record` |

### 3.5 Rule 4 / 6 / 10 / 12 compliance per `python-java-port.md`

| Rule | Application | Phase 2D impl chat must |
|---|---|---|
| **R1** (`is not None` not `or`) | Decimal arithmetic on `fact_production_batch` columns + `fact_quality_inspection` defectCount | Use explicit `is not None` for all nullable Java fields |
| **R4** (`_decimal_to_number`) | OEE percentage, defect rate, rework cost output | Wrap every Decimal output with `_decimal_to_number` |
| **R5** (`SELECT *` shared SQL) | If a query helper is shared across multiple methods (e.g., `_query_production_batch_data`), use `SELECT *` | Otherwise narrow columns OK per endpoint-specific helper exception |
| **R6** (input boundary None-check) | `_query_*` helpers accepting `start_date` / `end_date` | Add `if start_date is None or end_date is None: raise ValueError(...)` precondition |
| **R8** (Map.of key order) | Charts return `Map.of` literals (`oee_trend`, `production_line_comparison`, etc.) | Record F999/F001 goldens BEFORE writing Python literal dict; mirror Java Jackson hash order |
| **R9** (Lombok null emit) | `DashboardResponse` envelope + `ChartConfig` Lombok-derived fields (e.g. `xaxisField` lowercase) | grep `@JsonInclude` per DTO + golden-driven dict literal |
| **R10** (BigDecimal divide-multiply intermediate quantize) | OEE 3-component formula (Sub-A §2.2): `availability.multiply(performance).multiply(quality).divide(10000, SCALE=4, HALF_UP)` | Chain divide-then-multiply with intermediate `quantize(Decimal("0.0001"), ROUND_HALF_UP)` before final scale-2 |
| **R12** (String.format HALF_UP vs banker's) | Defect rate display `String.format("%.1f%%", ...)` (Sub-B §2.2) | Use `_format_decimal_half_up(value, 1) + "%"` helper |

⚠️ Phase 2D impl chats **record F999 + F001 goldens** before writing literal dicts. Java side is mock per Q1 §1 amendment so goldens are informational dict-eq (parity gate match rate target ≥99.5%, not strict-byte) — same standard as T6.1 dryrun (99.945%).

---

## 4. Dispatch sequence

5 PRs ordered (one per chat). Each PR runs reviewer audit cycle per per-PR per-spec convention.

### 4.1 PR-A: Silver schema migration (~1pd)

**Scope**:

- `V20260601_01__phase2d_factory_production_silver.sql` (4 production tables)
- `V20260601_02__phase2d_factory_quality_silver.sql` (5 quality tables)
- `V20260601_03__phase2d_factory_seed_optional.sql` (dim seed from cretas_prod_db, optional)
- New row in `docs/qa-audits/2026-XX-XX-phase-2d-silver-migration-evidence.md` documenting per-table schema choice + Java entity reference

**Gate**:

- `deploy-smartbi-python.sh --env test` succeeds (runner applies migrations)
- `validate-factory-silver-schema.sql` re-run shows all 9 tables EXISTS (not MISSING)
- 1 reviewer audit cycle

**Owner**: chat-2D-migration (1 chat)

### 4.2 PR-B: Sub-ETL-factory ingest tooling (~3-4pd)

**Scope**:

- `scripts/etl/import_factory_silver/` Python package
- Cross-DB reader for `cretas_prod_db.production_batches` → `smartbi_prod_db.fact_production_batch` (and 6 more table pairs)
- Idempotent upsert via natural keys
- CLI: `--factory-id`, `--since`, `--all-factories`, `--dry-run`
- Backfill all 56 factory tenants for `[2024-01-01, today)` window — single full backfill before T6.7 cutover
- Cron schedule TBD (Phase 2D-N can defer if single backfill sufficient)

**Gate**:

- Dry-run on F999 + F001 → row counts match Java operational source
- Real run on F999 → smartbi_prod_db Silver populated
- Spot-check: `SELECT COUNT(*) FROM fact_production_batch WHERE factory_id = 'F999'` ≥ 1
- 2 reviewer audit cycles (cross-DB transfer is high-risk)

**Owner**: chat-2D-etl (1 chat, depends on PR-A merge)

### 4.3 PR-C: Factory branch impl — production (~5pd)

**Scope**:

- Replace `_factory_production_dispatch` in `analysis_production.py` with 8 method ports per §3.3
- Add SQL helpers (`_query_production_batch_data`, `_query_equipment_event_data`) with Rule 6 None-check preconditions
- Record 8 F999 + F001 goldens via `record-java-golden.sh`
- Add ~30 unit tests covering Rule 8 (Map.of order) + Rule 9 (Lombok null) + Rule 10 (divide-multiply intermediate quantize)
- chat3 parity-gate harness run for dict-eq match rate ≥99.5%

**Gate**:

- pytest passes
- 8 goldens recorded
- parity-gate match rate report committed to `docs/qa-audits/`
- 2 reviewer audit cycles per Rules 1-12

**Owner**: chat-2D-production (1 chat, depends on PR-B backfill)

### 4.4 PR-D: Factory branch impl — quality (~5pd)

**Scope**: mirror PR-C for quality side per §3.4 (7 method ports). Record 8 quality goldens.

**Gate**: same shape as PR-C.

**Owner**: chat-2D-quality (1 chat, depends on PR-B backfill; can parallel with PR-C)

### 4.5 PR-E: Phase 2D cutover (T6.7 → T6.8 nginx + active-E2E)

**Scope** (mirror `2026-05-11-t6-6-cutover-spec.md` cascade pattern):

- **T6.7.1 dryrun**: parity-gate harness on F999 + F001 ≥99.5%
- **T6.7.2 canary**: F999 only — Python factory production active-E2E gate
- **T6.7.3 cascade**: F001 → 5 more F-numeric → all 56 factory tenants
- **T6.7.4 cleanup**: Java deprecation header — production path
- **T6.8.x**: identical cascade for quality side — **Sequential after T6.7 close** ✅ Steve sign-off 2026-05-11

**Sequencing rationale** (Steve sign-off 2026-05-11): T6.7 + T6.8 run **sequentially**, NOT parallel. Quality cascade waits for production T6.7.4 close before T6.8.1 dryrun begins. Reasons:

1. **Schema dependency overlap**: `fact_quality_inspection` is shared between production and quality branches (§2.1). Sequential cutover ensures production-side reads are stable before introducing quality-side concurrent reads.
2. **Rollback simplification**: parallel T6.7 + T6.8 would create combinatorial rollback states (revert one or both?). Sequential keeps each cascade self-contained.
3. **Reviewer / customer bandwidth**: 2 simultaneous cascades double the active-E2E and customer-comms load. Sequential keeps per-day comms volume manageable.

Trade-off: ~1 week additional elapsed time (T6.7 close + 24-72h observation → T6.8 start). Steve accepted this for the safety / clarity gains.

**Gate per stage**:

- 15-30 min active-E2E (web-admin dashboard render + endpoint smoke + cross-tenant negative for restaurant validation)
- 0 Python 5xx outside expected paths
- Java fallback rate not used as gate (factory tenants now use Python by design)

**Owner**: chat-2D-cutover (1 chat or fold into PR-C/PR-D if scope allows)

### 4.6 Dispatch order summary

```
PR-A (migration) ──→ PR-B (Sub-ETL-factory backfill) ──┬→ PR-C (production impl) ─┐
                                                       └→ PR-D (quality impl) ────┴→ PR-E (T6.7 + T6.8 cutover)
```

PR-C and PR-D can run parallel; PR-E waits both. Total elapsed time ~2 weeks across 4-5 chats.

---

## 5. 14 R_*_REAL onboarding decision

### 5.1 Context

Sub-ETL-3 V20260511_02 seeded `smartbi_prod_db.restaurant_chain_catalog` with 14 R_*_REAL chains:

```
R_DONGMENKOU_REAL, R_HONGDEJI_REAL, R_HUOGUO_GENERIC_REAL, R_ILTEATRO_REAL,
R_JINCHUAN_HG_REAL, R_JINRINIUSHI_REAL, R_LINJIAYAN_REAL, R_QINGHUAJIAO_REAL,
R_SHANGMA_HG_REAL, R_XIMAXIANG_REAL, R_XINBASHU_REAL, R_YONGHE_REAL,
R_YOUZIYOUWEI_REAL, R_YUJIUJING_REAL
```

These are NOT in `cretas_prod_db.factories` (75 rows: 56 FACTORY + 19 RESTAURANT). When a request comes in for one of these factory_ids:

1. `tenant.py:get_tenant_type` queries `factories WHERE id = $1`
2. Row missing → defaults to `TenantType.FACTORY` (defensive Java parity)
3. Dispatcher routes to `_factory_*_dispatch` → currently `NotImplementedError` → 500

Post Phase 2D PR-C/PR-D ship, these 14 IDs would route to **factory branch impl** even though they're conceptually restaurant chains. Result: factory production OEE charts would render for a restaurant data source — semantically wrong.

### 5.2 Option A — Bulk INSERT 14 R_*_REAL into `factories.type='RESTAURANT'` (Recommended)

```sql
-- One-time onboarding migration (cretas_prod_db, NOT smartbi_prod_db)
INSERT INTO factories (id, type, name, ...)
SELECT factory_id, 'RESTAURANT', chain_name_zh, ...
  FROM smartbi_prod_db.restaurant_chain_catalog  -- via dblink or cross-conn ETL
 WHERE source_kind = 'REAL'
   AND factory_id NOT IN (SELECT id FROM factories);
```

**Pros**:

- Smallest behavior change — restaurant Python branch (already LIVE per PR #352 + #358) handles these immediately
- Frontend dashboards stay coherent — restaurant URLs render restaurant envelopes
- Aligns with Sub-ETL-3 intent (seeded chains == real customers)

**Cons**:

- Requires cross-DB INSERT migration (cretas_prod_db side, not smartbi_prod_db) — different deploy script path
- Need to fill `name` / other required `factories` columns from `restaurant_chain_catalog` mapping
- If `factories` has UNIQUE constraint on alternative key (e.g., `name`), may collide

**Effort**: ~2-3h (1 migration + smoke).

### 5.3 Option B — Keep R_*_REAL as data-only IDs (don't onboard to factories)

Add fallback path in `tenant.py`: if factory_id not in `factories` AND prefix matches `R_*_REAL`, override default to `RESTAURANT`.

```python
async def get_tenant_type(factory_id: str, conn) -> TenantType:
    row = await conn.fetchrow("SELECT type FROM factories WHERE id = $1", factory_id)
    if row is not None:
        return TenantType.from_db_value(row["type"])
    # Phase 2D fallback: R_*_REAL data-only IDs from restaurant_chain_catalog
    if factory_id.startswith("R_") and factory_id.endswith("_REAL"):
        return TenantType.RESTAURANT
    return TenantType.FACTORY
```

**Pros**:

- No cross-DB migration
- Heuristic is local + reversible

**Cons**:

- Violates "authoritative tenant detection lives in `factories.type`" invariant (Sub-A §2.3 + Sub-B §2.3)
- New `tenant.py` regression-guard test required (locks the `_REAL` suffix heuristic)
- Sets precedent: future ETL-only IDs may multiply this kind of pattern

**Effort**: ~1h (1 code edit + 2 tests).

### 5.4 Option C — Delete `restaurant_chain_catalog` table

Remove the 14 R_*_REAL entirely; Sub-ETL-3 V20260511_02 seed becomes a no-op. Active restaurant tenants stay the 19 already in `factories`.

**Pros**:

- Eliminates the gap by removing the surface

**Cons**:

- Loses chain-name / cuisine metadata (currently used by `dim_store` joins per `2026-05-11-t6-6-etl-infra-design-spec.md §1.5`)
- Deprecates Sub-ETL-3 work — backwards motion
- Doesn't address future ETL-side ID drift

**Effort**: 1 migration + ETL pipeline rework. Not recommended.

### 5.5 Recommendation

**Option A (bulk INSERT)** — cleanest invariant preservation. Steve decides on PR comment of this spec. The migration impl is a separate chat dispatched after Steve's decision.

### 5.6 ✅ Steve sign-off 2026-05-11 — Option A selected

**Decision**: **Option A — bulk INSERT 14 R_*_REAL into `cretas_prod_db.factories` with `type='RESTAURANT'`.**

Implementation lands in this same PR (chat1 spec-amend-and-ship):

- Migration file: `backend/java/cretas-api/src/main/resources/db/migration-pg-converted/V2026_05_11_01__onboard_14_r_real_chains.sql`
- Targets `cretas_prod_db.factories` via Java Flyway (NOT `smartbi_prod_db` — that's a different runner). Migration applied at Spring Boot startup post-deploy.
- Idempotent via `ON CONFLICT (id) DO NOTHING` — safe to re-run.
- 14 chain names sourced from `smartbi_prod_db.restaurant_chain_catalog` (V20260511_02 seed). Names + factory_ids enumerated in §5.6.1 below.
- `is_active=true`, `manually_verified=false`, `ai_weekly_quota=1000`, `level=0`, `type='RESTAURANT'`. The `ai_weekly_quota=1000` is per Steve dispatch (higher than the entity default of 20 — these are real customer chains expected to query heavily).
- Tests: new `backend/python/tests/test_phase_2d_onboarding.py` locks SQL invariants (14 rows, RESTAURANT type, ON CONFLICT idempotency) + `tenant.py.from_db_value('RESTAURANT')` resolution.

#### 5.6.1 14 R_*_REAL roster (per V20260511_02 seed + Steve sign-off naming)

| factory_id | name |
|---|---|
| `R_DONGMENKOU_REAL` | 东门口 |
| `R_HONGDEJI_REAL` | 鸿德记 |
| `R_HUOGUO_GENERIC_REAL` | 火锅 (generic) |
| `R_ILTEATRO_REAL` | IL TEATRO 西餐 |
| `R_JINCHUAN_HG_REAL` | 锦川火锅 |
| `R_JINRINIUSHI_REAL` | 今日牛事 |
| `R_LINJIAYAN_REAL` | 邻家宴 |
| `R_QINGHUAJIAO_REAL` | 青花椒 |
| `R_SHANGMA_HG_REAL` | 上马火锅 |
| `R_XIMAXIANG_REAL` | 唏嘛香 牛肉面 |
| `R_XINBASHU_REAL` | 鑫巴蜀 |
| `R_YONGHE_REAL` | 永和豆浆 |
| `R_YOUZIYOUWEI_REAL` | 有滋有味 |
| `R_YUJIUJING_REAL` | 御九井 日料 |

Post-deploy expected behavior: tenant.py queries `factories WHERE id = $1`, finds row, returns `TenantType.RESTAURANT` → restaurant dispatcher (chat-A2 PR #352 + chat4 PR #358 LIVE impl). 14 chains stop 500ing.

Caveat: per §8 audit, these chains have ZERO ingested data in `fact_pos_*` / `restaurant_reviews` / `fact_restaurant_wastage`. They will return restaurant envelopes populated with `NO_POS_DATA_FOR_PERIOD` / `NO_REVIEW_DATA_FOR_CHAIN` / `WASTAGE_NOT_TRACKED` markers — semantically correct but UX shows "no data yet". Sub-ETL-2c data ingestion is a separate Steve action item (per §8 chat4 audit S2).

---

## 6. Active-E2E gate

Per HARD `feedback_active_e2e_replaces_passive_soak.md`. Per-stage in §4.5 cutover.

### 6.1 Active-E2E definition for Phase 2D

15-30 min smoke per cutover stage covering:

1. **Web-admin dashboard render** as `factory_super_admin` for target factory_id:
   - "生产分析" page → verify OEE/availability/performance/quality cards render (real numbers, not null)
   - "质量分析" page → verify FPY / defect / rework cards
2. **Endpoint smoke** (authenticated curl):
   - F999 production OEE / efficiency / equipment / overview (4 analysisType variants)
   - F999 quality FPY / defect / rework / overview (4 variants)
3. **Cross-tenant negative**:
   - 1 restaurant tenant request (R_ILTEATRO_REAL) → expect Python restaurant envelope (chat-A2 / chat4 impl)
   - 1 unknown factory_id → expect Python factory branch default (or restaurant if Option B fallback active)
4. **Edge cases**:
   - Empty date range
   - Date range with zero Silver-data rows
   - F999 mock data baseline match against Java mock (informational only — both are mocks)

### 6.2 Pass criteria

- 100% expected HTTP status (200 for valid; 401 missing auth; 404 unknown factory if app routes that way)
- Web-admin no blank panels / no console errors
- nginx access log shows Python upstream selected for factory tenants on `/analysis/(production|quality)`
- 0 user-visible regressions

---

## 7. Rollback plan

Mirror `2026-05-11-t6-6-cutover-spec.md §5` with Phase 2D adaptations.

### 7.1 Trigger conditions

Any one ⇒ immediate rollback:

| Metric | Threshold | Window |
|---|---|---|
| Python error rate (factory tenant routes only) | > 2% | 5 min |
| Python p99 latency | > 3000ms | 5 min |
| `NotImplementedError` reappears | any | any |
| Migration failure mid-rollout | runner abort | any |
| Active-E2E smoke fail | any | per stage |
| User-reported P1 from cascade pilot factory | severity ≥ P1 | any |

### 7.2 Rollback procedure

**Code rollback** (Python factory branch impl regression):

```bash
ssh root@47.100.235.168
cd /www/wwwroot/cretas
# 1) revert to last-known-good aims-X.jar (deploy script keeps 3 backups)
ls -la aims-0.0.1-SNAPSHOT.jar.bak.*
cp aims-0.0.1-SNAPSHOT.jar.bak.<pre-phase2d-timestamp> aims-0.0.1-SNAPSHOT.jar
# 2) Python code rollback via git checkout in deployed dir
cd code/backend/python && git log --oneline -5
git checkout <pre-phase2d-sha> -- smartbi_compat/api/analysis_production.py smartbi_compat/api/analysis_quality.py
# 3) systemctl restart
systemctl restart cretas-backend cretas-python
```

**Schema rollback** (Silver tables created but causing issues):

⚠️ **Do NOT DROP the Silver tables casually.** They're populated by Sub-ETL-factory backfill. Rollback path:

- Mark migration as bad in `smartbi_migrations` tracker via `UPDATE smartbi_migrations SET applied_by = 'BAD-rollback-YYYYMMDD' WHERE filename = 'V20260601_01__...'`
- Don't DROP; just let the Python branch fall back to mock by reverting code
- Tables stay queryable for next forward-fix attempt

**nginx rollback** (per-stage cascade):

Same as T6.6 §5.2 — vhost backup + reload, ~35s recovery.

### 7.3 Per-stage rollback granularity

T6.7 cascade has 3 sub-stages (canary → middle → full). Each commits a `vhost.bak.t6.7.<stage>` snapshot. Rollback to any prior sub-stage is `cp` + reload.

---

## 8. chat4 audit data evidence

⛔ **Placeholder — pending chat4 PR #367 `validate-factory-silver-schema.sql` execution against `smartbi_prod_db`.**

✅ **AMENDED 2026-05-11 from chat4 PR #372 prod audit** (`docs/qa-audits/2026-05-12-restaurant-data-readiness-prod-evidence.md`). Run on server 47 at 2026-05-12 04:46 UTC+8 against `smartbi_prod_db` + `cretas_prod_db`.

### 8.1 Production-side tables status (Section 1)

All 5 tables **MISSING**:

| Table | Status |
|---|---|
| `dim_equipment` | MISSING |
| `dim_production_line` | MISSING |
| `fact_equipment_event` | MISSING |
| `fact_production_batch` | MISSING |
| `fact_quality_inspection` | MISSING (shared with quality §8.2) |

### 8.2 Quality-side tables status (Section 2)

All 5 tables **MISSING**:

| Table | Status |
|---|---|
| `fact_customer_complaint` | MISSING |
| `fact_disposal_record` | MISSING |
| `fact_quality_defect` | MISSING |
| `fact_quality_inspection` | MISSING (shared) |
| `fact_rework_record` | MISSING |

### 8.3 Restaurant-side sanity check (Section 3)

All 9 restaurant tables **EXISTS** ✅: `dim_ingredient`, `dim_product`, `dim_store`, `fact_pos_item`, `fact_pos_transaction`, `fact_restaurant_requisition`, `fact_restaurant_wastage`, `restaurant_chain_catalog`, `restaurant_reviews`.

### 8.4 V20260511_03 `return_qty` column (Section 4)

✅ Column LIVE in prod:

```
column_name | data_type | is_nullable | column_default
return_qty  | numeric   | YES         | NULL::numeric
```

Migration applied. Blocker is upstream Sub-ETL-2c (does not populate column), not the column itself.

### 8.5 14 REAL chains roster (Section 5)

`SELECT source_kind, COUNT(*) FROM restaurant_chain_catalog GROUP BY source_kind`:

| source_kind | chain_count |
|---|---|
| REAL | **14** |

✅ V20260511_02 seed complete. All 14 chain names + cuisines + source_root_paths confirmed in chat4 audit JSON snapshot. Roster matches §5.6.1.

### 8.6 `cretas_prod_db.factories` tenant breakdown (Section 6)

`SELECT type, COUNT(*) FROM factories GROUP BY type ORDER BY type`:

| type | count |
|---|---|
| FACTORY | 56 |
| RESTAURANT | 19 |

**0 BRANCH rows** in current env. `tenant.py:TenantType.BRANCH` predicate path is dead code in prod today (still safe to keep — Sub-A spec §2.2 + Sub-B spec §2.2 leave the door open for future BRANCH tenants).

Post-Phase-2D-amend (this PR ships §5 Option A migration):

| type | count (expected) |
|---|---|
| FACTORY | 56 |
| RESTAURANT | **33** (19 existing + 14 new R_*_REAL) |

### 8.7 Migration sizing impact

All 9 factory Silver tables MISSING → **PR-A migration scope is the full 9-table creation** (no scope reduction). Confirms §2.4 V20260601_01 + V20260601_02 + V20260601_03 file plan.

### 8.8 Restaurant data readiness (extra context from chat4 audit §3)

19 existing RESTAURANT tenants currently have very thin data:

| Metric | Count | Notes |
|---|---|---|
| N2 (reviews) READY | **0 / 19** | `restaurant_reviews` table empty across all tenants |
| N3 (returns) READY | **0 / 19** | `fact_pos_item.return_qty` is 0 for all rows |
| N4 (wastage) READY | **2 / 19** | Only F002 + R_XMX_CHAIN have non-trivial wastage data |
| Overall PARTIAL | 2 | F002, R_XMX_CHAIN (N4 only) |
| Overall EMPTY | 17 | All others |

**Implication for §5 Option A onboarding**: the 14 new R_*_REAL chains will route to restaurant Python branch correctly (post-migration), but will return all-null envelopes with `NO_POS_DATA_FOR_PERIOD` / `NO_REVIEW_DATA_FOR_CHAIN` / `WASTAGE_NOT_TRACKED` markers — same as the 17 EMPTY existing tenants. This is **expected** post-onboard behavior; data layer fix is Sub-ETL-2c scope (chat4 audit §5.1 S2 for Steve).

---

## 9. Sign-off checklist for Steve

### 9.1 Pre-dispatch decisions

- [x] **§5 R_*_REAL onboarding option chosen**: ✅ **Option A** (bulk INSERT) — Steve sign-off 2026-05-11 (this PR ships the migration in §5.6)
- [x] §8 chat4 audit ran + spec amended — chat4 PR #372 prod audit data captured in §8.1-§8.8 above
- [x] §4.5 T6.7/T6.8 sequencing chosen: ✅ **Sequential T6.7 → T6.8** — Steve sign-off 2026-05-11 (see §4.5 rationale)
- [ ] PR-A migration column-level schema reviewed against Java entity references (`ProductionBatch.java`, `FactoryEquipment.java`, `DisposalRecord.java`, etc.)
- [ ] PR-B Sub-ETL-factory ingest plan reviewed — cross-DB read pattern + idempotent upsert key per table

### 9.2 Per-PR

- [ ] PR-A: 9 tables created in `smartbi_prod_db` + tracker rows present
- [ ] PR-B: 56 factory tenants backfilled `[2024-01-01, today)` window; row count spot-check
- [ ] PR-C: 8 production goldens recorded + parity ≥99.5%
- [ ] PR-D: 8 quality goldens recorded + parity ≥99.5%
- [ ] PR-E: T6.7 + T6.8 cascade complete, active-E2E pass per stage

### 9.3 Phase 2D close

- [ ] Python factory branch handles all 56 F-numeric factory tenants + 14 R_*_REAL (per Option A) without 500
- [ ] Java `ProductionAnalysisServiceImpl` + `QualityAnalysisServiceImpl` marked `@Deprecated` (factory tenant Python path now canonical)
- [ ] nginx Java fallback rate trending to 0 for `/analysis/(production|quality)` (per T6.7.4 deprecation header observation)

---

## 10. ⛔ HOLD blocks

- ⛔ **This is a doc-only design spec.** Zero migration apply, zero DB writes, zero Python code edits, zero nginx mutation, zero deploy.
- ⛔ **§8 chat4 audit data is placeholder.** Spec amendment via follow-up PR mandatory before PR-A migration impl dispatch.
- ⛔ **§5 14 R_*_REAL onboarding decision is Steve's.** Implementer chat acts on PR comment selection, not unilateral choice.
- ⛔ **PR-A migration MUST go through `apply-smartbi-migrations.sh` runner** per HARD `server-operations.md` ⛔ Smartbi 数据库 schema 变更. No manual `psql -f`.
- ⛔ **Sub-ETL-factory backfill (PR-B) runs against `cretas_prod_db` read-only.** If write access leaks into the impl, fail PR review.
- ⛔ **Factory branch Python impl (PR-C / PR-D) must record F999 + F001 goldens BEFORE writing literal dicts** per Rule 8 + Rule 9. No "looks right per Java source" shortcuts.
- ⛔ **STOP-and-ping organizer BEFORE pushing this spec** per HARD `feedback_pause_before_deploy_or_push.md`.

---

## 11. Cross-references

| Doc | Path | Relation |
|---|---|---|
| Sub-A impl spec | `docs/superpowers/specs/2026-05-12-t6-6-sub-a-production-impl-spec.md` (PR #345) | §2.1 production method surface + §2.3 Silver schema gap rationale |
| Sub-B impl spec | `docs/superpowers/specs/2026-05-12-t6-6-sub-b-quality-impl-spec.md` (PR #346) | §2.1 quality method surface + §2.3 Silver schema gap rationale |
| Q4/Q5 module shape | `docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md` (PR #337) | tenant.py shared module + restaurant envelope contract (already LIVE) |
| Q1 real-DB amendment | `docs/superpowers/specs/2026-05-09-t6-6-q1-real-db-amendment.md` | Q1 §1 amendment (drop _JavaRandom) + §4.3 factory_id roster |
| T6 nginx cutover design | `docs/superpowers/specs/2026-05-02-phase2a-t6-nginx-cutover-design.md` | nginx upstream pattern + rollback procedure |
| T6.6 cutover spec | `docs/superpowers/specs/2026-05-11-t6-6-cutover-spec.md` (PR #366) | Phase 2B cascade pattern — Phase 2D T6.7/T6.8 mirrors this |
| ETL infra design | `docs/superpowers/specs/2026-05-11-t6-6-etl-infra-design-spec.md` | Sub-ETL pipeline conventions + restaurant_chain_catalog schema |
| Restaurant Silver migration | `backend/python/smartbi/database/migrations/2026_04_29_silver_facts.sql` | Schema convention reference (BIGSERIAL / RLS / FK / index pattern) |
| chat4 audit script | `scripts/etl/validate-factory-silver-schema.sql` (PR #367) | §8 placeholder source |
| Python factory branch stubs | `backend/python/smartbi_compat/api/analysis_production.py` (PR #350 + #352) + `analysis_quality.py` (PR #354 + #358) | §3 replacement target |
| Java side keeps mock | `backend/java/cretas-api/src/main/java/com/cretas/aims/service/smartbi/impl/{ProductionAnalysisServiceImpl,QualityAnalysisServiceImpl}.java` | Reference for column types in §2.2; @Deprecated post-T6.7.4/T6.8.4 |
| Tenant detection | `backend/python/smartbi_compat/tenant.py` (PR #350 + #368 P0 fix) | §5 Option B fallback site (if chosen) |
| python-java-port.md | `.claude/rules/python-java-port.md` | §3.5 Rule 1-12 compliance source |
| Smartbi migration HARD RULE | `.claude/rules/server-operations.md` ⛔ Smartbi 数据库 schema 变更 | §2.4 deploy path enforcement |
| Active-E2E HARD | memory `feedback_active_e2e_replaces_passive_soak.md` | §6 rationale |
| Pause-before-push HARD | memory `feedback_pause_before_deploy_or_push.md` | §9 sign-off gate |
| Concurrent-edit safety | `.claude/rules/concurrent-edit-safety.md` | Commit-time scope guard for Phase 2D impl chats |
| 14 R_*_REAL seed | `backend/python/smartbi/database/migrations/V20260511_02__t6_6_seed_14_real_chains.sql` (Sub-ETL-3) | §5 onboarding gap source |
| P0 tenant.py fix | PR #368 (chat1) | §5 Option B impl site (if chosen) |

---

## 12. Predecessor chain

- T6.1-T6.4 (Phase 2A 50 endpoints Java→Python cutover) — LIVE
- T6.5 Phase A/B/C — Java-side dead code sweep — LIVE
- T6.6 Phase B — restaurant tenant /analysis/(production|quality) Python — LIVE per PR #350/#352/#354/#358/#360/#368
- T6.6 cutover spec — PR #366 — Phase 2B cutover plan
- chat4 validate-factory-silver-schema.sql + restaurant N1-N4 audit — PR #367
- chat1 tenant.py P0 — PR #368
- **This spec** — chat1 Phase 2D Silver migration + factory branch impl design

Downstream:

- PR-A Silver migration (Phase 2D-1) — TBD
- PR-B Sub-ETL-factory ingest (Phase 2D-2) — TBD
- PR-C Factory production impl (Phase 2D-3) — TBD
- PR-D Factory quality impl (Phase 2D-4) — TBD
- PR-E T6.7 + T6.8 cutover (Phase 2D-5) — TBD

---

**End of Phase 2D Spec — Silver Schema Migration + Factory Branch Impl Outline.**

*Author: chat1 (Phase 2D design spec dispatch, 2026-05-11 post Phase 2B closure + P0 tenant.py fix).*
*Per HARD `feedback_pause_before_deploy_or_push.md` + `feedback_organizer_verbal_signoff_must_amend_spec.md`: STOP-and-ping organizer BEFORE push.*
