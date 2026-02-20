package com.cretas.aims.dto.aps;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * APS策略权重调整结果 DTO
 *
 * 记录权重调整的完整结果，包括：
 * - 调整前后的权重对比
 * - 各策略的性能评分
 * - 调整原因和时间
 *
 * @author Cretas APS Team
 * @since 2026-01-21
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WeightAdjustmentResult {

    /**
     * 调整时间
     */
    private LocalDateTime adjustedAt;

    /**
     * 调整前的策略权重
     * key: 策略名称 (earliest_deadline, min_changeover, etc.)
     * value: 权重值 (0.0 - 1.0)
     */
    private Map<String, Double> previousWeights;

    /**
     * 调整后的新权重
     */
    private Map<String, Double> newWeights;

    /**
     * 各策略的性能评分
     * key: 策略名称
     * value: 评分 (0.0 - 1.0, 0.5为基准)
     */
    private Map<String, Double> performanceScores;

    /**
     * 调整原因
     */
    private String reason;

    /**
     * 工厂ID
     */
    private String factoryId;

    /**
     * 评估周期开始日期
     */
    private java.time.LocalDate evaluationStartDate;

    /**
     * 评估周期结束日期
     */
    private java.time.LocalDate evaluationEndDate;

    /**
     * 是否应用了调整
     * 如果评分变化太小，可能不会实际调整
     */
    private boolean applied;

    /**
     * 调整详情
     * key: 策略名称
     * value: 调整详情 (包含分数、调整量等)
     */
    private Map<String, AdjustmentDetail> adjustmentDetails;

    /**
     * 单个策略的调整详情
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AdjustmentDetail {
        /**
         * 策略名称
         */
        private String strategyName;

        /**
         * 调整前权重
         */
        private double previousWeight;

        /**
         * 调整后权重
         */
        private double newWeight;

        /**
         * 效果评分
         */
        private double score;

        /**
         * 调整量 (newWeight - previousWeight)
         */
        private double adjustmentDelta;

        /**
         * 调整原因描述
         */
        private String adjustmentReason;
    }

    /**
     * 创建简单结果的工厂方法
     */
    public static WeightAdjustmentResult create(
            String factoryId,
            Map<String, Double> previousWeights,
            Map<String, Double> newWeights,
            Map<String, Double> performanceScores) {

        return WeightAdjustmentResult.builder()
                .adjustedAt(LocalDateTime.now())
                .factoryId(factoryId)
                .previousWeights(previousWeights)
                .newWeights(newWeights)
                .performanceScores(performanceScores)
                .applied(true)
                .build();
    }
}
