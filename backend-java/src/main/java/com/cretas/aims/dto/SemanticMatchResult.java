package com.cretas.aims.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 语义匹配结果
 *
 * 用于返回语义相似度匹配的结果，包含意图代码、相似度分数和匹配到的原始短语。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SemanticMatchResult {

    /**
     * 匹配到的意图代码
     */
    private String intentCode;

    /**
     * 相似度分数 (0.0 - 1.0)
     */
    private double similarity;

    /**
     * 匹配到的原始短语（知识库中的短语）
     */
    private String matchedPhrase;

    /**
     * 是否成功匹配（相似度超过阈值）
     */
    private boolean matched;

    /**
     * 匹配耗时（毫秒）
     */
    private long matchTimeMs;

    /**
     * 匹配来源（用于调试）
     * - EXACT: 精确匹配
     * - SEMANTIC: 语义相似度匹配
     * - FALLBACK: 降级匹配
     */
    private String matchSource;

    /**
     * 创建一个未匹配的结果
     */
    public static SemanticMatchResult noMatch() {
        return SemanticMatchResult.builder()
                .matched(false)
                .similarity(0.0)
                .matchSource("NO_MATCH")
                .build();
    }

    /**
     * 创建一个语义匹配成功的结果
     */
    public static SemanticMatchResult semanticMatch(String intentCode, double similarity,
                                                     String matchedPhrase, long matchTimeMs) {
        return SemanticMatchResult.builder()
                .intentCode(intentCode)
                .similarity(similarity)
                .matchedPhrase(matchedPhrase)
                .matched(true)
                .matchTimeMs(matchTimeMs)
                .matchSource("SEMANTIC")
                .build();
    }

    /**
     * 创建一个精确匹配的结果
     */
    public static SemanticMatchResult exactMatch(String intentCode, String matchedPhrase) {
        return SemanticMatchResult.builder()
                .intentCode(intentCode)
                .similarity(1.0)
                .matchedPhrase(matchedPhrase)
                .matched(true)
                .matchTimeMs(0)
                .matchSource("EXACT")
                .build();
    }
}
