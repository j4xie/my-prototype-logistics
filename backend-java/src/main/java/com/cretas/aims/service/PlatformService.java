package com.cretas.aims.service;

import com.cretas.aims.dto.platform.FactoryAIQuotaDTO;
import com.cretas.aims.dto.platform.PlatformAIUsageStatsDTO;
import com.cretas.aims.dto.platform.PlatformStatisticsDTO;

import java.util.List;

/**
 * 平台管理服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-02
 */
public interface PlatformService {

    /**
     * 获取所有工厂的AI配额设置
     *
     * @return 工厂AI配额列表
     */
    List<FactoryAIQuotaDTO> getAllFactoryAIQuotas();

    /**
     * 更新工厂AI配额
     *
     * @param factoryId 工厂ID
     * @param weeklyQuota 新的每周配额
     * @return 更新后的工厂ID和配额
     */
    FactoryAIQuotaDTO.CountInfo updateFactoryAIQuota(String factoryId, Integer weeklyQuota);

    /**
     * 获取平台AI使用统计
     *
     * @return 平台AI使用统计信息
     */
    PlatformAIUsageStatsDTO getPlatformAIUsageStats();

    /**
     * 获取当前周次编号（ISO 8601格式）
     *
     * @return 周次编号（例如: '2025-W44'）
     */
    String getCurrentWeekNumber();

    /**
     * 获取平台统计数据
     * 提供全平台的汇总统计信息，包括工厂、用户、批次、产量和AI配额等
     *
     * @return 平台统计数据
     * @since 2025-11-20
     */
    PlatformStatisticsDTO getDashboardStatistics();
}
