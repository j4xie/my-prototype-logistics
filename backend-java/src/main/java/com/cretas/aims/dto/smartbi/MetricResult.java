package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 指标计算结果 DTO
 *
 * 用于封装 SmartBI 系统中各类指标的计算结果，包含指标值、格式化值、预警级别等信息。
 * 支持销售、利润、应收、预算等多种业务指标的统一表示。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MetricResult {

    /**
     * 指标代码
     * 例如: SALES_AMOUNT, GROSS_MARGIN, TARGET_COMPLETION
     */
    private String metricCode;

    /**
     * 指标名称
     * 例如: 销售额, 毛利率, 目标完成率
     */
    private String metricName;

    /**
     * 指标值 (精确数值)
     * 使用 BigDecimal 确保计算精度
     */
    private BigDecimal value;

    /**
     * 格式化后的显示值
     * 例如: "1,234,567.89", "85.5%", "128单"
     */
    private String formattedValue;

    /**
     * 单位
     * 例如: 元, %, 单, 天
     */
    private String unit;

    /**
     * 变化百分比
     * 用于同比/环比变化率
     */
    private BigDecimal changePercent;

    /**
     * 变化方向: UP, DOWN, STABLE
     */
    private String changeDirection;

    /**
     * 变化值 (绝对值变化)
     * 当前值 - 上期值
     */
    private BigDecimal changeValue;

    /**
     * 预警级别
     * GREEN - 正常
     * YELLOW - 关注
     * RED - 严重
     */
    private String alertLevel;

    /**
     * 分组维度值 (可选)
     * 当按维度计算时，存储维度的具体值
     * 例如: 部门名称、区域名称、销售员姓名
     */
    private String dimensionValue;

    /**
     * 指标说明 (可选)
     * 对指标含义的简要描述
     */
    private String description;

    /**
     * 预警级别枚举
     */
    public enum AlertLevel {
        /**
         * 绿色 - 正常
         */
        GREEN("正常"),

        /**
         * 黄色 - 需关注
         */
        YELLOW("关注"),

        /**
         * 红色 - 严重预警
         */
        RED("严重");

        private final String description;

        AlertLevel(String description) {
            this.description = description;
        }

        public String getDescription() {
            return description;
        }
    }

    /**
     * 快速创建一个简单指标结果
     */
    public static MetricResult of(String metricCode, String metricName, BigDecimal value, String unit) {
        return MetricResult.builder()
                .metricCode(metricCode)
                .metricName(metricName)
                .value(value)
                .unit(unit)
                .alertLevel(AlertLevel.GREEN.name())
                .build();
    }

    /**
     * 快速创建带预警级别的指标结果
     */
    public static MetricResult of(String metricCode, String metricName, BigDecimal value, String unit, AlertLevel alertLevel) {
        return MetricResult.builder()
                .metricCode(metricCode)
                .metricName(metricName)
                .value(value)
                .unit(unit)
                .alertLevel(alertLevel.name())
                .build();
    }

    /**
     * 快速创建带变化趋势的指标结果
     */
    public static MetricResult ofWithTrend(String metricCode, String metricName, BigDecimal value, String unit,
                                           BigDecimal changePercent, String changeDirection) {
        return MetricResult.builder()
                .metricCode(metricCode)
                .metricName(metricName)
                .value(value)
                .unit(unit)
                .changePercent(changePercent)
                .changeDirection(changeDirection)
                .alertLevel(AlertLevel.GREEN.name())
                .build();
    }
}
