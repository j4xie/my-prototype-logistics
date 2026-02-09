package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 区域机会评分 DTO
 *
 * 用于评估区域市场机会，综合考虑增长率、基数、毛利率和渗透率四个维度。
 * 评分公式: totalScore = growthScore * 0.3 + baseScore * 0.25 + marginScore * 0.25 + penetrationScore * 0.2
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegionOpportunityScore {

    /**
     * 区域名称
     */
    private String region;

    /**
     * 综合评分 (0-100)
     */
    private BigDecimal totalScore;

    /**
     * 增长率评分 (0-100)
     * 评估区域销售增长潜力
     */
    private BigDecimal growthScore;

    /**
     * 基数评分 (0-100)
     * 评估区域现有销售规模
     */
    private BigDecimal baseScore;

    /**
     * 毛利率评分 (0-100)
     * 评估区域盈利能力
     */
    private BigDecimal marginScore;

    /**
     * 渗透率评分 (0-100)
     * 评估区域市场渗透程度
     */
    private BigDecimal penetrationScore;

    /**
     * AI 建议
     * 基于评分生成的智能分析建议
     */
    private String recommendation;

    /**
     * 机会等级: HIGH, MEDIUM, LOW
     */
    private String opportunityLevel;

    /**
     * 当前销售额
     */
    private BigDecimal currentSales;

    /**
     * 上期销售额
     */
    private BigDecimal previousSales;

    /**
     * 销售增长率
     */
    private BigDecimal growthRate;

    /**
     * 毛利率
     */
    private BigDecimal grossMargin;

    /**
     * 客户数量
     */
    private Integer customerCount;

    /**
     * 根据综合评分确定机会等级
     */
    public static String determineOpportunityLevel(BigDecimal totalScore) {
        if (totalScore == null) {
            return "LOW";
        }
        double score = totalScore.doubleValue();
        if (score >= 70) {
            return "HIGH";
        } else if (score >= 40) {
            return "MEDIUM";
        } else {
            return "LOW";
        }
    }

    /**
     * 快速创建区域机会评分
     */
    public static RegionOpportunityScore of(String region, BigDecimal growthScore, BigDecimal baseScore,
                                             BigDecimal marginScore, BigDecimal penetrationScore) {
        BigDecimal totalScore = calculateTotalScore(growthScore, baseScore, marginScore, penetrationScore);
        return RegionOpportunityScore.builder()
                .region(region)
                .growthScore(growthScore)
                .baseScore(baseScore)
                .marginScore(marginScore)
                .penetrationScore(penetrationScore)
                .totalScore(totalScore)
                .opportunityLevel(determineOpportunityLevel(totalScore))
                .build();
    }

    /**
     * 计算综合评分
     * 公式: totalScore = growthScore * 0.3 + baseScore * 0.25 + marginScore * 0.25 + penetrationScore * 0.2
     */
    public static BigDecimal calculateTotalScore(BigDecimal growthScore, BigDecimal baseScore,
                                                  BigDecimal marginScore, BigDecimal penetrationScore) {
        if (growthScore == null) growthScore = BigDecimal.ZERO;
        if (baseScore == null) baseScore = BigDecimal.ZERO;
        if (marginScore == null) marginScore = BigDecimal.ZERO;
        if (penetrationScore == null) penetrationScore = BigDecimal.ZERO;

        return growthScore.multiply(new BigDecimal("0.30"))
                .add(baseScore.multiply(new BigDecimal("0.25")))
                .add(marginScore.multiply(new BigDecimal("0.25")))
                .add(penetrationScore.multiply(new BigDecimal("0.20")));
    }
}
