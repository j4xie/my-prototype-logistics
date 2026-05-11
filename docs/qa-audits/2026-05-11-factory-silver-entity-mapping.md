# Phase 2D Factory Silver Schema — Java Entity Mapping Deep Dive

**Date**: 2026-05-12
**Author**: chat4 (Phase 2D Silver schema entity deep-dive — Task B follow-up to PR #372)
**Purpose**: Hand chat1's Phase 2D migration spec (`V_factory_production_silver` + `V_factory_quality_silver`) the concrete column types, indexes, RLS pattern, and Java entity source-of-truth for each of the **10 missing Silver tables** identified by the [2026-05-12 prod audit](2026-05-12-restaurant-data-readiness-prod-evidence.md).
**Status**: 🟡 AMBER — 5 of 10 tables have direct Java entity sources of truth; 3 of 10 derive shape from `QualityAnalysisServiceImpl` mock (no Java entity exists yet); 2 of 10 are equipment-event composites with no canonical Java source.

---

## 0. TL;DR

The 10 factory-tenant Silver tables missing from `smartbi_prod_db` split into three classes:

| Class | Tables | Source for migration shape |
|---|---|---|
| **A. Direct Java entity** (5 tables) | `factory_equipment`, `production_lines`, `production_batches`, `quality_inspections`, `disposal_records`, `rework_records` (yes, 6 — `disposal_records` + `rework_records` are 2 of the 5 quality tables) | Read `@Column` annotations on the Java entity; mirror types verbatim. |
| **B. Mock-only fact** (3 tables) | `fact_customer_complaint`, `fact_quality_defect`, `fact_equipment_event` | Derive columns from `QualityAnalysisServiceImpl` / `ProductionAnalysisServiceImpl` mock-data fields (`d.get("defectCount")`, `d.get("equipment_event_type")` etc.). |
| **C. Canonical Silver pattern** (all 10) | All — RLS, triggers, soft-delete, indexes | Mirror `2026_04_24_silver_restaurant_ops.sql` (FORCE ROW LEVEL SECURITY + `app.factory_id` policy + `silver_touch_updated_at()` BEFORE UPDATE trigger). |

§1 lists every Java entity mapping. §2 lists mock-only tables with derived schemas. §3 gives the canonical RLS pattern. §4 is the migration skeleton chat1 should paste into the spec.

---

## 1. Class A — direct Java entity mapping

### 1.1 `factory_equipment` (Silver name: `dim_equipment`)

**Java entity**: [`FactoryEquipment.java`](../../backend/java/cretas-api/src/main/java/com/cretas/aims/entity/FactoryEquipment.java)
**Java table name**: `factory_equipment` (existing cretas_db table)
**Silver target table**: `dim_equipment` (rename in Silver for analytical-vocab consistency with `dim_store`/`dim_product`)
**Grain**: 1 row per equipment unit per factory
**Java PK**: `id BIGINT IDENTITY` (changed from String UUID to Long in 2025-12-22 per Javadoc — JOIN perf)

| Column | Type (Java) | Type (PostgreSQL Silver) | Nullable | Notes |
|---|---|---|---|---|
| `id`                            | `Long`           | `BIGSERIAL PRIMARY KEY` | NO  | Java IDENTITY |
| `factory_id`                    | `String`         | `VARCHAR(50)`           | NO  | tenant scope |
| `code`                          | `String(50)`     | `VARCHAR(50)`           | NO  | factory-scoped code |
| `equipment_code`                | `String(50)`     | `VARCHAR(50)`           | NO  | machine code |
| `equipment_name`                | `String(191)`    | `VARCHAR(191)`          | NO  | display name |
| `type`                          | `String(50)`     | `VARCHAR(50)`           | YES | category |
| `model`                         | `String(100)`    | `VARCHAR(100)`          | YES | manufacturer model |
| `manufacturer`                  | `String(100)`    | `VARCHAR(100)`          | YES | OEM |
| `purchase_date`                 | `LocalDate`      | `DATE`                  | YES | |
| `purchase_price`                | `BigDecimal(12,2)` | `NUMERIC(12,2)`       | YES | |
| `depreciation_years`            | `Integer`        | `INT`                   | YES | |
| `hourly_cost`                   | `BigDecimal(10,2)` | `NUMERIC(10,2)`       | YES | for OEE cost calc |
| `power_consumption_kw`          | `BigDecimal(10,2)` | `NUMERIC(10,2)`       | YES | |
| `status`                        | `String(20)`     | `VARCHAR(20)` DEFAULT `'idle'` | NO | `idle/running/maintenance/scrapped` |
| `location`                      | `String(100)`    | `VARCHAR(100)`          | YES | |
| `total_running_hours`           | `Integer`        | `INT` DEFAULT 0         | NO  | OEE input |
| `maintenance_interval_hours`    | `Integer`        | `INT`                   | YES | |
| `last_maintenance_date`         | `LocalDate`      | `DATE`                  | YES | |
| `next_maintenance_date`         | `LocalDate`      | `DATE`                  | YES | |
| `warranty_expiry_date`          | `LocalDate`      | `DATE`                  | YES | |
| `serial_number`                 | `String(100)`    | `VARCHAR(100)`          | YES | |
| `created_by`                    | `Long`           | `BIGINT`                | NO  | user_id |
| `operator_id`                   | `Long`           | `BIGINT`                | YES | currently-assigned operator |
| `notes`                         | `String` (TEXT)  | `TEXT`                  | YES | |
| `created_at` / `updated_at` / `deleted_at` | from BaseEntity | `TIMESTAMP DEFAULT NOW() / NULL` | NO/NO/YES | audit fields per BaseEntity contract |

**Unique constraint**: `UNIQUE (factory_id, code)` — verbatim from Java `@UniqueConstraint`.

**Indexes** (verbatim from Java `@Index`):
- `idx_equipment_factory` ON `(factory_id)`
- `idx_equipment_status` ON `(status)`

**ETL source for Silver**: `cretas_db.factory_equipment` (1:1 mirror via deltas).

**Sub-A spec §2.3 mapping notes**:
- Mock `equipmentId` → `id` (Long)
- Mock `equipmentName` → `equipment_name`
- Sub-A spec mentions `dim_equipment` but doesn't fix the column list — this doc fills that gap.

---

### 1.2 `production_lines` (Silver name: `dim_production_line`)

**Java entity**: [`ProductionLine.java`](../../backend/java/cretas-api/src/main/java/com/cretas/aims/entity/ProductionLine.java)
**Java table name**: `production_lines`
**Silver target**: `dim_production_line`
**Java PK**: `id VARCHAR(36)` (UUID, set by `@PrePersist`)

| Column | Type (Java) | Type (PostgreSQL Silver) | Nullable | Notes |
|---|---|---|---|---|
| `id`                       | `String(36)`       | `VARCHAR(36) PRIMARY KEY` | NO  | UUID |
| `factory_id`               | `String(50)`       | `VARCHAR(50)`             | NO  | |
| `department_id`            | `Long`             | `BIGINT`                  | YES | dept ownership |
| `name`                     | `String(100)`      | `VARCHAR(100)`            | NO  | |
| `line_code`                | `String(50)`       | `VARCHAR(50)`             | YES | factory-internal code |
| `line_type`                | `String(50)`       | `VARCHAR(50)`             | YES | `processing/packaging/quality_check` |
| `min_workers`              | `Integer`          | `INT` DEFAULT 1           | YES | |
| `max_workers`              | `Integer`          | `INT` DEFAULT 10          | YES | |
| `required_skill_level`     | `Integer`          | `INT` DEFAULT 1           | YES | 1-5 |
| `hourly_capacity`          | `BigDecimal(10,2)` | `NUMERIC(10,2)`           | YES | units/hour |
| `equipment_ids`            | `String` (TEXT)    | `TEXT`                    | YES | comma-separated Long IDs (legacy; consider `BIGINT[]` in Silver) |
| `status`                   | `enum (20)`        | `VARCHAR(20)` DEFAULT `'active'` | YES | `active/maintenance/inactive` |
| `efficiency_factor`        | `BigDecimal(5,4)`  | `NUMERIC(5,4)` DEFAULT 1.0000 | YES | base factor |
| `rolling_efficiency`       | `BigDecimal(5,4)`  | `NUMERIC(5,4)` DEFAULT 1.0000 | YES | EMA over recent runs |
| `created_at` / `updated_at` / `deleted_at` | BaseEntity | per BaseEntity | per BaseEntity | |

**ETL source**: `cretas_db.production_lines` delta replication.

**Silver-side consideration**: convert `equipment_ids TEXT` to `BIGINT[]` in PostgreSQL during ETL — analytics joins become trivial.

---

### 1.3 `production_batches` (Silver name: `fact_production_batch`)

**Java entity**: [`ProductionBatch.java`](../../backend/java/cretas-api/src/main/java/com/cretas/aims/entity/ProductionBatch.java)
**Java table name**: `production_batches`
**Silver target**: `fact_production_batch`
**Java PK**: `id BIGINT IDENTITY`

| Column | Type (Java) | Type (PostgreSQL Silver) | Nullable | Notes |
|---|---|---|---|---|
| `id`                  | `Long`              | `BIGSERIAL PRIMARY KEY` | NO  | |
| `factory_id`          | `String(50)`        | `VARCHAR(50)`           | NO  | |
| `batch_number`        | `String(50)`        | `VARCHAR(50)` UNIQUE    | NO  | natural key |
| `production_plan_id`  | `String(191)`       | `VARCHAR(191)`          | YES | FK ProductionPlan |
| `product_type_id`     | `String(100)`       | `VARCHAR(100)`          | NO  | FK ProductType (String PK!) |
| `product_name`        | `String(100)`       | `VARCHAR(100)`          | YES | denorm for queries |
| `planned_quantity`    | `BigDecimal(12,2)`  | `NUMERIC(12,2)`         | YES | input to OEE |
| `quantity`            | `BigDecimal(10,2)`  | `NUMERIC(10,2)`         | NO  | "data NOT NULL" — Java legacy field, distinct from planned |
| `unit`                | `String(20)`        | `VARCHAR(20)`           | NO  | |
| `actual_quantity`     | `BigDecimal(12,2)`  | `NUMERIC(12,2)`         | YES | OEE Performance numerator |
| `good_quantity`       | `BigDecimal(12,2)`  | `NUMERIC(12,2)`         | YES | OEE Quality numerator |
| `defect_quantity`     | `BigDecimal(12,2)`  | `NUMERIC(12,2)`         | YES | |
| `status`              | enum(20)            | `VARCHAR(20)`           | NO  | `PLANNED/IN_PROGRESS/PAUSED/COMPLETED/CANCELLED` |
| `quality_status`      | enum                | `VARCHAR(40)`           | YES | `PENDING_INSPECTION/INSPECTING/PASSED/FAILED/PARTIAL_PASS/REWORK_REQUIRED/...` |
| (additional fields — read full entity for: start_time / end_time / supervisor_id / line_id / equipment_id / custom_fields jsonb / etc.) | — | — | — | Read entity past line 120 |
| `created_at` / `updated_at` / `deleted_at` | BaseEntity | — | — | |

**Indexes** (verbatim):
- `idx_batch_factory` ON `(factory_id)`
- `idx_batch_number` ON `(batch_number)`
- `idx_batch_status` ON `(status)`
- `idx_batch_plan` ON `(production_plan_id)`

**ETL source**: `cretas_db.production_batches` delta.

**OEE derivation in Silver**:
- `availability = (actual_runtime / planned_runtime)` — both come from BatchWorkSession or fact_equipment_event aggregate, NOT from this fact directly
- `performance = (actual_quantity / planned_quantity)` × time factor
- `quality = (good_quantity / actual_quantity)`

Chat-A1 fill-in (Phase 2D) should add derived columns or do these as CTEs at query time per `_factory_production_dispatch` implementation.

---

### 1.4 `quality_inspections` (Silver name: `fact_quality_inspection`)

**Java entity**: [`QualityInspection.java`](../../backend/java/cretas-api/src/main/java/com/cretas/aims/entity/QualityInspection.java)
**Java table name**: `quality_inspections`
**Silver target**: `fact_quality_inspection` (shared by both production AND quality endpoints — appears in both spec §2.3 lists)
**Java PK**: `id VARCHAR(191)`

| Column | Type (Java) | Type (PostgreSQL Silver) | Nullable | Notes |
|---|---|---|---|---|
| `id`                    | `String(191)`     | `VARCHAR(191) PRIMARY KEY` | NO  | |
| `factory_id`            | `String`          | `VARCHAR(50)`              | NO  | (Java omits explicit length — verify) |
| `production_batch_id`   | `Long`            | `BIGINT`                   | NO  | FK production_batches.id |
| `inspector_id`          | `Long`            | `BIGINT`                   | NO  | FK users.id |
| `inspection_date`       | `LocalDate`       | `DATE`                     | NO  | |
| `sample_size`           | `BigDecimal(10,2)` | `NUMERIC(10,2)`           | NO  | |
| `pass_count`            | `BigDecimal(10,2)` | `NUMERIC(10,2)`           | NO  | |
| `fail_count`            | `BigDecimal(10,2)` | `NUMERIC(10,2)`           | NO  | |
| `pass_rate`             | `BigDecimal(5,2)` | `NUMERIC(5,2)`             | YES | denorm = pass_count/sample_size×100; can also compute |
| `result`                | `String(20)`      | `VARCHAR(20)`              | YES | `PASS/FAIL/CONDITIONAL` |
| `notes`                 | `String` (TEXT)   | `TEXT`                     | YES | |
| `custom_fields`         | `Map<String,Object>` (jsonb) | `JSONB`         | YES | denormalized defect detail (see §2.2) |
| `created_at` / `updated_at` / `deleted_at` | BaseEntity | per BaseEntity | — | |

**Derived metric**: `defect_rate = fail_count / sample_size × 100` — used by `_factory_quality_dispatch` per Sub-B spec §2.2 Rule 10 chain.

**Critical**: `production_batch_id` is `BIGINT` here but `production_batches.id` is also BIGINT — FK works. But Java production_batch reference uses `String` PK `id` in some places — verify FK target type matches.

---

### 1.5 `rework_records` (Silver name: `fact_rework_record`)

**Java entity**: [`ReworkRecord.java`](../../backend/java/cretas-api/src/main/java/com/cretas/aims/entity/ReworkRecord.java)
**Java table name**: `rework_records`
**Silver target**: `fact_rework_record`
**Java PK**: `id BIGINT IDENTITY`

| Column | Type (Java) | Type (PostgreSQL Silver) | Nullable | Notes |
|---|---|---|---|---|
| `id`                       | `Long`              | `BIGSERIAL PRIMARY KEY` | NO  | |
| `factory_id`               | `String(50)`        | `VARCHAR(50)`           | NO  | |
| `quality_inspection_id`    | `String(191)`       | `VARCHAR(191)`          | YES | FK quality_inspections.id (mixed-type FK!) |
| `production_batch_id`      | `String`            | `VARCHAR(191)`          | YES | (Java field is `String` not Long — verify against ProductionBatch.id type) |
| `material_batch_id`        | `String(191)`       | `VARCHAR(191)`          | YES | FK material_batches |
| `rework_quantity`          | `BigDecimal(12,2)`  | `NUMERIC(12,2)`         | NO  | |
| `rework_type`              | enum(30)            | `VARCHAR(30)`           | NO  | |
| (additional: status / start_time / end_time / supervisor_id / cost / outcome / etc. — read full entity past line 80) | — | — | — | |
| `created_at` / `updated_at` / `deleted_at` | BaseEntity | — | — | |

**Indexes** (verbatim):
- `idx_rework_factory` ON `(factory_id)`
- `idx_rework_status` ON `(status)`
- `idx_rework_quality` ON `(quality_inspection_id)`
- `idx_rework_batch` ON `(production_batch_id)`
- `idx_rework_material` ON `(material_batch_id)`
- `idx_rework_date` ON `(start_time)`

⚠️ **Java naming inconsistency**: `production_batch_id` is `String` in ReworkRecord but `Long` in QualityInspection (Lines 42-43 of QualityInspection). Both reference the same `production_batches.id` which is `BIGINT`. Java has a latent type-coercion bug here — chat1 should pick one type (recommend BIGINT) for the Silver schema and rely on ETL to cast.

---

### 1.6 `disposal_records` (Silver name: `fact_disposal_record`)

**Java entity**: [`DisposalRecord.java`](../../backend/java/cretas-api/src/main/java/com/cretas/aims/entity/DisposalRecord.java)
**Java table name**: `disposal_records`
**Silver target**: `fact_disposal_record`
**Java PK**: `id BIGINT IDENTITY`

| Column | Type (Java) | Type (PostgreSQL Silver) | Nullable | Notes |
|---|---|---|---|---|
| `id`                       | `Long`              | `BIGSERIAL PRIMARY KEY` | NO  | |
| `factory_id`               | `String(50)`        | `VARCHAR(50)`           | NO  | |
| `quality_inspection_id`    | `String(191)`       | `VARCHAR(191)`          | YES | optional FK |
| `rework_record_id`         | `Long`              | `BIGINT`                | YES | optional FK |
| `production_batch_id`      | `String`            | `VARCHAR(191)`          | YES | same caveat as ReworkRecord |
| `material_batch_id`        | `String(191)`       | `VARCHAR(191)`          | YES | |
| `disposal_quantity`        | `BigDecimal(12,2)`  | `NUMERIC(12,2)`         | NO  | |
| `disposal_type`            | `String`            | `VARCHAR(30)`           | NO  | `SCRAP/RECYCLE/...` |
| (additional: disposal_date / disposal_reason / cost / approver_id / approved_at / etc.) | — | — | — | |
| `created_at` / `updated_at` / `deleted_at` | BaseEntity | — | — | |

**Indexes** (verbatim):
- `idx_disposal_factory` ON `(factory_id)`
- `idx_disposal_type` ON `(disposal_type)`
- `idx_disposal_date` ON `(disposal_date)`
- `idx_disposal_quality` ON `(quality_inspection_id)`
- `idx_disposal_rework` ON `(rework_record_id)`

---

## 2. Class B — mock-only fact tables (no Java entity)

These tables don't have a Java entity in `entity/`. Their column shape is implicit in `QualityAnalysisServiceImpl` mock data (`d.get("defectCount")`, etc.). chat1's migration spec needs to **invent** the column list per the mock fields + future analytics needs.

### 2.1 `fact_customer_complaint`

**Source of shape**: Sub-B spec §2.3 line "complaintCount → `fact_customer_complaint.complaint_count`"

No Java entity exists. `QualityAnalysisServiceImpl` references complaint count as a simple aggregate. Recommended Silver schema:

```sql
CREATE TABLE fact_customer_complaint (
    id                   BIGSERIAL PRIMARY KEY,
    factory_id           VARCHAR(50) NOT NULL,
    complaint_date       DATE NOT NULL,
    complaint_type       VARCHAR(50),         -- TASTE / TEMPERATURE / FOREIGN_OBJECT / DELAY / OTHER
    severity             VARCHAR(20),         -- LOW / MEDIUM / HIGH / CRITICAL
    production_batch_id  VARCHAR(191),        -- traceability hook (nullable)
    product_id           BIGINT,              -- FK dim_product
    description          TEXT,
    customer_id          VARCHAR(100),        -- denormalized (no FK to multi-tenant customer registry)
    resolution           TEXT,
    resolved_at          TIMESTAMP,
    resolution_cost      NUMERIC(12, 2),
    source_pk            VARCHAR(191),        -- ETL provenance from cretas_db (TBD source)
    created_at           TIMESTAMP DEFAULT NOW(),
    updated_at           TIMESTAMP DEFAULT NOW(),
    deleted_at           TIMESTAMP
);
```

**Indexes**: `(factory_id, complaint_date)`, `(factory_id, severity)`, `(factory_id, product_id)`.

**ETL source TBD**: There's no `cretas_db.customer_complaints` table today. Either (a) add a new transactional table in cretas_db and ETL deltas, OR (b) keep this Silver table populated by a future workflow that ingests from a customer-service queue. **Chat1 should escalate this gap to organizer** — Sub-B spec §2.3 marks the column "TBD" too.

### 2.2 `fact_quality_defect`

**Source of shape**: `QualityAnalysisServiceImpl.java:166-173` — defects-by-type aggregation reads `d.get("defectType")` and `d.get("defectCount")` from quality data rows. Defects are denormalized inside `quality_inspections.custom_fields` JSONB today.

**Recommendation**: Either keep defect data denormalized in `fact_quality_inspection.custom_fields` (simpler, no new table) OR explode into a dedicated table for Pareto/ranking queries (better for analytics; current Sub-B Pareto computation iterates a Map.entrySet which means it expects exploded rows).

If exploded:

```sql
CREATE TABLE fact_quality_defect (
    id                       BIGSERIAL PRIMARY KEY,
    factory_id               VARCHAR(50) NOT NULL,
    quality_inspection_id    VARCHAR(191) NOT NULL,   -- FK fact_quality_inspection
    defect_type              VARCHAR(100) NOT NULL,   -- 异物 / 缺陷 / 包装破损 / 标签错误 / 重量不符 / ...
    defect_count             INT NOT NULL,            -- count within this inspection
    severity                 VARCHAR(20),             -- mirror complaint severity
    root_cause               VARCHAR(100),            -- 5-Why / Ishikawa category
    corrective_action        TEXT,
    inspection_date          DATE NOT NULL,           -- denormalized from inspection for index efficiency
    production_batch_id      BIGINT,                  -- denormalized
    source_pk                VARCHAR(191),
    created_at               TIMESTAMP DEFAULT NOW(),
    updated_at               TIMESTAMP DEFAULT NOW(),
    deleted_at               TIMESTAMP
);
```

**Indexes**: `(factory_id, defect_type)` (for Pareto), `(factory_id, inspection_date)`, `(quality_inspection_id)`.

**ETL source**: Either (a) the JSONB `custom_fields` of `quality_inspections` (parse + explode), OR (b) extend the Java entity to add a `@OneToMany List<QualityDefect>` relationship. **Chat1 + organizer should decide**.

### 2.3 `fact_equipment_event`

**Source of shape**: Sub-A spec §2.3 lines "`downtime` → `fact_equipment_event.downtime_minutes`", "`downtimeReason` → `downtime_reason`", "`failureCount` → `failure_count`". No Java entity exists. Closest analogs: `EquipmentAlert` (alert events) + `EquipmentMaintenance` (planned maintenance).

```sql
CREATE TABLE fact_equipment_event (
    id                  BIGSERIAL PRIMARY KEY,
    factory_id          VARCHAR(50) NOT NULL,
    equipment_id        BIGINT NOT NULL,             -- FK dim_equipment
    event_date           DATE NOT NULL,
    event_time           TIMESTAMP NOT NULL,
    event_type           VARCHAR(30) NOT NULL,       -- FAILURE / SETUP / CHANGEOVER / SCHEDULED_MAINT / UNSCHEDULED_STOP
    downtime_minutes     INT,                         -- 0 if event was non-blocking
    downtime_reason      VARCHAR(100),                -- 设备故障 / 人员操作失误 / 物料不足 / ...
    affected_batch_id    BIGINT,                      -- which production_batch was running
    affected_line_id     VARCHAR(36),                 -- which production_line
    failure_count        INT DEFAULT 0,               -- discrete failure events (often 1)
    operator_id          BIGINT,
    notes                TEXT,
    source_pk            VARCHAR(191),                -- ETL: equipment_alerts.id OR equipment_maintenance.id OR new event log
    source_kind          VARCHAR(20),                 -- ALERT / MAINTENANCE / MANUAL / IOT
    created_at           TIMESTAMP DEFAULT NOW(),
    updated_at           TIMESTAMP DEFAULT NOW(),
    deleted_at           TIMESTAMP
);
```

**Indexes**: `(factory_id, event_date)`, `(factory_id, equipment_id, event_time)`, `(factory_id, event_type)`.

**ETL source**: Union of `cretas_db.equipment_alerts` (alert events) + `cretas_db.equipment_maintenance` (planned events) + IoT device logs (if any). `source_kind` discriminates. **Chat1 should design the ETL union** — restaurant Silver migration `2026_04_24_silver_restaurant_ops.sql` doesn't have a precedent for unioning multiple source tables, but the pattern is clean enough.

---

## 3. Class C — canonical Silver pattern (apply to ALL 10 tables)

All Silver tables follow the same pattern from `2026_04_24_silver_restaurant_ops.sql`. Apply verbatim to each new factory Silver table:

### 3.1 RLS — `FORCE ROW LEVEL SECURITY`

```sql
ALTER TABLE <table_name> ENABLE  ROW LEVEL SECURITY;
ALTER TABLE <table_name> FORCE   ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON <table_name>;
CREATE POLICY tenant_isolation ON <table_name> FOR ALL
    USING (factory_id = current_setting('app.factory_id', true))
    WITH CHECK (factory_id = current_setting('app.factory_id', true));
```

`FORCE` is critical — without it, the table owner bypasses RLS and audit scripts cross-tenant leak. Restaurant tables all use FORCE; factory must match.

### 3.2 Soft-delete + `updated_at` trigger

Reuse the existing function `silver_touch_updated_at()` defined in `2026_04_28_silver_dimensions.sql`. Every Silver table gets:

```sql
DROP TRIGGER IF EXISTS trg_<table>_touch ON <table_name>;
CREATE TRIGGER trg_<table>_touch BEFORE UPDATE ON <table_name>
    FOR EACH ROW EXECUTE FUNCTION silver_touch_updated_at();
```

### 3.3 Audit columns (every table)

```sql
created_at  TIMESTAMP DEFAULT NOW(),
updated_at  TIMESTAMP DEFAULT NOW(),
deleted_at  TIMESTAMP
```

BaseEntity contract — mandatory because Hibernate `@Where(clause = "deleted_at IS NULL")` is on every subclass. Silver queries should also filter `WHERE deleted_at IS NULL` (mirror Java semantics) OR omit the column entirely if Silver is ingest-only / no soft-delete needed for analytics. **Recommend keeping the column** for consistency with restaurant Silver tables.

### 3.4 Naming convention

Java table → Silver target:

| Java | Silver |
|---|---|
| `factory_equipment` | `dim_equipment` |
| `production_lines` | `dim_production_line` |
| `production_batches` | `fact_production_batch` |
| `quality_inspections` | `fact_quality_inspection` |
| `rework_records` | `fact_rework_record` |
| `disposal_records` | `fact_disposal_record` |
| (no Java) | `fact_customer_complaint` |
| (no Java) | `fact_quality_defect` |
| (no Java) | `fact_equipment_event` |

The `dim_` prefix is for reference data (slowly-changing dimensions); `fact_` is for event streams (grain = 1 row per event/period). This matches restaurant Silver vocabulary (`dim_store` / `dim_product` / `dim_ingredient` vs `fact_pos_*` / `fact_restaurant_*`).

### 3.5 ETL pattern (Sub-ETL-* extension)

Each Silver table needs a Sub-ETL handler. Mirror `2026_04_24_silver_restaurant_ops.sql` design notes:
- `source_pk` column tracks origin `cretas_db.<table>.id` for reconcile
- ETL job uses `UPSERT ON CONFLICT (factory_id, source_pk) DO UPDATE` for idempotency
- `UNIQUE (factory_id, source_pk)` constraint enforces 1:1 mapping

---

## 4. Migration skeleton (for chat1 to flesh out in Phase 2D spec)

### 4.1 `V<phase2d-date>_01__t6_6_factory_production_silver.sql`

```sql
-- V<phase2d-date>_01__t6_6_factory_production_silver.sql
-- Sub-A Phase 2D — factory production analytics Silver tables.
-- Spec: docs/superpowers/specs/<phase2d-date>-phase-2d-factory-silver-spec.md
-- Mapping reference: docs/qa-audits/2026-05-11-factory-silver-entity-mapping.md §1

-- 1. dim_equipment (mirror cretas_db.factory_equipment per §1.1)
CREATE TABLE IF NOT EXISTS dim_equipment (
    id                  BIGSERIAL PRIMARY KEY,
    factory_id          VARCHAR(50) NOT NULL,
    code                VARCHAR(50) NOT NULL,
    equipment_code      VARCHAR(50) NOT NULL,
    equipment_name      VARCHAR(191) NOT NULL,
    -- ... [full column list from §1.1]
    source_pk           BIGINT NOT NULL,             -- cretas_db.factory_equipment.id
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    deleted_at          TIMESTAMP,
    CONSTRAINT uq_dim_equipment_factory_code UNIQUE (factory_id, code),
    CONSTRAINT uq_dim_equipment_factory_source UNIQUE (factory_id, source_pk)
);
-- Apply §3.1 RLS + §3.2 trigger + indexes from §1.1

-- 2. dim_production_line (mirror cretas_db.production_lines per §1.2)
-- 3. fact_production_batch (mirror cretas_db.production_batches per §1.3)
-- 4. fact_quality_inspection (mirror cretas_db.quality_inspections per §1.4 — SHARED with quality migration)
-- 5. fact_equipment_event (NEW table, no Java entity — see §2.3)
```

### 4.2 `V<phase2d-date>_02__t6_6_factory_quality_silver.sql`

```sql
-- V<phase2d-date>_02__t6_6_factory_quality_silver.sql
-- Sub-B Phase 2D — factory quality analytics Silver tables.

-- 1. (fact_quality_inspection shared with migration _01 — guard with IF NOT EXISTS)
-- 2. fact_quality_defect (NEW table, exploded from custom_fields JSONB — see §2.2)
-- 3. fact_rework_record (mirror cretas_db.rework_records per §1.5)
-- 4. fact_disposal_record (mirror cretas_db.disposal_records per §1.6)
-- 5. fact_customer_complaint (NEW table, ETL source TBD — see §2.1)
```

### 4.3 Sub-ETL extension specs

Each table needs a Sub-ETL-* extension job. Pattern:
- Read cretas_db delta (created_at > last_watermark OR updated_at > last_watermark)
- `UPSERT ON CONFLICT (factory_id, source_pk)` into Silver
- For Class B tables without cretas_db source (§2.1 + §2.3), Sub-ETL job has a different upstream — designer decides

---

## 5. Java naming-inconsistency caveats

Two latent type-coercion issues chat1 should resolve in the Silver schema (regardless of which Java side keeps):

| Issue | Where | Recommendation |
|---|---|---|
| `production_batch_id` is `Long` in `QualityInspection` but `String` in `ReworkRecord` / `DisposalRecord` | Java entities | Silver: `BIGINT` (use the IDENTITY value from `production_batches.id`). ETL casts String→BIGINT. |
| `quality_inspection_id` is `String(191)` in `ReworkRecord` / `DisposalRecord` but `String(191)` in `QualityInspection.id` | matches | OK — `VARCHAR(191)` consistently. |
| `material_batch_id` is `String(191)` in both | matches | OK. |

---

## 6. Open questions for chat1 / organizer

| # | Question | Default if no answer |
|---|---|---|
| Q1 | `fact_customer_complaint` ETL source? Add new `cretas_db.customer_complaints` transactional table OR ingest from external workflow? | Phase 2D defer; create empty table for endpoint contract, leave ETL stub |
| Q2 | `fact_quality_defect` exploded table OR keep denormalized in `quality_inspections.custom_fields`? | Exploded — Pareto query is too slow on JSONB iteration at scale |
| Q3 | `fact_equipment_event` source union (alerts + maintenance + IoT) — single ETL or one per source? | One ETL job with `source_kind` discriminator |
| Q4 | `production_lines.equipment_ids TEXT` → `BIGINT[]` in Silver? | Yes — array is queryable; TEXT is opaque |
| Q5 | Add R_*_REAL factory_ids to `cretas_prod_db.factories` so tenant.py routes them to restaurant? | Per PR #372 §0 — Steve decision, not chat1 |

---

## 7. Cross-references

| Ref | Purpose |
|---|---|
| [PR #367](https://github.com/j4xie/my-prototype-logistics/pull/367) — audit framework | Sister doc + validate scripts |
| [PR #372](https://github.com/j4xie/my-prototype-logistics/pull/372) — prod evidence | §4 factory schema state (this doc fills in the migration detail) |
| Sub-A impl spec §2.3 | Factory production Java mock → real-DB column mapping (incomplete; this doc completes) |
| Sub-B impl spec §2.3 | Factory quality Java mock → real-DB column mapping (incomplete; this doc completes) |
| [`2026_04_24_silver_restaurant_ops.sql`](../../backend/python/smartbi/database/migrations/2026_04_24_silver_restaurant_ops.sql) | Canonical Silver schema pattern (RLS + triggers + indexes) |
| [`2026_04_28_silver_dimensions.sql`](../../backend/python/smartbi/database/migrations/2026_04_28_silver_dimensions.sql) | `silver_touch_updated_at()` function definition |
| Java entities (in `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/`) | Verbatim column sources (FactoryEquipment / ProductionLine / ProductionBatch / QualityInspection / ReworkRecord / DisposalRecord) |
| QualityAnalysisServiceImpl.java:146-180 | Mock-field references for Class B fact_quality_defect derivation |

---

*End of entity-mapping deep dive. chat1's Phase 2D migration spec §2 should cite this doc as the column-shape source of truth; this doc cites Java entities as the source of truth.*
