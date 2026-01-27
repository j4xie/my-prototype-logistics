# Dual DataSource Merge Plan

**Document Version**: 1.0.0
**Created**: 2026-01-26
**Author**: Claude Code Agent

---

## 1. Executive Summary

This document outlines the plan to merge the current dual-datasource architecture (MySQL + PostgreSQL) into a single MySQL datasource. The goal is to simplify deployment, reduce operational complexity, and eliminate cross-database consistency concerns.

### Current Architecture

| DataSource | Database | Entity Count | Purpose |
|------------|----------|--------------|---------|
| Primary | MySQL | ~224 | All business entities |
| SmartBI Postgres | PostgreSQL | 4 | SmartBI dynamic data (JSONB) |

### Target Architecture

| DataSource | Database | Entity Count | Purpose |
|------------|----------|--------------|---------|
| Primary | MySQL | ~228 | All entities (unified) |

---

## 2. Current Architecture Analysis

### 2.1 Configuration Files

| File | Path | Purpose |
|------|------|---------|
| PrimaryDataSourceConfig.java | `config/datasource/` | MySQL primary datasource, scans all packages except `smartbi.postgres` |
| SmartBIPostgresDataSourceConfig.java | `config/datasource/` | PostgreSQL secondary datasource, conditional on `smartbi.postgres.enabled` |
| SmartBiJpaConfig.java | `config/smartbi/` | Legacy placeholder (empty) |

### 2.2 PostgreSQL Entities (To Be Migrated)

| Entity | Table Name | JSONB Columns | Description |
|--------|------------|---------------|-------------|
| SmartBiDynamicData | `smart_bi_dynamic_data` | `row_data` | Excel row data as JSON |
| SmartBiPgExcelUpload | `smart_bi_pg_excel_uploads` | `detected_structure`, `field_mappings`, `context_info` | Upload metadata |
| SmartBiPgFieldDefinition | `smart_bi_pg_field_definitions` | `sample_values`, `statistics` | Field schema definitions |
| SmartBiPgAnalysisResult | `smart_bi_pg_analysis_results` | `analysis_result`, `chart_configs`, `kpi_values`, `insights`, `request_params` | AI analysis results |

### 2.3 PostgreSQL Repositories (To Be Migrated)

| Repository | Native Queries | JSONB Operators |
|------------|----------------|-----------------|
| SmartBiDynamicDataRepository | 9 | `->>`, `@>`, `CAST AS jsonb` |
| SmartBiPgExcelUploadRepository | 0 | None |
| SmartBiPgFieldDefinitionRepository | 0 | None |
| SmartBiPgAnalysisResultRepository | 0 | None |

### 2.4 Key Dependencies

```
SmartBiDynamicDataRepository.java
├── aggregateByField() - Uses PostgreSQL ->> operator
├── aggregateByFieldMultiMeasure() - Uses PostgreSQL ->> operator
├── findByJsonContains() - Uses PostgreSQL @> operator
├── getDistinctFieldValues() - Uses PostgreSQL ->> operator
├── sumField() - Uses PostgreSQL ->> operator
├── avgField() - Uses PostgreSQL ->> operator
├── minMaxField() - Uses PostgreSQL ->> operator
└── aggregateByPeriod() - Uses PostgreSQL ->> operator
```

---

## 3. Migration Strategy

### 3.1 Option A: MySQL JSON Type (Recommended)

MySQL 5.7+ supports native JSON type with JSON functions. This option preserves most of the current architecture.

**Pros:**
- Native JSON indexing with generated columns
- JSON_EXTRACT() functions similar to PostgreSQL ->>
- Minimal code changes

**Cons:**
- No GIN index equivalent (need virtual columns with B-tree index)
- Slightly different syntax for JSON operators

### 3.2 Option B: Normalized Tables

Convert JSONB columns to relational tables.

**Pros:**
- Standard SQL, no JSON dependencies
- Better query performance for known schemas

**Cons:**
- Major refactoring required
- Loses flexibility of dynamic schemas

### 3.3 Recommendation

**Option A: MySQL JSON Type** is recommended as it provides the best balance of migration effort and functionality retention.

---

## 4. Detailed Migration Plan

### 4.1 Files to Move

```
FROM: entity/smartbi/postgres/
  TO: entity/smartbi/

Files:
1. SmartBiDynamicData.java      -> SmartBiMysqlDynamicData.java (renamed)
2. SmartBiPgExcelUpload.java    -> SmartBiDynamicUpload.java (renamed)
3. SmartBiPgFieldDefinition.java -> SmartBiDynamicFieldDef.java (renamed)
4. SmartBiPgAnalysisResult.java  -> SmartBiDynamicAnalysis.java (renamed)

FROM: repository/smartbi/postgres/
  TO: repository/smartbi/

Files:
1. SmartBiDynamicDataRepository.java    -> SmartBiDynamicDataRepository.java
2. SmartBiPgExcelUploadRepository.java  -> SmartBiDynamicUploadRepository.java
3. SmartBiPgFieldDefinitionRepository.java -> SmartBiDynamicFieldDefRepository.java
4. SmartBiPgAnalysisResultRepository.java -> SmartBiDynamicAnalysisRepository.java
```

### 4.2 Files to Delete

```
config/datasource/SmartBIPostgresDataSourceConfig.java
config/smartbi/SmartBiJpaConfig.java (optional, already empty)
entity/smartbi/postgres/ (entire directory after migration)
repository/smartbi/postgres/ (entire directory after migration)
```

### 4.3 Files to Modify

#### 4.3.1 PrimaryDataSourceConfig.java

Remove the `excludeFilters` clause:

```java
// BEFORE
@EnableJpaRepositories(
    basePackages = { "com.cretas.aims.repository" },
    excludeFilters = @ComponentScan.Filter(
        type = FilterType.REGEX,
        pattern = "com\\.cretas\\.aims\\.repository\\.smartbi\\.postgres\\..*"
    ),
    ...
)

// AFTER
@EnableJpaRepositories(
    basePackages = { "com.cretas.aims.repository" },
    // No exclude filter needed
    ...
)
```

#### 4.3.2 Entity Modifications

**Change JSONB to JSON (MySQL)**

```java
// BEFORE (PostgreSQL)
@TypeDef(name = "jsonb", typeClass = JsonBinaryType.class)
@Type(type = "jsonb")
@Column(name = "row_data", columnDefinition = "jsonb")
private Map<String, Object> rowData;

// AFTER (MySQL)
@Type(type = "json")  // Use JsonStringType for MySQL
@Column(name = "row_data", columnDefinition = "json")
private Map<String, Object> rowData;
```

**Add Hibernate Types dependency for MySQL JSON:**

```xml
<dependency>
    <groupId>com.vladmihalcea</groupId>
    <artifactId>hibernate-types-52</artifactId>
    <version>2.21.1</version>
</dependency>
```

Use `JsonStringType` instead of `JsonBinaryType`:

```java
@TypeDef(name = "json", typeClass = JsonStringType.class)
```

#### 4.3.3 Native Query Modifications

**SmartBiDynamicDataRepository - aggregateByField()**

```java
// BEFORE (PostgreSQL)
@Query(value = """
    SELECT
        row_data->>:groupField as group_value,
        SUM(CAST(NULLIF(row_data->>:measureField, '') AS DECIMAL(18,2))) as total
    FROM smart_bi_dynamic_data
    WHERE factory_id = :factoryId AND upload_id = :uploadId
      AND row_data->>:groupField IS NOT NULL
    GROUP BY row_data->>:groupField
    ORDER BY total DESC
    """, nativeQuery = true)

// AFTER (MySQL)
@Query(value = """
    SELECT
        JSON_UNQUOTE(JSON_EXTRACT(row_data, CONCAT('$.', :groupField))) as group_value,
        SUM(CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(row_data, CONCAT('$.', :measureField))), '') AS DECIMAL(18,2))) as total
    FROM smart_bi_dynamic_data
    WHERE factory_id = :factoryId AND upload_id = :uploadId
      AND JSON_EXTRACT(row_data, CONCAT('$.', :groupField)) IS NOT NULL
    GROUP BY JSON_UNQUOTE(JSON_EXTRACT(row_data, CONCAT('$.', :groupField)))
    ORDER BY total DESC
    """, nativeQuery = true)
```

**findByJsonContains() - Convert @> to JSON_CONTAINS**

```java
// BEFORE (PostgreSQL)
@Query(value = """
    SELECT * FROM smart_bi_dynamic_data
    WHERE factory_id = :factoryId
      AND row_data @> CAST(:jsonFilter AS jsonb)
    """, nativeQuery = true)

// AFTER (MySQL)
@Query(value = """
    SELECT * FROM smart_bi_dynamic_data
    WHERE factory_id = :factoryId
      AND JSON_CONTAINS(row_data, :jsonFilter)
    """, nativeQuery = true)
```

### 4.4 application.properties Changes

```properties
# REMOVE these PostgreSQL-specific settings
# smartbi.postgres.enabled=true
# smartbi.postgres.url=jdbc:postgresql://localhost:5432/smartbi_db
# smartbi.postgres.username=smartbi_user
# smartbi.postgres.password=${POSTGRES_SMARTBI_PASSWORD:}
# smartbi.postgres.driver-class-name=org.postgresql.Driver
# smartbi.postgres.hikari.*

# The primary MySQL datasource handles everything
spring.datasource.url=jdbc:mysql://localhost:3306/cretas_db?...
```

### 4.5 Database Migration (DDL)

```sql
-- Create tables in MySQL (run on cretas_db)

-- 1. Dynamic Data Table
CREATE TABLE smart_bi_dynamic_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    upload_id BIGINT NOT NULL,
    sheet_name VARCHAR(100),
    row_index INT,
    row_data JSON NOT NULL,
    period VARCHAR(50),
    category VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dynamic_factory_upload (factory_id, upload_id),
    INDEX idx_dynamic_period (factory_id, period),
    INDEX idx_dynamic_category (factory_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Dynamic Upload Table (renamed from smart_bi_pg_excel_uploads)
CREATE TABLE smart_bi_dynamic_uploads (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    file_name VARCHAR(255),
    sheet_name VARCHAR(100),
    detected_table_type VARCHAR(50),
    detected_structure JSON,
    field_mappings JSON,
    context_info JSON,
    row_count INT,
    column_count INT,
    upload_status VARCHAR(20) DEFAULT 'PENDING',
    error_message TEXT,
    uploaded_by BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_dynamic_upload_factory (factory_id),
    INDEX idx_dynamic_upload_status (upload_status),
    INDEX idx_dynamic_upload_table_type (detected_table_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Dynamic Field Definition Table
CREATE TABLE smart_bi_dynamic_field_defs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    upload_id BIGINT NOT NULL,
    original_name VARCHAR(255),
    standard_name VARCHAR(100),
    field_type VARCHAR(50),
    semantic_type VARCHAR(50),
    chart_role VARCHAR(50),
    is_dimension TINYINT(1) DEFAULT 0,
    is_measure TINYINT(1) DEFAULT 0,
    is_time TINYINT(1) DEFAULT 0,
    sample_values JSON,
    statistics JSON,
    display_order INT DEFAULT 0,
    format_pattern VARCHAR(50),
    INDEX idx_dynamic_field_upload (upload_id),
    UNIQUE KEY uk_dynamic_field_upload_name (upload_id, original_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Dynamic Analysis Result Table
CREATE TABLE smart_bi_dynamic_analysis (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    upload_id BIGINT NOT NULL,
    factory_id VARCHAR(50) NOT NULL,
    analysis_type VARCHAR(50),
    analysis_result JSON NOT NULL,
    chart_configs JSON,
    kpi_values JSON,
    insights JSON,
    request_params JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dynamic_analysis_upload (upload_id),
    INDEX idx_dynamic_analysis_factory (factory_id),
    INDEX idx_dynamic_analysis_type (analysis_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional: Generated column for JSON indexing (for frequently queried fields)
-- ALTER TABLE smart_bi_dynamic_data
--     ADD COLUMN period_idx VARCHAR(50) AS (JSON_UNQUOTE(JSON_EXTRACT(row_data, '$.period'))) STORED,
--     ADD INDEX idx_period_value (period_idx);
```

---

## 5. Post-Migration Directory Structure

```
backend-java/src/main/java/com/cretas/aims/
├── config/
│   ├── datasource/
│   │   └── PrimaryDataSourceConfig.java   # Unified (no excludes)
│   └── smartbi/
│       └── (SmartBiJpaConfig.java deleted)
│
├── entity/
│   └── smartbi/
│       ├── AiAgentRule.java
│       ├── AiIntentConfig.java
│       ├── SmartBiDynamicData.java        # Migrated from postgres/
│       ├── SmartBiDynamicUpload.java      # Migrated from postgres/
│       ├── SmartBiDynamicFieldDef.java    # Migrated from postgres/
│       ├── SmartBiDynamicAnalysis.java    # Migrated from postgres/
│       ├── SmartBiExcelUpload.java        # Existing MySQL entity
│       ├── SmartBiFieldDefinition.java    # Existing MySQL entity
│       ├── ... (other MySQL entities)
│       └── postgres/                       # DELETED
│
├── repository/
│   └── smartbi/
│       ├── SmartBiDynamicDataRepository.java     # Migrated, queries updated
│       ├── SmartBiDynamicUploadRepository.java   # Migrated
│       ├── SmartBiDynamicFieldDefRepository.java # Migrated
│       ├── SmartBiDynamicAnalysisRepository.java # Migrated
│       ├── SmartBiExcelUploadRepository.java     # Existing
│       └── postgres/                              # DELETED
```

---

## 6. Migration Checklist

### Phase 1: Preparation
- [ ] Backup PostgreSQL `smartbi_db` database
- [ ] Create MySQL tables (DDL above)
- [ ] Migrate existing PostgreSQL data to MySQL (if any)

### Phase 2: Code Migration
- [ ] Copy and rename entity files from `postgres/` to `smartbi/`
- [ ] Update entity annotations (JSONB -> JSON)
- [ ] Copy and rename repository files
- [ ] Update native queries (PostgreSQL operators -> MySQL JSON functions)
- [ ] Update `PrimaryDataSourceConfig.java` (remove excludeFilters)
- [ ] Delete `SmartBIPostgresDataSourceConfig.java`
- [ ] Delete `SmartBiJpaConfig.java`
- [ ] Update `application.properties` (remove PostgreSQL config)
- [ ] Update `application-prod.properties` (if exists)

### Phase 3: Testing
- [ ] Unit tests for repository methods
- [ ] Integration tests for JSON queries
- [ ] E2E tests for SmartBI upload flow
- [ ] Performance comparison (PostgreSQL GIN vs MySQL JSON index)

### Phase 4: Deployment
- [ ] Deploy to staging environment
- [ ] Verify functionality
- [ ] Deploy to production
- [ ] Remove PostgreSQL database (after verification)

---

## 7. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| JSON query performance degradation | Medium | Medium | Use generated columns with indexes for hot paths |
| Data loss during migration | High | Low | Full backup before migration, verify row counts |
| Native query syntax errors | Medium | Medium | Thorough testing of all 9 native queries |
| Service downtime | Low | Low | Blue-green deployment strategy |

---

## 8. Rollback Plan

If migration fails:

1. Restore `SmartBIPostgresDataSourceConfig.java`
2. Restore PostgreSQL-specific entities and repositories
3. Re-enable `smartbi.postgres.enabled=true`
4. Restore PostgreSQL database from backup

---

## 9. Appendix: PostgreSQL to MySQL JSON Function Mapping

| PostgreSQL | MySQL | Example |
|------------|-------|---------|
| `row_data->>'field'` | `JSON_UNQUOTE(JSON_EXTRACT(row_data, '$.field'))` | Extract as text |
| `row_data->'field'` | `JSON_EXTRACT(row_data, '$.field')` | Extract as JSON |
| `row_data @> '{"key": "value"}'` | `JSON_CONTAINS(row_data, '{"key": "value"}')` | Contains check |
| `CAST(x AS jsonb)` | `CAST(x AS JSON)` | String to JSON |
| `jsonb_build_object()` | `JSON_OBJECT()` | Build object |
| `jsonb_agg()` | `JSON_ARRAYAGG()` | Aggregate to array |

---

## 10. References

- [MySQL JSON Functions](https://dev.mysql.com/doc/refman/8.0/en/json-functions.html)
- [Hibernate Types Library](https://github.com/vladmihalcea/hibernate-types)
- Current source files analyzed:
  - `PrimaryDataSourceConfig.java`
  - `SmartBIPostgresDataSourceConfig.java`
  - `SmartBiDynamicData.java`
  - `SmartBiPgExcelUpload.java`
  - `SmartBiPgFieldDefinition.java`
  - `SmartBiPgAnalysisResult.java`
  - `SmartBiDynamicDataRepository.java`
  - `SmartBiPgExcelUploadRepository.java`
  - `SmartBiPgFieldDefinitionRepository.java`
  - `SmartBiPgAnalysisResultRepository.java`
