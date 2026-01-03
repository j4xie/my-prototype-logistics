package com.cretas.aims.service;

import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.config.AIIntentConfig;

import java.util.List;

/**
 * LLM 意图识别 Fallback 客户端接口
 *
 * 当规则匹配失败或置信度过低时，调用 LLM 进行意图分类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
public interface LlmIntentFallbackClient {

    /**
     * 调用 LLM 进行意图分类
     *
     * @param userInput 用户输入
     * @param availableIntents 可用的意图配置列表
     * @param factoryId 工厂ID
     * @return 意图匹配结果
     */
    IntentMatchResult classifyIntent(String userInput, List<AIIntentConfig> availableIntents, String factoryId);

    /**
     * 生成澄清问题
     *
     * @param userInput 用户输入
     * @param candidateIntents 候选意图列表
     * @param factoryId 工厂ID
     * @return 澄清问题文本
     */
    String generateClarificationQuestion(String userInput, List<IntentMatchResult.CandidateIntent> candidateIntents, String factoryId);

    /**
     * 检查 LLM 服务健康状态
     *
     * @return 是否健康
     */
    boolean isHealthy();
}
