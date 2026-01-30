package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Python 预测响应 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonForecastResponse {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 错误消息 (失败时)
     */
    private String message;

    /**
     * 预测点列表
     */
    private List<ForecastPoint> forecastPoints;

    /**
     * 使用的算法
     */
    private String algorithmUsed;

    /**
     * 模型质量指标
     */
    private ModelMetrics modelMetrics;

    /**
     * 趋势分析
     */
    private TrendAnalysis trendAnalysis;

    /**
     * 处理时间 (毫秒)
     */
    private Long processingTimeMs;

    /**
     * 预测点
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ForecastPoint {

        /**
         * 时间点
         */
        private String timePoint;

        /**
         * 时间标签 (可读格式)
         */
        private String timeLabel;

        /**
         * 预测值
         */
        private Double value;

        /**
         * 置信区间下限
         */
        private Double lowerBound;

        /**
         * 置信区间上限
         */
        private Double upperBound;

        /**
         * 是否为历史数据点 (用于对比)
         */
        @Builder.Default
        private Boolean isHistorical = false;

        /**
         * 与上一期的变化率
         */
        private Double changeRate;
    }

    /**
     * 模型质量指标
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ModelMetrics {

        /**
         * 平均绝对误差 (MAE)
         */
        private Double mae;

        /**
         * 均方误差 (MSE)
         */
        private Double mse;

        /**
         * 均方根误差 (RMSE)
         */
        private Double rmse;

        /**
         * 平均绝对百分比误差 (MAPE)
         */
        private Double mape;

        /**
         * R 平方 (决定系数)
         */
        private Double rSquared;

        /**
         * AIC (赤池信息准则)
         */
        private Double aic;

        /**
         * BIC (贝叶斯信息准则)
         */
        private Double bic;
    }

    /**
     * 趋势分析
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrendAnalysis {

        /**
         * 整体趋势 (increasing, decreasing, stable, fluctuating)
         */
        private String overallTrend;

        /**
         * 趋势强度 (0-1)
         */
        private Double trendStrength;

        /**
         * 是否检测到季节性
         */
        private Boolean hasSeasonality;

        /**
         * 季节性周期
         */
        private Integer seasonalPeriod;

        /**
         * 预测总变化率
         */
        private Double forecastedChangeRate;

        /**
         * 趋势置信度
         */
        private Double trendConfidence;

        /**
         * 趋势描述 (自然语言)
         */
        private String trendDescription;
    }
}
