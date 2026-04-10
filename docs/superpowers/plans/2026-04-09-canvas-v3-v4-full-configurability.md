# Canvas V3+V4 Full Configurability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 14 PARTIAL requirements fully configurable through Canvas — dynamic fields (True DDL), sub-tables, user permissions, file upload, conditional rendering, aggregate formulas, tab layouts — plus config-driven form rendering and drag-and-drop page editor.

**Architecture:** Three phases: (1) V3 backend — new dynamic schema layer with DDLExecutor, DynamicFieldService, DynamicTableService, AggregateFormulaExecutor, 6 AI Tools; (2) V4a — extend existing SchemaFormRenderer for dynamic fields/sub-tables/attachments/conditional rendering, SpEL-to-JS evaluator, migrate 6 demo pages; (3) V4b — PageEditor with FieldPalette, FormCanvas (vuedraggable), TabLayoutEditor, PreviewPanel.

**Tech Stack:** Java 21 + Spring Boot 3.2 + PostgreSQL + JPA, Vue 3 + Element Plus 2.13 + TypeScript + @vue-flow/core + vuedraggable-next

**Spec:** `docs/superpowers/specs/2026-04-09-canvas-v3-full-configurability-design.md`

---

## File Structure

### Phase 1: V3 Backend (~18 files)

**New files:**
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/CanvasDynamicField.java` — Dynamic field definition entity
- `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/CanvasDDLLog.java` — DDL audit log entity
- `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/CanvasDynamicFieldRepository.java` — Dynamic field repo
- `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/CanvasDDLLogRepository.java` — DDL log repo
- `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DDLExecutor.java` — Safe DDL execution
- `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DynamicFieldService.java` — Dynamic column read/write
- `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DynamicTableService.java` — Sub-table CRUD
- `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/AggregateFormulaExecutor.java` — GROUP_BY/SUM executor
- `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/DynamicFieldController.java` — Dynamic field + sub-table API
- `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasAddFieldTool.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasAddSubTableTool.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasSetVisibilityTool.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasSetFormulaTool.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasSetUserPermissionTool.java`
- `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasAddAttachmentFieldTool.java`
- `backend/java/cretas-api/src/main/resources/db/migration/V20260410_13__canvas_dynamic_field_table.sql`
- `backend/java/cretas-api/src/main/resources/db/migration/V20260410_14__canvas_ddl_log_table.sql`

**Modified files:**
- `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/config/EffectiveField.java` — Add visibleWhen/computedWhen/source
- `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/FormulaEngine.java` — Route AGGREGATE type
- `backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/impl/FactoryConfigServiceImpl.java` — userId param + dynamic fields merge + DDL on publish

### Phase 2: V4a Frontend Rendering (~12 files)

**New files:**
- `web-admin/src/utils/spelEvaluator.ts` — SpEL-to-JS expression evaluator
- `web-admin/src/views/modules/components/SubTableEditor.vue` — Dynamic sub-table el-table
- `web-admin/src/views/modules/components/AttachmentUploader.vue` — File upload component
- `web-admin/src/views/modules/components/TabLayoutRenderer.vue` — Tab-driven layout

**Modified files:**
- `web-admin/src/types/canvas.ts` — Add DynamicField/DDLLog/SubTable types
- `web-admin/src/api/canvasApi.ts` — Add dynamic field + sub-table API functions
- `web-admin/src/views/modules/components/SchemaFormRenderer.vue` — Add attachment/sub_table/visibleWhen/computedWhen
- `web-admin/src/views/modules/DynamicModulePage.vue` — Add customFields handling + TabLayoutRenderer
- `web-admin/src/types/config.ts` — Add MODULE_TABLE_NAMES mapping

### Phase 3: V4b PageEditor (~8 files)

**New files:**
- `web-admin/src/views/platform/canvas-editor/PageEditor.vue` — Main editor container
- `web-admin/src/views/platform/canvas-editor/components/FieldPalette.vue` — Draggable field type source
- `web-admin/src/views/platform/canvas-editor/components/FormCanvas.vue` — Drop target with live field list
- `web-admin/src/views/platform/canvas-editor/components/TabLayoutEditor.vue` — Tab drag/reorder
- `web-admin/src/views/platform/canvas-editor/components/PreviewPanel.vue` — Live preview using SchemaFormRenderer
- `web-admin/src/views/platform/canvas-editor/composables/usePageEditor.ts` — Editor state management

**Modified files:**
- `web-admin/src/views/platform/canvas-editor/index.vue` — Wire PageEditor into Phase B "字段" tab
- `web-admin/package.json` — Add vuedraggable-next dependency

---

## Phase 1: V3 Backend

### Task 1: Database Migrations

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260410_13__canvas_dynamic_field_table.sql`
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260410_14__canvas_ddl_log_table.sql`

- [ ] **Step 1: Create canvas_dynamic_field migration**

```sql
-- V20260410_13__canvas_dynamic_field_table.sql

CREATE TABLE IF NOT EXISTS canvas_dynamic_field (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factory_id      VARCHAR(50),
    module_code     VARCHAR(50) NOT NULL,
    field_code      VARCHAR(100) NOT NULL,
    field_type      VARCHAR(20) NOT NULL,
    label           VARCHAR(200) NOT NULL,
    config          JSONB DEFAULT '{}',
    visible_when    VARCHAR(500),
    computed_when   VARCHAR(500),
    sort_order      INT DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'PENDING_DDL',
    column_name     VARCHAR(100),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(factory_id, module_code, field_code)
);

CREATE INDEX idx_cdf_factory_module ON canvas_dynamic_field(factory_id, module_code);
CREATE INDEX idx_cdf_status ON canvas_dynamic_field(status);
```

- [ ] **Step 2: Create canvas_ddl_log migration**

```sql
-- V20260410_14__canvas_ddl_log_table.sql

CREATE TABLE IF NOT EXISTS canvas_ddl_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factory_id      VARCHAR(50),
    config_version  INT,
    ddl_statement   TEXT NOT NULL,
    target_table    VARCHAR(100),
    status          VARCHAR(20) DEFAULT 'PENDING',
    executed_at     TIMESTAMP,
    error_message   TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cdl_factory_version ON canvas_ddl_log(factory_id, config_version);
```

- [ ] **Step 3: Commit**

```bash
git add backend/java/cretas-api/src/main/resources/db/migration/V20260410_13__canvas_dynamic_field_table.sql backend/java/cretas-api/src/main/resources/db/migration/V20260410_14__canvas_ddl_log_table.sql
git commit -m "feat(canvas-v3): add canvas_dynamic_field + canvas_ddl_log tables"
```

---

### Task 2: Entities + Repositories

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/CanvasDynamicField.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/CanvasDDLLog.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/CanvasDynamicFieldRepository.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/CanvasDDLLogRepository.java`

- [ ] **Step 1: Create CanvasDynamicField entity**

```java
package com.cretas.aims.entity.config;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;
import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "canvas_dynamic_field",
    uniqueConstraints = @UniqueConstraint(columnNames = {"factory_id", "module_code", "field_code"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CanvasDynamicField {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "factory_id", length = 50)
    private String factoryId;

    @Column(name = "module_code", length = 50, nullable = false)
    private String moduleCode;

    @Column(name = "field_code", length = 100, nullable = false)
    private String fieldCode;

    @Column(name = "field_type", length = 20, nullable = false)
    private String fieldType; // TEXT, NUMBER, DECIMAL, SELECT, DATE, ATTACHMENT, SUB_TABLE

    @Column(length = 200, nullable = false)
    private String label;

    @Type(JsonBinaryType.class)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> config = Map.of();

    @Column(name = "visible_when", length = 500)
    private String visibleWhen;

    @Column(name = "computed_when", length = 500)
    private String computedWhen;

    @Column(name = "sort_order")
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(length = 20)
    @Builder.Default
    private String status = "PENDING_DDL"; // PENDING_DDL, ACTIVE, DISABLED

    @Column(name = "column_name", length = 100)
    private String columnName;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
        if (columnName == null && fieldCode != null) {
            columnName = "cf_" + fieldCode;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
```

- [ ] **Step 2: Create CanvasDDLLog entity**

```java
package com.cretas.aims.entity.config;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "canvas_ddl_log")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CanvasDDLLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "factory_id", length = 50)
    private String factoryId;

    @Column(name = "config_version")
    private Integer configVersion;

    @Column(name = "ddl_statement", columnDefinition = "TEXT", nullable = false)
    private String ddlStatement;

    @Column(name = "target_table", length = 100)
    private String targetTable;

    @Column(length = 20)
    @Builder.Default
    private String status = "PENDING"; // PENDING, EXECUTED, FAILED, ROLLED_BACK

    @Column(name = "executed_at")
    private LocalDateTime executedAt;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() { createdAt = LocalDateTime.now(); }
}
```

- [ ] **Step 3: Create repositories**

```java
// CanvasDynamicFieldRepository.java
package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.CanvasDynamicField;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface CanvasDynamicFieldRepository extends JpaRepository<CanvasDynamicField, String> {

    List<CanvasDynamicField> findByFactoryIdAndModuleCode(String factoryId, String moduleCode);

    @Query("SELECT f FROM CanvasDynamicField f WHERE (f.factoryId = :factoryId OR f.factoryId IS NULL) AND f.moduleCode = :moduleCode ORDER BY f.sortOrder")
    List<CanvasDynamicField> findByModuleCodeForFactory(String factoryId, String moduleCode);

    List<CanvasDynamicField> findByFactoryIdAndStatus(String factoryId, String status);

    @Query("SELECT f FROM CanvasDynamicField f WHERE (f.factoryId = :factoryId OR f.factoryId IS NULL) AND f.moduleCode = :moduleCode AND f.status = 'ACTIVE' ORDER BY f.sortOrder")
    List<CanvasDynamicField> findActiveByModuleCodeForFactory(String factoryId, String moduleCode);

    Optional<CanvasDynamicField> findByFactoryIdAndModuleCodeAndFieldCode(String factoryId, String moduleCode, String fieldCode);
}
```

```java
// CanvasDDLLogRepository.java
package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.CanvasDDLLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CanvasDDLLogRepository extends JpaRepository<CanvasDDLLog, String> {
    List<CanvasDDLLog> findByFactoryIdOrderByCreatedAtDesc(String factoryId);
    List<CanvasDDLLog> findByFactoryIdAndConfigVersion(String factoryId, Integer configVersion);
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/CanvasDynamicField.java backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/CanvasDDLLog.java backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/CanvasDynamicFieldRepository.java backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/CanvasDDLLogRepository.java
git commit -m "feat(canvas-v3): CanvasDynamicField + CanvasDDLLog entities and repos"
```

---

### Task 3: DDLExecutor

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DDLExecutor.java`

- [ ] **Step 1: Create DDLExecutor**

```java
package com.cretas.aims.engine;

import com.cretas.aims.entity.config.CanvasDDLLog;
import com.cretas.aims.entity.config.CanvasDynamicField;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.config.CanvasDDLLogRepository;
import com.cretas.aims.repository.config.CanvasDynamicFieldRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DDLExecutor {

    private final JdbcTemplate jdbcTemplate;
    private final CanvasDynamicFieldRepository fieldRepo;
    private final CanvasDDLLogRepository ddlLogRepo;

    // Module code → actual table name mapping
    private static final Map<String, String> MODULE_TABLE_MAP = Map.ofEntries(
        Map.entry("sales_order", "sales_orders"),
        Map.entry("bom", "bom_items"),
        Map.entry("production_plan", "production_plans"),
        Map.entry("production_report", "process_work_reports"),
        Map.entry("purchase_order", "purchase_orders"),
        Map.entry("quality_inspection", "quality_inspections"),
        Map.entry("equipment", "equipment"),
        Map.entry("material_batch", "material_batches"),
        Map.entry("customer", "customers"),
        Map.entry("supplier", "suppliers"),
        Map.entry("transfer", "inventory_transfers"),
        Map.entry("invoice_record", "invoice_records"),
        Map.entry("rd_sample", "product_samples"),
        Map.entry("material_requisition", "factory_material_requisitions"),
        Map.entry("product", "products"),
        Map.entry("inventory", "inventory_items"),
        Map.entry("hr_employee", "employees")
    );

    @Transactional
    public void executePendingDDL(String factoryId, int configVersion) {
        List<CanvasDynamicField> pending = fieldRepo.findByFactoryIdAndStatus(factoryId, "PENDING_DDL");
        if (pending.isEmpty()) {
            log.info("No pending DDL for factory {}", factoryId);
            return;
        }

        log.info("Executing {} pending DDL statements for factory {}", pending.size(), factoryId);
        for (CanvasDynamicField field : pending) {
            String ddl = generateDDL(field);
            CanvasDDLLog logEntry = CanvasDDLLog.builder()
                .factoryId(factoryId)
                .configVersion(configVersion)
                .ddlStatement(ddl)
                .targetTable(resolveTableName(field))
                .status("PENDING")
                .build();
            ddlLogRepo.save(logEntry);

            try {
                jdbcTemplate.execute(ddl);
                field.setStatus("ACTIVE");
                fieldRepo.save(field);
                logEntry.setStatus("EXECUTED");
                logEntry.setExecutedAt(LocalDateTime.now());
                ddlLogRepo.save(logEntry);
                log.info("DDL executed: {} → {}.{}", field.getFieldType(), field.getModuleCode(), field.getColumnName());
            } catch (Exception e) {
                logEntry.setStatus("FAILED");
                logEntry.setErrorMessage(e.getMessage());
                ddlLogRepo.save(logEntry);
                throw new BusinessException("DDL 执行失败 [" + field.getModuleCode() + "." + field.getFieldCode() + "]: " + e.getMessage());
            }
        }
    }

    private String generateDDL(CanvasDynamicField field) {
        if ("SUB_TABLE".equals(field.getFieldType())) {
            return generateSubTableDDL(field);
        }
        String tableName = resolveTableName(field);
        String colName = field.getColumnName();
        String colType = mapFieldTypeToSQL(field.getFieldType());
        return "ALTER TABLE " + tableName + " ADD COLUMN IF NOT EXISTS " + colName + " " + colType;
    }

    private String generateSubTableDDL(CanvasDynamicField field) {
        String subTableName = field.getModuleCode() + "_" + field.getFieldCode() + "_items";
        StringBuilder sb = new StringBuilder();
        sb.append("CREATE TABLE IF NOT EXISTS ").append(subTableName).append(" (");
        sb.append("id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ");
        sb.append("parent_id UUID NOT NULL, ");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> columns = (List<Map<String, Object>>) field.getConfig().get("columns");
        if (columns != null) {
            for (Map<String, Object> col : columns) {
                String code = (String) col.get("code");
                String type = (String) col.getOrDefault("type", "TEXT");
                sb.append("cf_").append(code).append(" ").append(mapFieldTypeToSQL(type)).append(", ");
            }
        }
        sb.append("created_at TIMESTAMP DEFAULT NOW(), ");
        sb.append("updated_at TIMESTAMP DEFAULT NOW()");
        sb.append("); ");
        sb.append("CREATE INDEX IF NOT EXISTS idx_").append(subTableName).append("_parent ON ").append(subTableName).append("(parent_id)");
        return sb.toString();
    }

    private String resolveTableName(CanvasDynamicField field) {
        return MODULE_TABLE_MAP.getOrDefault(field.getModuleCode(), field.getModuleCode());
    }

    private String mapFieldTypeToSQL(String fieldType) {
        return switch (fieldType) {
            case "TEXT" -> "VARCHAR(500)";
            case "NUMBER" -> "INTEGER";
            case "DECIMAL" -> "NUMERIC(18,4)";
            case "SELECT" -> "VARCHAR(100)";
            case "DATE" -> "TIMESTAMP";
            case "ATTACHMENT" -> "VARCHAR(2000)";
            default -> "VARCHAR(500)";
        };
    }

    public String resolveTable(String moduleCode) {
        return MODULE_TABLE_MAP.getOrDefault(moduleCode, moduleCode);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DDLExecutor.java
git commit -m "feat(canvas-v3): DDLExecutor — safe DDL execution with audit logging"
```

---

### Task 4: DynamicFieldService + DynamicTableService

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DynamicFieldService.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DynamicTableService.java`

- [ ] **Step 1: Create DynamicFieldService**

```java
package com.cretas.aims.engine;

import com.cretas.aims.entity.config.CanvasDynamicField;
import com.cretas.aims.repository.config.CanvasDynamicFieldRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DynamicFieldService {

    private final JdbcTemplate jdbcTemplate;
    private final CanvasDynamicFieldRepository fieldRepo;
    private final DDLExecutor ddlExecutor;

    // Cache: factoryId:moduleCode → List<CanvasDynamicField>
    private final Map<String, List<CanvasDynamicField>> cache = new ConcurrentHashMap<>();

    public List<CanvasDynamicField> getActiveFields(String factoryId, String moduleCode) {
        String key = factoryId + ":" + moduleCode;
        return cache.computeIfAbsent(key, k ->
            fieldRepo.findActiveByModuleCodeForFactory(factoryId, moduleCode));
    }

    public void refreshCache() {
        cache.clear();
        log.info("DynamicFieldService cache cleared");
    }

    public void refreshCache(String factoryId, String moduleCode) {
        cache.remove(factoryId + ":" + moduleCode);
    }

    public Map<String, Object> getDynamicFields(String factoryId, String moduleCode, String recordId) {
        List<CanvasDynamicField> fields = getActiveFields(factoryId, moduleCode);
        if (fields.isEmpty()) return Map.of();

        String tableName = ddlExecutor.resolveTable(moduleCode);
        List<String> columns = fields.stream()
            .filter(f -> !"SUB_TABLE".equals(f.getFieldType()))
            .map(CanvasDynamicField::getColumnName)
            .collect(Collectors.toList());

        if (columns.isEmpty()) return Map.of();

        String sql = "SELECT " + String.join(", ", columns) + " FROM " + tableName + " WHERE id = ?::uuid";
        try {
            Map<String, Object> row = jdbcTemplate.queryForMap(sql, recordId);
            // Map cf_xxx back to fieldCode
            Map<String, Object> result = new LinkedHashMap<>();
            for (CanvasDynamicField f : fields) {
                if (!"SUB_TABLE".equals(f.getFieldType()) && row.containsKey(f.getColumnName())) {
                    result.put(f.getFieldCode(), row.get(f.getColumnName()));
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("Failed to read dynamic fields for {}/{}: {}", moduleCode, recordId, e.getMessage());
            return Map.of();
        }
    }

    public void setDynamicFields(String factoryId, String moduleCode, String recordId, Map<String, Object> fields) {
        if (fields == null || fields.isEmpty()) return;
        List<CanvasDynamicField> activeDefs = getActiveFields(factoryId, moduleCode);
        Map<String, CanvasDynamicField> defMap = activeDefs.stream()
            .collect(Collectors.toMap(CanvasDynamicField::getFieldCode, f -> f));

        String tableName = ddlExecutor.resolveTable(moduleCode);
        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        for (Map.Entry<String, Object> entry : fields.entrySet()) {
            CanvasDynamicField def = defMap.get(entry.getKey());
            if (def != null && !"SUB_TABLE".equals(def.getFieldType())) {
                setClauses.add(def.getColumnName() + " = ?");
                params.add(entry.getValue());
            }
        }

        if (setClauses.isEmpty()) return;
        params.add(recordId);
        String sql = "UPDATE " + tableName + " SET " + String.join(", ", setClauses) + " WHERE id = ?::uuid";
        jdbcTemplate.update(sql, params.toArray());
    }
}
```

- [ ] **Step 2: Create DynamicTableService**

```java
package com.cretas.aims.engine;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class DynamicTableService {

    private final JdbcTemplate jdbcTemplate;

    public List<Map<String, Object>> getRows(String subTableName, String parentId) {
        String sql = "SELECT * FROM " + subTableName + " WHERE parent_id = ?::uuid ORDER BY created_at";
        return jdbcTemplate.queryForList(sql, parentId);
    }

    public Map<String, Object> addRow(String subTableName, String parentId, Map<String, Object> row) {
        List<String> columns = new ArrayList<>(List.of("parent_id"));
        List<Object> values = new ArrayList<>(List.of(parentId));
        List<String> placeholders = new ArrayList<>(List.of("?::uuid"));

        for (Map.Entry<String, Object> entry : row.entrySet()) {
            String colName = entry.getKey().startsWith("cf_") ? entry.getKey() : "cf_" + entry.getKey();
            columns.add(colName);
            values.add(entry.getValue());
            placeholders.add("?");
        }

        String sql = "INSERT INTO " + subTableName + " (" + String.join(", ", columns) + ") VALUES (" + String.join(", ", placeholders) + ") RETURNING *";
        return jdbcTemplate.queryForMap(sql, values.toArray());
    }

    public void updateRow(String subTableName, String rowId, Map<String, Object> row) {
        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        for (Map.Entry<String, Object> entry : row.entrySet()) {
            String colName = entry.getKey().startsWith("cf_") ? entry.getKey() : "cf_" + entry.getKey();
            setClauses.add(colName + " = ?");
            params.add(entry.getValue());
        }
        setClauses.add("updated_at = NOW()");
        params.add(rowId);

        String sql = "UPDATE " + subTableName + " SET " + String.join(", ", setClauses) + " WHERE id = ?::uuid";
        jdbcTemplate.update(sql, params.toArray());
    }

    public void deleteRow(String subTableName, String rowId) {
        jdbcTemplate.update("DELETE FROM " + subTableName + " WHERE id = ?::uuid", rowId);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DynamicFieldService.java backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DynamicTableService.java
git commit -m "feat(canvas-v3): DynamicFieldService + DynamicTableService — dynamic column/sub-table CRUD"
```

---

### Task 5: AggregateFormulaExecutor + FormulaEngine Routing

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/AggregateFormulaExecutor.java`
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/FormulaEngine.java`

- [ ] **Step 1: Create AggregateFormulaExecutor**

```java
package com.cretas.aims.engine;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
@RequiredArgsConstructor
public class AggregateFormulaExecutor {

    private final JdbcTemplate jdbcTemplate;
    private final DDLExecutor ddlExecutor;

    // Pattern: GROUP_BY(tableName, 'groupField', SUM('valueField'))
    private static final Pattern GROUP_BY_PATTERN =
        Pattern.compile("GROUP_BY\\(\\s*(\\w+)\\s*,\\s*'(\\w+)'\\s*,\\s*(\\w+)\\(\\s*'(\\w+)'\\s*\\)\\s*\\)");

    /**
     * Execute aggregate expression.
     * Supported: GROUP_BY(items, 'taxRate', SUM('amount'))
     * Context must contain parentId for WHERE clause filtering.
     */
    public List<Map<String, Object>> execute(String expression, Map<String, Object> context) {
        Matcher m = GROUP_BY_PATTERN.matcher(expression.trim());
        if (!m.matches()) {
            log.warn("Unsupported aggregate expression: {}", expression);
            return List.of();
        }

        String sourceTable = m.group(1);
        String groupField = m.group(2);
        String aggFunc = m.group(3).toUpperCase(); // SUM, COUNT, AVG, MIN, MAX
        String valueField = m.group(4);

        if (!Set.of("SUM", "COUNT", "AVG", "MIN", "MAX").contains(aggFunc)) {
            log.warn("Unsupported aggregate function: {}", aggFunc);
            return List.of();
        }

        // Resolve table name — could be a module code or direct table name
        String tableName = ddlExecutor.resolveTable(sourceTable);
        // If it looks like a sub-table reference (contains _items), use directly
        if (sourceTable.endsWith("_items")) {
            tableName = sourceTable;
        }

        String parentId = (String) context.get("parentId");
        String factoryId = (String) context.get("factoryId");

        StringBuilder sql = new StringBuilder();
        sql.append("SELECT ").append(groupField).append(", ").append(aggFunc).append("(").append(valueField).append(") as agg_value");
        sql.append(" FROM ").append(tableName);

        List<Object> params = new ArrayList<>();
        List<String> wheres = new ArrayList<>();
        if (parentId != null) {
            // For sub-tables or line items with parent reference
            if (hasColumn(tableName, "parent_id")) {
                wheres.add("parent_id = ?::uuid");
                params.add(parentId);
            } else if (hasColumn(tableName, "order_id")) {
                wheres.add("order_id = ?::uuid");
                params.add(parentId);
            }
        }
        if (factoryId != null && hasColumn(tableName, "factory_id")) {
            wheres.add("factory_id = ?");
            params.add(factoryId);
        }

        if (!wheres.isEmpty()) {
            sql.append(" WHERE ").append(String.join(" AND ", wheres));
        }
        sql.append(" GROUP BY ").append(groupField);

        log.debug("Aggregate SQL: {} params: {}", sql, params);
        return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    }

    private boolean hasColumn(String tableName, String columnName) {
        try {
            Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = ? AND column_name = ?",
                Integer.class, tableName, columnName);
            return count != null && count > 0;
        } catch (Exception e) {
            return false;
        }
    }
}
```

- [ ] **Step 2: Add AGGREGATE routing to FormulaEngine**

In `FormulaEngine.java`, add the aggregate executor injection and routing. The existing `evaluate` method returns `BigDecimal`. Add a new `evaluateAny` method that can return `List<Map>` for aggregates:

```java
// Add to FormulaEngine.java — new field
private final AggregateFormulaExecutor aggregateExecutor;

// Add new method after existing evaluate()
public Object evaluateAny(String factoryId, String moduleCode, String formulaCode, Map<String, Object> variables) {
    Optional<FactoryFormula> formula = formulaRepo.findByFactoryIdAndModuleCodeAndFormulaCode(factoryId, moduleCode, formulaCode);
    if (formula.isEmpty()) {
        formula = formulaRepo.findByFactoryIdAndModuleCodeAndFormulaCode(null, moduleCode, formulaCode);
    }
    if (formula.isEmpty()) return null;

    FactoryFormula f = formula.get();
    if ("AGGREGATE".equals(f.getResultType())) {
        return aggregateExecutor.execute(f.getExpression(), variables);
    }
    return spelEvaluator.evaluateFormula(f.getExpression(), variables, f.getPrecisionVal());
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/engine/AggregateFormulaExecutor.java backend/java/cretas-api/src/main/java/com/cretas/aims/engine/FormulaEngine.java
git commit -m "feat(canvas-v3): AggregateFormulaExecutor + FormulaEngine AGGREGATE routing"
```

---

### Task 6: EffectiveField Extension + getEffectiveConfig Extension

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/config/EffectiveField.java`
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/impl/FactoryConfigServiceImpl.java`

- [ ] **Step 1: Add visibleWhen/computedWhen/source to EffectiveField**

Add 3 fields to the existing EffectiveField DTO after the `extra` field:

```java
// Add after: private Map<String, Object> extra;
private String visibleWhen;   // SpEL condition for frontend conditional rendering
private String computedWhen;  // SpEL expression for frontend dynamic calculation
private String source;        // "jpa" or "dynamic" — tells frontend which CRUD path to use
```

- [ ] **Step 2: Add getEffectiveConfig overload with userId**

Add to `FactoryConfigServiceImpl.java` — a new overload that takes userId:

```java
public EffectiveModuleConfig getEffectiveConfig(String factoryId, String moduleCode, String roleCode, String userId) {
    // Call existing 3-param version
    EffectiveModuleConfig config = getEffectiveConfig(factoryId, moduleCode, roleCode);

    // Merge dynamic fields
    List<CanvasDynamicField> dynamicFields = dynamicFieldService.getActiveFields(factoryId, moduleCode);
    if (!dynamicFields.isEmpty()) {
        List<EffectiveField> allFields = new ArrayList<>(config.getFields());
        for (CanvasDynamicField df : dynamicFields) {
            if ("SUB_TABLE".equals(df.getFieldType())) continue; // sub-tables handled by Tab layout
            EffectiveField ef = EffectiveField.builder()
                .code(df.getFieldCode())
                .label(df.getLabel())
                .type(df.getFieldType().toLowerCase())
                .required(false)
                .visible(true)
                .readonly(false)
                .defaultValue(null)
                .options(df.getConfig().get("options"))
                .group("custom")
                .order(1000 + df.getSortOrder())
                .extra(df.getConfig())
                .visibleWhen(df.getVisibleWhen())
                .computedWhen(df.getComputedWhen())
                .source("dynamic")
                .build();
            allFields.add(ef);
        }
        config.setFields(allFields);
    }

    // Apply user-level permission overrides
    if (userId != null) {
        applyUserPermissions(config.getFields(), factoryId, moduleCode, userId);
    }

    return config;
}
```

- [ ] **Step 3: Add applyUserPermissions helper**

```java
// Add to FactoryConfigServiceImpl.java
@Autowired
private UserMenuPermissionRepository userMenuPermRepo;

private void applyUserPermissions(List<EffectiveField> fields, String factoryId, String moduleCode, String userId) {
    List<UserMenuPermission> perms = userMenuPermRepo.findByFactoryIdAndUserId(factoryId, userId);
    for (UserMenuPermission perm : perms) {
        // menuCode format: moduleCode:fieldCode:hidden or moduleCode:fieldCode:readonly
        String mc = perm.getMenuCode();
        if (!mc.startsWith(moduleCode + ":")) continue;
        String[] parts = mc.split(":");
        if (parts.length < 3) continue;
        String fieldCode = parts[1];
        String permission = parts[2];

        for (EffectiveField field : fields) {
            if (field.getCode().equals(fieldCode)) {
                if ("REVOKE".equals(perm.getGrantType().name())) {
                    if ("hidden".equals(permission)) field.setVisible(false);
                    if ("readonly".equals(permission)) field.setReadonly(true);
                } else { // GRANT
                    if ("hidden".equals(permission)) field.setVisible(true);
                    if ("readonly".equals(permission)) field.setReadonly(false);
                }
            }
        }
    }
}
```

- [ ] **Step 4: Add DDL execution to publishConfig**

In `FactoryConfigServiceImpl.publishConfig()`, add DDL execution before setting PUBLISHED status:

```java
// Add after: "Archive current published" block, before: "Set draft to PUBLISHED"
// Execute pending DDL
ddlExecutor.executePendingDDL(factoryId, draft.getConfigVersion());
dynamicFieldService.refreshCache();
```

Also add field injections at top of class:

```java
@Autowired
private DDLExecutor ddlExecutor;

@Autowired
private DynamicFieldService dynamicFieldService;
```

- [ ] **Step 5: Set source="jpa" for existing fields in buildEffectiveFields**

In the existing `buildEffectiveFields` method, when building EffectiveField from schema, set `.source("jpa")`.

- [ ] **Step 6: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/dto/config/EffectiveField.java backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/impl/FactoryConfigServiceImpl.java
git commit -m "feat(canvas-v3): EffectiveField + getEffectiveConfig — userId + dynamic fields + DDL on publish"
```

---

### Task 7: DynamicFieldController

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/DynamicFieldController.java`

- [ ] **Step 1: Create DynamicFieldController**

```java
package com.cretas.aims.controller;

import com.cretas.aims.engine.DynamicFieldService;
import com.cretas.aims.engine.DynamicTableService;
import com.cretas.aims.entity.config.CanvasDDLLog;
import com.cretas.aims.entity.config.CanvasDynamicField;
import com.cretas.aims.repository.config.CanvasDDLLogRepository;
import com.cretas.aims.repository.config.CanvasDynamicFieldRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/mobile/{factoryId}")
@RequiredArgsConstructor
public class DynamicFieldController {

    private final CanvasDynamicFieldRepository fieldRepo;
    private final CanvasDDLLogRepository ddlLogRepo;
    private final DynamicFieldService dynamicFieldService;
    private final DynamicTableService dynamicTableService;

    // --- Dynamic Field Definition CRUD ---

    @GetMapping("/config/v2/dynamic-fields")
    public ResponseEntity<List<CanvasDynamicField>> getDynamicFields(
            @PathVariable String factoryId,
            @RequestParam(required = false) String moduleCode) {
        List<CanvasDynamicField> fields = moduleCode != null
            ? fieldRepo.findByModuleCodeForFactory(factoryId, moduleCode)
            : fieldRepo.findByFactoryIdAndStatus(factoryId, "ACTIVE");
        return ResponseEntity.ok(fields);
    }

    @PostMapping("/config/v2/dynamic-fields")
    public ResponseEntity<CanvasDynamicField> createDynamicField(
            @PathVariable String factoryId,
            @RequestBody CanvasDynamicField field) {
        field.setFactoryId(factoryId);
        field.setStatus("PENDING_DDL");
        if (field.getColumnName() == null) {
            field.setColumnName("cf_" + field.getFieldCode());
        }
        return ResponseEntity.ok(fieldRepo.save(field));
    }

    @PutMapping("/config/v2/dynamic-fields/{fieldCode}")
    public ResponseEntity<CanvasDynamicField> updateDynamicField(
            @PathVariable String factoryId,
            @PathVariable String fieldCode,
            @RequestBody CanvasDynamicField update) {
        CanvasDynamicField existing = fieldRepo.findByFactoryIdAndModuleCodeAndFieldCode(
            factoryId, update.getModuleCode(), fieldCode).orElseThrow();
        if (update.getLabel() != null) existing.setLabel(update.getLabel());
        if (update.getConfig() != null) existing.setConfig(update.getConfig());
        if (update.getVisibleWhen() != null) existing.setVisibleWhen(update.getVisibleWhen());
        if (update.getComputedWhen() != null) existing.setComputedWhen(update.getComputedWhen());
        if (update.getSortOrder() != null) existing.setSortOrder(update.getSortOrder());
        return ResponseEntity.ok(fieldRepo.save(existing));
    }

    @DeleteMapping("/config/v2/dynamic-fields/{fieldCode}")
    public ResponseEntity<Void> disableDynamicField(
            @PathVariable String factoryId,
            @PathVariable String fieldCode,
            @RequestParam String moduleCode) {
        CanvasDynamicField existing = fieldRepo.findByFactoryIdAndModuleCodeAndFieldCode(
            factoryId, moduleCode, fieldCode).orElseThrow();
        existing.setStatus("DISABLED");
        fieldRepo.save(existing);
        dynamicFieldService.refreshCache(factoryId, moduleCode);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/config/v2/ddl-log")
    public ResponseEntity<List<CanvasDDLLog>> getDDLLog(@PathVariable String factoryId) {
        return ResponseEntity.ok(ddlLogRepo.findByFactoryIdOrderByCreatedAtDesc(factoryId));
    }

    // --- Sub-table CRUD ---

    @GetMapping("/{moduleCode}/{recordId}/sub-table/{fieldCode}")
    public ResponseEntity<List<Map<String, Object>>> getSubTableRows(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @PathVariable String recordId,
            @PathVariable String fieldCode) {
        String subTableName = moduleCode + "_" + fieldCode + "_items";
        return ResponseEntity.ok(dynamicTableService.getRows(subTableName, recordId));
    }

    @PostMapping("/{moduleCode}/{recordId}/sub-table/{fieldCode}")
    public ResponseEntity<Map<String, Object>> addSubTableRow(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @PathVariable String recordId,
            @PathVariable String fieldCode,
            @RequestBody Map<String, Object> row) {
        String subTableName = moduleCode + "_" + fieldCode + "_items";
        return ResponseEntity.ok(dynamicTableService.addRow(subTableName, recordId, row));
    }

    @PutMapping("/{moduleCode}/{recordId}/sub-table/{fieldCode}/{rowId}")
    public ResponseEntity<Void> updateSubTableRow(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @PathVariable String recordId,
            @PathVariable String fieldCode,
            @PathVariable String rowId,
            @RequestBody Map<String, Object> row) {
        String subTableName = moduleCode + "_" + fieldCode + "_items";
        dynamicTableService.updateRow(subTableName, rowId, row);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{moduleCode}/{recordId}/sub-table/{fieldCode}/{rowId}")
    public ResponseEntity<Void> deleteSubTableRow(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @PathVariable String recordId,
            @PathVariable String fieldCode,
            @PathVariable String rowId) {
        String subTableName = moduleCode + "_" + fieldCode + "_items";
        dynamicTableService.deleteRow(subTableName, rowId);
        return ResponseEntity.noContent().build();
    }

    // --- Dynamic field values for a record ---

    @GetMapping("/{moduleCode}/{recordId}/custom-fields")
    public ResponseEntity<Map<String, Object>> getCustomFields(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @PathVariable String recordId) {
        return ResponseEntity.ok(dynamicFieldService.getDynamicFields(factoryId, moduleCode, recordId));
    }

    @PutMapping("/{moduleCode}/{recordId}/custom-fields")
    public ResponseEntity<Void> setCustomFields(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @PathVariable String recordId,
            @RequestBody Map<String, Object> fields) {
        dynamicFieldService.setDynamicFields(factoryId, moduleCode, recordId, fields);
        return ResponseEntity.ok().build();
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/controller/DynamicFieldController.java
git commit -m "feat(canvas-v3): DynamicFieldController — dynamic fields + sub-table + custom-fields API"
```

---

### Task 8: 6 Canvas AI Tools

**Files:**
- Create: 6 files in `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/`

- [ ] **Step 1: Create CanvasAddFieldTool**

```java
package com.cretas.aims.ai.tool.impl.canvas;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.config.CanvasDynamicField;
import com.cretas.aims.repository.config.CanvasDynamicFieldRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.util.*;

@Slf4j
@Component
public class CanvasAddFieldTool extends AbstractBusinessTool {

    @Autowired private CanvasDynamicFieldRepository fieldRepo;

    @Override public String getToolName() { return "canvas_add_field"; }
    @Override public String getDescription() { return "给指定模块添加动态字段（文本/数字/金额/日期/下拉）"; }

    @Override public Map<String, Object> getParametersSchema() {
        return Map.of("type", "object", "properties", Map.of(
            "moduleCode", Map.of("type", "string", "description", "模块代码，如 sales_order"),
            "fieldCode", Map.of("type", "string", "description", "字段代码，如 customer_level"),
            "fieldType", Map.of("type", "string", "enum", List.of("TEXT", "NUMBER", "DECIMAL", "SELECT", "DATE"), "description", "字段类型"),
            "label", Map.of("type", "string", "description", "字段显示名称"),
            "options", Map.of("type", "array", "description", "下拉选项（仅 SELECT 类型）", "items", Map.of("type", "object"))
        ), "required", List.of("moduleCode", "fieldCode", "fieldType", "label"));
    }

    @Override protected List<String> getRequiredParameters() { return List.of("moduleCode", "fieldCode", "fieldType", "label"); }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        String moduleCode = getString(params, "moduleCode");
        String fieldCode = getString(params, "fieldCode");
        String fieldType = getString(params, "fieldType");
        String label = getString(params, "label");

        Map<String, Object> config = new HashMap<>();
        if ("SELECT".equals(fieldType) && params.containsKey("options")) {
            config.put("options", params.get("options"));
        }

        CanvasDynamicField field = CanvasDynamicField.builder()
            .factoryId(factoryId).moduleCode(moduleCode).fieldCode(fieldCode)
            .fieldType(fieldType).label(label).config(config)
            .status("PENDING_DDL").columnName("cf_" + fieldCode).sortOrder(0)
            .build();
        fieldRepo.save(field);
        return buildSimpleResult("已添加动态字段: " + label + " (" + fieldType + ")，发布后生效", Map.of("fieldCode", fieldCode, "status", "PENDING_DDL"));
    }
}
```

- [ ] **Step 2: Create CanvasAddSubTableTool**

```java
package com.cretas.aims.ai.tool.impl.canvas;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.config.CanvasDynamicField;
import com.cretas.aims.repository.config.CanvasDynamicFieldRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.util.*;

@Slf4j
@Component
public class CanvasAddSubTableTool extends AbstractBusinessTool {

    @Autowired private CanvasDynamicFieldRepository fieldRepo;

    @Override public String getToolName() { return "canvas_add_sub_table"; }
    @Override public String getDescription() { return "给指定模块添加子表（一对多关系，如付款记录、追踪记录）"; }

    @Override public Map<String, Object> getParametersSchema() {
        return Map.of("type", "object", "properties", Map.of(
            "moduleCode", Map.of("type", "string", "description", "模块代码"),
            "fieldCode", Map.of("type", "string", "description", "子表代码，如 payment_records"),
            "label", Map.of("type", "string", "description", "子表显示名称"),
            "columns", Map.of("type", "array", "description", "子表列定义", "items", Map.of("type", "object", "properties", Map.of(
                "code", Map.of("type", "string"), "label", Map.of("type", "string"), "type", Map.of("type", "string"))))
        ), "required", List.of("moduleCode", "fieldCode", "label", "columns"));
    }

    @Override protected List<String> getRequiredParameters() { return List.of("moduleCode", "fieldCode", "label", "columns"); }

    @Override
    @SuppressWarnings("unchecked")
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        CanvasDynamicField field = CanvasDynamicField.builder()
            .factoryId(factoryId).moduleCode(getString(params, "moduleCode"))
            .fieldCode(getString(params, "fieldCode")).fieldType("SUB_TABLE")
            .label(getString(params, "label"))
            .config(Map.of("columns", params.get("columns")))
            .status("PENDING_DDL").columnName(null).sortOrder(0)
            .build();
        fieldRepo.save(field);
        return buildSimpleResult("已添加子表: " + field.getLabel() + "，发布后自动建表", Map.of("fieldCode", field.getFieldCode()));
    }
}
```

- [ ] **Step 3: Create CanvasSetVisibilityTool**

```java
package com.cretas.aims.ai.tool.impl.canvas;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.config.CanvasDynamicField;
import com.cretas.aims.repository.config.CanvasDynamicFieldRepository;
import com.cretas.aims.service.config.FactoryConfigService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import java.util.*;

@Slf4j
@Component
public class CanvasSetVisibilityTool extends AbstractBusinessTool {

    @Autowired private CanvasDynamicFieldRepository fieldRepo;
    @Autowired @Lazy private FactoryConfigService configService;

    @Override public String getToolName() { return "canvas_set_visibility"; }
    @Override public String getDescription() { return "设置字段条件显隐规则（如出库后才显示实际金额）"; }

    @Override public Map<String, Object> getParametersSchema() {
        return Map.of("type", "object", "properties", Map.of(
            "moduleCode", Map.of("type", "string"),
            "fieldCode", Map.of("type", "string"),
            "visibleWhen", Map.of("type", "string", "description", "SpEL 条件表达式，如 status == 'SHIPPED'"),
            "computedWhen", Map.of("type", "string", "description", "SpEL 计算表达式（可选）")
        ), "required", List.of("moduleCode", "fieldCode", "visibleWhen"));
    }

    @Override protected List<String> getRequiredParameters() { return List.of("moduleCode", "fieldCode", "visibleWhen"); }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        String moduleCode = getString(params, "moduleCode");
        String fieldCode = getString(params, "fieldCode");
        String visibleWhen = getString(params, "visibleWhen");
        String computedWhen = params.containsKey("computedWhen") ? getString(params, "computedWhen") : null;

        // Try dynamic field first
        Optional<CanvasDynamicField> dynField = fieldRepo.findByFactoryIdAndModuleCodeAndFieldCode(factoryId, moduleCode, fieldCode);
        if (dynField.isPresent()) {
            CanvasDynamicField f = dynField.get();
            f.setVisibleWhen(visibleWhen);
            if (computedWhen != null) f.setComputedWhen(computedWhen);
            fieldRepo.save(f);
        } else {
            // For JPA fields, store in fieldConfig override
            Map<String, Object> extra = new HashMap<>();
            extra.put("visibleWhen", visibleWhen);
            if (computedWhen != null) extra.put("computedWhen", computedWhen);
            configService.updateFieldExtra(factoryId, moduleCode, fieldCode, extra);
        }
        return buildSimpleResult("已设置条件显隐: " + fieldCode + " → " + visibleWhen, Map.of("fieldCode", fieldCode));
    }
}
```

- [ ] **Step 4: Create CanvasSetFormulaTool, CanvasSetUserPermissionTool, CanvasAddAttachmentFieldTool**

```java
// CanvasSetFormulaTool.java
package com.cretas.aims.ai.tool.impl.canvas;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.config.FactoryFormula;
import com.cretas.aims.repository.config.FactoryFormulaRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.util.*;

@Slf4j
@Component
public class CanvasSetFormulaTool extends AbstractBusinessTool {

    @Autowired private FactoryFormulaRepository formulaRepo;

    @Override public String getToolName() { return "canvas_set_formula"; }
    @Override public String getDescription() { return "设置聚合公式（如按税率分组汇总金额）"; }

    @Override public Map<String, Object> getParametersSchema() {
        return Map.of("type", "object", "properties", Map.of(
            "moduleCode", Map.of("type", "string"),
            "formulaCode", Map.of("type", "string"),
            "expression", Map.of("type", "string", "description", "聚合表达式，如 GROUP_BY(sales_order_items, 'tax_rate', SUM('amount'))"),
            "description", Map.of("type", "string")
        ), "required", List.of("moduleCode", "formulaCode", "expression"));
    }

    @Override protected List<String> getRequiredParameters() { return List.of("moduleCode", "formulaCode", "expression"); }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        FactoryFormula formula = FactoryFormula.builder()
            .factoryId(factoryId).moduleCode(getString(params, "moduleCode"))
            .formulaCode(getString(params, "formulaCode"))
            .expression(getString(params, "expression"))
            .resultType("AGGREGATE").precisionVal(2)
            .build();
        formulaRepo.save(formula);
        return buildSimpleResult("已添加聚合公式: " + formula.getFormulaCode(), Map.of("formulaCode", formula.getFormulaCode()));
    }
}
```

```java
// CanvasSetUserPermissionTool.java
package com.cretas.aims.ai.tool.impl.canvas;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.auth.UserMenuPermission;
import com.cretas.aims.repository.auth.UserMenuPermissionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.util.*;

@Slf4j
@Component
public class CanvasSetUserPermissionTool extends AbstractBusinessTool {

    @Autowired private UserMenuPermissionRepository permRepo;

    @Override public String getToolName() { return "canvas_set_user_permission"; }
    @Override public String getDescription() { return "设置用户级字段权限（指定某人能看/不能看某字段）"; }

    @Override public Map<String, Object> getParametersSchema() {
        return Map.of("type", "object", "properties", Map.of(
            "userId", Map.of("type", "string", "description", "用户 ID"),
            "moduleCode", Map.of("type", "string"),
            "fieldCode", Map.of("type", "string"),
            "permission", Map.of("type", "string", "enum", List.of("hidden", "readonly", "visible"), "description", "权限类型"),
            "grantType", Map.of("type", "string", "enum", List.of("GRANT", "REVOKE"), "description", "授予或撤销")
        ), "required", List.of("userId", "moduleCode", "fieldCode", "permission", "grantType"));
    }

    @Override protected List<String> getRequiredParameters() { return List.of("userId", "moduleCode", "fieldCode", "permission", "grantType"); }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        String menuCode = getString(params, "moduleCode") + ":" + getString(params, "fieldCode") + ":" + getString(params, "permission");
        UserMenuPermission perm = new UserMenuPermission();
        perm.setFactoryId(factoryId);
        perm.setUserId(getString(params, "userId"));
        perm.setMenuCode(menuCode);
        perm.setGrantType(UserMenuPermission.GrantType.valueOf(getString(params, "grantType")));
        permRepo.save(perm);
        return buildSimpleResult("已设置用户权限: " + menuCode, Map.of("userId", perm.getUserId()));
    }
}
```

```java
// CanvasAddAttachmentFieldTool.java
package com.cretas.aims.ai.tool.impl.canvas;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.config.CanvasDynamicField;
import com.cretas.aims.repository.config.CanvasDynamicFieldRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.util.*;

@Slf4j
@Component
public class CanvasAddAttachmentFieldTool extends AbstractBusinessTool {

    @Autowired private CanvasDynamicFieldRepository fieldRepo;

    @Override public String getToolName() { return "canvas_add_attachment_field"; }
    @Override public String getDescription() { return "给指定模块添加附件上传字段（PDF/图片/文档）"; }

    @Override public Map<String, Object> getParametersSchema() {
        return Map.of("type", "object", "properties", Map.of(
            "moduleCode", Map.of("type", "string"),
            "fieldCode", Map.of("type", "string"),
            "label", Map.of("type", "string"),
            "accept", Map.of("type", "string", "description", "允许的文件类型，如 .pdf,.jpg,.png"),
            "maxSize", Map.of("type", "integer", "description", "最大文件大小（字节），默认 10MB"),
            "maxCount", Map.of("type", "integer", "description", "最大文件数量，默认 1")
        ), "required", List.of("moduleCode", "fieldCode", "label"));
    }

    @Override protected List<String> getRequiredParameters() { return List.of("moduleCode", "fieldCode", "label"); }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        Map<String, Object> config = new HashMap<>();
        config.put("accept", params.getOrDefault("accept", ".pdf,.jpg,.png,.doc,.docx"));
        config.put("maxSize", params.getOrDefault("maxSize", 10485760));
        config.put("maxCount", params.getOrDefault("maxCount", 1));

        CanvasDynamicField field = CanvasDynamicField.builder()
            .factoryId(factoryId).moduleCode(getString(params, "moduleCode"))
            .fieldCode(getString(params, "fieldCode")).fieldType("ATTACHMENT")
            .label(getString(params, "label")).config(config)
            .status("PENDING_DDL").columnName("cf_" + getString(params, "fieldCode"))
            .build();
        fieldRepo.save(field);
        return buildSimpleResult("已添加附件字段: " + field.getLabel(), Map.of("fieldCode", field.getFieldCode()));
    }
}
```

- [ ] **Step 5: Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasAddFieldTool.java backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasAddSubTableTool.java backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasSetVisibilityTool.java backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasSetFormulaTool.java backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasSetUserPermissionTool.java backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasAddAttachmentFieldTool.java
git commit -m "feat(canvas-v3): 6 new AI Tools — add_field/sub_table/visibility/formula/permission/attachment"
```

---

### Task 9: Build + Verify V3 Backend

- [ ] **Step 1: Build**

```bash
cd backend/java/cretas-api && mvn compile -Dmaven.test.skip=true
```

Expected: BUILD SUCCESS

- [ ] **Step 2: Fix any compilation errors, then commit fixes**

- [ ] **Step 3: WIP commit if any fixes needed**

```bash
git add -u && git commit -m "fix(canvas-v3): compilation fixes"
```

---

## Phase 2: V4a Frontend Rendering

### Task 10: TypeScript Types + API Functions

**Files:**
- Modify: `web-admin/src/types/canvas.ts`
- Modify: `web-admin/src/api/canvasApi.ts`

- [ ] **Step 1: Add types to canvas.ts**

Append to end of `web-admin/src/types/canvas.ts`:

```typescript
// Canvas V3 Dynamic Fields
export type DynamicFieldType = 'TEXT' | 'NUMBER' | 'DECIMAL' | 'SELECT' | 'DATE' | 'ATTACHMENT' | 'SUB_TABLE'
export type DynamicFieldStatus = 'PENDING_DDL' | 'ACTIVE' | 'DISABLED'

export interface DynamicFieldConfig {
  maxLength?: number
  min?: number
  max?: number
  precision?: number
  options?: Array<{ value: string; label: string }>
  accept?: string
  maxSize?: number
  maxCount?: number
  columns?: Array<{ code: string; label: string; type: string; required?: boolean }>
}

export interface DynamicField {
  id: string
  factoryId: string | null
  moduleCode: string
  fieldCode: string
  fieldType: DynamicFieldType
  label: string
  config: DynamicFieldConfig
  visibleWhen?: string
  computedWhen?: string
  sortOrder: number
  status: DynamicFieldStatus
  columnName?: string
}

export interface DDLLog {
  id: string
  factoryId: string
  configVersion: number
  ddlStatement: string
  targetTable: string
  status: 'PENDING' | 'EXECUTED' | 'FAILED' | 'ROLLED_BACK'
  executedAt?: string
  errorMessage?: string
}
```

- [ ] **Step 2: Add API functions to canvasApi.ts**

Append to end of `web-admin/src/api/canvasApi.ts`:

```typescript
// Dynamic Fields
export const getDynamicFields = (factoryId: string, moduleCode?: string) =>
  request.get<DynamicField[]>(`${v2(factoryId)}/dynamic-fields`, { params: { moduleCode } })
export const createDynamicField = (factoryId: string, field: Partial<DynamicField>) =>
  request.post<DynamicField>(`${v2(factoryId)}/dynamic-fields`, field)
export const updateDynamicField = (factoryId: string, fieldCode: string, field: Partial<DynamicField>) =>
  request.put<DynamicField>(`${v2(factoryId)}/dynamic-fields/${fieldCode}`, field)
export const deleteDynamicField = (factoryId: string, fieldCode: string, moduleCode: string) =>
  request.delete(`${v2(factoryId)}/dynamic-fields/${fieldCode}`, { params: { moduleCode } })
export const getDDLLog = (factoryId: string) =>
  request.get<DDLLog[]>(`${v2(factoryId)}/ddl-log`)

// Sub-table CRUD
export const getSubTableRows = (factoryId: string, moduleCode: string, recordId: string, fieldCode: string) =>
  request.get<Record<string, unknown>[]>(`/${factoryId}/${moduleCode}/${recordId}/sub-table/${fieldCode}`)
export const addSubTableRow = (factoryId: string, moduleCode: string, recordId: string, fieldCode: string, row: Record<string, unknown>) =>
  request.post(`/${factoryId}/${moduleCode}/${recordId}/sub-table/${fieldCode}`, row)
export const updateSubTableRow = (factoryId: string, moduleCode: string, recordId: string, fieldCode: string, rowId: string, row: Record<string, unknown>) =>
  request.put(`/${factoryId}/${moduleCode}/${recordId}/sub-table/${fieldCode}/${rowId}`, row)
export const deleteSubTableRow = (factoryId: string, moduleCode: string, recordId: string, fieldCode: string, rowId: string) =>
  request.delete(`/${factoryId}/${moduleCode}/${recordId}/sub-table/${fieldCode}/${rowId}`)

// Custom fields for a record
export const getCustomFields = (factoryId: string, moduleCode: string, recordId: string) =>
  request.get<Record<string, unknown>>(`/${factoryId}/${moduleCode}/${recordId}/custom-fields`)
export const setCustomFields = (factoryId: string, moduleCode: string, recordId: string, fields: Record<string, unknown>) =>
  request.put(`/${factoryId}/${moduleCode}/${recordId}/custom-fields`, fields)
```

- [ ] **Step 3: Commit**

```bash
git add web-admin/src/types/canvas.ts web-admin/src/api/canvasApi.ts
git commit -m "feat(canvas-v4a): TypeScript types + API functions for dynamic fields/sub-tables"
```

---

### Task 11: SpEL Evaluator + SubTableEditor + AttachmentUploader

**Files:**
- Create: `web-admin/src/utils/spelEvaluator.ts`
- Create: `web-admin/src/views/modules/components/SubTableEditor.vue`
- Create: `web-admin/src/views/modules/components/AttachmentUploader.vue`

- [ ] **Step 1: Create SpEL evaluator**

```typescript
// web-admin/src/utils/spelEvaluator.ts

/**
 * Lightweight SpEL-to-JS evaluator for frontend conditional rendering.
 * Supports: ==, !=, >, <, >=, <=, &&, ||, !, ternary, property access.
 */
export function evaluateSpel(expression: string, context: Record<string, unknown>): unknown {
  if (!expression || !expression.trim()) return true

  // Replace SpEL-style property access with JS-safe access
  let jsExpr = expression
    .replace(/\band\b/gi, '&&')
    .replace(/\bor\b/gi, '||')
    .replace(/\bnot\b/gi, '!')
    .replace(/\beq\b/gi, '==')
    .replace(/\bne\b/gi, '!=')
    .replace(/\bge\b/gi, '>=')
    .replace(/\ble\b/gi, '<=')
    .replace(/\bgt\b/gi, '>')
    .replace(/\blt\b/gi, '<')

  try {
    // Build a function with context variables in scope
    const keys = Object.keys(context)
    const values = Object.values(context)
    const fn = new Function(...keys, `return (${jsExpr})`)
    return fn(...values)
  } catch (e) {
    console.warn('SpEL evaluation failed:', expression, e)
    return true // Default to visible on error
  }
}

export function evaluateSpelBoolean(expression: string, context: Record<string, unknown>): boolean {
  return Boolean(evaluateSpel(expression, context))
}

export function evaluateSpelValue(expression: string, context: Record<string, unknown>): unknown {
  return evaluateSpel(expression, context)
}
```

- [ ] **Step 2: Create SubTableEditor**

```vue
<!-- web-admin/src/views/modules/components/SubTableEditor.vue -->
<template>
  <div class="sub-table-editor">
    <div class="sub-table-header">
      <span class="sub-table-title">{{ label }}</span>
      <el-button v-if="!readonly" type="primary" size="small" @click="addRow">
        <el-icon><Plus /></el-icon> 添加行
      </el-button>
    </div>
    <el-table :data="rows" border size="small" style="width: 100%">
      <el-table-column v-for="col in columns" :key="col.code" :label="col.label" :prop="'cf_' + col.code" min-width="120">
        <template #default="{ row, $index }">
          <template v-if="readonly">{{ row['cf_' + col.code] }}</template>
          <template v-else>
            <el-input v-if="col.type === 'TEXT'" v-model="row['cf_' + col.code]" size="small" @change="markDirty($index)" />
            <el-input-number v-else-if="col.type === 'NUMBER' || col.type === 'DECIMAL'" v-model="row['cf_' + col.code]" size="small" :precision="col.type === 'DECIMAL' ? 2 : 0" @change="markDirty($index)" />
            <el-date-picker v-else-if="col.type === 'DATE'" v-model="row['cf_' + col.code]" size="small" type="date" @change="markDirty($index)" />
            <el-input v-else v-model="row['cf_' + col.code]" size="small" @change="markDirty($index)" />
          </template>
        </template>
      </el-table-column>
      <el-table-column v-if="!readonly" label="操作" width="100" fixed="right">
        <template #default="{ row, $index }">
          <el-button type="danger" size="small" text @click="removeRow($index, row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { getSubTableRows, addSubTableRow, updateSubTableRow, deleteSubTableRow } from '@/api/canvasApi'

const props = defineProps<{
  factoryId: string
  moduleCode: string
  recordId: string
  fieldCode: string
  label: string
  columns: Array<{ code: string; label: string; type: string }>
  readonly?: boolean
}>()

const rows = ref<Record<string, unknown>[]>([])
const dirtyRows = ref<Set<number>>(new Set())

onMounted(async () => {
  if (props.recordId) {
    const { data } = await getSubTableRows(props.factoryId, props.moduleCode, props.recordId, props.fieldCode)
    rows.value = data || []
  }
})

function addRow() {
  const newRow: Record<string, unknown> = {}
  for (const col of props.columns) {
    newRow['cf_' + col.code] = null
  }
  rows.value.push(newRow)
}

function markDirty(index: number) {
  dirtyRows.value.add(index)
}

async function removeRow(index: number, row: Record<string, unknown>) {
  if (row.id) {
    await deleteSubTableRow(props.factoryId, props.moduleCode, props.recordId, props.fieldCode, row.id as string)
  }
  rows.value.splice(index, 1)
}

async function saveAll() {
  for (const index of dirtyRows.value) {
    const row = rows.value[index]
    if (!row) continue
    if (row.id) {
      await updateSubTableRow(props.factoryId, props.moduleCode, props.recordId, props.fieldCode, row.id as string, row)
    } else {
      const { data } = await addSubTableRow(props.factoryId, props.moduleCode, props.recordId, props.fieldCode, row)
      rows.value[index] = data
    }
  }
  dirtyRows.value.clear()
}

defineExpose({ saveAll })
</script>

<style scoped>
.sub-table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.sub-table-title { font-weight: 600; font-size: 14px; }
</style>
```

- [ ] **Step 3: Create AttachmentUploader**

```vue
<!-- web-admin/src/views/modules/components/AttachmentUploader.vue -->
<template>
  <div class="attachment-uploader">
    <el-upload
      :action="uploadUrl"
      :headers="headers"
      :accept="accept"
      :limit="maxCount"
      :file-list="fileList"
      :disabled="readonly"
      :before-upload="beforeUpload"
      :on-success="onSuccess"
      :on-remove="onRemove"
    >
      <el-button v-if="!readonly" size="small" type="primary">
        <el-icon><Upload /></el-icon> 上传文件
      </el-button>
      <template #tip>
        <div class="el-upload__tip">{{ accept }}，最大 {{ formatSize(maxSize) }}</div>
      </template>
    </el-upload>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  modelValue?: string | string[]
  factoryId: string
  accept?: string
  maxSize?: number
  maxCount?: number
  readonly?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [val: string | string[]] }>()

const authStore = useAuthStore()
const uploadUrl = computed(() => `/api/mobile/${props.factoryId}/upload`)
const headers = computed(() => ({ Authorization: `Bearer ${authStore.token}` }))
const accept = computed(() => props.accept || '.pdf,.jpg,.png,.doc,.docx')
const maxSize = computed(() => props.maxSize || 10485760)
const maxCount = computed(() => props.maxCount || 1)

const fileList = ref<Array<{ name: string; url: string }>>([])

watch(() => props.modelValue, (val) => {
  if (!val) { fileList.value = []; return }
  const urls = Array.isArray(val) ? val : [val]
  fileList.value = urls.map(url => ({ name: url.split('/').pop() || 'file', url }))
}, { immediate: true })

function beforeUpload(file: File) {
  if (file.size > maxSize.value) {
    ElMessage.error(`文件大小不能超过 ${formatSize(maxSize.value)}`)
    return false
  }
  return true
}

function onSuccess(response: { data: { url: string } }) {
  const url = response.data?.url
  if (!url) return
  if (maxCount.value === 1) {
    emit('update:modelValue', url)
  } else {
    const current = Array.isArray(props.modelValue) ? [...props.modelValue] : props.modelValue ? [props.modelValue] : []
    current.push(url)
    emit('update:modelValue', current)
  }
}

function onRemove(_file: unknown, fileListNew: Array<{ url: string }>) {
  const urls = fileListNew.map(f => f.url)
  emit('update:modelValue', maxCount.value === 1 ? (urls[0] || '') : urls)
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + 'KB'
  return (bytes / 1048576).toFixed(0) + 'MB'
}
</script>
```

- [ ] **Step 4: Commit**

```bash
git add web-admin/src/utils/spelEvaluator.ts web-admin/src/views/modules/components/SubTableEditor.vue web-admin/src/views/modules/components/AttachmentUploader.vue
git commit -m "feat(canvas-v4a): SpEL evaluator + SubTableEditor + AttachmentUploader"
```

---

### Task 12: Extend SchemaFormRenderer

**Files:**
- Modify: `web-admin/src/views/modules/components/SchemaFormRenderer.vue`

- [ ] **Step 1: Add imports and new field type rendering**

In SchemaFormRenderer.vue, add imports for the new components and SpEL evaluator at the top of `<script setup>`:

```typescript
import { evaluateSpelBoolean, evaluateSpelValue } from '@/utils/spelEvaluator'
import SubTableEditor from './SubTableEditor.vue'
import AttachmentUploader from './AttachmentUploader.vue'
```

- [ ] **Step 2: Add visibleWhen evaluation to field visibility logic**

Replace the existing `isFieldShown` logic (or extend it) to incorporate `visibleWhen`:

```typescript
function isFieldVisible(field: EffectiveField): boolean {
  if (!field.visible) return false
  // Existing dependsOn logic
  if (field.extra?.dependsOn) {
    const depValue = formData.value[field.extra.dependsOn as string]
    if (!depValue) return false
  }
  // V3: visibleWhen SpEL
  if (field.visibleWhen) {
    return evaluateSpelBoolean(field.visibleWhen, formData.value)
  }
  return true
}
```

- [ ] **Step 3: Add computedWhen reactive calculation**

Add a computed values map that re-evaluates on form data changes:

```typescript
const computedValues = computed(() => {
  const result: Record<string, unknown> = {}
  for (const field of allFields.value) {
    if (field.computedWhen) {
      result[field.code] = evaluateSpelValue(field.computedWhen, formData.value)
    }
  }
  return result
})
```

In the template, for fields with `computedWhen`, display the computed value instead of formData:

```html
<template v-if="field.computedWhen">
  <span class="computed-value">{{ computedValues[field.code] }}</span>
</template>
```

- [ ] **Step 4: Add attachment and sub_table rendering in template**

After the existing `line_items` case, add:

```html
<!-- Attachment field -->
<template v-else-if="field.type === 'attachment'">
  <AttachmentUploader
    v-model="formData[field.code]"
    :factory-id="factoryId"
    :accept="field.extra?.accept"
    :max-size="field.extra?.maxSize"
    :max-count="field.extra?.maxCount"
    :readonly="isReadonly(field)"
  />
</template>

<!-- Sub-table field -->
<template v-else-if="field.type === 'sub_table'">
  <SubTableEditor
    ref="subTableRefs[field.code]"
    :factory-id="factoryId"
    :module-code="moduleCode"
    :record-id="recordId"
    :field-code="field.code"
    :label="field.label"
    :columns="field.extra?.columns || []"
    :readonly="isReadonly(field)"
  />
</template>
```

Add props for `factoryId` and `recordId`:

```typescript
const props = defineProps<{
  moduleCode: string
  mode: 'create' | 'edit' | 'view'
  initialData?: Record<string, unknown>
  factoryId?: string   // NEW
  recordId?: string    // NEW
}>()
```

- [ ] **Step 5: Commit**

```bash
git add web-admin/src/views/modules/components/SchemaFormRenderer.vue
git commit -m "feat(canvas-v4a): SchemaFormRenderer — attachment/sub_table/visibleWhen/computedWhen"
```

---

### Task 13: TabLayoutRenderer + DynamicModulePage Extension

**Files:**
- Create: `web-admin/src/views/modules/components/TabLayoutRenderer.vue`
- Modify: `web-admin/src/views/modules/DynamicModulePage.vue`

- [ ] **Step 1: Create TabLayoutRenderer**

```vue
<!-- web-admin/src/views/modules/components/TabLayoutRenderer.vue -->
<template>
  <el-tabs v-model="activeTab" type="border-card">
    <el-tab-pane v-for="tab in tabs" :key="tab.code" :label="tab.label" :name="tab.code">
      <!-- Field group tab -->
      <template v-if="!tab.type || tab.type === 'fields'">
        <SchemaFormRenderer
          :module-code="moduleCode"
          :mode="mode"
          :initial-data="initialData"
          :factory-id="factoryId"
          :record-id="recordId"
          :field-filter="tab.fieldCodes"
          @submit="$emit('submit', $event)"
          @cancel="$emit('cancel')"
        />
      </template>

      <!-- Sub-table tab -->
      <template v-else-if="tab.type === 'sub_table'">
        <SubTableEditor
          :factory-id="factoryId"
          :module-code="moduleCode"
          :record-id="recordId || ''"
          :field-code="tab.fieldCode || tab.code"
          :label="tab.label"
          :columns="tab.columns || []"
          :readonly="mode === 'view'"
        />
      </template>

      <!-- Reference table tab -->
      <template v-else-if="tab.type === 'ref_table'">
        <div class="ref-table-placeholder">
          <el-empty description="关联记录加载中..." />
        </div>
      </template>
    </el-tab-pane>
  </el-tabs>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SchemaFormRenderer from './SchemaFormRenderer.vue'
import SubTableEditor from './SubTableEditor.vue'

interface TabConfig {
  code: string
  label: string
  type?: 'fields' | 'sub_table' | 'ref_table'
  fieldCodes?: string[]
  fieldCode?: string
  columns?: Array<{ code: string; label: string; type: string }>
  refModule?: string
}

const props = defineProps<{
  tabs: TabConfig[]
  moduleCode: string
  mode: 'create' | 'edit' | 'view'
  initialData?: Record<string, unknown>
  factoryId: string
  recordId?: string
  defaultTab?: string
}>()

defineEmits<{ submit: [data: Record<string, unknown>]; cancel: [] }>()

const activeTab = ref(props.defaultTab || props.tabs[0]?.code || '')
</script>
```

- [ ] **Step 2: Extend DynamicModulePage to use TabLayoutRenderer**

In `DynamicModulePage.vue`, add conditional rendering: if `layoutConfig.tabs` exists, use `TabLayoutRenderer`; otherwise fall back to existing `SchemaFormRenderer`.

Add to template (in the detail/edit/create views):

```html
<!-- When layoutConfig has tabs -->
<template v-if="layoutTabs.length > 0">
  <TabLayoutRenderer
    :tabs="layoutTabs"
    :module-code="moduleCode"
    :mode="currentView === 'detail' ? 'view' : currentView"
    :initial-data="selectedRow || undefined"
    :factory-id="factoryId"
    :record-id="selectedRow?.id as string"
    @submit="handleSubmitFromTab"
    @cancel="currentView = 'list'"
  />
</template>
<!-- Fallback: existing SchemaFormRenderer -->
<template v-else>
  <!-- existing SchemaFormRenderer code -->
</template>
```

Add computed:

```typescript
import TabLayoutRenderer from './components/TabLayoutRenderer.vue'

const layoutTabs = computed(() => {
  if (!config.value) return []
  // layoutConfig might be in the module config
  const layout = config.value.layoutConfig
  if (layout && typeof layout === 'object' && 'tabs' in layout) {
    return (layout as { tabs: unknown[] }).tabs
  }
  return []
})
```

- [ ] **Step 3: Commit**

```bash
git add web-admin/src/views/modules/components/TabLayoutRenderer.vue web-admin/src/views/modules/DynamicModulePage.vue
git commit -m "feat(canvas-v4a): TabLayoutRenderer + DynamicModulePage tab-driven layout"
```

---

## Phase 3: V4b PageEditor

### Task 14: Install vuedraggable + usePageEditor composable

**Files:**
- Modify: `web-admin/package.json`
- Create: `web-admin/src/views/platform/canvas-editor/composables/usePageEditor.ts`

- [ ] **Step 1: Install vuedraggable**

```bash
cd web-admin && npm install vuedraggable@next
```

- [ ] **Step 2: Create usePageEditor composable**

```typescript
// web-admin/src/views/platform/canvas-editor/composables/usePageEditor.ts
import { ref, computed } from 'vue'
import type { DynamicField, DynamicFieldType } from '@/types/canvas'

export interface PaletteItem {
  type: DynamicFieldType
  label: string
  icon: string
  category: 'basic' | 'extended' | 'layout'
}

export const FIELD_PALETTE: PaletteItem[] = [
  { type: 'TEXT', label: '文本', icon: 'EditPen', category: 'basic' },
  { type: 'NUMBER', label: '数字', icon: 'Odometer', category: 'basic' },
  { type: 'DECIMAL', label: '金额', icon: 'Money', category: 'basic' },
  { type: 'DATE', label: '日期', icon: 'Calendar', category: 'basic' },
  { type: 'SELECT', label: '下拉选择', icon: 'ArrowDown', category: 'basic' },
  { type: 'ATTACHMENT', label: '附件', icon: 'Paperclip', category: 'extended' },
  { type: 'SUB_TABLE', label: '子表', icon: 'Grid', category: 'extended' },
]

const selectedField = ref<DynamicField | null>(null)
const previewMode = ref<'desktop' | 'mobile'>('desktop')
const previewRole = ref<string>('factory_super_admin')
const isDirty = ref(false)

export function usePageEditor() {
  function selectField(field: DynamicField | null) {
    selectedField.value = field
  }

  function setDirty() {
    isDirty.value = true
  }

  function clearDirty() {
    isDirty.value = false
  }

  return {
    selectedField,
    previewMode,
    previewRole,
    isDirty,
    selectField,
    setDirty,
    clearDirty,
    FIELD_PALETTE,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add web-admin/package.json web-admin/package-lock.json web-admin/src/views/platform/canvas-editor/composables/usePageEditor.ts
git commit -m "feat(canvas-v4b): vuedraggable + usePageEditor composable"
```

---

### Task 15: FieldPalette + FormCanvas

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/FieldPalette.vue`
- Create: `web-admin/src/views/platform/canvas-editor/components/FormCanvas.vue`

- [ ] **Step 1: Create FieldPalette**

```vue
<!-- web-admin/src/views/platform/canvas-editor/components/FieldPalette.vue -->
<template>
  <div class="field-palette">
    <div class="palette-section" v-for="cat in categories" :key="cat.key">
      <div class="section-title">{{ cat.label }}</div>
      <draggable
        :list="cat.items"
        :group="{ name: 'fields', pull: 'clone', put: false }"
        :clone="cloneItem"
        item-key="type"
        class="palette-list"
      >
        <template #item="{ element }">
          <div class="palette-item">
            <el-icon><component :is="element.icon" /></el-icon>
            <span>{{ element.label }}</span>
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import draggable from 'vuedraggable'
import { FIELD_PALETTE, type PaletteItem } from '../composables/usePageEditor'
import type { DynamicField } from '@/types/canvas'

const emit = defineEmits<{ 'field-added': [field: Partial<DynamicField>] }>()

const categories = computed(() => [
  { key: 'basic', label: '基础字段', items: FIELD_PALETTE.filter(p => p.category === 'basic') },
  { key: 'extended', label: '扩展字段', items: FIELD_PALETTE.filter(p => p.category === 'extended') },
])

function cloneItem(item: PaletteItem): Partial<DynamicField> {
  const field: Partial<DynamicField> = {
    fieldType: item.type,
    label: item.label,
    fieldCode: `field_${Date.now()}`,
    status: 'PENDING_DDL',
    sortOrder: 999,
    config: {},
  }
  emit('field-added', field)
  return field
}
</script>

<style scoped>
.field-palette { padding: 12px; }
.section-title { font-size: 12px; color: #909399; margin: 12px 0 6px; font-weight: 600; }
.palette-list { display: flex; flex-wrap: wrap; gap: 6px; }
.palette-item {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 10px; border: 1px solid #dcdfe6; border-radius: 4px;
  font-size: 13px; cursor: grab; background: #fff;
  transition: border-color 0.2s;
}
.palette-item:hover { border-color: #409eff; color: #409eff; }
</style>
```

- [ ] **Step 2: Create FormCanvas**

```vue
<!-- web-admin/src/views/platform/canvas-editor/components/FormCanvas.vue -->
<template>
  <div class="form-canvas">
    <div class="canvas-toolbar">
      <span class="toolbar-title">{{ moduleCode }} — 字段布局</span>
      <el-tag size="small" type="info">{{ fields.length }} 个字段</el-tag>
    </div>

    <draggable
      v-model="fields"
      group="fields"
      item-key="fieldCode"
      class="canvas-field-list"
      ghost-class="ghost"
      @change="onReorder"
    >
      <template #item="{ element, index }">
        <div
          class="canvas-field-item"
          :class="{ selected: selectedField?.fieldCode === element.fieldCode, dynamic: element.source === 'dynamic' }"
          @click="selectField(element)"
        >
          <el-icon class="drag-handle"><Rank /></el-icon>
          <div class="field-info">
            <span class="field-label">{{ element.label }}</span>
            <el-tag size="small" :type="element.source === 'dynamic' ? 'warning' : 'info'">
              {{ element.fieldType || element.type }}
            </el-tag>
            <el-tag v-if="element.status === 'PENDING_DDL'" size="small" type="danger">待发布</el-tag>
          </div>
          <div class="field-code">{{ element.fieldCode || element.code }}</div>
          <el-button
            v-if="element.source === 'dynamic'"
            type="danger" text size="small"
            @click.stop="$emit('remove-field', index)"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </template>
    </draggable>

    <div v-if="fields.length === 0" class="canvas-empty">
      <el-empty description="从左侧拖入字段" :image-size="80" />
    </div>
  </div>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'
import { Rank, Delete } from '@element-plus/icons-vue'
import { usePageEditor } from '../composables/usePageEditor'

const { selectedField, selectField, setDirty } = usePageEditor()

const fields = defineModel<any[]>('fields', { required: true })

defineEmits<{ 'remove-field': [index: number] }>()

function onReorder() {
  setDirty()
  // Update sortOrder based on new positions
  fields.value.forEach((f: any, i: number) => {
    f.sortOrder = i
  })
}
</script>

<style scoped>
.form-canvas { flex: 1; padding: 16px; overflow-y: auto; }
.canvas-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.toolbar-title { font-weight: 600; font-size: 15px; }
.canvas-field-list { display: flex; flex-direction: column; gap: 4px; min-height: 200px; }
.canvas-field-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border: 1px solid #ebeef5; border-radius: 4px; cursor: pointer; background: #fff;
  transition: all 0.2s;
}
.canvas-field-item:hover { border-color: #c0c4cc; }
.canvas-field-item.selected { border-color: #409eff; background: #ecf5ff; }
.canvas-field-item.dynamic { border-left: 3px solid #e6a23c; }
.drag-handle { cursor: grab; color: #c0c4cc; }
.field-info { flex: 1; display: flex; align-items: center; gap: 6px; }
.field-label { font-size: 13px; }
.field-code { font-size: 11px; color: #909399; font-family: monospace; }
.ghost { opacity: 0.5; background: #ecf5ff; }
.canvas-empty { padding: 40px 0; }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add web-admin/src/views/platform/canvas-editor/components/FieldPalette.vue web-admin/src/views/platform/canvas-editor/components/FormCanvas.vue
git commit -m "feat(canvas-v4b): FieldPalette + FormCanvas — drag-and-drop field layout"
```

---

### Task 16: PreviewPanel + TabLayoutEditor

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/PreviewPanel.vue`
- Create: `web-admin/src/views/platform/canvas-editor/components/TabLayoutEditor.vue`

- [ ] **Step 1: Create PreviewPanel**

```vue
<!-- web-admin/src/views/platform/canvas-editor/components/PreviewPanel.vue -->
<template>
  <div class="preview-panel">
    <div class="preview-toolbar">
      <span>实时预览</span>
      <el-radio-group v-model="previewMode" size="small">
        <el-radio-button value="desktop">桌面</el-radio-button>
        <el-radio-button value="mobile">移动端</el-radio-button>
      </el-radio-group>
      <el-select v-model="previewRole" size="small" style="width: 140px" placeholder="预览角色">
        <el-option label="超级管理员" value="factory_super_admin" />
        <el-option label="工厂管理员" value="factory_admin" />
        <el-option label="仓库管理员" value="warehouse_manager" />
        <el-option label="销售" value="sales" />
      </el-select>
    </div>
    <div class="preview-frame" :class="previewMode">
      <SchemaFormRenderer
        v-if="config"
        :module-code="moduleCode"
        mode="create"
        :factory-id="factoryId"
      />
      <el-empty v-else description="选择模块后预览" />
    </div>
  </div>
</template>

<script setup lang="ts">
import SchemaFormRenderer from '@/views/modules/components/SchemaFormRenderer.vue'
import { usePageEditor } from '../composables/usePageEditor'

defineProps<{
  moduleCode: string
  factoryId: string
  config: unknown
}>()

const { previewMode, previewRole } = usePageEditor()
</script>

<style scoped>
.preview-panel { display: flex; flex-direction: column; height: 100%; }
.preview-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #ebeef5; font-size: 13px; font-weight: 600; }
.preview-frame { flex: 1; padding: 16px; overflow-y: auto; }
.preview-frame.mobile { max-width: 375px; margin: 0 auto; border: 1px solid #ebeef5; border-radius: 8px; }
</style>
```

- [ ] **Step 2: Create TabLayoutEditor**

```vue
<!-- web-admin/src/views/platform/canvas-editor/components/TabLayoutEditor.vue -->
<template>
  <div class="tab-layout-editor">
    <div class="tab-header">
      <span class="title">Tab 布局配置</span>
      <el-button size="small" @click="addTab">添加 Tab</el-button>
    </div>

    <draggable v-model="tabs" item-key="code" handle=".tab-drag" ghost-class="ghost">
      <template #item="{ element, index }">
        <div class="tab-item">
          <el-icon class="tab-drag"><Rank /></el-icon>
          <el-input v-model="element.label" size="small" style="width: 120px" />
          <el-select v-model="element.type" size="small" style="width: 110px" @change="onTypeChange(element)">
            <el-option label="字段分组" value="fields" />
            <el-option label="子表" value="sub_table" />
            <el-option label="关联表" value="ref_table" />
          </el-select>
          <el-tag size="small" type="info">{{ element.code }}</el-tag>
          <el-button type="danger" text size="small" @click="removeTab(index)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </template>
    </draggable>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import draggable from 'vuedraggable'
import { Rank, Delete } from '@element-plus/icons-vue'

interface TabItem {
  code: string
  label: string
  type: 'fields' | 'sub_table' | 'ref_table'
  fieldCodes?: string[]
  fieldCode?: string
  refModule?: string
}

const tabs = defineModel<TabItem[]>({ required: true })

function addTab() {
  tabs.value.push({
    code: `tab_${Date.now()}`,
    label: '新 Tab',
    type: 'fields',
  })
}

function removeTab(index: number) {
  tabs.value.splice(index, 1)
}

function onTypeChange(tab: TabItem) {
  if (tab.type === 'fields') { tab.fieldCodes = []; delete tab.fieldCode; delete tab.refModule }
  else if (tab.type === 'sub_table') { delete tab.fieldCodes; tab.fieldCode = ''; delete tab.refModule }
  else if (tab.type === 'ref_table') { delete tab.fieldCodes; delete tab.fieldCode; tab.refModule = '' }
}
</script>

<style scoped>
.tab-layout-editor { padding: 12px; }
.tab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.title { font-weight: 600; font-size: 14px; }
.tab-item { display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid #ebeef5; border-radius: 4px; margin-bottom: 6px; }
.tab-drag { cursor: grab; color: #c0c4cc; }
.ghost { opacity: 0.5; }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add web-admin/src/views/platform/canvas-editor/components/PreviewPanel.vue web-admin/src/views/platform/canvas-editor/components/TabLayoutEditor.vue
git commit -m "feat(canvas-v4b): PreviewPanel + TabLayoutEditor"
```

---

### Task 17: PageEditor Main Component

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/PageEditor.vue`

- [ ] **Step 1: Create PageEditor**

```vue
<!-- web-admin/src/views/platform/canvas-editor/PageEditor.vue -->
<template>
  <div class="page-editor">
    <!-- Left: Field Palette -->
    <div class="editor-palette">
      <FieldPalette @field-added="onFieldAdded" />
      <el-divider />
      <TabLayoutEditor v-model="tabLayout" />
    </div>

    <!-- Center: Form Canvas -->
    <div class="editor-canvas">
      <FormCanvas
        v-model:fields="allFields"
        @remove-field="onRemoveField"
      />
    </div>

    <!-- Right: Property Drawer / Preview -->
    <div class="editor-right">
      <el-tabs v-model="rightTab" class="right-tabs">
        <el-tab-pane label="属性" name="properties">
          <FieldPropertyDrawer
            v-if="selectedField"
            :field="selectedField"
            @update="onFieldPropertyUpdate"
          />
          <el-empty v-else description="点击字段编辑属性" :image-size="60" />
        </el-tab-pane>
        <el-tab-pane label="预览" name="preview">
          <PreviewPanel
            :module-code="moduleCode"
            :factory-id="factoryId"
            :config="previewConfig"
          />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import FieldPalette from './components/FieldPalette.vue'
import FormCanvas from './components/FormCanvas.vue'
import TabLayoutEditor from './components/TabLayoutEditor.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import FieldPropertyDrawer from './FieldPropertyDrawer.vue'
import { usePageEditor } from './composables/usePageEditor'
import { getDynamicFields, createDynamicField, updateDynamicField, deleteDynamicField } from '@/api/canvasApi'
import { useConfigStore } from '@/stores/configStore'
import type { DynamicField } from '@/types/canvas'

const props = defineProps<{
  moduleCode: string
  factoryId: string
}>()

const { selectedField, setDirty } = usePageEditor()
const configStore = useConfigStore()

const rightTab = ref('properties')
const jpaFields = ref<any[]>([])
const dynamicFields = ref<DynamicField[]>([])
const tabLayout = ref<any[]>([])

const allFields = computed({
  get: () => [
    ...jpaFields.value.map(f => ({ ...f, source: 'jpa' })),
    ...dynamicFields.value.map(f => ({
      fieldCode: f.fieldCode, label: f.label, fieldType: f.fieldType,
      type: f.fieldType.toLowerCase(), source: 'dynamic', status: f.status,
      sortOrder: f.sortOrder, visibleWhen: f.visibleWhen, computedWhen: f.computedWhen,
      config: f.config,
    })),
  ].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
  set: (val) => {
    // Separate JPA and dynamic fields after reorder
    jpaFields.value = val.filter((f: any) => f.source === 'jpa')
    dynamicFields.value = val.filter((f: any) => f.source === 'dynamic').map((f: any) => ({
      ...f, fieldCode: f.fieldCode, fieldType: f.fieldType || f.type?.toUpperCase(),
    }))
  },
})

const previewConfig = computed(() => configStore.getEffectiveConfig(props.moduleCode))

onMounted(async () => {
  // Load JPA fields from effective config
  const config = await configStore.loadEffectiveConfig(props.factoryId, props.moduleCode)
  if (config) {
    jpaFields.value = config.fields?.filter((f: any) => f.source !== 'dynamic') || []
  }
  // Load dynamic fields
  const { data } = await getDynamicFields(props.factoryId, props.moduleCode)
  dynamicFields.value = data || []
})

async function onFieldAdded(field: Partial<DynamicField>) {
  field.moduleCode = props.moduleCode
  const { data } = await createDynamicField(props.factoryId, field)
  dynamicFields.value.push(data)
  setDirty()
  ElMessage.success(`已添加字段: ${field.label}`)
}

async function onRemoveField(index: number) {
  const field = allFields.value[index]
  if (field.source === 'dynamic') {
    await deleteDynamicField(props.factoryId, field.fieldCode, props.moduleCode)
    dynamicFields.value = dynamicFields.value.filter(f => f.fieldCode !== field.fieldCode)
    setDirty()
    ElMessage.success('已移除字段')
  }
}

function onFieldPropertyUpdate(updated: any) {
  setDirty()
}
</script>

<style scoped>
.page-editor { display: flex; height: 100%; gap: 1px; background: #ebeef5; }
.editor-palette { width: 240px; background: #fff; overflow-y: auto; flex-shrink: 0; }
.editor-canvas { flex: 1; background: #fafafa; overflow-y: auto; }
.editor-right { width: 320px; background: #fff; overflow-y: auto; flex-shrink: 0; }
.right-tabs { height: 100%; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add web-admin/src/views/platform/canvas-editor/PageEditor.vue
git commit -m "feat(canvas-v4b): PageEditor — main drag-and-drop editor container"
```

---

### Task 18: Wire PageEditor into Canvas Editor

**Files:**
- Modify: `web-admin/src/views/platform/canvas-editor/index.vue`

- [ ] **Step 1: Import PageEditor and add to Phase B "字段" tab**

In the canvas-editor `index.vue`, find the Phase B tab section (fields tab) and replace the existing `FieldConfigPanel` with `PageEditor`:

```html
<!-- Replace existing field config panel in Phase B -->
<template v-if="activeTab === 'fields'">
  <PageEditor
    v-if="selectedModule"
    :module-code="selectedModule"
    :factory-id="factoryId"
  />
</template>
```

Add import:

```typescript
import PageEditor from './PageEditor.vue'
```

- [ ] **Step 2: Build and verify**

```bash
cd web-admin && npx vite build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add web-admin/src/views/platform/canvas-editor/index.vue
git commit -m "feat(canvas-v4b): wire PageEditor into canvas-editor Phase B fields tab"
```

---

### Task 19: Final Build + Deploy

- [ ] **Step 1: Backend build**

```bash
cd backend/java/cretas-api && mvn compile -Dmaven.test.skip=true
```

- [ ] **Step 2: Frontend build**

```bash
cd web-admin && npx vite build
```

- [ ] **Step 3: Fix any build errors, commit fixes**

- [ ] **Step 4: Deploy backend**

```bash
./scripts/deploy/deploy-backend.sh --env prod
```

- [ ] **Step 5: Deploy frontend to 139**

```bash
scp -r web-admin/dist/* root@139.196.165.140:/www/wwwroot/web-admin/
```

- [ ] **Step 6: Commit final state**

```bash
git add -u && git commit -m "feat(canvas-v3-v4): complete build — dynamic fields + page editor + deploy"
```

---

## Summary

| Phase | Tasks | Key Deliverables |
|-------|-------|-----------------|
| V3 Backend | 1-9 | 2 new tables, DDLExecutor, DynamicFieldService, DynamicTableService, AggregateFormulaExecutor, 6 AI Tools, getEffectiveConfig userId+dynamic merge, publish DDL execution |
| V4a Rendering | 10-13 | SpEL evaluator, SubTableEditor, AttachmentUploader, TabLayoutRenderer, SchemaFormRenderer extensions |
| V4b Editor | 14-18 | FieldPalette, FormCanvas (drag-drop), TabLayoutEditor, PreviewPanel, PageEditor, wired into canvas-editor |
| Deploy | 19 | Backend + frontend deployed to prod |
