package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 数据下钻响应 DTO
 *
 * 用于返回数据下钻分析结果，包括：
 * - 当前维度信息
 * - 下钻数据列表
 * - 图表配置
 * - 可继续下钻的选项
 * - 汇总统计信息
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DrillDownResponse {

    /**
     * 当前维度
     * 当前下钻到的维度
     */
    private String dimension;

    /**
     * 维度显示名称
     * 用于前端展示的友好名称
     */
    private String dimensionLabel;

    /**
     * 当前筛选值
     * 当前选中的维度值
     */
    private String filterValue;

    /**
     * 下钻数据列表
     * 每条记录为一个Map，包含维度值和各指标数据
     * 例如：[{"name": "华东区", "salesAmount": 100000, "orderCount": 500}, ...]
     */
    private List<Map<String, Object>> data;

    /**
     * 图表配置
     * 推荐的数据可视化配置
     */
    private ChartConfig chartConfig;

    /**
     * 可继续下钻的选项
     * 列出当前维度下可以继续深入的子维度
     * 例如：["department", "sales_person"]
     */
    private List<String> nextDrillOptions;

    /**
     * 下钻选项的显示名称映射
     * 例如：{"department": "部门", "sales_person": "销售员"}
     */
    private Map<String, String> drillOptionLabels;

    /**
     * 汇总信息
     * 当前数据的汇总统计
     * 例如：{"totalAmount": 1000000, "avgAmount": 50000, "count": 20}
     */
    private Map<String, Object> summary;

    /**
     * 面包屑路径
     * 记录下钻路径，用于导航回溯
     * 例如：[{"dimension": "region", "value": "华东区"}, {"dimension": "department", "value": "销售一部"}]
     */
    private List<BreadcrumbItem> breadcrumb;

    /**
     * 是否可以继续下钻
     * false 表示已到达最底层
     */
    @Builder.Default
    private boolean canDrillDown = true;

    /**
     * 是否可以上钻（返回上一级）
     */
    @Builder.Default
    private boolean canDrillUp = false;

    /**
     * 数据生成时间
     */
    @Builder.Default
    private LocalDateTime generatedAt = LocalDateTime.now();

    /**
     * 面包屑项
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BreadcrumbItem {
        /**
         * 维度
         */
        private String dimension;

        /**
         * 维度显示名称
         */
        private String dimensionLabel;

        /**
         * 维度值
         */
        private String value;

        /**
         * 值显示名称
         */
        private String valueLabel;
    }

    /**
     * 快速创建下钻响应
     */
    public static DrillDownResponse of(String dimension, String filterValue,
                                        List<Map<String, Object>> data) {
        return DrillDownResponse.builder()
                .dimension(dimension)
                .filterValue(filterValue)
                .data(data)
                .canDrillDown(true)
                .canDrillUp(filterValue != null && !filterValue.isEmpty())
                .generatedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 创建最底层响应（不能继续下钻）
     */
    public static DrillDownResponse bottomLevel(String dimension, String filterValue,
                                                 List<Map<String, Object>> data,
                                                 Map<String, Object> summary) {
        return DrillDownResponse.builder()
                .dimension(dimension)
                .filterValue(filterValue)
                .data(data)
                .summary(summary)
                .canDrillDown(false)
                .canDrillUp(true)
                .generatedAt(LocalDateTime.now())
                .build();
    }
}
