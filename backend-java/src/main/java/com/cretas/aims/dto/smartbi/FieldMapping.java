package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * LLM 推断的字段映射 DTO
 * 表示由 LLM 推断的字段语义映射信息，用于智能 BI 分析
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FieldMapping {

    /**
     * 字段名称
     * 数据源中的原始字段名
     */
    private String fieldName;

    /**
     * 字段别名（中文名称）
     * LLM 推断的语义化中文名称
     */
    private String alias;

    /**
     * 数据类型
     * 可选值：NUMBER, STRING, DATE, BOOLEAN
     */
    private String dataType;

    /**
     * 指标类型
     * - MEASURE: 度量（可聚合的数值）
     * - DIMENSION: 维度（分类/分组依据）
     * - TIME: 时间维度
     */
    private String metricType;

    /**
     * 推荐聚合方式
     * 仅当 metricType 为 MEASURE 时有效
     * 可选值：SUM, AVG, COUNT, MAX, MIN, COUNT_DISTINCT
     */
    private String aggregation;

    /**
     * 推荐图表类型列表
     * 根据字段特性推荐适合的可视化方式
     * 如：["line", "bar", "pie", "scatter"]
     */
    private List<String> suggestedChartTypes;

    /**
     * 字段描述
     * LLM 生成的字段用途说明
     */
    private String description;

    /**
     * LLM 推断置信度
     * 0.0 - 1.0，表示推断结果的可信程度
     */
    private double confidence;

    /**
     * 数据类型枚举
     */
    public enum DataType {
        NUMBER("NUMBER"),
        STRING("STRING"),
        DATE("DATE"),
        BOOLEAN("BOOLEAN");

        private final String value;

        DataType(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * 指标类型枚举
     */
    public enum MetricType {
        MEASURE("MEASURE"),
        DIMENSION("DIMENSION"),
        TIME("TIME");

        private final String value;

        MetricType(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * 聚合方式枚举
     */
    public enum Aggregation {
        SUM("SUM"),
        AVG("AVG"),
        COUNT("COUNT"),
        MAX("MAX"),
        MIN("MIN"),
        COUNT_DISTINCT("COUNT_DISTINCT");

        private final String value;

        Aggregation(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * 创建度量字段映射
     */
    public static FieldMapping createMeasure(String fieldName, String alias, String aggregation,
                                              List<String> chartTypes, double confidence) {
        return FieldMapping.builder()
                .fieldName(fieldName)
                .alias(alias)
                .dataType(DataType.NUMBER.getValue())
                .metricType(MetricType.MEASURE.getValue())
                .aggregation(aggregation)
                .suggestedChartTypes(chartTypes)
                .confidence(confidence)
                .build();
    }

    /**
     * 创建维度字段映射
     */
    public static FieldMapping createDimension(String fieldName, String alias, String dataType,
                                                List<String> chartTypes, double confidence) {
        return FieldMapping.builder()
                .fieldName(fieldName)
                .alias(alias)
                .dataType(dataType)
                .metricType(MetricType.DIMENSION.getValue())
                .suggestedChartTypes(chartTypes)
                .confidence(confidence)
                .build();
    }

    /**
     * 创建时间维度字段映射
     */
    public static FieldMapping createTimeDimension(String fieldName, String alias, double confidence) {
        return FieldMapping.builder()
                .fieldName(fieldName)
                .alias(alias)
                .dataType(DataType.DATE.getValue())
                .metricType(MetricType.TIME.getValue())
                .suggestedChartTypes(List.of("line", "area", "bar"))
                .confidence(confidence)
                .build();
    }

    /**
     * 判断是否为高置信度映射
     */
    public boolean isHighConfidence() {
        return confidence >= 0.8;
    }

    /**
     * 判断是否需要用户确认
     */
    public boolean requiresConfirmation() {
        return confidence < 0.7;
    }
}
