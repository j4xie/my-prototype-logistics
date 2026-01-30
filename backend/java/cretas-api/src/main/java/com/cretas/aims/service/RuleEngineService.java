package com.cretas.aims.service;

import java.util.List;
import java.util.Map;

/**
 * 规则引擎服务接口
 *
 * 提供:
 * - Drools 规则加载与管理
 * - 规则执行
 * - 规则热更新 (无需重启服务)
 * - 决策表支持
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
public interface RuleEngineService {

    /**
     * 加载工厂规则
     * 从数据库加载指定工厂的所有规则并编译到 KieBase
     *
     * @param factoryId 工厂ID
     */
    void loadRules(String factoryId);

    /**
     * 加载规则组
     * 加载指定工厂的特定规则组
     *
     * @param factoryId 工厂ID
     * @param ruleGroup 规则组 (validation, workflow, costing, quality)
     */
    void loadRuleGroup(String factoryId, String ruleGroup);

    /**
     * 执行规则
     * 在指定规则组上执行规则引擎
     *
     * @param factoryId 工厂ID
     * @param ruleGroup 规则组
     * @param facts 事实对象 (规则的输入)
     * @param <T> 返回类型
     * @return 规则执行结果
     */
    <T> T executeRules(String factoryId, String ruleGroup, Object... facts);

    /**
     * 执行规则并返回所有结果
     * 适用于规则可能产生多个输出的场景
     *
     * @param factoryId 工厂ID
     * @param ruleGroup 规则组
     * @param facts 事实对象
     * @return 规则执行结果列表
     */
    List<Object> executeRulesWithMultipleResults(String factoryId, String ruleGroup, Object... facts);

    /**
     * 热更新规则
     * 重新加载指定工厂的规则，无需重启服务
     *
     * @param factoryId 工厂ID
     */
    void reloadRules(String factoryId);

    /**
     * 热更新特定规则组
     *
     * @param factoryId 工厂ID
     * @param ruleGroup 规则组
     */
    void reloadRuleGroup(String factoryId, String ruleGroup);

    /**
     * 添加规则
     * 动态添加新规则
     *
     * @param factoryId 工厂ID
     * @param ruleGroup 规则组
     * @param ruleName 规则名称
     * @param drlContent DRL 规则内容
     * @return 是否添加成功
     */
    boolean addRule(String factoryId, String ruleGroup, String ruleName, String drlContent);

    /**
     * 删除规则
     *
     * @param factoryId 工厂ID
     * @param ruleGroup 规则组
     * @param ruleName 规则名称
     * @return 是否删除成功
     */
    boolean removeRule(String factoryId, String ruleGroup, String ruleName);

    /**
     * 验证 DRL 规则语法
     * 在保存前验证规则是否正确
     *
     * @param drlContent DRL 规则内容
     * @return 验证结果 (isValid, errors)
     */
    Map<String, Object> validateDRL(String drlContent);

    /**
     * 从决策表生成 DRL
     * 将 Excel 决策表转换为 DRL 规则
     *
     * @param decisionTableContent 决策表内容 (Excel bytes)
     * @return 生成的 DRL 规则内容
     */
    String generateDRLFromDecisionTable(byte[] decisionTableContent);

    /**
     * 获取已加载的规则列表
     *
     * @param factoryId 工厂ID
     * @param ruleGroup 规则组 (可选)
     * @return 规则列表 (ruleName, ruleGroup, isActive)
     */
    List<Map<String, Object>> getLoadedRules(String factoryId, String ruleGroup);

    /**
     * 检查规则是否已加载
     *
     * @param factoryId 工厂ID
     * @return 是否已加载
     */
    boolean isRulesLoaded(String factoryId);

    /**
     * 清除工厂规则缓存
     *
     * @param factoryId 工厂ID
     */
    void clearRulesCache(String factoryId);

    /**
     * 获取规则引擎统计信息
     *
     * @param factoryId 工厂ID
     * @return 统计信息 (ruleCount, executionCount, avgExecutionTime)
     */
    Map<String, Object> getStatistics(String factoryId);

    // ==================== 关键决策审计方法 ====================

    /**
     * 执行规则并记录审计日志
     * 用于关键决策场景，需要可回放和审计追踪
     *
     * @param factoryId 工厂ID
     * @param ruleGroup 规则组
     * @param entityType 业务实体类型 (如 "PRODUCTION_BATCH", "QUALITY_CHECK")
     * @param entityId 业务实体ID
     * @param executorId 执行者ID
     * @param executorName 执行者名称 (可选)
     * @param executorRole 执行者角色 (可选)
     * @param facts 事实对象
     * @param <T> 返回类型
     * @return 规则执行结果
     */
    <T> T executeRulesWithAudit(
            String factoryId,
            String ruleGroup,
            String entityType,
            String entityId,
            Long executorId,
            String executorName,
            String executorRole,
            Object... facts);

    /**
     * 执行规则并记录审计日志（多结果版本）
     *
     * @param factoryId 工厂ID
     * @param ruleGroup 规则组
     * @param entityType 业务实体类型
     * @param entityId 业务实体ID
     * @param executorId 执行者ID
     * @param executorName 执行者名称
     * @param executorRole 执行者角色
     * @param facts 事实对象
     * @return 规则执行结果列表
     */
    List<Object> executeRulesWithAuditMultipleResults(
            String factoryId,
            String ruleGroup,
            String entityType,
            String entityId,
            Long executorId,
            String executorName,
            String executorRole,
            Object... facts);

    // ==================== Dry-Run 方法 ====================

    /**
     * 执行规则 Dry-Run（沙箱执行）
     * 在不保存规则的情况下测试规则效果
     * 用于规则发布前预览执行结果
     *
     * @param drlContent DRL 规则内容
     * @param testData 测试数据
     * @param context 执行上下文 (factoryId, entityType, hookPoint 等)
     * @return 执行结果 (rulesMatched, result, simulatedChanges, validationErrors, warnings)
     */
    Map<String, Object> executeDryRun(
            String drlContent,
            Map<String, Object> testData,
            Map<String, Object> context);
}
