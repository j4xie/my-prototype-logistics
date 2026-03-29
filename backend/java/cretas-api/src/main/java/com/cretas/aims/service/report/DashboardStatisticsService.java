package com.cretas.aims.service.report;

import com.cretas.aims.dto.report.DashboardStatisticsDTO;

/**
 * 仪表盘统计服务接口
 * 负责所有 Dashboard 异步并行统计计算
 *
 * @author Cretas Team
 * @since 2026-03-28
 */
public interface DashboardStatisticsService {

    /**
     * 获取仪表盘统计数据（并行异步计算）
     */
    DashboardStatisticsDTO getDashboardStatistics(String factoryId);
}
