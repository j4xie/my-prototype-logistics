package com.cretas.aims.service.impl;

import com.cretas.aims.entity.rules.DroolsRule;
import com.cretas.aims.repository.DroolsRuleRepository;
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
