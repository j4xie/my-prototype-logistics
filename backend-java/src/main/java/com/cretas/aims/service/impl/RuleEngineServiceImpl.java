package com.cretas.aims.service.impl;

import com.cretas.aims.entity.rules.DroolsRule;
import com.cretas.aims.repository.DroolsRuleRepository;
import com.cretas.aims.service.DecisionAuditService;
import com.cretas.aims.service.RuleEngineService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.drools.decisiontable.SpreadsheetCompiler;
import org.kie.api.KieServices;
import org.kie.api.builder.KieBuilder;
import org.kie.api.builder.KieFileSystem;
import org.kie.api.builder.KieModule;
import org.kie.api.builder.Message;
import org.kie.api.builder.Results;
import org.kie.api.runtime.KieContainer;
import org.kie.api.runtime.KieSession;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.io.ByteArrayInputStream;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Drools 规则引擎服务实现
 *
 * 特性:
 * - 工厂级规则隔离 (每个工厂独立的 KieContainer)
 * - 规则热更新 (无需重启服务)
 * - 决策表支持 (Excel → DRL)
 * - 执行统计
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RuleEngineServiceImpl implements RuleEngineService {

    private final DroolsRuleRepository droolsRuleRepository;
    private final DecisionAuditService decisionAuditService;

    /**
     * 工厂规则容器缓存
     * key: factoryId
     * value: KieContainer
     */
    private final Map<String, KieContainer> factoryContainers = new ConcurrentHashMap<>();

    /**
     * 工厂规则内容缓存 (用于临时添加的规则)
     * key: factoryId:ruleGroup:ruleName
     * value: DRL content
     */
    private final Map<String, String> ruleContentCache = new ConcurrentHashMap<>();

    /**
     * 执行统计
     */
    private final Map<String, AtomicLong> executionCounts = new ConcurrentHashMap<>();
    private final Map<String, AtomicLong> totalExecutionTimes = new ConcurrentHashMap<>();

    private KieServices kieServices;

    @PostConstruct
    public void init() {
        this.kieServices = KieServices.Factory.get();
        log.info("Drools 规则引擎服务启动, KieServices 已初始化");
    }

    @PreDestroy
    public void destroy() {
        // 清理所有 KieContainer
        factoryContainers.values().forEach(container -> {
            try {
                container.dispose();
            } catch (Exception e) {
                log.warn("清理 KieContainer 失败", e);
            }
        });
        factoryContainers.clear();
        ruleContentCache.clear();
        log.info("Drools 规则引擎服务已关闭");
    }

    @Override
    public void loadRules(String factoryId) {
        log.info("加载工厂规则 - factoryId={}", factoryId);

        try {
            // 获取工厂的所有规则 (后续从数据库加载)
            List<RuleDefinition> rules = loadRulesFromDatabase(factoryId);

            if (rules.isEmpty()) {
                log.info("工厂 {} 没有配置规则", factoryId);
                return;
            }

            // 编译规则
            KieContainer container = buildKieContainer(factoryId, rules);
            factoryContainers.put(factoryId, container);

            log.info("工厂 {} 规则加载完成, 共 {} 条规则", factoryId, rules.size());

        } catch (Exception e) {
            log.error("加载工厂规则失败 - factoryId={}", factoryId, e);
            throw new RuntimeException("规则加载失败: " + e.getMessage(), e);
        }
    }

    @Override
    public void loadRuleGroup(String factoryId, String ruleGroup) {
        log.info("加载规则组 - factoryId={}, ruleGroup={}", factoryId, ruleGroup);

        try {
            List<RuleDefinition> rules = loadRulesFromDatabase(factoryId, ruleGroup);

            if (rules.isEmpty()) {
                log.info("工厂 {} 规则组 {} 没有配置规则", factoryId, ruleGroup);
                return;
            }

            // 重新构建包含该规则组的 KieContainer
            KieContainer container = buildKieContainer(factoryId, rules);
            factoryContainers.put(factoryId + ":" + ruleGroup, container);

            log.info("规则组 {}:{} 加载完成, 共 {} 条规则", factoryId, ruleGroup, rules.size());

        } catch (Exception e) {
            log.error("加载规则组失败 - factoryId={}, ruleGroup={}", factoryId, ruleGroup, e);
            throw new RuntimeException("规则组加载失败: " + e.getMessage(), e);
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T> T executeRules(String factoryId, String ruleGroup, Object... facts) {
        log.debug("执行规则 - factoryId={}, ruleGroup={}, factsCount={}", factoryId, ruleGroup, facts.length);

        long startTime = System.currentTimeMillis();
        String containerKey = factoryId + ":" + ruleGroup;

        try {
            KieContainer container = factoryContainers.get(containerKey);
            if (container == null) {
                container = factoryContainers.get(factoryId);
            }

            if (container == null) {
                log.warn("工厂 {} 规则未加载，尝试自动加载", factoryId);
                loadRules(factoryId);
                container = factoryContainers.get(factoryId);
            }

            if (container == null) {
                log.warn("工厂 {} 没有可用规则", factoryId);
                return null;
            }

            // 创建 KieSession
            KieSession session = container.newKieSession();
            List<Object> results = new ArrayList<>();

            try {
                // 设置全局变量用于收集结果
                session.setGlobal("results", results);

                // 插入事实
                for (Object fact : facts) {
                    session.insert(fact);
                }

                // 执行规则
                int firedCount = session.fireAllRules();
                log.debug("触发了 {} 条规则", firedCount);

                // 返回第一个结果
                return results.isEmpty() ? null : (T) results.get(0);

            } finally {
                session.dispose();
            }

        } finally {
            // 记录执行统计
            long executionTime = System.currentTimeMillis() - startTime;
            recordExecution(factoryId, executionTime);
            log.debug("规则执行完成 - 耗时 {}ms", executionTime);
        }
    }

    @Override
    public List<Object> executeRulesWithMultipleResults(String factoryId, String ruleGroup, Object... facts) {
        log.debug("执行规则(多结果) - factoryId={}, ruleGroup={}", factoryId, ruleGroup);

        long startTime = System.currentTimeMillis();
        String containerKey = factoryId + ":" + ruleGroup;

        try {
            KieContainer container = factoryContainers.get(containerKey);
            if (container == null) {
                container = factoryContainers.get(factoryId);
            }

            if (container == null) {
                loadRules(factoryId);
                container = factoryContainers.get(factoryId);
            }

            if (container == null) {
                return Collections.emptyList();
            }

            KieSession session = container.newKieSession();
            List<Object> results = new ArrayList<>();

            try {
                session.setGlobal("results", results);

                for (Object fact : facts) {
                    session.insert(fact);
                }

                session.fireAllRules();
                return results;

            } finally {
                session.dispose();
            }

        } finally {
            long executionTime = System.currentTimeMillis() - startTime;
            recordExecution(factoryId, executionTime);
        }
    }

    @Override
    public void reloadRules(String factoryId) {
        log.info("热更新工厂规则 - factoryId={}", factoryId);

        // 清除旧的容器
        KieContainer oldContainer = factoryContainers.remove(factoryId);
        if (oldContainer != null) {
            try {
                oldContainer.dispose();
            } catch (Exception e) {
                log.warn("清理旧 KieContainer 失败", e);
            }
        }

        // 清除相关规则组容器
        factoryContainers.keySet().removeIf(key -> key.startsWith(factoryId + ":"));

        // 重新加载
        loadRules(factoryId);

        log.info("工厂 {} 规则热更新完成", factoryId);
    }

    @Override
    public void reloadRuleGroup(String factoryId, String ruleGroup) {
        log.info("热更新规则组 - factoryId={}, ruleGroup={}", factoryId, ruleGroup);

        String containerKey = factoryId + ":" + ruleGroup;
        KieContainer oldContainer = factoryContainers.remove(containerKey);
        if (oldContainer != null) {
            try {
                oldContainer.dispose();
            } catch (Exception e) {
                log.warn("清理旧 KieContainer 失败", e);
            }
        }

        loadRuleGroup(factoryId, ruleGroup);
    }

    @Override
    public boolean addRule(String factoryId, String ruleGroup, String ruleName, String drlContent) {
        log.info("添加规则 - factoryId={}, ruleGroup={}, ruleName={}", factoryId, ruleGroup, ruleName);

        try {
            // 先验证 DRL 语法
            Map<String, Object> validation = validateDRL(drlContent);
            if (!(Boolean) validation.get("isValid")) {
                log.error("规则语法错误: {}", validation.get("errors"));
                return false;
            }

            // 缓存规则内容
            String cacheKey = factoryId + ":" + ruleGroup + ":" + ruleName;
            ruleContentCache.put(cacheKey, drlContent);

            // 重新加载规则
            reloadRuleGroup(factoryId, ruleGroup);

            log.info("规则 {} 添加成功", ruleName);
            return true;

        } catch (Exception e) {
            log.error("添加规则失败", e);
            return false;
        }
    }

    @Override
    public boolean removeRule(String factoryId, String ruleGroup, String ruleName) {
        log.info("删除规则 - factoryId={}, ruleGroup={}, ruleName={}", factoryId, ruleGroup, ruleName);

        String cacheKey = factoryId + ":" + ruleGroup + ":" + ruleName;
        ruleContentCache.remove(cacheKey);

        // 重新加载规则
        reloadRuleGroup(factoryId, ruleGroup);

        return true;
    }

    @Override
    public Map<String, Object> validateDRL(String drlContent) {
        Map<String, Object> result = new HashMap<>();
        List<String> errors = new ArrayList<>();

        try {
            KieFileSystem kfs = kieServices.newKieFileSystem();
            kfs.write("src/main/resources/rules/validation.drl", drlContent);

            KieBuilder kieBuilder = kieServices.newKieBuilder(kfs);
            kieBuilder.buildAll();

            Results results = kieBuilder.getResults();
            if (results.hasMessages(Message.Level.ERROR)) {
                for (Message message : results.getMessages(Message.Level.ERROR)) {
                    errors.add(message.getText());
                }
                result.put("isValid", false);
                result.put("errors", errors);
            } else {
                result.put("isValid", true);
                result.put("errors", Collections.emptyList());
            }

        } catch (Exception e) {
            errors.add("编译异常: " + e.getMessage());
            result.put("isValid", false);
            result.put("errors", errors);
        }

        return result;
    }

    @Override
    public String generateDRLFromDecisionTable(byte[] decisionTableContent) {
        log.info("从决策表生成 DRL");

        try {
            SpreadsheetCompiler compiler = new SpreadsheetCompiler();
            String drl = compiler.compile(new ByteArrayInputStream(decisionTableContent), "XLS");

            log.debug("决策表编译成功, 生成 DRL 长度: {} 字符", drl.length());
            return drl;

        } catch (Exception e) {
            log.error("决策表编译失败", e);
            throw new RuntimeException("决策表编译失败: " + e.getMessage(), e);
        }
    }

    @Override
    public List<Map<String, Object>> getLoadedRules(String factoryId, String ruleGroup) {
        List<Map<String, Object>> ruleList = new ArrayList<>();

        // 从缓存中获取规则列表
        String prefix = factoryId + ":";
        if (ruleGroup != null && !ruleGroup.isEmpty()) {
            prefix += ruleGroup + ":";
        }

        for (String key : ruleContentCache.keySet()) {
            if (key.startsWith(prefix)) {
                String[] parts = key.split(":");
                if (parts.length >= 3) {
                    Map<String, Object> ruleInfo = new HashMap<>();
                    ruleInfo.put("factoryId", parts[0]);
                    ruleInfo.put("ruleGroup", parts[1]);
                    ruleInfo.put("ruleName", parts[2]);
                    ruleInfo.put("isActive", true);
                    ruleList.add(ruleInfo);
                }
            }
        }

        return ruleList;
    }

    @Override
    public boolean isRulesLoaded(String factoryId) {
        return factoryContainers.containsKey(factoryId) ||
               factoryContainers.keySet().stream().anyMatch(key -> key.startsWith(factoryId + ":"));
    }

    @Override
    public void clearRulesCache(String factoryId) {
        log.info("清除工厂规则缓存 - factoryId={}", factoryId);

        // 清除容器
        factoryContainers.keySet().removeIf(key ->
            key.equals(factoryId) || key.startsWith(factoryId + ":"));

        // 清除规则内容缓存
        ruleContentCache.keySet().removeIf(key -> key.startsWith(factoryId + ":"));

        // 清除统计
        executionCounts.remove(factoryId);
        totalExecutionTimes.remove(factoryId);

        log.info("工厂 {} 规则缓存已清除", factoryId);
    }

    @Override
    public Map<String, Object> getStatistics(String factoryId) {
        Map<String, Object> stats = new HashMap<>();

        // 规则数量 (数据库 + 缓存)
        long dbRuleCount = droolsRuleRepository.countByFactoryId(factoryId);
        long cacheRuleCount = ruleContentCache.keySet().stream()
            .filter(key -> key.startsWith(factoryId + ":"))
            .count();
        stats.put("ruleCount", dbRuleCount + cacheRuleCount);
        stats.put("dbRuleCount", dbRuleCount);
        stats.put("cacheRuleCount", cacheRuleCount);

        // 执行次数
        AtomicLong execCount = executionCounts.get(factoryId);
        stats.put("executionCount", execCount != null ? execCount.get() : 0);

        // 平均执行时间
        AtomicLong totalTime = totalExecutionTimes.get(factoryId);
        if (execCount != null && execCount.get() > 0 && totalTime != null) {
            stats.put("avgExecutionTime", totalTime.get() / execCount.get());
        } else {
            stats.put("avgExecutionTime", 0);
        }

        // 是否已加载
        stats.put("isLoaded", isRulesLoaded(factoryId));

        return stats;
    }

    // ==================== 关键决策审计方法 ====================

    @Override
    @SuppressWarnings("unchecked")
    public <T> T executeRulesWithAudit(
            String factoryId,
            String ruleGroup,
            String entityType,
            String entityId,
            Long executorId,
            String executorName,
            String executorRole,
            Object... facts) {

        log.info("执行规则(带审计) - factoryId={}, ruleGroup={}, entityType={}, entityId={}",
                factoryId, ruleGroup, entityType, entityId);

        long startTime = System.currentTimeMillis();
        List<String> appliedRules = new ArrayList<>();

        try {
            // 准备输入上下文 (用于审计)
            Map<String, Object> inputContext = new HashMap<>();
            inputContext.put("factoryId", factoryId);
            inputContext.put("ruleGroup", ruleGroup);
            inputContext.put("entityType", entityType);
            inputContext.put("entityId", entityId);
            inputContext.put("factsCount", facts.length);
            inputContext.put("timestamp", java.time.LocalDateTime.now().toString());

            // 执行规则
            T result = executeRules(factoryId, ruleGroup, facts);

            // 收集触发的规则名称
            appliedRules = collectAppliedRules(factoryId, ruleGroup);

            // 记录审计日志
            long executionTime = System.currentTimeMillis() - startTime;
            Map<String, Object> outputResult = new HashMap<>();
            outputResult.put("result", result);
            outputResult.put("executionTimeMs", executionTime);

            String decisionMade = result != null
                    ? "规则执行成功，返回结果: " + result.getClass().getSimpleName()
                    : "规则执行完成，无返回结果";

            try {
                decisionAuditService.logRuleExecution(
                        factoryId,
                        entityType,
                        entityId,
                        inputContext,
                        outputResult,
                        appliedRules,
                        decisionMade,
                        executorId,
                        executorName,
                        executorRole
                );
                log.debug("规则执行审计日志已记录 - entityId={}, appliedRules={}", entityId, appliedRules.size());
            } catch (Exception e) {
                log.warn("记录规则执行审计日志失败 - entityId={}", entityId, e);
                // 审计失败不影响规则执行结果
            }

            return result;

        } catch (Exception e) {
            log.error("执行规则(带审计)失败 - entityId={}", entityId, e);
            throw e;
        }
    }

    @Override
    public List<Object> executeRulesWithAuditMultipleResults(
            String factoryId,
            String ruleGroup,
            String entityType,
            String entityId,
            Long executorId,
            String executorName,
            String executorRole,
            Object... facts) {

        log.info("执行规则(带审计,多结果) - factoryId={}, ruleGroup={}, entityType={}, entityId={}",
                factoryId, ruleGroup, entityType, entityId);

        long startTime = System.currentTimeMillis();
        List<String> appliedRules = new ArrayList<>();

        try {
            // 准备输入上下文
            Map<String, Object> inputContext = new HashMap<>();
            inputContext.put("factoryId", factoryId);
            inputContext.put("ruleGroup", ruleGroup);
            inputContext.put("entityType", entityType);
            inputContext.put("entityId", entityId);
            inputContext.put("factsCount", facts.length);
            inputContext.put("timestamp", java.time.LocalDateTime.now().toString());

            // 执行规则
            List<Object> results = executeRulesWithMultipleResults(factoryId, ruleGroup, facts);

            // 收集触发的规则
            appliedRules = collectAppliedRules(factoryId, ruleGroup);

            // 记录审计日志
            long executionTime = System.currentTimeMillis() - startTime;
            Map<String, Object> outputResult = new HashMap<>();
            outputResult.put("resultsCount", results.size());
            outputResult.put("executionTimeMs", executionTime);

            String decisionMade = !results.isEmpty()
                    ? "规则执行成功，返回 " + results.size() + " 个结果"
                    : "规则执行完成，无返回结果";

            try {
                decisionAuditService.logRuleExecution(
                        factoryId,
                        entityType,
                        entityId,
                        inputContext,
                        outputResult,
                        appliedRules,
                        decisionMade,
                        executorId,
                        executorName,
                        executorRole
                );
                log.debug("规则执行审计日志已记录 - entityId={}, resultsCount={}", entityId, results.size());
            } catch (Exception e) {
                log.warn("记录规则执行审计日志失败 - entityId={}", entityId, e);
            }

            return results;

        } catch (Exception e) {
            log.error("执行规则(带审计,多结果)失败 - entityId={}", entityId, e);
            throw e;
        }
    }

    /**
     * 收集触发的规则名称
     */
    private List<String> collectAppliedRules(String factoryId, String ruleGroup) {
        List<String> rules = new ArrayList<>();

        // 从缓存中获取规则组的规则列表
        String prefix = factoryId + ":" + ruleGroup + ":";
        for (String key : ruleContentCache.keySet()) {
            if (key.startsWith(prefix)) {
                String[] parts = key.split(":");
                if (parts.length >= 3) {
                    rules.add(parts[2]); // ruleName
                }
            }
        }

        // 也从数据库规则中获取
        List<DroolsRule> dbRules = droolsRuleRepository
                .findByFactoryIdAndRuleGroupAndEnabledTrueOrderByPriorityDesc(factoryId, ruleGroup);
        for (DroolsRule rule : dbRules) {
            if (!rules.contains(rule.getRuleName())) {
                rules.add(rule.getRuleName());
            }
        }

        return rules;
    }

    // ==================== Dry-Run 方法 ====================

    @Override
    public Map<String, Object> executeDryRun(
            String drlContent,
            Map<String, Object> testData,
            Map<String, Object> context) {

        log.info("执行规则 Dry-Run - context={}", context);

        Map<String, Object> result = new HashMap<>();
        List<String> rulesMatched = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        long startTime = System.currentTimeMillis();

        try {
            // Step 1: 验证 DRL 语法
            Map<String, Object> validation = validateDRL(drlContent);
            if (!(Boolean) validation.get("isValid")) {
                result.put("success", false);
                result.put("validationErrors", validation.get("errors"));
                result.put("rulesMatched", Collections.emptyList());
                result.put("result", null);
                result.put("simulatedChanges", Collections.emptyMap());
                result.put("warnings", Collections.emptyList());
                log.warn("Dry-Run 失败: DRL 语法错误 - errors={}", validation.get("errors"));
                return result;
            }

            // Step 2: 创建临时 KieContainer
            KieFileSystem kfs = kieServices.newKieFileSystem();
            String rulePath = "src/main/resources/rules/dryrun/temp_rule.drl";
            kfs.write(rulePath, drlContent);

            KieBuilder kieBuilder = kieServices.newKieBuilder(kfs);
            kieBuilder.buildAll();

            Results buildResults = kieBuilder.getResults();
            if (buildResults.hasMessages(Message.Level.WARNING)) {
                for (Message message : buildResults.getMessages(Message.Level.WARNING)) {
                    warnings.add(message.getText());
                }
            }

            KieModule kieModule = kieBuilder.getKieModule();
            KieContainer tempContainer = kieServices.newKieContainer(kieModule.getReleaseId());

            try {
                // Step 3: 创建 KieSession 并执行
                KieSession session = tempContainer.newKieSession();
                List<Object> ruleResults = new ArrayList<>();
                Map<String, Object> simulatedChanges = new HashMap<>();

                try {
                    // 设置全局变量
                    session.setGlobal("results", ruleResults);

                    // 如果有 simulatedChanges 全局变量支持
                    try {
                        session.setGlobal("simulatedChanges", simulatedChanges);
                    } catch (Exception e) {
                        // 规则可能没有定义 simulatedChanges 全局变量
                        log.debug("规则未定义 simulatedChanges 全局变量");
                    }

                    // 插入测试数据作为 Fact
                    if (testData != null) {
                        // 如果 testData 包含多个 fact，分别插入
                        if (testData.containsKey("facts") && testData.get("facts") instanceof List) {
                            @SuppressWarnings("unchecked")
                            List<Object> facts = (List<Object>) testData.get("facts");
                            for (Object fact : facts) {
                                session.insert(fact);
                            }
                        } else {
                            // 整个 testData 作为一个 Fact
                            session.insert(testData);
                        }
                    }

                    // 执行规则
                    int firedCount = session.fireAllRules();
                    log.debug("Dry-Run 触发了 {} 条规则", firedCount);

                    // 收集匹配的规则
                    // 在真实场景中可以使用 AgendaEventListener 来追踪
                    if (firedCount > 0) {
                        rulesMatched.add("temp_rule (fired " + firedCount + " times)");
                    }

                    // 构建结果
                    String resultStatus = "ALLOW";  // 默认允许
                    if (!ruleResults.isEmpty()) {
                        Object firstResult = ruleResults.get(0);
                        if (firstResult instanceof Map) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> resultMap = (Map<String, Object>) firstResult;
                            if (resultMap.containsKey("result")) {
                                resultStatus = String.valueOf(resultMap.get("result"));
                            }
                            if (resultMap.containsKey("block") && Boolean.TRUE.equals(resultMap.get("block"))) {
                                resultStatus = "BLOCK";
                            }
                        }
                    }

                    result.put("success", true);
                    result.put("validationErrors", Collections.emptyList());
                    result.put("rulesMatched", rulesMatched);
                    result.put("result", resultStatus);
                    result.put("ruleResults", ruleResults);
                    result.put("simulatedChanges", simulatedChanges);
                    result.put("firedCount", firedCount);
                    result.put("warnings", warnings);
                    result.put("executionTimeMs", System.currentTimeMillis() - startTime);

                    log.info("Dry-Run 执行成功 - firedCount={}, result={}", firedCount, resultStatus);

                } finally {
                    session.dispose();
                }

            } finally {
                // Step 4: 清理临时 KieContainer
                tempContainer.dispose();
                log.debug("临时 KieContainer 已清理");
            }

        } catch (Exception e) {
            log.error("Dry-Run 执行失败", e);
            result.put("success", false);
            result.put("validationErrors", Collections.singletonList("执行异常: " + e.getMessage()));
            result.put("rulesMatched", Collections.emptyList());
            result.put("result", null);
            result.put("simulatedChanges", Collections.emptyMap());
            result.put("warnings", warnings);
            result.put("executionTimeMs", System.currentTimeMillis() - startTime);
        }

        return result;
    }

    // ==================== 私有方法 ====================

    /**
     * 从数据库加载规则
     */
    private List<RuleDefinition> loadRulesFromDatabase(String factoryId) {
        List<RuleDefinition> rules = new ArrayList<>();

        // 从数据库加载启用的规则
        List<DroolsRule> dbRules = droolsRuleRepository.findAllEnabledByFactoryIdOrderByPriority(factoryId);
        for (DroolsRule dbRule : dbRules) {
            String drlContent = dbRule.getRuleContent();

            // 如果有决策表，从决策表生成 DRL
            if (dbRule.getDecisionTable() != null && dbRule.getDecisionTable().length > 0) {
                try {
                    drlContent = generateDRLFromDecisionTable(dbRule.getDecisionTable());
                } catch (Exception e) {
                    log.warn("决策表转换失败, 使用原始规则内容 - ruleName={}", dbRule.getRuleName(), e);
                }
            }

            // 过滤无效的 DRL 内容（配置值不是有效的 Drools 规则）
            if (!isValidDrlContent(drlContent)) {
                log.debug("跳过无效 DRL 规则 - ruleName={}, content={}", dbRule.getRuleName(),
                    drlContent != null && drlContent.length() > 50 ? drlContent.substring(0, 50) + "..." : drlContent);
                continue;
            }

            rules.add(new RuleDefinition(dbRule.getRuleGroup(), dbRule.getRuleName(), drlContent));
        }

        // 也添加缓存中的临时规则
        for (Map.Entry<String, String> entry : ruleContentCache.entrySet()) {
            if (entry.getKey().startsWith(factoryId + ":")) {
                String[] parts = entry.getKey().split(":");
                if (parts.length >= 3) {
                    // 检查是否与数据库规则重复
                    String ruleGroup = parts[1];
                    String ruleName = parts[2];
                    boolean exists = rules.stream()
                        .anyMatch(r -> r.ruleGroup.equals(ruleGroup) && r.ruleName.equals(ruleName));
                    if (!exists) {
                        rules.add(new RuleDefinition(ruleGroup, ruleName, entry.getValue()));
                    }
                }
            }
        }

        return rules;
    }

    /**
     * 从数据库加载规则组
     */
    private List<RuleDefinition> loadRulesFromDatabase(String factoryId, String ruleGroup) {
        List<RuleDefinition> rules = new ArrayList<>();

        // 从数据库加载
        List<DroolsRule> dbRules = droolsRuleRepository
            .findByFactoryIdAndRuleGroupAndEnabledTrueOrderByPriorityDesc(factoryId, ruleGroup);

        for (DroolsRule dbRule : dbRules) {
            String drlContent = dbRule.getRuleContent();

            if (dbRule.getDecisionTable() != null && dbRule.getDecisionTable().length > 0) {
                try {
                    drlContent = generateDRLFromDecisionTable(dbRule.getDecisionTable());
                } catch (Exception e) {
                    log.warn("决策表转换失败 - ruleName={}", dbRule.getRuleName(), e);
                }
            }

            // 过滤无效的 DRL 内容
            if (!isValidDrlContent(drlContent)) {
                log.debug("跳过无效 DRL 规则 - ruleName={}", dbRule.getRuleName());
                continue;
            }

            rules.add(new RuleDefinition(dbRule.getRuleGroup(), dbRule.getRuleName(), drlContent));
        }

        // 添加缓存中的临时规则
        String prefix = factoryId + ":" + ruleGroup + ":";
        for (Map.Entry<String, String> entry : ruleContentCache.entrySet()) {
            if (entry.getKey().startsWith(prefix)) {
                String[] parts = entry.getKey().split(":");
                if (parts.length >= 3) {
                    String ruleName = parts[2];
                    boolean exists = rules.stream().anyMatch(r -> r.ruleName.equals(ruleName));
                    if (!exists) {
                        rules.add(new RuleDefinition(ruleGroup, ruleName, entry.getValue()));
                    }
                }
            }
        }

        return rules;
    }

    /**
     * 构建 KieContainer
     */
    private KieContainer buildKieContainer(String factoryId, List<RuleDefinition> rules) {
        KieFileSystem kfs = kieServices.newKieFileSystem();

        // 添加所有规则
        int index = 0;
        for (RuleDefinition rule : rules) {
            String path = "src/main/resources/rules/" + factoryId + "/" +
                         rule.ruleGroup + "/" + rule.ruleName + "_" + (index++) + ".drl";
            kfs.write(path, rule.drlContent);
        }

        // 编译
        KieBuilder kieBuilder = kieServices.newKieBuilder(kfs);
        kieBuilder.buildAll();

        // 检查编译结果
        Results results = kieBuilder.getResults();
        if (results.hasMessages(Message.Level.ERROR)) {
            StringBuilder errors = new StringBuilder();
            for (Message message : results.getMessages(Message.Level.ERROR)) {
                errors.append(message.getText()).append("\n");
            }
            throw new RuntimeException("规则编译错误:\n" + errors);
        }

        // 创建 KieContainer
        KieModule kieModule = kieBuilder.getKieModule();
        return kieServices.newKieContainer(kieModule.getReleaseId());
    }

    /**
     * 记录执行统计
     */
    private void recordExecution(String factoryId, long executionTime) {
        executionCounts.computeIfAbsent(factoryId, k -> new AtomicLong(0)).incrementAndGet();
        totalExecutionTimes.computeIfAbsent(factoryId, k -> new AtomicLong(0)).addAndGet(executionTime);
    }

    /**
     * 检查是否是有效的 DRL 内容
     * 有效的 DRL 应该包含 Drools 关键字如 package, rule, when, then 等
     * 简单的配置值（如 true, 0.85, MANUAL_CONFIRM）不是有效的 DRL
     */
    private boolean isValidDrlContent(String content) {
        if (content == null || content.trim().isEmpty()) {
            return false;
        }

        String trimmed = content.trim().toLowerCase();

        // 检查是否包含 Drools DRL 关键字
        boolean hasPackage = trimmed.contains("package ");
        boolean hasRule = trimmed.contains("rule ");
        boolean hasWhen = trimmed.contains("when");
        boolean hasThen = trimmed.contains("then");
        boolean hasEnd = trimmed.contains("end");

        // 有效的 DRL 至少应该包含 rule + when + then + end
        // 或者是一个完整的包含 package 声明的规则文件
        if ((hasRule && hasWhen && hasThen && hasEnd) || hasPackage) {
            return true;
        }

        // 如果内容很短（小于 50 字符），很可能只是一个配置值
        if (content.trim().length() < 50) {
            return false;
        }

        return false;
    }

    /**
     * 规则定义内部类
     */
    private static class RuleDefinition {
        final String ruleGroup;
        final String ruleName;
        final String drlContent;

        RuleDefinition(String ruleGroup, String ruleName, String drlContent) {
            this.ruleGroup = ruleGroup;
            this.ruleName = ruleName;
            this.drlContent = drlContent;
        }
    }
}
