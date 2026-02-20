package com.cretas.aims.service;

import java.util.Map;

/**
 * 异常检测服务接口
 * 基于阈值规则检测生产指标异常（良率下降、成本飙升、OEE过低、质量不达标等）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-09
 */
public interface AnomalyDetectionService {

    /**
     * 对指定工厂执行异常检测，返回新创建的告警数量
     *
     * @param factoryId 工厂ID
     * @return 新创建的告警数量
     */
    int detectAnomalies(String factoryId);

    /**
     * 对所有活跃工厂执行异常检测
     *
     * @return 新创建的告警总数量
     */
    int detectAnomaliesForAllFactories();

    /**
     * 获取告警摘要信息（用于仪表盘展示）
     *
     * @param factoryId 工厂ID
     * @return 包含 activeCount, criticalCount, warningCount, resolvedToday, avgResolutionHours, recentAlerts 的摘要
     */
    Map<String, Object> getAlertSummary(String factoryId);
}
