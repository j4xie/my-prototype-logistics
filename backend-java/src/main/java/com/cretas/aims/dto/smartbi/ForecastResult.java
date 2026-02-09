package com.cretas.aims.dto.smartbi;

import com.cretas.aims.entity.smartbi.enums.ForecastAlgorithm;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 预测结果 DTO
 *
 * 封装 SmartBI 预测服务的完整预测结果，包含预测点序列、
 * 算法信息、置信度和元数据。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ForecastResult {

    /**
     * 预测数据点列表
     * 包含历史数据点（用于对比）和预测数据点
     */
    private List<ForecastPoint> forecastPoints;

    /**
     * 使用的预测算法
     */
    private ForecastAlgorithm algorithm;

    /**
     * 预测置信度 (0-100%)
     * 基于历史数据拟合度和数据质量计算
     */
    private BigDecimal confidence;

    /**
     * 指标类型
     * 例如: SALES_AMOUNT, ORDER_COUNT
     */
    private String metricType;

    /**
     * 时间周期描述
     * 例如: "2026-01-01 至 2026-01-31"
     */
    private String periodDescription;

    /**
     * 预测说明
     * 对预测结果的简要解释
     */
    private String description;

    /**
     * 历史数据点数量
     */
    private Integer historicalPointCount;

    /**
     * 预测数据点数量
     */
    private Integer forecastPointCount;

    /**
     * 预测生成时间
     */
    private LocalDateTime generatedAt;

    /**
     * 预测趋势: UP, DOWN, STABLE
     */
    private String trend;

    /**
     * 预测增长率 (%)
     * 预测期末值相对于历史期末值的增长率
     */
    private BigDecimal growthRate;

    /**
     * 快速创建预测结果
     */
    public static ForecastResult of(List<ForecastPoint> forecastPoints,
                                     ForecastAlgorithm algorithm,
                                     BigDecimal confidence,
                                     String metricType,
                                     String periodDescription) {
        long historicalCount = forecastPoints.stream()
                .filter(p -> Boolean.TRUE.equals(p.getIsHistorical()))
                .count();
        long forecastCount = forecastPoints.size() - historicalCount;

        return ForecastResult.builder()
                .forecastPoints(forecastPoints)
                .algorithm(algorithm)
                .confidence(confidence)
                .metricType(metricType)
                .periodDescription(periodDescription)
                .historicalPointCount((int) historicalCount)
                .forecastPointCount((int) forecastCount)
                .generatedAt(LocalDateTime.now())
                .build();
    }
}
