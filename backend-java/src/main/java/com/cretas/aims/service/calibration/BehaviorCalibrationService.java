package com.cretas.aims.service.calibration;

import com.cretas.aims.dto.calibration.CalibrationDashboardDTO;
import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics;
import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics.PeriodType;
import com.cretas.aims.entity.calibration.ToolReliabilityStats;

import java.time.LocalDate;
import java.util.List;

/**
 * 行为校准服务接口
 * 基于 ET-Agent 论文 (arXiv:2601.06860) 的设计
 *
 * 提供以下核心功能：
 * 1. 计算和聚合校准指标（简洁性、成功率、推理效率、综合得分）
 * 2. 支持日、周、月聚合
 * 3. 生成工具可靠性统计
 * 4. 提供仪表盘可视化数据
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public interface BehaviorCalibrationService {

    /**
     * 计算指定日期的日指标
     *
     * 指标计算公式：
     * - 简洁性 = (总调用 - 冗余调用) / 总调用 * 100
     * - 成功率 = 成功调用 / 总调用 * 100
     * - 推理效率 = 基于token消耗（基准1000 tokens/call）
     * - 综合得分 = 简洁性*0.3 + 成功率*0.5 + 效率*0.2
     *
     * @param factoryId 工厂ID，null表示全平台统计
     * @param date 统计日期
     * @return 计算后的指标实体
     */
    BehaviorCalibrationMetrics calculateDailyMetrics(String factoryId, LocalDate date);

    /**
     * 聚合指标（支持日、周、月聚合）
     *
     * 周聚合：汇总当周7天数据
     * 月聚合：汇总当月所有天数据
     *
     * @param factoryId 工厂ID，null表示全平台统计
     * @param date 基准日期（周/月的最后一天）
     * @param periodType 聚合周期类型
     */
    void aggregateMetrics(String factoryId, LocalDate date, PeriodType periodType);

    /**
     * 获取指标趋势数据
     *
     * 用于图表展示，返回指定时间范围内的所有指标数据
     *
     * @param factoryId 工厂ID，null表示全平台统计
     * @param startDate 开始日期
     * @param endDate 结束日期
     * @param periodType 周期类型
     * @return 指标趋势数据列表
     */
    List<BehaviorCalibrationMetrics> getMetricsTrend(String factoryId, LocalDate startDate,
                                                      LocalDate endDate, PeriodType periodType);

    /**
     * 获取工具可靠性排名
     *
     * 按成功率降序排列，返回所有工具的可靠性统计
     *
     * @param factoryId 工厂ID，null表示全平台统计
     * @param date 统计日期
     * @return 工具可靠性统计列表（按成功率排序）
     */
    List<ToolReliabilityStats> getToolReliabilityRanking(String factoryId, LocalDate date);

    /**
     * 获取仪表盘综合数据
     *
     * 包含：
     * - 当前指标卡片（4个核心指标）
     * - 趋势数据（最近30天）
     * - 工具可靠性排名（Top工具）
     * - 最近工具调用（最近20条）
     *
     * @param factoryId 工厂ID，null表示全平台统计
     * @return 仪表盘DTO
     */
    CalibrationDashboardDTO getDashboardData(String factoryId);

    /**
     * 计算并更新工具可靠性统计
     *
     * 按工具维度汇总成功率和性能指标
     *
     * @param factoryId 工厂ID，null表示全平台统计
     * @param date 统计日期
     */
    void calculateToolReliabilityStats(String factoryId, LocalDate date);

    /**
     * 获取最新的日指标
     *
     * @param factoryId 工厂ID，null表示全平台统计
     * @return 最新的日指标，可能为null
     */
    BehaviorCalibrationMetrics getLatestDailyMetrics(String factoryId);

    /**
     * 批量计算所有工厂的日指标
     *
     * 用于定时任务，每日凌晨执行
     *
     * @param date 统计日期
     */
    void calculateAllFactoriesDailyMetrics(LocalDate date);

    /**
     * 获取低可靠性工具列表
     *
     * 返回成功率低于指定阈值的工具
     *
     * @param factoryId 工厂ID
     * @param date 统计日期
     * @param threshold 成功率阈值（0-100）
     * @return 低可靠性工具列表
     */
    List<ToolReliabilityStats> getLowReliabilityTools(String factoryId, LocalDate date,
                                                       java.math.BigDecimal threshold);

    /**
     * 获取指定时间范围内的平均综合得分
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate 结束日期
     * @return 平均综合得分
     */
    Double getAverageCompositeScore(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取实时指标（基于今日数据）
     *
     * 与 calculateDailyMetrics 的区别：
     * - calculateDailyMetrics: 用于每日定时任务，会保存到数据库
     * - getRealtimeMetrics: 用于实时查询，不保存，每次重新计算
     *
     * 实时指标包括：
     * - 今日工具调用总数
     * - 今日成功率
     * - 今日冗余率
     * - 今日综合得分
     *
     * @param factoryId 工厂ID，null表示全平台统计
     * @return 实时指标DTO
     */
    CalibrationDashboardDTO.CurrentMetrics getRealtimeMetrics(String factoryId);
}
