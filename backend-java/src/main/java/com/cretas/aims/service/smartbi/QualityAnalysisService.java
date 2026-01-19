package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.ChartConfig;
import com.cretas.aims.dto.smartbi.DashboardResponse;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.dto.smartbi.RankingItem;

import java.time.LocalDate;
import java.util.List;

/**
 * 质量分析服务接口
 *
 * 提供 SmartBI 系统中质量相关的分析能力，包括：
 * - 质量概览分析：FPY（首次通过率）、不良率、返工成本
 * - 不良分析：不良类型分布、帕累托分析
 * - 返工成本分析：返工成本、报废成本
 * - 质量趋势分析：日/周/月质量指标变化
 * - 产线质量分析：各产线质量对比
 *
 * 关键质量指标:
 * - FPY (First Pass Yield) = 首次检验通过数 / 总检验数
 * - 不良率 = 不良品数 / 总检验数
 * - 返工率 = 返工数 / 总不良数
 * - 报废率 = 报废数 / 总不良数
 *
 * 预警阈值:
 * - FPY < 95%: RED (严重)
 * - FPY 95-98%: YELLOW (关注)
 * - FPY >= 98%: GREEN (正常)
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
public interface QualityAnalysisService {

    // ==================== 质量指标代码常量 ====================

    /**
     * 首次通过率 (First Pass Yield)
     */
    String FPY = "FPY";

    /**
     * 不良率 (Defect Rate)
     */
    String DEFECT_RATE = "DEFECT_RATE";

    /**
     * 返工率 (Rework Rate)
     */
    String REWORK_RATE = "REWORK_RATE";

    /**
     * 报废率 (Scrap Rate)
     */
    String SCRAP_RATE = "SCRAP_RATE";

    /**
     * 总检验数
     */
    String TOTAL_INSPECTIONS = "TOTAL_INSPECTIONS";

    /**
     * 首次通过数
     */
    String FIRST_PASS_COUNT = "FIRST_PASS_COUNT";

    /**
     * 不良品数
     */
    String DEFECT_COUNT = "DEFECT_COUNT";

    /**
     * 返工数
     */
    String REWORK_COUNT = "REWORK_COUNT";

    /**
     * 报废数
     */
    String SCRAP_COUNT = "SCRAP_COUNT";

    /**
     * 返工成本
     */
    String REWORK_COST = "REWORK_COST";

    /**
     * 报废成本
     */
    String SCRAP_COST = "SCRAP_COST";

    /**
     * 质量成本总计
     */
    String TOTAL_QUALITY_COST = "TOTAL_QUALITY_COST";

    /**
     * 质量成本率（占销售额比例）
     */
    String QUALITY_COST_RATIO = "QUALITY_COST_RATIO";

    /**
     * 客户投诉数
     */
    String CUSTOMER_COMPLAINT_COUNT = "CUSTOMER_COMPLAINT_COUNT";

    /**
     * 退货数
     */
    String RETURN_COUNT = "RETURN_COUNT";

    // ==================== 质量概览 ====================

    /**
     * 获取质量概览数据
     *
     * 返回完整的质量仪表盘数据，包括：
     * - KPI 卡片：FPY、不良率、返工成本、报废成本
     * - 图表：质量趋势图、不良类型分布图、产线质量对比图
     * - 排行榜：产线质量排名、不良类型排名
     * - AI 洞察：基于数据的智能分析和改进建议
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 仪表盘响应数据
     */
    DashboardResponse getQualitySummary(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 不良分析 ====================

    /**
     * 获取不良分析详情
     *
     * 返回不良相关的详细分析，包括：
     * - 不良类型分布
     * - 不良原因帕累托分析
     * - 各产线不良率对比
     * - 不良趋势
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 指标结果列表
     */
    List<MetricResult> getDefectAnalysis(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取不良类型排名
     *
     * 按不良数量降序排列，返回各不良类型的排名（帕累托分析）。
     * 每个排名项包含：排名、不良类型、数量、占比、累计占比。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 不良类型排名列表
     */
    List<RankingItem> getDefectTypeRanking(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取不良类型分布图表配置
     *
     * 返回帕累托图配置，展示各不良类型的占比和累计占比。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 图表配置
     */
    ChartConfig getDefectParetoChart(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 返工/报废成本分析 ====================

    /**
     * 获取返工和报废成本指标
     *
     * 返回返工和报废相关的成本指标，包括：
     * - 返工成本
     * - 报废成本
     * - 质量成本总计
     * - 质量成本占比（相对于销售额）
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 指标结果列表
     */
    List<MetricResult> getReworkCost(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取质量成本分布图表配置
     *
     * 返回饼图或柱状图配置，展示各类质量成本的占比。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 图表配置
     */
    ChartConfig getQualityCostDistributionChart(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 质量趋势分析 ====================

    /**
     * 获取质量趋势图表配置
     *
     * 返回折线图配置，展示 FPY、不良率等质量指标的时间趋势。
     * 支持按日、周、月三种粒度聚合。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @param period    聚合周期: DAY（日）、WEEK（周）、MONTH（月）
     * @return 图表配置
     */
    ChartConfig getQualityTrendChart(String factoryId, LocalDate startDate, LocalDate endDate, String period);

    // ==================== 产线质量分析 ====================

    /**
     * 获取各产线质量指标
     *
     * 返回按产线分组的质量指标，包括：
     * - 各产线 FPY
     * - 各产线不良率
     * - 各产线返工率
     * - 各产线排名
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 指标结果列表
     */
    List<MetricResult> getQualityByProductLine(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取产线质量排名
     *
     * 按 FPY 降序排列，返回各产线的质量排名。
     * 每个排名项包含：排名、产线名称、FPY 值、不良率、预警级别。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 产线质量排名列表
     */
    List<RankingItem> getProductLineQualityRanking(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取产线质量对比图表配置
     *
     * 返回柱状图或雷达图配置，对比各产线的质量指标。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 图表配置
     */
    ChartConfig getProductLineQualityComparisonChart(String factoryId, LocalDate startDate, LocalDate endDate);
}
