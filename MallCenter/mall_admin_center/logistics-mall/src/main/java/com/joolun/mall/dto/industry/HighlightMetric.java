package com.joolun.mall.dto.industry;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 行业亮点指标
 * 如: 市场规模¥1280亿、年增长率+23%
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HighlightMetric {

    /**
     * 指标标签 (如: 市场规模、年增长率)
     */
    private String label;

    /**
     * 指标值 (如: ¥1280亿、+23%)
     */
    private String value;

    /**
     * 变化幅度 (如: +12%、-5%)
     */
    private String change;

    /**
     * 趋势方向: up/down/stable
     */
    private String trend;

    /**
     * 图标名称 (可选)
     */
    private String icon;
}
