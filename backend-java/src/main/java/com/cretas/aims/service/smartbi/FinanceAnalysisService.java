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

    /**
     * 获取成本趋势图表配置
     *
     * 返回堆叠柱状图或多折线图，展示各成本类别随时间的变化。
     * 支持按日、周、月、季度聚合。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @param period    聚合周期：day/week/month/quarter
     * @return 成本趋势图表配置
     */
    ChartConfig getCostTrendChart(String factoryId, LocalDate startDate, LocalDate endDate, String period);

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

    /**
     * 获取应收账款趋势图表配置
     *
     * 返回折线图配置，展示应收余额、回款金额随时间的变化。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 应收趋势图表配置
     */
    ChartConfig getReceivableTrendChart(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 应付账款分析 ====================

    /**
     * 获取应付账款账龄分布图表配置
     *
     * 返回饼图或柱状图配置，展示应付款按账龄的分布。
     * 账龄分段同应收账款。
     *
     * @param factoryId 工厂ID
     * @param date      截止日期
     * @return 账龄分布图表配置
     */
    ChartConfig getPayableAgingChart(String factoryId, LocalDate date);

    /**
     * 获取应付账款相关指标
     *
     * 返回应付相关的核心指标：
     * - AP_BALANCE：应付余额
     * - AP_TURNOVER_DAYS：应付周转天数
     *
     * @param factoryId 工厂ID
     * @param date      截止日期
     * @return 应付指标列表
     */
    List<MetricResult> getPayableMetrics(String factoryId, LocalDate date);

    // ==================== 预算执行分析 ====================

    /**
     * 获取预算执行瀑布图配置
     *
     * 返回瀑布图配置，展示预算执行过程：
     * 年度预算 -> 各月执行 -> 当前累计
     *
     * @param factoryId 工厂ID
     * @param year      年份
     * @return 瀑布图配置
     */
    ChartConfig getBudgetExecutionWaterfall(String factoryId, int year);

    /**
     * 获取预算对比实际图表配置
     *
     * 返回分组柱状图配置，对比各预算科目的预算金额与实际金额。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 预算对比图表配置
     */
    ChartConfig getBudgetVsActualChart(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取预算执行相关指标
     *
     * 返回预算相关的核心指标：
     * - BUDGET_EXECUTION：预算执行率（超过120%为RED预警）
     * - BUDGET_VARIANCE：预算差异
     * - BUDGET_VARIANCE_RATE：预算偏差率
     * - BUDGET_REMAINING：预算剩余
     *
     * @param factoryId 工厂ID
     * @param year      年份
     * @param month     月份（1-12）
     * @return 预算指标列表
     */
    List<MetricResult> getBudgetMetrics(String factoryId, int year, int month);

    // ==================== 预算达成分析 ====================

    /**
     * 获取预算达成分析图表数据
     *
     * 返回柱状图配置，展示各指标的预算达成情况：
     * - 按月展示预算金额、实际金额、达成率
     * - 达成率 = 实际 / 预算 * 100%
     *
     * 预警规则：
     * - 达成率 > 120%：RED（超支严重）
     * - 达成率 100%-120%：YELLOW（略有超支）
     * - 达成率 < 100%：GREEN（正常）
     *
     * @param factoryId 工厂ID
     * @param year      年份
     * @param metric    指标类型：revenue/cost/profit/expense
     * @return 预算达成图表配置
     */
    ChartConfig getBudgetAchievementChart(String factoryId, int year, String metric);

    // ==================== 同比环比分析 ====================

    /** 期间类型：单月 */
    String PERIOD_TYPE_MONTH = "MONTH";
    /** 期间类型：单季度 */
    String PERIOD_TYPE_QUARTER = "QUARTER";
    /** 期间类型：月份范围 */
    String PERIOD_TYPE_MONTH_RANGE = "MONTH_RANGE";
    /** 期间类型：季度范围 */
    String PERIOD_TYPE_QUARTER_RANGE = "QUARTER_RANGE";

    /**
     * 获取同比环比分析图表数据
     *
     * 返回复合图表配置，展示指标的同比/环比变化：
     * - 柱状图：本期值、同期值
     * - 折线图：同比增长率、环比增长率
     *
     * 计算公式：
     * - 同比增长率 = (本期 - 去年同期) / 去年同期 * 100%
     * - 环比增长率 = (本期 - 上期) / 上期 * 100%
     *
     * 支持的期间类型：
     * - MONTH：单个月份（startPeriod格式：2026-01）
     * - QUARTER：单个季度（startPeriod格式：2026-Q1）
     * - MONTH_RANGE：月份范围（startPeriod=2026-01, endPeriod=2026-06）
     * - QUARTER_RANGE：季度范围（startPeriod=2026-Q1, endPeriod=2026-Q4）
     *
     * @param factoryId   工厂ID
     * @param periodType  期间类型：MONTH/QUARTER/MONTH_RANGE/QUARTER_RANGE
     * @param startPeriod 开始期间
     * @param endPeriod   结束期间（范围类型时必填）
     * @param metric      指标类型：revenue/cost/profit/gross_margin
     * @return 同比环比图表配置
     */
    ChartConfig getYoYMoMComparisonChart(
            String factoryId,
            String periodType,
            String startPeriod,
            String endPeriod,
            String metric
    );

    // ==================== 品类结构对比 ====================

    /**
     * 获取品类结构对比图表数据
     *
     * 返回堆叠柱状图或双饼图配置，对比两个年份的品类销售结构：
     * - 各品类销售额及占比
     * - 同比变化率
     *
     * @param factoryId   工厂ID
     * @param year        当前年份
     * @param compareYear 对比年份（通常为上一年）
     * @return 品类结构对比图表配置
     */
    ChartConfig getCategoryStructureComparisonChart(
            String factoryId,
            int year,
            int compareYear
    );
}
