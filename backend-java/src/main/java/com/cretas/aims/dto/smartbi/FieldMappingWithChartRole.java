package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 包含图表角色的字段映射 DTO
 *
 * 由 LLM 推断字段的语义映射及其在图表中的角色，用于智能自动生成图表配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FieldMappingWithChartRole {

    /**
     * 原始字段名（Excel/数据源中的列名）
     */
    private String originalField;

    /**
     * 标准字段名（映射后的规范字段名）
     * 如: "channel", "sales_amount", "order_date"
     */
    private String standardField;

    /**
     * 字段中文别名
     */
    private String alias;

    /**
     * 字段角色
     * - DIMENSION: 维度（分类/分组依据）
     * - METRIC: 度量（可聚合的数值）
     * - TIME: 时间维度
     * - IDENTIFIER: 标识符（ID类字段，通常不展示）
     */
    private FieldRole role;

    /**
     * 图表轴角色
     * - X_AXIS: X轴（通常是时间或分类）
     * - SERIES: 系列（用于分组，如按渠道分色）
     * - Y_AXIS: Y轴（数值，被聚合）
     * - NONE: 不参与图表展示
     */
    private ChartAxisRole chartAxis;

    /**
     * 聚合类型
     * - GROUP_BY: 分组（用于维度）
     * - SUM: 求和
     * - AVG: 平均值
     * - COUNT: 计数
     * - MAX: 最大值
     * - MIN: 最小值
     * - COUNT_DISTINCT: 去重计数
     */
    private String aggregationType;

    /**
     * 作为X轴或系列时的优先级
     * 1 = 首选，数值越小优先级越高
     * 用于自动选择图表配置时的字段排序
     */
    private Integer axisPriority;

    /**
     * 数据类型
     * - NUMBER: 数值
     * - STRING: 字符串
     * - DATE: 日期
     * - BOOLEAN: 布尔
     */
    private String dataType;

    /**
     * 唯一值数量（用于判断是否适合作为系列）
     */
    private Integer uniqueValueCount;

    /**
     * LLM 推断置信度 (0.0 - 1.0)
     */
    private Double confidence;

    /**
     * LLM 推理说明
     */
    private String reasoning;

    /**
     * 是否需要用户确认
     * 当置信度低于阈值时为 true
     */
    private Boolean requiresConfirmation;

    /**
     * 字段角色枚举
     */
    public enum FieldRole {
        DIMENSION("DIMENSION"),
        METRIC("METRIC"),
        TIME("TIME"),
        IDENTIFIER("IDENTIFIER");

        private final String value;

        FieldRole(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }

        public static FieldRole fromString(String text) {
            for (FieldRole role : FieldRole.values()) {
                if (role.value.equalsIgnoreCase(text)) {
                    return role;
                }
            }
            return DIMENSION; // 默认为维度
        }
    }

    /**
     * 图表轴角色枚举
     */
    public enum ChartAxisRole {
        X_AXIS("X_AXIS"),
        SERIES("SERIES"),
        Y_AXIS("Y_AXIS"),
        NONE("NONE");

        private final String value;

        ChartAxisRole(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }

        public static ChartAxisRole fromString(String text) {
            for (ChartAxisRole role : ChartAxisRole.values()) {
                if (role.value.equalsIgnoreCase(text)) {
                    return role;
                }
            }
            return NONE; // 默认不参与
        }
    }

    /**
     * 判断是否为高置信度映射
     */
    public boolean isHighConfidence() {
        return confidence != null && confidence >= 0.8;
    }

    /**
     * 判断是否适合作为图表系列（唯一值数量在合理范围内）
     */
    public boolean isSuitableForSeries() {
        return uniqueValueCount != null && uniqueValueCount >= 2 && uniqueValueCount <= 10;
    }

    /**
     * 判断是否为数值类型
     */
    public boolean isNumeric() {
        return "NUMBER".equalsIgnoreCase(dataType);
    }

    /**
     * 判断是否为时间类型
     */
    public boolean isDateType() {
        return "DATE".equalsIgnoreCase(dataType) || role == FieldRole.TIME;
    }

    /**
     * 创建时间字段映射
     */
    public static FieldMappingWithChartRole createTimeField(String originalField, String standardField,
                                                             String alias, double confidence) {
        return FieldMappingWithChartRole.builder()
                .originalField(originalField)
                .standardField(standardField)
                .alias(alias)
                .role(FieldRole.TIME)
                .chartAxis(ChartAxisRole.X_AXIS)
                .aggregationType("GROUP_BY")
                .axisPriority(1)
                .dataType("DATE")
                .confidence(confidence)
                .requiresConfirmation(confidence < 0.7)
                .build();
    }

    /**
     * 创建维度字段映射
     */
    public static FieldMappingWithChartRole createDimensionField(String originalField, String standardField,
                                                                  String alias, int uniqueValueCount,
                                                                  double confidence) {
        ChartAxisRole axisRole;
        int priority;

        if (uniqueValueCount >= 2 && uniqueValueCount <= 10) {
            axisRole = ChartAxisRole.SERIES;
            priority = 1;
        } else if (uniqueValueCount > 10) {
            axisRole = ChartAxisRole.X_AXIS;
            priority = 2;
        } else {
            axisRole = ChartAxisRole.NONE;
            priority = 99;
        }

        return FieldMappingWithChartRole.builder()
                .originalField(originalField)
                .standardField(standardField)
                .alias(alias)
                .role(FieldRole.DIMENSION)
                .chartAxis(axisRole)
                .aggregationType("GROUP_BY")
                .axisPriority(priority)
                .dataType("STRING")
                .uniqueValueCount(uniqueValueCount)
                .confidence(confidence)
                .requiresConfirmation(confidence < 0.7)
                .build();
    }

    /**
     * 创建度量字段映射
     */
    public static FieldMappingWithChartRole createMetricField(String originalField, String standardField,
                                                               String alias, String aggregationType,
                                                               double confidence) {
        return FieldMappingWithChartRole.builder()
                .originalField(originalField)
                .standardField(standardField)
                .alias(alias)
                .role(FieldRole.METRIC)
                .chartAxis(ChartAxisRole.Y_AXIS)
                .aggregationType(aggregationType != null ? aggregationType : "SUM")
                .axisPriority(1)
                .dataType("NUMBER")
                .confidence(confidence)
                .requiresConfirmation(confidence < 0.7)
                .build();
    }
}
