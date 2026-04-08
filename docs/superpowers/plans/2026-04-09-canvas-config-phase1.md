# Canvas Configuration System — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core Config Engine + Dynamic Renderer for 2 modules (sales_order + bom), proving that JSON Schema-driven configuration can replace hardcoded Vue pages.

**Architecture:** 5 PostgreSQL tables store module schemas and per-factory config overrides. `FactoryConfigService` merges 3 layers (schema default < template < factory override) into `EffectiveModuleConfig`. Vue `SchemaFormRenderer` + `SchemaTableRenderer` consume this config to dynamically render forms and tables. Feature flags allow parallel running of old and new pages.

**Tech Stack:** Java 21, Spring Boot 3.2.12, PostgreSQL (JSONB), JPA/Hibernate 6, Redis (Caffeine local cache), Vue 3 + Element Plus + TypeScript, Pinia

**Spec:** `docs/superpowers/specs/2026-04-09-canvas-configuration-system-design.md`

---

## File Structure

### Backend (Java)

```
backend/java/cretas-api/src/main/java/com/cretas/aims/
├── entity/config/
│   ├── ModuleSchema.java                    (NEW — platform-level module schema)
│   ├── FactoryConfiguration.java            (NEW — factory-level version management)
│   └── FactoryModuleConfig.java             (NEW — factory x module config)
│   └── ConfigChangeLog.java                 (NEW — audit log)
├── repository/config/
│   ├── ModuleSchemaRepository.java          (NEW)
│   ├── FactoryConfigurationRepository.java  (NEW)
│   ├── FactoryModuleConfigRepository.java   (NEW)
│   └── ConfigChangeLogRepository.java       (NEW)
├── dto/config/
│   ├── EffectiveModuleConfig.java           (NEW — merged config DTO)
│   ├── EffectiveField.java                  (NEW — single field config)
│   ├── FieldGroup.java                      (NEW)
│   ├── WorkflowStateDTO.java               (NEW)
│   ├── WorkflowTransitionDTO.java           (NEW)
│   ├── ModuleConfigDTO.java                 (NEW — write DTO)
│   ├── FieldConfigDTO.java                  (NEW)
│   └── ConfigDiffDTO.java                   (NEW)
├── service/config/
│   ├── FactoryConfigService.java            (NEW — interface)
│   └── impl/
│       └── FactoryConfigServiceImpl.java    (NEW — 3-layer merge + cache)
├── controller/
│   └── ConfigController.java               (NEW — REST API)
├── annotation/
│   └── RequireModule.java                   (NEW — AOP annotation)
├── aspect/
│   └── ModuleEnabledAspect.java             (NEW — AOP aspect)
└── service/inventory/impl/
    └── SalesServiceImpl.java                (MODIFY — inject FactoryConfigService)

backend/java/cretas-api/src/main/resources/db/migration/
├── V20260409_01__canvas_config_tables.sql   (NEW — 4 tables + indexes + triggers)
└── V20260409_02__seed_sales_order_bom_schema.sql  (NEW — module_schemas seed data)
```

### Frontend (Vue)

```
web-admin/src/
├── api/
│   └── configApi.ts                         (NEW — config REST client)
├── stores/
│   └── configStore.ts                       (NEW — Pinia store for config cache)
├── views/modules/
│   ├── DynamicModulePage.vue                (NEW — universal module shell)
│   └── components/
│       ├── SchemaFormRenderer.vue            (NEW — dynamic form)
│       ├── SchemaTableRenderer.vue           (NEW — dynamic table)
│       ├── ReferenceSelector.vue             (NEW — remote search dropdown)
│       ├── DynamicArrayEditor.vue            (NEW — JSON array inline editor)
│       └── LineItemsEditor.vue              (NEW — order items table editor)
├── router/index.ts                          (MODIFY — add /modules/:moduleCode route)
└── types/
    └── config.ts                            (NEW — TypeScript types)
```

---

## Week 1: Data Model + ConfigService

### Task 1: Database Migration — 4 Core Tables

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260409_01__canvas_config_tables.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- V20260409_01__canvas_config_tables.sql
-- Canvas Configuration System — Phase 1 Core Tables

-- 确保 update_updated_at 函数存在 (幂等)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. module_schemas: 平台级模块 Schema 定义
CREATE TABLE IF NOT EXISTS module_schemas (
    id              BIGSERIAL PRIMARY KEY,
    module_code     VARCHAR(64) NOT NULL UNIQUE,
    module_name     VARCHAR(100) NOT NULL,
    module_category VARCHAR(32) NOT NULL,
    module_version  INTEGER NOT NULL DEFAULT 1,
    field_schema    JSONB NOT NULL,
    workflow_schema JSONB,
    validation_schema JSONB,
    permission_schema JSONB,
    default_config  JSONB NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ms_category ON module_schemas(module_category);
CREATE INDEX IF NOT EXISTS idx_ms_active ON module_schemas(is_active);

DROP TRIGGER IF EXISTS trigger_ms_updated_at ON module_schemas;
CREATE TRIGGER trigger_ms_updated_at
BEFORE UPDATE ON module_schemas
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. factory_templates: 行业模板
CREATE TABLE IF NOT EXISTS factory_templates (
    id              BIGSERIAL PRIMARY KEY,
    template_code   VARCHAR(64) NOT NULL UNIQUE,
    template_name   VARCHAR(100) NOT NULL,
    industry_type   VARCHAR(32) NOT NULL,
    description     TEXT,
    base_config     JSONB NOT NULL,
    preview_image   VARCHAR(255),
    usage_count     INTEGER DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      BIGINT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP
);

DROP TRIGGER IF EXISTS trigger_ft_updated_at ON factory_templates;
CREATE TRIGGER trigger_ft_updated_at
BEFORE UPDATE ON factory_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. factory_configurations: 工厂级总配置
CREATE TABLE IF NOT EXISTS factory_configurations (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50) NOT NULL,
    template_id     BIGINT REFERENCES factory_templates(id),
    config_version  INTEGER NOT NULL DEFAULT 1,
    status          VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    published_at    TIMESTAMP,
    published_by    BIGINT,
    rollback_version INTEGER,
    change_summary  TEXT,
    created_by      BIGINT NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fc_factory_version ON factory_configurations(factory_id, config_version);
CREATE INDEX IF NOT EXISTS idx_fc_factory_status ON factory_configurations(factory_id, status);

DROP TRIGGER IF EXISTS trigger_fc_updated_at ON factory_configurations;
CREATE TRIGGER trigger_fc_updated_at
BEFORE UPDATE ON factory_configurations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. factory_module_configs: 工厂 x 模块配置
CREATE TABLE IF NOT EXISTS factory_module_configs (
    id                  BIGSERIAL PRIMARY KEY,
    factory_id          VARCHAR(50) NOT NULL,
    module_code         VARCHAR(64) NOT NULL,
    config_version      INTEGER NOT NULL DEFAULT 1,
    enabled             BOOLEAN NOT NULL DEFAULT true,
    field_config        JSONB NOT NULL DEFAULT '{}',
    workflow_config     JSONB NOT NULL DEFAULT '{}',
    validation_config   JSONB NOT NULL DEFAULT '{}',
    permission_config   JSONB NOT NULL DEFAULT '{}',
    layout_config       JSONB NOT NULL DEFAULT '{}',
    custom_labels       JSONB NOT NULL DEFAULT '{}',
    computed_fields     JSONB NOT NULL DEFAULT '{}',
    rendering_mode      VARCHAR(16) NOT NULL DEFAULT 'LEGACY',
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    deleted_at          TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fmc_factory_module_version
    ON factory_module_configs(factory_id, module_code, config_version);
CREATE INDEX IF NOT EXISTS idx_fmc_factory ON factory_module_configs(factory_id);

DROP TRIGGER IF EXISTS trigger_fmc_updated_at ON factory_module_configs;
CREATE TRIGGER trigger_fmc_updated_at
BEFORE UPDATE ON factory_module_configs
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. config_change_log: 变更审计
CREATE TABLE IF NOT EXISTS config_change_log (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50) NOT NULL,
    module_code     VARCHAR(64),
    operation       VARCHAR(32) NOT NULL,
    before_value    JSONB,
    after_value     JSONB,
    diff_summary    TEXT,
    operator_id     BIGINT NOT NULL,
    operator_type   VARCHAR(16) NOT NULL DEFAULT 'USER',
    ai_prompt       TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccl_factory ON config_change_log(factory_id);
CREATE INDEX IF NOT EXISTS idx_ccl_factory_module ON config_change_log(factory_id, module_code);
CREATE INDEX IF NOT EXISTS idx_ccl_created ON config_change_log(created_at);
```

- [ ] **Step 2: Verify SQL syntax**

Run:
```bash
cd backend/java/cretas-api
cat src/main/resources/db/migration/V20260409_01__canvas_config_tables.sql | head -5
# Should see the comment header
```
Expected: File exists with correct content.

- [ ] **Step 3: Commit**

```bash
git add src/main/resources/db/migration/V20260409_01__canvas_config_tables.sql
git commit -m "feat(canvas): V20260409_01 core config tables (5 tables)"
```

---

### Task 2: JPA Entities — 4 Config Entities

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/ModuleSchema.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/FactoryConfiguration.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/FactoryModuleConfig.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/ConfigChangeLog.java`

- [ ] **Step 1: Create ModuleSchema entity**

```java
package com.cretas.aims.entity.config;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "module_schemas")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class ModuleSchema {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "module_code", length = 64, nullable = false, unique = true)
    private String moduleCode;

    @Column(name = "module_name", length = 100, nullable = false)
    private String moduleName;

    @Column(name = "module_category", length = 32, nullable = false)
    private String moduleCategory;

    @Column(name = "module_version", nullable = false)
    private Integer moduleVersion = 1;

    @Type(JsonBinaryType.class)
    @Column(name = "field_schema", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> fieldSchema;

    @Type(JsonBinaryType.class)
    @Column(name = "workflow_schema", columnDefinition = "jsonb")
    private Map<String, Object> workflowSchema;

    @Type(JsonBinaryType.class)
    @Column(name = "validation_schema", columnDefinition = "jsonb")
    private Map<String, Object> validationSchema;

    @Type(JsonBinaryType.class)
    @Column(name = "permission_schema", columnDefinition = "jsonb")
    private Map<String, Object> permissionSchema;

    @Type(JsonBinaryType.class)
    @Column(name = "default_config", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> defaultConfig;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
```

- [ ] **Step 2: Create FactoryConfiguration entity**

```java
package com.cretas.aims.entity.config;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "factory_configurations",
    indexes = {
        @Index(name = "idx_fc_factory_status", columnList = "factory_id, status")
    },
    uniqueConstraints = {
        @UniqueConstraint(name = "idx_fc_factory_version", columnNames = {"factory_id", "config_version"})
    })
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class FactoryConfiguration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "factory_id", length = 50, nullable = false)
    private String factoryId;

    @Column(name = "template_id")
    private Long templateId;

    @Column(name = "config_version", nullable = false)
    private Integer configVersion = 1;

    @Column(name = "status", length = 16, nullable = false)
    private String status = "DRAFT";

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "published_by")
    private Long publishedBy;

    @Column(name = "rollback_version")
    private Integer rollbackVersion;

    @Column(name = "change_summary", columnDefinition = "TEXT")
    private String changeSummary;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
```

- [ ] **Step 3: Create FactoryModuleConfig entity**

```java
package com.cretas.aims.entity.config;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "factory_module_configs",
    uniqueConstraints = {
        @UniqueConstraint(name = "idx_fmc_factory_module_version",
            columnNames = {"factory_id", "module_code", "config_version"})
    },
    indexes = {
        @Index(name = "idx_fmc_factory", columnList = "factory_id")
    })
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class FactoryModuleConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "factory_id", length = 50, nullable = false)
    private String factoryId;

    @Column(name = "module_code", length = 64, nullable = false)
    private String moduleCode;

    @Column(name = "config_version", nullable = false)
    private Integer configVersion = 1;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled = true;

    @Type(JsonBinaryType.class)
    @Column(name = "field_config", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> fieldConfig = Map.of();

    @Type(JsonBinaryType.class)
    @Column(name = "workflow_config", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> workflowConfig = Map.of();

    @Type(JsonBinaryType.class)
    @Column(name = "validation_config", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> validationConfig = Map.of();

    @Type(JsonBinaryType.class)
    @Column(name = "permission_config", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> permissionConfig = Map.of();

    @Type(JsonBinaryType.class)
    @Column(name = "layout_config", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> layoutConfig = Map.of();

    @Type(JsonBinaryType.class)
    @Column(name = "custom_labels", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> customLabels = Map.of();

    @Type(JsonBinaryType.class)
    @Column(name = "computed_fields", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> computedFields = Map.of();

    @Column(name = "rendering_mode", length = 16, nullable = false)
    private String renderingMode = "LEGACY";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
```

- [ ] **Step 4: Create ConfigChangeLog entity**

```java
package com.cretas.aims.entity.config;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "config_change_log",
    indexes = {
        @Index(name = "idx_ccl_factory", columnList = "factory_id"),
        @Index(name = "idx_ccl_factory_module", columnList = "factory_id, module_code"),
        @Index(name = "idx_ccl_created", columnList = "created_at")
    })
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class ConfigChangeLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "factory_id", length = 50, nullable = false)
    private String factoryId;

    @Column(name = "module_code", length = 64)
    private String moduleCode;

    @Column(name = "operation", length = 32, nullable = false)
    private String operation;

    @Type(JsonBinaryType.class)
    @Column(name = "before_value", columnDefinition = "jsonb")
    private Map<String, Object> beforeValue;

    @Type(JsonBinaryType.class)
    @Column(name = "after_value", columnDefinition = "jsonb")
    private Map<String, Object> afterValue;

    @Column(name = "diff_summary", columnDefinition = "TEXT")
    private String diffSummary;

    @Column(name = "operator_id", nullable = false)
    private Long operatorId;

    @Column(name = "operator_type", length = 16, nullable = false)
    private String operatorType = "USER";

    @Column(name = "ai_prompt", columnDefinition = "TEXT")
    private String aiPrompt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
```

- [ ] **Step 5: Compile to verify entities**

Run:
```bash
cd backend/java/cretas-api
JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd compile 2>&1 | tail -5
```
Expected: `BUILD SUCCESS`

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/cretas/aims/entity/config/
git commit -m "feat(canvas): 4 config entities (ModuleSchema/FactoryConfiguration/FactoryModuleConfig/ConfigChangeLog)"
```

---

### Task 3: JPA Repositories — 4 Repositories

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/ModuleSchemaRepository.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/FactoryConfigurationRepository.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/FactoryModuleConfigRepository.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/ConfigChangeLogRepository.java`

- [ ] **Step 1: Create all 4 repositories**

`ModuleSchemaRepository.java`:
```java
package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.ModuleSchema;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ModuleSchemaRepository extends JpaRepository<ModuleSchema, Long> {
    Optional<ModuleSchema> findByModuleCode(String moduleCode);
    List<ModuleSchema> findByIsActiveTrue();
    List<ModuleSchema> findByModuleCategoryAndIsActiveTrue(String category);
    boolean existsByModuleCode(String moduleCode);
}
```

`FactoryConfigurationRepository.java`:
```java
package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactoryConfiguration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FactoryConfigurationRepository extends JpaRepository<FactoryConfiguration, Long> {
    Optional<FactoryConfiguration> findByFactoryIdAndStatus(String factoryId, String status);

    @Query("SELECT fc FROM FactoryConfiguration fc WHERE fc.factoryId = :factoryId AND fc.status = 'PUBLISHED' ORDER BY fc.configVersion DESC")
    Optional<FactoryConfiguration> findLatestPublished(@Param("factoryId") String factoryId);

    @Query("SELECT fc FROM FactoryConfiguration fc WHERE fc.factoryId = :factoryId AND fc.status = 'DRAFT'")
    Optional<FactoryConfiguration> findDraft(@Param("factoryId") String factoryId);

    List<FactoryConfiguration> findByFactoryIdOrderByConfigVersionDesc(String factoryId);

    Optional<FactoryConfiguration> findByFactoryIdAndConfigVersion(String factoryId, Integer configVersion);
}
```

`FactoryModuleConfigRepository.java`:
```java
package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactoryModuleConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FactoryModuleConfigRepository extends JpaRepository<FactoryModuleConfig, Long> {
    Optional<FactoryModuleConfig> findByFactoryIdAndModuleCodeAndConfigVersion(
            String factoryId, String moduleCode, Integer configVersion);

    List<FactoryModuleConfig> findByFactoryIdAndConfigVersion(String factoryId, Integer configVersion);

    List<FactoryModuleConfig> findByFactoryIdAndConfigVersionAndEnabledTrue(
            String factoryId, Integer configVersion);

    boolean existsByFactoryIdAndModuleCodeAndConfigVersion(
            String factoryId, String moduleCode, Integer configVersion);
}
```

`ConfigChangeLogRepository.java`:
```java
package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.ConfigChangeLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ConfigChangeLogRepository extends JpaRepository<ConfigChangeLog, Long> {
    Page<ConfigChangeLog> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);
    Page<ConfigChangeLog> findByFactoryIdAndModuleCodeOrderByCreatedAtDesc(
            String factoryId, String moduleCode, Pageable pageable);
}
```

- [ ] **Step 2: Compile**

Run:
```bash
cd backend/java/cretas-api
JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd compile 2>&1 | tail -5
```
Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/cretas/aims/repository/config/
git commit -m "feat(canvas): 4 config repositories"
```

---

### Task 4: DTO Layer — EffectiveModuleConfig + Supporting DTOs

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/config/EffectiveModuleConfig.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/config/EffectiveField.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/config/FieldGroup.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/config/WorkflowStateDTO.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/config/WorkflowTransitionDTO.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/config/ModuleConfigDTO.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/config/FieldConfigDTO.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/dto/config/ModuleSummaryDTO.java`

- [ ] **Step 1: Create all DTOs**

`EffectiveField.java`:
```java
package com.cretas.aims.dto.config;

import lombok.*;
import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class EffectiveField {
    private String code;
    private String label;
    private String type;
    private boolean required;
    private boolean visible;
    private boolean readonly;
    private Object defaultValue;
    private List<Map<String, Object>> options;
    private String group;
    private int order;
    private Map<String, Object> extra;
}
```

`FieldGroup.java`:
```java
package com.cretas.aims.dto.config;

import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class FieldGroup {
    private String code;
    private String label;
    private int order;
    private boolean visible;
}
```

`WorkflowStateDTO.java`:
```java
package com.cretas.aims.dto.config;

import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class WorkflowStateDTO {
    private String code;
    private String label;
    private boolean enabled;
    private boolean isInitial;
    private boolean isFinal;
    private String tagType;
}
```

`WorkflowTransitionDTO.java`:
```java
package com.cretas.aims.dto.config;

import lombok.*;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class WorkflowTransitionDTO {
    private String from;
    private String to;
    private String action;
    private String label;
    private String buttonType;
    private boolean enabled;
    private String condition;
    private List<String> allowedRoles;
}
```

`EffectiveModuleConfig.java`:
```java
package com.cretas.aims.dto.config;

import lombok.*;
import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class EffectiveModuleConfig {
    private String moduleCode;
    private String moduleName;
    private boolean enabled;
    private List<EffectiveField> fields;
    private List<FieldGroup> groups;
    private List<WorkflowStateDTO> workflowStates;
    private List<WorkflowTransitionDTO> workflowTransitions;
    private Map<String, Object> workflowOptions;
    private Map<String, String> customLabels;
    private String renderingMode;
}
```

`ModuleConfigDTO.java` (write DTO):
```java
package com.cretas.aims.dto.config;

import lombok.*;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ModuleConfigDTO {
    private Boolean enabled;
    private Map<String, Object> fieldConfig;
    private Map<String, Object> workflowConfig;
    private Map<String, Object> validationConfig;
    private Map<String, Object> permissionConfig;
    private Map<String, Object> layoutConfig;
    private Map<String, Object> customLabels;
    private String renderingMode;
}
```

`FieldConfigDTO.java`:
```java
package com.cretas.aims.dto.config;

import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class FieldConfigDTO {
    private Boolean visible;
    private Boolean required;
    private Object defaultValue;
    private Object options;
    private String label;
}
```

`ModuleSummaryDTO.java`:
```java
package com.cretas.aims.dto.config;

import lombok.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ModuleSummaryDTO {
    private String moduleCode;
    private String moduleName;
    private String moduleCategory;
    private boolean enabled;
    private String renderingMode;
}
```

- [ ] **Step 2: Compile**

Run:
```bash
cd backend/java/cretas-api
JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd compile 2>&1 | tail -5
```
Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/cretas/aims/dto/config/
git commit -m "feat(canvas): 8 config DTOs (EffectiveModuleConfig + supporting types)"
```

---

### Task 5: FactoryConfigService — Interface + Implementation (Core Engine)

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/FactoryConfigService.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/config/impl/FactoryConfigServiceImpl.java`

- [ ] **Step 1: Create the service interface**

```java
package com.cretas.aims.service.config;

import com.cretas.aims.dto.config.*;

import java.util.List;
import java.util.Map;

public interface FactoryConfigService {

    // ========== 合并配置读取 (前端消费) ==========

    EffectiveModuleConfig getEffectiveConfig(String factoryId, String moduleCode);

    EffectiveModuleConfig getEffectiveConfig(String factoryId, String moduleCode, String roleCode);

    // ========== 字段级查询 (C 层) ==========

    boolean isFieldVisible(String factoryId, String moduleCode, String fieldCode);

    boolean isFieldRequired(String factoryId, String moduleCode, String fieldCode);

    Object getFieldDefault(String factoryId, String moduleCode, String fieldCode);

    // ========== 流程级查询 (D 层) ==========

    List<WorkflowStateDTO> getWorkflowStates(String factoryId, String moduleCode);

    List<WorkflowTransitionDTO> getAvailableTransitions(String factoryId, String moduleCode, String currentState);

    boolean isTransitionAllowed(String factoryId, String moduleCode, String fromState, String toState);

    // ========== 模块级查询 (B 层) ==========

    boolean isModuleEnabled(String factoryId, String moduleCode);

    List<ModuleSummaryDTO> getEnabledModules(String factoryId);

    // ========== 配置写操作 ==========

    void saveModuleConfig(String factoryId, String moduleCode, ModuleConfigDTO config, Long operatorId);

    void toggleModule(String factoryId, String moduleCode, boolean enabled, Long operatorId);

    void updateFieldConfig(String factoryId, String moduleCode, String fieldCode,
                           FieldConfigDTO fieldConfig, Long operatorId);

    // ========== 发布与版本 ==========

    void publishConfig(String factoryId, Long operatorId, String changeSummary);

    void rollbackConfig(String factoryId, int targetVersion, Long operatorId);

    // ========== 模板 ==========

    void applyTemplate(String factoryId, String templateCode, Long operatorId);
}
```

- [ ] **Step 2: Create the service implementation**

Due to the large size, this is the core implementation. The key method is `getEffectiveConfig` which implements the 3-layer merge algorithm.

```java
package com.cretas.aims.service.config.impl;

import com.cretas.aims.dto.config.*;
import com.cretas.aims.entity.config.*;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.config.*;
import com.cretas.aims.service.config.FactoryConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FactoryConfigServiceImpl implements FactoryConfigService {

    private final ModuleSchemaRepository moduleSchemaRepository;
    private final FactoryConfigurationRepository factoryConfigurationRepository;
    private final FactoryModuleConfigRepository factoryModuleConfigRepository;
    private final ConfigChangeLogRepository configChangeLogRepository;
    private final ObjectMapper objectMapper;

    // ========== 合并配置读取 ==========

    @Override
    public EffectiveModuleConfig getEffectiveConfig(String factoryId, String moduleCode) {
        return getEffectiveConfig(factoryId, moduleCode, null);
    }

    @Override
    @SuppressWarnings("unchecked")
    public EffectiveModuleConfig getEffectiveConfig(String factoryId, String moduleCode, String roleCode) {
        ModuleSchema schema = moduleSchemaRepository.findByModuleCode(moduleCode)
                .orElseThrow(() -> new ResourceNotFoundException("ModuleSchema", "moduleCode", moduleCode));

        // Layer 1: Schema defaults
        Map<String, Object> effectiveFieldConfig = new HashMap<>(
                (Map<String, Object>) schema.getDefaultConfig().getOrDefault("fields", Map.of()));
        Map<String, Object> effectiveWorkflowConfig = new HashMap<>(
                (Map<String, Object>) schema.getDefaultConfig().getOrDefault("workflow", Map.of()));

        // Layer 2: Factory override (if published config exists)
        boolean moduleEnabled = true;
        String renderingMode = "LEGACY";
        Map<String, Object> customLabels = new HashMap<>();

        Optional<FactoryConfiguration> publishedConfig = factoryConfigurationRepository.findLatestPublished(factoryId);
        if (publishedConfig.isPresent()) {
            int version = publishedConfig.get().getConfigVersion();
            Optional<FactoryModuleConfig> moduleConfig = factoryModuleConfigRepository
                    .findByFactoryIdAndModuleCodeAndConfigVersion(factoryId, moduleCode, version);

            if (moduleConfig.isPresent()) {
                FactoryModuleConfig fmc = moduleConfig.get();
                moduleEnabled = fmc.getEnabled();
                renderingMode = fmc.getRenderingMode();
                deepMerge(effectiveFieldConfig, fmc.getFieldConfig());
                deepMerge(effectiveWorkflowConfig, fmc.getWorkflowConfig());
                if (fmc.getCustomLabels() != null) {
                    fmc.getCustomLabels().forEach((k, v) -> customLabels.put(k, String.valueOf(v)));
                }
            }
        }

        // Build EffectiveField list from schema.fieldSchema
        List<EffectiveField> fields = buildEffectiveFields(schema.getFieldSchema(), effectiveFieldConfig, customLabels);
        List<FieldGroup> groups = buildFieldGroups(schema.getFieldSchema());

        // Build workflow states and transitions
        List<WorkflowStateDTO> workflowStates = buildWorkflowStates(schema.getWorkflowSchema(), effectiveWorkflowConfig);
        List<WorkflowTransitionDTO> workflowTransitions = buildWorkflowTransitions(schema.getWorkflowSchema(), effectiveWorkflowConfig);
        Map<String, Object> workflowOptions = (Map<String, Object>) effectiveWorkflowConfig.getOrDefault("options", Map.of());

        // Layer 3: Role permission filter (runtime, not persisted)
        if (roleCode != null && schema.getPermissionSchema() != null) {
            applyPermissionFilter(fields, schema.getPermissionSchema(), roleCode);
        }

        return EffectiveModuleConfig.builder()
                .moduleCode(moduleCode)
                .moduleName(schema.getModuleName())
                .enabled(moduleEnabled)
                .fields(fields)
                .groups(groups)
                .workflowStates(workflowStates)
                .workflowTransitions(workflowTransitions)
                .workflowOptions(workflowOptions)
                .customLabels(customLabels.entrySet().stream()
                        .collect(Collectors.toMap(Map.Entry::getKey, e -> String.valueOf(e.getValue()))))
                .renderingMode(renderingMode)
                .build();
    }

    // ========== 字段级查询 ==========

    @Override
    public boolean isFieldVisible(String factoryId, String moduleCode, String fieldCode) {
        EffectiveModuleConfig config = getEffectiveConfig(factoryId, moduleCode);
        return config.getFields().stream()
                .filter(f -> f.getCode().equals(fieldCode))
                .findFirst()
                .map(EffectiveField::isVisible)
                .orElse(false);
    }

    @Override
    public boolean isFieldRequired(String factoryId, String moduleCode, String fieldCode) {
        EffectiveModuleConfig config = getEffectiveConfig(factoryId, moduleCode);
        return config.getFields().stream()
                .filter(f -> f.getCode().equals(fieldCode))
                .findFirst()
                .map(EffectiveField::isRequired)
                .orElse(false);
    }

    @Override
    public Object getFieldDefault(String factoryId, String moduleCode, String fieldCode) {
        EffectiveModuleConfig config = getEffectiveConfig(factoryId, moduleCode);
        return config.getFields().stream()
                .filter(f -> f.getCode().equals(fieldCode))
                .findFirst()
                .map(EffectiveField::getDefaultValue)
                .orElse(null);
    }

    // ========== 流程级查询 ==========

    @Override
    public List<WorkflowStateDTO> getWorkflowStates(String factoryId, String moduleCode) {
        return getEffectiveConfig(factoryId, moduleCode).getWorkflowStates();
    }

    @Override
    public List<WorkflowTransitionDTO> getAvailableTransitions(String factoryId, String moduleCode, String currentState) {
        return getEffectiveConfig(factoryId, moduleCode).getWorkflowTransitions().stream()
                .filter(t -> t.getFrom().equals(currentState) && t.isEnabled())
                .collect(Collectors.toList());
    }

    @Override
    public boolean isTransitionAllowed(String factoryId, String moduleCode, String fromState, String toState) {
        return getEffectiveConfig(factoryId, moduleCode).getWorkflowTransitions().stream()
                .anyMatch(t -> t.getFrom().equals(fromState) && t.getTo().equals(toState) && t.isEnabled());
    }

    // ========== 模块级查询 ==========

    @Override
    public boolean isModuleEnabled(String factoryId, String moduleCode) {
        return getEffectiveConfig(factoryId, moduleCode).isEnabled();
    }

    @Override
    public List<ModuleSummaryDTO> getEnabledModules(String factoryId) {
        List<ModuleSchema> schemas = moduleSchemaRepository.findByIsActiveTrue();
        return schemas.stream()
                .map(s -> {
                    EffectiveModuleConfig config = getEffectiveConfig(factoryId, s.getModuleCode());
                    return ModuleSummaryDTO.builder()
                            .moduleCode(s.getModuleCode())
                            .moduleName(s.getModuleName())
                            .moduleCategory(s.getModuleCategory())
                            .enabled(config.isEnabled())
                            .renderingMode(config.getRenderingMode())
                            .build();
                })
                .collect(Collectors.toList());
    }

    // ========== 配置写操作 ==========

    @Override
    @Transactional
    public void saveModuleConfig(String factoryId, String moduleCode, ModuleConfigDTO dto, Long operatorId) {
        moduleSchemaRepository.findByModuleCode(moduleCode)
                .orElseThrow(() -> new ResourceNotFoundException("ModuleSchema", "moduleCode", moduleCode));

        FactoryConfiguration config = getOrCreateDraft(factoryId, operatorId);
        FactoryModuleConfig fmc = factoryModuleConfigRepository
                .findByFactoryIdAndModuleCodeAndConfigVersion(factoryId, moduleCode, config.getConfigVersion())
                .orElseGet(() -> {
                    FactoryModuleConfig newFmc = new FactoryModuleConfig();
                    newFmc.setFactoryId(factoryId);
                    newFmc.setModuleCode(moduleCode);
                    newFmc.setConfigVersion(config.getConfigVersion());
                    return newFmc;
                });

        if (dto.getEnabled() != null) fmc.setEnabled(dto.getEnabled());
        if (dto.getFieldConfig() != null) fmc.setFieldConfig(dto.getFieldConfig());
        if (dto.getWorkflowConfig() != null) fmc.setWorkflowConfig(dto.getWorkflowConfig());
        if (dto.getValidationConfig() != null) fmc.setValidationConfig(dto.getValidationConfig());
        if (dto.getPermissionConfig() != null) fmc.setPermissionConfig(dto.getPermissionConfig());
        if (dto.getLayoutConfig() != null) fmc.setLayoutConfig(dto.getLayoutConfig());
        if (dto.getCustomLabels() != null) fmc.setCustomLabels(dto.getCustomLabels());
        if (dto.getRenderingMode() != null) fmc.setRenderingMode(dto.getRenderingMode());

        factoryModuleConfigRepository.save(fmc);

        logChange(factoryId, moduleCode, "UPDATE", null, dto.getFieldConfig(), "模块配置更新", operatorId);
    }

    @Override
    @Transactional
    public void toggleModule(String factoryId, String moduleCode, boolean enabled, Long operatorId) {
        ModuleConfigDTO dto = ModuleConfigDTO.builder().enabled(enabled).build();
        saveModuleConfig(factoryId, moduleCode, dto, operatorId);
    }

    @Override
    @Transactional
    public void updateFieldConfig(String factoryId, String moduleCode, String fieldCode,
                                  FieldConfigDTO fieldConfig, Long operatorId) {
        FactoryConfiguration config = getOrCreateDraft(factoryId, operatorId);
        FactoryModuleConfig fmc = factoryModuleConfigRepository
                .findByFactoryIdAndModuleCodeAndConfigVersion(factoryId, moduleCode, config.getConfigVersion())
                .orElseThrow(() -> new BusinessException("请先初始化模块配置"));

        Map<String, Object> fieldConfigMap = new HashMap<>(fmc.getFieldConfig());
        @SuppressWarnings("unchecked")
        Map<String, Object> fieldsMap = (Map<String, Object>) fieldConfigMap.computeIfAbsent("fields", k -> new HashMap<>());
        Map<String, Object> fieldOverride = new HashMap<>();
        if (fieldConfig.getVisible() != null) fieldOverride.put("visible", fieldConfig.getVisible());
        if (fieldConfig.getRequired() != null) fieldOverride.put("required", fieldConfig.getRequired());
        if (fieldConfig.getDefaultValue() != null) fieldOverride.put("defaultValue", fieldConfig.getDefaultValue());
        if (fieldConfig.getOptions() != null) fieldOverride.put("options", fieldConfig.getOptions());
        if (fieldConfig.getLabel() != null) fieldOverride.put("label", fieldConfig.getLabel());
        fieldsMap.put(fieldCode, fieldOverride);

        fmc.setFieldConfig(fieldConfigMap);
        factoryModuleConfigRepository.save(fmc);

        logChange(factoryId, moduleCode, "FIELD_UPDATE", null, fieldOverride,
                "字段 " + fieldCode + " 配置更新", operatorId);
    }

    // ========== 发布 ==========

    @Override
    @Transactional
    public void publishConfig(String factoryId, Long operatorId, String changeSummary) {
        FactoryConfiguration draft = factoryConfigurationRepository.findDraft(factoryId)
                .orElseThrow(() -> new BusinessException("没有待发布的草稿配置"));

        // Archive current published
        factoryConfigurationRepository.findLatestPublished(factoryId)
                .ifPresent(published -> {
                    published.setStatus("ARCHIVED");
                    factoryConfigurationRepository.save(published);
                });

        draft.setStatus("PUBLISHED");
        draft.setPublishedAt(LocalDateTime.now());
        draft.setPublishedBy(operatorId);
        draft.setChangeSummary(changeSummary);
        factoryConfigurationRepository.save(draft);

        logChange(factoryId, null, "PUBLISH", null, null,
                "配置版本 " + draft.getConfigVersion() + " 已发布: " + changeSummary, operatorId);

        log.info("工厂 {} 配置版本 {} 已发布", factoryId, draft.getConfigVersion());
    }

    @Override
    @Transactional
    public void rollbackConfig(String factoryId, int targetVersion, Long operatorId) {
        FactoryConfiguration target = factoryConfigurationRepository
                .findByFactoryIdAndConfigVersion(factoryId, targetVersion)
                .orElseThrow(() -> new BusinessException("目标版本不存在: " + targetVersion));

        // Create a new version based on target
        FactoryConfiguration newDraft = new FactoryConfiguration();
        newDraft.setFactoryId(factoryId);
        newDraft.setTemplateId(target.getTemplateId());
        newDraft.setConfigVersion(getNextVersion(factoryId));
        newDraft.setStatus("DRAFT");
        newDraft.setCreatedBy(operatorId);
        newDraft.setRollbackVersion(targetVersion);
        factoryConfigurationRepository.save(newDraft);

        // Copy module configs from target version
        List<FactoryModuleConfig> targetModules = factoryModuleConfigRepository
                .findByFactoryIdAndConfigVersion(factoryId, targetVersion);
        for (FactoryModuleConfig src : targetModules) {
            FactoryModuleConfig copy = new FactoryModuleConfig();
            copy.setFactoryId(factoryId);
            copy.setModuleCode(src.getModuleCode());
            copy.setConfigVersion(newDraft.getConfigVersion());
            copy.setEnabled(src.getEnabled());
            copy.setFieldConfig(src.getFieldConfig());
            copy.setWorkflowConfig(src.getWorkflowConfig());
            copy.setValidationConfig(src.getValidationConfig());
            copy.setPermissionConfig(src.getPermissionConfig());
            copy.setLayoutConfig(src.getLayoutConfig());
            copy.setCustomLabels(src.getCustomLabels());
            copy.setComputedFields(src.getComputedFields());
            copy.setRenderingMode(src.getRenderingMode());
            factoryModuleConfigRepository.save(copy);
        }

        logChange(factoryId, null, "ROLLBACK", null, null,
                "回滚到版本 " + targetVersion, operatorId);
    }

    // ========== 模板 ==========

    @Override
    @Transactional
    public void applyTemplate(String factoryId, String templateCode, Long operatorId) {
        // Placeholder for Phase 2 template system
        log.info("applyTemplate: factoryId={}, templateCode={} (Phase 2)", factoryId, templateCode);
        throw new BusinessException("模板系统将在 Phase 2 实现");
    }

    // ========== Private Helpers ==========

    private FactoryConfiguration getOrCreateDraft(String factoryId, Long operatorId) {
        return factoryConfigurationRepository.findDraft(factoryId)
                .orElseGet(() -> {
                    FactoryConfiguration draft = new FactoryConfiguration();
                    draft.setFactoryId(factoryId);
                    draft.setConfigVersion(getNextVersion(factoryId));
                    draft.setStatus("DRAFT");
                    draft.setCreatedBy(operatorId);
                    return factoryConfigurationRepository.save(draft);
                });
    }

    private int getNextVersion(String factoryId) {
        return factoryConfigurationRepository.findByFactoryIdOrderByConfigVersionDesc(factoryId)
                .stream().findFirst()
                .map(c -> c.getConfigVersion() + 1)
                .orElse(1);
    }

    @SuppressWarnings("unchecked")
    private void deepMerge(Map<String, Object> base, Map<String, Object> override) {
        if (override == null) return;
        for (Map.Entry<String, Object> entry : override.entrySet()) {
            String key = entry.getKey();
            Object overrideVal = entry.getValue();
            Object baseVal = base.get(key);

            if (baseVal instanceof Map && overrideVal instanceof Map) {
                deepMerge((Map<String, Object>) baseVal, (Map<String, Object>) overrideVal);
            } else {
                base.put(key, overrideVal);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private List<EffectiveField> buildEffectiveFields(Map<String, Object> fieldSchema,
                                                       Map<String, Object> effectiveFieldConfig,
                                                       Map<String, Object> customLabels) {
        List<Map<String, Object>> schemaDefs = (List<Map<String, Object>>) fieldSchema.getOrDefault("fields", List.of());
        Map<String, Object> fieldOverrides = (Map<String, Object>) effectiveFieldConfig.getOrDefault("fields", Map.of());

        List<EffectiveField> result = new ArrayList<>();
        int order = 0;

        for (Map<String, Object> schemaDef : schemaDefs) {
            String code = (String) schemaDef.get("code");
            Map<String, Object> override = fieldOverrides.containsKey(code)
                    ? (Map<String, Object>) fieldOverrides.get(code)
                    : Map.of();

            boolean visible = getBoolOrDefault(override, "visible",
                    getBoolOrDefault(schemaDef, "defaultVisible", true));
            boolean required = getBoolOrDefault(override, "required",
                    getBoolOrDefault(schemaDef, "required", false));

            String label = customLabels.containsKey(code)
                    ? String.valueOf(customLabels.get(code))
                    : (String) schemaDef.get("label");

            Object defaultValue = override.containsKey("defaultValue")
                    ? override.get("defaultValue")
                    : schemaDef.get("defaultValue");

            List<Map<String, Object>> options = override.containsKey("options")
                    ? (List<Map<String, Object>>) override.get("options")
                    : (List<Map<String, Object>>) schemaDef.get("options");

            Map<String, Object> extra = new HashMap<>();
            if (schemaDef.containsKey("dependsOn")) extra.put("dependsOn", schemaDef.get("dependsOn"));
            if (schemaDef.containsKey("referenceConfig")) extra.put("referenceConfig", schemaDef.get("referenceConfig"));
            if (schemaDef.containsKey("computed")) extra.put("computed", schemaDef.get("computed"));
            if (schemaDef.containsKey("itemSchema")) extra.put("itemSchema", schemaDef.get("itemSchema"));
            if (schemaDef.containsKey("min")) extra.put("min", schemaDef.get("min"));
            if (schemaDef.containsKey("max")) extra.put("max", schemaDef.get("max"));
            if (schemaDef.containsKey("precision")) extra.put("precision", schemaDef.get("precision"));
            if (schemaDef.containsKey("listVisible")) extra.put("listVisible", schemaDef.get("listVisible"));
            if (schemaDef.containsKey("listOrder")) extra.put("listOrder", schemaDef.get("listOrder"));
            if (schemaDef.containsKey("listWidth")) extra.put("listWidth", schemaDef.get("listWidth"));
            if (schemaDef.containsKey("formatter")) extra.put("formatter", schemaDef.get("formatter"));
            if (schemaDef.containsKey("configurable")) extra.put("configurable", schemaDef.get("configurable"));

            result.add(EffectiveField.builder()
                    .code(code)
                    .label(label)
                    .type((String) schemaDef.get("type"))
                    .required(required)
                    .visible(visible)
                    .readonly(getBoolOrDefault(schemaDef, "readonly", false))
                    .defaultValue(defaultValue)
                    .options(options)
                    .group((String) schemaDef.getOrDefault("group", "basic"))
                    .order(order++)
                    .extra(extra)
                    .build());
        }

        return result;
    }

    @SuppressWarnings("unchecked")
    private List<FieldGroup> buildFieldGroups(Map<String, Object> fieldSchema) {
        List<Map<String, Object>> groups = (List<Map<String, Object>>) fieldSchema.getOrDefault("groups", List.of());
        return groups.stream()
                .map(g -> FieldGroup.builder()
                        .code((String) g.get("code"))
                        .label((String) g.get("label"))
                        .order(g.containsKey("order") ? ((Number) g.get("order")).intValue() : 0)
                        .visible(getBoolOrDefault(g, "visible", true))
                        .build())
                .collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    private List<WorkflowStateDTO> buildWorkflowStates(Map<String, Object> workflowSchema,
                                                        Map<String, Object> effectiveWorkflow) {
        if (workflowSchema == null) return List.of();
        List<Map<String, Object>> states = (List<Map<String, Object>>) workflowSchema.getOrDefault("states", List.of());
        Map<String, Object> disabledStates = (Map<String, Object>) effectiveWorkflow.getOrDefault("disabledStates", Map.of());

        return states.stream()
                .map(s -> {
                    String code = (String) s.get("code");
                    boolean enabled = !Boolean.TRUE.equals(disabledStates.get(code));
                    return WorkflowStateDTO.builder()
                            .code(code)
                            .label((String) s.get("label"))
                            .enabled(enabled)
                            .isInitial(getBoolOrDefault(s, "isInitial", false))
                            .isFinal(getBoolOrDefault(s, "isFinal", false))
                            .tagType((String) s.getOrDefault("tagType", ""))
                            .build();
                })
                .collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    private List<WorkflowTransitionDTO> buildWorkflowTransitions(Map<String, Object> workflowSchema,
                                                                   Map<String, Object> effectiveWorkflow) {
        if (workflowSchema == null) return List.of();
        List<Map<String, Object>> transitions = (List<Map<String, Object>>) workflowSchema.getOrDefault("transitions", List.of());
        Map<String, Object> options = (Map<String, Object>) effectiveWorkflow.getOrDefault("options", Map.of());

        return transitions.stream()
                .map(t -> {
                    boolean enabled = true;
                    String condition = (String) t.get("condition");
                    if (condition != null) {
                        enabled = evaluateCondition(condition, options);
                    }
                    return WorkflowTransitionDTO.builder()
                            .from((String) t.get("from"))
                            .to((String) t.get("to"))
                            .action((String) t.get("action"))
                            .label((String) t.getOrDefault("label", (String) t.get("action")))
                            .buttonType((String) t.getOrDefault("buttonType", "primary"))
                            .enabled(enabled)
                            .condition(condition)
                            .allowedRoles(t.containsKey("allowedRoles") ? (List<String>) t.get("allowedRoles") : List.of())
                            .build();
                })
                .collect(Collectors.toList());
    }

    private boolean evaluateCondition(String condition, Map<String, Object> options) {
        // Simple condition evaluator: "!config.workflow.hasFinanceReview" or "config.workflow.allowPartialDelivery"
        if (condition.startsWith("!")) {
            String key = condition.substring(1).replace("config.workflow.", "");
            return !Boolean.TRUE.equals(options.get(key));
        } else {
            String key = condition.replace("config.workflow.", "");
            return Boolean.TRUE.equals(options.get(key));
        }
    }

    @SuppressWarnings("unchecked")
    private void applyPermissionFilter(List<EffectiveField> fields, Map<String, Object> permSchema, String roleCode) {
        List<Map<String, Object>> fieldPerms = (List<Map<String, Object>>) permSchema.getOrDefault("fieldPermissions", List.of());
        Map<String, String> permMap = new HashMap<>();
        for (Map<String, Object> fp : fieldPerms) {
            String fieldCode = (String) fp.get("fieldCode");
            Map<String, String> permissions = (Map<String, String>) fp.get("permissions");
            if (permissions != null && permissions.containsKey(roleCode)) {
                permMap.put(fieldCode, permissions.get(roleCode));
            }
        }

        for (EffectiveField field : fields) {
            String perm = permMap.get(field.getCode());
            if ("hidden".equals(perm)) {
                field.setVisible(false);
            } else if ("view".equals(perm)) {
                field.setReadonly(true);
            }
            // "edit" = default, no change needed
        }
    }

    private boolean getBoolOrDefault(Map<String, Object> map, String key, boolean defaultValue) {
        Object val = map.get(key);
        if (val instanceof Boolean) return (Boolean) val;
        return defaultValue;
    }

    @SuppressWarnings("unchecked")
    private void logChange(String factoryId, String moduleCode, String operation,
                           Map<String, Object> before, Map<String, Object> after,
                           String summary, Long operatorId) {
        ConfigChangeLog log = ConfigChangeLog.builder()
                .factoryId(factoryId)
                .moduleCode(moduleCode)
                .operation(operation)
                .beforeValue(before)
                .afterValue(after)
                .diffSummary(summary)
                .operatorId(operatorId)
                .operatorType("USER")
                .build();
        configChangeLogRepository.save(log);
    }
}
```

- [ ] **Step 3: Compile**

Run:
```bash
cd backend/java/cretas-api
JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd compile 2>&1 | tail -5
```
Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/cretas/aims/service/config/
git commit -m "feat(canvas): FactoryConfigService — 3-layer merge engine + CRUD + publish/rollback"
```

---

### Task 6: ConfigController — REST API

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ConfigController.java`

- [ ] **Step 1: Create controller**

```java
package com.cretas.aims.controller;

import com.cretas.aims.common.ApiResponse;
import com.cretas.aims.dto.config.*;
import com.cretas.aims.service.config.FactoryConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/platform/config/{factoryId}")
@RequiredArgsConstructor
@Tag(name = "Canvas Configuration", description = "画布配置系统 API")
public class ConfigController {

    private final FactoryConfigService configService;

    // ========== 配置消费 API (前端渲染器用) ==========

    @GetMapping("/modules/{moduleCode}/effective")
    @Operation(summary = "获取合并后的有效配置")
    public ApiResponse<EffectiveModuleConfig> getEffectiveConfig(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @RequestParam(required = false) String roleCode) {
        EffectiveModuleConfig config = (roleCode != null)
                ? configService.getEffectiveConfig(factoryId, moduleCode, roleCode)
                : configService.getEffectiveConfig(factoryId, moduleCode);
        return ApiResponse.success(config);
    }

    @GetMapping("/modules")
    @Operation(summary = "获取所有模块摘要")
    public ApiResponse<List<ModuleSummaryDTO>> getModules(@PathVariable String factoryId) {
        return ApiResponse.success(configService.getEnabledModules(factoryId));
    }

    // ========== 配置管理 API (画布编辑器用) ==========

    @PutMapping("/modules/{moduleCode}")
    @Operation(summary = "保存模块配置")
    public ApiResponse<Void> saveModuleConfig(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @RequestBody ModuleConfigDTO dto) {
        configService.saveModuleConfig(factoryId, moduleCode, dto, 1L); // TODO: get from JWT
        return ApiResponse.success(null);
    }

    @PatchMapping("/modules/{moduleCode}/fields/{fieldCode}")
    @Operation(summary = "更新单个字段配置")
    public ApiResponse<Void> updateFieldConfig(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @PathVariable String fieldCode,
            @RequestBody FieldConfigDTO dto) {
        configService.updateFieldConfig(factoryId, moduleCode, fieldCode, dto, 1L);
        return ApiResponse.success(null);
    }

    @PatchMapping("/modules/{moduleCode}/toggle")
    @Operation(summary = "开关模块")
    public ApiResponse<Void> toggleModule(
            @PathVariable String factoryId,
            @PathVariable String moduleCode,
            @RequestParam boolean enabled) {
        configService.toggleModule(factoryId, moduleCode, enabled, 1L);
        return ApiResponse.success(null);
    }

    // ========== 发布与版本 ==========

    @PostMapping("/publish")
    @Operation(summary = "发布配置")
    public ApiResponse<Void> publishConfig(
            @PathVariable String factoryId,
            @RequestParam(required = false) String summary) {
        configService.publishConfig(factoryId, 1L, summary);
        return ApiResponse.success(null);
    }

    @PostMapping("/rollback/{version}")
    @Operation(summary = "回滚到指定版本")
    public ApiResponse<Void> rollbackConfig(
            @PathVariable String factoryId,
            @PathVariable int version) {
        configService.rollbackConfig(factoryId, version, 1L);
        return ApiResponse.success(null);
    }
}
```

- [ ] **Step 2: Compile**

Run:
```bash
cd backend/java/cretas-api
JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd compile 2>&1 | tail -5
```
Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/cretas/aims/controller/ConfigController.java
git commit -m "feat(canvas): ConfigController — REST API for config CRUD + publish + rollback"
```

---

### Task 7: Seed Data — sales_order + bom Module Schemas

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260409_02__seed_sales_order_bom_schema.sql`

- [ ] **Step 1: Create seed migration with full JSON Schema**

This is the largest single file — complete sales_order (22 fields) + bom (10 fields) module schemas with field_schema, workflow_schema, validation_schema, permission_schema, and default_config.

The JSON content follows the spec exactly (Section 3.2.1 and 3.2.2). Due to the size, create this file programmatically:

```sql
-- V20260409_02__seed_sales_order_bom_schema.sql
-- Canvas Config Phase 1: Seed module_schemas for sales_order + bom

INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, validation_schema, permission_schema, default_config, description)
VALUES (
    'sales_order', '销售订单', 'SALES', 1,
    -- field_schema: see spec Section 3.2.1 (paste full JSON from spec)
    '{"fields":[{"code":"orderNumber","label":"订单号","type":"string","required":true,"configurable":false,"autoGenerate":true,"listVisible":true,"listOrder":1,"listWidth":150,"group":"basic"},{"code":"customerId","label":"客户","type":"reference","required":true,"configurable":false,"referenceConfig":{"entity":"customer","displayField":"name","valueField":"id","apiEndpoint":"/api/mobile/{factoryId}/customers"},"listVisible":true,"listOrder":2,"listWidth":140,"group":"basic"},{"code":"orderDate","label":"下单日期","type":"date","required":true,"configurable":false,"defaultValue":"TODAY","listVisible":true,"listOrder":3,"listWidth":120,"group":"basic"},{"code":"requiredDeliveryDate","label":"要求交货日期","type":"date","required":false,"configurable":true,"defaultVisible":true,"listVisible":true,"listOrder":4,"listWidth":120,"group":"basic"},{"code":"salesperson","label":"业务员","type":"string","required":false,"configurable":true,"defaultVisible":true,"group":"basic"},{"code":"remark","label":"备注","type":"textarea","required":false,"configurable":true,"defaultVisible":true,"group":"basic"},{"code":"totalAmount","label":"订单总金额","type":"decimal","required":false,"configurable":false,"computed":"SUM(items[].lineAmount)","readonly":true,"listVisible":true,"listOrder":5,"listWidth":120,"formatter":"currency","group":"amounts"},{"code":"shippingIncluded","label":"是否含运费","type":"boolean","required":false,"configurable":true,"defaultVisible":true,"defaultValue":false,"group":"费用"},{"code":"shippingFee","label":"运费","type":"decimal","required":false,"configurable":true,"defaultVisible":true,"min":0,"dependsOn":{"field":"shippingIncluded","value":true},"group":"费用"},{"code":"extraFees","label":"其他费用","type":"json_array","required":false,"configurable":true,"defaultVisible":true,"itemSchema":{"fields":[{"code":"name","type":"string","label":"费用名","required":true},{"code":"amount","type":"decimal","label":"金额","required":true,"min":0},{"code":"remark","type":"string","label":"备注","required":false}]},"group":"费用"},{"code":"boxQuantity","label":"下单箱数","type":"decimal","required":false,"configurable":true,"defaultVisible":true,"min":0,"group":"basic"},{"code":"status","label":"状态","type":"select","required":false,"configurable":false,"readonly":true,"listVisible":true,"listOrder":6,"listWidth":100,"group":"basic"}],"groups":[{"code":"basic","label":"基本信息","order":1},{"code":"items","label":"订单明细","order":2},{"code":"amounts","label":"金额汇总","order":3},{"code":"费用","label":"运费与其他费用","order":4},{"code":"business","label":"业务中心","order":5}]}'::jsonb,
    -- workflow_schema
    '{"states":[{"code":"DRAFT","label":"草稿","isInitial":true,"tagType":"info"},{"code":"CONFIRMED","label":"已确认","tagType":""},{"code":"PENDING_FINANCE_REVIEW","label":"待财务审核","configurable":true,"tagType":"warning"},{"code":"FINANCE_APPROVED","label":"财务已审核","configurable":true,"tagType":"success"},{"code":"PROCESSING","label":"生产中","tagType":""},{"code":"PARTIAL_DELIVERED","label":"部分发货","tagType":"warning"},{"code":"SHIPPED","label":"已发货","tagType":"success"},{"code":"COMPLETED","label":"已完成","isFinal":true,"tagType":"success"},{"code":"CANCELLED","label":"已取消","isFinal":true,"tagType":"danger"}],"transitions":[{"from":"DRAFT","to":"CONFIRMED","action":"confirm","label":"确认订单","buttonType":"primary"},{"from":"CONFIRMED","to":"PENDING_FINANCE_REVIEW","action":"submitForReview","label":"提交审核","buttonType":"warning","configurable":true},{"from":"PENDING_FINANCE_REVIEW","to":"FINANCE_APPROVED","action":"approveFinance","label":"审核通过","buttonType":"success","configurable":true},{"from":"CONFIRMED","to":"PROCESSING","action":"startProduction","label":"开始生产","buttonType":"primary","condition":"!config.workflow.hasFinanceReview"},{"from":"FINANCE_APPROVED","to":"PROCESSING","action":"startProduction","label":"开始生产","buttonType":"primary"},{"from":"PROCESSING","to":"SHIPPED","action":"ship","label":"确认发货","buttonType":"success"},{"from":"SHIPPED","to":"COMPLETED","action":"complete","label":"完成","buttonType":"success"},{"from":"DRAFT","to":"CANCELLED","action":"cancel","label":"取消","buttonType":"danger"},{"from":"CONFIRMED","to":"CANCELLED","action":"cancel","label":"取消","buttonType":"danger"}],"options":{"hasFinanceReview":{"type":"boolean","label":"启用财务审核","default":true,"configurable":true},"allowPartialDelivery":{"type":"boolean","label":"允许部分发货","default":true,"configurable":true}}}'::jsonb,
    -- validation_schema
    '{"rules":[{"code":"DUPLICATE_PRODUCT_CHECK","label":"同产品重复校验","enabled":true,"configurable":true},{"code":"MIN_ORDER_AMOUNT","label":"最低订单金额","enabled":false,"configurable":true,"params":{"minAmount":100}}]}'::jsonb,
    -- permission_schema
    '{"roles":["factory_super_admin","sales_manager","sales_staff","finance","warehouse","viewer"],"fieldPermissions":[{"fieldCode":"totalAmount","permissions":{"factory_super_admin":"edit","sales_manager":"edit","sales_staff":"view","finance":"view","warehouse":"hidden","viewer":"view"}},{"fieldCode":"shippingFee","permissions":{"factory_super_admin":"edit","sales_manager":"edit","sales_staff":"edit","finance":"view","warehouse":"hidden","viewer":"hidden"}}]}'::jsonb,
    -- default_config
    '{"fields":{},"workflow":{"options":{"hasFinanceReview":true,"allowPartialDelivery":true}}}'::jsonb,
    '销售订单模块: 包含订单创建/确认/审核/发货/完成全流程, 支持税率分组开票'
)
ON CONFLICT (module_code) DO NOTHING;

INSERT INTO module_schemas (module_code, module_name, module_category, module_version,
    field_schema, workflow_schema, validation_schema, permission_schema, default_config, description)
VALUES (
    'bom', 'BOM配方', 'PRODUCTION', 1,
    '{"fields":[{"code":"productTypeId","label":"产品(成品)","type":"reference","required":true,"configurable":false,"referenceConfig":{"entity":"productType","displayField":"name","valueField":"id","apiEndpoint":"/api/mobile/{factoryId}/finished-goods/product-types"},"listVisible":true,"listOrder":1,"listWidth":160,"group":"basic"},{"code":"materialTypeId","label":"原辅料","type":"reference","required":true,"configurable":false,"referenceConfig":{"entity":"materialType","displayField":"name","valueField":"id","apiEndpoint":"/api/mobile/{factoryId}/material-types"},"listVisible":true,"listOrder":2,"listWidth":160,"group":"basic"},{"code":"materialCategory","label":"物料分类","type":"select","required":true,"configurable":true,"defaultVisible":true,"options":[{"value":"RAW","label":"原料"},{"value":"AUXILIARY","label":"辅料"},{"value":"PACKAGING","label":"包材"}],"defaultValue":"RAW","listVisible":true,"listOrder":3,"listWidth":100,"group":"basic"},{"code":"standardQuantity","label":"标准用量","type":"decimal","required":true,"configurable":false,"min":0.0001,"precision":4,"listVisible":true,"listOrder":4,"listWidth":120,"group":"dosage"},{"code":"unit","label":"计量单位","type":"select","required":true,"configurable":true,"options":[{"value":"kg","label":"公斤"},{"value":"g","label":"克"},{"value":"piece","label":"个"},{"value":"pack","label":"包"}],"defaultValue":"kg","listVisible":true,"listOrder":5,"listWidth":80,"group":"dosage"},{"code":"yieldRate","label":"出成率(%)","type":"decimal","required":false,"configurable":true,"defaultVisible":true,"min":0.01,"max":100,"precision":2,"defaultValue":100.00,"listVisible":true,"listOrder":6,"listWidth":100,"group":"dosage"},{"code":"unitPrice","label":"单价","type":"decimal","required":false,"configurable":true,"defaultVisible":true,"min":0,"precision":4,"listVisible":true,"listOrder":7,"listWidth":100,"group":"cost"},{"code":"sortOrder","label":"排序","type":"integer","required":false,"configurable":true,"defaultVisible":false,"defaultValue":0,"group":"basic"},{"code":"remark","label":"备注","type":"textarea","required":false,"configurable":true,"defaultVisible":true,"group":"basic"}],"groups":[{"code":"basic","label":"基本信息","order":1},{"code":"dosage","label":"用量与出成","order":2},{"code":"cost","label":"成本","order":3}]}'::jsonb,
    '{"states":[{"code":"DRAFT","label":"草稿","isInitial":true,"tagType":"info"},{"code":"ACTIVE","label":"生效中","tagType":"success"},{"code":"DEPRECATED","label":"已废弃","isFinal":true,"tagType":"danger"}],"transitions":[{"from":"DRAFT","to":"ACTIVE","action":"activate","label":"启用","buttonType":"success"},{"from":"ACTIVE","to":"DEPRECATED","action":"deprecate","label":"废弃","buttonType":"danger"},{"from":"ACTIVE","to":"DRAFT","action":"revise","label":"修订","buttonType":"warning"}],"options":{}}'::jsonb,
    '{"rules":[]}'::jsonb,
    '{"roles":["factory_super_admin","production_manager","quality"],"fieldPermissions":[]}'::jsonb,
    '{"fields":{},"workflow":{"options":{}},"categories":{"RAW":{"enabled":true},"AUXILIARY":{"enabled":true},"PACKAGING":{"enabled":true}}}'::jsonb,
    'BOM配方模块: 原料/辅料/包材三分组, 支持出成率计算'
)
ON CONFLICT (module_code) DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
git add src/main/resources/db/migration/V20260409_02__seed_sales_order_bom_schema.sql
git commit -m "feat(canvas): seed module_schemas for sales_order + bom (Phase 1 demo modules)"
```

---

## Week 2-3 任务概要 (详细步骤在后续迭代中完善)

### Week 2: Service 适配 + @RequireModule AOP

**Task 8**: `@RequireModule` annotation + `ModuleEnabledAspect` AOP 切面
**Task 9**: `SalesServiceImpl` 适配 — 注入 FactoryConfigService,字段校验 config-driven
**Task 10**: BOM Service 适配

### Week 3: Frontend Dynamic Renderer

**Task 11**: TypeScript types (`web-admin/src/types/config.ts`)
**Task 12**: Config API client (`web-admin/src/api/configApi.ts`)
**Task 13**: Pinia config store (`web-admin/src/stores/configStore.ts`)
**Task 14**: `SchemaFormRenderer.vue` — 动态表单渲染器 (14 种字段类型映射)
**Task 15**: `SchemaTableRenderer.vue` — 动态列表渲染器
**Task 16**: `ReferenceSelector.vue` + `DynamicArrayEditor.vue` + `LineItemsEditor.vue` 子组件
**Task 17**: `DynamicModulePage.vue` — 通用模块壳
**Task 18**: 路由注册 + Feature Flag

---

## Verification Criteria (Phase 1 Done)

1. `curl /api/platform/config/F001/modules/sales_order/effective` 返回完整 EffectiveModuleConfig
2. 修改 `factory_module_configs` 关闭运费字段 → `getEffectiveConfig` 返回 shippingFee.visible=false
3. 修改 `workflow_config.options.hasFinanceReview=false` → CONFIRMED 可直接到 PROCESSING
4. 动态渲染的 `/modules/sales_order` 页面能创建订单
5. 动态渲染的 `/modules/bom` 页面能显示 BOM 列表 (3 tab: 原料/辅料/包材)
6. Feature Flag: LEGACY → 走旧页面; DYNAMIC → 走新 Renderer
