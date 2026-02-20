package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Python 图表构建请求 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonChartRequest {

    /**
     * 图表类型
     * - bar: 柱状图
     * - line: 折线图
     * - pie: 饼图
     * - area: 面积图
     * - scatter: 散点图
     * - radar: 雷达图
     * - heatmap: 热力图
     * - treemap: 矩形树图
     * - waterfall: 瀑布图
     * - combo: 组合图
     * - kpi: KPI 卡片
     */
    private String chartType;

    /**
     * 图表数据
     */
    private List<Map<String, Object>> data;

    /**
     * 维度字段 (X 轴/分类)
     */
    private String dimensionField;

    /**
     * 指标字段列表 (Y 轴/值)
     */
    private List<String> metricFields;

    /**
     * 系列字段 (用于多系列图表)
     */
    private String seriesField;

    /**
     * 图表配置
     */
    private ChartOptions options;

    /**
     * 图表标题
     */
    private String title;

    /**
     * 图表副标题
     */
    private String subtitle;

    /**
     * 输出格式 (echarts, chartjs, highcharts)
     */
    @Builder.Default
    private String outputFormat = "echarts";

    /**
     * 图表配置选项
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChartOptions {

        /**
         * 是否显示图例
         */
        @Builder.Default
        private Boolean showLegend = true;

        /**
         * 是否显示数据标签
         */
        @Builder.Default
        private Boolean showDataLabels = false;

        /**
         * 是否堆叠 (柱状图/面积图)
         */
        @Builder.Default
        private Boolean stacked = false;

        /**
         * 颜色主题
         */
        private String colorTheme;

        /**
         * 自定义颜色
         */
        private List<String> colors;

        /**
         * X 轴配置
         */
        private AxisConfig xAxis;

        /**
         * Y 轴配置
         */
        private AxisConfig yAxis;

        /**
         * 是否启用缩放
         */
        @Builder.Default
        private Boolean enableZoom = false;

        /**
         * 是否启用工具栏
         */
        @Builder.Default
        private Boolean enableToolbar = true;

        /**
         * 动画时长 (毫秒)
         */
        @Builder.Default
        private Integer animationDuration = 1000;

        /**
         * 是否响应式
         */
        @Builder.Default
        private Boolean responsive = true;
    }

    /**
     * 轴配置
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AxisConfig {

        /**
         * 轴标题
         */
        private String title;

        /**
         * 是否显示轴线
         */
        @Builder.Default
        private Boolean show = true;

        /**
         * 标签旋转角度
         */
        private Integer labelRotation;

        /**
         * 格式化类型 (number, currency, percentage, date)
         */
        private String formatType;

        /**
         * 最小值
         */
        private Object min;

        /**
         * 最大值
         */
        private Object max;

        /**
         * 是否反转
         */
        @Builder.Default
        private Boolean inverse = false;
    }
}
