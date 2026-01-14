package com.cretas.aims.service;

import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * LLM 意图识别 Fallback 客户端接口
 *
 * 当规则匹配失败或置信度过低时，调用 LLM 进行意图分类。
 * 支持单次调用和多轮对话两种模式:
 * - 单次调用: 直接返回分类结果
 * - 多轮对话: 当置信度 < 30% 时触发，最多 5 轮对话
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2026-01-02
 */
public interface LlmIntentFallbackClient {

    /**
     * 调用 LLM 进行意图分类
     *
     * @param userInput 用户输入
     * @param availableIntents 可用的意图配置列表
     * @param factoryId 工厂ID
     * @param userId 用户ID（用于Tool Calling权限验证）
     * @param userRole 用户角色（用于Tool Calling权限验证）
     * @return 意图匹配结果
     */
    IntentMatchResult classifyIntent(String userInput, List<AIIntentConfig> availableIntents, String factoryId, Long userId, String userRole);

    /**
     * 调用 LLM 进行意图分类 (带多轮对话支持)
     *
     * 当置信度 < 30% 时，可能返回需要进入多轮对话模式的结果。
     *
     * @param userInput 用户输入
     * @param availableIntents 可用的意图配置列表
     * @param factoryId 工厂ID
     * @param userId 用户ID (用于多轮对话会话管理)
     * @return 增强的意图匹配结果
     */
    default EnhancedIntentResult classifyIntentWithConversation(
            String userInput,
            List<AIIntentConfig> availableIntents,
            String factoryId,
            Long userId) {
        // 默认实现: 直接调用单次分类（使用null作为userRole，因为没有该参数）
        IntentMatchResult result = classifyIntent(userInput, availableIntents, factoryId, userId, null);
        return EnhancedIntentResult.fromMatchResult(result);
    }

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
     * 为缺失参数生成澄清问题
     *
     * 当意图已经识别成功，但执行时发现缺少必需的参数时调用。
     * 生成1-3个自然友好的问题，引导用户补充缺失信息。
     *
     * @param userInput 用户原始输入
     * @param intent 已匹配的意图配置
     * @param missingParameters 缺失的参数名列表 (如 ["batchId", "quantity"])
     * @param factoryId 工厂ID
     * @return 澄清问题列表 (最多3个)
     */
    List<String> generateClarificationQuestionsForMissingParams(
            String userInput,
            AIIntentConfig intent,
            List<String> missingParameters,
            String factoryId);

    /**
     * 检查 LLM 服务健康状态
     *
     * @return 是否健康
     */
    boolean isHealthy();

    // ========== LLM Reranking 相关方法 ==========

    /**
     * 对候选意图进行 LLM Reranking
     *
     * 用于中置信度区间 (0.58-0.85) 的二次确认机制:
     * - 输入: 用户查询 + 语义评分的 Top-N 候选
     * - 输出: LLM 确认或调整后的最佳意图
     *
     * @param userInput 用户输入
     * @param candidates 候选意图列表 (已按置信度排序)
     * @param factoryId 工厂ID
     * @return Reranking 结果
     */
    RerankingResult rerankCandidates(String userInput, List<IntentMatchResult.CandidateIntent> candidates, String factoryId);

    /**
     * Reranking 结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class RerankingResult {
        /** 是否成功 */
        private boolean success;

        /** 选中的意图代码 */
        private String selectedIntentCode;

        /** 调整后的置信度 */
        private double adjustedConfidence;

        /** LLM 给出的理由 */
        private String reasoning;

        /** 错误信息 (如果失败) */
        private String errorMessage;

        /** 是否与原语义评分一致 */
        private boolean matchesOriginalRanking;

        public static RerankingResult success(String intentCode, double confidence, String reasoning, boolean matchesOriginal) {
            return RerankingResult.builder()
                    .success(true)
                    .selectedIntentCode(intentCode)
                    .adjustedConfidence(confidence)
                    .reasoning(reasoning)
                    .matchesOriginalRanking(matchesOriginal)
                    .build();
        }

        public static RerankingResult failure(String errorMessage) {
            return RerankingResult.builder()
                    .success(false)
                    .errorMessage(errorMessage)
                    .build();
        }
    }

    // ========== 多轮对话相关方法 ==========

    /**
     * 判断是否需要进入多轮对话模式
     *
     * 触发条件:
     * - Layer 1-4 置信度 < 30%
     * - 无明确的意图匹配
     *
     * @param matchResult 当前匹配结果
     * @return 是否需要多轮对话
     */
    default boolean needsMultiTurnConversation(IntentMatchResult matchResult) {
        if (matchResult == null) {
            return true;
        }
        // 置信度 < 30% 且没有明确匹配
        return matchResult.getConfidence() < 0.3 && matchResult.getBestMatch() == null;
    }

    /**
     * 获取多轮对话置信度阈值
     */
    default double getConversationThreshold() {
        return 0.3;
    }

    // ========== 增强结果类 ==========

    /**
     * 增强的意图识别结果
     * 包含多轮对话相关信息
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class EnhancedIntentResult {
        /** 基础匹配结果 */
        private IntentMatchResult matchResult;

        /** 是否需要多轮对话 */
        private boolean needsConversation;

        /** 多轮对话会话ID (如果已启动) */
        private String conversationSessionId;

        /** 当前对话轮次 */
        private int currentRound;

        /** 澄清问题 (如果需要) */
        private String clarificationQuestion;

        /** 候选意图供用户选择 */
        private List<CandidateOption> candidateOptions;

        /**
         * 从匹配结果创建
         */
        public static EnhancedIntentResult fromMatchResult(IntentMatchResult result) {
            return EnhancedIntentResult.builder()
                    .matchResult(result)
                    .needsConversation(result == null || result.getConfidence() < 0.3)
                    .build();
        }

        /**
         * 创建需要对话的结果
         */
        public static EnhancedIntentResult needsConversation(
                String sessionId,
                int round,
                String question,
                List<CandidateOption> options) {
            return EnhancedIntentResult.builder()
                    .needsConversation(true)
                    .conversationSessionId(sessionId)
                    .currentRound(round)
                    .clarificationQuestion(question)
                    .candidateOptions(options)
                    .build();
        }
    }

    /**
     * 候选选项 (用于多轮对话)
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class CandidateOption {
        private String intentCode;
        private String intentName;
        private String description;
        private double confidence;
    }
}
