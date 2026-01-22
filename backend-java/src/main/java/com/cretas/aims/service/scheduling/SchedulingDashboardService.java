package com.cretas.aims.service.scheduling;

import com.cretas.aims.dto.scheduling.SchedulingDashboardDTO;
import java.time.LocalDate;

/**
 * 调度仪表盘服务接口
 *
 * 负责仪表盘数据聚合，包括：
 * - 日期仪表盘
 * - 实时监控
 *
 * @author Cretas Team
 * @version 1.0.0
 */
public interface SchedulingDashboardService {

    /**
     * 获取仪表盘数据
     */
    SchedulingDashboardDTO getDashboard(String factoryId, LocalDate date);

    /**
     * 获取实时监控数据
     */
    SchedulingDashboardDTO getRealtimeMonitor(String factoryId, String planId);
}
