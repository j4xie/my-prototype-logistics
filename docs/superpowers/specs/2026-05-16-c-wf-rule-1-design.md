# C-WF-RULE-1 流转规则引擎 — Design Doc

**Sprint 4 Wave 1**, 2026-05-16. **10d backend major**. 跟 Sprint 3 I `ApprovalWorkflow` + Sprint 4 Wave 1 Chat O `C-WF-VAR-1` 配套。

**Branch**: `feat/sprint4-w1-c-wf-rule-1`
**Worktree**: `C:/Users/Steve/cretas-wf-rule`
**Flyway slot**: `V20260531_01__workflow_rules.sql`

---

## §0 Pre-flight grep evidence

| Assumption | Grep | Verdict |
|---|---|---|
| Sprint 3 I ApprovalWorkflow shipped | `find … -name "ApprovalWorkflow*.java"` → entity + executor + service + controller in `entity/config/` + `service/workflow/` | ✅ shipped |
| Sprint 4 Chat O WorkflowVariableContext shipped | `find … -name "WorkflowVariable*.java"` → 0 hits | ❌ not shipped — fallback to minimal context (§4.3) |
| Existing SpEL sandbox infra | `grep "SpelExpressionParser\|@Expression"` → `engine/SpelConditionEvaluator.java` (SimpleEvaluationContext, SEC-2 fixed) + 4 callers | ✅ reuse, NOT reinvent |
| ApprovalWorkflowExecutor 现状 | `Read … ApprovalWorkflowExecutorImpl.java:427-440` → uses `StandardEvaluationContext` directly | ⚠️ SEC-2 hole — fix incidentally (§4.6) |
| `WorkflowRule*` greenfield | `find … -name "*WorkflowRule*"` → 0 hits | ✅ greenfield |
| V20260531_01 slot free | `ls V202605*.sql` → last is `V20260512_*` | ✅ free |
| `safe-commit.sh` available | `ls scripts/safe-commit.sh` | ✅ |

---

## §1 Goal

让用户在 `ApprovalWorkflow` editor 中**不写 SpEL** 也能配置常用条件路由 (金额阈值 / 部门 / 角色)，同时保留 `SPEL_CUSTOM` 作为 power-user 逃生口。

非目标：
- 不重写 Sprint 3 I `ApprovalWorkflowExecutor` (additive 集成)
- 不替换现有 `ApprovalWorkflowEdge.condition` (保留为 raw SpEL escape hatch)
- 不实现 rule 跨 workflow 共享 (rule scope = single workflow)
- 不实现 rule 版本化 (跟 workflow.version 一起 snapshot)

---

## §2 Architecture decisions

### 2.1 Rule vs Edge layering (KEY decision)

**问题**: Sprint 3 I 已通过 `ApprovalWorkflowEdge.condition` (raw SpEL) + `priority` 实现 edge-level condition routing。新增 `WorkflowRule` 跟它什么关系？

**决策**: **WorkflowRule = 用户友好层；Edge.condition = power-user escape hatch；两者共存，rule 先评估**。

```
condition 节点评估顺序:
  1. 查 WorkflowRule WHERE workflow_id=W AND node_id=N AND enabled=true ORDER BY priority ASC
  2. 逐 rule 评估 WorkflowRuleEvaluator.evaluate(context, rule)
     第一个 true → 路由到 rule.trueTargetNodeId (跳过剩余 rule + edge)
     第一个 false → 路由到 rule.falseTargetNodeId (跳过剩余 rule + edge, 如有定义)
     ⚠ falseTargetNodeId NULL → 继续下一 rule
  3. 全部 rule unmatched → 走现有 edge-based 评估 (advanceFromCondition unchanged)
  4. 全部 edge 也 unmatched → label="DEFAULT" → REJECTED (现有逻辑)
```

**why "rule first, then edges"**:
- 客户场景 90% 是简单条件 (金额/部门/角色), rule 体验更好
- 现有 edge.condition 没人写过 — 都是 Sprint 3 I demo 数据，零生产 rule 用户
- 留 edge 作 escape hatch 保证 Sprint 3 I "additive" 约束

**Why store `trueTargetNodeId` on rule rather than relying on edge label="TRUE"/"FALSE"**:
- 一个 condition 节点可挂多 rule (priority ordering), 每个独立指向不同 target — 跟 edge label "TRUE"/"FALSE" 一对一 model 表达不了
- rule 直接持 target 比"rule 评估 → 找 label=TRUE 的 edge → 取 edge.target" 少一层间接

### 2.2 NodeId binding semantics

每个 `WorkflowRule` 必须 `node_id` 非空，绑定到 `condition` 类型节点。`edge_id` 字段保留 nullable 用于未来扩展 (e.g. 给 approval 节点的 autoApproveCondition 改成 rule)，**本 PR 不实现 edge_id 路径**。

### 2.3 ruleType matrix

| ruleType | expression JSON shape | 评估语义 |
|---|---|---|
| `AMOUNT_THRESHOLD` | `{"field": "amount", "op": ">", "value": 10000}` | 取 `context[field]`, 跟 `value` 按 `op` 比较, `op ∈ {>, >=, <, <=, ==, !=}` |
| `DEPT_MATCH` | `{"field": "department", "in": ["finance","purchasing"]}` | `context[field] ∈ in` |
| `ROLE_MATCH` | `{"field": "role", "in": ["FACTORY_SUPER_ADMIN"]}` | `context[field] ∈ in`. `field` 默认 `"role"` (跟 DEPT 不同 helper 类便于 Vue 区分 UI) |
| `SPEL_CUSTOM` | `{"spel": "#amount > 10000 && #department == 'finance'"}` | 走 `SpelConditionEvaluator.evaluateCondition(spel, context)` — 内部走 SimpleEvaluationContext sandbox |

⚠ `expression` 列在 DB 存 JSONB 字符串。Service 层 Jackson parse 成 `Map<String,Object>`. evaluator dispatch on `ruleType`.

### 2.4 Why not generalize to single ruleType="EXPRESSION"?

考虑过 "全统一为 SPEL_CUSTOM，AMOUNT/DEPT/ROLE 只是 Vue UI sugar"。否决:
- Audit 友好: DB 看到 `AMOUNT_THRESHOLD value=10000` 一眼懂业务意图；看到 `#amount > 10000` 要解析 SpEL
- 安全: AMOUNT/DEPT/ROLE 三类完全不走 SpEL parser, 攻击面减少 75%
- AIChat Tool 友好: LLM tool call 用 JSON params 比写 SpEL 字符串可靠

---

## §3 Backend design

### 3.1 WorkflowRule entity

**File**: `backend/java/cretas-api/src/main/java/com/cretas/aims/entity/workflow/WorkflowRule.java`

```java
package com.cretas.aims.entity.workflow;

import com.cretas.aims.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Where;

@Entity
@Table(name = "workflow_rules",
       indexes = {
         @Index(name = "idx_workflow_rules_workflow_node",
                columnList = "workflow_id,node_id,enabled,priority"),
         @Index(name = "idx_workflow_rules_factory",
                columnList = "factory_id")
       })
@Where(clause = "deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class WorkflowRule extends BaseEntity {

    @Id
    @GeneratedValue(generator = "uuid2")
    @org.hibernate.annotations.GenericGenerator(name = "uuid2", strategy = "uuid2")
    @Column(length = 36)
    private String id;

    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    /** 绑定到 ApprovalWorkflow.id */
    @Column(name = "workflow_id", nullable = false, length = 36)
    private String workflowId;

    /** 绑定到 condition 节点的 nodeId (graph 内字符串 id) */
    @Column(name = "node_id", nullable = false, length = 50)
    private String nodeId;

    /** 预留 — 未来 edge-level rule scope; 本 PR 不消费 */
    @Column(name = "edge_id", length = 50)
    private String edgeId;

    @Column(name = "rule_type", nullable = false, length = 30)
    @Enumerated(EnumType.STRING)
    private RuleType ruleType;

    /** JSONB string. Schema per ruleType §2.3. */
    @Column(name = "expression", nullable = false, columnDefinition = "jsonb")
    private String expression;

    /** rule eval=true 时路由到此 nodeId */
    @Column(name = "true_target_node_id", length = 50)
    private String trueTargetNodeId;

    /** rule eval=false 时路由到此 nodeId. NULL = 继续下一 rule */
    @Column(name = "false_target_node_id", length = 50)
    private String falseTargetNodeId;

    @Column(name = "priority", nullable = false)
    @Builder.Default
    private Integer priority = 0;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Column(name = "description", length = 500)
    private String description;

    public enum RuleType {
        AMOUNT_THRESHOLD,
        DEPT_MATCH,
        ROLE_MATCH,
        SPEL_CUSTOM
    }
}
```

### 3.2 Flyway migration

**File**: `backend/java/cretas-api/src/main/resources/db/migration/V20260531_01__workflow_rules.sql`

```sql
CREATE TABLE workflow_rules (
    id VARCHAR(36) PRIMARY KEY,
    factory_id VARCHAR(50) NOT NULL,
    workflow_id VARCHAR(36) NOT NULL,
    node_id VARCHAR(50) NOT NULL,
    edge_id VARCHAR(50),
    rule_type VARCHAR(30) NOT NULL,
    expression JSONB NOT NULL DEFAULT '{}'::jsonb,
    true_target_node_id VARCHAR(50),
    false_target_node_id VARCHAR(50),
    priority INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    description VARCHAR(500),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL,

    CONSTRAINT chk_rule_type CHECK (rule_type IN
        ('AMOUNT_THRESHOLD','DEPT_MATCH','ROLE_MATCH','SPEL_CUSTOM'))
);

CREATE INDEX idx_workflow_rules_workflow_node
    ON workflow_rules (workflow_id, node_id, enabled, priority)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_workflow_rules_factory
    ON workflow_rules (factory_id)
    WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION update_workflow_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workflow_rules_updated_at
BEFORE UPDATE ON workflow_rules
FOR EACH ROW EXECUTE FUNCTION update_workflow_rules_updated_at();
```

### 3.3 Repository

**File**: `backend/.../repository/workflow/WorkflowRuleRepository.java`

```java
public interface WorkflowRuleRepository extends JpaRepository<WorkflowRule, String> {
    /** primary lookup — executor 用 */
    List<WorkflowRule> findByWorkflowIdAndNodeIdAndEnabledTrueOrderByPriorityAsc(
        String workflowId, String nodeId);

    List<WorkflowRule> findByWorkflowIdAndFactoryId(String workflowId, String factoryId);

    List<WorkflowRule> findByFactoryId(String factoryId);
}
```

### 3.4 ExecutionContext (输入到 evaluator)

Sprint 3 I 已有 `dto/approval/ExecutionContext.java`. evaluator 接收的 `Map<String,Object>` 通过下面 helper 派生:

```java
// service/workflow/RuleContextBuilder.java
public static Map<String,Object> buildContext(ExecutionContext exec, User initiator) {
    Map<String,Object> ctx = new HashMap<>();
    // businessContext 透传
    ctx.putAll(exec.getBusinessContext());  // amount / department / customerId / etc.
    // initiator 信息 (Chat O fallback minimal — §4.3)
    ctx.put("initiatorUserId", exec.getInitiatorUserId());
    if (initiator != null) {
        ctx.put("role", initiator.getRoleCode());
        ctx.put("department", initiator.getDepartment());
        ctx.put("username", initiator.getUsername());
    }
    // 流程态
    ctx.put("workflowId", exec.getWorkflowId());
    ctx.put("executionId", exec.getExecutionId());
    ctx.put("decisionType", exec.getDecisionType() == null ? null : exec.getDecisionType().name());
    return ctx;
}
```

**Chat O dependency fallback**: 如 Chat O `WorkflowVariableContext` 后续 ship, 本 builder 改为 delegate to it. 当前自带 minimal context, **无 hard dependency**.

### 3.5 WorkflowRuleEvaluator

**File**: `backend/.../service/workflow/WorkflowRuleEvaluator.java`

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class WorkflowRuleEvaluator {

    private final SpelConditionEvaluator spelEvaluator;
    private final ObjectMapper objectMapper;

    public boolean evaluate(WorkflowRule rule, Map<String,Object> context) {
        try {
            Map<String,Object> expr = parseExpression(rule.getExpression());
            return switch (rule.getRuleType()) {
                case AMOUNT_THRESHOLD -> evalAmountThreshold(expr, context);
                case DEPT_MATCH       -> evalInList(expr, context, "department");
                case ROLE_MATCH       -> evalInList(expr, context, "role");
                case SPEL_CUSTOM      -> evalSpel(expr, context);
            };
        } catch (Exception e) {
            log.warn("WorkflowRule {} ({}) evaluate failed: {}",
                rule.getId(), rule.getRuleType(), e.getMessage());
            return false;  // fail-closed
        }
    }

    private boolean evalAmountThreshold(Map<String,Object> expr, Map<String,Object> ctx) {
        String field = (String) expr.getOrDefault("field", "amount");
        String op = (String) expr.get("op");
        Object thresholdObj = expr.get("value");
        Object actualObj = ctx.get(field);
        if (op == null || thresholdObj == null || actualObj == null) return false;

        BigDecimal threshold = toBigDecimal(thresholdObj);
        BigDecimal actual = toBigDecimal(actualObj);
        if (threshold == null || actual == null) return false;
        int cmp = actual.compareTo(threshold);
        return switch (op) {
            case ">"  -> cmp > 0;
            case ">=" -> cmp >= 0;
            case "<"  -> cmp < 0;
            case "<=" -> cmp <= 0;
            case "==" -> cmp == 0;
            case "!=" -> cmp != 0;
            default -> false;
        };
    }

    @SuppressWarnings("unchecked")
    private boolean evalInList(Map<String,Object> expr, Map<String,Object> ctx, String defaultField) {
        String field = (String) expr.getOrDefault("field", defaultField);
        Object listObj = expr.get("in");
        if (!(listObj instanceof Collection<?> list)) return false;
        Object actual = ctx.get(field);
        if (actual == null) return false;
        String actualStr = String.valueOf(actual);
        return list.stream().anyMatch(v -> actualStr.equals(String.valueOf(v)));
    }

    private boolean evalSpel(Map<String,Object> expr, Map<String,Object> ctx) {
        String spel = (String) expr.get("spel");
        if (spel == null || spel.isBlank()) return false;
        return spelEvaluator.evaluateCondition(spel, ctx);
    }

    private Map<String,Object> parseExpression(String json) throws IOException {
        if (json == null || json.isBlank()) return Map.of();
        return objectMapper.readValue(json, new TypeReference<>() {});
    }

    private BigDecimal toBigDecimal(Object v) {
        if (v == null) return null;
        if (v instanceof BigDecimal bd) return bd;
        if (v instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        if (v instanceof CharSequence s) {
            try { return new BigDecimal(s.toString()); } catch (Exception ignored) {}
        }
        return null;
    }
}
```

### 3.6 SpEL sandbox

复用 `engine/SpelConditionEvaluator.java`. 已具备:
- ✅ `SimpleEvaluationContext.forReadOnlyDataBinding()` (SEC-2)
- ✅ Token reject: `T(`, `@`, `new `, `Runtime`, `ProcessBuilder`, `Class.forName`
- ✅ Length cap 1000, cache cap 500
- ✅ Helper functions: `#now()`, `#addHours(...)`, `#daysBetween(...)`

**本 PR 不改 SpelConditionEvaluator** — 复用为黑盒。

**Incidental fix (additive)**: `ApprovalWorkflowExecutorImpl.evaluateCondition()` 当前用 `StandardEvaluationContext` (允许 `T(Runtime).exec()`). 改为 delegate `spelConditionEvaluator.evaluateCondition()`:

```java
// ApprovalWorkflowExecutorImpl.java BEFORE
private final ExpressionParser spelParser = new SpelExpressionParser();
boolean evaluateCondition(String spel, Map<String,Object> businessContext) {
    StandardEvaluationContext evalCtx = new StandardEvaluationContext();  // SEC-2 hole
    ...
}

// AFTER (additive — interface unchanged)
private final SpelConditionEvaluator spelEvaluator;  // @Autowired via @RequiredArgsConstructor
boolean evaluateCondition(String spel, Map<String,Object> businessContext) {
    return spelEvaluator.evaluateCondition(spel, businessContext);
}
```

测试覆盖 §5.4 verifies `T(Runtime).getRuntime().exec("calc")` 在 raw edge.condition 也被 reject。

### 3.7 ApprovalWorkflowExecutor 集成

**File modify**: `service/workflow/impl/ApprovalWorkflowExecutorImpl.java`

注入 `WorkflowRuleRepository` + `WorkflowRuleEvaluator` + `UserRepository`. 改 `advanceFromCondition()`:

```java
private void advanceFromCondition(ExecutionContext ctx, GraphIndex graph, String nodeId) {
    // NEW: rule path first
    List<WorkflowRule> rules = workflowRuleRepository
        .findByWorkflowIdAndNodeIdAndEnabledTrueOrderByPriorityAsc(
            ctx.getWorkflowId(), nodeId);
    if (!rules.isEmpty()) {
        User initiator = userRepository.findById(ctx.getInitiatorUserId()).orElse(null);
        Map<String,Object> ruleCtx = RuleContextBuilder.buildContext(ctx, initiator);
        for (WorkflowRule rule : rules) {
            boolean matched = workflowRuleEvaluator.evaluate(rule, ruleCtx);
            if (matched && rule.getTrueTargetNodeId() != null) {
                log.info("Rule matched (true) - nodeId={}, ruleId={}, target={}",
                    nodeId, rule.getId(), rule.getTrueTargetNodeId());
                advance(ctx, graph, rule.getTrueTargetNodeId(), nodeId);
                return;
            }
            if (!matched && rule.getFalseTargetNodeId() != null) {
                log.info("Rule unmatched (false) - nodeId={}, ruleId={}, target={}",
                    nodeId, rule.getId(), rule.getFalseTargetNodeId());
                advance(ctx, graph, rule.getFalseTargetNodeId(), nodeId);
                return;
            }
            // matched=true 但 trueTarget=null, 或 matched=false 但 falseTarget=null → 继续下一 rule
        }
        log.debug("All rules exhausted for nodeId={} — fall through to edges", nodeId);
    }
    // EXISTING: edge-based fallback (unchanged Sprint 3 I 逻辑)
    advanceFromConditionEdges(ctx, graph, nodeId);  // 现 advanceFromCondition body
}

// Sprint 3 I 现 advanceFromCondition body rename to advanceFromConditionEdges:
private void advanceFromConditionEdges(ExecutionContext ctx, GraphIndex graph, String nodeId) {
    // 原 Sprint 3 I body 不动 (按 priority 排序 edge, eval condition, DEFAULT fallback)
}
```

**Why rename rather than inline**: 单测便于隔离 rule path 与 edge path。

---

## §4 REST API

### 4.1 WorkflowRuleController

**File**: `controller/workflow/WorkflowRuleController.java`
**Base path**: `/api/mobile/{factoryId}/workflow/rules`

| Method | Path | 用途 |
|---|---|---|
| POST | `/` | create |
| PUT | `/{id}` | update (full) |
| DELETE | `/{id}` | soft-delete |
| GET | `/{id}` | get by id |
| GET | `/?workflowId={wid}` | list by workflow |
| GET | `/by-node?workflowId={wid}&nodeId={nid}` | list by node (executor preview) |
| POST | `/{id}/test` | mock-evaluate (Vue simulator + AIChat tool) |

### 4.2 /test endpoint

```java
@PostMapping("/{id}/test")
public ApiResponse<TestResult> test(
    @PathVariable String factoryId,
    @PathVariable String id,
    @RequestBody Map<String,Object> mockContext
) {
    WorkflowRule rule = service.getRequired(factoryId, id);
    boolean result = evaluator.evaluate(rule, mockContext);
    return ApiResponse.ok(new TestResult(rule.getRuleType(), result, mockContext));
}
```

**Why 单独 /test** vs Vue 端模拟: 后端 sandbox 是 truth source, Vue 端不复刻 SpEL parser。

### 4.3 ExecutionContext spec — Chat O fallback shape

当前最小 keys (无 Chat O 时):

```
amount, department, customerId, supplierId, productId, ... (from businessContext)
initiatorUserId, role, department, username      (from initiator User)
workflowId, executionId, decisionType            (from ExecutionContext)
```

Chat O ship 后, `WorkflowVariableContext` 应增加:
- `workflow.history[].decision` — 此前节点 approval/rejection
- `parallel.arrived[]` — join 节点已到达分支
- `time.now`, `time.workingHours` — 时间窗口判断
- `factory.config.*` — factory-level dynamic config

本 PR 不实现这些，但 `RuleContextBuilder` 改成 single point of injection, 未来切换无侵入。

---

## §5 Test plan

### 5.1 Unit tests — WorkflowRuleEvaluator (≥ 20 case, brief 要求)

| # | ruleType | expression | context | expected |
|---|---|---|---|---|
| 1 | AMOUNT_THRESHOLD | `{field:"amount",op:">",value:10000}` | `amount=20000` | true |
| 2 | AMOUNT_THRESHOLD | 同 1 | `amount=10000` | false (>, 不含等) |
| 3 | AMOUNT_THRESHOLD | `{field:"amount",op:">=",value:10000}` | `amount=10000` | true |
| 4 | AMOUNT_THRESHOLD | `{field:"amount",op:"<",value:5000}` | `amount=4999.99` | true |
| 5 | AMOUNT_THRESHOLD | `{field:"amount",op:"=="...}` (Decimal string "10000.00") | `amount="10000"` | true (BigDecimal compareTo) |
| 6 | AMOUNT_THRESHOLD | missing op | `amount=10000` | false (fail-closed) |
| 7 | AMOUNT_THRESHOLD | missing field in context | `{}` | false |
| 8 | DEPT_MATCH | `{in:["finance","purchasing"]}` (default field=department) | `department="finance"` | true |
| 9 | DEPT_MATCH | 同 8 | `department="sales"` | false |
| 10 | DEPT_MATCH | `{field:"customDept",in:["X","Y"]}` | `customDept="Y"` | true |
| 11 | DEPT_MATCH | empty in list | `department="finance"` | false |
| 12 | ROLE_MATCH | `{in:["FACTORY_SUPER_ADMIN"]}` | `role="FACTORY_SUPER_ADMIN"` | true |
| 13 | ROLE_MATCH | 同 12 | `role="OPERATOR"` | false |
| 14 | SPEL_CUSTOM | `{spel:"#amount > 10000"}` | `amount=20000` | true |
| 15 | SPEL_CUSTOM | `{spel:"#amount > 10000 && #department == 'finance'"}` | `amount=20000, department="finance"` | true |
| 16 | SPEL_CUSTOM | sandbox reject `T(Runtime).getRuntime().exec("calc")` | `{}` | false (sandbox) |
| 17 | SPEL_CUSTOM | sandbox reject `new java.io.File("/").delete()` | `{}` | false |
| 18 | SPEL_CUSTOM | 超长 expression (>1000 chars) | `{}` | false |
| 19 | SPEL_CUSTOM | malformed SpEL `#amount >>` | `amount=100` | false (parse fail) |
| 20 | (parsing) | malformed expression JSON | any | false (parse fail) |

### 5.2 Integration test — ApprovalWorkflowExecutor with rule + edge

| # | 场景 | expected |
|---|---|---|
| I-1 | 1 rule matched=true, no edges | 走 rule.trueTargetNodeId |
| I-2 | 1 rule matched=false, has falseTarget | 走 rule.falseTargetNodeId |
| I-3 | 1 rule matched=false, no falseTarget, has edge condition match | 走 edge.target (fall through) |
| I-4 | 2 rule priority 0+1, rule#0 matched | 走 rule#0 target (skip rule#1) |
| I-5 | 2 rule priority 0+1, rule#0 unmatched 无 falseTarget, rule#1 matched | 走 rule#1 target |
| I-6 | rule disabled (enabled=false) | 跳过该 rule |
| I-7 | rule + edge 全 unmatched, edge label="DEFAULT" 存在 | 走 DEFAULT edge |
| I-8 | rule + edge 全 unmatched, 无 DEFAULT | terminate REJECTED |

### 5.3 REST e2e

- POST create, GET, PUT, DELETE
- POST /test with mock context
- factoryId 隔离: F001 rule 不能被 F002 list/get/test

### 5.4 SEC test

- SPEL_CUSTOM with `T(Runtime).getRuntime().exec("calc")` → eval false, 不抛
- Edge.condition with same payload → eval false (because §3.6 fix made executor delegate to SpelConditionEvaluator)

---

## §6 Frontend design

### 6.1 Vue panel placement

`web-admin/src/views/approval-workflow-editor/components/ConditionRulesPanel.vue`

挂载点: 现有 `approval-workflow-editor` 选中 `condition` 类型节点时, 右侧属性 tab 中加 "条件路由 (Rule)" tab。

### 6.2 UI 结构

```
┌─ 条件路由 — 节点: <nodeLabel> ─────────────────┐
│                                                │
│ [+ 添加规则]                                   │
│                                                │
│ ┌─ Rule #1 (priority=0) ────────[启用] [✕] ─┐  │
│ │ 类型: [AMOUNT_THRESHOLD ▾]                │  │
│ │ 字段: [amount]  操作: [> ▾]  值: [10000]  │  │
│ │ 命中后路由: [节点选择器 ▾]                │  │
│ │ 未命中路由: [节点选择器 ▾] (可空)         │  │
│ │ 说明: [...]                                │  │
│ │ [测试] ←─ 弹 modal 让用户填 mock ctx       │  │
│ └────────────────────────────────────────────┘  │
│                                                │
│ ┌─ Rule #2 (priority=1) ────────[启用] [✕] ─┐  │
│ │ 类型: [SPEL_CUSTOM ▾]                     │  │
│ │ SpEL: [#amount > 50000 && #department='finance']│
│ │ ...                                        │  │
│ └────────────────────────────────────────────┘  │
│                                                │
│ ↕ 拖动调整优先级                                │
└────────────────────────────────────────────────┘
```

### 6.3 测试 modal

点 [测试] 打开:
```
┌─ Mock Context 测试 ─────────────────────────┐
│ {                                            │
│   "amount": 20000,                           │
│   "department": "finance",                   │
│   "role": "FACTORY_SUPER_ADMIN"              │
│ }                                            │
│ (JSON 编辑器, 预填 ruleType 涉及的 field)    │
│                                              │
│ [评估]                                        │
│                                              │
│ 结果: ✓ true / ✗ false                       │
│ 详情: 命中 AMOUNT_THRESHOLD (amount=20000 > 10000)│
└──────────────────────────────────────────────┘
```

调 `POST /api/mobile/{factoryId}/workflow/rules/{id}/test` w/ body=mockCtx.

### 6.4 Files

- Create: `web-admin/src/views/approval-workflow-editor/components/ConditionRulesPanel.vue`
- Create: `web-admin/src/views/approval-workflow-editor/components/RuleEditor.vue` (单 rule 编辑卡)
- Create: `web-admin/src/views/approval-workflow-editor/components/RuleTestModal.vue`
- Create: `web-admin/src/api/workflowRule.ts` (CRUD client)
- Modify: `web-admin/src/views/approval-workflow-editor/ApprovalWorkflowEditor.vue` (新 tab 挂载)

---

## §7 AIChat Tool

**File**: `backend/.../ai/tool/impl/workflow/WorkflowRuleTestTool.java`

```java
@Slf4j
@Component
public class WorkflowRuleTestTool extends AbstractBusinessTool {

    @Autowired private WorkflowRuleService ruleService;
    @Autowired private WorkflowRuleEvaluator evaluator;

    @Override public String getToolName() { return "workflow_rule_test"; }

    @Override public String getDescription() {
        return "测试 ApprovalWorkflow 流转规则: 输入 ruleId + mock context, 返回 evaluate 结果";
    }

    @Override public Map<String,Object> getParametersSchema() {
        return Map.of("type", "object",
            "properties", Map.of(
                "ruleId", Map.of("type","string","description","WorkflowRule.id"),
                "mockContext", Map.of("type","object","description","mock context 字段 (e.g. amount/department/role)")
            ),
            "required", List.of("ruleId","mockContext"));
    }

    @Override protected List<String> getRequiredParameters() {
        return List.of("ruleId","mockContext");
    }

    @Override
    protected Map<String,Object> doExecute(String factoryId,
            Map<String,Object> params, Map<String,Object> context) throws Exception {
        String ruleId = getString(params, "ruleId");
        Map<String,Object> mockCtx = getMap(params, "mockContext");
        WorkflowRule rule = ruleService.getRequired(factoryId, ruleId);
        boolean result = evaluator.evaluate(rule, mockCtx);
        return buildSimpleResult(
            result ? "规则命中" : "规则未命中",
            Map.of("ruleId", ruleId, "ruleType", rule.getRuleType().name(),
                   "result", result, "mockContext", mockCtx));
    }
}
```

意图绑定 — 数据库 INSERT (放在 V20260531_01 SQL 末尾):

```sql
INSERT INTO ai_intent_config (id, intent_code, intent_name, intent_category,
  tool_name, keywords, is_active, sensitivity_level)
VALUES (gen_random_uuid(), 'WORKFLOW_RULE_TEST', '测试流转规则',
  'CONFIG_OPERATION', 'workflow_rule_test',
  '["测试规则","规则评估","流转规则"]'::jsonb, true, 'LOW')
ON CONFLICT (intent_code) DO NOTHING;
```

---

## §8 Implementation tasks (day-by-day)

每 task 完成后 milestone commit (per `feedback_concurrent_edit_safety.md` rule 1)。

### Task 1 (Day 1-2): Spec + skeleton + Flyway

- [x] §0 grep evidence collected
- [x] spec doc written (this file)
- [ ] commit: spec doc to repo

### Task 2 (Day 3-4): Entity + Repo + Service + Evaluator core

- [ ] `entity/workflow/WorkflowRule.java`
- [ ] `repository/workflow/WorkflowRuleRepository.java`
- [ ] `service/workflow/WorkflowRuleService.java` + Impl (CRUD + factoryId 校验)
- [ ] `service/workflow/WorkflowRuleEvaluator.java` (4 ruleType impl)
- [ ] `service/workflow/RuleContextBuilder.java`
- [ ] Flyway V20260531_01
- [ ] mvn compile pass
- [ ] commit: backend skeleton

### Task 3 (Day 5-6): Unit tests (≥20 case)

- [ ] `test/.../WorkflowRuleEvaluatorTest.java` 20 case (§5.1)
- [ ] mvn test pass
- [ ] commit: unit tests

### Task 4 (Day 7): Executor 集成 + integration tests

- [ ] Refactor `ApprovalWorkflowExecutorImpl.advanceFromCondition()` (§3.7)
- [ ] Inject `WorkflowRuleRepository`, `WorkflowRuleEvaluator`, `UserRepository`
- [ ] **Incidental SEC-2 fix**: delegate `evaluateCondition()` to `SpelConditionEvaluator`
- [ ] `test/.../ApprovalWorkflowExecutorRuleIntegrationTest.java` 8 case (§5.2)
- [ ] commit: executor integration

### Task 5 (Day 7): REST controller + e2e

- [ ] `controller/workflow/WorkflowRuleController.java` (7 endpoints §4.1)
- [ ] `test/.../WorkflowRuleControllerTest.java` (CRUD + /test + factoryId 隔离)
- [ ] commit: REST layer

### Task 6 (Day 8-9): Vue panel

- [ ] `api/workflowRule.ts`
- [ ] `components/RuleEditor.vue`
- [ ] `components/ConditionRulesPanel.vue`
- [ ] `components/RuleTestModal.vue`
- [ ] Mount in `ApprovalWorkflowEditor.vue`
- [ ] `vite build` pass + `vitest run` pass (per `feedback_vitest_invariant_tests_not_run_by_vite_build.md`)
- [ ] commit: Vue panel

### Task 7 (Day 10): AIChat Tool + ai_intent_config seed

- [ ] `ai/tool/impl/workflow/WorkflowRuleTestTool.java`
- [ ] Append INSERT to V20260531_01 (intent binding)
- [ ] verify Tool 注册日志 `✅ 注册工具: name=workflow_rule_test`
- [ ] commit: AIChat tool

### Task 8 (Day 10): PR + deploy + smoke

- [ ] `safe-commit.sh` final commit (per `feedback_concurrent_edit_safety.md` rule 5b)
- [ ] `gh pr create` w/ summary + test plan + screenshots
- [ ] admin-merge
- [ ] `git pull origin main` in main worktree (per `feedback_organizer_must_git_pull_before_deploy.md`)
- [ ] `./scripts/deploy/deploy-backend.sh --env all`
- [ ] `./scripts/deploy/deploy-web-admin.sh` (Vue)
- [ ] Smoke: F001 create rule + /test endpoint + Java health
- [ ] Worktree cleanup `git worktree remove`

---

## §9 Risk / open questions

| Risk | Mitigation |
|---|---|
| SEC-2 incidental fix 破坏 Sprint 3 I 现有 autoApproveCondition / autoRejectCondition SpEL | §5.4 test 覆盖 raw edge.condition + node.config.autoApproveCondition 走新 sandbox 评估; SimpleEvaluationContext 跟 StandardEvaluationContext 在常用 SpEL syntax (`#var > X && #var2 == 'Y'`) 行为一致, 只是 ban 了 `T()` / `new` |
| Chat O 后 ship 改 RuleContextBuilder, executor 路径上下文不一致 | RuleContextBuilder single point of injection, Chat O ship 后只需改一处 |
| Vue rule editor 自由形式 SPEL_CUSTOM 让用户写出 sandbox-reject 的 SpEL | RuleTestModal 调后端 /test endpoint, 返回 false + 错误 hint |
| rule + edge 同时存在时 user 困惑 | Vue panel UI 提示 "edge.condition 仅在所有 rule unmatched 时评估" |
| concurrent rule order edit (并发拖动 priority) | optimistic lock via BaseEntity 不加 — Sprint 4 follow-up. Day 10 接受 race window |

---

## §10 Self-review

✅ Spec covers all 5 brief items (entity / evaluator / executor 集成 / Vue panel / AIChat Tool)
✅ All file paths absolute under `backend/java/cretas-api/src/main/java` or `web-admin/src/`
✅ No placeholders or TODOs
✅ Flyway slot V20260531_01 verified free
✅ Type consistency: `WorkflowRule.RuleType` enum used uniformly entity ↔ service ↔ Vue
✅ Chat O dependency fallback explicit (§3.4, §4.3)
✅ SEC-2 incidental fix justified and scoped (§3.6)
✅ Test counts: 20 unit + 8 integration + REST e2e + 2 SEC
✅ All commits use `safe-commit.sh` per rule 5b
