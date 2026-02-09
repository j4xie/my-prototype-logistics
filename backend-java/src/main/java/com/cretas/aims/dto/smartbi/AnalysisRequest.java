package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.Map;

/**
 * 通用分析请求 DTO
 *
 * 用于各类数据分析请求，支持：
 * - 时间范围筛选
 * - 多维度筛选
 * - 时间粒度控制
 * - 自定义筛选条件
 *
 * 适用场景：
 * - 销售趋势分析
 * - 部门业绩分析
 * - 区域分布分析
 * - 产品分析
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalysisRequest {

    /**
     * 数据开始日期
     * 分析数据的起始时间
     */
    @NotNull(message = "开始日期不能为空")
    private LocalDate startDate;

    /**
     * 数据结束日期
     * 分析数据的结束时间
     */
    @NotNull(message = "结束日期不能为空")
    private LocalDate endDate;

    /**
     * 部门筛选
     * 指定要分析的部门
     */
    private String department;

    /**
     * 区域筛选
     * 指定要分析的区域
     */
    private String region;

    /**
     * 分析维度
     * 指定分析的主维度，如：time, department, region, product, sales_person
     */
    private String dimension;

    /**
     * 时间粒度
     * 时间序列分析的粒度，可选值：
     * - day: 按天
     * - week: 按周
     * - month: 按月
     * - quarter: 按季度
     * - year: 按年
     */
    @Builder.Default
    private String granularity = "day";

    /**
     * 返回数量限制
     * 限制返回的记录数，默认不限制
     */
    private Integer limit;

    /**
     * 偏移量
     * 用于分页，跳过的记录数
     */
    @Builder.Default
    private Integer offset = 0;

    /**
     * 排序字段
     * 结果排序的字段名
     */
    private String sortBy;

    /**
     * 排序方向
     * ASC 升序，DESC 降序
     */
    @Builder.Default
    private String sortOrder = "DESC";

    /**
     * 额外筛选条件
     * 可包含多个筛选条件的键值对
     * 例如：{"category": "食品", "status": "active", "minAmount": 10000}
     */
    private Map<String, Object> filters;

    /**
     * 是否包含对比数据
     * true 则返回同比/环比数据
     */
    @Builder.Default
    private boolean includeComparison = false;

    /**
     * 对比类型
     * 当 includeComparison 为 true 时有效
     * - yoy: 同比（Year over Year）
     * - mom: 环比（Month over Month）
     * - wow: 周环比（Week over Week）
     */
    private String comparisonType;

    /**
     * 是否包含汇总
     * true 则在返回数据中包含汇总统计
     */
    @Builder.Default
    private boolean includeSummary = true;

    /**
     * 指标列表
     * 指定要计算的指标，如：["salesAmount", "orderCount", "profitMargin"]
     * 为空则返回所有可用指标
     */
    private java.util.List<String> metrics;

    /**
     * 快速创建分析请求
     */
    public static AnalysisRequest of(LocalDate startDate, LocalDate endDate) {
        return AnalysisRequest.builder()
                .startDate(startDate)
                .endDate(endDate)
                .granularity("day")
                .includeSummary(true)
                .build();
    }

    /**
     * 创建带维度的分析请求
     */
    public static AnalysisRequest ofDimension(LocalDate startDate, LocalDate endDate,
                                               String dimension, String granularity) {
        return AnalysisRequest.builder()
                .startDate(startDate)
                .endDate(endDate)
                .dimension(dimension)
                .granularity(granularity)
                .includeSummary(true)
                .build();
    }

    /**
     * 创建带对比的分析请求
     */
    public static AnalysisRequest withComparison(LocalDate startDate, LocalDate endDate,
                                                  String comparisonType) {
        return AnalysisRequest.builder()
                .startDate(startDate)
                .endDate(endDate)
                .includeComparison(true)
                .comparisonType(comparisonType)
                .includeSummary(true)
                .build();
    }

    /**
     * 创建本月分析请求
     */
    public static AnalysisRequest thisMonth() {
        LocalDate now = LocalDate.now();
        return AnalysisRequest.builder()
                .startDate(now.withDayOfMonth(1))
                .endDate(now)
                .granularity("day")
                .includeSummary(true)
                .build();
    }

    /**
     * 创建本季度分析请求
     */
    public static AnalysisRequest thisQuarter() {
        LocalDate now = LocalDate.now();
        int quarter = (now.getMonthValue() - 1) / 3;
        LocalDate quarterStart = now.withMonth(quarter * 3 + 1).withDayOfMonth(1);
        return AnalysisRequest.builder()
                .startDate(quarterStart)
                .endDate(now)
                .granularity("month")
                .includeSummary(true)
                .build();
    }
}
