package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.ChartConfig;
import com.cretas.aims.dto.smartbi.DashboardResponse;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.dto.smartbi.RankingItem;

import java.time.LocalDate;
import java.util.List;

/**
 * 采购分析服务接口
 *
 * 提供 SmartBI 系统中采购相关的分析能力，包括：
 * - 采购概览分析：采购总额、批次数、平均批次金额、成本率
 * - 供应商评估：价格、质量、交付、服务五维雷达图
 * - 采购成本分析：按材料类别的成本分布
 * - 供应商排名：供应商业绩排名
 * - 趋势分析：日/周/月采购趋势
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
public interface ProcurementAnalysisService {

    // ==================== 指标代码常量 ====================

    /** 采购总额 */
    String PROCUREMENT_AMOUNT = "PROCUREMENT_AMOUNT";

    /** 采购批次数 */
    String BATCH_COUNT = "BATCH_COUNT";

    /** 平均批次金额 */
    String AVG_BATCH_AMOUNT = "AVG_BATCH_AMOUNT";

    /** 采购成本率 */
    String PROCUREMENT_COST_RATE = "PROCUREMENT_COST_RATE";

    /** 准时交付率 */
    String ON_TIME_DELIVERY_RATE = "ON_TIME_DELIVERY_RATE";

    /** 质量合格率 */
    String QUALITY_PASS_RATE = "QUALITY_PASS_RATE";

    /** 供应商数量 */
    String SUPPLIER_COUNT = "SUPPLIER_COUNT";

    /** 活跃供应商数 */
    String ACTIVE_SUPPLIER_COUNT = "ACTIVE_SUPPLIER_COUNT";

    /** 供应商集中度 */
    String SUPPLIER_CONCENTRATION = "SUPPLIER_CONCENTRATION";

    /** 采购环比增长 */
    String PROCUREMENT_MOM_GROWTH = "PROCUREMENT_MOM_GROWTH";

    // ==================== 采购概览 ====================

    /**
     * 获取采购概览数据
     *
     * 返回完整的采购仪表盘数据，包括：
     * - KPI 卡片：采购总额、批次数、平均批次金额、准时交付率
     * - 图表：采购趋势图、供应商占比图、材料类别分布图
     * - 排行榜：供应商排名
     * - AI 洞察：基于数据的智能分析和建议
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 仪表盘响应数据
     */
    DashboardResponse getProcurementOverview(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 供应商评估 ====================

    /**
     * 获取供应商评估数据
     *
     * 返回供应商的多维度评估数据，支持雷达图展示。
     * 五个评估维度：
     * - 价格竞争力：相比市场均价的优惠程度
     * - 质量合格率：入库批次的质量检验合格率
     * - 交付准时率：按时交付的批次占比
     * - 服务响应度：问题处理和沟通效率
     * - 供货稳定性：供货量波动程度
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 供应商评估图表配置（雷达图）
     */
    ChartConfig getSupplierEvaluation(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取单个供应商的详细评估
     *
     * @param factoryId  工厂ID
     * @param supplierId 供应商ID
     * @param startDate  开始日期
     * @param endDate    结束日期
     * @return 供应商评估指标列表
     */
    List<MetricResult> getSupplierDetailMetrics(String factoryId, String supplierId,
                                                 LocalDate startDate, LocalDate endDate);

    // ==================== 采购成本分析 ====================

    /**
     * 获取采购成本分析
     *
     * 返回按材料类别分组的采购成本分析，包括：
     * - 各类别采购金额及占比
     * - 各类别单价变化趋势
     * - 成本优化建议
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 成本分析图表配置（饼图/柱状图）
     */
    ChartConfig getPurchaseCostAnalysis(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取采购成本指标明细
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 成本相关指标列表
     */
    List<MetricResult> getCostMetrics(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 供应商排名 ====================

    /**
     * 获取供应商排名
     *
     * 按采购金额降序排列，返回供应商的业绩排名列表。
     * 每个排名项包含：排名、供应商名称、采购金额、批次数、合格率、预警级别。
     *
     * 预警规则：
     * - GREEN: 准时交付率 >= 85%
     * - YELLOW: 准时交付率 70-85%
     * - RED: 准时交付率 < 70%
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 供应商排名列表
     */
    List<RankingItem> getSupplierRanking(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取材料类别采购排名
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 材料类别排名列表
     */
    List<RankingItem> getMaterialCategoryRanking(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 趋势分析 ====================

    /**
     * 获取采购趋势图表配置
     *
     * 返回折线图的配置，展示采购金额的时间趋势。
     * 支持按日、周、月三种粒度聚合。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @param period    聚合周期: DAY（日）、WEEK（周）、MONTH（月）
     * @return 图表配置
     */
    ChartConfig getProcurementTrendChart(String factoryId, LocalDate startDate, LocalDate endDate, String period);

    /**
     * 获取供应商采购趋势对比
     *
     * @param factoryId   工厂ID
     * @param supplierIds 供应商ID列表
     * @param startDate   开始日期
     * @param endDate     结束日期
     * @return 供应商对比图表配置
     */
    ChartConfig getSupplierTrendComparison(String factoryId, List<String> supplierIds,
                                            LocalDate startDate, LocalDate endDate);
}
