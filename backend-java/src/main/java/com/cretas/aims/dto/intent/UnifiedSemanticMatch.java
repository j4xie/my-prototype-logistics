package com.cretas.aims.dto.intent;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 统一语义匹配结果 DTO
 *
 * 用于 Layer 4 统一语义搜索，合并:
 * - 意图配置 (AIIntentConfig) 的 embedding 匹配
 * - 已学习表达 (LearnedExpression) 的 embedding 匹配
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnifiedSemanticMatch {

    /**
     * 来源类型
     */
    private SourceType sourceType;

    /**
     * 匹配的代码 (intentCode 或 expressionId)
     */
    private String matchedCode;

    /**
     * 相似度分数 (0.0 - 1.0)
     */
    private double similarity;

    /**
     * 意图代码 (统一返回)
     * - INTENT: 直接返回 matchedCode
     * - EXPRESSION: 从表达获取关联的 intentCode
     */
    private String intentCode;

    /**
     * 匹配的原始文本 (用于调试)
     * - INTENT: 意图名称或描述
     * - EXPRESSION: 学习的表达原文
     */
    private String matchedText;

    /**
     * 命中次数 (用于排序优化)
     */
    @Builder.Default
    private int hitCount = 0;

    /**
     * 是否已验证
     */
    @Builder.Default
    private boolean verified = false;

    /**
     * 来源类型枚举
     */
    public enum SourceType {
        /**
         * 来自意图配置表 (ai_intent_configs)
         */
        INTENT,

        /**
         * 来自已学习表达表 (ai_learned_expressions)
         */
        EXPRESSION
    }

    /**
     * 创建意图配置匹配结果
     */
    public static UnifiedSemanticMatch fromIntent(String intentCode, double similarity, String intentName) {
        return UnifiedSemanticMatch.builder()
                .sourceType(SourceType.INTENT)
                .matchedCode(intentCode)
                .similarity(similarity)
                .intentCode(intentCode)
                .matchedText(intentName)
                .verified(true) // 意图配置默认已验证
                .build();
    }

    /**
     * 创建表达匹配结果
     */
    public static UnifiedSemanticMatch fromExpression(String expressionId, String intentCode,
                                                       double similarity, String expression,
                                                       int hitCount, boolean verified) {
        return UnifiedSemanticMatch.builder()
                .sourceType(SourceType.EXPRESSION)
                .matchedCode(expressionId)
                .similarity(similarity)
                .intentCode(intentCode)
                .matchedText(expression)
                .hitCount(hitCount)
                .verified(verified)
                .build();
    }

    /**
     * 比较两个匹配结果的优先级
     * 排序规则:
     * 1. 相似度高优先
     * 2. 相同相似度时，已验证优先
     * 3. 相同验证状态时，命中次数多优先
     * 4. 相同命中次数时，INTENT 优先于 EXPRESSION
     */
    public static int compare(UnifiedSemanticMatch a, UnifiedSemanticMatch b) {
        // 1. 相似度降序
        int cmp = Double.compare(b.similarity, a.similarity);
        if (cmp != 0) return cmp;

        // 2. 已验证优先
        cmp = Boolean.compare(b.verified, a.verified);
        if (cmp != 0) return cmp;

        // 3. 命中次数多优先
        cmp = Integer.compare(b.hitCount, a.hitCount);
        if (cmp != 0) return cmp;

        // 4. INTENT 优先于 EXPRESSION
        return a.sourceType.compareTo(b.sourceType);
    }
}
