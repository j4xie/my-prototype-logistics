package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.client.PythonSmartBIClient;
import com.cretas.aims.config.smartbi.PythonSmartBIConfig;
import com.cretas.aims.dto.smartbi.ForecastPoint;
import com.cretas.aims.dto.smartbi.ForecastResult;
import com.cretas.aims.entity.smartbi.SmartBiSalesData;
import com.cretas.aims.entity.smartbi.enums.ForecastAlgorithm;
import com.cretas.aims.repository.smartbi.SmartBiSalesDataRepository;
import com.cretas.aims.service.smartbi.ForecastService;
import com.cretas.aims.service.smartbi.MetricCalculatorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 预测服务实现
 *
 * 实现 SmartBI 系统中基于统计方法的时间序列预测，包括：
 * - 移动平均法：计算最近 N 个周期的平均值
 * - 线性趋势法：基于最小二乘法的线性回归
 * - 指数平滑法：对近期数据赋予更高权重
 *
 * 所有计算使用 BigDecimal 确保精度，默认保留 2 位小数。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ForecastServiceImpl implements ForecastService {

    private final SmartBiSalesDataRepository salesDataRepository;

    @Autowired
    private PythonSmartBIClient pythonClient;

    @Autowired
    private PythonSmartBIConfig pythonConfig;

    // 计算精度配置
    private static final int SCALE = 6;
    private static final int DISPLAY_SCALE = 2;
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    // 移动平均窗口大小
    private static final int MOVING_AVERAGE_WINDOW = 7;

    // 指数平滑系数 (0-1，越大对近期数据越敏感)
    private static final BigDecimal SMOOTHING_ALPHA = new BigDecimal("0.3");

    // 置信区间系数 (95% 置信区间约为 1.96 倍标准差)
    private static final BigDecimal CONFIDENCE_MULTIPLIER = new BigDecimal("1.96");

    // 最小历史数据点数
    private static final int MIN_DATA_POINTS = 7;

    // ==================== 公开接口实现 ====================

    @Override
    @Transactional(readOnly = true)
    public ForecastResult forecastSales(String factoryId, LocalDate startDate, LocalDate endDate, int forecastDays) {
        log.info("预测销售额: factoryId={}, startDate={}, endDate={}, forecastDays={}",
                factoryId, startDate, endDate, forecastDays);

        // 尝试使用 Python 服务进行预测
        ForecastResult pythonResult = forecastSalesWithPython(factoryId, startDate, endDate, forecastDays);
        if (pythonResult != null) {
            return pythonResult;
        }

        // 降级到 Java 实现
        return forecastMetric(factoryId, MetricCalculatorService.SALES_AMOUNT, startDate, endDate, forecastDays);
    }

    /**
     * 使用 Python 服务进行销售预测（带降级逻辑）
     *
     * Python 服务可以利用更先进的机器学习模型（如 Prophet, ARIMA）进行预测，
     * 如果服务不可用则降级到 Java 的统计方法实现。
     *
     * @param factoryId    工厂ID
     * @param startDate    开始日期
     * @param endDate      结束日期
     * @param forecastDays 预测天数
     * @return 预测结果，如果 Python 服务不可用或失败则返回 null
     */
    private ForecastResult forecastSalesWithPython(String factoryId, LocalDate startDate,
                                                    LocalDate endDate, int forecastDays) {
        if (!pythonConfig.isEnabled()) {
            log.debug("Python SmartBI 服务已禁用，使用 Java 预测");
            return null;
        }

        try {
            if (pythonClient.isAvailable()) {
                log.info("使用 Python SmartBI 服务进行销售预测: factoryId={}", factoryId);
                ForecastResult result = pythonClient.forecastSales(factoryId, startDate, endDate, forecastDays);

                if (result != null && result.getForecastPoints() != null && !result.getForecastPoints().isEmpty()) {
                    log.info("Python SmartBI 销售预测成功: algorithm={}, confidence={}",
                            result.getAlgorithm(), result.getConfidence());
                    return result;
                } else {
                    log.warn("Python SmartBI 销售预测返回空结果，降级到 Java 预测");
                }
            } else {
                log.debug("Python SmartBI 服务不可用，使用 Java 预测");
            }
        } catch (Exception e) {
            log.warn("Python SmartBI 销售预测失败，降级到 Java 预测: {}", e.getMessage());

            if (!pythonConfig.isFallbackOnError()) {
                log.error("Python SmartBI 服务不可用且不允许降级");
                return buildEmptyForecastResult(MetricCalculatorService.SALES_AMOUNT,
                        ForecastAlgorithm.AUTO, startDate, endDate);
            }
        }

        return null;
    }

    /**
     * 使用 Python 服务进行通用指标预测（带降级逻辑）
     *
     * Python 服务支持更多高级预测算法，如：
     * - Prophet: Facebook 时间序列预测
     * - ARIMA: 自回归积分滑动平均
     * - LSTM: 长短期记忆网络
     *
     * @param factoryId    工厂ID
     * @param metricType   指标类型
     * @param startDate    开始日期
     * @param endDate      结束日期
     * @param forecastDays 预测天数
     * @param algorithm    预测算法
     * @return 预测结果，如果 Python 服务不可用或失败则返回 null
     */
    private ForecastResult forecastMetricWithPython(String factoryId, String metricType,
                                                     LocalDate startDate, LocalDate endDate,
                                                     int forecastDays, String algorithm) {
        if (!pythonConfig.isEnabled()) {
            log.debug("Python SmartBI 服务已禁用，使用 Java 预测");
            return null;
        }

        try {
            if (pythonClient.isAvailable()) {
                log.info("使用 Python SmartBI 服务进行指标预测: factoryId={}, metricType={}, algorithm={}",
                        factoryId, metricType, algorithm);
                ForecastResult result = pythonClient.forecastMetric(factoryId, metricType, startDate, endDate,
                        forecastDays, algorithm);

                if (result != null && result.getForecastPoints() != null && !result.getForecastPoints().isEmpty()) {
                    log.info("Python SmartBI 指标预测成功: metricType={}, algorithm={}, confidence={}",
                            metricType, result.getAlgorithm(), result.getConfidence());
                    return result;
                } else {
                    log.warn("Python SmartBI 指标预测返回空结果，降级到 Java 预测");
                }
            } else {
                log.debug("Python SmartBI 服务不可用，使用 Java 预测");
            }
        } catch (Exception e) {
            log.warn("Python SmartBI 指标预测失败，降级到 Java 预测: {}", e.getMessage());

            if (!pythonConfig.isFallbackOnError()) {
                log.error("Python SmartBI 服务不可用且不允许降级");
                try {
                    ForecastAlgorithm alg = ForecastAlgorithm.valueOf(algorithm);
                    return buildEmptyForecastResult(metricType, alg, startDate, endDate);
                } catch (IllegalArgumentException ex) {
                    return buildEmptyForecastResult(metricType, ForecastAlgorithm.AUTO, startDate, endDate);
                }
            }
        }

        return null;
    }

    @Override
    @Transactional(readOnly = true)
    public ForecastResult forecastMetric(String factoryId, String metricType,
                                          LocalDate startDate, LocalDate endDate, int forecastDays) {
        log.info("预测指标: factoryId={}, metricType={}, startDate={}, endDate={}, forecastDays={}",
                factoryId, metricType, startDate, endDate, forecastDays);
        return forecastWithAlgorithm(factoryId, metricType, startDate, endDate, forecastDays, ForecastAlgorithm.AUTO);
    }

    @Override
    @Transactional(readOnly = true)
    public ForecastResult forecastWithAlgorithm(String factoryId, String metricType,
                                                 LocalDate startDate, LocalDate endDate,
                                                 int forecastDays, ForecastAlgorithm algorithm) {
        log.info("使用算法预测: factoryId={}, metricType={}, algorithm={}, forecastDays={}",
                factoryId, metricType, algorithm, forecastDays);

        // 尝试使用 Python 服务进行预测（支持更多高级算法）
        ForecastResult pythonResult = forecastMetricWithPython(factoryId, metricType, startDate, endDate,
                forecastDays, algorithm != null ? algorithm.name() : "AUTO");
        if (pythonResult != null) {
            return pythonResult;
        }

        // 降级到 Java 实现
        log.info("使用 Java 统计方法进行预测: factoryId={}, metricType={}", factoryId, metricType);

        // 获取历史数据
        Map<LocalDate, BigDecimal> historicalData = getHistoricalData(factoryId, metricType, startDate, endDate);

        if (historicalData.size() < MIN_DATA_POINTS) {
            log.warn("历史数据不足: 需要至少 {} 个数据点，实际 {} 个", MIN_DATA_POINTS, historicalData.size());
            return buildEmptyForecastResult(metricType, algorithm, startDate, endDate);
        }

        // 自动选择算法
        ForecastAlgorithm selectedAlgorithm = algorithm == ForecastAlgorithm.AUTO
                ? selectBestAlgorithm(historicalData)
                : algorithm;

        // 执行预测
        List<ForecastPoint> forecastPoints = new ArrayList<>();

        // 添加历史数据点
        historicalData.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> forecastPoints.add(ForecastPoint.ofHistorical(entry.getKey(), entry.getValue())));

        // 计算预测值
        List<BigDecimal> historicalValues = historicalData.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(Map.Entry::getValue)
                .collect(Collectors.toList());

        BigDecimal standardDeviation = calculateStandardDeviation(historicalValues);
        LocalDate lastDate = endDate;

        for (int i = 1; i <= forecastDays; i++) {
            LocalDate forecastDate = lastDate.plusDays(i);
            BigDecimal predictedValue = predictValue(historicalValues, selectedAlgorithm, i);

            // 计算置信区间 (随预测距离扩大)
            BigDecimal intervalWidth = standardDeviation
                    .multiply(CONFIDENCE_MULTIPLIER)
                    .multiply(new BigDecimal(Math.sqrt(i)));

            BigDecimal lowerBound = predictedValue.subtract(intervalWidth).max(BigDecimal.ZERO);
            BigDecimal upperBound = predictedValue.add(intervalWidth);

            forecastPoints.add(ForecastPoint.of(
                    forecastDate,
                    predictedValue.setScale(DISPLAY_SCALE, ROUNDING_MODE),
                    lowerBound.setScale(DISPLAY_SCALE, ROUNDING_MODE),
                    upperBound.setScale(DISPLAY_SCALE, ROUNDING_MODE)
            ));

            // 更新历史值用于滚动预测
            historicalValues.add(predictedValue);
        }

        // 计算置信度
        BigDecimal confidence = calculateConfidence(historicalValues, standardDeviation);

        // 计算趋势和增长率
        String trend = calculateTrend(forecastPoints);
        BigDecimal growthRate = calculateGrowthRate(forecastPoints);

        String periodDescription = String.format("%s 至 %s",
                startDate.format(DateTimeFormatter.ISO_LOCAL_DATE),
                lastDate.plusDays(forecastDays).format(DateTimeFormatter.ISO_LOCAL_DATE));

        ForecastResult result = ForecastResult.of(forecastPoints, selectedAlgorithm, confidence, metricType, periodDescription);
        result.setTrend(trend);
        result.setGrowthRate(growthRate);
        result.setDescription(generateDescription(selectedAlgorithm, confidence, trend, growthRate));

        log.info("预测完成: 算法={}, 置信度={}%, 趋势={}, 增长率={}%",
                selectedAlgorithm, confidence, trend, growthRate);

        return result;
    }

    // ==================== 数据获取 ====================

    /**
     * 获取历史数据
     */
    private Map<LocalDate, BigDecimal> getHistoricalData(String factoryId, String metricType,
                                                          LocalDate startDate, LocalDate endDate) {
        List<SmartBiSalesData> salesData = salesDataRepository
                .findByFactoryIdAndOrderDateBetween(factoryId, startDate, endDate);

        // 按日期聚合数据
        Map<LocalDate, BigDecimal> dailyData = new TreeMap<>();

        switch (metricType) {
            case MetricCalculatorService.SALES_AMOUNT:
                dailyData = salesData.stream()
                        .filter(d -> d.getOrderDate() != null && d.getAmount() != null)
                        .collect(Collectors.groupingBy(
                                SmartBiSalesData::getOrderDate,
                                TreeMap::new,
                                Collectors.reducing(BigDecimal.ZERO,
                                        SmartBiSalesData::getAmount,
                                        BigDecimal::add)
                        ));
                break;

            case MetricCalculatorService.ORDER_COUNT:
                Map<LocalDate, Long> orderCounts = salesData.stream()
                        .filter(d -> d.getOrderDate() != null)
                        .collect(Collectors.groupingBy(
                                SmartBiSalesData::getOrderDate,
                                TreeMap::new,
                                Collectors.counting()
                        ));
                for (Map.Entry<LocalDate, Long> entry : orderCounts.entrySet()) {
                    dailyData.put(entry.getKey(), new BigDecimal(entry.getValue()));
                }
                break;

            case MetricCalculatorService.AVG_ORDER_VALUE:
                Map<LocalDate, List<SmartBiSalesData>> groupedByDate = salesData.stream()
                        .filter(d -> d.getOrderDate() != null && d.getAmount() != null)
                        .collect(Collectors.groupingBy(SmartBiSalesData::getOrderDate, TreeMap::new, Collectors.toList()));

                for (Map.Entry<LocalDate, List<SmartBiSalesData>> entry : groupedByDate.entrySet()) {
                    BigDecimal total = entry.getValue().stream()
                            .map(SmartBiSalesData::getAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    int count = entry.getValue().size();
                    if (count > 0) {
                        dailyData.put(entry.getKey(), total.divide(new BigDecimal(count), SCALE, ROUNDING_MODE));
                    }
                }
                break;

            default:
                // 默认使用销售额
                dailyData = salesData.stream()
                        .filter(d -> d.getOrderDate() != null && d.getAmount() != null)
                        .collect(Collectors.groupingBy(
                                SmartBiSalesData::getOrderDate,
                                TreeMap::new,
                                Collectors.reducing(BigDecimal.ZERO,
                                        SmartBiSalesData::getAmount,
                                        BigDecimal::add)
                        ));
        }

        return dailyData;
    }

    // ==================== 算法选择 ====================

    /**
     * 自动选择最佳预测算法
     */
    private ForecastAlgorithm selectBestAlgorithm(Map<LocalDate, BigDecimal> historicalData) {
        List<BigDecimal> values = new ArrayList<>(historicalData.values());

        // 计算趋势强度
        BigDecimal trendStrength = calculateTrendStrength(values);

        // 计算数据波动性
        BigDecimal volatility = calculateVolatility(values);

        log.debug("数据分析: 趋势强度={}, 波动性={}", trendStrength, volatility);

        // 决策逻辑
        if (trendStrength.abs().compareTo(new BigDecimal("0.3")) > 0) {
            // 有明显趋势，使用线性趋势法
            return ForecastAlgorithm.LINEAR_TREND;
        } else if (volatility.compareTo(new BigDecimal("0.2")) > 0) {
            // 波动较大，使用指数平滑
            return ForecastAlgorithm.EXPONENTIAL_SMOOTHING;
        } else {
            // 数据平稳，使用移动平均
            return ForecastAlgorithm.MOVING_AVERAGE;
        }
    }

    // ==================== 预测算法实现 ====================

    /**
     * 根据选定算法计算预测值
     */
    private BigDecimal predictValue(List<BigDecimal> historicalValues, ForecastAlgorithm algorithm, int step) {
        switch (algorithm) {
            case MOVING_AVERAGE:
                return predictByMovingAverage(historicalValues);
            case LINEAR_TREND:
                return predictByLinearTrend(historicalValues, step);
            case EXPONENTIAL_SMOOTHING:
                return predictByExponentialSmoothing(historicalValues);
            default:
                return predictByMovingAverage(historicalValues);
        }
    }

    /**
     * 移动平均预测
     */
    private BigDecimal predictByMovingAverage(List<BigDecimal> values) {
        int windowSize = Math.min(MOVING_AVERAGE_WINDOW, values.size());
        List<BigDecimal> recentValues = values.subList(values.size() - windowSize, values.size());

        BigDecimal sum = recentValues.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(new BigDecimal(windowSize), SCALE, ROUNDING_MODE);
    }

    /**
     * 线性趋势预测 (最小二乘法)
     */
    private BigDecimal predictByLinearTrend(List<BigDecimal> values, int futureStep) {
        int n = values.size();

        // 计算 x 和 y 的均值
        BigDecimal sumX = BigDecimal.ZERO;
        BigDecimal sumY = BigDecimal.ZERO;
        BigDecimal sumXY = BigDecimal.ZERO;
        BigDecimal sumX2 = BigDecimal.ZERO;

        for (int i = 0; i < n; i++) {
            BigDecimal x = new BigDecimal(i + 1);
            BigDecimal y = values.get(i);

            sumX = sumX.add(x);
            sumY = sumY.add(y);
            sumXY = sumXY.add(x.multiply(y));
            sumX2 = sumX2.add(x.multiply(x));
        }

        BigDecimal nDecimal = new BigDecimal(n);

        // 计算斜率 b = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX^2)
        BigDecimal numerator = nDecimal.multiply(sumXY).subtract(sumX.multiply(sumY));
        BigDecimal denominator = nDecimal.multiply(sumX2).subtract(sumX.multiply(sumX));

        if (denominator.compareTo(BigDecimal.ZERO) == 0) {
            // 无法计算斜率，返回平均值
            return sumY.divide(nDecimal, SCALE, ROUNDING_MODE);
        }

        BigDecimal slope = numerator.divide(denominator, SCALE, ROUNDING_MODE);

        // 计算截距 a = (sumY - b*sumX) / n
        BigDecimal intercept = sumY.subtract(slope.multiply(sumX)).divide(nDecimal, SCALE, ROUNDING_MODE);

        // 预测值 y = a + b*x，其中 x = n + futureStep
        BigDecimal futureX = new BigDecimal(n + futureStep);
        return intercept.add(slope.multiply(futureX));
    }

    /**
     * 指数平滑预测
     */
    private BigDecimal predictByExponentialSmoothing(List<BigDecimal> values) {
        if (values.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal smoothedValue = values.get(0);
        BigDecimal oneMinusAlpha = BigDecimal.ONE.subtract(SMOOTHING_ALPHA);

        for (int i = 1; i < values.size(); i++) {
            // S_t = alpha * Y_t + (1 - alpha) * S_{t-1}
            smoothedValue = SMOOTHING_ALPHA.multiply(values.get(i))
                    .add(oneMinusAlpha.multiply(smoothedValue));
        }

        return smoothedValue.setScale(SCALE, ROUNDING_MODE);
    }

    // ==================== 统计计算辅助方法 ====================

    /**
     * 计算标准差
     */
    private BigDecimal calculateStandardDeviation(List<BigDecimal> values) {
        if (values.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal mean = values.stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(new BigDecimal(values.size()), SCALE, ROUNDING_MODE);

        BigDecimal sumSquaredDiff = values.stream()
                .map(v -> v.subtract(mean).pow(2))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal variance = sumSquaredDiff.divide(new BigDecimal(values.size()), SCALE, ROUNDING_MODE);

        return BigDecimal.valueOf(Math.sqrt(variance.doubleValue())).setScale(SCALE, ROUNDING_MODE);
    }

    /**
     * 计算趋势强度 (相关系数)
     */
    private BigDecimal calculateTrendStrength(List<BigDecimal> values) {
        int n = values.size();
        if (n < 2) {
            return BigDecimal.ZERO;
        }

        BigDecimal sumX = BigDecimal.ZERO;
        BigDecimal sumY = BigDecimal.ZERO;
        BigDecimal sumXY = BigDecimal.ZERO;
        BigDecimal sumX2 = BigDecimal.ZERO;
        BigDecimal sumY2 = BigDecimal.ZERO;

        for (int i = 0; i < n; i++) {
            BigDecimal x = new BigDecimal(i + 1);
            BigDecimal y = values.get(i);

            sumX = sumX.add(x);
            sumY = sumY.add(y);
            sumXY = sumXY.add(x.multiply(y));
            sumX2 = sumX2.add(x.multiply(x));
            sumY2 = sumY2.add(y.multiply(y));
        }

        BigDecimal nDecimal = new BigDecimal(n);
        BigDecimal numerator = nDecimal.multiply(sumXY).subtract(sumX.multiply(sumY));
        BigDecimal denomX = nDecimal.multiply(sumX2).subtract(sumX.multiply(sumX));
        BigDecimal denomY = nDecimal.multiply(sumY2).subtract(sumY.multiply(sumY));

        BigDecimal denominator = BigDecimal.valueOf(Math.sqrt(denomX.multiply(denomY).doubleValue()));

        if (denominator.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        return numerator.divide(denominator, SCALE, ROUNDING_MODE);
    }

    /**
     * 计算波动性 (变异系数)
     */
    private BigDecimal calculateVolatility(List<BigDecimal> values) {
        if (values.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal mean = values.stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(new BigDecimal(values.size()), SCALE, ROUNDING_MODE);

        if (mean.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        BigDecimal stdDev = calculateStandardDeviation(values);
        return stdDev.divide(mean.abs(), SCALE, ROUNDING_MODE);
    }

    /**
     * 计算置信度
     */
    private BigDecimal calculateConfidence(List<BigDecimal> values, BigDecimal standardDeviation) {
        if (values.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal mean = values.stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(new BigDecimal(values.size()), SCALE, ROUNDING_MODE);

        if (mean.compareTo(BigDecimal.ZERO) == 0) {
            return new BigDecimal("50");
        }

        // 基于变异系数计算置信度
        BigDecimal cv = standardDeviation.divide(mean.abs(), SCALE, ROUNDING_MODE);

        // 变异系数越小，置信度越高
        BigDecimal confidence = BigDecimal.ONE.subtract(cv.min(BigDecimal.ONE))
                .multiply(new BigDecimal("100"))
                .setScale(DISPLAY_SCALE, ROUNDING_MODE);

        return confidence.max(new BigDecimal("30")).min(new BigDecimal("95"));
    }

    /**
     * 计算趋势方向
     */
    private String calculateTrend(List<ForecastPoint> forecastPoints) {
        List<ForecastPoint> forecasts = forecastPoints.stream()
                .filter(p -> !Boolean.TRUE.equals(p.getIsHistorical()))
                .collect(Collectors.toList());

        if (forecasts.size() < 2) {
            return "STABLE";
        }

        BigDecimal first = forecasts.get(0).getValue();
        BigDecimal last = forecasts.get(forecasts.size() - 1).getValue();

        BigDecimal change = last.subtract(first);
        BigDecimal threshold = first.multiply(new BigDecimal("0.05")); // 5% 变化阈值

        if (change.compareTo(threshold) > 0) {
            return "UP";
        } else if (change.compareTo(threshold.negate()) < 0) {
            return "DOWN";
        }
        return "STABLE";
    }

    /**
     * 计算增长率
     */
    private BigDecimal calculateGrowthRate(List<ForecastPoint> forecastPoints) {
        List<ForecastPoint> historical = forecastPoints.stream()
                .filter(p -> Boolean.TRUE.equals(p.getIsHistorical()))
                .collect(Collectors.toList());

        List<ForecastPoint> forecasts = forecastPoints.stream()
                .filter(p -> !Boolean.TRUE.equals(p.getIsHistorical()))
                .collect(Collectors.toList());

        if (historical.isEmpty() || forecasts.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal lastHistorical = historical.get(historical.size() - 1).getValue();
        BigDecimal lastForecast = forecasts.get(forecasts.size() - 1).getValue();

        if (lastHistorical.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        return lastForecast.subtract(lastHistorical)
                .divide(lastHistorical, SCALE, ROUNDING_MODE)
                .multiply(new BigDecimal("100"))
                .setScale(DISPLAY_SCALE, ROUNDING_MODE);
    }

    /**
     * 生成预测描述
     */
    private String generateDescription(ForecastAlgorithm algorithm, BigDecimal confidence,
                                         String trend, BigDecimal growthRate) {
        StringBuilder desc = new StringBuilder();
        desc.append("使用").append(algorithm.getDisplayName()).append("进行预测，");
        desc.append("置信度 ").append(confidence).append("%。");

        switch (trend) {
            case "UP":
                desc.append("预计呈上升趋势，增长率约 ").append(growthRate).append("%。");
                break;
            case "DOWN":
                desc.append("预计呈下降趋势，降幅约 ").append(growthRate.abs()).append("%。");
                break;
            default:
                desc.append("预计保持平稳。");
        }

        return desc.toString();
    }

    /**
     * 构建空预测结果
     */
    private ForecastResult buildEmptyForecastResult(String metricType, ForecastAlgorithm algorithm,
                                                     LocalDate startDate, LocalDate endDate) {
        String periodDescription = String.format("%s 至 %s",
                startDate.format(DateTimeFormatter.ISO_LOCAL_DATE),
                endDate.format(DateTimeFormatter.ISO_LOCAL_DATE));

        return ForecastResult.builder()
                .forecastPoints(Collections.emptyList())
                .algorithm(algorithm)
                .confidence(BigDecimal.ZERO)
                .metricType(metricType)
                .periodDescription(periodDescription)
                .historicalPointCount(0)
                .forecastPointCount(0)
                .trend("UNKNOWN")
                .growthRate(BigDecimal.ZERO)
                .description("历史数据不足，无法进行预测。请确保至少有 " + MIN_DATA_POINTS + " 天的数据。")
                .build();
    }
}
