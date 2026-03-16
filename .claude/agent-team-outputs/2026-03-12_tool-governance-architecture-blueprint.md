# 白垩纪 Tool 治理架构蓝图

**创建日期**: 2026-03-12
**基于代码版本**: commit b84551c6
**目标**: 设计可增量落地的治理骨架，使系统从 318 工具自然扩展到 1200+ 不失控

---

## 一、当前架构精确现状

### 已有能力清单（代码验证）

| 能力 | 文件 | 状态 |
|------|------|------|
| 注册中心 + 冲突检测 | `ToolRegistry.java:44-78` | ✅ 生产级 |
| 域前缀过滤 (D8v2) | `ToolRegistry.getToolDefinitionsForDomains()` | ✅ 生产级 |
| MCP 外部注册/注销 | `ToolRegistry.registerExternal()` | ✅ 预留 |
| 权限过滤 | `ToolExecutor.requiresPermission() + hasPermission()` | ✅ 生产级 |
| TCC 预览 | `AbstractBusinessTool.doPreview()` | ✅ 生产级 |
| 向量召回 + ArenaRL 歧义裁决 | `ToolRouterService` | ✅ 生产级 |
| 渐进式发现接口 | `ToolRouterService.progressiveDiscovery()` | ⚠️ 接口在，实现截断 |
| 自动执行计划 | `ToolRouterService.AutoPlan` | ⚠️ 接口在，默认 disabled |
| 会话冗余检测 (L1+L2 缓存) | `ToolCallRedundancyService` | ✅ 生产级 |
| 工具可靠性统计 | `ToolReliabilityStats` + `BehaviorCalibrationService` | ✅ 生产级 |
| 低可靠性工具识别 | `BehaviorCalibrationService.getLowReliabilityTools()` | ✅ 有 API，未接入自动动作 |
| Skill 3 层优先级 | `SkillRegistryImpl` (DB > file > code) | ✅ 生产级 |
| Skill DAG 执行图 | `SkillDefinition.ExecutionNode` with condition/fallback | ✅ 生产级 |

### 关键缺口（按影响排序）

| 缺口 | 影响 | 当前替代方案 |
|------|------|-------------|
| ToolExecutor 无 version/owner/deprecated | 无法识别僵尸工具 | 团队心智记忆 |
| 无工具分类标签 (actionType/riskLevel) | 域过滤仅靠前缀 | DOMAIN_TOOL_PREFIXES 硬编码 |
| 无新增工具门控 | 膨胀无感知 | 代码 review 人肉 |
| ToolReliabilityStats 未反馈回注册表 | 低可靠工具继续注册 | 手动 isEnabled=false |
| 无工具相似度检测 | 语义冲突不可见 | 无 |
| Workflow 层未定义 | Skill 有被滥用为 workflow 的风险 | 无 |

---

## 二、治理架构分层设计

```
┌─────────────────────────────────────────┐
│          Workflow Templates             │  ← 新增：参数化场景模板（≤30 个）
│  (配置驱动，不写代码)                      │
├─────────────────────────────────────────┤
│          Skill Layer (16→~50)           │  ← 现有：SkillRegistry 3 层加载
│  (业务语义封装，DAG 编排)                  │
├─────────────────────────────────────────┤
│          Tool Layer (318→~500)          │  ← 现有：ToolRegistry + 治理增强
│  (原子能力，单一职责)                      │
├─────────────────────────────────────────┤
│          Governance Infrastructure      │  ← 新增：分类/审计/门控/相似度
│  (元数据 + 可观测性 + 闭环)               │
└─────────────────────────────────────────┘
```

---

## 三、ToolExecutor 接口演进（向后兼容）

### 设计原则
- 所有新增方法均为 `default`，不破坏 318 个现有实现
- 元数据方法返回值用于治理，不影响工具执行逻辑
- 逐步覆盖：新建工具必须覆盖，存量工具可批量 sed 处理

### 新增接口方法

```java
public interface ToolExecutor {

    // ==================== 现有方法（不动） ====================
    String getToolName();
    String getDescription();
    Map<String, Object> getParametersSchema();
    String execute(ToolCall toolCall, Map<String, Object> context) throws Exception;
    default boolean isEnabled() { return true; }
    default boolean requiresPermission() { return false; }
    default boolean hasPermission(String userRole) { return true; }
    default boolean supportsPreview() { return false; }
    default String preview(ToolCall toolCall, Map<String, Object> context) throws Exception {
        return execute(toolCall, context);
    }

    // ==================== Phase 1: 分类标签 ====================

    /**
     * 工具动作类型
     *
     * 用于召回优化（域过滤后再按动作类型缩窄）和权限控制。
     */
    enum ActionType {
        READ,           // 查询类：不修改数据
        WRITE,          // 写入类：创建新记录
        UPDATE,         // 更新类：修改现有记录
        DELETE,         // 删除类：软删除/硬删除
        GENERATE,       // 生成类：生成报告/文件/码
        NOTIFY,         // 通知类：发送消息/告警
        ANALYZE         // 分析类：AI 分析/统计计算
    }

    /**
     * 工具风险等级
     *
     * 用于确认流程控制和审计级别。
     */
    enum RiskLevel {
        LOW,            // 只读操作，无副作用
        MEDIUM,         // 创建/更新操作，可回滚
        HIGH,           // 状态变更，影响业务流程（如冻结批次）
        CRITICAL        // 不可逆操作（如删除、外部通知）
    }

    /**
     * 获取工具动作类型
     * 默认 READ（保守安全，大多数现有工具是查询类）
     */
    default ActionType getActionType() {
        return ActionType.READ;
    }

    /**
     * 获取工具风险等级
     * 默认 LOW（保守安全）
     */
    default RiskLevel getRiskLevel() {
        return RiskLevel.LOW;
    }

    // ==================== Phase 2: 生命周期元数据 ====================

    /**
     * 工具版本号（语义化版本）
     * 用于变更追踪和 API 兼容性管理
     */
    default String getVersion() {
        return "1.0.0";
    }

    /**
     * 工具废弃信息
     * 返回 null 表示活跃；非 null 表示已废弃，值为替代方案说明
     *
     * @return 废弃说明（如 "请使用 alert_list 替代"），或 null（活跃）
     */
    default String getDeprecationNotice() {
        return null;
    }

    /**
     * 是否已废弃（derived from getDeprecationNotice）
     */
    default boolean isDeprecated() {
        return getDeprecationNotice() != null;
    }

    /**
     * 工具所属业务标签（可多个）
     * 用于比 DOMAIN_TOOL_PREFIXES 更精确的分类
     *
     * 示例: ["inventory", "material"] 或 ["quality", "report"]
     */
    default List<String> getDomainTags() {
        // 默认从工具名称提取首段作为单标签
        String name = getToolName();
        if (name != null && name.contains("_")) {
            return List.of(name.substring(0, name.indexOf('_')));
        }
        return List.of("uncategorized");
    }
}
```

### 废弃工具示例

```java
// 合并后的废弃工具，不需要删除类文件
@Component
public class AlertByLevelTool extends AbstractBusinessTool {

    @Override
    public String getDeprecationNotice() {
        return "已合并到 alert_list，请使用 level 参数过滤";
    }

    // isEnabled() 仍然返回 true（默认）
    // → ToolRegistry.init() 中需要新增 deprecated 过滤
}
```

---

## 四、ToolRegistry 治理增强

### 新增能力

```java
@Component
public class ToolRegistry {

    // 现有字段不动
    private final Map<String, ToolExecutor> toolMap = new ConcurrentHashMap<>();

    // ==================== 新增：治理数据结构 ====================

    /** 工具元数据缓存（启动时计算） */
    private final Map<String, ToolMetadata> metadataMap = new ConcurrentHashMap<>();

    /** 按 ActionType 分组索引 */
    private final Map<ToolExecutor.ActionType, Set<String>> actionTypeIndex = new ConcurrentHashMap<>();

    /** 按 RiskLevel 分组索引 */
    private final Map<ToolExecutor.RiskLevel, Set<String>> riskLevelIndex = new ConcurrentHashMap<>();

    /** 按 domainTag 分组索引 */
    private final Map<String, Set<String>> domainTagIndex = new ConcurrentHashMap<>();

    // ==================== init() 增强 ====================

    @PostConstruct
    public void init() {
        // ... 现有注册逻辑不变 ...

        for (ToolExecutor executor : toolExecutors) {
            String toolName = executor.getToolName();
            // ... 现有校验逻辑 ...

            // 新增：跳过 deprecated 工具（但记录元数据）
            if (executor.isDeprecated()) {
                log.info("⚠️  工具已废弃，跳过注册: {} → {}", toolName, executor.getDeprecationNotice());
                metadataMap.put(toolName, buildMetadata(executor, false));
                continue;
            }

            // 现有：跳过 disabled 工具
            if (!executor.isEnabled()) {
                log.info("⏸️  工具已禁用，跳过注册: {}", toolName);
                continue;
            }

            // 现有：冲突检测 + 注册
            toolMap.put(toolName, executor);

            // 新增：构建分类索引
            ToolMetadata metadata = buildMetadata(executor, true);
            metadataMap.put(toolName, metadata);
            indexTool(toolName, executor);
        }

        // 新增：启动报告
        logGovernanceReport();
    }

    /** 构建工具元数据 */
    private ToolMetadata buildMetadata(ToolExecutor executor, boolean registered) {
        return ToolMetadata.builder()
            .toolName(executor.getToolName())
            .description(executor.getDescription())
            .version(executor.getVersion())
            .actionType(executor.getActionType())
            .riskLevel(executor.getRiskLevel())
            .domainTags(executor.getDomainTags())
            .deprecated(executor.isDeprecated())
            .deprecationNotice(executor.getDeprecationNotice())
            .requiresPermission(executor.requiresPermission())
            .supportsPreview(executor.supportsPreview())
            .registered(registered)
            .registeredAt(LocalDateTime.now())
            .className(executor.getClass().getSimpleName())
            .build();
    }

    /** 构建分类索引 */
    private void indexTool(String toolName, ToolExecutor executor) {
        actionTypeIndex
            .computeIfAbsent(executor.getActionType(), k -> ConcurrentHashMap.newKeySet())
            .add(toolName);
        riskLevelIndex
            .computeIfAbsent(executor.getRiskLevel(), k -> ConcurrentHashMap.newKeySet())
            .add(toolName);
        for (String tag : executor.getDomainTags()) {
            domainTagIndex
                .computeIfAbsent(tag, k -> ConcurrentHashMap.newKeySet())
                .add(toolName);
        }
    }

    // ==================== 新增：治理查询 API ====================

    /** 按 ActionType 过滤工具定义 */
    public List<Tool> getToolDefinitionsByActionType(ToolExecutor.ActionType actionType) {
        Set<String> names = actionTypeIndex.getOrDefault(actionType, Collections.emptySet());
        return names.stream()
            .map(toolMap::get)
            .filter(Objects::nonNull)
            .map(e -> Tool.of(e.getToolName(), e.getDescription(), e.getParametersSchema()))
            .collect(Collectors.toList());
    }

    /** 按 domainTag 过滤（替代 DOMAIN_TOOL_PREFIXES 的硬编码前缀匹配） */
    public List<Tool> getToolDefinitionsByDomainTag(String domainTag, String userRole) {
        Set<String> names = domainTagIndex.getOrDefault(domainTag, Collections.emptySet());
        return names.stream()
            .map(toolMap::get)
            .filter(Objects::nonNull)
            .filter(e -> !e.requiresPermission() || e.hasPermission(userRole))
            .map(e -> Tool.of(e.getToolName(), e.getDescription(), e.getParametersSchema()))
            .collect(Collectors.toList());
    }

    /** 两阶段过滤：域 + 动作类型 */
    public List<Tool> getToolDefinitionsFiltered(
            Set<String> domainTags,
            ToolExecutor.ActionType actionType,
            String userRole) {
        Set<String> domainMatched = new HashSet<>();
        for (String tag : domainTags) {
            domainMatched.addAll(domainTagIndex.getOrDefault(tag, Collections.emptySet()));
        }

        Set<String> actionMatched = actionTypeIndex.getOrDefault(actionType, Collections.emptySet());

        // 交集
        Set<String> filtered = new HashSet<>(domainMatched);
        if (actionType != null) {
            filtered.retainAll(actionMatched);
        }

        return filtered.stream()
            .map(toolMap::get)
            .filter(Objects::nonNull)
            .filter(e -> !e.requiresPermission() || e.hasPermission(userRole))
            .map(e -> Tool.of(e.getToolName(), e.getDescription(), e.getParametersSchema()))
            .collect(Collectors.toList());
    }

    /** 获取全量治理报告 */
    public GovernanceReport getGovernanceReport() {
        Map<String, Integer> byActionType = new LinkedHashMap<>();
        actionTypeIndex.forEach((k, v) -> byActionType.put(k.name(), v.size()));

        Map<String, Integer> byRiskLevel = new LinkedHashMap<>();
        riskLevelIndex.forEach((k, v) -> byRiskLevel.put(k.name(), v.size()));

        Map<String, Integer> byDomainTag = new LinkedHashMap<>();
        domainTagIndex.forEach((k, v) -> byDomainTag.put(k, v.size()));

        long deprecatedCount = metadataMap.values().stream()
            .filter(ToolMetadata::isDeprecated).count();

        return GovernanceReport.builder()
            .totalRegistered(toolMap.size())
            .totalDeprecated((int) deprecatedCount)
            .byActionType(byActionType)
            .byRiskLevel(byRiskLevel)
            .byDomainTag(byDomainTag)
            .build();
    }

    /** 启动时输出治理报告 */
    private void logGovernanceReport() {
        GovernanceReport report = getGovernanceReport();
        log.info("📊 Tool Governance Report:");
        log.info("   总注册: {} | 已废弃: {}", report.getTotalRegistered(), report.getTotalDeprecated());
        log.info("   按动作: {}", report.getByActionType());
        log.info("   按风险: {}", report.getByRiskLevel());
        log.info("   按领域 Top5: {}", report.getByDomainTag().entrySet().stream()
            .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
            .limit(5).collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue,
                (a, b) -> a, LinkedHashMap::new)));

        // 膨胀告警
        if (report.getTotalRegistered() > 350) {
            log.warn("⚠️  工具总数超过 350 软上限！当前: {}。请审查是否有可合并的工具。",
                report.getTotalRegistered());
        }
    }
}
```

### 新增数据类

```java
@Data @Builder
public class ToolMetadata {
    private String toolName;
    private String description;
    private String version;
    private ToolExecutor.ActionType actionType;
    private ToolExecutor.RiskLevel riskLevel;
    private List<String> domainTags;
    private boolean deprecated;
    private String deprecationNotice;
    private boolean requiresPermission;
    private boolean supportsPreview;
    private boolean registered;
    private LocalDateTime registeredAt;
    private String className;
}

@Data @Builder
public class GovernanceReport {
    private int totalRegistered;
    private int totalDeprecated;
    private Map<String, Integer> byActionType;
    private Map<String, Integer> byRiskLevel;
    private Map<String, Integer> byDomainTag;
}
```

---

## 五、反馈闭环：可靠性统计 → 自动告警

### 当前断裂点

```
ToolReliabilityStats  →  (数据在 DB)  →  ???  →  ToolRegistry.isEnabled()
                                          ↑
                                      这里断了
```

### 设计：ToolHealthMonitor

```java
@Slf4j
@Component
public class ToolHealthMonitor {

    @Autowired private ToolReliabilityStatsRepository statsRepo;
    @Autowired private ToolRegistry toolRegistry;
    @Autowired private SystemLogRepository systemLogRepo; // 审计日志

    /** 健康阈值配置 */
    private static final BigDecimal SUCCESS_RATE_WARNING = new BigDecimal("50.00");    // 告警
    private static final BigDecimal SUCCESS_RATE_CRITICAL = new BigDecimal("20.00");   // 严重
    private static final int ZERO_CALL_DAYS_THRESHOLD = 90;                            // 僵尸工具
    private static final int CONSECUTIVE_FAIL_DAYS = 7;                                // 连续失败天数

    /**
     * 每日健康检查（建议由 BehaviorCalibrationScheduler 触发）
     *
     * 不自动禁用工具（避免误杀），而是生成告警日志 + 分级建议。
     */
    public ToolHealthReport dailyHealthCheck(String factoryId) {
        LocalDate today = LocalDate.now();
        LocalDate windowStart = today.minusDays(30);

        List<ToolHealthIssue> issues = new ArrayList<>();

        // 1. 低成功率工具
        List<ToolReliabilityStats> lowReliability =
            statsRepo.findByFactoryIdAndStatDateBetweenAndSuccessRateLessThan(
                factoryId, windowStart, today, SUCCESS_RATE_WARNING);
        for (ToolReliabilityStats stat : lowReliability) {
            ToolHealthIssue.Severity severity =
                stat.getSuccessRate().compareTo(SUCCESS_RATE_CRITICAL) < 0
                    ? ToolHealthIssue.Severity.CRITICAL
                    : ToolHealthIssue.Severity.WARNING;
            issues.add(ToolHealthIssue.builder()
                .toolName(stat.getToolName())
                .severity(severity)
                .type(ToolHealthIssue.Type.LOW_SUCCESS_RATE)
                .detail(String.format("成功率 %.1f%% (阈值 %.0f%%)",
                    stat.getSuccessRate(), SUCCESS_RATE_WARNING))
                .recommendation("检查工具实现是否有 bug，或参数校验是否过严")
                .build());
        }

        // 2. 僵尸工具（90 天无调用）
        Set<String> allRegistered = new HashSet<>(toolRegistry.getAllToolNames());
        Set<String> calledRecently = new HashSet<>(
            statsRepo.findToolNamesWithCallsAfter(factoryId, today.minusDays(ZERO_CALL_DAYS_THRESHOLD)));
        Set<String> zombies = new HashSet<>(allRegistered);
        zombies.removeAll(calledRecently);
        for (String zombie : zombies) {
            issues.add(ToolHealthIssue.builder()
                .toolName(zombie)
                .severity(ToolHealthIssue.Severity.INFO)
                .type(ToolHealthIssue.Type.ZOMBIE)
                .detail(String.format("%d 天无调用", ZERO_CALL_DAYS_THRESHOLD))
                .recommendation("考虑废弃或合并到其他工具")
                .build());
        }

        // 3. 膨胀告警
        int totalTools = toolRegistry.getToolCount();
        if (totalTools > 350) {
            issues.add(ToolHealthIssue.builder()
                .toolName("_registry_")
                .severity(totalTools > 500 ? ToolHealthIssue.Severity.CRITICAL
                                           : ToolHealthIssue.Severity.WARNING)
                .type(ToolHealthIssue.Type.BLOAT)
                .detail(String.format("注册工具总数 %d，超过 350 软上限", totalTools))
                .recommendation("运行工具合并审计，检查枚举膨胀和过滤条件膨胀")
                .build());
        }

        ToolHealthReport report = ToolHealthReport.builder()
            .factoryId(factoryId)
            .checkDate(today)
            .totalRegistered(totalTools)
            .totalIssues(issues.size())
            .criticalCount((int) issues.stream()
                .filter(i -> i.getSeverity() == ToolHealthIssue.Severity.CRITICAL).count())
            .warningCount((int) issues.stream()
                .filter(i -> i.getSeverity() == ToolHealthIssue.Severity.WARNING).count())
            .zombieCount((int) issues.stream()
                .filter(i -> i.getType() == ToolHealthIssue.Type.ZOMBIE).count())
            .issues(issues)
            .build();

        // 输出到日志
        if (report.getCriticalCount() > 0) {
            log.error("🚨 Tool Health: {} CRITICAL issues found!", report.getCriticalCount());
        }
        log.info("📋 Tool Health Report: {} tools, {} issues ({} critical, {} warning, {} zombie)",
            report.getTotalRegistered(), report.getTotalIssues(),
            report.getCriticalCount(), report.getWarningCount(), report.getZombieCount());

        return report;
    }
}
```

---

## 六、工具相似度检测（防语义冲突）

### 设计：ToolSimilarityDetector

```java
@Slf4j
@Component
public class ToolSimilarityDetector {

    @Autowired private ToolRegistry toolRegistry;
    @Autowired(required = false) private EmbeddingClient embeddingClient;

    private static final double SIMILARITY_THRESHOLD = 0.85;

    /**
     * 检测高相似度工具对（启动时或定期运行）
     *
     * 对全量工具 description 做两两余弦相似度计算，
     * 标记 > 0.85 的工具对，人工审查是否需要合并或重写描述。
     *
     * 复杂度 O(n²)，318 工具 ≈ 50K 对，单次约 2-5 秒。
     */
    public List<SimilarToolPair> detectSimilarTools() {
        if (embeddingClient == null) {
            log.warn("EmbeddingClient 未配置，跳过相似度检测");
            return Collections.emptyList();
        }

        List<String> toolNames = toolRegistry.getAllToolNames();
        Map<String, float[]> embeddings = new HashMap<>();

        // 批量计算 embedding
        for (String name : toolNames) {
            ToolExecutor executor = toolRegistry.getExecutor(name).orElse(null);
            if (executor == null) continue;
            String text = name + ": " + executor.getDescription();
            float[] embedding = embeddingClient.embed(text);
            if (embedding != null) {
                embeddings.put(name, embedding);
            }
        }

        // 两两比较
        List<SimilarToolPair> pairs = new ArrayList<>();
        List<String> names = new ArrayList<>(embeddings.keySet());
        for (int i = 0; i < names.size(); i++) {
            for (int j = i + 1; j < names.size(); j++) {
                double sim = cosineSimilarity(embeddings.get(names.get(i)),
                                              embeddings.get(names.get(j)));
                if (sim >= SIMILARITY_THRESHOLD) {
                    pairs.add(SimilarToolPair.builder()
                        .toolA(names.get(i))
                        .toolB(names.get(j))
                        .similarity(sim)
                        .sameDomain(extractDomain(names.get(i))
                            .equals(extractDomain(names.get(j))))
                        .build());
                }
            }
        }

        pairs.sort(Comparator.comparingDouble(SimilarToolPair::getSimilarity).reversed());
        log.info("🔍 相似度检测完成: {} 个工具, {} 对高相似 (>{})",
            toolNames.size(), pairs.size(), SIMILARITY_THRESHOLD);
        return pairs;
    }
}
```

---

## 七、Workflow 层设计（参数化模板，不写代码）

### 关键原则
- Workflow = 参数化的 Skill 编排模板
- 存储在数据库 `workflow_template` 表
- 通过 SkillExecutor 的 DAG 引擎执行（复用现有能力）
- **不新建执行引擎**，利用 SkillDefinition.ExecutionNode 的 condition/params 能力

### 数据库 Schema

```sql
CREATE TABLE workflow_template (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(128) UNIQUE NOT NULL,    -- 如 "inventory_risk_handling"
    display_name    VARCHAR(256) NOT NULL,           -- 如 "库存风险处理"
    description     TEXT,
    category        VARCHAR(64),                     -- RISK/REPORT/LIFECYCLE/QUALITY

    -- 骨架定义（JSON，复用 SkillDefinition.ExecutionNode 格式）
    execution_graph JSON NOT NULL,

    -- 可配置参数定义（JSON Schema 格式，与 Tool parametersSchema 一致）
    config_schema   JSON,

    -- 默认参数值
    default_config  JSON,

    -- 触发条件（JSON，与 Skill triggers 格式一致）
    triggers        JSON,

    -- 治理字段
    version         VARCHAR(16) DEFAULT '1.0.0',
    owner           VARCHAR(64),
    enabled         BOOLEAN DEFAULT TRUE,

    -- BaseEntity 字段
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP
);
```

### 示例：库存风险处理（一个模板覆盖所有变体）

```json
{
  "name": "inventory_risk_handling",
  "display_name": "库存风险处理",
  "execution_graph": [
    {
      "id": "check_stock",
      "toolName": "material_low_stock_alert",
      "params": { "threshold": "${config.threshold}" }
    },
    {
      "id": "analyze_impact",
      "toolName": "order_risk_analysis",
      "dependsOn": ["check_stock"],
      "condition": "${check_stock.result.hasLowStock == true}",
      "params": { "includeOrders": "${config.analyzeOrders}" }
    },
    {
      "id": "notify",
      "toolName": "notify_user",
      "dependsOn": ["analyze_impact"],
      "condition": "${config.notifyEnabled == true}",
      "params": {
        "targetRole": "${config.notifyTarget}",
        "channel": "${config.notifyChannel}",
        "includeManager": "${config.escalateToManager}"
      }
    }
  ],
  "config_schema": {
    "type": "object",
    "properties": {
      "threshold": { "type": "integer", "default": 100, "description": "安全库存阈值" },
      "analyzeOrders": { "type": "boolean", "default": true },
      "notifyEnabled": { "type": "boolean", "default": true },
      "notifyTarget": { "type": "string", "enum": ["procurement", "warehouse_mgr", "both"], "default": "procurement" },
      "notifyChannel": { "type": "string", "enum": ["in_app", "sms", "both"], "default": "in_app" },
      "escalateToManager": { "type": "boolean", "default": false }
    }
  },
  "default_config": {
    "threshold": 100,
    "analyzeOrders": true,
    "notifyEnabled": true,
    "notifyTarget": "procurement",
    "notifyChannel": "in_app",
    "escalateToManager": false
  }
}
```

**关键点**：A 工厂阈值 100、通知采购，B 工厂阈值 150、通知仓管+抄送主管 → 同一个模板，不同的 config。不新建 workflow。

### 初始 Workflow 模板清单（≤15 个覆盖核心场景）

| 模板名 | 涉及 Skill/Tool | 可配参数 |
|--------|-----------------|---------|
| `inventory_risk_handling` | material_low_stock + order_risk + notify | 阈值/通知对象/渠道 |
| `inbound_processing` | material_batch_create + quality_check + notify | 是否需质检/质检标准 |
| `outbound_verification` | shipment_query + inventory_check + quality_verify | 质检项/冻结检查 |
| `batch_anomaly_handling` | alert_list + batch_freeze + notify + audit_log | 自动冻结/通知级别 |
| `daily_production_report` | report_production + report_quality + report_kpi | 包含模块/时间范围 |
| `equipment_failure_response` | alert_diagnose + equipment_status + notify + maintenance_create | 自动派单/通知级别 |
| `quality_deviation_handling` | quality_check + batch_status + notify + disposal_suggest | 处置策略/通知链 |
| `supplier_evaluation_cycle` | supplier_list + quality_stats + delivery_stats + ranking | 评估维度/权重 |

---

## 八、新增工具门控清单（代码化）

### 设计：在 ToolRegistry.init() 中自动执行

```java
/** 启动时门控检查（不阻止注册，仅产生告警） */
private void runGovernanceChecks() {
    List<String> warnings = new ArrayList<>();

    for (ToolExecutor executor : toolMap.values()) {
        String name = executor.getToolName();

        // 检查 1：命名规范（必须含下划线）
        if (!name.contains("_")) {
            warnings.add(String.format("命名不规范: %s (应为 {domain}_{action} 格式)", name));
        }

        // 检查 2：描述长度（太短影响向量召回，太长浪费 token）
        String desc = executor.getDescription();
        if (desc == null || desc.length() < 10) {
            warnings.add(String.format("描述过短: %s (%d 字)", name,
                desc == null ? 0 : desc.length()));
        }
        if (desc != null && desc.length() > 200) {
            warnings.add(String.format("描述过长: %s (%d 字，建议 ≤200)", name, desc.length()));
        }

        // 检查 3：WRITE/DELETE 工具必须支持预览
        if ((executor.getActionType() == ToolExecutor.ActionType.WRITE
             || executor.getActionType() == ToolExecutor.ActionType.DELETE)
            && !executor.supportsPreview()) {
            warnings.add(String.format("写入/删除工具未支持预览: %s", name));
        }

        // 检查 4：HIGH/CRITICAL 风险工具必须要求权限
        if ((executor.getRiskLevel() == ToolExecutor.RiskLevel.HIGH
             || executor.getRiskLevel() == ToolExecutor.RiskLevel.CRITICAL)
            && !executor.requiresPermission()) {
            warnings.add(String.format("高风险工具未要求权限: %s (risk=%s)",
                name, executor.getRiskLevel()));
        }

        // 检查 5：版本号格式
        String version = executor.getVersion();
        if (version != null && !version.matches("\\d+\\.\\d+\\.\\d+")) {
            warnings.add(String.format("版本号格式不规范: %s (version=%s)", name, version));
        }
    }

    if (!warnings.isEmpty()) {
        log.warn("🔍 Tool 治理检查发现 {} 个问题:", warnings.size());
        warnings.forEach(w -> log.warn("   - {}", w));
    } else {
        log.info("✅ Tool 治理检查通过，所有工具符合规范");
    }
}
```

---

## 九、域过滤演进路径：前缀 → 标签 → 向量

### 当前（D8v2）：前缀匹配

```
DOMAIN_TOOL_PREFIXES: Map<Domain, Set<String>>
MATERIAL → {"material_"}
FINANCE → {"report_finance", "report_cost", "report_bom", "conversion_"}
```

**问题**：硬编码，跨域工具无法同时属于两个域。

### Phase 1（P0）：前缀补全 + domainTag

在 `LlmIntentFallbackClientImpl` 中，优先使用 `ToolRegistry.getToolDefinitionsByDomainTag()` 替代前缀匹配。工具通过 `getDomainTags()` 声明自己属于哪些域，一个工具可属于多个域。

```java
// 演进后的 getFilteredToolsForQuery()
private List<Tool> getFilteredToolsForQuery(String query, String userRole) {
    Set<String> detectedDomains = detectAllDomains(query);

    // 优先用 domainTag 索引（如果工具覆盖了 getDomainTags）
    List<Tool> tagged = toolRegistry.getToolDefinitionsFiltered(
        domainTagStrings(detectedDomains), null, userRole);
    if (tagged.size() >= 5) {
        return tagged;
    }

    // 兜底：现有前缀匹配
    return toolRegistry.getToolDefinitionsForDomains(
        getPrefixesForDomains(detectedDomains),
        META_TOOL_PREFIXES, userRole);
}
```

### Phase 2（P2）：两阶段（标签 + 向量）

```
用户查询
  → 1. 域检测 → domainTag 过滤（≤50 工具）
  → 2. 向量检索 Top-10（在 ≤50 工具中检索，不是全量 318）
  → 3. LLM 调用（仅含 Top-10 工具定义）
```

### Phase 3（P3）：域 Agent 分组

当工具超过 500 时，每个域运行独立 Agent：

```
Router Agent（意图识别 → 分发）
  ├─ Inventory Agent（inventory 域 ~60 工具）
  ├─ Production Agent（production 域 ~80 工具）
  ├─ Quality Agent（quality 域 ~40 工具）
  └─ ...
```

复用 Skill 的 DAG 编排能力，每个域 Agent 本质是一个特化的 Skill。

---

## 十、增量落地路线图

```
Phase 1 (M1-M2): 骨架搭建
├─ ToolExecutor 新增 ActionType/RiskLevel/getVersion/getDeprecationNotice (default 方法)
├─ ToolRegistry 新增 metadataMap + 分类索引 + GovernanceReport
├─ ToolHealthMonitor 实现 (告警日志，不自动禁用)
├─ DOMAIN_TOOL_PREFIXES 精细前缀补全
└─ 启动日志输出 GovernanceReport

Phase 2 (M3-M4): 存量标注
├─ 批量为 318 工具添加 ActionType/RiskLevel 覆盖
│   (通过 AbstractBusinessTool 子类 sed 批处理，先 READ 后逐域修正)
├─ ToolSimilarityDetector 上线，生成高相似度工具审计报告
├─ 第一轮合并：alert 5→2, scheduling 3→1 (合并工具用 getDeprecationNotice)
└─ tool_metadata DB 表 + Admin API

Phase 3 (M5-M6): 闭环打通
├─ ToolReliabilityStats → ToolHealthMonitor → 月度审计报告
├─ workflow_template 表 + 前 5 个模板
├─ domainTag 索引替代部分 DOMAIN_TOOL_PREFIXES
├─ progressiveDiscovery Phase 2 (向量 → LLM 精选)
└─ Web-Admin 工具审计仪表板

Phase 4 (M7-M12): 规模验证
├─ 全量 domainTag 迁移，DOMAIN_TOOL_PREFIXES 降级为兜底
├─ Workflow 模板扩展到 15 个
├─ 500 工具模拟压测
├─ 域 Agent 架构设计（如果需要）
└─ 工具发布 CI 检查（相似度 >0.85 告警）
```

---

## 十一、关键设计决策记录

| 决策 | 选择 | 原因 | 否决方案 |
|------|------|------|---------|
| 生命周期元数据放接口 vs DB | **接口 default 方法** | 编译时可见，IDE 自动提示；default 方法不破坏存量 | DB 表方案需额外查询，与注册流程解耦导致数据不同步 |
| Workflow 用新引擎 vs 复用 SkillExecutor | **复用 SkillExecutor** | DAG + condition + params 已实现；避免重复建设 | 新引擎更灵活但维护成本翻倍 |
| 膨胀控制靠自动禁用 vs 告警 | **告警不自动禁用** | 误杀风险高，单团队可人工决策 | 自动禁用在多团队时可考虑 |
| domainTag 取代 vs 补充前缀匹配 | **先补充后取代** | 平滑迁移，不破坏现有 D8v2 路径 | 直接取代风险太大 |
| 相似度检测内置 vs CI | **先内置定期运行，后加 CI** | 内置可快速验证效果 | 纯 CI 方案需要构建流水线 |

---

## 十二、验收标准

| 阶段 | 验收条件 |
|------|---------|
| Phase 1 | 启动日志输出 GovernanceReport；`/api/admin/tool-governance` 返回 JSON |
| Phase 2 | ≥90% 工具有正确的 ActionType/RiskLevel；相似度报告生成 |
| Phase 3 | 月度健康报告自动生成；≥5 个 Workflow 模板上线；僵尸工具数 = 0 |
| Phase 4 | 500 工具压测域内 ≤40 个；E2E 意图准确率 ≥95% |
