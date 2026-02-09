package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 预测数据点 DTO
 *
 * 表示时间序列预测中的单个数据点，包含预测值和置信区间。
 * 置信区间用于表示预测的不确定性范围。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ForecastPoint {

    /**
     * 预测日期
     */
    private LocalDate date;

    /**
     * 预测值
     */
    private BigDecimal value;

    /**
     * 置信区间下界 (95% 置信区间)
     */
    private BigDecimal lowerBound;

    /**
     * 置信区间上界 (95% 置信区间)
     */
    private BigDecimal upperBound;

    /**
     * 是否为历史数据（用于对比展示）
     */
    private Boolean isHistorical;

    /**
     * 快速创建预测点
     */
    public static ForecastPoint of(LocalDate date, BigDecimal value, BigDecimal lowerBound, BigDecimal upperBound) {
        return ForecastPoint.builder()
                .date(date)
                .value(value)
                .lowerBound(lowerBound)
                .upperBound(upperBound)
                .isHistorical(false)
                .build();
    }

    /**
     * 快速创建历史数据点
     */
    public static ForecastPoint ofHistorical(LocalDate date, BigDecimal value) {
        return ForecastPoint.builder()
                .date(date)
                .value(value)
                .lowerBound(value)
                .upperBound(value)
                .isHistorical(true)
                .build();
    }
}
