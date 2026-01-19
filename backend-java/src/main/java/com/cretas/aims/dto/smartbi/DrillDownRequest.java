package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

/**
 * 数据下钻请求 DTO
 *
 * 用于请求数据的多级下钻分析，支持：
 * - 区域下钻：大区 -> 省份 -> 城市
 * - 部门下钻：部门 -> 小组 -> 人员
 * - 产品下钻：品类 -> 系列 -> SKU
 * - 时间下钻：年 -> 季度 -> 月 -> 周 -> 日
 *
 * 使用示例：
 * <pre>{@code
 * DrillDownRequest request = DrillDownRequest.builder()
 *     .dimension("region")
 *     .filterValue("华东")
 *     .parentContext("全国")
 *     .startDate(LocalDate.of(2024, 1, 1))
 *     .endDate(LocalDate.of(2024, 12, 31))
 *     .build();
 * }</pre>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DrillDownRequest {

    /**
     * 下钻维度
     *
     * 可选值：
     * - region：区域维度下钻
     * - department：部门维度下钻
     * - product：产品维度下钻
     * - time：时间维度下钻
     * - salesperson：销售员维度下钻
     * - customer：客户维度下钻
     */
    @NotBlank(message = "下钻维度不能为空")
    private String dimension;

    /**
     * 筛选值
     *
     * 当前层级的筛选条件，如：
     * - region 维度：华东、华北、华南等
     * - department 维度：销售一部、市场部等
     * - product 维度：饮料、零食等品类名称
     */
    private String filterValue;

    /**
     * 父级上下文
     *
     * 记录下钻路径，用于面包屑导航：
     * - 如 "全国 > 华东" 表示从全国下钻到华东
     * - 支持多级下钻路径追踪
     */
    private String parentContext;

    /**
     * 父维度
     * 上一级维度名称，用于维护下钻层级关系
     */
    private String parentDimension;

    /**
     * 父维度值
     * 上一级维度的具体值
     */
    private String parentValue;

    /**
     * 下钻层级
     *
     * 当前下钻的层级深度：
     * - 1：第一层（如大区）
     * - 2：第二层（如省份）
     * - 3：第三层（如城市）
     */
    @Builder.Default
    private Integer level = 1;

    /**
     * 开始日期
     *
     * 分析的时间范围起始日期
     */
    private LocalDate startDate;

    /**
     * 结束日期
     *
     * 分析的时间范围结束日期
     */
    private LocalDate endDate;

    /**
     * 附加筛选条件
     *
     * 支持的筛选字段：
     * - salesperson：销售员姓名
     * - customer：客户名称
     * - productCategory：产品类别
     * - minAmount：最小金额
     * - maxAmount：最大金额
     * - orderStatus：订单状态
     */
    @Builder.Default
    private Map<String, Object> additionalFilters = new HashMap<>();

    /**
     * 排序字段
     *
     * 可选值：
     * - amount：按金额排序（默认）
     * - count：按数量排序
     * - growth：按增长率排序
     * - completion：按完成率排序
     */
    @Builder.Default
    private String sortBy = "amount";

    /**
     * 排序方向
     *
     * 可选值：
     * - DESC：降序（默认）
     * - ASC：升序
     */
    @Builder.Default
    private String sortDirection = "DESC";

    /**
     * 返回记录数限制
     *
     * 默认返回前 20 条记录
     */
    @Builder.Default
    private Integer limit = 20;

    /**
     * 是否包含子级汇总
     *
     * true：返回当前层级的子级数据
     * false：只返回当前筛选值的汇总数据
     */
    @Builder.Default
    private Boolean includeChildren = true;

    // ==================== 便捷方法 ====================

    /**
     * 创建区域下钻请求
     *
     * @param filterValue 筛选值（如区域名称）
     * @param startDate   开始日期
     * @param endDate     结束日期
     * @return DrillDownRequest
     */
    public static DrillDownRequest forRegion(String filterValue, LocalDate startDate, LocalDate endDate) {
        return DrillDownRequest.builder()
                .dimension("region")
                .filterValue(filterValue)
                .startDate(startDate)
                .endDate(endDate)
                .build();
    }

    /**
     * 创建部门下钻请求
     *
     * @param filterValue 筛选值（如部门名称）
     * @param startDate   开始日期
     * @param endDate     结束日期
     * @return DrillDownRequest
     */
    public static DrillDownRequest forDepartment(String filterValue, LocalDate startDate, LocalDate endDate) {
        return DrillDownRequest.builder()
                .dimension("department")
                .filterValue(filterValue)
                .startDate(startDate)
                .endDate(endDate)
                .build();
    }

    /**
     * 创建产品下钻请求
     *
     * @param filterValue 筛选值（如产品类别）
     * @param startDate   开始日期
     * @param endDate     结束日期
     * @return DrillDownRequest
     */
    public static DrillDownRequest forProduct(String filterValue, LocalDate startDate, LocalDate endDate) {
        return DrillDownRequest.builder()
                .dimension("product")
                .filterValue(filterValue)
                .startDate(startDate)
                .endDate(endDate)
                .build();
    }

    /**
     * 创建时间下钻请求
     *
     * @param filterValue 筛选值（如年份、月份）
     * @param startDate   开始日期
     * @param endDate     结束日期
     * @return DrillDownRequest
     */
    public static DrillDownRequest forTime(String filterValue, LocalDate startDate, LocalDate endDate) {
        return DrillDownRequest.builder()
                .dimension("time")
                .filterValue(filterValue)
                .startDate(startDate)
                .endDate(endDate)
                .build();
    }

    /**
     * 添加筛选条件
     *
     * @param key   筛选字段
     * @param value 筛选值
     * @return this（链式调用）
     */
    public DrillDownRequest addFilter(String key, Object value) {
        if (this.additionalFilters == null) {
            this.additionalFilters = new HashMap<>();
        }
        this.additionalFilters.put(key, value);
        return this;
    }

    /**
     * 获取日期范围对象
     *
     * @return DateRange 对象
     */
    public DateRange getDateRange() {
        if (startDate == null || endDate == null) {
            return DateRange.thisMonth();
        }
        return DateRange.custom(startDate, endDate);
    }

    /**
     * 判断请求是否有效
     *
     * @return 是否有效
     */
    public boolean isValid() {
        return dimension != null && !dimension.isEmpty();
    }

    /**
     * 获取筛选条件（兼容字段别名）
     *
     * @return 筛选条件 Map
     */
    public Map<String, Object> getFilters() {
        return additionalFilters;
    }

    /**
     * 设置筛选条件（兼容字段别名）
     *
     * @param filters 筛选条件
     */
    public void setFilters(Map<String, Object> filters) {
        this.additionalFilters = filters;
    }

    /**
     * 获取下钻路径描述
     *
     * @return 下钻路径（如 "全国 > 华东 > 上海"）
     */
    public String getDrillPath() {
        if (parentContext == null || parentContext.isEmpty()) {
            return filterValue != null ? filterValue : "全部";
        }
        if (filterValue == null || filterValue.isEmpty()) {
            return parentContext;
        }
        return parentContext + " > " + filterValue;
    }
}
