package com.cretas.aims.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * 分析结果
 *
 * 包含分析服务的执行结果。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalysisResult {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 格式化的分析文本
     */
    private String formattedAnalysis;

    /**
     * 数据摘要 (结构化数据)
     */
    private Map<String, Object> dataSummary;

    /**
     * 分析主题
     */
    private AnalysisTopic topic;

    /**
     * 使用的工具列表
     */
    private java.util.List<String> toolsUsed;

    /**
     * 错误信息 (如果失败)
     */
    private String errorMessage;

    /**
     * 是否需要人工审核
     */
    private boolean requiresHumanReview;

    /**
     * 标记需要人工审核
     */
    public AnalysisResult markForHumanReview() {
        this.requiresHumanReview = true;
        return this;
    }
}
