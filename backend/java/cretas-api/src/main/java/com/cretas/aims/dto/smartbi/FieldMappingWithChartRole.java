package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * 包含图表角色的字段映射 DTO (扩展版)
 *
 * 继承自 {@link FieldMapping}，增加图表轴角色和优先级配置，
 * 用于智能自动生成图表配置。
 *
 * 继承的字段：
 * - fieldName (映射到 originalField)
 * - alias: 中文别名
 * - dataType: 数据类型
 * - metricType: 指标类型 (与 role 对应)
 * - aggregation: 聚合方式 (与 aggregationType 对应)
 * - confidence: 置信度
 *
 * 新增字段：
 * - standardField: 标准字段名
 * - role: 字段角色（更细粒度的 FieldRole 枚举）
 * - chartAxis: 图表轴角色
 * - axisPriority: 轴优先级
 * - uniqueValueCount: 唯一值数量
 * - reasoning: LLM 推理说明
 * - requiresConfirmation: 是否需要用户确认
 *
 * @author Cretas Team
 * @version 1.1.0
 * @since 2026-01-23
 * @see FieldMapping 基础字段映射类
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class FieldMappingWithChartRole extends FieldMapping {

    /**
     * 原始字段名（Excel/数据源中的列名）
     * 注意：此字段与父类的 fieldName 含义相同，保留用于向后兼容。
     * 新代码建议使用父类的 getFieldName()。
     */
    private String originalField;

    /**
     * 标准字段名（映射后的规范字段名）
     * 如: "channel", "sales_amount", "order_date"
     */
    private String standardField;

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
     * 注意：此字段与父类的 aggregation 含义相同，保留用于向后兼容。
     */
    private String aggregationType;

    /**
     * 作为X轴或系列时的优先级
     * 1 = 首选，数值越小优先级越高
     * 用于自动选择图表配置时的字段排序
     */
    private Integer axisPriority;

    /**
     * 唯一值数量（用于判断是否适合作为系列）
     */
    private Integer uniqueValueCount;

    /**
     * LLM 推理说明
     */
    private String reasoning;

    /**
     * 是否需要用户确认
     * 当置信度低于阈值时为 true
     */
    private Boolean requiresConfirmation;

    // ==================== 向后兼容方法 ====================

    /**
     * 获取原始字段名（兼容旧代码）
     * 优先返回 originalField，否则返回父类的 fieldName
     */
    public String getOriginalFieldOrFieldName() {
        return originalField != null ? originalField : getFieldName();
    }

    /**
     * 获取聚合类型（兼容旧代码）
     * 优先返回 aggregationType，否则返回父类的 aggregation
     */
    public String getAggregationTypeOrAggregation() {
        return aggregationType != null ? aggregationType : getAggregation();
    }

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
     * 覆盖父类方法，优先使用子类的置信度逻辑
     */
    @Override
    public boolean isHighConfidence() {
        return getConfidence() != null && getConfidence() >= 0.8;
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
        return "NUMBER".equalsIgnoreCase(getDataType());
    }

    /**
     * 判断是否为时间类型
     */
    public boolean isDateType() {
        return "DATE".equalsIgnoreCase(getDataType()) || role == FieldRole.TIME;
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
