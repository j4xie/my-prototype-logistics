package com.cretas.aims.dto.intent;

import com.cretas.aims.entity.config.AIIntentConfig;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 意图匹配结果 DTO
 *
 * 包含意图识别的完整信息:
 * - 最佳匹配意图
 * - Top-N 候选意图（带置信度）
 * - 匹配方法和匹配的关键词
 * - 强/弱信号判断
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class IntentMatchResult {

    /**
     * 最佳匹配的意图配置
     */
    private AIIntentConfig bestMatch;

    /**
     * Top-N 候选意图列表（按置信度降序）
     */
    private List<CandidateIntent> topCandidates;

    /**
     * 最佳匹配的置信度 (0.0 - 1.0)
     */
    private Double confidence;

    /**
     * 匹配方法: REGEX / KEYWORD / LLM / NONE
     */
    private MatchMethod matchMethod;

    /**
     * 匹配到的关键词列表
     */
    private List<String> matchedKeywords;

    /**
     * 是否为强信号（高置信度，无歧义）
     * 强信号条件:
     * 1. 匹配关键词 >= 3
     * 2. top1与top2置信度差距 > 0.3
     * 3. 优先级 >= 80
     */
    private Boolean isStrongSignal;

    /**
     * 是否需要用户确认
     * 基于信号强度和敏感度级别决定
     */
    private Boolean requiresConfirmation;

    /**
     * 澄清问题（当需要确认时生成）
     */
    private String clarificationQuestion;

    /**
     * 原始用户输入
     */
    private String userInput;

    /**
     * 匹配方法枚举
     */
    public enum MatchMethod {
        REGEX,      // 正则表达式匹配
        KEYWORD,    // 关键词匹配
        LLM,        // LLM fallback 匹配
        NONE        // 未匹配
    }

    /**
     * 候选意图内部类
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CandidateIntent {
        /**
         * 意图代码
         */
        private String intentCode;

        /**
         * 意图名称
         */
        private String intentName;

        /**
         * 意图分类
         */
        private String intentCategory;

        /**
         * 置信度 (0.0 - 1.0)
         */
        private Double confidence;

        /**
         * 匹配分数（原始分数）
         */
        private Integer matchScore;

        /**
         * 匹配到的关键词
         */
        private List<String> matchedKeywords;

        /**
         * 匹配方法
         */
        private MatchMethod matchMethod;

        /**
         * 意图描述
         */
        private String description;

        /**
         * 从 AIIntentConfig 创建候选意图
         */
        public static CandidateIntent fromConfig(AIIntentConfig config, Double confidence,
                                                  Integer matchScore, List<String> matchedKeywords,
                                                  MatchMethod matchMethod) {
            return CandidateIntent.builder()
                    .intentCode(config.getIntentCode())
                    .intentName(config.getIntentName())
                    .intentCategory(config.getIntentCategory())
                    .confidence(confidence)
                    .matchScore(matchScore)
                    .matchedKeywords(matchedKeywords)
                    .matchMethod(matchMethod)
                    .description(config.getDescription())
                    .build();
        }
    }

    /**
     * 创建空结果（无匹配）
     */
    public static IntentMatchResult empty(String userInput) {
        return IntentMatchResult.builder()
                .bestMatch(null)
                .topCandidates(List.of())
                .confidence(0.0)
                .matchMethod(MatchMethod.NONE)
                .matchedKeywords(List.of())
                .isStrongSignal(false)
                .requiresConfirmation(false)
                .userInput(userInput)
                .build();
    }

    /**
     * 判断是否有匹配结果
     */
    public boolean hasMatch() {
        return bestMatch != null && confidence > 0;
    }

    /**
     * 判断是否需要 LLM fallback
     * 条件: 无匹配或置信度过低
     */
    public boolean needsLlmFallback() {
        return bestMatch == null || confidence < 0.3;
    }

    /**
     * 判断是否需要用户选择候选意图
     * 条件: 有多个候选且置信度差距小
     */
    public boolean needsCandidateSelection() {
        if (topCandidates == null || topCandidates.size() < 2) {
            return false;
        }
        // 如果 top1 和 top2 置信度差距小于 0.2，需要用户选择
        double gap = topCandidates.get(0).getConfidence() - topCandidates.get(1).getConfidence();
        return gap < 0.2;
    }
}
