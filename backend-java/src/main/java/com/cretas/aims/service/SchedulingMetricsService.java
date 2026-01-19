package com.cretas.aims.service;

import com.cretas.aims.dto.metrics.SchedulingMetricsDTO.*;

import java.util.List;

/**
 * 排班指标监控服务接口
 * 提供排班系统各类性能指标的查询
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public interface SchedulingMetricsService {

    /**
     * 获取排班总览指标
     *
     * @param factoryId 工厂ID
     * @return 排班总览数据
     */
    SchedulingOverview getSchedulingOverview(String factoryId);

    /**
     * 获取排班总览指标 (指定天数)
     *
     * @param factoryId 工厂ID
     * @param days 统计天数
     * @return 排班总览数据
     */
    SchedulingOverview getSchedulingOverview(String factoryId, int days);

    /**
     * 获取排班趋势数据
     *
     * @param factoryId 工厂ID
     * @param days 查询天数
     * @return 按日期的趋势数据列表
     */
    List<SchedulingTrend> getSchedulingTrends(String factoryId, int days);

    /**
     * 获取预测准确率详情
     *
     * @param factoryId 工厂ID
     * @param days 统计天数
     * @return 预测准确率数据
     */
    PredictionAccuracyDTO getPredictionAccuracy(String factoryId, int days);

    /**
     * 获取多样性指标
     *
     * @param factoryId 工厂ID
     * @return 多样性指标数据
     */
    DiversityMetricsDTO getDiversityMetrics(String factoryId);

    /**
     * 获取多样性指标 (指定分析天数)
     *
     * @param factoryId 工厂ID
     * @param days 分析天数
     * @return 多样性指标数据
     */
    DiversityMetricsDTO getDiversityMetrics(String factoryId, int days);
}
