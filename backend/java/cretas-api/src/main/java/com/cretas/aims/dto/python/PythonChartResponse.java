package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Python 图表构建响应 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonChartResponse {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 错误消息 (失败时)
     */
    private String message;

    /**
     * 图表配置 (ECharts/ChartJS/Highcharts 格式)
     * 可直接用于前端渲染
     */
    private Map<String, Object> chartConfig;

    /**
     * 图表类型
     */
    private String chartType;

    /**
     * 输出格式
     */
    private String outputFormat;

    /**
     * 数据摘要
     */
    private DataSummary dataSummary;

    /**
     * 图表建议
     */
    private ChartSuggestion suggestion;

    /**
     * 处理时间 (毫秒)
     */
    private Long processingTimeMs;

    /**
     * 数据摘要
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DataSummary {

        /**
         * 数据点数量
         */
        private Integer dataPointCount;

        /**
         * 系列数量
         */
        private Integer seriesCount;

        /**
         * 最大值
         */
        private Object maxValue;

        /**
         * 最小值
         */
        private Object minValue;

        /**
         * 总和 (如适用)
         */
        private Object totalSum;

        /**
         * 平均值 (如适用)
         */
        private Object average;
    }

    /**
     * 图表建议
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChartSuggestion {

        /**
         * 是否为最佳图表类型
         */
        private Boolean isOptimalType;

        /**
         * 推荐的替代图表类型
         */
        private String alternativeType;

        /**
         * 推荐原因
         */
        private String reason;

        /**
         * 数据展示建议
         */
        private String displaySuggestion;
    }
}
