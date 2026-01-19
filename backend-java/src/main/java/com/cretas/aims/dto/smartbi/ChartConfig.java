package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 图表配置 DTO
 * 用于定义图表的类型、字段和数据
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChartConfig {

    /**
     * 图表类型: LINE, BAR, PIE, GAUGE, SCATTER, HEATMAP, MAP
     */
    private String chartType;

    /**
     * 图表标题
     */
    private String title;

    /**
     * X 轴字段
     */
    private String xAxisField;

    /**
     * Y 轴字段
     */
    private String yAxisField;

    /**
     * 系列字段 (可选)
     */
    private String seriesField;

    /**
     * 图表数据
     */
    private List<Map<String, Object>> data;

    /**
     * 图表选项
     */
    private Map<String, Object> options;
}
