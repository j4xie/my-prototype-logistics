package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * KPI 卡片 DTO
 *
 * 用于仪表盘中的 KPI 指标卡片展示，包括：
 * - 指标名称和当前值
 * - 变化趋势和变化率
 * - 状态和对比说明
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KPICard {

    /**
     * 指标唯一标识
     * 例如：SALES_AMOUNT, ORDER_COUNT, GROSS_MARGIN
     */
    private String key;

    /**
     * 指标标题
     * 用于前端展示，例如：销售额、订单数、毛利率
     */
    private String title;

    /**
     * 当前值（格式化后的字符串）
     * 例如："1,234,567.89"、"85.5%"、"128单"
     */
    private String value;

    /**
     * 原始数值
     * 用于计算和排序
     */
    private BigDecimal rawValue;

    /**
     * 单位
     * 例如：元、%、单、天、件
     */
    private String unit;

    /**
     * 变化值（绝对值）
     * 当前值 - 对比期值
     */
    private BigDecimal change;

    /**
     * 变化率（百分比）
     * ((当前值 - 对比期值) / 对比期值) * 100
     */
    private BigDecimal changeRate;

    /**
     * 趋势方向
     * up: 上升, down: 下降, flat: 持平
     */
    private String trend;

    /**
     * 状态颜色
     * green: 正常/良好, yellow: 需关注, red: 预警/异常
     */
    @Builder.Default
    private String status = "green";

    /**
     * 对比文本
     * 说明对比的时间段，例如："较上月"、"较去年同期"、"较上周"
     */
    private String compareText;

    /**
     * 指标描述
     * 对指标的简要说明
     */
    private String description;

    /**
     * 目标值（可选）
     * 如果有目标值，可用于显示完成进度
     */
    private BigDecimal targetValue;

    /**
     * 目标完成率（可选）
     * (rawValue / targetValue) * 100
     */
    private BigDecimal completionRate;

    /**
     * 快速创建 KPI 卡片
     */
    public static KPICard of(String key, String title, BigDecimal rawValue, String unit) {
        return KPICard.builder()
                .key(key)
                .title(title)
                .rawValue(rawValue)
                .value(formatValue(rawValue, unit))
                .unit(unit)
                .status("green")
                .build();
    }

    /**
     * 创建带趋势的 KPI 卡片
     */
    public static KPICard withTrend(String key, String title, BigDecimal rawValue, String unit,
                                     BigDecimal previousValue, String compareText) {
        BigDecimal change = rawValue.subtract(previousValue);
        BigDecimal changeRate = BigDecimal.ZERO;
        String trend = "flat";

        if (previousValue.compareTo(BigDecimal.ZERO) != 0) {
            changeRate = change.multiply(BigDecimal.valueOf(100))
                    .divide(previousValue.abs(), 2, RoundingMode.HALF_UP);
        }

        if (change.compareTo(BigDecimal.ZERO) > 0) {
            trend = "up";
        } else if (change.compareTo(BigDecimal.ZERO) < 0) {
            trend = "down";
        }

        return KPICard.builder()
                .key(key)
                .title(title)
                .rawValue(rawValue)
                .value(formatValue(rawValue, unit))
                .unit(unit)
                .change(change)
                .changeRate(changeRate)
                .trend(trend)
                .compareText(compareText)
                .status(determineStatus(changeRate, key))
                .build();
    }

    /**
     * 创建带目标的 KPI 卡片
     */
    public static KPICard withTarget(String key, String title, BigDecimal rawValue, String unit,
                                      BigDecimal targetValue, String compareText) {
        BigDecimal completionRate = BigDecimal.ZERO;
        String status = "green";

        if (targetValue != null && targetValue.compareTo(BigDecimal.ZERO) > 0) {
            completionRate = rawValue.multiply(BigDecimal.valueOf(100))
                    .divide(targetValue, 2, RoundingMode.HALF_UP);

            if (completionRate.compareTo(BigDecimal.valueOf(80)) < 0) {
                status = "red";
            } else if (completionRate.compareTo(BigDecimal.valueOf(100)) < 0) {
                status = "yellow";
            }
        }

        return KPICard.builder()
                .key(key)
                .title(title)
                .rawValue(rawValue)
                .value(formatValue(rawValue, unit))
                .unit(unit)
                .targetValue(targetValue)
                .completionRate(completionRate)
                .compareText(compareText)
                .status(status)
                .build();
    }

    /**
     * 格式化数值
     */
    private static String formatValue(BigDecimal value, String unit) {
        if (value == null) {
            return "-";
        }

        if ("%".equals(unit)) {
            return value.setScale(1, RoundingMode.HALF_UP).toString() + "%";
        }

        // 大数值处理
        if (value.abs().compareTo(BigDecimal.valueOf(100000000)) >= 0) {
            return value.divide(BigDecimal.valueOf(100000000), 2, RoundingMode.HALF_UP) + "亿";
        } else if (value.abs().compareTo(BigDecimal.valueOf(10000)) >= 0) {
            return value.divide(BigDecimal.valueOf(10000), 2, RoundingMode.HALF_UP) + "万";
        }

        return value.setScale(2, RoundingMode.HALF_UP).toString();
    }

    /**
     * 根据变化率和指标类型确定状态
     */
    private static String determineStatus(BigDecimal changeRate, String key) {
        if (changeRate == null) {
            return "green";
        }

        // 成本类指标，下降是好的
        boolean isCostMetric = key != null &&
                (key.contains("COST") || key.contains("EXPENSE") || key.contains("RECEIVABLE"));

        if (isCostMetric) {
            if (changeRate.compareTo(BigDecimal.valueOf(10)) > 0) {
                return "red";
            } else if (changeRate.compareTo(BigDecimal.valueOf(5)) > 0) {
                return "yellow";
            }
        } else {
            // 收入类指标，增长是好的
            if (changeRate.compareTo(BigDecimal.valueOf(-10)) < 0) {
                return "red";
            } else if (changeRate.compareTo(BigDecimal.valueOf(-5)) < 0) {
                return "yellow";
            }
        }

        return "green";
    }
}
