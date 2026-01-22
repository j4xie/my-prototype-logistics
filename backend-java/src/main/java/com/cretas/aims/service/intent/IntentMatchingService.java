package com.cretas.aims.service.intent;

import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.intent.MultiIntentResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import java.util.List;
import java.util.Optional;

/**
 * 意图匹配服务
 *
 * 核心意图识别逻辑，包含多层匹配算法：
 * - 正则表达式匹配
 * - 关键词匹配
 * - 语义向量匹配
 * - LLM 兜底
 *
 * @author Cretas Team
 * @version 1.0.0
 */
public interface IntentMatchingService {

    /**
     * 识别用户输入的意图（简单版本）
     *
     * @param userInput 用户输入
     * @return 匹配的意图配置
     */
    Optional<AIIntentConfig> recognizeIntent(String userInput);

    /**
     * 识别用户输入的意图（带租户隔离）
     *
     * @param factoryId 工厂ID
     * @param userInput 用户输入
     * @return 匹配的意图配置
     */
    Optional<AIIntentConfig> recognizeIntent(String factoryId, String userInput);

    /**
     * 识别所有匹配的意图（简单版本）
     *
     * @param userInput 用户输入
     * @return 所有匹配的意图配置列表
     */
    List<AIIntentConfig> recognizeAllIntents(String userInput);

    /**
     * 识别所有匹配的意图（带租户隔离）
     *
     * @param factoryId 工厂ID
     * @param userInput 用户输入
     * @return 所有匹配的意图配置列表
     */
    List<AIIntentConfig> recognizeAllIntents(String factoryId, String userInput);

    /**
     * 识别意图并返回置信度（简单版本）
     *
     * @param userInput 用户输入
     * @param topN 返回候选数量
     * @return 意图匹配结果
     */
    IntentMatchResult recognizeIntentWithConfidence(String userInput, int topN);

    /**
     * 识别意图并返回置信度（带用户信息）
     *
     * @param userInput 用户输入
     * @param factoryId 工厂ID
     * @param topN 返回候选数量
     * @param userId 用户ID
     * @param userRole 用户角色
     * @return 意图匹配结果
     */
    IntentMatchResult recognizeIntentWithConfidence(String userInput, String factoryId,
                                                     int topN, Long userId, String userRole);

    /**
     * 识别意图并返回置信度（完整版本，带会话上下文）
     *
     * @param userInput 用户输入
     * @param factoryId 工厂ID
     * @param topN 返回候选数量
     * @param userId 用户ID
     * @param userRole 用户角色
     * @param sessionId 会话ID
     * @return 意图匹配结果
     */
    IntentMatchResult recognizeIntentWithConfidence(String userInput, String factoryId, int topN,
                                                     Long userId, String userRole, String sessionId);

    /**
     * 识别多意图
     * 支持单个查询包含多个意图的场景
     *
     * @param factoryId 工厂ID
     * @param userInput 用户输入
     * @param userId 用户ID
     * @param userRole 用户角色
     * @param sessionId 会话ID
     * @return 多意图识别结果
     */
    MultiIntentResult recognizeMultiIntent(String factoryId, String userInput,
                                            Long userId, String userRole, String sessionId);

    /**
     * 检查是否通过正则匹配
     *
     * @param intent 意图配置
     * @param input 用户输入
     * @return 是否匹配
     */
    boolean matchesByRegex(AIIntentConfig intent, String input);

    /**
     * 计算关键词匹配分数
     *
     * @param intent 意图配置
     * @param input 用户输入
     * @return 匹配分数
     */
    int calculateKeywordMatchScore(AIIntentConfig intent, String input);
}
