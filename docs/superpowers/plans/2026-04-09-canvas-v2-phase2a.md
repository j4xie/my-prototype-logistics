# Canvas V2 Phase 2a — Tool/Skill Factory Config + TriggerChainExecutor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable per-factory Tool/Skill enable/disable and configurable event trigger chains, replacing hardcoded @EventListener orchestration with database-driven chains.

**Architecture:** 3 new PostgreSQL tables store factory-level Tool configs, Skill configs, and trigger chains. ToolRegistry and SkillRegistry get `getXxxForFactory(factoryId)` methods. A new ConfigurableTriggerChainExecutor reads trigger chain steps from DB and executes Tools in sequence, replacing the hardcoded SupplyChainOrchestrator logic. Existing @EventListener methods are preserved as fallback.

**Tech Stack:** Java 21, Spring Boot 3.2.12, PostgreSQL (JSONB), JPA/Hibernate 6, Spring Events

**Spec:** `docs/superpowers/specs/2026-04-09-canvas-v2-unified-config-engine.md` (Section 3.1 + 4.1 + 5)

---

## File Structure

### Backend (Java)

```
backend/java/cretas-api/src/main/java/com/cretas/aims/
├── entity/config/
│   ├── FactoryToolConfig.java              (NEW)
│   ├── FactorySkillConfig.java             (NEW)
│   └── FactoryTriggerChain.java            (NEW)
├── repository/config/
│   ├── FactoryToolConfigRepository.java    (NEW)
│   ├── FactorySkillConfigRepository.java   (NEW)
│   └── FactoryTriggerChainRepository.java  (NEW)
├── dto/config/
│   ├── TriggerChainDTO.java                (NEW)
│   ├── TriggerStepDTO.java                 (NEW)
│   ├── ToolConfigDTO.java                  (NEW)
│   └── SkillConfigDTO.java                 (NEW)
├── service/config/
│   ├── TriggerChainService.java            (NEW — interface)
│   └── impl/
│       └── TriggerChainServiceImpl.java    (NEW)
├── engine/
│   └── TriggerChainExecutor.java           (NEW — @EventListener replacement)
├── ai/tool/
│   └── ToolRegistry.java                   (MODIFY — add getToolsForFactory)
├── service/skill/impl/
│   └── SkillRegistryImpl.java              (MODIFY — add getSkillsForFactory)
├── controller/
│   └── TriggerChainController.java         (NEW — REST API)
└── service/orchestration/
    └── SupplyChainOrchestrator.java        (MODIFY — add fallback gate)

backend/java/cretas-api/src/main/resources/db/migration/
├── V20260410_01__factory_tool_skill_trigger_tables.sql   (NEW)
└── V20260410_02__seed_default_trigger_chains.sql         (NEW)
```

---

## Task 1: Database Migration — 3 New Tables

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260410_01__factory_tool_skill_trigger_tables.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- V20260410_01__factory_tool_skill_trigger_tables.sql
-- Canvas V2 Phase 2a: Factory-level Tool, Skill, and Trigger Chain configs

-- 1. factory_tool_configs: per-factory tool enable/disable
CREATE TABLE IF NOT EXISTS factory_tool_configs (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50) NOT NULL,
    tool_name       VARCHAR(100) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    param_overrides JSONB NOT NULL DEFAULT '{}',
    risk_override   VARCHAR(20),
    custom_description TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ftc_factory_tool
    ON factory_tool_configs(factory_id, tool_name);
CREATE INDEX IF NOT EXISTS idx_ftc_factory ON factory_tool_configs(factory_id);

DROP TRIGGER IF EXISTS trigger_ftc_updated_at ON factory_tool_configs;
CREATE TRIGGER trigger_ftc_updated_at
BEFORE UPDATE ON factory_tool_configs
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. factory_skill_configs: per-factory skill enable/disable + custom DAG
CREATE TABLE IF NOT EXISTS factory_skill_configs (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50) NOT NULL,
    skill_name      VARCHAR(100) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    custom_dag      JSONB,
    custom_triggers JSONB,
    priority        INTEGER DEFAULT 100,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fsc_factory_skill
    ON factory_skill_configs(factory_id, skill_name);
CREATE INDEX IF NOT EXISTS idx_fsc_factory ON factory_skill_configs(factory_id);

DROP TRIGGER IF EXISTS trigger_fsc_updated_at ON factory_skill_configs;
CREATE TRIGGER trigger_fsc_updated_at
BEFORE UPDATE ON factory_skill_configs
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. factory_trigger_chains: configurable event→tool sequences
CREATE TABLE IF NOT EXISTS factory_trigger_chains (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50),
    chain_code      VARCHAR(64) NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    steps           JSONB NOT NULL DEFAULT '[]',
    error_strategy  VARCHAR(20) NOT NULL DEFAULT 'CONTINUE',
    description     TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ftch_factory_chain
    ON factory_trigger_chains(factory_id, chain_code);
CREATE INDEX IF NOT EXISTS idx_ftch_event ON factory_trigger_chains(event_type);
CREATE INDEX IF NOT EXISTS idx_ftch_factory ON factory_trigger_chains(factory_id);

DROP TRIGGER IF EXISTS trigger_ftch_updated_at ON factory_trigger_chains;
CREATE TRIGGER trigger_ftch_updated_at
BEFORE UPDATE ON factory_trigger_chains
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Grant permissions to cretas_user
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cretas_user') THEN
        GRANT ALL ON TABLE factory_tool_configs, factory_skill_configs, factory_trigger_chains TO cretas_user;
        GRANT ALL ON SEQUENCE factory_tool_configs_id_seq, factory_skill_configs_id_seq, factory_trigger_chains_id_seq TO cretas_user;
    END IF;
END $$;
```

- [ ] **Step 2: Commit**

```bash
git add src/main/resources/db/migration/V20260410_01__factory_tool_skill_trigger_tables.sql
git commit -m "feat(canvas-v2): V20260410_01 factory tool/skill/trigger tables"
```

---

## Task 2: JPA Entities — 3 Config Entities

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/FactoryToolConfig.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/FactorySkillConfig.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/FactoryTriggerChain.java`

- [ ] **Step 1: Create FactoryToolConfig**

```java
package com.cretas.aims.entity.config;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "factory_tool_configs",
    uniqueConstraints = @UniqueConstraint(name = "idx_ftc_factory_tool", columnNames = {"factory_id", "tool_name"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FactoryToolConfig {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "factory_id", length = 50, nullable = false)
    private String factoryId;

    @Column(name = "tool_name", length = 100, nullable = false)
    private String toolName;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Type(JsonBinaryType.class)
    @Column(name = "param_overrides", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, Object> paramOverrides = Map.of();

    @Column(name = "risk_override", length = 20)
    private String riskOverride;

    @Column(name = "custom_description", columnDefinition = "TEXT")
    private String customDescription;

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist protected void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

- [ ] **Step 2: Create FactorySkillConfig**

```java
package com.cretas.aims.entity.config;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "factory_skill_configs",
    uniqueConstraints = @UniqueConstraint(name = "idx_fsc_factory_skill", columnNames = {"factory_id", "skill_name"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FactorySkillConfig {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "factory_id", length = 50, nullable = false)
    private String factoryId;

    @Column(name = "skill_name", length = 100, nullable = false)
    private String skillName;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Type(JsonBinaryType.class)
    @Column(name = "custom_dag", columnDefinition = "jsonb")
    private Map<String, Object> customDag;

    @Type(JsonBinaryType.class)
    @Column(name = "custom_triggers", columnDefinition = "jsonb")
    private List<String> customTriggers;

    @Column(name = "priority")
    @Builder.Default
    private Integer priority = 100;

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist protected void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

- [ ] **Step 3: Create FactoryTriggerChain**

```java
package com.cretas.aims.entity.config;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "factory_trigger_chains",
    uniqueConstraints = @UniqueConstraint(name = "idx_ftch_factory_chain", columnNames = {"factory_id", "chain_code"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FactoryTriggerChain {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "factory_id", length = 50)
    private String factoryId;

    @Column(name = "chain_code", length = 64, nullable = false)
    private String chainCode;

    @Column(name = "event_type", length = 100, nullable = false)
    private String eventType;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Type(JsonBinaryType.class)
    @Column(name = "steps", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<Map<String, Object>> steps = List.of();

    @Column(name = "error_strategy", length = 20, nullable = false)
    @Builder.Default
    private String errorStrategy = "CONTINUE";

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist protected void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

- [ ] **Step 4: Compile + Commit**

```bash
cd backend/java/cretas-api
JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd compile 2>&1 | tail -3
git add src/main/java/com/cretas/aims/entity/config/FactoryToolConfig.java \
        src/main/java/com/cretas/aims/entity/config/FactorySkillConfig.java \
        src/main/java/com/cretas/aims/entity/config/FactoryTriggerChain.java
git commit -m "feat(canvas-v2): 3 factory config entities (Tool/Skill/TriggerChain)"
```

---

## Task 3: Repositories — 3 Repos

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/FactoryToolConfigRepository.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/FactorySkillConfigRepository.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/FactoryTriggerChainRepository.java`

- [ ] **Step 1: Create all 3 repositories**

`FactoryToolConfigRepository.java`:
```java
package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactoryToolConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FactoryToolConfigRepository extends JpaRepository<FactoryToolConfig, Long> {
    List<FactoryToolConfig> findByFactoryId(String factoryId);
    Optional<FactoryToolConfig> findByFactoryIdAndToolName(String factoryId, String toolName);
    List<FactoryToolConfig> findByFactoryIdAndEnabledFalse(String factoryId);
}
```

`FactorySkillConfigRepository.java`:
```java
package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactorySkillConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FactorySkillConfigRepository extends JpaRepository<FactorySkillConfig, Long> {
    List<FactorySkillConfig> findByFactoryId(String factoryId);
    Optional<FactorySkillConfig> findByFactoryIdAndSkillName(String factoryId, String skillName);
    List<FactorySkillConfig> findByFactoryIdAndEnabledTrue(String factoryId);
}
```

`FactoryTriggerChainRepository.java`:
```java
package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactoryTriggerChain;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FactoryTriggerChainRepository extends JpaRepository<FactoryTriggerChain, Long> {
    List<FactoryTriggerChain> findByFactoryIdAndEventTypeAndEnabledTrue(String factoryId, String eventType);

    @Query("SELECT c FROM FactoryTriggerChain c WHERE c.factoryId IS NULL AND c.eventType = :eventType AND c.enabled = true")
    List<FactoryTriggerChain> findGlobalByEventType(@Param("eventType") String eventType);

    List<FactoryTriggerChain> findByFactoryId(String factoryId);
    Optional<FactoryTriggerChain> findByFactoryIdAndChainCode(String factoryId, String chainCode);
}
```

- [ ] **Step 2: Compile + Commit**

```bash
git add src/main/java/com/cretas/aims/repository/config/Factory*Config*.java \
        src/main/java/com/cretas/aims/repository/config/FactoryTriggerChainRepository.java
git commit -m "feat(canvas-v2): 3 factory config repositories"
```

---

## Task 4: ToolRegistry Extension — getToolsForFactory

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/ToolRegistry.java`

- [ ] **Step 1: Add repository injection + new method**

Add to ToolRegistry:
```java
@Autowired(required = false)
private FactoryToolConfigRepository factoryToolConfigRepository;

/**
 * Canvas V2: Returns tools filtered by factory-level enable/disable config.
 * If no factory config exists for a tool, it's enabled by default.
 */
public List<Tool> getToolsForFactory(String factoryId) {
    List<Tool> allTools = getAllToolDefinitions();
    if (factoryToolConfigRepository == null) return allTools;

    List<FactoryToolConfig> configs = factoryToolConfigRepository.findByFactoryId(factoryId);
    if (configs.isEmpty()) return allTools;

    Set<String> disabledTools = configs.stream()
            .filter(c -> !c.getEnabled())
            .map(FactoryToolConfig::getToolName)
            .collect(Collectors.toSet());

    return allTools.stream()
            .filter(t -> !disabledTools.contains(t.getName()))
            .collect(Collectors.toList());
}

/**
 * Canvas V2: Check if a specific tool is enabled for a factory.
 */
public boolean isToolEnabledForFactory(String factoryId, String toolName) {
    if (factoryToolConfigRepository == null) return true;
    return factoryToolConfigRepository.findByFactoryIdAndToolName(factoryId, toolName)
            .map(FactoryToolConfig::getEnabled)
            .orElse(true);
}
```

Add imports:
```java
import com.cretas.aims.entity.config.FactoryToolConfig;
import com.cretas.aims.repository.config.FactoryToolConfigRepository;
import java.util.Set;
import java.util.stream.Collectors;
```

- [ ] **Step 2: Compile + Commit**

```bash
git add src/main/java/com/cretas/aims/ai/tool/ToolRegistry.java
git commit -m "feat(canvas-v2): ToolRegistry.getToolsForFactory() per-factory filtering"
```

---

## Task 5: SkillRegistry Extension — getSkillsForFactory

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/skill/impl/SkillRegistryImpl.java`

- [ ] **Step 1: Add repository injection + new methods**

Add to SkillRegistryImpl:
```java
@Autowired(required = false)
private FactorySkillConfigRepository factorySkillConfigRepository;

/**
 * Canvas V2: Get skills filtered by factory config.
 */
public List<SkillDefinition> getSkillsForFactory(String factoryId) {
    List<SkillDefinition> allSkills = new ArrayList<>(skillMap.values());
    if (factorySkillConfigRepository == null) return allSkills;

    List<FactorySkillConfig> configs = factorySkillConfigRepository.findByFactoryId(factoryId);
    if (configs.isEmpty()) return allSkills;

    Map<String, FactorySkillConfig> configMap = configs.stream()
            .collect(Collectors.toMap(FactorySkillConfig::getSkillName, c -> c));

    return allSkills.stream()
            .filter(s -> {
                FactorySkillConfig fc = configMap.get(s.getName());
                return fc == null || fc.getEnabled();
            })
            .collect(Collectors.toList());
}

/**
 * Canvas V2: Get a skill with factory-level DAG overrides.
 */
public SkillDefinition getSkillForFactory(String factoryId, String skillName) {
    SkillDefinition base = skillMap.get(skillName);
    if (base == null || factorySkillConfigRepository == null) return base;

    Optional<FactorySkillConfig> config = factorySkillConfigRepository
            .findByFactoryIdAndSkillName(factoryId, skillName);

    if (config.isEmpty()) return base;
    if (!config.get().getEnabled()) return null;

    // Custom triggers override
    if (config.get().getCustomTriggers() != null && !config.get().getCustomTriggers().isEmpty()) {
        base = SkillDefinition.builder()
                .name(base.getName()).displayName(base.getDisplayName())
                .description(base.getDescription()).version(base.getVersion())
                .triggers(config.get().getCustomTriggers())
                .tools(base.getTools()).contextNeeded(base.getContextNeeded())
                .promptTemplate(base.getPromptTemplate()).source(base.getSource())
                .enabled(true).build();
    }

    return base;
}
```

Add imports:
```java
import com.cretas.aims.entity.config.FactorySkillConfig;
import com.cretas.aims.repository.config.FactorySkillConfigRepository;
import java.util.ArrayList;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
```

- [ ] **Step 2: Compile + Commit**

```bash
git add src/main/java/com/cretas/aims/service/skill/impl/SkillRegistryImpl.java
git commit -m "feat(canvas-v2): SkillRegistry.getSkillsForFactory() per-factory filtering"
```

---

## Task 6: TriggerChainExecutor — Configurable Event Handler

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/TriggerChainExecutor.java`

- [ ] **Step 1: Create the executor**

```java
package com.cretas.aims.engine;

import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.ai.tool.ToolRegistry;
import com.cretas.aims.entity.config.FactoryTriggerChain;
import com.cretas.aims.repository.config.FactoryTriggerChainRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.*;

/**
 * Canvas V2: Configurable trigger chain executor.
 * Listens to ALL ApplicationEvents and routes them through factory_trigger_chains.
 * If no chain is configured, the event falls through to existing @EventListener handlers.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Order(1) // Execute BEFORE other listeners
public class TriggerChainExecutor {

    private final FactoryTriggerChainRepository triggerChainRepository;
    private final ToolRegistry toolRegistry;

    // Events we handle — mapped from class name to extract factoryId
    private static final Set<String> HANDLED_EVENTS = Set.of(
            "SalesOrderConfirmedEvent", "SalesOrderFinanceApprovedEvent",
            "MaterialReceivedEvent", "BatchCompletedEvent",
            "FinishedGoodsCreatedEvent", "PaymentReceivedEvent"
    );

    @EventListener
    public void onApplicationEvent(ApplicationEvent event) {
        String eventType = event.getClass().getSimpleName();
        if (!HANDLED_EVENTS.contains(eventType)) return;

        String factoryId = extractFactoryId(event);
        if (factoryId == null) return;

        // Check for factory-specific chains first, then global defaults
        List<FactoryTriggerChain> chains = triggerChainRepository
                .findByFactoryIdAndEventTypeAndEnabledTrue(factoryId, eventType);

        if (chains.isEmpty()) {
            chains = triggerChainRepository.findGlobalByEventType(eventType);
        }

        if (chains.isEmpty()) {
            // No chain configured — let existing @EventListener handlers run
            return;
        }

        for (FactoryTriggerChain chain : chains) {
            try {
                executeChain(chain, factoryId, event);
            } catch (Exception e) {
                log.error("Trigger chain {} failed for factory {}: {}",
                        chain.getChainCode(), factoryId, e.getMessage(), e);
            }
        }
    }

    private void executeChain(FactoryTriggerChain chain, String factoryId, ApplicationEvent event) {
        List<Map<String, Object>> steps = chain.getSteps();
        if (steps == null || steps.isEmpty()) return;

        Map<String, Object> chainContext = new HashMap<>();
        chainContext.put("event", event);
        chainContext.put("factoryId", factoryId);

        log.info("Executing trigger chain {} ({} steps) for factory {}",
                chain.getChainCode(), steps.size(), factoryId);

        for (Map<String, Object> step : steps) {
            Boolean stepEnabled = (Boolean) step.getOrDefault("enabled", true);
            if (!stepEnabled) continue;

            String toolName = (String) step.get("tool");
            String condition = (String) step.getOrDefault("condition", "always");
            int order = step.containsKey("order") ? ((Number) step.get("order")).intValue() : 0;

            // Evaluate condition
            if (!"always".equals(condition) && !evaluateCondition(condition, chainContext)) {
                log.debug("Chain {} step {} skipped (condition: {})", chain.getChainCode(), toolName, condition);
                continue;
            }

            // Execute tool
            Optional<ToolExecutor> executor = toolRegistry.getExecutor(toolName);
            if (executor.isEmpty()) {
                log.warn("Tool not found in chain {}: {}", chain.getChainCode(), toolName);
                continue;
            }

            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> params = (Map<String, Object>) step.getOrDefault("params", Map.of());
                Map<String, Object> execContext = new HashMap<>(chainContext);
                execContext.putAll(params);

                String result = executor.get().execute(
                        new com.cretas.aims.ai.dto.ToolCall(toolName, params), execContext);
                chainContext.put("step" + order, Map.of("result", result, "success", true));
                log.info("Chain {} step {} executed OK", chain.getChainCode(), toolName);
            } catch (Exception e) {
                chainContext.put("step" + order, Map.of("success", false, "error", e.getMessage()));
                log.error("Chain {} step {} failed: {}", chain.getChainCode(), toolName, e.getMessage());

                if ("STOP".equals(chain.getErrorStrategy())) {
                    throw new RuntimeException("Trigger chain stopped at step " + toolName, e);
                }
            }
        }
    }

    private boolean evaluateCondition(String condition, Map<String, Object> context) {
        // Simple condition evaluator:
        // "step1.result.success == true"
        // "step1.result.hasStock == false"
        try {
            if (condition.contains("==")) {
                String[] parts = condition.split("==");
                String path = parts[0].trim();
                String expected = parts[1].trim();
                Object actual = resolvePath(path, context);
                return String.valueOf(actual).equals(expected);
            }
            if (condition.startsWith("!")) {
                String path = condition.substring(1).trim();
                Object val = resolvePath(path, context);
                return !Boolean.TRUE.equals(val) && !"true".equals(String.valueOf(val));
            }
            Object val = resolvePath(condition, context);
            return Boolean.TRUE.equals(val) || "true".equals(String.valueOf(val));
        } catch (Exception e) {
            log.debug("Condition evaluation failed: {} — treating as false", condition);
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    private Object resolvePath(String path, Map<String, Object> context) {
        String[] parts = path.split("\\.");
        Object current = context;
        for (String part : parts) {
            if (current instanceof Map) {
                current = ((Map<String, Object>) current).get(part);
            } else {
                return null;
            }
        }
        return current;
    }

    private String extractFactoryId(ApplicationEvent event) {
        try {
            Method method = event.getClass().getMethod("getFactoryId");
            return (String) method.invoke(event);
        } catch (Exception e) {
            return null;
        }
    }
}
```

- [ ] **Step 2: Compile + Commit**

```bash
git add src/main/java/com/cretas/aims/engine/TriggerChainExecutor.java
git commit -m "feat(canvas-v2): TriggerChainExecutor — configurable event→tool chains"
```

---

## Task 7: SupplyChainOrchestrator Fallback Gate

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/orchestration/SupplyChainOrchestrator.java`

- [ ] **Step 1: Add trigger chain check to each @EventListener**

Add field injection:
```java
@Autowired(required = false)
private FactoryTriggerChainRepository triggerChainRepository;
```

Add helper method:
```java
/**
 * Canvas V2: Check if a configurable trigger chain exists for this event.
 * If yes, skip the hardcoded logic (TriggerChainExecutor handles it).
 * If no, run the original hardcoded logic as fallback.
 */
private boolean hasConfiguredChain(String factoryId, String eventType) {
    if (triggerChainRepository == null) return false;
    List<FactoryTriggerChain> chains = triggerChainRepository
            .findByFactoryIdAndEventTypeAndEnabledTrue(factoryId, eventType);
    if (!chains.isEmpty()) return true;
    chains = triggerChainRepository.findGlobalByEventType(eventType);
    return !chains.isEmpty();
}
```

At the TOP of each existing @EventListener method, add:
```java
if (hasConfiguredChain(event.getFactoryId(), "SalesOrderFinanceApprovedEvent")) {
    log.info("Trigger chain configured for {} — skipping hardcoded handler", event.getClass().getSimpleName());
    return;
}
```

Apply this pattern to all 5 @EventListener methods: `onSalesOrderConfirmed`, `onSalesOrderFinanceApproved`, `onMaterialReceived`, `onBatchCompleted`, `onPaymentReceived`.

- [ ] **Step 2: Compile + Commit**

```bash
git add src/main/java/com/cretas/aims/service/orchestration/SupplyChainOrchestrator.java
git commit -m "feat(canvas-v2): SupplyChainOrchestrator fallback gate for trigger chains"
```

---

## Task 8: Seed Default Trigger Chains

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260410_02__seed_default_trigger_chains.sql`

- [ ] **Step 1: Write seed migration**

Extract the 4 active SupplyChainOrchestrator chains as global defaults (factory_id = NULL):

```sql
-- V20260410_02__seed_default_trigger_chains.sql
-- Seed global default trigger chains from SupplyChainOrchestrator logic

-- Chain 1: SO Finance Approved → inventory check → reserve/plan
INSERT INTO factory_trigger_chains (factory_id, chain_code, event_type, enabled, steps, error_strategy, description)
VALUES (NULL, 'SO_FINANCE_APPROVED', 'SalesOrderFinanceApprovedEvent', true,
'[{"order":1,"tool":"inventory_check_stock","condition":"always","enabled":true,"params":{}},{"order":2,"tool":"inventory_reserve_stock","condition":"step1.success == true","enabled":true,"params":{}},{"order":3,"tool":"production_plan_create","condition":"step1.success == false","enabled":true,"params":{"source":"SO_AUTO"}},{"order":4,"tool":"purchase_suggestion_create","condition":"step1.success == false","enabled":true,"params":{}}]'::jsonb,
'CONTINUE', '销售订单财务审批后: 检查库存→预留/自动排产+采购建议')
ON CONFLICT (factory_id, chain_code) DO NOTHING;

-- Chain 2: Batch Completed → consume materials → create FG → create QI
INSERT INTO factory_trigger_chains (factory_id, chain_code, event_type, enabled, steps, error_strategy, description)
VALUES (NULL, 'BATCH_COMPLETED', 'BatchCompletedEvent', true,
'[{"order":1,"tool":"material_batch_consume","condition":"always","enabled":true,"params":{"mode":"auto"}},{"order":2,"tool":"finished_goods_create","condition":"always","enabled":true,"params":{}},{"order":3,"tool":"quality_inspection_create","condition":"always","enabled":true,"params":{"status":"PENDING"}}]'::jsonb,
'CONTINUE', '生产批次完成: 自动扣料→建成品批次→建质检任务')
ON CONFLICT (factory_id, chain_code) DO NOTHING;

-- Chain 3: Material Received → recheck PP availability
INSERT INTO factory_trigger_chains (factory_id, chain_code, event_type, enabled, steps, error_strategy, description)
VALUES (NULL, 'MATERIAL_RECEIVED', 'MaterialReceivedEvent', true,
'[{"order":1,"tool":"production_plan_recheck_material","condition":"always","enabled":true,"params":{}}]'::jsonb,
'CONTINUE', '原料到货: 重新检查排产计划物料齐套')
ON CONFLICT (factory_id, chain_code) DO NOTHING;

-- Chain 4: SO Confirmed → log only (actual orchestration on finance approval)
INSERT INTO factory_trigger_chains (factory_id, chain_code, event_type, enabled, steps, error_strategy, description)
VALUES (NULL, 'SO_CONFIRMED', 'SalesOrderConfirmedEvent', true,
'[]'::jsonb,
'CONTINUE', '销售订单确认: 仅记录日志 (等待财务审批后触发编排)')
ON CONFLICT (factory_id, chain_code) DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
git add src/main/resources/db/migration/V20260410_02__seed_default_trigger_chains.sql
git commit -m "feat(canvas-v2): seed 4 default trigger chains from SupplyChainOrchestrator"
```

---

## Task 9: REST API — Trigger Chain + Tool/Skill Config

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/TriggerChainController.java`

- [ ] **Step 1: Create controller**

```java
package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.config.*;
import com.cretas.aims.repository.config.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/mobile/{factoryId}/config/v2")
@RequiredArgsConstructor
@Tag(name = "Canvas V2 Config", description = "Tool/Skill/TriggerChain 工厂级配置")
public class TriggerChainController {

    private final FactoryToolConfigRepository toolConfigRepo;
    private final FactorySkillConfigRepository skillConfigRepo;
    private final FactoryTriggerChainRepository triggerChainRepo;

    // ========== Tool Config ==========

    @GetMapping("/tools")
    @Operation(summary = "获取工厂 Tool 配置列表")
    public ApiResponse<List<FactoryToolConfig>> getToolConfigs(@PathVariable String factoryId) {
        return ApiResponse.success(toolConfigRepo.findByFactoryId(factoryId));
    }

    @PutMapping("/tools/{toolName}")
    @Operation(summary = "设置 Tool 开关/参数覆盖")
    public ApiResponse<FactoryToolConfig> setToolConfig(
            @PathVariable String factoryId, @PathVariable String toolName,
            @RequestBody Map<String, Object> body) {
        FactoryToolConfig config = toolConfigRepo.findByFactoryIdAndToolName(factoryId, toolName)
                .orElseGet(() -> {
                    FactoryToolConfig c = new FactoryToolConfig();
                    c.setFactoryId(factoryId);
                    c.setToolName(toolName);
                    return c;
                });
        if (body.containsKey("enabled")) config.setEnabled((Boolean) body.get("enabled"));
        if (body.containsKey("paramOverrides")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> overrides = (Map<String, Object>) body.get("paramOverrides");
            config.setParamOverrides(overrides);
        }
        return ApiResponse.success(toolConfigRepo.save(config));
    }

    // ========== Skill Config ==========

    @GetMapping("/skills")
    @Operation(summary = "获取工厂 Skill 配置列表")
    public ApiResponse<List<FactorySkillConfig>> getSkillConfigs(@PathVariable String factoryId) {
        return ApiResponse.success(skillConfigRepo.findByFactoryId(factoryId));
    }

    @PutMapping("/skills/{skillName}")
    @Operation(summary = "设置 Skill 开关/自定义 DAG")
    public ApiResponse<FactorySkillConfig> setSkillConfig(
            @PathVariable String factoryId, @PathVariable String skillName,
            @RequestBody Map<String, Object> body) {
        FactorySkillConfig config = skillConfigRepo.findByFactoryIdAndSkillName(factoryId, skillName)
                .orElseGet(() -> {
                    FactorySkillConfig c = new FactorySkillConfig();
                    c.setFactoryId(factoryId);
                    c.setSkillName(skillName);
                    return c;
                });
        if (body.containsKey("enabled")) config.setEnabled((Boolean) body.get("enabled"));
        if (body.containsKey("customDag")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> dag = (Map<String, Object>) body.get("customDag");
            config.setCustomDag(dag);
        }
        return ApiResponse.success(skillConfigRepo.save(config));
    }

    // ========== Trigger Chains ==========

    @GetMapping("/trigger-chains")
    @Operation(summary = "获取工厂触发链列表")
    public ApiResponse<List<FactoryTriggerChain>> getTriggerChains(@PathVariable String factoryId) {
        List<FactoryTriggerChain> chains = triggerChainRepo.findByFactoryId(factoryId);
        if (chains.isEmpty()) {
            // Return global defaults if no factory-specific chains
            chains = triggerChainRepo.findByFactoryId(null);
        }
        return ApiResponse.success(chains);
    }

    @PutMapping("/trigger-chains/{chainCode}")
    @Operation(summary = "配置触发链步骤")
    public ApiResponse<FactoryTriggerChain> setTriggerChain(
            @PathVariable String factoryId, @PathVariable String chainCode,
            @RequestBody FactoryTriggerChain body) {
        FactoryTriggerChain chain = triggerChainRepo.findByFactoryIdAndChainCode(factoryId, chainCode)
                .orElseGet(() -> {
                    // Copy from global default
                    FactoryTriggerChain global = triggerChainRepo.findByFactoryIdAndChainCode(null, chainCode)
                            .orElse(null);
                    FactoryTriggerChain c = new FactoryTriggerChain();
                    c.setFactoryId(factoryId);
                    c.setChainCode(chainCode);
                    if (global != null) {
                        c.setEventType(global.getEventType());
                        c.setSteps(global.getSteps());
                        c.setErrorStrategy(global.getErrorStrategy());
                        c.setDescription(global.getDescription());
                    }
                    return c;
                });
        if (body.getEnabled() != null) chain.setEnabled(body.getEnabled());
        if (body.getSteps() != null) chain.setSteps(body.getSteps());
        if (body.getErrorStrategy() != null) chain.setErrorStrategy(body.getErrorStrategy());
        if (body.getEventType() != null) chain.setEventType(body.getEventType());
        if (body.getDescription() != null) chain.setDescription(body.getDescription());
        return ApiResponse.success(triggerChainRepo.save(chain));
    }
}
```

- [ ] **Step 2: Compile + Commit**

```bash
git add src/main/java/com/cretas/aims/controller/TriggerChainController.java
git commit -m "feat(canvas-v2): REST API for tool/skill/trigger chain config"
```

---

## Task 10: Canvas AI Tools — 6 Tools for AI Config Management

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasToggleModuleTool.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasToggleToolTool.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasToggleSkillTool.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasUpdateFieldTool.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasUpdateTriggerChainTool.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/canvas/CanvasApplyTemplateTool.java`

**Context:** These Tools let AI agents (Autopilot/Plan/Action modes) modify canvas config through the standard Tool-Skill architecture. They call the same config APIs/services used by the REST controllers.

- [ ] **Step 1: Create CanvasToggleModuleTool**

```java
package com.cretas.aims.ai.tool.impl.canvas;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.service.config.FactoryConfigService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class CanvasToggleModuleTool extends AbstractBusinessTool {

    @Autowired @Qualifier("canvasFactoryConfigService")
    private FactoryConfigService configService;

    @Override public String getToolName() { return "canvas_toggle_module"; }
    @Override public String getDescription() { return "启用或禁用工厂的某个功能模块 (如排程、质检、财务)"; }

    @Override public Map<String, Object> getParametersSchema() {
        return Map.of("type", "object", "properties", Map.of(
            "moduleCode", Map.of("type", "string", "description", "模块代码，如 scheduling, quality_inspection"),
            "enabled", Map.of("type", "boolean", "description", "true=启用, false=禁用")
        ), "required", List.of("moduleCode", "enabled"));
    }

    @Override protected List<String> getRequiredParameters() { return List.of("moduleCode", "enabled"); }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        String moduleCode = getString(params, "moduleCode");
        boolean enabled = Boolean.TRUE.equals(params.get("enabled"));
        configService.toggleModule(factoryId, moduleCode, enabled);
        return buildSimpleResult(String.format("模块 %s 已%s", moduleCode, enabled ? "启用" : "禁用"), null);
    }
}
```

- [ ] **Step 2: Create CanvasToggleToolTool**

```java
package com.cretas.aims.ai.tool.impl.canvas;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.entity.config.FactoryToolConfig;
import com.cretas.aims.repository.config.FactoryToolConfigRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class CanvasToggleToolTool extends AbstractBusinessTool {

    @Autowired private FactoryToolConfigRepository toolConfigRepo;

    @Override public String getToolName() { return "canvas_toggle_tool"; }
    @Override public String getDescription() { return "启用或禁用工厂的某个 AI 工具"; }

    @Override public Map<String, Object> getParametersSchema() {
        return Map.of("type", "object", "properties", Map.of(
            "toolName", Map.of("type", "string", "description", "工具名称，如 scheduling_list"),
            "enabled", Map.of("type", "boolean", "description", "true=启用, false=禁用")
        ), "required", List.of("toolName", "enabled"));
    }

    @Override protected List<String> getRequiredParameters() { return List.of("toolName", "enabled"); }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        String toolName = getString(params, "toolName");
        boolean enabled = Boolean.TRUE.equals(params.get("enabled"));
        FactoryToolConfig config = toolConfigRepo.findByFactoryIdAndToolName(factoryId, toolName)
            .orElseGet(() -> { FactoryToolConfig c = new FactoryToolConfig(); c.setFactoryId(factoryId); c.setToolName(toolName); return c; });
        config.setEnabled(enabled);
        toolConfigRepo.save(config);
        return buildSimpleResult(String.format("工具 %s 已%s", toolName, enabled ? "启用" : "禁用"), null);
    }
}
```

- [ ] **Step 3: Create remaining 4 Tools (same pattern)**

Create `CanvasToggleSkillTool.java` — same pattern, uses `FactorySkillConfigRepository`, toolName = `canvas_toggle_skill`.

Create `CanvasUpdateFieldTool.java` — parameters: moduleCode, fieldCode, property (label/required/listVisible/formVisible), value. Uses `FactoryConfigService.updateFieldConfig()`.

Create `CanvasUpdateTriggerChainTool.java` — parameters: chainCode, action (enable/disable/addStep/removeStep). Uses `FactoryTriggerChainRepository`.

Create `CanvasApplyTemplateTool.java` — parameters: templateCode. Uses `FactoryConfigService.applyTemplate()`. For AI Autopilot mode.

- [ ] **Step 4: Compile + Commit**

```bash
git add src/main/java/com/cretas/aims/ai/tool/impl/canvas/
git commit -m "feat(canvas-v2): 6 Canvas AI Tools for config management"
```

---

## Verification Criteria (Phase 2a Done)

1. `GET /api/mobile/F001/config/v2/tools` — returns factory tool config list
2. `PUT /api/mobile/F001/config/v2/tools/scheduling_list` with `{"enabled": false}` — disables tool for F001
3. `ToolRegistry.getToolsForFactory("F001")` — excludes disabled tools
4. `GET /api/mobile/F001/config/v2/trigger-chains` — returns 4 default chains
5. `PUT /api/mobile/F001/config/v2/trigger-chains/BATCH_COMPLETED` — disable step 3 (quality inspection)
6. Create + confirm + finance-approve an SO → TriggerChainExecutor runs chain (not SupplyChainOrchestrator)
7. Complete a production batch → chain runs auto-consume + FG creation, skips QI if step disabled
