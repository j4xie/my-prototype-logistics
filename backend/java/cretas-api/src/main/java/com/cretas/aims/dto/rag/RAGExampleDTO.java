package com.cretas.aims.dto.rag;

import com.cretas.aims.service.RAGRetrievalService;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * RAG Few-Shot 示例 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RAGExampleDTO implements RAGRetrievalService.RAGExample {

    /**
     * 用户输入
     */
    private String userInput;

    /**
     * 意图代码
     */
    private String intentCode;

    /**
     * 意图名称
     */
    private String intentName;

    /**
     * 相似度 (用于排序，不暴露给接口)
     */
    private double similarity;

    /**
     * 是否已验证
     */
    private boolean verified;

    /**
     * 创建 Few-Shot 示例
     */
    public static RAGExampleDTO create(String userInput, String intentCode, String intentName,
                                        double similarity, boolean verified) {
        return RAGExampleDTO.builder()
                .userInput(userInput)
                .intentCode(intentCode)
                .intentName(intentName)
                .similarity(similarity)
                .verified(verified)
                .build();
    }
}
