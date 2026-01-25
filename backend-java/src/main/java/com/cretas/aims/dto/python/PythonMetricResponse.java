package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Python 指标计算响应 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonMetricResponse {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 错误消息 (失败时)
     */
    private String message;

    /**
     * 计算结果列表
     */
    private List<MetricResult> results;

    /**
     * 分组结果 (如果有分组)
     */
    private List<GroupedResult> groupedResults;

    /**
     * 时序结果 (如果有时间字段)
     */
    private List<TimeSeriesResult> timeSeriesResults;

    /**
     * 处理时间 (毫秒)
     */
    private Long processingTimeMs;

    /**
     * 指标计算结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MetricResult {

        /**
         * 指标名称
         */
        private String metricName;

        /**
         * 指标值
         */
        private Object value;

        /**
         * 格式化后的值
         */
        private String formattedValue;

        /**
         * 同比值 (如果计算)
         */
        private Double yoyValue;

        /**
         * 同比增长率
         */
        private Double yoyRate;

        /**
         * 环比值 (如果计算)
         */
        private Double momValue;

        /**
         * 环比增长率
         */
        private Double momRate;

        /**
         * 趋势方向 (up, down, stable)
         */
        private String trend;

        /**
         * 数据质量标记
         */
        private String qualityFlag;
    }

    /**
     * 分组结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GroupedResult {

        /**
         * 分组键值
         */
        private Map<String, Object> groupKey;

        /**
         * 分组名称 (可读)
         */
        private String groupLabel;

        /**
         * 该分组的指标结果
         */
        private List<MetricResult> metrics;

        /**
         * 该分组的记录数
         */
        private Integer recordCount;
    }

    /**
     * 时序结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimeSeriesResult {

        /**
         * 时间点
         */
        private String timePoint;

        /**
         * 时间标签 (可读格式)
         */
        private String timeLabel;

        /**
         * 该时间点的指标结果
         */
        private List<MetricResult> metrics;
    }
}
