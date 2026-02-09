package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Python 图表角色推荐响应 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonChartConfigResponse {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 错误消息 (失败时)
     */
    private String message;

    /**
     * 推荐的图表配置列表
     */
    private List<ChartRecommendation> recommendations;

    /**
     * 字段角色分配
     */
    private Map<String, FieldRoleAssignment> fieldRoles;

    /**
     * 处理时间 (毫秒)
     */
    private Long processingTimeMs;

    /**
     * 图表推荐
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChartRecommendation {

        /**
         * 图表类型
         */
        private String chartType;

        /**
         * 图表类型名称 (中文)
         */
        private String chartTypeName;

        /**
         * 推荐度 (0-1)
         */
        private Double score;

        /**
         * 推荐原因
         */
        private String reason;

        /**
         * 是否为首选
         */
        @Builder.Default
        private Boolean isPrimary = false;

        /**
         * 适用场景
         */
        private List<String> suitableFor;

        /**
         * 限制条件
         */
        private List<String> limitations;

        /**
         * 建议配置
         */
        private SuggestedConfig suggestedConfig;
    }

    /**
     * 字段角色分配
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FieldRoleAssignment {

        /**
         * 字段名称
         */
        private String fieldName;

        /**
         * 分配的角色 (dimension, metric, time, series, filter)
         */
        private String role;

        /**
         * 角色置信度
         */
        private Double confidence;

        /**
         * 备选角色
         */
        private List<String> alternativeRoles;

        /**
         * 推荐的聚合方式 (sum, avg, count, max, min)
         */
        private String suggestedAggregation;

        /**
         * 推荐的格式化方式
         */
        private String suggestedFormat;
    }

    /**
     * 建议配置
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SuggestedConfig {

        /**
         * 维度字段
         */
        private String dimensionField;

        /**
         * 指标字段列表
         */
        private List<String> metricFields;

        /**
         * 系列字段
         */
        private String seriesField;

        /**
         * 时间字段
         */
        private String timeField;

        /**
         * 是否堆叠
         */
        @Builder.Default
        private Boolean stacked = false;

        /**
         * 是否显示数据标签
         */
        @Builder.Default
        private Boolean showDataLabels = true;

        /**
         * 排序方式 (asc, desc, none)
         */
        private String sortOrder;

        /**
         * 最大显示数量 (用于限制类别数)
         */
        private Integer maxCategories;
    }
}
