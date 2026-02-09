package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.MetricResult;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 指标计算服务接口
 *
 * 提供 SmartBI 系统中各类业务指标的计算能力，支持：
 * - 销售指标：销售额、订单数、客单价、目标完成率、环比增长等
 * - 利润指标：毛利额、毛利率、投入产出比等
 * - 应收指标：应收余额、回款率、逾期率、账龄分布等
 * - 预算指标：预算执行率、预算差异等
 *
 * 所有计算使用 BigDecimal 确保精度，并支持按维度分组计算。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 * @see MetricResult
 */
public interface MetricCalculatorService {

    // ==================== 指标代码常量 ====================

    // 销售指标 (5.1)
    String SALES_AMOUNT = "SALES_AMOUNT";
    String ORDER_COUNT = "ORDER_COUNT";
    String AVG_ORDER_VALUE = "AVG_ORDER_VALUE";
    String DAILY_AVG_SALES = "DAILY_AVG_SALES";
    String TARGET_COMPLETION = "TARGET_COMPLETION";
    String TARGET_GAP = "TARGET_GAP";
    String MOM_GROWTH = "MOM_GROWTH";
    String YOY_GROWTH = "YOY_GROWTH";
    String SALES_PER_CAPITA = "SALES_PER_CAPITA";
    String CUSTOMER_COUNT = "CUSTOMER_COUNT";
    String NEW_CUSTOMER = "NEW_CUSTOMER";
    String CUSTOMER_RETENTION = "CUSTOMER_RETENTION";

    // 成本指标 (5.2)
    String TOTAL_COST = "TOTAL_COST";
    String MATERIAL_COST_RATIO = "MATERIAL_COST_RATIO";
    String LABOR_COST_RATIO = "LABOR_COST_RATIO";
    String COST_PER_UNIT = "COST_PER_UNIT";
    String COST_PER_CAPITA = "COST_PER_CAPITA";
    String COST_MOM_CHANGE = "COST_MOM_CHANGE";

    // 利润指标 (5.3)
    String GROSS_PROFIT = "GROSS_PROFIT";
    String GROSS_MARGIN = "GROSS_MARGIN";
    String NET_PROFIT = "NET_PROFIT";
    String NET_MARGIN = "NET_MARGIN";
    String ROI = "ROI";
    String PROFIT_PER_ORDER = "PROFIT_PER_ORDER";
    String MARGIN_MOM_CHANGE = "MARGIN_MOM_CHANGE";

    // 应收指标 (5.4)
    String AR_BALANCE = "AR_BALANCE";
    String AR_TURNOVER_DAYS = "AR_TURNOVER_DAYS";
    String COLLECTION_RATE = "COLLECTION_RATE";
    String OVERDUE_RATIO = "OVERDUE_RATIO";
    String AGING_30_RATIO = "AGING_30_RATIO";
    String AGING_60_RATIO = "AGING_60_RATIO";
    String AGING_90_RATIO = "AGING_90_RATIO";
    String BAD_DEBT_RISK = "BAD_DEBT_RISK";
    String AP_BALANCE = "AP_BALANCE";
    String AP_TURNOVER_DAYS = "AP_TURNOVER_DAYS";

    // 预算指标 (5.5)
    String BUDGET_EXECUTION = "BUDGET_EXECUTION";
    String BUDGET_VARIANCE = "BUDGET_VARIANCE";
    String BUDGET_VARIANCE_RATE = "BUDGET_VARIANCE_RATE";
    String BUDGET_REMAINING = "BUDGET_REMAINING";
    String BUDGET_BURN_RATE = "BUDGET_BURN_RATE";
    String BUDGET_FORECAST = "BUDGET_FORECAST";

    // 效率指标 (5.6)
    String ACTIVE_DAYS = "ACTIVE_DAYS";
    String ACTIVE_RATE = "ACTIVE_RATE";
    String CONVERSION_RATE = "CONVERSION_RATE";
    String PRODUCT_CONVERSION = "PRODUCT_CONVERSION";

    // ==================== 单指标计算 ====================

    /**
     * 计算单个指标
     *
     * @param metricCode    指标代码，使用本接口定义的常量
     * @param data          原始数据列表，每条数据为一个 Map
     * @param fieldMappings 字段映射，将标准字段名映射到实际数据中的字段名
     *                      例如: {"amount" -> "销售额", "order_id" -> "订单号"}
     * @return 计算结果，包含指标值、单位、预警级别等
     */
    MetricResult calculateMetric(String metricCode, List<Map<String, Object>> data, Map<String, String> fieldMappings);

    // ==================== 批量指标计算 ====================

    /**
     * 计算所有适用的指标
     *
     * 根据数据中包含的字段，自动判断可计算的指标并返回结果列表。
     * 例如：如果数据包含 amount 和 cost，则会计算 GROSS_PROFIT 和 GROSS_MARGIN。
     *
     * @param data          原始数据列表
     * @param fieldMappings 字段映射
     * @return 所有可计算指标的结果列表
     */
    List<MetricResult> calculateAllMetrics(List<Map<String, Object>> data, Map<String, String> fieldMappings);

    /**
     * 计算指定类别的所有指标
     *
     * @param category      指标类别: SALES, COST, PROFIT, AR, BUDGET, EFFICIENCY
     * @param data          原始数据列表
     * @param fieldMappings 字段映射
     * @return 该类别下所有可计算指标的结果列表
     */
    List<MetricResult> calculateMetricsByCategory(String category, List<Map<String, Object>> data, Map<String, String> fieldMappings);

    // ==================== 维度分组计算 ====================

    /**
     * 按维度分组计算指标
     *
     * @param data           原始数据列表
     * @param dimensionField 分组维度字段名（映射后的标准字段名）
     *                       例如: "department", "region", "salesperson_name"
     * @param fieldMappings  字段映射
     * @return 按维度值分组的指标结果，Key 为维度值，Value 为该维度下的所有指标
     */
    Map<String, List<MetricResult>> calculateByDimension(List<Map<String, Object>> data, String dimensionField, Map<String, String> fieldMappings);

    /**
     * 按维度计算单个指标
     *
     * @param metricCode     指标代码
     * @param data           原始数据列表
     * @param dimensionField 分组维度字段名
     * @param fieldMappings  字段映射
     * @return 按维度值分组的单指标结果
     */
    Map<String, MetricResult> calculateMetricByDimension(String metricCode, List<Map<String, Object>> data, String dimensionField, Map<String, String> fieldMappings);

    // ==================== 趋势计算 ====================

    /**
     * 计算趋势指标（环比/同比）
     *
     * @param metricCode    指标代码，用于确定趋势指标的类型和名称
     * @param currentValue  当前期数值
     * @param previousValue 上一期数值（环比）或去年同期数值（同比）
     * @return 包含变化率和变化方向的指标结果
     */
    MetricResult calculateTrend(String metricCode, BigDecimal currentValue, BigDecimal previousValue);

    /**
     * 计算环比增长率
     *
     * @param currentValue  当期值
     * @param previousValue 上期值
     * @return 环比增长率（百分比形式，如 15.5 表示增长 15.5%）
     */
    BigDecimal calculateMomGrowth(BigDecimal currentValue, BigDecimal previousValue);

    /**
     * 计算同比增长率
     *
     * @param currentValue     当期值
     * @param lastYearValue    去年同期值
     * @return 同比增长率（百分比形式）
     */
    BigDecimal calculateYoyGrowth(BigDecimal currentValue, BigDecimal lastYearValue);

    // ==================== 预警判断 ====================

    /**
     * 根据阈值配置确定预警级别
     *
     * 预警阈值规则（参考 spec 5.7）：
     * - TARGET_COMPLETION: RED < 60%, YELLOW 60-85%, GREEN > 85%
     * - GROSS_MARGIN: RED < 15%, YELLOW 15-25%, GREEN > 25%
     * - MOM_GROWTH: RED < -20%, YELLOW -20 to -5%, GREEN > -5%
     * - AGING_90_RATIO: RED > 20%, YELLOW 10-20%, GREEN < 10%
     * - BUDGET_EXECUTION: RED > 120%, YELLOW 100-120%, GREEN < 100%
     *
     * @param metricCode 指标代码
     * @param value      指标值
     * @return 预警级别: "GREEN", "YELLOW", "RED"
     */
    String determineAlertLevel(String metricCode, BigDecimal value);

    // ==================== 辅助方法 ====================

    /**
     * 获取指标的元数据信息
     *
     * @param metricCode 指标代码
     * @return 包含指标名称、单位、说明等元数据的 Map
     */
    Map<String, Object> getMetricMetadata(String metricCode);

    /**
     * 检查数据是否支持计算某个指标
     *
     * @param metricCode    指标代码
     * @param fieldMappings 字段映射
     * @return true 如果数据包含计算该指标所需的字段
     */
    boolean canCalculateMetric(String metricCode, Map<String, String> fieldMappings);

    /**
     * 格式化指标值为显示字符串
     *
     * @param metricCode 指标代码
     * @param value      指标值
     * @return 格式化后的字符串，例如 "1,234,567.89" 或 "85.5%"
     */
    String formatMetricValue(String metricCode, BigDecimal value);
}
