package com.joolun.mall.dto.industry;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 竞争格局 - 企业排名
 * 如: Top5企业市场份额
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompetitorRank {

    /**
     * 排名
     */
    private Integer rank;

    /**
     * 企业名称
     */
    private String name;

    /**
     * 市场份额 (如: 18.5%)
     */
    private String share;

    /**
     * 份额数值 (用于排序和图表)
     */
    private Double shareValue;

    /**
     * 变化: up/down/stable
     */
    private String change;

    /**
     * 企业Logo URL (可选)
     */
    private String logoUrl;
}
