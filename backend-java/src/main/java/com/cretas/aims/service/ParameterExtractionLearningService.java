package com.cretas.aims.service;

import java.util.List;
import java.util.Map;

/**
 * 参数提取规则学习服务
 *
 * 提供从用户输入中学习参数提取规则的功能。
 * 当规则命中时，可以直接从用户输入中提取参数，无需调用 LLM。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-17
 */
public interface ParameterExtractionLearningService {

    /**
     * 尝试使用已学习的规则提取参数（不调用LLM）
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param userInput 用户输入
     * @param requiredParams 需要提取的参数列表
     * @return 提取的参数映射，如果无法提取则返回空Map
     */
    Map<String, Object> extractWithLearnedRules(
            String factoryId, String intentCode, String userInput, List<String> requiredParams);

    /**
     * 从 LLM 提取结果中学习规则
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param userInput 原始用户输入
     * @param extractedParams LLM 提取的参数
     */
    void learnFromLLMExtraction(
            String factoryId, String intentCode, String userInput, Map<String, Object> extractedParams);

    /**
     * 用户确认后提升规则置信度
     *
     * @param ruleIds 规则ID列表
     */
    void confirmRules(List<String> ruleIds);

    /**
     * 用户确认参数后学习规则并执行
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param userInput 原始用户输入
     * @param confirmedParams 用户确认的参数
     */
    void learnAndConfirm(
            String factoryId, String intentCode, String userInput, Map<String, Object> confirmedParams);

    /**
     * 获取意图的所有活跃规则
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @return 规则列表
     */
    List<com.cretas.aims.entity.learning.ParameterExtractionRule> getActiveRules(
            String factoryId, String intentCode);

    /**
     * 删除规则
     *
     * @param ruleId 规则ID
     */
    void deleteRule(String ruleId);

    /**
     * 清理低成功率的规则
     *
     * @param minHitCount 最小命中次数
     * @param maxSuccessRate 最大成功率阈值
     * @return 清理的规则数量
     */
    int cleanupLowSuccessRules(int minHitCount, double maxSuccessRate);
}
