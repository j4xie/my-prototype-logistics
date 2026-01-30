package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.ForecastResult;
import com.cretas.aims.entity.smartbi.enums.ForecastAlgorithm;

import java.time.LocalDate;

/**
 * 预测服务接口
 *
 * 提供 SmartBI 系统中基于统计方法的时间序列预测能力，包括：
 * - 销售预测：基于历史销售数据预测未来销售额
 * - 通用指标预测：支持多种业务指标的预测
 * - 多算法支持：移动平均、线性趋势、指数平滑
 *
 * 所有预测结果包含置信区间，帮助用户评估预测的可靠性。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 * @see ForecastResult
 * @see ForecastAlgorithm
 */
public interface ForecastService {

    /**
     * 预测销售额
     *
     * 基于历史销售数据，使用自动选择的最佳算法预测未来销售额。
     * 系统会分析数据特征（趋势性、平稳性）自动选择合适的预测算法。
     *
     * @param factoryId    工厂ID
     * @param startDate    历史数据开始日期
     * @param endDate      历史数据结束日期
     * @param forecastDays 预测天数
     * @return 预测结果，包含历史数据点和预测数据点
     */
    ForecastResult forecastSales(String factoryId, LocalDate startDate, LocalDate endDate, int forecastDays);

    /**
     * 预测指定指标
     *
     * 支持预测多种业务指标，如订单数、客单价、毛利率等。
     * 系统自动选择最佳预测算法。
     *
     * @param factoryId    工厂ID
     * @param metricType   指标类型 (如: SALES_AMOUNT, ORDER_COUNT, AVG_ORDER_VALUE)
     * @param startDate    历史数据开始日期
     * @param endDate      历史数据结束日期
     * @param forecastDays 预测天数
     * @return 预测结果
     */
    ForecastResult forecastMetric(String factoryId, String metricType, LocalDate startDate, LocalDate endDate, int forecastDays);

    /**
     * 使用指定算法预测指标
     *
     * 允许用户指定预测算法，适用于对数据特征有明确了解的场景。
     *
     * @param factoryId    工厂ID
     * @param metricType   指标类型
     * @param startDate    历史数据开始日期
     * @param endDate      历史数据结束日期
     * @param forecastDays 预测天数
     * @param algorithm    预测算法
     * @return 预测结果
     */
    ForecastResult forecastWithAlgorithm(String factoryId, String metricType, LocalDate startDate, LocalDate endDate, int forecastDays, ForecastAlgorithm algorithm);
}
