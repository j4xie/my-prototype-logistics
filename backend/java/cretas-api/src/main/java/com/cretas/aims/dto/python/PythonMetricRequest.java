package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Python 指标计算请求 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonMetricRequest {

    /**
     * 数据列表
     */
    private List<Map<String, Object>> data;

    /**
     * 字段映射 (原始字段 -> 标准字段)
     */
    private Map<String, String> fieldMappings;

    /**
     * 要计算的指标列表
     */
    private List<MetricDefinition> metrics;

    /**
     * 分组字段 (用于分组聚合)
     */
    private List<String> groupByFields;

    /**
     * 时间字段 (用于时序分析)
     */
    private String timeField;

    /**
     * 时间粒度 (day, week, month, quarter, year)
     */
    private String timeGranularity;

    /**
     * 是否计算同比
     */
    @Builder.Default
    private Boolean calculateYoY = false;

    /**
     * 是否计算环比
     */
    @Builder.Default
    private Boolean calculateMoM = false;

    /**
     * 指标定义
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MetricDefinition {

        /**
         * 指标名称
         */
        private String name;

        /**
         * 指标类型 (sum, avg, count, max, min, ratio, formula)
         */
        private String type;

        /**
         * 计算字段
         */
        private String field;

        /**
         * 计算公式 (type=formula 时使用)
         */
        private String formula;

        /**
         * 过滤条件
         */
        private Map<String, Object> filters;

        /**
         * 格式化类型 (number, currency, percentage)
         */
        private String formatType;

        /**
         * 小数位数
         */
        @Builder.Default
        private Integer decimalPlaces = 2;
    }
}
