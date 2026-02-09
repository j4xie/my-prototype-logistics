package com.cretas.aims.dto.rag;

import com.cretas.aims.service.RAGRetrievalService;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * RAG 候选结果 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RAGCandidateDTO implements RAGRetrievalService.RAGCandidate {

    /**
     * 用户输入
     */
    private String userInput;

    /**
     * 意图代码
     */
    private String intentCode;

    /**
     * 置信度 (0.0-1.0)
     */
    private double confidence;

    /**
     * 相似度 (0.0-1.0)
     */
    private double similarity;

    /**
     * 来源类型
     * LEARNED_EXPRESSION - 已学习表达
     * MATCH_RECORD - 历史匹配记录
     * USER_CONFIRMED - 用户确认记录
     */
    private String source;

    /**
     * 来源类型常量
     */
    public static final String SOURCE_LEARNED_EXPRESSION = "LEARNED_EXPRESSION";
    public static final String SOURCE_MATCH_RECORD = "MATCH_RECORD";
    public static final String SOURCE_USER_CONFIRMED = "USER_CONFIRMED";

    /**
     * 从 LearnedExpression 创建
     */
    public static RAGCandidateDTO fromLearnedExpression(
            String expression, String intentCode, double confidence, double similarity) {
        return RAGCandidateDTO.builder()
                .userInput(expression)
                .intentCode(intentCode)
                .confidence(confidence)
                .similarity(similarity)
                .source(SOURCE_LEARNED_EXPRESSION)
                .build();
    }

    /**
     * 从 IntentMatchRecord 创建
     */
    public static RAGCandidateDTO fromMatchRecord(
            String userInput, String intentCode, double confidence, double similarity, boolean userConfirmed) {
        return RAGCandidateDTO.builder()
                .userInput(userInput)
                .intentCode(intentCode)
                .confidence(confidence)
                .similarity(similarity)
                .source(userConfirmed ? SOURCE_USER_CONFIRMED : SOURCE_MATCH_RECORD)
                .build();
    }
}
