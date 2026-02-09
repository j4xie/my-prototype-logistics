package com.cretas.aims.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 转换率历史分析数据传输对象
 * 用于AI分析的趋势数据
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-25
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversionHistoryAnalysisDTO {

    /**
     * 查询时间段
     */
    private Period period;

    /**
     * 统计摘要
     */
    private Summary summary;

    /**
     * 趋势数据列表
     */
    private List<ConversionTrend> trends;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Period {
        private LocalDate start;
        private LocalDate end;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Summary {
        /**
         * 总变更次数
         */
        private long totalChanges;

        /**
         * 新建次数
         */
        private long createCount;

        /**
         * 更新次数
         */
        private long updateCount;

        /**
         * 删除次数
         */
        private long deleteCount;

        /**
         * 涉及的原料类型数量
         */
        private int materialTypeCount;

        /**
         * 涉及的产品类型数量
         */
        private int productTypeCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConversionTrend {
        /**
         * 原料类型ID
         */
        private String materialTypeId;

        /**
         * 原料类型名称
         */
        private String materialTypeName;

        /**
         * 产品类型ID
         */
        private String productTypeId;

        /**
         * 产品类型名称
         */
        private String productTypeName;

        /**
         * 变更历史数据点
         */
        private List<ChangePoint> changes;

        /**
         * 趋势类型
         */
        private TrendType trend;

        /**
         * 平均变化幅度
         */
        private BigDecimal avgChange;

        /**
         * 当前转换率
         */
        private BigDecimal currentRate;

        /**
         * 当前损耗率
         */
        private BigDecimal currentWastage;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChangePoint {
        /**
         * 变更日期
         */
        private LocalDate date;

        /**
         * 转换率
         */
        private BigDecimal rate;

        /**
         * 损耗率
         */
        private BigDecimal wastage;

        /**
         * 变更类型
         */
        private String changeType;
    }

    /**
     * 趋势类型枚举
     */
    public enum TrendType {
        /**
         * 上升趋势
         */
        INCREASING,

        /**
         * 下降趋势
         */
        DECREASING,

        /**
         * 稳定
         */
        STABLE,

        /**
         * 波动较大
         */
        VOLATILE
    }
}
