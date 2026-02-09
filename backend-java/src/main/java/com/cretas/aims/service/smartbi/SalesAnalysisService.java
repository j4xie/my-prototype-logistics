package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.ChartConfig;
import com.cretas.aims.dto.smartbi.DashboardResponse;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.dto.smartbi.RankingItem;

import java.time.LocalDate;
import java.util.List;

/**
 * 销售分析服务接口
 *
 * 提供 SmartBI 系统中销售相关的分析能力，包括：
 * - 销售概览分析：总销售额、订单数、客单价、完成率
 * - 销售员分析：排名、完成率、人均产出
 * - 产品分析：销量、占比、毛利率
 * - 客户分析：Top 10 客户、新客户数
 * - 趋势分析：日/周/月销售趋势
 *
 * 所有计算使用 BigDecimal 确保精度，并支持按时间范围过滤。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 * @see DashboardResponse
 * @see RankingItem
 * @see MetricResult
 * @see ChartConfig
 */
public interface SalesAnalysisService {

    // ==================== 销售概览 ====================

    /**
     * 获取销售概览数据
     *
     * 返回完整的销售仪表盘数据，包括：
     * - KPI 卡片：销售额、订单数、客单价、目标完成率
     * - 图表：销售趋势图、销售员排名图、产品占比图
     * - 排行榜：销售员排名
     * - AI 洞察：基于数据的智能分析和建议
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 仪表盘响应数据
     */
    DashboardResponse getSalesOverview(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 销售员分析 ====================

    /**
     * 获取销售员排名
     *
     * 按销售额降序排列，返回销售员的业绩排名列表。
     * 每个排名项包含：排名、姓名、销售额、目标、完成率、预警级别。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 销售员排名列表
     */
    List<RankingItem> getSalespersonRanking(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取销售员详细指标
     *
     * 返回指定销售员的详细业绩指标，包括：
     * - 销售额、订单数、客单价
     * - 目标完成率、环比增长
     * - 客户数、新客户数
     * - 毛利额、毛利率
     *
     * @param factoryId       工厂ID
     * @param salespersonName 销售员姓名
     * @param startDate       开始日期
     * @param endDate         结束日期
     * @return 指标结果列表
     */
    List<MetricResult> getSalespersonMetrics(String factoryId, String salespersonName,
                                              LocalDate startDate, LocalDate endDate);

    // ==================== 产品分析 ====================

    /**
     * 获取产品销售排名
     *
     * 按销售额或销量降序排列，返回产品的销售排名列表。
     * 每个排名项包含：排名、产品名称、销售额/销量、占比。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 产品排名列表
     */
    List<RankingItem> getProductRanking(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取产品销售分布图表配置
     *
     * 返回饼图或环形图的配置，展示各产品类别的销售占比。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 图表配置
     */
    ChartConfig getProductDistributionChart(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 客户分析 ====================

    /**
     * 获取客户贡献排名
     *
     * 按销售额降序排列，返回 Top 10 客户的贡献排名。
     * 每个排名项包含：排名、客户名称、销售额、占比。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 客户排名列表（Top 10）
     */
    List<RankingItem> getCustomerRanking(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 趋势分析 ====================

    /**
     * 获取销售趋势图表配置
     *
     * 返回折线图的配置，展示销售额的时间趋势。
     * 支持按日、周、月三种粒度聚合。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @param period    聚合周期: DAY（日）、WEEK（周）、MONTH（月）
     * @return 图表配置
     */
    ChartConfig getSalesTrendChart(String factoryId, LocalDate startDate, LocalDate endDate, String period);

    // ==================== 对比分析 ====================

    /**
     * 获取销售员对比图表配置
     *
     * 返回柱状图或雷达图的配置，对比多个销售员的业绩表现。
     *
     * @param factoryId        工厂ID
     * @param salespersonNames 要对比的销售员姓名列表
     * @param startDate        开始日期
     * @param endDate          结束日期
     * @return 图表配置
     */
    ChartConfig getSalespersonComparisonChart(String factoryId, List<String> salespersonNames,
                                               LocalDate startDate, LocalDate endDate);
}
