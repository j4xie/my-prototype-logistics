package com.cretas.aims.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 查询特征
 *
 * 用于复杂度评估的特征提取结果。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QueryFeatures {

    // ========== 语言特征 ==========

    /**
     * 问句词数量 ("为什么"、"怎么样"、"如何" 等)
     */
    private int questionWordCount;

    /**
     * 是否包含比较指示词 ("对比"、"趋势"、"变化")
     */
    private boolean hasComparisonIndicator;

    /**
     * 是否包含时间范围 ("这周"、"上月"、"今天")
     */
    private boolean hasTimeRange;

    /**
     * 是否包含因果指示词 ("为什么"、"原因"、"导致")
     */
    private boolean hasCausalIndicator;

    // ========== 意图特征 ==========

    /**
     * 意图类别
     */
    private String intentCategory;

    /**
     * 需要的工具数量
     */
    private int requiredToolCount;

    /**
     * 是否为分析请求
     */
    private boolean isAnalysisRequest;

    // ========== 上下文特征 ==========

    /**
     * 对话深度 (第几轮)
     */
    private int conversationDepth;

    /**
     * 是否有前序上下文
     */
    private boolean hasPriorContext;
}
