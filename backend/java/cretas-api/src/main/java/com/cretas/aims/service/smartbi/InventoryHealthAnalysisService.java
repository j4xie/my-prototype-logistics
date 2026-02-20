package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.ChartConfig;
import com.cretas.aims.dto.smartbi.DashboardResponse;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.dto.smartbi.RankingItem;

import java.time.LocalDate;
import java.util.List;

/**
 * 库存健康分析服务接口
 *
 * 提供 SmartBI 系统中库存健康相关的分析能力，包括：
 * - 库存健康概览：库存总值、周转率、呆滞率、临期风险
 * - 周转分析：周转率、库存天数、按类别的周转分析
 * - 临期风险分析：临期库存、过期预警、处理建议
 * - 损耗分析：损耗金额、损耗率、损耗原因分布
 * - 库龄分析：库龄分布图、长库龄预警
 *
 * 所有计算使用 BigDecimal 确保精度，并支持按时间范围过滤。
 *
 * 预警阈值规则：
 * - 周转率: RED < 6次/年, YELLOW 6-12次/年, GREEN > 12次/年
 * - 临期风险率: RED > 15%, YELLOW 10-15%, GREEN < 10%
 * - 损耗率: RED > 5%, YELLOW 2-5%, GREEN < 2%
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 * @see DashboardResponse
 * @see RankingItem
 * @see MetricResult
 * @see ChartConfig
 */
public interface InventoryHealthAnalysisService {

    // ==================== 指标代码常量 ====================

    /** 库存总值 */
    String INVENTORY_VALUE = "INVENTORY_VALUE";

    /** 库存数量 */
    String INVENTORY_QUANTITY = "INVENTORY_QUANTITY";

    /** 库存周转率（次/年） */
    String TURNOVER_RATE = "TURNOVER_RATE";

    /** 库存天数 */
    String INVENTORY_DAYS = "INVENTORY_DAYS";

    /** 临期风险率 */
    String EXPIRY_RISK_RATE = "EXPIRY_RISK_RATE";

    /** 临期库存数量 */
    String EXPIRING_COUNT = "EXPIRING_COUNT";

    /** 已过期库存数量 */
    String EXPIRED_COUNT = "EXPIRED_COUNT";

    /** 损耗金额 */
    String LOSS_AMOUNT = "LOSS_AMOUNT";

    /** 损耗率 */
    String LOSS_RATE = "LOSS_RATE";

    /** 呆滞库存率 */
    String SLOW_MOVING_RATE = "SLOW_MOVING_RATE";

    /** 库存健康评分 */
    String HEALTH_SCORE = "HEALTH_SCORE";

    /** 低库存材料数 */
    String LOW_STOCK_COUNT = "LOW_STOCK_COUNT";

    // ==================== 库存健康概览 ====================

    /**
     * 获取库存健康概览数据
     *
     * 返回完整的库存健康仪表盘数据，包括：
     * - KPI 卡片：库存总值、周转率、临期风险率、损耗率
     * - 图表：库龄分布图、库存趋势图、材料类别分布图
     * - 排行榜：临期批次排名、低周转材料排名
     * - AI 洞察：基于数据的智能分析和建议
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期（用于计算周转率等趋势指标）
     * @param endDate   结束日期
     * @return 仪表盘响应数据
     */
    DashboardResponse getInventoryHealth(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 周转分析 ====================

    /**
     * 获取周转分析数据
     *
     * 计算并返回库存周转相关指标：
     * - 周转率 = 消耗量 / 平均库存
     * - 库存天数 = 365 / 周转率
     * - 按材料类别的周转分析
     *
     * 预警规则：
     * - GREEN: 周转率 >= 12次/年（库存天数 <= 30天）
     * - YELLOW: 周转率 6-12次/年（库存天数 30-60天）
     * - RED: 周转率 < 6次/年（库存天数 > 60天）
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 周转分析指标列表
     */
    List<MetricResult> getTurnoverAnalysis(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取周转率趋势图表
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @param period    聚合周期: DAY, WEEK, MONTH
     * @return 图表配置
     */
    ChartConfig getTurnoverTrendChart(String factoryId, LocalDate startDate, LocalDate endDate, String period);

    /**
     * 按材料类别获取周转分析排名
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 材料类别周转排名列表
     */
    List<RankingItem> getTurnoverByCategory(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 临期风险分析 ====================

    /**
     * 获取临期风险分析
     *
     * 分析库存的临期和过期风险：
     * - 临期库存：30天内即将过期的库存
     * - 高风险库存：7天内即将过期的库存
     * - 已过期库存：已经过期但未处理的库存
     * - 临期风险率 = 临期库存 / 总库存
     *
     * 预警规则：
     * - GREEN: 临期风险率 < 10%
     * - YELLOW: 临期风险率 10-15%
     * - RED: 临期风险率 > 15%
     *
     * @param factoryId 工厂ID
     * @return 临期风险分析指标列表
     */
    List<MetricResult> getExpiryRiskAnalysis(String factoryId);

    /**
     * 获取临期批次排名
     *
     * 按距离过期时间排序，返回即将过期的批次列表
     *
     * @param factoryId 工厂ID
     * @param daysToExpiry 距离过期的天数阈值（默认30天）
     * @return 临期批次排名列表
     */
    List<RankingItem> getExpiringBatchesRanking(String factoryId, int daysToExpiry);

    /**
     * 获取临期风险分布图表
     *
     * @param factoryId 工厂ID
     * @return 图表配置（饼图/柱状图）
     */
    ChartConfig getExpiryRiskChart(String factoryId);

    // ==================== 损耗分析 ====================

    /**
     * 获取损耗分析
     *
     * 分析库存损耗情况：
     * - 损耗金额：因损坏、丢失等原因的损失金额
     * - 损耗率 = 损耗金额 / 库存总值
     * - 按损耗原因分布：损坏、丢失、盘亏、过期报废等
     *
     * 预警规则：
     * - GREEN: 损耗率 < 2%
     * - YELLOW: 损耗率 2-5%
     * - RED: 损耗率 > 5%
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 损耗分析指标列表
     */
    List<MetricResult> getLossAnalysis(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取损耗原因分布图表
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 图表配置（饼图）
     */
    ChartConfig getLossReasonChart(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取损耗趋势图表
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 图表配置（折线图）
     */
    ChartConfig getLossTrendChart(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 库龄分析 ====================

    /**
     * 获取库龄分布图表
     *
     * 按入库时间分析库存的库龄分布：
     * - 0-30天：新鲜库存
     * - 31-60天：正常库存
     * - 61-90天：关注库存
     * - 90天以上：呆滞库存
     *
     * @param factoryId 工厂ID
     * @return 图表配置（柱状图/饼图）
     */
    ChartConfig getInventoryAgingChart(String factoryId);

    /**
     * 获取库龄分析指标
     *
     * @param factoryId 工厂ID
     * @return 库龄相关指标列表
     */
    List<MetricResult> getAgingMetrics(String factoryId);

    /**
     * 获取长库龄批次排名
     *
     * @param factoryId 工厂ID
     * @param minDays 最小库龄天数阈值（默认60天）
     * @return 长库龄批次排名列表
     */
    List<RankingItem> getLongAgingBatchesRanking(String factoryId, int minDays);

    // ==================== 综合健康评估 ====================

    /**
     * 获取库存健康评分
     *
     * 综合评估库存健康状况，评分维度包括：
     * - 周转健康（30分）：基于周转率
     * - 临期风险（30分）：基于临期风险率
     * - 损耗控制（20分）：基于损耗率
     * - 库龄健康（20分）：基于呆滞库存率
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 健康评分指标（0-100分）
     */
    MetricResult getHealthScore(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取库存健康雷达图
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 图表配置（雷达图）
     */
    ChartConfig getHealthRadarChart(String factoryId, LocalDate startDate, LocalDate endDate);
}
