package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Python AI 洞察生成请求 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonInsightRequest {

    /**
     * 分析数据
     */
    private Map<String, Object> analysisData;

    /**
     * 指标结果
     */
    private List<MetricSummary> metrics;

    /**
     * 数据类型 (finance, sales, production, etc.)
     */
    private String dataType;

    /**
     * 分析维度 (time, region, department, product)
     */
    private String analysisDimension;

    /**
     * 时间范围
     */
    private TimeRange timeRange;

    /**
     * 对比基准 (yoy, mom, budget, target)
     */
    private String comparisonBase;

    /**
     * 语言 (zh, en)
     */
    @Builder.Default
    private String language = "zh";

    /**
     * 洞察类型 (summary, trend, anomaly, recommendation, all)
     */
    @Builder.Default
    private String insightType = "all";

    /**
     * 最大洞察条数
     */
    @Builder.Default
    private Integer maxInsights = 5;

    /**
     * 指标摘要
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MetricSummary {

        /**
         * 指标名称
         */
        private String name;

        /**
         * 指标值
         */
        private Object value;

        /**
         * 同比变化
         */
        private Double yoyChange;

        /**
         * 环比变化
         */
        private Double momChange;

        /**
         * 趋势
         */
        private String trend;

        /**
         * 是否异常
         */
        private Boolean isAnomaly;
    }

    /**
     * 时间范围
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimeRange {

        /**
         * 开始日期
         */
        private String startDate;

        /**
         * 结束日期
         */
        private String endDate;

        /**
         * 时间粒度
         */
        private String granularity;
    }
}
