package com.joolun.mall.dto.industry;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * AI智能洞察项
 * 深度分析内容，如: 技术融合趋势、市场集中度分析
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InsightItem {

    /**
     * 洞察标题
     */
    private String title;

    /**
     * 洞察内容 (50-100字)
     */
    private String content;

    /**
     * 洞察类型: technology/market/policy/risk/opportunity
     */
    private String type;

    /**
     * 置信度 (0.0-1.0)
     */
    private Double confidence;

    /**
     * 重要性: critical/important/normal
     */
    private String importance;

    /**
     * 相关数据来源
     */
    private String source;
}
