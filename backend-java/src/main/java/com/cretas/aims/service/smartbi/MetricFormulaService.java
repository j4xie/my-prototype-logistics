package com.cretas.aims.service.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiMetricFormula;

import java.util.List;
import java.util.Map;

/**
 * 指标公式服务接口
 *
 * 提供指标公式的管理和计算能力，包括：
 * - 公式配置获取（支持工厂级覆盖）
 * - SpEL 表达式计算
 * - 指标值格式化
 * - 公式缓存热重载
 *
 * 使用示例：
 * <pre>
 * // 获取公式配置
 * SmartBiMetricFormula formula = metricFormulaService.getFormula("sales_amount");
 *
 * // 计算指标值
 * Map<String, Object> context = new HashMap<>();
 * context.put("salesAmount", new BigDecimal("100000"));
 * context.put("grossProfit", new BigDecimal("30000"));
 * Object result = metricFormulaService.calculateMetric("gross_margin_rate", context);
 *
 * // 格式化输出
 * String formatted = metricFormulaService.formatMetricValue("sales_amount", result);
 * </pre>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 * @see SmartBiMetricFormula
 */
public interface MetricFormulaService {

    /**
     * 获取全局指标公式配置
     *
     * @param metricCode 指标代码
     * @return 公式配置，未找到时返回 null
     */
    SmartBiMetricFormula getFormula(String metricCode);

    /**
     * 获取指定工厂的指标公式配置
     * 优先返回工厂级配置，如无则返回全局配置
     *
     * @param metricCode 指标代码
     * @param factoryId  工厂ID
     * @return 公式配置，未找到时返回 null
     */
    SmartBiMetricFormula getFormula(String metricCode, String factoryId);

    /**
     * 计算指标值
     *
     * 根据公式类型执行不同的计算逻辑：
     * - SIMPLE: 直接从 context 中获取 baseField 的值
     * - DERIVED/CUSTOM: 使用 SpEL 解析并计算 formulaExpression
     *
     * SpEL 表达式中的变量使用 # 前缀引用 context 中的值。
     * 例如：#grossProfit / #salesAmount * 100
     *
     * @param metricCode 指标代码
     * @param context    计算上下文，包含所需的变量值
     * @return 计算结果
     * @throws IllegalArgumentException 如果指标代码不存在
     * @throws org.springframework.expression.EvaluationException 如果表达式计算失败
     */
    Object calculateMetric(String metricCode, Map<String, Object> context);

    /**
     * 使用指定工厂配置计算指标值
     *
     * @param metricCode 指标代码
     * @param factoryId  工厂ID
     * @param context    计算上下文
     * @return 计算结果
     */
    Object calculateMetric(String metricCode, String factoryId, Map<String, Object> context);

    /**
     * 格式化指标值
     *
     * 根据公式配置的 formatPattern 和 unit 格式化输出。
     * 例如：
     * - 100000.00 -> "100,000.00元"（金额类）
     * - 0.3 -> "30.00%"（百分比类）
     *
     * @param metricCode 指标代码
     * @param value      指标值
     * @return 格式化后的字符串
     */
    String formatMetricValue(String metricCode, Object value);

    /**
     * 使用指定工厂配置格式化指标值
     *
     * @param metricCode 指标代码
     * @param factoryId  工厂ID
     * @param value      指标值
     * @return 格式化后的字符串
     */
    String formatMetricValue(String metricCode, String factoryId, Object value);

    /**
     * 获取所有启用的公式配置
     *
     * @return 公式配置列表
     */
    List<SmartBiMetricFormula> getAllFormulas();

    /**
     * 获取指定工厂的有效公式配置
     * 包含全局配置和工厂级配置（工厂级优先）
     *
     * @param factoryId 工厂ID
     * @return 公式配置列表
     */
    List<SmartBiMetricFormula> getFormulasForFactory(String factoryId);

    /**
     * 重新加载公式缓存
     *
     * 当数据库中的公式配置发生变化时，调用此方法刷新缓存。
     * 支持热更新，无需重启服务。
     */
    void reload();

    /**
     * 检查指标代码是否存在
     *
     * @param metricCode 指标代码
     * @return 是否存在
     */
    boolean exists(String metricCode);

    /**
     * 批量计算多个指标
     *
     * @param metricCodes 指标代码列表
     * @param context     计算上下文
     * @return 指标代码 -> 计算结果的映射
     */
    Map<String, Object> calculateMetrics(List<String> metricCodes, Map<String, Object> context);

    /**
     * 获取指标的单位
     *
     * @param metricCode 指标代码
     * @return 单位，如：元, %, 个
     */
    String getUnit(String metricCode);

    /**
     * 获取指标的聚合方式
     *
     * @param metricCode 指标代码
     * @return 聚合方式，如：SUM, AVG, COUNT
     */
    String getAggregation(String metricCode);
}
