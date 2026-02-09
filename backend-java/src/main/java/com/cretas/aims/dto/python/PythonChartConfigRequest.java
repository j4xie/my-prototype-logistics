package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Python 图表角色推荐请求 DTO
 *
 * 根据字段信息推荐合适的图表类型和角色分配
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonChartConfigRequest {

    /**
     * 字段信息列表
     */
    private List<FieldInfo> fields;

    /**
     * 数据类型 (finance, sales, production, etc.)
     */
    private String dataType;

    /**
     * 分析目的 (trend, comparison, distribution, composition, relationship)
     */
    private String analysisPurpose;

    /**
     * 数据行数
     */
    private Integer rowCount;

    /**
     * 是否为时序数据
     */
    private Boolean isTimeSeries;

    /**
     * 字段信息
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FieldInfo {

        /**
         * 字段名称
         */
        private String name;

        /**
         * 数据类型
         */
        private String dataType;

        /**
         * 语义类型
         */
        private String semanticType;

        /**
         * 唯一值数量
         */
        private Integer uniqueCount;

        /**
         * 是否为数值类型
         */
        private Boolean isNumeric;

        /**
         * 是否为日期类型
         */
        private Boolean isDate;
    }
}
