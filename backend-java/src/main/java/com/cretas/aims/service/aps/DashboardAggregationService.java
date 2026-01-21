package com.cretas.aims.service.aps;

import com.cretas.aims.dto.aps.GlobalDashboard;
import com.cretas.aims.dto.aps.GlobalDashboard.RiskTask;

import java.util.List;

/**
 * APS 仪表盘数据聚合服务
 *
 * 负责生成实时仪表盘数据，包括：
 * - 任务汇总统计
 * - 性能指标
 * - 产线状态
 * - 高风险任务
 * - 重排建议
 *
 * @author Cretas APS
 * @since 2026-01-21
 */
public interface DashboardAggregationService {

    /**
     * 生成实时仪表盘数据
     *
     * @param factoryId 工厂ID
     * @return 全局仪表盘数据
     */
    GlobalDashboard generateDashboard(String factoryId);

    /**
     * 获取高风险任务列表
     *
     * @param factoryId 工厂ID
     * @param limit 返回数量限制
     * @return 高风险任务列表（按完成概率升序排列）
     */
    List<RiskTask> getTopRiskTasks(String factoryId, int limit);

    /**
     * 聚合任务汇总统计
     *
     * @param factoryId 工厂ID
     * @return 任务汇总统计
     */
    GlobalDashboard.TaskSummary aggregateTaskSummary(String factoryId);

    /**
     * 聚合性能指标
     *
     * @param factoryId 工厂ID
     * @return 性能指标
     */
    GlobalDashboard.PerformanceMetrics aggregatePerformanceMetrics(String factoryId);

    /**
     * 聚合产线状态
     *
     * @param factoryId 工厂ID
     * @return 产线状态概览
     */
    GlobalDashboard.LinesSummary aggregateLinesSummary(String factoryId);
}
