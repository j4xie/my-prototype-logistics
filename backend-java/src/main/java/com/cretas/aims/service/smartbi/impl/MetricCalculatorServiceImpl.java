package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.client.PythonSmartBIClient;
import com.cretas.aims.config.smartbi.PythonSmartBIConfig;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.service.smartbi.MetricCalculatorService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 指标计算服务实现
 *
 * 实现 SmartBI 系统中各类业务指标的计算，包括：
 * - 销售指标 (5.1): 销售额、订单数、客单价、目标完成率、环比增长、人均产出
 * - 利润指标 (5.3): 毛利额、毛利率、投入产出比
 * - 应收指标 (5.4): 应收余额、回款率、逾期率、账龄分布
 * - 预算指标 (5.5): 预算执行率、预算差异
 *
 * 所有计算使用 BigDecimal 确保精度，默认保留 2 位小数。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@Service
public class MetricCalculatorServiceImpl implements MetricCalculatorService {

    @Autowired
    private PythonSmartBIClient pythonClient;

    @Autowired
    private PythonSmartBIConfig pythonConfig;

    // 计算精度配置
    private static final int SCALE = 4; // 中间计算精度
    private static final int DISPLAY_SCALE = 2; // 显示精度
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    // 指标元数据定义
    private static final Map<String, MetricMetadata> METRIC_METADATA = new HashMap<>();

    static {
        // 销售指标元数据
        METRIC_METADATA.put(SALES_AMOUNT, new MetricMetadata("销售额", "元", "SUM(amount)", "基础销售金额"));
        METRIC_METADATA.put(ORDER_COUNT, new MetricMetadata("订单数", "单", "COUNT(DISTINCT order_id)", "成交订单数量"));
        METRIC_METADATA.put(AVG_ORDER_VALUE, new MetricMetadata("客单价", "元", "销售额 / 订单数", "平均每单金额"));
        METRIC_METADATA.put(DAILY_AVG_SALES, new MetricMetadata("日均销售", "元", "销售额 / 有效天数", "日均销售额"));
        METRIC_METADATA.put(TARGET_COMPLETION, new MetricMetadata("目标完成率", "%", "实际销售额 / 目标 × 100", "核心考核指标"));
        METRIC_METADATA.put(TARGET_GAP, new MetricMetadata("距目标差额", "元", "目标 - 实际销售额", "完成目标还差多少"));
        METRIC_METADATA.put(MOM_GROWTH, new MetricMetadata("环比增长率", "%", "(本期 - 上期) / 上期 × 100", "与上月对比"));
        METRIC_METADATA.put(YOY_GROWTH, new MetricMetadata("同比增长率", "%", "(本期 - 去年同期) / 去年同期 × 100", "与去年同期对比"));
        METRIC_METADATA.put(SALES_PER_CAPITA, new MetricMetadata("人均产出", "元", "销售额 / 人数", "人效指标"));
        METRIC_METADATA.put(CUSTOMER_COUNT, new MetricMetadata("客户数", "个", "COUNT(DISTINCT customer)", "服务客户数"));

        // 成本指标元数据
        METRIC_METADATA.put(TOTAL_COST, new MetricMetadata("总成本", "元", "SUM(cost)", "成本总额"));
        METRIC_METADATA.put(MATERIAL_COST_RATIO, new MetricMetadata("材料成本占比", "%", "材料成本 / 总成本 × 100", "材料成本结构"));
        METRIC_METADATA.put(LABOR_COST_RATIO, new MetricMetadata("人工成本占比", "%", "人工成本 / 总成本 × 100", "人工成本结构"));
        METRIC_METADATA.put(COST_PER_UNIT, new MetricMetadata("单位成本", "元", "总成本 / 销售数量", "单件成本"));
        METRIC_METADATA.put(COST_PER_CAPITA, new MetricMetadata("人均成本", "元", "总成本 / 人数", "人均投入"));

        // 利润指标元数据
        METRIC_METADATA.put(GROSS_PROFIT, new MetricMetadata("毛利额", "元", "销售额 - 成本", "毛利润"));
        METRIC_METADATA.put(GROSS_MARGIN, new MetricMetadata("毛利率", "%", "毛利额 / 销售额 × 100", "盈利质量"));
        METRIC_METADATA.put(NET_PROFIT, new MetricMetadata("净利润", "元", "毛利 - 费用", "最终利润"));
        METRIC_METADATA.put(NET_MARGIN, new MetricMetadata("净利率", "%", "净利润 / 销售额 × 100", "净盈利能力"));
        METRIC_METADATA.put(ROI, new MetricMetadata("投入产出比", "%", "毛利 / 成本 × 100", "投资回报"));
        METRIC_METADATA.put(PROFIT_PER_ORDER, new MetricMetadata("单笔利润", "元", "毛利额 / 订单数", "每单贡献"));

        // 应收指标元数据
        METRIC_METADATA.put(AR_BALANCE, new MetricMetadata("应收余额", "元", "SUM(应收账款)", "应收总额"));
        METRIC_METADATA.put(COLLECTION_RATE, new MetricMetadata("回款率", "%", "已回款 / 应收总额 × 100", "收款能力"));
        METRIC_METADATA.put(OVERDUE_RATIO, new MetricMetadata("逾期率", "%", "逾期应收 / 应收总额 × 100", "风险指标"));
        METRIC_METADATA.put(AGING_30_RATIO, new MetricMetadata("30天以上账龄占比", "%", "30天以上应收 / 应收总额 × 100", "账龄分布"));
        METRIC_METADATA.put(AGING_60_RATIO, new MetricMetadata("60天以上账龄占比", "%", "60天以上应收 / 应收总额 × 100", "账龄分布"));
        METRIC_METADATA.put(AGING_90_RATIO, new MetricMetadata("90天以上账龄占比", "%", "90天以上应收 / 应收总额 × 100", "高风险占比"));

        // 预算指标元数据
        METRIC_METADATA.put(BUDGET_EXECUTION, new MetricMetadata("预算执行率", "%", "实际支出 / 预算 × 100", "执行进度"));
        METRIC_METADATA.put(BUDGET_VARIANCE, new MetricMetadata("预算差异", "元", "实际 - 预算", "偏差金额"));
        METRIC_METADATA.put(BUDGET_VARIANCE_RATE, new MetricMetadata("预算偏差率", "%", "(实际 - 预算) / 预算 × 100", "偏差比例"));
        METRIC_METADATA.put(BUDGET_REMAINING, new MetricMetadata("预算剩余", "元", "预算 - 已执行", "剩余额度"));
    }

    // 指标所需字段映射
    private static final Map<String, List<String>> METRIC_REQUIRED_FIELDS = new HashMap<>();

    static {
        METRIC_REQUIRED_FIELDS.put(SALES_AMOUNT, Arrays.asList("amount"));
        METRIC_REQUIRED_FIELDS.put(ORDER_COUNT, Arrays.asList("order_id"));
        METRIC_REQUIRED_FIELDS.put(AVG_ORDER_VALUE, Arrays.asList("amount", "order_id"));
        METRIC_REQUIRED_FIELDS.put(TARGET_COMPLETION, Arrays.asList("amount", "monthly_target"));
        METRIC_REQUIRED_FIELDS.put(TARGET_GAP, Arrays.asList("amount", "monthly_target"));
        METRIC_REQUIRED_FIELDS.put(SALES_PER_CAPITA, Arrays.asList("amount", "headcount"));
        METRIC_REQUIRED_FIELDS.put(CUSTOMER_COUNT, Arrays.asList("customer_name"));

        METRIC_REQUIRED_FIELDS.put(TOTAL_COST, Arrays.asList("cost"));
        METRIC_REQUIRED_FIELDS.put(MATERIAL_COST_RATIO, Arrays.asList("material_cost", "cost"));
        METRIC_REQUIRED_FIELDS.put(LABOR_COST_RATIO, Arrays.asList("labor_cost", "cost"));

        METRIC_REQUIRED_FIELDS.put(GROSS_PROFIT, Arrays.asList("amount", "cost"));
        METRIC_REQUIRED_FIELDS.put(GROSS_MARGIN, Arrays.asList("amount", "cost"));
        METRIC_REQUIRED_FIELDS.put(ROI, Arrays.asList("amount", "cost"));

        METRIC_REQUIRED_FIELDS.put(AR_BALANCE, Arrays.asList("accounts_receivable"));
        METRIC_REQUIRED_FIELDS.put(COLLECTION_RATE, Arrays.asList("collection", "accounts_receivable"));
        METRIC_REQUIRED_FIELDS.put(OVERDUE_RATIO, Arrays.asList("overdue_amount", "accounts_receivable"));
        METRIC_REQUIRED_FIELDS.put(AGING_30_RATIO, Arrays.asList("aging_30", "accounts_receivable"));
        METRIC_REQUIRED_FIELDS.put(AGING_60_RATIO, Arrays.asList("aging_60", "accounts_receivable"));
        METRIC_REQUIRED_FIELDS.put(AGING_90_RATIO, Arrays.asList("aging_90", "accounts_receivable"));

        METRIC_REQUIRED_FIELDS.put(BUDGET_EXECUTION, Arrays.asList("actual_amount", "budget_amount"));
        METRIC_REQUIRED_FIELDS.put(BUDGET_VARIANCE, Arrays.asList("actual_amount", "budget_amount"));
    }

    // 指标类别映射
    private static final Map<String, List<String>> CATEGORY_METRICS = new HashMap<>();

    static {
        CATEGORY_METRICS.put("SALES", Arrays.asList(
                SALES_AMOUNT, ORDER_COUNT, AVG_ORDER_VALUE, DAILY_AVG_SALES,
                TARGET_COMPLETION, TARGET_GAP, MOM_GROWTH, YOY_GROWTH,
                SALES_PER_CAPITA, CUSTOMER_COUNT
        ));
        CATEGORY_METRICS.put("COST", Arrays.asList(
                TOTAL_COST, MATERIAL_COST_RATIO, LABOR_COST_RATIO,
                COST_PER_UNIT, COST_PER_CAPITA, COST_MOM_CHANGE
        ));
        CATEGORY_METRICS.put("PROFIT", Arrays.asList(
                GROSS_PROFIT, GROSS_MARGIN, NET_PROFIT, NET_MARGIN,
                ROI, PROFIT_PER_ORDER, MARGIN_MOM_CHANGE
        ));
        CATEGORY_METRICS.put("AR", Arrays.asList(
                AR_BALANCE, AR_TURNOVER_DAYS, COLLECTION_RATE, OVERDUE_RATIO,
                AGING_30_RATIO, AGING_60_RATIO, AGING_90_RATIO, BAD_DEBT_RISK
        ));
        CATEGORY_METRICS.put("BUDGET", Arrays.asList(
                BUDGET_EXECUTION, BUDGET_VARIANCE, BUDGET_VARIANCE_RATE,
                BUDGET_REMAINING, BUDGET_BURN_RATE, BUDGET_FORECAST
        ));
        CATEGORY_METRICS.put("EFFICIENCY", Arrays.asList(
                ACTIVE_DAYS, ACTIVE_RATE, CONVERSION_RATE, PRODUCT_CONVERSION
        ));
    }

    // ==================== 单指标计算 ====================

    @Override
    public MetricResult calculateMetric(String metricCode, List<Map<String, Object>> data,
                                        Map<String, String> fieldMappings) {
        if (data == null || data.isEmpty()) {
            log.warn("计算指标 {} 失败：数据为空", metricCode);
            return createEmptyResult(metricCode);
        }

        // 尝试使用 Python 服务计算指标
        MetricResult pythonResult = calculateMetricWithPython(metricCode, data, fieldMappings);
        if (pythonResult != null) {
            return pythonResult;
        }

        // 降级到 Java 实现
        try {
            BigDecimal value = doCalculate(metricCode, data, fieldMappings);
            String alertLevel = determineAlertLevel(metricCode, value);

            MetricMetadata metadata = METRIC_METADATA.get(metricCode);
            String metricName = metadata != null ? metadata.name : metricCode;
            String unit = metadata != null ? metadata.unit : "";

            return MetricResult.builder()
                    .metricCode(metricCode)
                    .metricName(metricName)
                    .value(value.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .formattedValue(formatMetricValue(metricCode, value))
                    .unit(unit)
                    .alertLevel(alertLevel)
                    .description(metadata != null ? metadata.description : null)
                    .build();
        } catch (Exception e) {
            log.error("计算指标 {} 时发生错误: {}", metricCode, e.getMessage(), e);
            return createEmptyResult(metricCode);
        }
    }

    /**
     * 使用 Python 服务计算指标（带降级逻辑）
     *
     * @param metricCode    指标代码
     * @param data          数据列表
     * @param fieldMappings 字段映射
     * @return 计算结果，如果 Python 服务不可用或失败则返回 null
     */
    private MetricResult calculateMetricWithPython(String metricCode, List<Map<String, Object>> data,
                                                    Map<String, String> fieldMappings) {
        if (!pythonConfig.isEnabled()) {
            log.debug("Python SmartBI 服务已禁用，使用 Java 计算指标");
            return null;
        }

        try {
            if (pythonClient.isAvailable()) {
                log.info("使用 Python SmartBI 服务计算指标: metricCode={}", metricCode);
                MetricResult result = pythonClient.calculateMetric(metricCode, data, fieldMappings);

                if (result != null && result.getValue() != null) {
                    log.info("Python SmartBI 指标计算成功: metricCode={}, value={}",
                            metricCode, result.getValue());
                    return result;
                } else {
                    log.warn("Python SmartBI 指标计算返回空结果，降级到 Java 计算");
                }
            } else {
                log.debug("Python SmartBI 服务不可用，使用 Java 计算指标");
            }
        } catch (Exception e) {
            log.warn("Python SmartBI 指标计算失败，降级到 Java 计算: {}", e.getMessage());

            if (!pythonConfig.isFallbackOnError()) {
                log.error("Python SmartBI 服务不可用且不允许降级");
                return createEmptyResult(metricCode);
            }
        }

        return null;
    }

    /**
     * 执行具体的指标计算
     */
    private BigDecimal doCalculate(String metricCode, List<Map<String, Object>> data,
                                   Map<String, String> fieldMappings) {
        switch (metricCode) {
            // 销售指标
            case SALES_AMOUNT:
                return sumField(data, getActualField("amount", fieldMappings));
            case ORDER_COUNT:
                return countDistinct(data, getActualField("order_id", fieldMappings));
            case AVG_ORDER_VALUE:
                return calculateAvgOrderValue(data, fieldMappings);
            case TARGET_COMPLETION:
                return calculateTargetCompletion(data, fieldMappings);
            case TARGET_GAP:
                return calculateTargetGap(data, fieldMappings);
            case SALES_PER_CAPITA:
                return calculateSalesPerCapita(data, fieldMappings);
            case CUSTOMER_COUNT:
                return countDistinct(data, getActualField("customer_name", fieldMappings));

            // 成本指标
            case TOTAL_COST:
                return sumField(data, getActualField("cost", fieldMappings));
            case MATERIAL_COST_RATIO:
                return calculateCostRatio(data, "material_cost", fieldMappings);
            case LABOR_COST_RATIO:
                return calculateCostRatio(data, "labor_cost", fieldMappings);

            // 利润指标
            case GROSS_PROFIT:
                return calculateGrossProfit(data, fieldMappings);
            case GROSS_MARGIN:
                return calculateGrossMargin(data, fieldMappings);
            case ROI:
                return calculateRoi(data, fieldMappings);

            // 应收指标
            case AR_BALANCE:
                return sumField(data, getActualField("accounts_receivable", fieldMappings));
            case COLLECTION_RATE:
                return calculateCollectionRate(data, fieldMappings);
            case OVERDUE_RATIO:
                return calculateOverdueRatio(data, fieldMappings);
            case AGING_30_RATIO:
                return calculateAgingRatio(data, "aging_30", fieldMappings);
            case AGING_60_RATIO:
                return calculateAgingRatio(data, "aging_60", fieldMappings);
            case AGING_90_RATIO:
                return calculateAgingRatio(data, "aging_90", fieldMappings);

            // 预算指标
            case BUDGET_EXECUTION:
                return calculateBudgetExecution(data, fieldMappings);
            case BUDGET_VARIANCE:
                return calculateBudgetVariance(data, fieldMappings);

            default:
                log.warn("未知的指标代码: {}", metricCode);
                return BigDecimal.ZERO;
        }
    }

    // ==================== 批量指标计算 ====================

    @Override
    public List<MetricResult> calculateAllMetrics(List<Map<String, Object>> data,
                                                   Map<String, String> fieldMappings) {
        // 尝试使用 Python 服务批量计算指标
        List<MetricResult> pythonResults = calculateAllMetricsWithPython(data, fieldMappings);
        if (pythonResults != null && !pythonResults.isEmpty()) {
            return pythonResults;
        }

        // 降级到 Java 实现
        List<MetricResult> results = new ArrayList<>();

        for (String metricCode : METRIC_REQUIRED_FIELDS.keySet()) {
            if (canCalculateMetric(metricCode, fieldMappings)) {
                MetricResult result = calculateMetric(metricCode, data, fieldMappings);
                if (result != null && result.getValue() != null) {
                    results.add(result);
                }
            }
        }

        return results;
    }

    /**
     * 使用 Python 服务批量计算指标（带降级逻辑）
     *
     * @param data          数据列表
     * @param fieldMappings 字段映射
     * @return 计算结果列表，如果 Python 服务不可用或失败则返回 null
     */
    private List<MetricResult> calculateAllMetricsWithPython(List<Map<String, Object>> data,
                                                               Map<String, String> fieldMappings) {
        if (!pythonConfig.isEnabled()) {
            log.debug("Python SmartBI 服务已禁用，使用 Java 批量计算指标");
            return null;
        }

        try {
            if (pythonClient.isAvailable()) {
                log.info("使用 Python SmartBI 服务批量计算指标: dataSize={}", data.size());
                List<MetricResult> results = pythonClient.calculateAllMetrics(data, fieldMappings);

                if (results != null && !results.isEmpty()) {
                    log.info("Python SmartBI 批量指标计算成功: resultCount={}", results.size());
                    return results;
                } else {
                    log.warn("Python SmartBI 批量指标计算返回空结果，降级到 Java 计算");
                }
            } else {
                log.debug("Python SmartBI 服务不可用，使用 Java 批量计算指标");
            }
        } catch (Exception e) {
            log.warn("Python SmartBI 批量指标计算失败，降级到 Java 计算: {}", e.getMessage());

            if (!pythonConfig.isFallbackOnError()) {
                log.error("Python SmartBI 服务不可用且不允许降级");
                return Collections.emptyList();
            }
        }

        return null;
    }

    @Override
    public List<MetricResult> calculateMetricsByCategory(String category, List<Map<String, Object>> data,
                                                          Map<String, String> fieldMappings) {
        List<String> metricsInCategory = CATEGORY_METRICS.get(category.toUpperCase());
        if (metricsInCategory == null) {
            log.warn("未知的指标类别: {}", category);
            return Collections.emptyList();
        }

        List<MetricResult> results = new ArrayList<>();
        for (String metricCode : metricsInCategory) {
            if (canCalculateMetric(metricCode, fieldMappings)) {
                MetricResult result = calculateMetric(metricCode, data, fieldMappings);
                if (result != null && result.getValue() != null) {
                    results.add(result);
                }
            }
        }

        return results;
    }

    // ==================== 维度分组计算 ====================

    @Override
    public Map<String, List<MetricResult>> calculateByDimension(List<Map<String, Object>> data,
                                                                  String dimensionField,
                                                                  Map<String, String> fieldMappings) {
        if (data == null || data.isEmpty()) {
            return Collections.emptyMap();
        }

        String actualDimensionField = getActualField(dimensionField, fieldMappings);
        Map<String, List<Map<String, Object>>> groupedData = groupByField(data, actualDimensionField);

        Map<String, List<MetricResult>> results = new LinkedHashMap<>();
        for (Map.Entry<String, List<Map<String, Object>>> entry : groupedData.entrySet()) {
            String dimensionValue = entry.getKey();
            List<Map<String, Object>> groupData = entry.getValue();

            List<MetricResult> metrics = calculateAllMetrics(groupData, fieldMappings);
            // 设置维度值
            for (MetricResult metric : metrics) {
                metric.setDimensionValue(dimensionValue);
            }
            results.put(dimensionValue, metrics);
        }

        return results;
    }

    @Override
    public Map<String, MetricResult> calculateMetricByDimension(String metricCode,
                                                                  List<Map<String, Object>> data,
                                                                  String dimensionField,
                                                                  Map<String, String> fieldMappings) {
        if (data == null || data.isEmpty()) {
            return Collections.emptyMap();
        }

        String actualDimensionField = getActualField(dimensionField, fieldMappings);
        Map<String, List<Map<String, Object>>> groupedData = groupByField(data, actualDimensionField);

        Map<String, MetricResult> results = new LinkedHashMap<>();
        for (Map.Entry<String, List<Map<String, Object>>> entry : groupedData.entrySet()) {
            String dimensionValue = entry.getKey();
            List<Map<String, Object>> groupData = entry.getValue();

            MetricResult metric = calculateMetric(metricCode, groupData, fieldMappings);
            if (metric != null) {
                metric.setDimensionValue(dimensionValue);
                results.put(dimensionValue, metric);
            }
        }

        return results;
    }

    // ==================== 趋势计算 ====================

    @Override
    public MetricResult calculateTrend(String metricCode, BigDecimal currentValue, BigDecimal previousValue) {
        if (currentValue == null || previousValue == null) {
            return createEmptyResult(metricCode);
        }

        BigDecimal changeValue = currentValue.subtract(previousValue);
        BigDecimal changePercent = calculateMomGrowth(currentValue, previousValue);
        String changeDirection = determineChangeDirection(changePercent);
        String alertLevel = determineAlertLevel(MOM_GROWTH, changePercent);

        MetricMetadata metadata = METRIC_METADATA.get(metricCode);
        String metricName = (metadata != null ? metadata.name : metricCode) + " 变化";

        return MetricResult.builder()
                .metricCode(metricCode + "_TREND")
                .metricName(metricName)
                .value(currentValue.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(formatMetricValue(metricCode, currentValue))
                .unit(metadata != null ? metadata.unit : "")
                .changeValue(changeValue.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .changePercent(changePercent.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .changeDirection(changeDirection)
                .alertLevel(alertLevel)
                .build();
    }

    @Override
    public BigDecimal calculateMomGrowth(BigDecimal currentValue, BigDecimal previousValue) {
        if (previousValue == null || previousValue.compareTo(BigDecimal.ZERO) == 0) {
            return currentValue != null && currentValue.compareTo(BigDecimal.ZERO) > 0
                    ? new BigDecimal("100") : BigDecimal.ZERO;
        }
        if (currentValue == null) {
            return new BigDecimal("-100");
        }

        return currentValue.subtract(previousValue)
                .divide(previousValue.abs(), SCALE, ROUNDING_MODE)
                .multiply(new BigDecimal("100"))
                .setScale(DISPLAY_SCALE, ROUNDING_MODE);
    }

    @Override
    public BigDecimal calculateYoyGrowth(BigDecimal currentValue, BigDecimal lastYearValue) {
        // 同比计算逻辑与环比相同
        return calculateMomGrowth(currentValue, lastYearValue);
    }

    // ==================== 预警判断 ====================

    @Override
    public String determineAlertLevel(String metricCode, BigDecimal value) {
        if (value == null) {
            return MetricResult.AlertLevel.YELLOW.name();
        }

        double v = value.doubleValue();

        switch (metricCode) {
            // 目标完成率: RED < 60%, YELLOW 60-85%, GREEN > 85%
            case TARGET_COMPLETION:
                if (v < 60) return MetricResult.AlertLevel.RED.name();
                if (v < 85) return MetricResult.AlertLevel.YELLOW.name();
                return MetricResult.AlertLevel.GREEN.name();

            // 毛利率: RED < 15%, YELLOW 15-25%, GREEN > 25%
            case GROSS_MARGIN:
                if (v < 15) return MetricResult.AlertLevel.RED.name();
                if (v < 25) return MetricResult.AlertLevel.YELLOW.name();
                return MetricResult.AlertLevel.GREEN.name();

            // 环比增长率: RED < -20%, YELLOW -20 to -5%, GREEN > -5%
            case MOM_GROWTH:
            case YOY_GROWTH:
            case COST_MOM_CHANGE:
            case MARGIN_MOM_CHANGE:
                if (v < -20) return MetricResult.AlertLevel.RED.name();
                if (v < -5) return MetricResult.AlertLevel.YELLOW.name();
                return MetricResult.AlertLevel.GREEN.name();

            // 90天以上账龄占比: RED > 20%, YELLOW 10-20%, GREEN < 10%
            case AGING_90_RATIO:
                if (v > 20) return MetricResult.AlertLevel.RED.name();
                if (v > 10) return MetricResult.AlertLevel.YELLOW.name();
                return MetricResult.AlertLevel.GREEN.name();

            // 60天以上账龄占比
            case AGING_60_RATIO:
                if (v > 30) return MetricResult.AlertLevel.RED.name();
                if (v > 15) return MetricResult.AlertLevel.YELLOW.name();
                return MetricResult.AlertLevel.GREEN.name();

            // 30天以上账龄占比
            case AGING_30_RATIO:
                if (v > 50) return MetricResult.AlertLevel.RED.name();
                if (v > 25) return MetricResult.AlertLevel.YELLOW.name();
                return MetricResult.AlertLevel.GREEN.name();

            // 逾期率
            case OVERDUE_RATIO:
                if (v > 15) return MetricResult.AlertLevel.RED.name();
                if (v > 5) return MetricResult.AlertLevel.YELLOW.name();
                return MetricResult.AlertLevel.GREEN.name();

            // 回款率: 越高越好
            case COLLECTION_RATE:
                if (v < 60) return MetricResult.AlertLevel.RED.name();
                if (v < 80) return MetricResult.AlertLevel.YELLOW.name();
                return MetricResult.AlertLevel.GREEN.name();

            // 预算执行率: RED > 120%, YELLOW 100-120%, GREEN < 100%
            case BUDGET_EXECUTION:
                if (v > 120) return MetricResult.AlertLevel.RED.name();
                if (v > 100) return MetricResult.AlertLevel.YELLOW.name();
                return MetricResult.AlertLevel.GREEN.name();

            // 预算偏差率
            case BUDGET_VARIANCE_RATE:
                double absV = Math.abs(v);
                if (absV > 20) return MetricResult.AlertLevel.RED.name();
                if (absV > 10) return MetricResult.AlertLevel.YELLOW.name();
                return MetricResult.AlertLevel.GREEN.name();

            // ROI: 越高越好
            case ROI:
                if (v < 0) return MetricResult.AlertLevel.RED.name();
                if (v < 20) return MetricResult.AlertLevel.YELLOW.name();
                return MetricResult.AlertLevel.GREEN.name();

            default:
                return MetricResult.AlertLevel.GREEN.name();
        }
    }

    // ==================== 辅助方法 ====================

    @Override
    public Map<String, Object> getMetricMetadata(String metricCode) {
        MetricMetadata metadata = METRIC_METADATA.get(metricCode);
        if (metadata == null) {
            return Collections.emptyMap();
        }

        Map<String, Object> result = new HashMap<>();
        result.put("name", metadata.name);
        result.put("unit", metadata.unit);
        result.put("formula", metadata.formula);
        result.put("description", metadata.description);
        result.put("requiredFields", METRIC_REQUIRED_FIELDS.getOrDefault(metricCode, Collections.emptyList()));

        return result;
    }

    @Override
    public boolean canCalculateMetric(String metricCode, Map<String, String> fieldMappings) {
        List<String> requiredFields = METRIC_REQUIRED_FIELDS.get(metricCode);
        if (requiredFields == null || requiredFields.isEmpty()) {
            return false;
        }

        for (String field : requiredFields) {
            if (!fieldMappings.containsKey(field)) {
                return false;
            }
        }
        return true;
    }

    @Override
    public String formatMetricValue(String metricCode, BigDecimal value) {
        if (value == null) {
            return "-";
        }

        MetricMetadata metadata = METRIC_METADATA.get(metricCode);
        String unit = metadata != null ? metadata.unit : "";

        // 百分比格式
        if ("%".equals(unit)) {
            return new DecimalFormat("#,##0.00").format(value) + "%";
        }

        // 金额格式
        if ("元".equals(unit)) {
            return new DecimalFormat("#,##0.00").format(value);
        }

        // 计数格式
        if ("单".equals(unit) || "个".equals(unit) || "天".equals(unit)) {
            return new DecimalFormat("#,##0").format(value);
        }

        return new DecimalFormat("#,##0.00").format(value);
    }

    // ==================== 私有计算方法 ====================

    /**
     * 计算字段求和
     */
    private BigDecimal sumField(List<Map<String, Object>> data, String field) {
        return data.stream()
                .map(row -> getBigDecimalValue(row, field))
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * 计算去重计数
     */
    private BigDecimal countDistinct(List<Map<String, Object>> data, String field) {
        long count = data.stream()
                .map(row -> row.get(field))
                .filter(Objects::nonNull)
                .map(Object::toString)
                .distinct()
                .count();
        return new BigDecimal(count);
    }

    /**
     * 计算客单价
     */
    private BigDecimal calculateAvgOrderValue(List<Map<String, Object>> data, Map<String, String> fieldMappings) {
        BigDecimal salesAmount = sumField(data, getActualField("amount", fieldMappings));
        BigDecimal orderCount = countDistinct(data, getActualField("order_id", fieldMappings));

        if (orderCount.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        return salesAmount.divide(orderCount, SCALE, ROUNDING_MODE);
    }

    /**
     * 计算目标完成率
     */
    private BigDecimal calculateTargetCompletion(List<Map<String, Object>> data, Map<String, String> fieldMappings) {
        BigDecimal actual = sumField(data, getActualField("amount", fieldMappings));
        BigDecimal target = sumField(data, getActualField("monthly_target", fieldMappings));

        if (target.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        return actual.divide(target, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"));
    }

    /**
     * 计算距目标差额
     */
    private BigDecimal calculateTargetGap(List<Map<String, Object>> data, Map<String, String> fieldMappings) {
        BigDecimal actual = sumField(data, getActualField("amount", fieldMappings));
        BigDecimal target = sumField(data, getActualField("monthly_target", fieldMappings));

        return target.subtract(actual);
    }

    /**
     * 计算人均产出
     */
    private BigDecimal calculateSalesPerCapita(List<Map<String, Object>> data, Map<String, String> fieldMappings) {
        BigDecimal salesAmount = sumField(data, getActualField("amount", fieldMappings));
        BigDecimal headcount = sumField(data, getActualField("headcount", fieldMappings));

        if (headcount.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        return salesAmount.divide(headcount, SCALE, ROUNDING_MODE);
    }

    /**
     * 计算成本占比
     */
    private BigDecimal calculateCostRatio(List<Map<String, Object>> data, String costField,
                                          Map<String, String> fieldMappings) {
        BigDecimal specificCost = sumField(data, getActualField(costField, fieldMappings));
        BigDecimal totalCost = sumField(data, getActualField("cost", fieldMappings));

        if (totalCost.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        return specificCost.divide(totalCost, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"));
    }

    /**
     * 计算毛利额
     */
    private BigDecimal calculateGrossProfit(List<Map<String, Object>> data, Map<String, String> fieldMappings) {
        BigDecimal revenue = sumField(data, getActualField("amount", fieldMappings));
        BigDecimal cost = sumField(data, getActualField("cost", fieldMappings));

        return revenue.subtract(cost);
    }

    /**
     * 计算毛利率
     */
    private BigDecimal calculateGrossMargin(List<Map<String, Object>> data, Map<String, String> fieldMappings) {
        BigDecimal profit = calculateGrossProfit(data, fieldMappings);
        BigDecimal revenue = sumField(data, getActualField("amount", fieldMappings));

        if (revenue.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        return profit.divide(revenue, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"));
    }

    /**
     * 计算 ROI
     */
    private BigDecimal calculateRoi(List<Map<String, Object>> data, Map<String, String> fieldMappings) {
        BigDecimal profit = calculateGrossProfit(data, fieldMappings);
        BigDecimal cost = sumField(data, getActualField("cost", fieldMappings));

        if (cost.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        return profit.divide(cost, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"));
    }

    /**
     * 计算回款率
     */
    private BigDecimal calculateCollectionRate(List<Map<String, Object>> data, Map<String, String> fieldMappings) {
        BigDecimal collected = sumField(data, getActualField("collection", fieldMappings));
        BigDecimal receivable = sumField(data, getActualField("accounts_receivable", fieldMappings));

        if (receivable.compareTo(BigDecimal.ZERO) == 0) {
            return new BigDecimal("100");
        }

        return collected.divide(receivable, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"));
    }

    /**
     * 计算逾期率
     */
    private BigDecimal calculateOverdueRatio(List<Map<String, Object>> data, Map<String, String> fieldMappings) {
        BigDecimal overdue = sumField(data, getActualField("overdue_amount", fieldMappings));
        BigDecimal total = sumField(data, getActualField("accounts_receivable", fieldMappings));

        if (total.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        return overdue.divide(total, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"));
    }

    /**
     * 计算账龄占比
     */
    private BigDecimal calculateAgingRatio(List<Map<String, Object>> data, String agingField,
                                           Map<String, String> fieldMappings) {
        BigDecimal aging = sumField(data, getActualField(agingField, fieldMappings));
        BigDecimal total = sumField(data, getActualField("accounts_receivable", fieldMappings));

        if (total.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        return aging.divide(total, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"));
    }

    /**
     * 计算预算执行率
     */
    private BigDecimal calculateBudgetExecution(List<Map<String, Object>> data, Map<String, String> fieldMappings) {
        BigDecimal actual = sumField(data, getActualField("actual_amount", fieldMappings));
        BigDecimal budget = sumField(data, getActualField("budget_amount", fieldMappings));

        if (budget.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        return actual.divide(budget, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"));
    }

    /**
     * 计算预算差异
     */
    private BigDecimal calculateBudgetVariance(List<Map<String, Object>> data, Map<String, String> fieldMappings) {
        BigDecimal actual = sumField(data, getActualField("actual_amount", fieldMappings));
        BigDecimal budget = sumField(data, getActualField("budget_amount", fieldMappings));

        return actual.subtract(budget);
    }

    // ==================== 工具方法 ====================

    /**
     * 获取实际字段名
     */
    private String getActualField(String standardField, Map<String, String> fieldMappings) {
        return fieldMappings.getOrDefault(standardField, standardField);
    }

    /**
     * 从 Map 中获取 BigDecimal 值
     */
    private BigDecimal getBigDecimalValue(Map<String, Object> row, String field) {
        Object value = row.get(field);
        if (value == null) {
            return null;
        }
        if (value instanceof BigDecimal) {
            return (BigDecimal) value;
        }
        if (value instanceof Number) {
            return new BigDecimal(value.toString());
        }
        try {
            String strValue = value.toString().replaceAll("[,￥$%]", "").trim();
            if (strValue.isEmpty() || "-".equals(strValue)) {
                return null;
            }
            return new BigDecimal(strValue);
        } catch (NumberFormatException e) {
            log.debug("无法解析数值: field={}, value={}", field, value);
            return null;
        }
    }

    /**
     * 按字段分组数据
     */
    private Map<String, List<Map<String, Object>>> groupByField(List<Map<String, Object>> data, String field) {
        return data.stream()
                .filter(row -> row.get(field) != null)
                .collect(Collectors.groupingBy(
                        row -> row.get(field).toString(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
    }

    /**
     * 确定变化方向
     */
    private String determineChangeDirection(BigDecimal changePercent) {
        if (changePercent == null) {
            return "STABLE";
        }
        int cmp = changePercent.compareTo(BigDecimal.ZERO);
        if (cmp > 0) {
            return "UP";
        } else if (cmp < 0) {
            return "DOWN";
        } else {
            return "STABLE";
        }
    }

    /**
     * 创建空结果
     */
    private MetricResult createEmptyResult(String metricCode) {
        MetricMetadata metadata = METRIC_METADATA.get(metricCode);
        return MetricResult.builder()
                .metricCode(metricCode)
                .metricName(metadata != null ? metadata.name : metricCode)
                .value(null)
                .formattedValue("-")
                .unit(metadata != null ? metadata.unit : "")
                .alertLevel(MetricResult.AlertLevel.YELLOW.name())
                .build();
    }

    // ==================== 内部类 ====================

    /**
     * 指标元数据
     */
    private static class MetricMetadata {
        final String name;
        final String unit;
        final String formula;
        final String description;

        MetricMetadata(String name, String unit, String formula, String description) {
            this.name = name;
            this.unit = unit;
            this.formula = formula;
            this.description = description;
        }
    }
}
