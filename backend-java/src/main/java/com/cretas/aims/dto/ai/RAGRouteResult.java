package com.cretas.aims.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * RAG 路由结果
 *
 * Agentic RAG Router 的输出结果，用于指导后续的处理路径。
 * 包含咨询类型、建议意图、置信度等路由决策信息。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RAGRouteResult {

    /**
     * 检测到的咨询类型
     */
    private ConsultationType consultationType;

    /**
     * 建议的意图代码（对于 TRACEABILITY 类型）
     * 例如：TRACEABILITY_QUERY, MATERIAL_BATCH_QUERY
     */
    private String suggestedIntent;

    /**
     * 路由置信度 (0.0 - 1.0)
     */
    private double confidence;

    /**
     * 匹配的关键词列表
     */
    private List<String> matchedKeywords;

    /**
     * 路由理由/解释
     */
    private String routingReason;

    /**
     * 提取的参数（如追溯时的批次号、产品名等）
     */
    private Map<String, String> extractedParams;

    /**
     * 是否需要进一步澄清
     */
    private boolean needsClarification;

    /**
     * 澄清问题（如果需要）
     */
    private String clarificationQuestion;

    /**
     * 建议的搜索查询（对于 KNOWLEDGE_SEARCH 和 WEB_SEARCH）
     */
    private String suggestedSearchQuery;

    /**
     * 判断是否为高置信度路由
     *
     * @return 置信度 >= 0.7 时返回 true
     */
    public boolean isHighConfidence() {
        return confidence >= 0.7;
    }

    /**
     * 判断是否为中等置信度路由
     *
     * @return 置信度在 0.4-0.7 之间时返回 true
     */
    public boolean isMediumConfidence() {
        return confidence >= 0.4 && confidence < 0.7;
    }

    /**
     * 判断是否需要转换为业务意图
     *
     * @return TRACEABILITY 类型且有建议意图时返回 true
     */
    public boolean shouldConvertToIntent() {
        return consultationType == ConsultationType.TRACEABILITY
                && suggestedIntent != null
                && !suggestedIntent.isEmpty();
    }

    /**
     * 判断是否需要知识库检索
     *
     * @return KNOWLEDGE_SEARCH 类型时返回 true
     */
    public boolean needsKnowledgeSearch() {
        return consultationType == ConsultationType.KNOWLEDGE_SEARCH;
    }

    /**
     * 判断是否需要网络搜索
     *
     * @return WEB_SEARCH 类型时返回 true
     */
    public boolean needsWebSearch() {
        return consultationType == ConsultationType.WEB_SEARCH;
    }

    /**
     * 创建通用咨询类型的结果
     *
     * @param userInput 用户输入
     * @return 通用咨询类型的路由结果
     */
    public static RAGRouteResult general(String userInput) {
        return RAGRouteResult.builder()
                .consultationType(ConsultationType.GENERAL)
                .confidence(1.0)
                .routingReason("未匹配到特定咨询类型关键词，使用通用对话模式")
                .build();
    }
}
