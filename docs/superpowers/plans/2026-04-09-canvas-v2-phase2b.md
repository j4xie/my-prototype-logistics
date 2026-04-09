# Canvas V2 Phase 2b — Business Logic Externalization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Externalize hardcoded validation rules, default values, formulas, and scheduled tasks into database-driven configuration tables with per-factory overrides.

**Architecture:** 4 new PostgreSQL tables store factory-level business rules. 4 execution engines (ValidationRuleEvaluator, DefaultValueResolver, FormulaEngine, DynamicScheduler) read from DB and replace hardcoded logic. Existing hardcoded logic is preserved as fallback — engines only activate when DB rules exist. SpEL (Spring Expression Language) is reused from existing `MetricFormulaServiceImpl` for condition/expression evaluation.

**Tech Stack:** Java 21, Spring Boot 3.2.12, PostgreSQL (JSONB), JPA/Hibernate 6, Spring SpEL, Spring TaskScheduler

**Spec:** `docs/superpowers/specs/2026-04-09-canvas-v2-unified-config-engine.md` (Section 3.2 + 4.2-4.5)

**Depends on:** Phase 2a (commit `16873ef0a` — TriggerChainExecutor + Tool/Skill factory config)

---

## File Structure

### Backend (Java)

```
backend/java/cretas-api/src/main/java/com/cretas/aims/
├── entity/config/
│   ├── FactoryValidationRule.java          (NEW)
│   ├── FactoryDefaultValue.java            (NEW)
│   ├── FactoryFormula.java                 (NEW)
│   └── FactorySchedulerConfig.java         (NEW)
├── repository/config/
│   ├── FactoryValidationRuleRepository.java    (NEW)
│   ├── FactoryDefaultValueRepository.java      (NEW)
│   ├── FactoryFormulaRepository.java           (NEW)
│   └── FactorySchedulerConfigRepository.java   (NEW)
├── engine/
│   ├── TriggerChainExecutor.java               (EXISTS — Phase 2a)
│   ├── ValidationRuleEvaluator.java            (NEW)
│   ├── DefaultValueResolver.java               (NEW)
│   ├── FormulaEngine.java                      (NEW)
│   ├── DynamicSchedulerService.java            (NEW)
│   └── SpelConditionEvaluator.java             (NEW — shared SpEL utility)
├── controller/
│   └── BusinessRuleController.java             (NEW — REST API for Layer B)
├── service/config/
│   └── impl/FactoryConfigServiceImpl.java      (MODIFY — wire DefaultValueResolver)
└── service/impl/
    └── SalesServiceImpl.java                   (MODIFY — wire ValidationRuleEvaluator)

backend/java/cretas-api/src/main/resources/db/migration/
├── V20260410_03__factory_validation_default_formula_scheduler_tables.sql  (NEW)
└── V20260410_04__seed_core_validation_rules.sql                          (NEW)
```

---

## Task 1: Database Migration — 4 New Tables

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260410_03__factory_validation_default_formula_scheduler_tables.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- V20260410_03__factory_validation_default_formula_scheduler_tables.sql
-- Canvas V2 Phase 2b: Business logic externalization tables

-- 1. factory_validation_rules
CREATE TABLE IF NOT EXISTS factory_validation_rules (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50),
    module_code     VARCHAR(64) NOT NULL,
    rule_code       VARCHAR(64) NOT NULL,
    operation       VARCHAR(32),
    condition       TEXT NOT NULL,
    error_message   TEXT NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    severity        VARCHAR(16) NOT NULL DEFAULT 'BLOCK',
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fvr_factory_module_rule
    ON factory_validation_rules(factory_id, module_code, rule_code);
CREATE INDEX IF NOT EXISTS idx_fvr_factory_module_op
    ON factory_validation_rules(factory_id, module_code, operation);

DROP TRIGGER IF EXISTS trigger_fvr_updated_at ON factory_validation_rules;
CREATE TRIGGER trigger_fvr_updated_at
BEFORE UPDATE ON factory_validation_rules
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. factory_default_values
CREATE TABLE IF NOT EXISTS factory_default_values (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50),
    module_code     VARCHAR(64) NOT NULL,
    field_code      VARCHAR(64) NOT NULL,
    default_value   JSONB NOT NULL,
    condition       TEXT,
    description     TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fdv_factory_module
    ON factory_default_values(factory_id, module_code);
CREATE INDEX IF NOT EXISTS idx_fdv_factory_module_field
    ON factory_default_values(factory_id, module_code, field_code);

DROP TRIGGER IF EXISTS trigger_fdv_updated_at ON factory_default_values;
CREATE TRIGGER trigger_fdv_updated_at
BEFORE UPDATE ON factory_default_values
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. factory_formulas
CREATE TABLE IF NOT EXISTS factory_formulas (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50),
    module_code     VARCHAR(64) NOT NULL,
    formula_code    VARCHAR(64) NOT NULL,
    expression      TEXT NOT NULL,
    variables       JSONB,
    result_type     VARCHAR(20) DEFAULT 'DECIMAL',
    precision_val   INTEGER DEFAULT 2,
    description     TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ff_factory_module_formula
    ON factory_formulas(factory_id, module_code, formula_code);

DROP TRIGGER IF EXISTS trigger_ff_updated_at ON factory_formulas;
CREATE TRIGGER trigger_ff_updated_at
BEFORE UPDATE ON factory_formulas
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. factory_scheduler_configs
CREATE TABLE IF NOT EXISTS factory_scheduler_configs (
    id              BIGSERIAL PRIMARY KEY,
    factory_id      VARCHAR(50),
    task_code       VARCHAR(64) NOT NULL,
    cron_expression VARCHAR(50) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    tool_or_method  VARCHAR(100),
    params          JSONB NOT NULL DEFAULT '{}',
    description     TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fschd_factory_task
    ON factory_scheduler_configs(factory_id, task_code);

DROP TRIGGER IF EXISTS trigger_fschd_updated_at ON factory_scheduler_configs;
CREATE TRIGGER trigger_fschd_updated_at
BEFORE UPDATE ON factory_scheduler_configs
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Grant permissions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cretas_user') THEN
        GRANT ALL ON TABLE factory_validation_rules, factory_default_values,
            factory_formulas, factory_scheduler_configs TO cretas_user;
        GRANT ALL ON SEQUENCE factory_validation_rules_id_seq, factory_default_values_id_seq,
            factory_formulas_id_seq, factory_scheduler_configs_id_seq TO cretas_user;
    END IF;
END $$;
```

- [ ] **Step 2: Commit**

```bash
cd backend/java/cretas-api
git add src/main/resources/db/migration/V20260410_03__factory_validation_default_formula_scheduler_tables.sql
git commit -m "feat(canvas-v2): V20260410_03 validation/default/formula/scheduler tables"
```

---

## Task 2: JPA Entities — 4 Config Entities

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/FactoryValidationRule.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/FactoryDefaultValue.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/FactoryFormula.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/config/FactorySchedulerConfig.java`

- [ ] **Step 1: Create FactoryValidationRule**

```java
package com.cretas.aims.entity.config;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "factory_validation_rules",
    uniqueConstraints = @UniqueConstraint(name = "idx_fvr_factory_module_rule",
        columnNames = {"factory_id", "module_code", "rule_code"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FactoryValidationRule {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "factory_id", length = 50)
    private String factoryId;

    @Column(name = "module_code", length = 64, nullable = false)
    private String moduleCode;

    @Column(name = "rule_code", length = 64, nullable = false)
    private String ruleCode;

    @Column(name = "operation", length = 32)
    private String operation;

    @Column(name = "condition", columnDefinition = "TEXT", nullable = false)
    private String condition;

    @Column(name = "error_message", columnDefinition = "TEXT", nullable = false)
    private String errorMessage;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Column(name = "severity", length = 16, nullable = false)
    @Builder.Default
    private String severity = "BLOCK";

    @Column(name = "sort_order")
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist protected void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

- [ ] **Step 2: Create FactoryDefaultValue**

```java
package com.cretas.aims.entity.config;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.LocalDateTime;

@Entity
@Table(name = "factory_default_values")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FactoryDefaultValue {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "factory_id", length = 50)
    private String factoryId;

    @Column(name = "module_code", length = 64, nullable = false)
    private String moduleCode;

    @Column(name = "field_code", length = 64, nullable = false)
    private String fieldCode;

    @Type(JsonBinaryType.class)
    @Column(name = "default_value", columnDefinition = "jsonb", nullable = false)
    private Object defaultValue;

    @Column(name = "condition", columnDefinition = "TEXT")
    private String condition;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist protected void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

- [ ] **Step 3: Create FactoryFormula**

```java
package com.cretas.aims.entity.config;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "factory_formulas",
    uniqueConstraints = @UniqueConstraint(name = "idx_ff_factory_module_formula",
        columnNames = {"factory_id", "module_code", "formula_code"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FactoryFormula {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "factory_id", length = 50)
    private String factoryId;

    @Column(name = "module_code", length = 64, nullable = false)
    private String moduleCode;

    @Column(name = "formula_code", length = 64, nullable = false)
    private String formulaCode;

    @Column(name = "expression", columnDefinition = "TEXT", nullable = false)
    private String expression;

    @Type(JsonBinaryType.class)
    @Column(name = "variables", columnDefinition = "jsonb")
    private Map<String, String> variables;

    @Column(name = "result_type", length = 20)
    @Builder.Default
    private String resultType = "DECIMAL";

    @Column(name = "precision_val")
    @Builder.Default
    private Integer precisionVal = 2;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist protected void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

- [ ] **Step 4: Create FactorySchedulerConfig**

```java
package com.cretas.aims.entity.config;

import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "factory_scheduler_configs",
    uniqueConstraints = @UniqueConstraint(name = "idx_fschd_factory_task",
        columnNames = {"factory_id", "task_code"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FactorySchedulerConfig {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "factory_id", length = 50)
    private String factoryId;

    @Column(name = "task_code", length = 64, nullable = false)
    private String taskCode;

    @Column(name = "cron_expression", length = 50, nullable = false)
    private String cronExpression;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Column(name = "tool_or_method", length = 100)
    private String toolOrMethod;

    @Type(JsonBinaryType.class)
    @Column(name = "params", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, Object> params = Map.of();

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    @PrePersist protected void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

- [ ] **Step 5: Compile + Commit**

```bash
cd backend/java/cretas-api
JAVA_HOME="C:/Program Files/Zulu/zulu-21" ./mvnw.cmd compile 2>&1 | tail -3
git add src/main/java/com/cretas/aims/entity/config/FactoryValidationRule.java \
        src/main/java/com/cretas/aims/entity/config/FactoryDefaultValue.java \
        src/main/java/com/cretas/aims/entity/config/FactoryFormula.java \
        src/main/java/com/cretas/aims/entity/config/FactorySchedulerConfig.java
git commit -m "feat(canvas-v2): 4 Layer B entities (validation/default/formula/scheduler)"
```

---

## Task 3: Repositories — 4 Repos

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/FactoryValidationRuleRepository.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/FactoryDefaultValueRepository.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/FactoryFormulaRepository.java`
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/repository/config/FactorySchedulerConfigRepository.java`

- [ ] **Step 1: Create all 4 repositories**

`FactoryValidationRuleRepository.java`:
```java
package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactoryValidationRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FactoryValidationRuleRepository extends JpaRepository<FactoryValidationRule, Long> {
    List<FactoryValidationRule> findByFactoryIdAndModuleCodeAndOperationAndEnabledTrueOrderBySortOrder(
            String factoryId, String moduleCode, String operation);

    @Query("SELECT r FROM FactoryValidationRule r WHERE r.factoryId IS NULL " +
           "AND r.moduleCode = :moduleCode AND r.operation = :operation AND r.enabled = true ORDER BY r.sortOrder")
    List<FactoryValidationRule> findGlobalRules(@Param("moduleCode") String moduleCode,
                                                 @Param("operation") String operation);

    List<FactoryValidationRule> findByFactoryIdAndModuleCode(String factoryId, String moduleCode);
}
```

`FactoryDefaultValueRepository.java`:
```java
package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactoryDefaultValue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FactoryDefaultValueRepository extends JpaRepository<FactoryDefaultValue, Long> {
    List<FactoryDefaultValue> findByFactoryIdAndModuleCodeAndFieldCode(
            String factoryId, String moduleCode, String fieldCode);

    @Query("SELECT d FROM FactoryDefaultValue d WHERE d.factoryId IS NULL " +
           "AND d.moduleCode = :moduleCode AND d.fieldCode = :fieldCode")
    List<FactoryDefaultValue> findGlobalDefaults(@Param("moduleCode") String moduleCode,
                                                   @Param("fieldCode") String fieldCode);

    List<FactoryDefaultValue> findByFactoryIdAndModuleCode(String factoryId, String moduleCode);
}
```

`FactoryFormulaRepository.java`:
```java
package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactoryFormula;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FactoryFormulaRepository extends JpaRepository<FactoryFormula, Long> {
    Optional<FactoryFormula> findByFactoryIdAndModuleCodeAndFormulaCode(
            String factoryId, String moduleCode, String formulaCode);

    @Query("SELECT f FROM FactoryFormula f WHERE f.factoryId IS NULL " +
           "AND f.moduleCode = :moduleCode AND f.formulaCode = :formulaCode")
    Optional<FactoryFormula> findGlobalFormula(@Param("moduleCode") String moduleCode,
                                                @Param("formulaCode") String formulaCode);

    List<FactoryFormula> findByFactoryIdAndModuleCode(String factoryId, String moduleCode);
}
```

`FactorySchedulerConfigRepository.java`:
```java
package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactorySchedulerConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FactorySchedulerConfigRepository extends JpaRepository<FactorySchedulerConfig, Long> {
    List<FactorySchedulerConfig> findByEnabledTrue();
    Optional<FactorySchedulerConfig> findByFactoryIdAndTaskCode(String factoryId, String taskCode);
    List<FactorySchedulerConfig> findByFactoryId(String factoryId);
}
```

- [ ] **Step 2: Compile + Commit**

```bash
git add src/main/java/com/cretas/aims/repository/config/FactoryValidationRuleRepository.java \
        src/main/java/com/cretas/aims/repository/config/FactoryDefaultValueRepository.java \
        src/main/java/com/cretas/aims/repository/config/FactoryFormulaRepository.java \
        src/main/java/com/cretas/aims/repository/config/FactorySchedulerConfigRepository.java
git commit -m "feat(canvas-v2): 4 Layer B repositories"
```

---

## Task 4: SpEL Condition Evaluator — Shared Utility

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/SpelConditionEvaluator.java`

**Context:** The codebase already has 3 independent SpEL usages (MetricFormulaServiceImpl, SopAgentOrchestratorImpl, StateMachineServiceImpl). This task creates a shared utility for all engine condition evaluation.

- [ ] **Step 1: Create SpelConditionEvaluator**

```java
package com.cretas.aims.engine;

import lombok.extern.slf4j.Slf4j;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Canvas V2: Shared SpEL expression evaluator for validation rules,
 * formula engine, and condition evaluation.
 *
 * Expressions use Spring SpEL syntax:
 * - Variables: #status, #quantity, #unitPrice
 * - Comparisons: #status != 'DRAFT'
 * - Arithmetic: #quantity * #unitPrice * (1 - #discountRate)
 * - Null-safe: #field?.property
 */
@Slf4j
@Component
public class SpelConditionEvaluator {

    private final ExpressionParser parser = new SpelExpressionParser();
    private final Map<String, Expression> cache = new ConcurrentHashMap<>();

    /**
     * Evaluate a boolean condition expression.
     * Returns false on any parse/eval error (fail-open for validation skip).
     */
    public boolean evaluateCondition(String expression, Map<String, Object> context) {
        try {
            Expression expr = cache.computeIfAbsent(expression, parser::parseExpression);
            EvaluationContext ctx = buildContext(context);
            Boolean result = expr.getValue(ctx, Boolean.class);
            return Boolean.TRUE.equals(result);
        } catch (Exception e) {
            log.warn("SpEL condition evaluation failed: '{}' — {}", expression, e.getMessage());
            return false;
        }
    }

    /**
     * Evaluate a numeric formula expression.
     * Returns null on parse/eval error.
     */
    public BigDecimal evaluateFormula(String expression, Map<String, Object> variables, int precision) {
        try {
            Expression expr = cache.computeIfAbsent(expression, parser::parseExpression);
            EvaluationContext ctx = buildContext(variables);
            Object result = expr.getValue(ctx);
            if (result instanceof BigDecimal bd) return bd.setScale(precision, RoundingMode.HALF_UP);
            if (result instanceof Number num) return BigDecimal.valueOf(num.doubleValue()).setScale(precision, RoundingMode.HALF_UP);
            return null;
        } catch (Exception e) {
            log.warn("SpEL formula evaluation failed: '{}' — {}", expression, e.getMessage());
            return null;
        }
    }

    /**
     * Evaluate any expression returning Object.
     */
    public Object evaluate(String expression, Map<String, Object> context) {
        try {
            Expression expr = cache.computeIfAbsent(expression, parser::parseExpression);
            EvaluationContext ctx = buildContext(context);
            return expr.getValue(ctx);
        } catch (Exception e) {
            log.warn("SpEL evaluation failed: '{}' — {}", expression, e.getMessage());
            return null;
        }
    }

    private EvaluationContext buildContext(Map<String, Object> variables) {
        StandardEvaluationContext ctx = new StandardEvaluationContext();
        if (variables != null) {
            variables.forEach(ctx::setVariable);
        }
        return ctx;
    }
}
```

- [ ] **Step 2: Compile + Commit**

```bash
git add src/main/java/com/cretas/aims/engine/SpelConditionEvaluator.java
git commit -m "feat(canvas-v2): SpelConditionEvaluator shared utility for engines"
```

---

## Task 5: ValidationRuleEvaluator Engine

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/ValidationRuleEvaluator.java`

**Context:** Replaces hardcoded `if (...) throw new BusinessException(...)` patterns found in SalesServiceImpl (~15 validations), ArApServiceImpl (~8), FactoryMaterialRequisitionServiceImpl (~4), etc. The evaluator reads rules from `factory_validation_rules` table and evaluates SpEL conditions. `BusinessException` class is at `com.cretas.aims.exception.BusinessException` with constructor `BusinessException(String message)`.

- [ ] **Step 1: Create ValidationRuleEvaluator**

```java
package com.cretas.aims.engine;

import com.cretas.aims.entity.config.FactoryValidationRule;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.config.FactoryValidationRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Canvas V2: Database-driven validation rule evaluator.
 * Reads rules from factory_validation_rules and evaluates SpEL conditions.
 *
 * Usage in Service:
 *   validationRuleEvaluator.validate("F001", "sales_order", "UPDATE",
 *       Map.of("status", order.getStatus(), "totalAmount", order.getTotalAmount()));
 *
 * SpEL condition examples:
 *   "#status != 'DRAFT'" → blocks edit on non-draft orders
 *   "#totalAmount > 0" → requires positive amount
 *   "#items?.size() > 0" → requires at least one line item
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ValidationRuleEvaluator {

    private final FactoryValidationRuleRepository ruleRepo;
    private final SpelConditionEvaluator spelEvaluator;

    /**
     * Validate context against factory rules. Throws BusinessException for BLOCK severity.
     * Returns list of WARN/INFO messages.
     */
    public List<String> validate(String factoryId, String moduleCode, String operation,
                                  Map<String, Object> context) {
        List<FactoryValidationRule> rules = ruleRepo
                .findByFactoryIdAndModuleCodeAndOperationAndEnabledTrueOrderBySortOrder(
                        factoryId, moduleCode, operation);

        if (rules.isEmpty()) {
            rules = ruleRepo.findGlobalRules(moduleCode, operation);
        }

        List<String> warnings = new ArrayList<>();

        for (FactoryValidationRule rule : rules) {
            boolean conditionMet = spelEvaluator.evaluateCondition(rule.getCondition(), context);
            if (conditionMet) {
                switch (rule.getSeverity()) {
                    case "BLOCK" -> throw new BusinessException(rule.getErrorMessage());
                    case "WARN" -> {
                        log.warn("Validation warning [{}]: {}", rule.getRuleCode(), rule.getErrorMessage());
                        warnings.add(rule.getErrorMessage());
                    }
                    case "INFO" -> log.info("Validation info [{}]: {}", rule.getRuleCode(), rule.getErrorMessage());
                }
            }
        }

        return warnings;
    }

    /**
     * Check if a specific rule is enabled for a factory.
     */
    public boolean isRuleEnabled(String factoryId, String moduleCode, String ruleCode) {
        List<FactoryValidationRule> rules = ruleRepo.findByFactoryIdAndModuleCode(factoryId, moduleCode);
        return rules.stream()
                .filter(r -> r.getRuleCode().equals(ruleCode))
                .findFirst()
                .map(FactoryValidationRule::getEnabled)
                .orElse(true);
    }
}
```

- [ ] **Step 2: Compile + Commit**

```bash
git add src/main/java/com/cretas/aims/engine/ValidationRuleEvaluator.java
git commit -m "feat(canvas-v2): ValidationRuleEvaluator — DB-driven validation engine"
```

---

## Task 6: DefaultValueResolver Engine

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DefaultValueResolver.java`

**Context:** Extends Phase 1's `FactoryConfigService.getFieldDefault()` method already used in BomServiceImpl:82 for yieldRate. This resolver adds condition-based defaults from `factory_default_values` table, falling back to the existing Phase 1 schema defaults.

- [ ] **Step 1: Create DefaultValueResolver**

```java
package com.cretas.aims.engine;

import com.cretas.aims.entity.config.FactoryDefaultValue;
import com.cretas.aims.repository.config.FactoryDefaultValueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Canvas V2: Database-driven default value resolver.
 * Priority: factory_default_values (with condition) > factory_default_values (no condition) > module_schema field default (Phase 1).
 *
 * Usage in Service:
 *   Object yieldRate = defaultValueResolver.resolve("F001", "bom", "yieldRate",
 *       Map.of("materialCategory", "RAW"));
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DefaultValueResolver {

    private final FactoryDefaultValueRepository defaultValueRepo;
    private final SpelConditionEvaluator spelEvaluator;

    /**
     * Resolve default value for a field. Returns null if no default configured.
     */
    public Object resolve(String factoryId, String moduleCode, String fieldCode,
                          Map<String, Object> context) {
        // 1. Factory-specific defaults
        List<FactoryDefaultValue> factoryDefaults = defaultValueRepo
                .findByFactoryIdAndModuleCodeAndFieldCode(factoryId, moduleCode, fieldCode);

        Object result = matchDefault(factoryDefaults, context);
        if (result != null) return result;

        // 2. Global defaults (factoryId = null)
        List<FactoryDefaultValue> globalDefaults = defaultValueRepo
                .findGlobalDefaults(moduleCode, fieldCode);

        return matchDefault(globalDefaults, context);
    }

    /**
     * Resolve all defaults for a module, returning field→value map.
     */
    public Map<String, Object> resolveAll(String factoryId, String moduleCode,
                                           Map<String, Object> context) {
        List<FactoryDefaultValue> allDefaults = defaultValueRepo
                .findByFactoryIdAndModuleCode(factoryId, moduleCode);

        Map<String, Object> result = new java.util.LinkedHashMap<>();
        for (FactoryDefaultValue dv : allDefaults) {
            if (dv.getCondition() == null ||
                spelEvaluator.evaluateCondition(dv.getCondition(), context)) {
                result.putIfAbsent(dv.getFieldCode(), dv.getDefaultValue());
            }
        }
        return result;
    }

    private Object matchDefault(List<FactoryDefaultValue> defaults, Map<String, Object> context) {
        // Conditional defaults first, then unconditional
        for (FactoryDefaultValue dv : defaults) {
            if (dv.getCondition() != null && !dv.getCondition().isBlank()) {
                if (spelEvaluator.evaluateCondition(dv.getCondition(), context)) {
                    return dv.getDefaultValue();
                }
            }
        }
        // Fallback to unconditional default
        for (FactoryDefaultValue dv : defaults) {
            if (dv.getCondition() == null || dv.getCondition().isBlank()) {
                return dv.getDefaultValue();
            }
        }
        return null;
    }
}
```

- [ ] **Step 2: Compile + Commit**

```bash
git add src/main/java/com/cretas/aims/engine/DefaultValueResolver.java
git commit -m "feat(canvas-v2): DefaultValueResolver — condition-based default values"
```

---

## Task 7: FormulaEngine

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/FormulaEngine.java`

**Context:** Replaces hardcoded calculations like `standardQuantity.divide(yieldRate/100, 6, HALF_UP)` in BomServiceImpl:383 and `item.getLineAmount()` accumulation in SalesServiceImpl:114. Uses SpEL for expression evaluation (already used in MetricFormulaServiceImpl:55).

- [ ] **Step 1: Create FormulaEngine**

```java
package com.cretas.aims.engine;

import com.cretas.aims.entity.config.FactoryFormula;
import com.cretas.aims.repository.config.FactoryFormulaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

/**
 * Canvas V2: Database-driven formula engine.
 * Evaluates SpEL math expressions with factory-level overrides.
 *
 * Usage:
 *   BigDecimal amount = formulaEngine.evaluate("F001", "sales_order", "LINE_AMOUNT",
 *       Map.of("quantity", 10, "unitPrice", 25.5, "discountRate", 0.1));
 *   // evaluates: #quantity * #unitPrice * (1 - #discountRate)
 *
 * Existing formulas to externalize:
 *   - BOM: ACTUAL_QUANTITY = "#standardQuantity / (#yieldRate / 100)"
 *   - BOM: MATERIAL_COST = "#actualQuantity * #unitPrice"
 *   - BOM: LABOR_COST = "#unitPrice * #quantity"
 *   - BOM: OVERHEAD_COST = "#unitPrice * #allocationRate"
 *   - Sales: LINE_AMOUNT = "#quantity * #unitPrice"
 *   - Sales: TOTAL_AMOUNT = sum of line amounts (handled in service)
 *   - R&D Sample: TOTAL_COST = "#materialCost + #laborCost + #overheadCost"
 *   - R&D Sample: PROFIT_MARGIN = "(#suggestedPrice - #totalCost) / #suggestedPrice * 100"
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FormulaEngine {

    private final FactoryFormulaRepository formulaRepo;
    private final SpelConditionEvaluator spelEvaluator;

    /**
     * Evaluate a named formula for a factory. Falls back to global formula.
     * Returns null if no formula found or evaluation fails.
     */
    public BigDecimal evaluate(String factoryId, String moduleCode, String formulaCode,
                                Map<String, Object> variables) {
        Optional<FactoryFormula> formula = formulaRepo
                .findByFactoryIdAndModuleCodeAndFormulaCode(factoryId, moduleCode, formulaCode);

        if (formula.isEmpty()) {
            formula = formulaRepo.findGlobalFormula(moduleCode, formulaCode);
        }

        if (formula.isEmpty()) return null;

        FactoryFormula f = formula.get();
        return spelEvaluator.evaluateFormula(f.getExpression(), variables, f.getPrecisionVal());
    }

    /**
     * Evaluate a raw expression string (for ad-hoc calculations).
     */
    public BigDecimal evaluateExpression(String expression, Map<String, Object> variables, int precision) {
        return spelEvaluator.evaluateFormula(expression, variables, precision);
    }
}
```

- [ ] **Step 2: Compile + Commit**

```bash
git add src/main/java/com/cretas/aims/engine/FormulaEngine.java
git commit -m "feat(canvas-v2): FormulaEngine — DB-driven formula evaluation"
```

---

## Task 8: DynamicSchedulerService

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/engine/DynamicSchedulerService.java`

**Context:** The project has 40+ @Scheduled tasks across ~15 scheduler classes. This service reads `factory_scheduler_configs` and manages ScheduledFuture instances. It does NOT replace existing @Scheduled methods — it runs alongside them for factory-specific schedule overrides. Existing tasks keep running via annotations; this adds configurable per-factory schedules.

- [ ] **Step 1: Create DynamicSchedulerService**

```java
package com.cretas.aims.engine;

import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.ai.tool.ToolRegistry;
import com.cretas.aims.ai.dto.ToolCall;
import com.cretas.aims.entity.config.FactorySchedulerConfig;
import com.cretas.aims.repository.config.FactorySchedulerConfigRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

/**
 * Canvas V2: Database-driven dynamic scheduler.
 * Loads factory_scheduler_configs at startup, schedules Tool execution via cron.
 * Supports hot-reload: update cron in DB → call reloadSchedule() → no restart needed.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DynamicSchedulerService {

    private final FactorySchedulerConfigRepository schedulerRepo;
    private final TaskScheduler taskScheduler;
    private final ToolRegistry toolRegistry;
    private final ObjectMapper objectMapper;

    private final Map<String, ScheduledFuture<?>> activeTasks = new ConcurrentHashMap<>();

    @PostConstruct
    public void loadSchedules() {
        List<FactorySchedulerConfig> configs = schedulerRepo.findByEnabledTrue();
        log.info("Loading {} dynamic scheduled tasks", configs.size());
        for (FactorySchedulerConfig config : configs) {
            scheduleTask(config);
        }
    }

    @PreDestroy
    public void shutdown() {
        activeTasks.values().forEach(f -> f.cancel(false));
        activeTasks.clear();
    }

    public void scheduleTask(FactorySchedulerConfig config) {
        String key = config.getFactoryId() + ":" + config.getTaskCode();

        // Cancel existing
        ScheduledFuture<?> existing = activeTasks.get(key);
        if (existing != null) {
            existing.cancel(false);
            activeTasks.remove(key);
        }

        try {
            ScheduledFuture<?> future = taskScheduler.schedule(
                    () -> executeTask(config),
                    new CronTrigger(config.getCronExpression())
            );
            activeTasks.put(key, future);
            log.info("Scheduled task: {} [{}] cron={}", key, config.getToolOrMethod(), config.getCronExpression());
        } catch (IllegalArgumentException e) {
            log.error("Invalid cron expression for {}: {} — {}", key, config.getCronExpression(), e.getMessage());
        }
    }

    /**
     * Hot-reload a specific schedule. Called from Canvas UI after cron update.
     */
    public void reloadSchedule(String factoryId, String taskCode) {
        Optional<FactorySchedulerConfig> config = schedulerRepo.findByFactoryIdAndTaskCode(factoryId, taskCode);
        if (config.isPresent() && config.get().getEnabled()) {
            scheduleTask(config.get());
        } else {
            cancelTask(factoryId, taskCode);
        }
    }

    /**
     * Reload ALL schedules (e.g., after bulk import).
     */
    public void reloadAll() {
        activeTasks.values().forEach(f -> f.cancel(false));
        activeTasks.clear();
        loadSchedules();
    }

    public void cancelTask(String factoryId, String taskCode) {
        String key = factoryId + ":" + taskCode;
        ScheduledFuture<?> future = activeTasks.remove(key);
        if (future != null) {
            future.cancel(false);
            log.info("Cancelled scheduled task: {}", key);
        }
    }

    public int getActiveTaskCount() {
        return activeTasks.size();
    }

    private void executeTask(FactorySchedulerConfig config) {
        String toolOrMethod = config.getToolOrMethod();
        if (toolOrMethod == null || toolOrMethod.isBlank()) return;

        log.debug("Executing scheduled task: {}:{} → {}", config.getFactoryId(), config.getTaskCode(), toolOrMethod);

        Optional<ToolExecutor> executor = toolRegistry.getExecutor(toolOrMethod);
        if (executor.isEmpty()) {
            log.warn("Scheduled tool not found: {}", toolOrMethod);
            return;
        }

        try {
            String argsJson = objectMapper.writeValueAsString(config.getParams());
            ToolCall toolCall = ToolCall.of(
                    "sched-" + config.getTaskCode(), toolOrMethod, argsJson);

            Map<String, Object> context = Map.of("factoryId", config.getFactoryId());
            executor.get().execute(toolCall, context);
        } catch (Exception e) {
            log.error("Scheduled task {} failed: {}", config.getTaskCode(), e.getMessage(), e);
        }
    }
}
```

- [ ] **Step 2: Compile + Commit**

```bash
git add src/main/java/com/cretas/aims/engine/DynamicSchedulerService.java
git commit -m "feat(canvas-v2): DynamicSchedulerService — hot-reload cron from DB"
```

---

## Task 9: REST API — Business Rule Config

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/BusinessRuleController.java`

- [ ] **Step 1: Create controller**

```java
package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.engine.DynamicSchedulerService;
import com.cretas.aims.entity.config.*;
import com.cretas.aims.repository.config.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/mobile/{factoryId}/config/v2")
@RequiredArgsConstructor
@Tag(name = "Canvas V2 Business Rules", description = "校验规则/默认值/公式/定时任务 工厂级配置")
public class BusinessRuleController {

    private final FactoryValidationRuleRepository validationRuleRepo;
    private final FactoryDefaultValueRepository defaultValueRepo;
    private final FactoryFormulaRepository formulaRepo;
    private final FactorySchedulerConfigRepository schedulerRepo;
    private final DynamicSchedulerService dynamicSchedulerService;

    // ========== Validation Rules ==========

    @GetMapping("/validation-rules")
    @Operation(summary = "获取工厂校验规则列表")
    public ApiResponse<List<FactoryValidationRule>> getValidationRules(
            @PathVariable String factoryId,
            @RequestParam(required = false) String moduleCode) {
        if (moduleCode != null) {
            return ApiResponse.success(validationRuleRepo.findByFactoryIdAndModuleCode(factoryId, moduleCode));
        }
        return ApiResponse.success(validationRuleRepo.findAll()); // TODO: filter by factoryId
    }

    @PutMapping("/validation-rules/{ruleCode}")
    @Operation(summary = "配置校验规则")
    public ApiResponse<FactoryValidationRule> setValidationRule(
            @PathVariable String factoryId, @PathVariable String ruleCode,
            @RequestBody FactoryValidationRule body) {
        FactoryValidationRule rule = validationRuleRepo.findByFactoryIdAndModuleCode(factoryId, body.getModuleCode())
                .stream().filter(r -> r.getRuleCode().equals(ruleCode)).findFirst()
                .orElseGet(() -> {
                    FactoryValidationRule r = new FactoryValidationRule();
                    r.setFactoryId(factoryId);
                    r.setRuleCode(ruleCode);
                    r.setModuleCode(body.getModuleCode());
                    r.setCondition(body.getCondition());
                    r.setErrorMessage(body.getErrorMessage());
                    return r;
                });
        if (body.getEnabled() != null) rule.setEnabled(body.getEnabled());
        if (body.getSeverity() != null) rule.setSeverity(body.getSeverity());
        if (body.getErrorMessage() != null) rule.setErrorMessage(body.getErrorMessage());
        if (body.getCondition() != null) rule.setCondition(body.getCondition());
        if (body.getOperation() != null) rule.setOperation(body.getOperation());
        return ApiResponse.success(validationRuleRepo.save(rule));
    }

    // ========== Default Values ==========

    @GetMapping("/default-values")
    @Operation(summary = "获取工厂默认值列表")
    public ApiResponse<List<FactoryDefaultValue>> getDefaultValues(
            @PathVariable String factoryId,
            @RequestParam(required = false) String moduleCode) {
        if (moduleCode != null) {
            return ApiResponse.success(defaultValueRepo.findByFactoryIdAndModuleCode(factoryId, moduleCode));
        }
        return ApiResponse.success(defaultValueRepo.findByFactoryIdAndModuleCode(factoryId, null));
    }

    @PutMapping("/default-values")
    @Operation(summary = "设置默认值")
    public ApiResponse<FactoryDefaultValue> setDefaultValue(
            @PathVariable String factoryId,
            @RequestBody FactoryDefaultValue body) {
        body.setFactoryId(factoryId);
        return ApiResponse.success(defaultValueRepo.save(body));
    }

    // ========== Formulas ==========

    @GetMapping("/formulas")
    @Operation(summary = "获取工厂公式列表")
    public ApiResponse<List<FactoryFormula>> getFormulas(
            @PathVariable String factoryId,
            @RequestParam(required = false) String moduleCode) {
        if (moduleCode != null) {
            return ApiResponse.success(formulaRepo.findByFactoryIdAndModuleCode(factoryId, moduleCode));
        }
        return ApiResponse.success(formulaRepo.findByFactoryIdAndModuleCode(factoryId, null));
    }

    @PutMapping("/formulas/{formulaCode}")
    @Operation(summary = "配置公式")
    public ApiResponse<FactoryFormula> setFormula(
            @PathVariable String factoryId, @PathVariable String formulaCode,
            @RequestBody FactoryFormula body) {
        FactoryFormula formula = formulaRepo
                .findByFactoryIdAndModuleCodeAndFormulaCode(factoryId, body.getModuleCode(), formulaCode)
                .orElseGet(() -> {
                    FactoryFormula f = new FactoryFormula();
                    f.setFactoryId(factoryId);
                    f.setFormulaCode(formulaCode);
                    f.setModuleCode(body.getModuleCode());
                    return f;
                });
        if (body.getExpression() != null) formula.setExpression(body.getExpression());
        if (body.getVariables() != null) formula.setVariables(body.getVariables());
        if (body.getResultType() != null) formula.setResultType(body.getResultType());
        if (body.getPrecisionVal() != null) formula.setPrecisionVal(body.getPrecisionVal());
        return ApiResponse.success(formulaRepo.save(formula));
    }

    // ========== Scheduler ==========

    @GetMapping("/scheduler")
    @Operation(summary = "获取工厂定时任务列表")
    public ApiResponse<List<FactorySchedulerConfig>> getSchedulerConfigs(@PathVariable String factoryId) {
        return ApiResponse.success(schedulerRepo.findByFactoryId(factoryId));
    }

    @PutMapping("/scheduler/{taskCode}")
    @Operation(summary = "配置定时任务 (热更新)")
    public ApiResponse<FactorySchedulerConfig> setSchedulerConfig(
            @PathVariable String factoryId, @PathVariable String taskCode,
            @RequestBody FactorySchedulerConfig body) {
        FactorySchedulerConfig config = schedulerRepo.findByFactoryIdAndTaskCode(factoryId, taskCode)
                .orElseGet(() -> {
                    FactorySchedulerConfig c = new FactorySchedulerConfig();
                    c.setFactoryId(factoryId);
                    c.setTaskCode(taskCode);
                    return c;
                });
        if (body.getCronExpression() != null) config.setCronExpression(body.getCronExpression());
        if (body.getEnabled() != null) config.setEnabled(body.getEnabled());
        if (body.getToolOrMethod() != null) config.setToolOrMethod(body.getToolOrMethod());
        if (body.getParams() != null) config.setParams(body.getParams());
        FactorySchedulerConfig saved = schedulerRepo.save(config);

        // Hot-reload the schedule
        dynamicSchedulerService.reloadSchedule(factoryId, taskCode);

        return ApiResponse.success(saved);
    }
}
```

- [ ] **Step 2: Compile + Commit**

```bash
git add src/main/java/com/cretas/aims/controller/BusinessRuleController.java
git commit -m "feat(canvas-v2): REST API for validation/default/formula/scheduler config"
```

---

## Task 10: Seed Core Validation Rules

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260410_04__seed_core_validation_rules.sql`

**Context:** Extract the most critical validation rules from SalesServiceImpl and ArApServiceImpl into global defaults. These are the rules that Canvas users should be able to toggle.

- [ ] **Step 1: Write seed migration**

```sql
-- V20260410_04__seed_core_validation_rules.sql
-- Seed global default validation rules from hardcoded service logic

-- Sales Order validation rules (from SalesServiceImpl)
INSERT INTO factory_validation_rules (factory_id, module_code, rule_code, operation, condition, error_message, severity, sort_order)
VALUES
(NULL, 'sales_order', 'DRAFT_ONLY_EDIT', 'UPDATE', '#status != ''DRAFT''', '只有草稿状态的订单可以编辑', 'BLOCK', 10),
(NULL, 'sales_order', 'DRAFT_ONLY_DELETE', 'DELETE', '#status != ''DRAFT''', '只有草稿状态的订单可以删除', 'BLOCK', 20),
(NULL, 'sales_order', 'DUPLICATE_PRODUCT', 'CREATE', '#hasDuplicateProduct == true', '同一订单中不能添加重复的产品', 'BLOCK', 30),
(NULL, 'sales_order', 'ITEMS_REQUIRED', 'CREATE', '#itemCount == 0', '订单必须包含至少一个行项目', 'BLOCK', 40),
(NULL, 'sales_order', 'POSITIVE_AMOUNT', 'CREATE', '#totalAmount <= 0', '订单总金额必须大于0', 'BLOCK', 50),
(NULL, 'sales_order', 'CONFIRM_DRAFT_ONLY', 'STATUS_CHANGE', '#status != ''DRAFT'' AND #targetStatus == ''CONFIRMED''', '只有草稿状态可以确认', 'BLOCK', 60),
(NULL, 'sales_order', 'FINANCE_CONFIRM_ONLY', 'STATUS_CHANGE', '#status != ''CONFIRMED'' AND #targetStatus == ''PENDING_FINANCE_REVIEW''', '只有已确认的订单可以提交财务审核', 'BLOCK', 70),
(NULL, 'sales_order', 'STOCK_SUFFICIENT', 'STATUS_CHANGE', '#stockInsufficient == true AND #targetStatus == ''DELIVERING''', '成品库存不足，无法发货', 'WARN', 80)
ON CONFLICT (factory_id, module_code, rule_code) DO NOTHING;

-- AR/AP validation rules (from ArApServiceImpl)
INSERT INTO factory_validation_rules (factory_id, module_code, rule_code, operation, condition, error_message, severity, sort_order)
VALUES
(NULL, 'finance_ar', 'POSITIVE_AMOUNT', 'CREATE', '#amount <= 0', '应收金额必须大于0', 'BLOCK', 10),
(NULL, 'finance_ar', 'DUPLICATE_SO_AR', 'CREATE', '#existingArForSO == true', '该销售订单已生成应收记录', 'BLOCK', 20),
(NULL, 'finance_payment', 'POSITIVE_PAYMENT', 'CREATE', '#amount <= 0', '付款金额必须大于0', 'BLOCK', 10),
(NULL, 'finance_payment', 'EXCEED_BALANCE', 'CREATE', '#amount > #remainingBalance', '付款金额不能超过剩余应付余额', 'BLOCK', 20)
ON CONFLICT (factory_id, module_code, rule_code) DO NOTHING;

-- BOM validation rules
INSERT INTO factory_validation_rules (factory_id, module_code, rule_code, operation, condition, error_message, severity, sort_order)
VALUES
(NULL, 'bom', 'PRODUCT_REQUIRED', 'CREATE', '#productTypeId == null', '必须选择产品', 'BLOCK', 10),
(NULL, 'bom', 'ITEMS_REQUIRED', 'CREATE', '#itemCount == 0', 'BOM必须包含至少一个物料', 'BLOCK', 20)
ON CONFLICT (factory_id, module_code, rule_code) DO NOTHING;

-- Seed core formulas
INSERT INTO factory_formulas (factory_id, module_code, formula_code, expression, variables, result_type, precision_val, description)
VALUES
(NULL, 'sales_order', 'LINE_AMOUNT', '#quantity * #unitPrice', '{"quantity":"DECIMAL","unitPrice":"DECIMAL"}', 'DECIMAL', 2, '行项目金额 = 数量 × 单价'),
(NULL, 'bom', 'ACTUAL_QUANTITY', '#standardQuantity / (#yieldRate / 100)', '{"standardQuantity":"DECIMAL","yieldRate":"DECIMAL"}', 'DECIMAL', 6, '实际用量 = 标准用量 / (良率/100)'),
(NULL, 'bom', 'MATERIAL_COST', '#actualQuantity * #unitPrice', '{"actualQuantity":"DECIMAL","unitPrice":"DECIMAL"}', 'DECIMAL', 4, '物料成本 = 实际用量 × 单价'),
(NULL, 'bom', 'LABOR_COST', '#unitPrice * #quantity', '{"unitPrice":"DECIMAL","quantity":"DECIMAL"}', 'DECIMAL', 4, '人工成本 = 单价 × 数量'),
(NULL, 'bom', 'OVERHEAD_COST', '#unitPrice * #allocationRate', '{"unitPrice":"DECIMAL","allocationRate":"DECIMAL"}', 'DECIMAL', 4, '制造费用 = 单价 × 分摊比例'),
(NULL, 'rd_sample', 'TOTAL_COST', '#materialCost + #laborCost + #overheadCost', '{"materialCost":"DECIMAL","laborCost":"DECIMAL","overheadCost":"DECIMAL"}', 'DECIMAL', 2, '总成本 = 物料+人工+制造费用'),
(NULL, 'rd_sample', 'PROFIT_MARGIN', '(#suggestedPrice - #totalCost) / #suggestedPrice * 100', '{"suggestedPrice":"DECIMAL","totalCost":"DECIMAL"}', 'DECIMAL', 2, '利润率 = (建议售价-总成本)/建议售价×100'),
(NULL, 'transfer', 'LINE_AMOUNT', '#quantity * #unitPrice', '{"quantity":"DECIMAL","unitPrice":"DECIMAL"}', 'DECIMAL', 2, '调拨行金额 = 数量 × 单价')
ON CONFLICT (factory_id, module_code, formula_code) DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
git add src/main/resources/db/migration/V20260410_04__seed_core_validation_rules.sql
git commit -m "feat(canvas-v2): seed 14 validation rules + 8 formulas as global defaults"
```

---

## Task 11: Wire ValidationRuleEvaluator into SalesServiceImpl

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/inventory/impl/SalesServiceImpl.java`

**Context:** SalesServiceImpl already has `@Autowired(required=false) FactoryConfigService` from Phase 1 (for workflow transitions). Now add `ValidationRuleEvaluator` alongside it, calling it before existing hardcoded validation as an optional enhancement.

- [ ] **Step 1: Add ValidationRuleEvaluator injection**

Add after existing FactoryConfigService injection:
```java
@Autowired(required = false)
private ValidationRuleEvaluator validationRuleEvaluator;
```

Add import:
```java
import com.cretas.aims.engine.ValidationRuleEvaluator;
```

- [ ] **Step 2: Add helper method to evaluate rules**

```java
/**
 * Canvas V2: Run DB-driven validation rules before hardcoded checks.
 * If no DB rules exist, this is a no-op.
 */
private void runConfiguredValidation(String factoryId, String operation, Map<String, Object> context) {
    if (validationRuleEvaluator == null) return;
    try {
        validationRuleEvaluator.validate(factoryId, "sales_order", operation, context);
    } catch (Exception e) {
        // Re-throw BusinessException, swallow others (don't break existing flow)
        if (e instanceof com.cretas.aims.exception.BusinessException) throw e;
        log.warn("Canvas validation failed (non-blocking): {}", e.getMessage());
    }
}
```

- [ ] **Step 3: Call runConfiguredValidation in createSalesOrder**

At the top of the create method, before existing validation:
```java
runConfiguredValidation(factoryId, "CREATE", Map.of(
    "totalAmount", dto.getTotalAmount() != null ? dto.getTotalAmount() : BigDecimal.ZERO,
    "itemCount", dto.getItems() != null ? dto.getItems().size() : 0,
    "hasDuplicateProduct", false // will be checked by existing logic below
));
```

- [ ] **Step 4: Compile + Commit**

```bash
git add src/main/java/com/cretas/aims/service/inventory/impl/SalesServiceImpl.java
git commit -m "feat(canvas-v2): wire ValidationRuleEvaluator into SalesServiceImpl"
```

---

## Task 12: Bulk Migration — Validation Rules (~80 core rules)

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260410_05__seed_bulk_validation_rules.sql`

**Context:** The codebase has ~100 `throw new BusinessException(...)` across service/impl. Task 10 seeded 14 rules for sales_order + finance. This task migrates the remaining core modules. Focus on rules users would want to toggle per-factory (status gates, uniqueness checks, amount guards). Skip factoryId access guards (those are security, not business rules).

- [ ] **Step 1: Write bulk rules migration**

```sql
-- V20260410_05__seed_bulk_validation_rules.sql
-- Bulk migration of remaining validation rules from service code

-- Purchase Order rules (from PurchaseServiceImpl)
INSERT INTO factory_validation_rules (factory_id, module_code, rule_code, operation, condition, error_message, severity, sort_order) VALUES
(NULL, 'purchase_order', 'DRAFT_ONLY_SUBMIT', 'STATUS_CHANGE', '#status != ''DRAFT'' AND #targetStatus == ''SUBMITTED''', '只有草稿状态的订单可以提交', 'BLOCK', 10),
(NULL, 'purchase_order', 'SUBMITTED_ONLY_APPROVE', 'STATUS_CHANGE', '#status != ''SUBMITTED'' AND #targetStatus == ''APPROVED''', '只有已提交状态的订单可以审批', 'BLOCK', 20),
(NULL, 'purchase_order', 'APPROVED_ONLY_FINANCE', 'STATUS_CHANGE', '#status != ''APPROVED'' AND #targetStatus == ''PENDING_FINANCE_REVIEW''', '只有已审批状态的订单可以提交财务审核', 'BLOCK', 30),
(NULL, 'purchase_order', 'FINANCE_ONLY_APPROVE', 'STATUS_CHANGE', '#status != ''PENDING_FINANCE_REVIEW'' AND #targetStatus == ''FINANCE_APPROVED''', '只有待财务审核状态的订单可以审核', 'BLOCK', 40),
(NULL, 'purchase_order', 'FINANCE_ONLY_REJECT', 'STATUS_CHANGE', '#status != ''PENDING_FINANCE_REVIEW'' AND #targetStatus == ''REJECTED''', '只有待财务审核状态的订单可以驳回', 'BLOCK', 50),
(NULL, 'purchase_order', 'NO_CANCEL_COMPLETED', 'STATUS_CHANGE', '(#status == ''COMPLETED'' OR #status == ''CLOSED'') AND #targetStatus == ''CANCELLED''', '已完成或已关闭的订单不能取消', 'BLOCK', 60),
(NULL, 'purchase_order', 'DRAFT_ONLY_EDIT', 'UPDATE', '#status != ''DRAFT''', '只有草稿状态的订单可以编辑', 'BLOCK', 70),
(NULL, 'purchase_order', 'APPROVED_ONLY_RECEIVE', 'CREATE', '#status != ''APPROVED'' AND #status != ''PARTIAL_RECEIVED''', '只有已审批或部分到货状态的订单可以入库', 'BLOCK', 80),

-- Transfer rules (from TransferServiceImpl)
(NULL, 'transfer', 'NO_CANCEL_TERMINAL', 'STATUS_CHANGE', '#isTerminal == true AND #targetStatus == ''CANCELLED''', '终态调拨单不能取消', 'BLOCK', 10),
(NULL, 'transfer', 'STOCK_SUFFICIENT', 'CREATE', '#stockInsufficient == true', '库存不足，无法创建调拨', 'BLOCK', 20),

-- Return Order rules (from ReturnOrderServiceImpl)
(NULL, 'return_order', 'DRAFT_ONLY_SUBMIT', 'STATUS_CHANGE', '#status != ''DRAFT'' AND #targetStatus == ''SUBMITTED''', '只有草稿状态的退货单可以提交', 'BLOCK', 10),
(NULL, 'return_order', 'SUBMITTED_ONLY_APPROVE', 'STATUS_CHANGE', '#status != ''SUBMITTED'' AND #targetStatus == ''APPROVED''', '只有已提交状态的退货单可以审批', 'BLOCK', 20),
(NULL, 'return_order', 'SUBMITTED_ONLY_REJECT', 'STATUS_CHANGE', '#status != ''SUBMITTED'' AND #targetStatus == ''REJECTED''', '只有已提交状态的退货单可以驳回', 'BLOCK', 30),
(NULL, 'return_order', 'APPROVED_ONLY_COMPLETE', 'STATUS_CHANGE', '#status != ''APPROVED'' AND #targetStatus == ''COMPLETED''', '只有已审批状态的退货单可以完成', 'BLOCK', 40),

-- Supplier rules (from SupplierServiceImpl)
(NULL, 'supplier', 'UNIQUE_NAME', 'CREATE', '#nameExists == true', '供应商名称已存在', 'BLOCK', 10),
(NULL, 'supplier', 'UNIQUE_NAME_UPDATE', 'UPDATE', '#nameExists == true', '供应商名称已存在', 'BLOCK', 20),
(NULL, 'supplier', 'NO_DELETE_WITH_BATCHES', 'DELETE', '#hasBatches == true', '供应商有关联的原材料批次，无法删除', 'BLOCK', 30),
(NULL, 'supplier', 'RATING_RANGE', 'UPDATE', '#rating < 1 OR #rating > 5', '评级必须在1-5之间', 'BLOCK', 40),
(NULL, 'supplier', 'POSITIVE_CREDIT', 'UPDATE', '#creditLimit < 0', '信用额度不能为负数', 'BLOCK', 50),

-- Customer rules (from CustomerServiceImpl)
(NULL, 'customer', 'UNIQUE_NAME', 'CREATE', '#nameExists == true', '客户名称已存在', 'BLOCK', 10),
(NULL, 'customer', 'UNIQUE_NAME_UPDATE', 'UPDATE', '#nameExists == true', '客户名称已存在', 'BLOCK', 20),
(NULL, 'customer', 'NO_DELETE_WITH_DELIVERIES', 'DELETE', '#hasDeliveries == true', '客户有关联的出货记录，无法删除', 'BLOCK', 30),
(NULL, 'customer', 'RATING_RANGE', 'UPDATE', '#rating < 1 OR #rating > 5', '评级必须在1-5之间', 'BLOCK', 40),
(NULL, 'customer', 'POSITIVE_CREDIT', 'UPDATE', '#creditLimit < 0', '信用额度不能为负数', 'BLOCK', 50),

-- Finance AP rules (from ArApServiceImpl)
(NULL, 'finance_ap', 'POSITIVE_AMOUNT', 'CREATE', '#amount <= 0', '应付金额必须大于0', 'BLOCK', 10),
(NULL, 'finance_ap', 'DUPLICATE_PO_AP', 'CREATE', '#existingApForPO == true', '该采购订单已生成应付记录', 'BLOCK', 20),
(NULL, 'finance_payment', 'POSITIVE_AMOUNT', 'CREATE', '#amount <= 0', '付款金额必须大于0', 'BLOCK', 10),
(NULL, 'finance_payment', 'DUPLICATE_REF', 'CREATE', '#refExists == true', '付款单号已存在，请勿重复提交', 'BLOCK', 20),
(NULL, 'finance_receipt', 'POSITIVE_AMOUNT', 'CREATE', '#amount <= 0', '收款金额必须大于0', 'BLOCK', 10),
(NULL, 'finance_receipt', 'DUPLICATE_REF', 'CREATE', '#refExists == true', '收款单号已存在，请勿重复提交', 'BLOCK', 20),
(NULL, 'finance_receipt', 'EXCEED_BALANCE', 'CREATE', '#amount > #remainingBalance AND #remainingBalance > 0', '收款金额超过客户应收余额', 'WARN', 30)
ON CONFLICT (factory_id, module_code, rule_code) DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
git add src/main/resources/db/migration/V20260410_05__seed_bulk_validation_rules.sql
git commit -m "feat(canvas-v2): seed 31 additional validation rules (PO/transfer/return/supplier/customer/AP)"
```

---

## Task 13: Bulk Migration — Default Values

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260410_06__seed_default_values.sql`

- [ ] **Step 1: Write default values migration**

```sql
-- V20260410_06__seed_default_values.sql
-- Default values extracted from service code null-checks

INSERT INTO factory_default_values (factory_id, module_code, field_code, default_value, condition, description) VALUES
-- Sales Order defaults
(NULL, 'sales_order', 'orderDate', '"TODAY"', NULL, '下单日期默认今天'),
(NULL, 'sales_order', 'discountAmount', '0', NULL, '折扣默认0'),
(NULL, 'sales_order', 'discountRate', '0', NULL, '行项目折扣率默认0'),

-- Purchase Order defaults
(NULL, 'purchase_order', 'taxRate', '0', NULL, '税率默认0'),
(NULL, 'purchase_order', 'receivedQuantity', '0', NULL, '已收数量默认0'),

-- BOM defaults
(NULL, 'bom', 'yieldRate', '95', NULL, '默认良率95% (食品加工通用)'),
(NULL, 'bom', 'yieldRate', '90', '#industryType == ''BAKERY''', '烘焙行业良率90%'),
(NULL, 'bom', 'yieldRate', '75', '#industryType == ''AQUACULTURE''', '水产行业良率75%'),
(NULL, 'bom', 'laborQuantity', '1', NULL, '人工数量默认1'),
(NULL, 'bom', 'overheadRate', '1', NULL, '制造费用分摊比例默认1'),
(NULL, 'bom', 'taxRate', '13', NULL, 'BOM 默认税率13%'),
(NULL, 'bom', 'sortOrder', '0', NULL, '排序默认0'),

-- Finance defaults
(NULL, 'finance_ar', 'currentBalance', '0', NULL, '客户当前余额默认0'),
(NULL, 'finance_ap', 'currentBalance', '0', NULL, '供应商当前余额默认0'),
(NULL, 'finance_payment', 'paymentMethod', '"BANK_TRANSFER"', NULL, '默认付款方式: 银行转账'),
(NULL, 'finance_payment', 'paymentDate', '"TODAY"', NULL, '付款日期默认今天'),

-- Invoice defaults
(NULL, 'invoice', 'taxAmount', '0', NULL, '税额默认0'),
(NULL, 'invoice', 'invoiceType', '"NORMAL"', NULL, '发票类型默认普票'),
(NULL, 'invoice', 'taxRate', '0', NULL, '行项目税率默认0'),

-- Supplier/Customer defaults
(NULL, 'supplier', 'creditLimit', '0', NULL, '供应商授信默认0'),
(NULL, 'customer', 'creditLimit', '0', NULL, '客户授信默认0'),
(NULL, 'customer', 'currentBalance', '0', NULL, '客户当前余额默认0'),

-- R&D Sample defaults
(NULL, 'rd_sample', 'urgency', '"MEDIUM"', NULL, '紧急程度默认中'),

-- Inventory defaults
(NULL, 'inventory', 'defaultShelfLifeDays', '90', NULL, '默认保质期90天'),
(NULL, 'inventory', 'defaultShelfLifeDays', '7', '#industryType == ''BAKERY''', '烘焙默认保质期7天'),
(NULL, 'inventory', 'defaultShelfLifeDays', '14', '#industryType == ''AQUACULTURE''', '水产默认保质期14天'),

-- Production defaults
(NULL, 'production_plan', 'priority', '"NORMAL"', NULL, '排产优先级默认NORMAL'),
(NULL, 'production_report', 'defectQuantity', '0', NULL, '不良品数默认0');
```

- [ ] **Step 2: Commit**

```bash
git add src/main/resources/db/migration/V20260410_06__seed_default_values.sql
git commit -m "feat(canvas-v2): seed 28 default values across 10 modules"
```

---

## Task 14: Bulk Migration — Scheduler Configs (configurable subset)

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260410_07__seed_scheduler_configs.sql`

**Context:** 44 @Scheduled tasks exist. Only factory-specific business tasks are worth externalizing (AI reports, batch expiry, production sync). Global system tasks (cache cleanup, model training, health checks) stay as @Scheduled. Seed 12 most-configurable factory tasks.

- [ ] **Step 1: Write scheduler config seed**

```sql
-- V20260410_07__seed_scheduler_configs.sql
-- Factory-configurable scheduled tasks (subset of 44 @Scheduled tasks)
-- Only business-relevant tasks that factories may want to adjust timing

INSERT INTO factory_scheduler_configs (factory_id, task_code, cron_expression, enabled, tool_or_method, params, description) VALUES
-- AI Report generation (factories may want different times)
(NULL, 'AI_DAILY_REPORT', '0 0 20 * * *', true, 'report_daily_generate', '{}', '每日AI报告 (默认20:00)'),
(NULL, 'AI_WEEKLY_REPORT', '0 0 6 * * MON', true, 'report_weekly_generate', '{}', '每周AI报告 (默认周一06:00)'),
(NULL, 'AI_MONTHLY_REPORT', '0 0 6 1 * *', true, 'report_monthly_generate', '{}', '每月AI报告 (默认1号06:00)'),

-- Material batch expiry check (critical for food safety)
(NULL, 'BATCH_EXPIRY_CHECK', '0 0 2 * * ?', true, 'material_batch_expiry_check', '{}', '过期批次检查 (默认02:00)'),

-- Production report sync to SmartBI
(NULL, 'PRODUCTION_SYNC', '0 0 2 * * ?', true, 'production_report_sync', '{}', '报工数据同步 (默认02:00)'),

-- Anomaly detection (factories may want more/less frequent)
(NULL, 'ANOMALY_DETECTION', '0 0 */2 * * *', true, 'quality_anomaly_detect', '{}', '异常检测 (默认每2小时)'),

-- Process task calibration (PROCESS-mode factories)
(NULL, 'TASK_CALIBRATION', '0 0 * * * *', true, 'production_task_calibrate', '{}', '工序任务校准 (默认每小时)'),

-- Active learning (AI improvement)
(NULL, 'ACTIVE_LEARNING_DAILY', '0 0 2 * * ?', true, 'ai_active_learning_analyze', '{}', 'AI主动学习分析 (默认02:00)'),

-- Behavior calibration
(NULL, 'BEHAVIOR_CALIBRATION', '0 0 1 * * ?', true, 'ai_behavior_calibrate', '{}', '行为校准 (默认01:00)'),

-- Error attribution analysis
(NULL, 'ERROR_ATTRIBUTION', '0 0 1 * * ?', true, 'ai_error_attribution', '{}', '错误归因分析 (默认01:00)'),

-- Weight adjustment for APS
(NULL, 'APS_WEIGHT_ADJUST', '0 0 2 * * ?', true, 'scheduling_weight_adjust', '{}', 'APS权重自调整 (默认02:00)'),

-- Alert auto-verification
(NULL, 'ALERT_VERIFY', '0 30 */4 * * *', true, 'quality_alert_verify', '{}', '告警自动验证 (默认每4小时)')
ON CONFLICT (factory_id, task_code) DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
git add src/main/resources/db/migration/V20260410_07__seed_scheduler_configs.sql
git commit -m "feat(canvas-v2): seed 12 factory-configurable scheduled tasks"
```

---

## Task 15: Wire Engines into More Services

**Files:**
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/impl/PurchaseServiceImpl.java`
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/service/finance/impl/ArApServiceImpl.java`

**Context:** Task 11 wired ValidationRuleEvaluator into SalesServiceImpl. Apply the same pattern to 2 more high-value services.

- [ ] **Step 1: Wire into PurchaseServiceImpl**

Add the same `@Autowired(required = false) ValidationRuleEvaluator` + `runConfiguredValidation()` helper. Call at top of `createPurchaseOrder()` and `updateStatus()`.

- [ ] **Step 2: Wire into ArApServiceImpl**

Add `@Autowired(required = false) ValidationRuleEvaluator`. Call before existing hardcoded throws in `createInvoiceFromSalesOrder()` and `recordPayment()`.

- [ ] **Step 3: Compile + Commit**

```bash
git add src/main/java/com/cretas/aims/service/impl/PurchaseServiceImpl.java \
        src/main/java/com/cretas/aims/service/finance/impl/ArApServiceImpl.java
git commit -m "feat(canvas-v2): wire ValidationRuleEvaluator into PurchaseService + ArApService"
```

---

## Verification Criteria (Phase 2b Done)

1. `GET /api/mobile/F001/config/v2/validation-rules?moduleCode=sales_order` — returns seeded rules
2. `PUT /api/mobile/F001/config/v2/validation-rules/DUPLICATE_PRODUCT` with `{"enabled": false}` — disables rule
3. Create SO with duplicate product for F001 → allowed (rule disabled)
4. `GET /api/mobile/F001/config/v2/formulas?moduleCode=bom` — returns 4 BOM formulas
5. `PUT /api/mobile/F001/config/v2/formulas/LINE_AMOUNT` with modified expression → new formula active
6. `GET /api/mobile/F001/config/v2/default-values` — returns factory defaults
7. `PUT /api/mobile/F001/config/v2/scheduler/DAILY_REPORT` with new cron → schedule updates without restart
8. DynamicSchedulerService loads on startup, `getActiveTaskCount() >= 0`

---

## Parallel Work Suggestions

### Subagent: ✅ Recommended
- Tasks 1-3 (DB + entities + repos) can run as one batch
- Tasks 4-8 (engines) — sequential due to SpelConditionEvaluator dependency
- Tasks 9-10 (API + seed) can run as one batch after engines
- Task 11 depends on Task 5

### Multi-Chat: ❌ Not recommended
- All tasks modify the same Java backend, high conflict risk
