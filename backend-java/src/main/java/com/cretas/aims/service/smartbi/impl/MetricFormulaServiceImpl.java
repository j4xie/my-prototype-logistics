package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.entity.smartbi.SmartBiMetricFormula;
import com.cretas.aims.repository.smartbi.SmartBiMetricFormulaRepository;
import com.cretas.aims.service.smartbi.MetricFormulaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import javax.annotation.PostConstruct;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 指标公式服务实现
 *
 * 实现指标公式的管理和计算，核心功能：
 * - 使用 SpEL (Spring Expression Language) 解析和计算公式
 * - 支持公式配置缓存，提高计算性能
 * - 支持热重载，无需重启即可更新公式
 * - 工厂级配置覆盖全局配置
 *
 * SpEL 表达式规范：
 * - 变量引用：使用 # 前缀，如 #salesAmount
 * - 支持基本运算：+, -, *, /, %
 * - 支持比较运算：>, <, ==, !=, >=, <=
 * - 支持逻辑运算：and, or, not
 * - 支持三元运算：condition ? trueValue : falseValue
 * - 支持 Math 函数：通过注册的变量访问
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MetricFormulaServiceImpl implements MetricFormulaService {

    private final SmartBiMetricFormulaRepository metricFormulaRepository;

    /**
     * SpEL 表达式解析器
     */
    private final ExpressionParser expressionParser = new SpelExpressionParser();

    /**
     * 公式缓存：metricCode -> 公式配置
     */
    private final Map<String, SmartBiMetricFormula> formulaCache = new ConcurrentHashMap<>();

    /**
     * 工厂级公式缓存：factoryId:metricCode -> 公式配置
     */
    private final Map<String, SmartBiMetricFormula> factoryFormulaCache = new ConcurrentHashMap<>();

    /**
     * 编译后的表达式缓存：formulaExpression -> Expression
     */
    private final Map<String, Expression> expressionCache = new ConcurrentHashMap<>();

    /**
     * 格式化器缓存：formatPattern -> DecimalFormat
     */
    private final Map<String, DecimalFormat> formatCache = new ConcurrentHashMap<>();

    /**
     * 计算精度
     */
    private static final int CALCULATION_SCALE = 6;
    private static final int DISPLAY_SCALE = 2;
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    // ==================== 初始化 ====================

    @PostConstruct
    public void init() {
        log.info("初始化指标公式服务...");
        reload();
        log.info("指标公式服务初始化完成，已加载 {} 个公式配置", formulaCache.size());
    }

    // ==================== 公开接口实现 ====================

    @Override
    @Transactional(readOnly = true)
    public SmartBiMetricFormula getFormula(String metricCode) {
        if (!StringUtils.hasText(metricCode)) {
            return null;
        }

        // 优先从缓存获取
        SmartBiMetricFormula cached = formulaCache.get(metricCode);
        if (cached != null) {
            return cached;
        }

        // 从数据库加载
        Optional<SmartBiMetricFormula> formula = metricFormulaRepository.findByMetricCodeAndIsActiveTrue(metricCode);
        formula.ifPresent(f -> formulaCache.put(metricCode, f));

        return formula.orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public SmartBiMetricFormula getFormula(String metricCode, String factoryId) {
        if (!StringUtils.hasText(metricCode)) {
            return null;
        }

        // 如果没有 factoryId，返回全局配置
        if (!StringUtils.hasText(factoryId)) {
            return getFormula(metricCode);
        }

        // 检查工厂级缓存
        String cacheKey = factoryId + ":" + metricCode;
        SmartBiMetricFormula cached = factoryFormulaCache.get(cacheKey);
        if (cached != null) {
            return cached;
        }

        // 从数据库加载（优先工厂级配置）
        List<SmartBiMetricFormula> formulas = metricFormulaRepository
                .findByMetricCodeAndFactoryIdWithFallback(metricCode, factoryId);

        if (formulas.isEmpty()) {
            return null;
        }

        SmartBiMetricFormula formula = formulas.get(0);
        factoryFormulaCache.put(cacheKey, formula);

        return formula;
    }

    @Override
    public Object calculateMetric(String metricCode, Map<String, Object> context) {
        return calculateMetric(metricCode, null, context);
    }

    @Override
    public Object calculateMetric(String metricCode, String factoryId, Map<String, Object> context) {
        SmartBiMetricFormula formula = getFormula(metricCode, factoryId);
        if (formula == null) {
            throw new IllegalArgumentException("未找到指标公式配置: " + metricCode);
        }

        return calculateByFormula(formula, context);
    }

    @Override
    public String formatMetricValue(String metricCode, Object value) {
        return formatMetricValue(metricCode, null, value);
    }

    @Override
    public String formatMetricValue(String metricCode, String factoryId, Object value) {
        SmartBiMetricFormula formula = getFormula(metricCode, factoryId);
        if (formula == null) {
            return String.valueOf(value);
        }

        return formatValue(value, formula.getFormatPattern(), formula.getUnit());
    }

    @Override
    @Transactional(readOnly = true)
    public List<SmartBiMetricFormula> getAllFormulas() {
        return metricFormulaRepository.findByIsActiveTrueOrderByMetricCodeAsc();
    }

    @Override
    @Transactional(readOnly = true)
    public List<SmartBiMetricFormula> getFormulasForFactory(String factoryId) {
        if (!StringUtils.hasText(factoryId)) {
            return getAllFormulas();
        }

        List<SmartBiMetricFormula> formulas = metricFormulaRepository.findEffectiveFormulasForFactory(factoryId);

        // 去重：相同 metricCode 只保留工厂级配置
        Map<String, SmartBiMetricFormula> uniqueFormulas = new LinkedHashMap<>();
        for (SmartBiMetricFormula formula : formulas) {
            String code = formula.getMetricCode();
            // 工厂级配置优先（在查询中已排序）
            if (!uniqueFormulas.containsKey(code)) {
                uniqueFormulas.put(code, formula);
            }
        }

        return new ArrayList<>(uniqueFormulas.values());
    }

    @Override
    public void reload() {
        log.info("重新加载指标公式缓存...");

        // 清空缓存
        formulaCache.clear();
        factoryFormulaCache.clear();
        expressionCache.clear();

        // 加载全局公式
        List<SmartBiMetricFormula> globalFormulas = metricFormulaRepository.findGlobalFormulas();
        for (SmartBiMetricFormula formula : globalFormulas) {
            formulaCache.put(formula.getMetricCode(), formula);
            // 预编译表达式
            if (StringUtils.hasText(formula.getFormulaExpression())) {
                compileExpression(formula.getFormulaExpression());
            }
        }

        log.info("公式缓存重新加载完成，共加载 {} 个全局公式", formulaCache.size());
    }

    @Override
    public boolean exists(String metricCode) {
        if (formulaCache.containsKey(metricCode)) {
            return true;
        }
        return metricFormulaRepository.existsByMetricCodeAndIsActiveTrue(metricCode);
    }

    @Override
    public Map<String, Object> calculateMetrics(List<String> metricCodes, Map<String, Object> context) {
        Map<String, Object> results = new LinkedHashMap<>();

        for (String metricCode : metricCodes) {
            try {
                Object result = calculateMetric(metricCode, context);
                results.put(metricCode, result);
            } catch (Exception e) {
                log.warn("计算指标 {} 失败: {}", metricCode, e.getMessage());
                results.put(metricCode, null);
            }
        }

        return results;
    }

    @Override
    public String getUnit(String metricCode) {
        SmartBiMetricFormula formula = getFormula(metricCode);
        return formula != null ? formula.getUnit() : null;
    }

    @Override
    public String getAggregation(String metricCode) {
        SmartBiMetricFormula formula = getFormula(metricCode);
        return formula != null ? formula.getAggregation() : SmartBiMetricFormula.AGG_SUM;
    }

    // ==================== 内部计算方法 ====================

    /**
     * 根据公式配置计算指标值
     */
    private Object calculateByFormula(SmartBiMetricFormula formula, Map<String, Object> context) {
        if (formula.isSimple()) {
            // SIMPLE 类型：直接从 context 获取值
            return context.get(formula.getBaseField());
        }

        // DERIVED / CUSTOM 类型：使用 SpEL 计算
        String expression = formula.getFormulaExpression();
        if (!StringUtils.hasText(expression)) {
            log.warn("公式 {} 的表达式为空", formula.getMetricCode());
            return null;
        }

        try {
            return evaluateExpression(expression, context);
        } catch (Exception e) {
            log.error("计算公式 {} 失败: expression={}, context={}, error={}",
                    formula.getMetricCode(), expression, context, e.getMessage());
            throw e;
        }
    }

    /**
     * 使用 SpEL 计算表达式
     */
    private Object evaluateExpression(String expressionString, Map<String, Object> context) {
        Expression expression = compileExpression(expressionString);

        StandardEvaluationContext evalContext = new StandardEvaluationContext();

        // 将 context 中的值设置为变量
        for (Map.Entry<String, Object> entry : context.entrySet()) {
            evalContext.setVariable(entry.getKey(), convertToNumber(entry.getValue()));
        }

        // 注册常用数学函数
        registerMathFunctions(evalContext);

        Object result = expression.getValue(evalContext);

        // 结果精度处理
        if (result instanceof Number) {
            return new BigDecimal(result.toString()).setScale(CALCULATION_SCALE, ROUNDING_MODE);
        }

        return result;
    }

    /**
     * 编译并缓存 SpEL 表达式
     */
    private Expression compileExpression(String expressionString) {
        return expressionCache.computeIfAbsent(expressionString, expr -> {
            log.debug("编译 SpEL 表达式: {}", expr);
            return expressionParser.parseExpression(expr);
        });
    }

    /**
     * 注册数学辅助函数到评估上下文
     */
    private void registerMathFunctions(StandardEvaluationContext context) {
        // 可以在这里注册自定义函数
        // 例如：context.setVariable("abs", new BigDecimal("0").abs());
    }

    /**
     * 将值转换为数值类型
     */
    private Object convertToNumber(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }

        if (value instanceof BigDecimal) {
            return value;
        }

        if (value instanceof Number) {
            return new BigDecimal(value.toString());
        }

        if (value instanceof String) {
            try {
                return new BigDecimal((String) value);
            } catch (NumberFormatException e) {
                return value;
            }
        }

        return value;
    }

    // ==================== 格式化方法 ====================

    /**
     * 格式化数值
     */
    private String formatValue(Object value, String formatPattern, String unit) {
        if (value == null) {
            return "-";
        }

        String formatted;

        if (StringUtils.hasText(formatPattern)) {
            DecimalFormat formatter = getFormatter(formatPattern);
            if (value instanceof Number) {
                formatted = formatter.format(value);
            } else {
                try {
                    formatted = formatter.format(new BigDecimal(value.toString()));
                } catch (NumberFormatException e) {
                    formatted = String.valueOf(value);
                }
            }
        } else {
            // 默认格式化
            if (value instanceof BigDecimal) {
                formatted = ((BigDecimal) value).setScale(DISPLAY_SCALE, ROUNDING_MODE).toString();
            } else if (value instanceof Number) {
                formatted = new BigDecimal(value.toString()).setScale(DISPLAY_SCALE, ROUNDING_MODE).toString();
            } else {
                formatted = String.valueOf(value);
            }
        }

        // 添加单位
        if (StringUtils.hasText(unit)) {
            return formatted + unit;
        }

        return formatted;
    }

    /**
     * 获取或创建格式化器
     */
    private DecimalFormat getFormatter(String pattern) {
        return formatCache.computeIfAbsent(pattern, p -> {
            try {
                return new DecimalFormat(p);
            } catch (IllegalArgumentException e) {
                log.warn("无效的格式化模式: {}, 使用默认格式", p);
                return new DecimalFormat("#,##0.00");
            }
        });
    }
}
