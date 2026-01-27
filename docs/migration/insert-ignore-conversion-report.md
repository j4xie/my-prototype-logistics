# INSERT IGNORE / ON DUPLICATE KEY UPDATE Conversion Report

**Generated**: 2026-01-26
**Purpose**: Document all MySQL-specific INSERT statements that need conversion for PostgreSQL compatibility

---

## Summary

| Type | Count | Files Affected |
|------|-------|----------------|
| INSERT IGNORE | 48 | 9 files |
| ON DUPLICATE KEY UPDATE | 203 | 32 files |
| **Total** | **251** | **41 files** |

---

## Conversion Rules

### MySQL to PostgreSQL Syntax

| MySQL | PostgreSQL |
|-------|------------|
| `INSERT IGNORE INTO table ...` | `INSERT INTO table ... ON CONFLICT DO NOTHING` |
| `INSERT ... ON DUPLICATE KEY UPDATE col=val` | `INSERT ... ON CONFLICT (key) DO UPDATE SET col=val` |
| `VALUES(col)` in UPDATE | `EXCLUDED.col` |

---

## Part 1: data.sql (Seed Data)

**File**: `backend-java/src/main/resources/data.sql`

### INSERT IGNORE Statements (40 occurrences)

| Line | Table | Conflict Key | Notes |
|------|-------|--------------|-------|
| 10 | `factories` | `id` (PK) | Factory ID is VARCHAR PK |
| 18 | `platform_admins` | `username` (UNIQUE) | Username is unique |
| 27 | `users` | `username` (UNIQUE) | Username per factory unique |
| 68 | `departments` | `(factory_id, code)` (UNIQUE) | Composite unique key |
| 87 | `suppliers` | `id` (PK) | Supplier ID is VARCHAR PK |
| 102 | `customers` | `id` (PK) | Customer ID is VARCHAR PK |
| 116 | `raw_material_types` | `id` (PK) | Type ID is VARCHAR PK |
| 139 | `product_types` | `id` (PK) | Type ID is VARCHAR PK |
| 156 | `factory_equipment` | `(factory_id, code)` (UNIQUE) | Equipment code unique per factory |
| 175 | `material_batches` | `id` (PK) | Batch ID is VARCHAR PK |
| 198 | `production_batches` | `(factory_id, batch_number)` (UNIQUE) | Batch number unique per factory |
| 216 | `whitelist` | `(factory_id, phone_number)` (UNIQUE) | Phone unique per factory |
| 246-268 | `material_consumptions` | `id` (PK, auto-increment) | 6 INSERT statements |
| 288 | `dispatcher_assignments` | `id` (PK, auto-increment) | Auto-increment ID |
| 297 | `ai_analysis_results` | `id` (PK, auto-increment) | Auto-increment ID |
| 312-364 | `equipment_alerts` | `id` (PK, auto-increment) | 8 INSERT statements |
| 375 | `shipment_records` | `id` (PK) | Shipment ID is VARCHAR PK |
| 390-406 | `quality_inspections` | `id` (PK, auto-increment) | 5 INSERT statements |
| 413 | `disposal_records` | `id` (PK) | Disposal ID is VARCHAR PK |
| 426 | `time_clock_records` | `id` (PK, auto-increment) | Auto-increment ID |
| 443-455 | `equipment_maintenance` | `id` (PK, auto-increment) | 4 INSERT statements |

### Conversion Example (data.sql)

**Before (MySQL):**
```sql
INSERT IGNORE INTO factories (id, name, ...) VALUES
('F001', 'Factory 1', ...);
```

**After (PostgreSQL):**
```sql
INSERT INTO factories (id, name, ...) VALUES
('F001', 'Factory 1', ...)
ON CONFLICT (id) DO NOTHING;
```

---

## Part 2: Migration Files

### V2025_12_27__add_role_hierarchy_fields.sql

**Type**: ON DUPLICATE KEY UPDATE
**Tables**: `role_definitions`, `role_permissions`

| Line | Table | Conflict Key | Update Columns |
|------|-------|--------------|----------------|
| 92 | `role_definitions` | `role_code` (UNIQUE) | display_name, description, level, department, is_deprecated |
| 123-225 | `role_permissions` | `(role_code, module)` (UNIQUE) | permission_type |

**Conversion Example:**
```sql
-- MySQL
INSERT INTO role_permissions (...) VALUES (...)
ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type);

-- PostgreSQL
INSERT INTO role_permissions (...) VALUES (...)
ON CONFLICT (role_code, module) DO UPDATE SET permission_type = EXCLUDED.permission_type;
```

---

### V2025_12_28_2__dispatcher_enhancement.sql

**Type**: INSERT IGNORE
**Table**: `mixed_batch_rules`

| Line | Table | Conflict Key |
|------|-------|--------------|
| 214 | `mixed_batch_rules` | `id` (PK) |
| 228 | `mixed_batch_rules` | `id` (PK) |

---

### V2025_12_31_7__ai_quota_rules.sql

**Type**: ON DUPLICATE KEY UPDATE
**Table**: `ai_quota_rules`

| Line | Table | Conflict Key | Update Columns |
|------|-------|--------------|----------------|
| 51 | `ai_quota_rules` | Needs investigation | updated_at |

---

### V20260121__aps_adaptive_scheduling.sql

**Type**: INSERT IGNORE
**Table**: `aps_prediction_model_weights`

| Line | Table | Conflict Key |
|------|-------|--------------|
| 109 | `aps_prediction_model_weights` | `(factory_id, feature_name)` (UNIQUE) |

---

### V2026_01_03_3__keyword_effectiveness.sql

**Type**: ON DUPLICATE KEY UPDATE
**Table**: Unknown (context needed)

| Line | Update Columns |
|------|----------------|
| 55 | updated_at |

---

### V2026_01_03_5__factory_ai_learning_config.sql

**Type**: ON DUPLICATE KEY UPDATE
**Table**: `factory_ai_learning_config`

| Line | Conflict Key | Update Columns |
|------|--------------|----------------|
| 52 | `factory_id` (PK/UNIQUE) | updated_at |

---

### AI Intent Config Files (Major Category)

The following files all insert into `ai_intent_configs` table with pattern:
- **Conflict Key**: `intent_code` (UNIQUE)
- **Update Columns**: keywords, description, updated_at

| File | Line Count |
|------|------------|
| V2026_01_04_1__ai_management_intents.sql | 14 statements |
| V2026_01_04_2__p0_intent_configs.sql | 26 statements |
| V2026_01_04_3__p1_intent_configs.sql | 40 statements |
| V2026_01_04_30__scale_intent_configs.sql | 14 statements |
| V2026_01_04_31__scale_add_device_intents.sql | 6 statements |
| V2026_01_05_25__camera_intent_configs.sql | 11 statements |
| V2026_01_08_03__add_processing_batch_intents.sql | 12 statements |
| V2026_01_08_04__add_equipment_intents.sql | 10 statements |
| V2026_01_08_05__add_remaining_intent_orphans.sql | 6 statements |
| V2026_01_08_06__add_device_intents.sql | 3 statements |
| V2026_01_17_02__fix_material_batch_create_intent.sql | 2 statements |
| V2026_01_23_010__isapi_smart_analysis_intents.sql | 3 statements |
| V2026_01_23_02__dahua_ai_intents.sql | 4 statements |
| V2026_01_25_01__add_order_and_delete_intents.sql | 9 statements |
| V2026_01_25_02__add_phase2_coverage_intents.sql | 6 statements |

**Conversion Pattern for ai_intent_configs:**
```sql
-- MySQL
INSERT INTO ai_intent_configs (id, intent_code, ...) VALUES (UUID(), 'CODE', ...)
ON DUPLICATE KEY UPDATE
    keywords = VALUES(keywords),
    description = VALUES(description),
    updated_at = NOW();

-- PostgreSQL
INSERT INTO ai_intent_configs (id, intent_code, ...) VALUES (gen_random_uuid(), 'CODE', ...)
ON CONFLICT (intent_code) DO UPDATE SET
    keywords = EXCLUDED.keywords,
    description = EXCLUDED.description,
    updated_at = NOW();
```

---

### V2026_01_05_02__semantic_cache_tables.sql

**Type**: ON DUPLICATE KEY UPDATE
**Table**: Semantic cache related

| Line | Update Columns |
|------|----------------|
| 78 | updated_at |

---

### V2026_01_09_01__intent_category_enums.sql

**Type**: ON DUPLICATE KEY UPDATE
**Table**: Intent categories

| Line | Conflict Key |
|------|--------------|
| 35 | Needs investigation |

---

### V2026_01_14_3__bom_sample_data.sql

**Type**: INSERT IGNORE
**Tables**: `bom_items`, `labor_cost_configs`, `overhead_cost_configs`

| Line | Table | Conflict Key |
|------|-------|--------------|
| 8 | `bom_items` | `(factory_id, product_type_id, material_type_id)` |
| 32 | `bom_items` | Same as above |
| 63 | `bom_items` | Same as above |
| 94 | `labor_cost_configs` | `(factory_id, product_type_id, process_name)` |
| 103 | `overhead_cost_configs` | `(factory_id, name)` |

---

### V2026_01_18_01__smart_bi_tables.sql

**Type**: INSERT IGNORE
**Table**: `smart_bi_billing_config`

| Line | Table | Conflict Key |
|------|-------|--------------|
| 214 | `smart_bi_billing_config` | `factory_id` (UNIQUE) |

---

### V2026_01_18_02__smart_bi_sample_data.sql

**Type**: ON DUPLICATE KEY UPDATE
**Table**: Smart BI related

| Line | Update Columns |
|------|----------------|
| 169 | Various |

---

### V2026_01_19_02__agentic_rag_sample_data.sql

**Type**: ON DUPLICATE KEY UPDATE
**Tables**: RAG related tables

| Line | Update Columns |
|------|----------------|
| 88 | Various |
| 99 | session_id |
| 108 | retrieval_score |
| 117 | complexity_score |

---

### V2026_01_19_40__factory_scheduling_config.sql

**Type**: ON DUPLICATE KEY UPDATE
**Table**: `factory_scheduling_config`

| Line | Conflict Key | Update Columns |
|------|--------------|----------------|
| 65 | `factory_id` | updated_at |
| 133 | `factory_id` | updated_at |

---

### V2026_01_21_001__aps_adaptive_scheduling.sql

**Type**: INSERT IGNORE + ON DUPLICATE KEY UPDATE
**Table**: `ai_agent_rules`

| Line | Type | Conflict Key |
|------|------|--------------|
| 222 | INSERT IGNORE | `id` (PK) |
| 250 | INSERT IGNORE | `id` (PK) |
| 280 | INSERT IGNORE | `id` (PK) |
| 324 | ON DUPLICATE KEY UPDATE | Needs investigation |

---

### V2026_01_24_03__profit_loss_field_synonyms.sql

**Type**: ON DUPLICATE KEY UPDATE
**Table**: Field synonyms

| Line | Update Columns |
|------|----------------|
| 24 | Various |
| 43 | Various |
| 67 | Various |

---

## Part 3: Table Conflict Key Reference

This section documents the primary keys and unique constraints for affected tables.

| Table | Primary Key | Unique Constraints |
|-------|-------------|-------------------|
| `factories` | `id` (VARCHAR) | - |
| `platform_admins` | `id` (BIGINT AUTO_INCREMENT) | `username` |
| `users` | `id` (BIGINT AUTO_INCREMENT) | `username` |
| `departments` | `id` (BIGINT AUTO_INCREMENT) | `(factory_id, code)` |
| `suppliers` | `id` (VARCHAR) | `(factory_id, supplier_code)` |
| `customers` | `id` (VARCHAR) | `(factory_id, customer_code)` |
| `raw_material_types` | `id` (VARCHAR) | `(factory_id, code)` |
| `product_types` | `id` (VARCHAR) | `(factory_id, code)` |
| `factory_equipment` | `id` (BIGINT AUTO_INCREMENT) | `(factory_id, code)` |
| `material_batches` | `id` (VARCHAR) | `(factory_id, batch_number)` |
| `production_batches` | `id` (BIGINT AUTO_INCREMENT) | `(factory_id, batch_number)` |
| `whitelist` | `id` (BIGINT AUTO_INCREMENT) | `(factory_id, phone_number)` |
| `material_consumptions` | `id` (BIGINT AUTO_INCREMENT) | - |
| `ai_analysis_results` | `id` (BIGINT AUTO_INCREMENT) | - |
| `equipment_alerts` | `id` (BIGINT AUTO_INCREMENT) | - |
| `shipment_records` | `id` (VARCHAR) | `shipment_number` |
| `quality_inspections` | `id` (BIGINT AUTO_INCREMENT) | - |
| `disposal_records` | `id` (VARCHAR) | `disposal_number` |
| `time_clock_records` | `id` (BIGINT AUTO_INCREMENT) | - |
| `equipment_maintenance` | `id` (BIGINT AUTO_INCREMENT) | - |
| `role_definitions` | `id` (INT AUTO_INCREMENT) | `role_code` |
| `role_permissions` | `id` (INT AUTO_INCREMENT) | `(role_code, module)` |
| `mixed_batch_rules` | `id` (VARCHAR/BIGINT) | - |
| `ai_intent_configs` | `id` (VARCHAR/UUID) | `intent_code` |
| `aps_prediction_model_weights` | `id` (BIGINT AUTO_INCREMENT) | `(factory_id, feature_name)` |
| `bom_items` | `id` (BIGINT AUTO_INCREMENT) | `(factory_id, product_type_id, material_type_id)` |
| `labor_cost_configs` | `id` (BIGINT AUTO_INCREMENT) | `(factory_id, product_type_id, process_name)` |
| `overhead_cost_configs` | `id` (BIGINT AUTO_INCREMENT) | `(factory_id, name)` |
| `smart_bi_billing_config` | `id` (BIGINT AUTO_INCREMENT) | `factory_id` |
| `factory_scheduling_config` | `id` (BIGINT AUTO_INCREMENT) | `factory_id` |
| `ai_agent_rules` | `id` (VARCHAR/UUID) | - |

---

## Part 4: Priority Conversion Order

### Priority 1 (High) - Core seed data
1. `data.sql` - All 40 INSERT IGNORE statements

### Priority 2 (Medium) - AI Intent configurations
2. All `ai_intent_configs` related migrations (151 ON DUPLICATE KEY UPDATE statements)

### Priority 3 (Lower) - Other configurations
3. Role and permission tables
4. Scheduling configurations
5. Smart BI configurations

---

## Part 5: Additional Notes

### UUID Generation
- MySQL: `UUID()`
- PostgreSQL: `gen_random_uuid()` (requires `pgcrypto` extension)

### AUTO_INCREMENT
- MySQL: `AUTO_INCREMENT`
- PostgreSQL: `SERIAL` or `GENERATED ALWAYS AS IDENTITY`

### Timestamp Functions
- MySQL: `NOW()`, `CURRENT_TIMESTAMP`
- PostgreSQL: `NOW()`, `CURRENT_TIMESTAMP` (compatible)

### VALUES() in UPDATE clause
- MySQL: `VALUES(column_name)`
- PostgreSQL: `EXCLUDED.column_name`

---

## Next Steps

1. Create PostgreSQL-compatible migration scripts
2. Test migrations on PostgreSQL database
3. Update JPA/Hibernate dialect configuration
4. Verify application compatibility

---

## File List for Conversion

```
backend-java/src/main/resources/data.sql
backend-java/src/main/resources/db/migration/V2025_12_27__add_role_hierarchy_fields.sql
backend-java/src/main/resources/db/migration/V2025_12_28_2__dispatcher_enhancement.sql
backend-java/src/main/resources/db/migration/V2025_12_31_7__ai_quota_rules.sql
backend-java/src/main/resources/db/migration/V20260121__aps_adaptive_scheduling.sql
backend-java/src/main/resources/db/migration/V2026_01_03_3__keyword_effectiveness.sql
backend-java/src/main/resources/db/migration/V2026_01_03_5__factory_ai_learning_config.sql
backend-java/src/main/resources/db/migration/V2026_01_04_1__ai_management_intents.sql
backend-java/src/main/resources/db/migration/V2026_01_04_2__p0_intent_configs.sql
backend-java/src/main/resources/db/migration/V2026_01_04_30__scale_intent_configs.sql
backend-java/src/main/resources/db/migration/V2026_01_04_31__scale_add_device_intents.sql
backend-java/src/main/resources/db/migration/V2026_01_04_3__p1_intent_configs.sql
backend-java/src/main/resources/db/migration/V2026_01_05_02__semantic_cache_tables.sql
backend-java/src/main/resources/db/migration/V2026_01_05_25__camera_intent_configs.sql
backend-java/src/main/resources/db/migration/V2026_01_08_03__add_processing_batch_intents.sql
backend-java/src/main/resources/db/migration/V2026_01_08_04__add_equipment_intents.sql
backend-java/src/main/resources/db/migration/V2026_01_08_05__add_remaining_intent_orphans.sql
backend-java/src/main/resources/db/migration/V2026_01_08_06__add_device_intents.sql
backend-java/src/main/resources/db/migration/V2026_01_09_01__intent_category_enums.sql
backend-java/src/main/resources/db/migration/V2026_01_14_3__bom_sample_data.sql
backend-java/src/main/resources/db/migration/V2026_01_17_02__fix_material_batch_create_intent.sql
backend-java/src/main/resources/db/migration/V2026_01_18_01__smart_bi_tables.sql
backend-java/src/main/resources/db/migration/V2026_01_18_02__smart_bi_sample_data.sql
backend-java/src/main/resources/db/migration/V2026_01_19_02__agentic_rag_sample_data.sql
backend-java/src/main/resources/db/migration/V2026_01_19_40__factory_scheduling_config.sql
backend-java/src/main/resources/db/migration/V2026_01_21_001__aps_adaptive_scheduling.sql
backend-java/src/main/resources/db/migration/V2026_01_23_010__isapi_smart_analysis_intents.sql
backend-java/src/main/resources/db/migration/V2026_01_23_02__dahua_ai_intents.sql
backend-java/src/main/resources/db/migration/V2026_01_24_03__profit_loss_field_synonyms.sql
backend-java/src/main/resources/db/migration/V2026_01_25_01__add_order_and_delete_intents.sql
backend-java/src/main/resources/db/migration/V2026_01_25_02__add_phase2_coverage_intents.sql
```
