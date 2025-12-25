package com.joolun.mall.dto.industry;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 市场机会卡片
 * 如: 中小企业转型、跨境溯源、政策红利
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OpportunityCard {

    /**
     * 机会标题
     */
    private String title;

    /**
     * 机会描述
     */
    private String description;

    /**
     * 潜力评级: high/medium/low
     */
    private String potential;

    /**
     * 潜力分数 (0-100)
     */
    private Integer potentialScore;

    /**
     * 图标名称
     */
    private String icon;

    /**
     * 渐变色起始色 (CSS颜色值)
     */
    private String gradientStart;

    /**
     * 渐变色结束色 (CSS颜色值)
     */
    private String gradientEnd;

    /**
     * 相关标签
     */
    private String[] tags;
}
