# MySQL to PostgreSQL Date Function Conversion Report

**Generated**: 2026-01-26
**Scope**: SQL Migration Files and Repository Native Queries

---

## Summary

| Category | Count |
|----------|-------|
| Date Functions to Convert | 7 occurrences |
| Files Affected | 4 files |
| Already Converted | 1 file (IsapiEventLogRepository.java) |

---

## Conversion Rules Reference

| MySQL | PostgreSQL |
|-------|------------|
| `STR_TO_DATE(str, '%Y-%m-%d')` | `TO_DATE(str, 'YYYY-MM-DD')` |
| `DATE_ADD(date, INTERVAL n DAY)` | `date + INTERVAL 'n days'` |
| `DATE_SUB(date, INTERVAL n DAY)` | `date - INTERVAL 'n days'` |
| `DATEDIFF(date1, date2)` | `(date1::date - date2::date)` |
| `TIMESTAMPDIFF(SECOND, t1, t2)` | `EXTRACT(EPOCH FROM (t2 - t1))` |
| `TIMESTAMPDIFF(MINUTE, t1, t2)` | `EXTRACT(EPOCH FROM (t2 - t1)) / 60` |
| `DATE_FORMAT(date, '%Y-%m-%d')` | `to_char(date, 'YYYY-MM-DD')` |
| `CURDATE()` | `CURRENT_DATE` |
| `CURTIME()` | `CURRENT_TIME` |
| `NOW()` | `NOW()` (compatible) |

---

## Detailed Findings

### 1. SQL Migration Files

#### File: `V2026_01_04_20__iot_infrastructure_tables.sql`

| Line | Original MySQL Syntax | Converted PostgreSQL Syntax |
|------|----------------------|----------------------------|
| 293 | `TIMESTAMPDIFF(MINUTE, d.last_heartbeat, NOW()) AS minutes_since_heartbeat` | `EXTRACT(EPOCH FROM (NOW() - d.last_heartbeat)) / 60 AS minutes_since_heartbeat` |

**Context** (View: v_iot_device_status):
```sql
-- Original (MySQL)
TIMESTAMPDIFF(MINUTE, d.last_heartbeat, NOW()) AS minutes_since_heartbeat

-- Converted (PostgreSQL)
EXTRACT(EPOCH FROM (NOW() - d.last_heartbeat)) / 60 AS minutes_since_heartbeat
```

---

#### File: `V2026_01_05_21__upgrade_to_gte_base_zh.sql`

| Line | Original MySQL Syntax | Converted PostgreSQL Syntax |
|------|----------------------|----------------------------|
| 30 | `WHERE date = CURDATE()` | `WHERE date = CURRENT_DATE` |

**Context**:
```sql
-- Original (MySQL)
UPDATE semantic_cache_stats
SET exact_hits = 0, semantic_hits = 0, misses = 0, updated_at = CURRENT_TIMESTAMP
WHERE date = CURDATE();

-- Converted (PostgreSQL)
UPDATE semantic_cache_stats
SET exact_hits = 0, semantic_hits = 0, misses = 0, updated_at = CURRENT_TIMESTAMP
WHERE date = CURRENT_DATE;
```

---

#### File: `V2026_01_19_30__scheduling_metrics_view.sql`

| Line | Original MySQL Syntax | Converted PostgreSQL Syntax |
|------|----------------------|----------------------------|
| 33 | `DATE_SUB(CURDATE(), INTERVAL 30 DAY)` | `CURRENT_DATE - INTERVAL '30 days'` |
| 43 | `DATEDIFF(CURDATE(), MAX(f.assigned_at))` | `(CURRENT_DATE - MAX(f.assigned_at)::date)` |
| 46 | `DATEDIFF(CURDATE(), MAX(f.assigned_at)) >= 30` | `(CURRENT_DATE - MAX(f.assigned_at)::date) >= 30` |

**Context** (View: v_worker_task_diversity):
```sql
-- Original (MySQL)
WHERE assigned_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)

-- Converted (PostgreSQL)
WHERE assigned_at >= CURRENT_DATE - INTERVAL '30 days'
```

**Context** (View: v_skill_decay_risk):
```sql
-- Original (MySQL)
DATEDIFF(CURDATE(), MAX(f.assigned_at)) as days_since_last
...
HAVING DATEDIFF(CURDATE(), MAX(f.assigned_at)) >= 30;

-- Converted (PostgreSQL)
(CURRENT_DATE - MAX(f.assigned_at)::date) as days_since_last
...
HAVING (CURRENT_DATE - MAX(f.assigned_at)::date) >= 30;
```

---

### 2. Repository Files (Native Queries)

#### File: `FactoryAILearningConfigRepository.java`

| Line | Original Syntax | Converted Syntax | Notes |
|------|-----------------|------------------|-------|
| 47 | `DATEDIFF(CURRENT_DATE, c.createdAt)` | See notes | JPQL Query - may need Hibernate function |

**Context**:
```java
// Original (JPQL - Line 45-48)
@Query("SELECT c FROM FactoryAILearningConfig c " +
       "WHERE c.learningPhase = 'LEARNING' " +
       "AND DATEDIFF(CURRENT_DATE, c.createdAt) >= c.matureThresholdDays")
List<FactoryAILearningConfig> findFactoriesReadyForMatureTransition();
```

**Note**: This is a JPQL query, not native SQL. DATEDIFF is not standard JPQL. Options:
1. Use native query with PostgreSQL syntax
2. Use `FUNCTION('DATEDIFF', ...)` with custom dialect
3. Rewrite using date arithmetic: `(CURRENT_DATE - CAST(c.createdAt AS date))`

**Recommended PostgreSQL Native Query**:
```java
@Query(value = "SELECT * FROM factory_ai_learning_config c " +
       "WHERE c.learning_phase = 'LEARNING' " +
       "AND (CURRENT_DATE - c.created_at::date) >= c.mature_threshold_days " +
       "AND c.deleted_at IS NULL", nativeQuery = true)
List<FactoryAILearningConfig> findFactoriesReadyForMatureTransition();
```

---

### 3. Already Converted Files (Reference)

#### File: `IsapiEventLogRepository.java`

This file has already been converted from MySQL to PostgreSQL syntax:

```java
// Line 129-135 - Already converted
/**
 * PostgreSQL compatible: uses to_char instead of DATE_FORMAT
 */
@Query(value = "SELECT to_char(event_time, 'YYYY-MM-DD HH24:00:00') as hour, COUNT(*) as count " +
        "FROM isapi_event_logs " +
        "WHERE factory_id = :factoryId AND event_time >= :since " +
        "GROUP BY to_char(event_time, 'YYYY-MM-DD HH24:00:00') " +
        "ORDER BY hour", nativeQuery = true)
List<Object[]> countByHour(...);
```

---

## Additional MySQL-Specific Syntax Found (Not Date Functions)

The following MySQL-specific syntax was also found and may need conversion for full PostgreSQL compatibility:

| Syntax | PostgreSQL Equivalent | Files Affected |
|--------|----------------------|----------------|
| `IFNULL(x, y)` | `COALESCE(x, y)` | V2025_12_28_2__dispatcher_enhancement.sql |
| `IF(cond, a, b)` | `CASE WHEN cond THEN a ELSE b END` | V2025_12_29_4__fix_timeclock_table_name.sql, V2026_01_21_01__ai_intent_config_smartbi.sql |
| `GROUP_CONCAT(...)` | `STRING_AGG(... , ',')` | V2026_01_19_12__smart_bi_new_skills.sql |
| `CAST(x AS UNSIGNED)` | `CAST(x AS INTEGER)` | V2025_12_28_2__dispatcher_enhancement.sql |
| `AUTO_INCREMENT` | `SERIAL` or `GENERATED ALWAYS AS IDENTITY` | Multiple migration files |
| `ON DUPLICATE KEY UPDATE` | `ON CONFLICT ... DO UPDATE` | Multiple migration files |

---

## Action Items

### Priority 1 (Date Functions - Required for Migration)

1. [ ] Convert `V2026_01_04_20__iot_infrastructure_tables.sql` - TIMESTAMPDIFF
2. [ ] Convert `V2026_01_05_21__upgrade_to_gte_base_zh.sql` - CURDATE()
3. [ ] Convert `V2026_01_19_30__scheduling_metrics_view.sql` - DATE_SUB, DATEDIFF, CURDATE()
4. [ ] Convert `FactoryAILearningConfigRepository.java` - DATEDIFF in JPQL

### Priority 2 (Other MySQL Syntax - Consider for Full Migration)

5. [ ] Review IFNULL usage and convert to COALESCE
6. [ ] Review IF() usage and convert to CASE WHEN
7. [ ] Review GROUP_CONCAT and convert to STRING_AGG
8. [ ] Review AUTO_INCREMENT and convert to SERIAL/IDENTITY
9. [ ] Review ON DUPLICATE KEY UPDATE and convert to ON CONFLICT

---

## Appendix: File Paths

| File | Full Path |
|------|-----------|
| V2026_01_04_20__iot_infrastructure_tables.sql | `backend-java/src/main/resources/db/migration/V2026_01_04_20__iot_infrastructure_tables.sql` |
| V2026_01_05_21__upgrade_to_gte_base_zh.sql | `backend-java/src/main/resources/db/migration/V2026_01_05_21__upgrade_to_gte_base_zh.sql` |
| V2026_01_19_30__scheduling_metrics_view.sql | `backend-java/src/main/resources/db/migration/V2026_01_19_30__scheduling_metrics_view.sql` |
| FactoryAILearningConfigRepository.java | `backend-java/src/main/java/com/cretas/aims/repository/FactoryAILearningConfigRepository.java` |
| IsapiEventLogRepository.java (converted) | `backend-java/src/main/java/com/cretas/aims/repository/isapi/IsapiEventLogRepository.java` |
