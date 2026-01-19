package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.ChartConfig;
import com.cretas.aims.dto.smartbi.DashboardResponse;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.dto.smartbi.RankingItem;

import java.time.LocalDate;
import java.util.List;

/**
 * 生产分析服务接口
 *
 * 提供 SmartBI 系统中生产相关的分析能力，包括：
 * - OEE 概览分析：综合设备效率（可用性 × 性能 × 质量）
 * - 生产效率分析：各产线效率、产能利用率
 * - 设备利用率分析：设备运行时间、停机时间、故障率
 * - OEE 趋势分析：日/周/月 OEE 变化趋势
 *
 * OEE 计算公式:
 * - OEE = Availability × Performance × Quality
 * - Availability (可用性) = 实际运行时间 / 计划运行时间
 * - Performance (性能) = 实际产量 / 理论产量
 * - Quality (质量) = 良品数 / 总产量
 *
 * 预警阈值:
 * - OEE < 65%: RED (严重)
 * - OEE 65-85%: YELLOW (关注)
 * - OEE >= 85%: GREEN (正常)
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
public interface ProductionAnalysisService {

    // ==================== OEE 指标代码常量 ====================

    /**
     * 综合设备效率 (Overall Equipment Effectiveness)
     */
    String OEE = "OEE";

    /**
     * 可用性 (Availability)
     */
    String AVAILABILITY = "AVAILABILITY";

    /**
     * 性能率 (Performance)
     */
    String PERFORMANCE = "PERFORMANCE";

    /**
     * 质量率 (Quality)
     */
    String QUALITY_RATE = "QUALITY_RATE";

    /**
     * 计划运行时间
     */
    String PLANNED_RUNTIME = "PLANNED_RUNTIME";

    /**
     * 实际运行时间
     */
    String ACTUAL_RUNTIME = "ACTUAL_RUNTIME";

    /**
     * 停机时间
     */
    String DOWNTIME = "DOWNTIME";

    /**
     * 理论产量
     */
    String THEORETICAL_OUTPUT = "THEORETICAL_OUTPUT";

    /**
     * 实际产量
     */
    String ACTUAL_OUTPUT = "ACTUAL_OUTPUT";

    /**
     * 良品数量
     */
    String GOOD_UNITS = "GOOD_UNITS";

    /**
     * 设备利用率
     */
    String EQUIPMENT_UTILIZATION = "EQUIPMENT_UTILIZATION";

    /**
     * 产能利用率
     */
    String CAPACITY_UTILIZATION = "CAPACITY_UTILIZATION";

    /**
     * 故障次数
     */
    String FAILURE_COUNT = "FAILURE_COUNT";

    /**
     * 平均故障间隔时间 (MTBF)
     */
    String MTBF = "MTBF";

    /**
     * 平均修复时间 (MTTR)
     */
    String MTTR = "MTTR";

    // ==================== OEE 概览 ====================

    /**
     * 获取 OEE 概览数据
     *
     * 返回完整的 OEE 仪表盘数据，包括：
     * - KPI 卡片：OEE、可用性、性能、质量率
     * - 图表：OEE 趋势图、设备排名图、产线对比图
     * - 排行榜：设备 OEE 排名、产线效率排名
     * - AI 洞察：基于数据的智能分析和改进建议
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 仪表盘响应数据
     */
    DashboardResponse getOEEOverview(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== OEE 指标详情 ====================

    /**
     * 获取 OEE 详细指标
     *
     * 返回 OEE 的各项详细指标，包括：
     * - 综合 OEE 值
     * - 可用性指标（计划时间、实际时间、停机时间）
     * - 性能指标（理论产量、实际产量）
     * - 质量指标（总产量、良品数、不良品数）
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 指标结果列表
     */
    List<MetricResult> getOEEMetrics(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 生产效率分析 ====================

    /**
     * 获取生产效率指标
     *
     * 返回各产线的生产效率指标，包括：
     * - 产线效率排名
     * - 产能利用率
     * - 达成率（实际产量/计划产量）
     * - 节拍时间分析
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 指标结果列表
     */
    List<MetricResult> getProductionEfficiency(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取产线效率排名
     *
     * 按生产效率降序排列，返回各产线的效率排名。
     * 每个排名项包含：排名、产线名称、效率值、目标值、完成率、预警级别。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 产线排名列表
     */
    List<RankingItem> getProductionLineRanking(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 设备利用率分析 ====================

    /**
     * 获取设备利用率指标
     *
     * 返回设备利用率相关指标，包括：
     * - 设备利用率
     * - 停机原因分析
     * - 故障率
     * - MTBF（平均故障间隔时间）
     * - MTTR（平均修复时间）
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 指标结果列表
     */
    List<MetricResult> getEquipmentUtilization(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取设备排名
     *
     * 按设备 OEE 或利用率降序排列，返回设备排名。
     * 每个排名项包含：排名、设备名称、OEE 值、利用率、预警级别。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 设备排名列表
     */
    List<RankingItem> getEquipmentRanking(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取停机原因分布图表配置
     *
     * 返回饼图或柱状图配置，展示各类停机原因的占比。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 图表配置
     */
    ChartConfig getDowntimeDistributionChart(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== OEE 趋势分析 ====================

    /**
     * 获取 OEE 趋势图表配置
     *
     * 返回折线图配置，展示 OEE 及其三个组成部分的时间趋势。
     * 支持按日、周、月三种粒度聚合。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @param period    聚合周期: DAY（日）、WEEK（周）、MONTH（月）
     * @return 图表配置
     */
    ChartConfig getOEETrendChart(String factoryId, LocalDate startDate, LocalDate endDate, String period);

    /**
     * 获取产线 OEE 对比图表配置
     *
     * 返回柱状图或雷达图配置，对比多条产线的 OEE 表现。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 图表配置
     */
    ChartConfig getProductionLineComparisonChart(String factoryId, LocalDate startDate, LocalDate endDate);
}
