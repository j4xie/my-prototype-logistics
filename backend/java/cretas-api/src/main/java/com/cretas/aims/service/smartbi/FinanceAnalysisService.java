package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.ChartConfig;
import com.cretas.aims.dto.smartbi.DashboardResponse;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.dto.smartbi.RankingItem;

import java.time.LocalDate;
import java.util.List;

/**
 * 财务分析服务接口
 *
 * 提供 SmartBI 系统中财务相关的分析能力，包括：
 * - 利润分析：毛利、净利、利润趋势
 * - 成本结构分析：原材料、人工、制造费用分解
 * - 应收账款分析：账龄分布、逾期率
 * - 应付账款分析：账龄分布、付款情况
 * - 预算执行分析：执行率、差异
 *
 * 账龄分段标准：
 * - 0-30天：正常
 * - 31-60天：关注
 * - 61-90天：预警
 * - 90天以上：高风险
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 * @see MetricCalculatorService
 */
public interface FinanceAnalysisService {

    // ==================== 账龄分段常量 ====================

    /** 账龄分段：0-30天 */
    String AGING_BUCKET_0_30 = "0-30天";
    /** 账龄分段：31-60天 */
    String AGING_BUCKET_31_60 = "31-60天";
    /** 账龄分段：61-90天 */
    String AGING_BUCKET_61_90 = "61-90天";
    /** 账龄分段：90天以上 */
    String AGING_BUCKET_OVER_90 = "90天以上";

    // ==================== 成本类别常量 ====================

    /** 成本类别：原材料 */
    String COST_CATEGORY_MATERIAL = "原材料";
    /** 成本类别：人工 */
    String COST_CATEGORY_LABOR = "人工";
    /** 成本类别：制造费用 */
    String COST_CATEGORY_OVERHEAD = "制造费用";

    // ==================== 周期常量 ====================

    /** 周期：日 */
    String PERIOD_DAY = "day";
    /** 周期：周 */
    String PERIOD_WEEK = "week";
    /** 周期：月 */
    String PERIOD_MONTH = "month";
    /** 周期：季 */
    String PERIOD_QUARTER = "quarter";

    // ==================== 财务概览 ====================

    /**
     * 获取财务概览仪表盘
     *
     * 返回包含以下内容的完整仪表盘：
     * - KPI卡片：毛利额、毛利率、应收余额、预算执行率
     * - 图表：利润趋势图、成本结构图、应收账龄图
     * - AI洞察：财务健康状况、风险预警
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 财务仪表盘数据
     */
    DashboardResponse getFinanceOverview(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 利润分析 ====================

    /**
     * 获取利润趋势图表配置
     *
     * 返回折线图配置，展示毛利、净利随时间的变化趋势。
     * 支持按日、周、月、季度聚合。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @param period    聚合周期：day/week/month/quarter
     * @return 利润趋势图表配置
     */
    ChartConfig getProfitTrendChart(String factoryId, LocalDate startDate, LocalDate endDate, String period);

    /**
     * 获取利润相关指标
     *
     * 返回利润相关的核心指标：
     * - GROSS_PROFIT：毛利额
     * - GROSS_MARGIN：毛利率
     * - NET_PROFIT：净利润
     * - NET_MARGIN：净利率
     * - ROI：投入产出比
     * - PROFIT_PER_ORDER：单笔利润
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 利润指标列表
     */
    List<MetricResult> getProfitMetrics(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 成本结构分析 ====================

    /**
     * 获取成本结构图表配置
     *
     * 返回饼图配置，展示成本的构成：
     * - 原材料成本 (material_cost)
     * - 人工成本 (labor_cost)
     * - 制造费用 (overhead_cost)
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 成本结构饼图配置
     */
    ChartConfig getCostStructureChart(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 应收账款分析 ====================

    /**
     * 获取应收账款账龄分布图表配置
     *
     * 返回饼图或柱状图配置，展示应收款按账龄的分布：
     * - 0-30天：正常
     * - 31-60天：关注
     * - 61-90天：预警
     * - 90天以上：高风险（RED预警）
     *
     * @param factoryId 工厂ID
     * @param date      截止日期（通常为当前日期或月末）
     * @return 账龄分布图表配置
     */
    ChartConfig getReceivableAgingChart(String factoryId, LocalDate date);

    /**
     * 获取应收账款相关指标
     *
     * 返回应收相关的核心指标：
     * - AR_BALANCE：应收余额
     * - COLLECTION_RATE：回款率
     * - OVERDUE_RATIO：逾期率
     * - AGING_30_RATIO：30天以上账龄占比
     * - AGING_60_RATIO：60天以上账龄占比
     * - AGING_90_RATIO：90天以上账龄占比（超过20%为RED预警）
     *
     * @param factoryId 工厂ID
     * @param date      截止日期
     * @return 应收指标列表
     */
    List<MetricResult> getReceivableMetrics(String factoryId, LocalDate date);

    /**
     * 获取逾期客户排名
     *
     * 返回逾期金额最高的客户列表，用于催收优先级排序。
     * 包含预警级别（90天以上为RED）。
     *
     * @param factoryId 工厂ID
     * @param date      截止日期
     * @return 逾期客户排名列表
     */
    List<RankingItem> getOverdueCustomerRanking(String factoryId, LocalDate date);
}
