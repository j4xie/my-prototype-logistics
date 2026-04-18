package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.client.PythonSmartBIClient;
import com.cretas.aims.config.smartbi.PythonSmartBIConfig;
import com.cretas.aims.dto.smartbi.ForecastPoint;
import com.cretas.aims.dto.smartbi.ForecastResult;
import com.cretas.aims.dto.smartbi.PythonForecastResponse;
import com.cretas.aims.entity.smartbi.enums.ForecastAlgorithm;
import com.cretas.aims.repository.smartbi.SmartBiSalesDataRepository;
import com.cretas.aims.service.smartbi.ForecastService;
import com.cretas.aims.service.smartbi.MetricCalculatorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
    private final PythonSmartBIClient pythonClient;
    private final PythonSmartBIConfig pythonConfig;

    // 计算精度配置
    private static final int SCALE = 6;
    private static final int DISPLAY_SCALE = 2;
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    // 最小历史数据点数
    private static final int MIN_DATA_POINTS = 7;

    // ==================== 公开接口实现 ====================

    @Override
    @Transactional(readOnly = true)
    public ForecastResult forecastSales(String factoryId, LocalDate startDate, LocalDate endDate, int forecastDays) {
        log.info("预测销售额: factoryId={}, startDate={}, endDate={}, forecastDays={}",
                factoryId, startDate, endDate, forecastDays);

        // 使用 Python 服务进行预测（无 Java fallback）
        return forecastSalesWithPython(factoryId, startDate, endDate, forecastDays);
    }

    /**
     * 使用 Python 服务进行销售预测
     *
     * 方案 E (2026-04-17): Java 从数据库查历史序列 → Python 纯算预测。
     * Python 服务 /api/forecast/predict 需要 data: List[float] 参数，
     * 由 Java 先从 SmartBiSalesDataRepository 拉取历史数据再传入。
     *
     * @param factoryId    工厂ID
     * @param startDate    开始日期
     * @param endDate      结束日期
     * @param forecastDays 预测天数
     * @return 预测结果；历史数据不足时返回空结果（不抛异常）
     */
    private ForecastResult forecastSalesWithPython(String factoryId, LocalDate startDate,
                                                    LocalDate endDate, int forecastDays) {
        if (!pythonConfig.isEnabled()) {
            throw new RuntimeException("Python SmartBI 服务未启用。预测功能完全依赖 Python 服务 (端口 8083)。");
        }
        if (!pythonClient.isAvailable()) {
            throw new RuntimeException("Python SmartBI 服务不可用。请检查服务是否在 " + pythonConfig.getUrl() + " 运行。");
        }

        // 方案 E (2026-04-17): Java 查历史 + Python 纯算
        List<Object[]> trend = salesDataRepository.findDailySalesTrend(factoryId, startDate, endDate);
        if (trend.size() < 3) {
            log.warn("销售历史数据不足 3 天, 无法预测: factoryId={}, 数据点={}", factoryId, trend.size());
            return buildEmptyForecastResult(MetricCalculatorService.SALES_AMOUNT, ForecastAlgorithm.AUTO, startDate, endDate);
        }

        List<Double> data = trend.stream()
                .map(row -> ((BigDecimal) row[1]).doubleValue())
                .collect(Collectors.toList());

        log.info("Python forecast 调用: factoryId={}, dataPoints={}, periods={}",
                factoryId, data.size(), forecastDays);
        try {
            PythonForecastResponse resp = pythonClient.forecastWithData(data, forecastDays, "auto");
            if (resp == null || !resp.isSuccess() || resp.getPredictions() == null || resp.getPredictions().isEmpty()) {
                log.warn("Python forecast 返回空/失败: success={}, error={}",
                        resp != null && resp.isSuccess(),
                        resp != null ? resp.getError() : "null response");
                return buildEmptyForecastResult(MetricCalculatorService.SALES_AMOUNT, ForecastAlgorithm.AUTO, startDate, endDate);
            }
            return buildForecastResultFromPython(resp, MetricCalculatorService.SALES_AMOUNT, startDate, endDate);
        } catch (java.io.IOException e) {
            log.warn("Python forecast IO 失败: factoryId={}, msg={}", factoryId, e.getMessage());
            return buildEmptyForecastResult(MetricCalculatorService.SALES_AMOUNT, ForecastAlgorithm.AUTO, startDate, endDate);
        }
    }

    /**
     * 使用 Python 服务进行通用指标预测
     *
     * 方案 E Stage 1: 只有 SALES_AMOUNT 有配套 SQL GROUP BY，直接委托给 forecastSalesWithPython。
     * 其他 metric 类型返回 empty + WARN，Stage 2 延后处理（需 Repository 层为 finance/cost 等建日聚合）。
     *
     * @param factoryId    工厂ID
     * @param metricType   指标类型
     * @param startDate    开始日期
     * @param endDate      结束日期
     * @param forecastDays 预测天数
     * @param algorithm    预测算法
     * @return 预测结果
     */
    private ForecastResult forecastMetricWithPython(String factoryId, String metricType,
                                                     LocalDate startDate, LocalDate endDate,
                                                     int forecastDays, String algorithm) {
        // 方案 E Stage 1:只有 SALES_AMOUNT 有配套 SQL GROUP BY. 其他 metric 返 empty + WARN.
        // Stage 2 延后 — 需 Repository 层为 finance/cost 等 metric 建日聚合后再开通.
        if (MetricCalculatorService.SALES_AMOUNT.equals(metricType)) {
            return forecastSalesWithPython(factoryId, startDate, endDate, forecastDays);
        }

        log.warn("暂不支持该 metric 的预测: metricType={} (Stage 2 需建对应日聚合 query)", metricType);
        ForecastAlgorithm alg;
        try {
            alg = algorithm != null ? ForecastAlgorithm.valueOf(algorithm) : ForecastAlgorithm.AUTO;
        } catch (IllegalArgumentException ex) {
            alg = ForecastAlgorithm.AUTO;
        }
        return buildEmptyForecastResult(metricType, alg, startDate, endDate);
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

        // 使用 Python 服务进行预测（无 Java fallback）
        return forecastMetricWithPython(factoryId, metricType, startDate, endDate,
                forecastDays, algorithm != null ? algorithm.name() : "AUTO");
    }

    /**
     * 把 Python /api/forecast/predict 的响应映射为 Java ForecastResult.
     * 预测日期起点 = endDate + 1 天, 逐日递增.
     *
     * @since 2026-04-17 (方案 E)
     */
    private ForecastResult buildForecastResultFromPython(PythonForecastResponse resp,
                                                          String metricType,
                                                          LocalDate startDate,
                                                          LocalDate endDate) {
        List<Double> preds = resp.getPredictions();
        List<Double> lower = resp.getLowerBound() != null ? resp.getLowerBound() : preds;
        List<Double> upper = resp.getUpperBound() != null ? resp.getUpperBound() : preds;

        List<ForecastPoint> points = new ArrayList<>(preds.size());
        for (int i = 0; i < preds.size(); i++) {
            LocalDate date = endDate.plusDays((long) i + 1);
            BigDecimal value = BigDecimal.valueOf(preds.get(i)).setScale(2, RoundingMode.HALF_UP);
            BigDecimal lo = BigDecimal.valueOf(i < lower.size() ? lower.get(i) : preds.get(i)).setScale(2, RoundingMode.HALF_UP);
            BigDecimal up = BigDecimal.valueOf(i < upper.size() ? upper.get(i) : preds.get(i)).setScale(2, RoundingMode.HALF_UP);
            points.add(ForecastPoint.of(date, value, lo, up));
        }

        ForecastAlgorithm algo = mapPythonAlgorithm(resp.getAlgorithm());
        String period = String.format("%s 至 %s",
                startDate.format(DateTimeFormatter.ISO_LOCAL_DATE),
                endDate.format(DateTimeFormatter.ISO_LOCAL_DATE));

        return ForecastResult.builder()
                .forecastPoints(points)
                .algorithm(algo)
                .confidence(new BigDecimal("95.00"))
                .metricType(metricType)
                .periodDescription(period)
                .historicalPointCount(resp.getInputLength() != null ? resp.getInputLength() : 0)
                .forecastPointCount(points.size())
                .generatedAt(LocalDateTime.now())
                .trend(computeTrend(points))
                .growthRate(BigDecimal.ZERO)
                .build();
    }

    /**
     * Python 算法名 (小写下划线) → Java enum.
     */
    private ForecastAlgorithm mapPythonAlgorithm(String pythonName) {
        if (pythonName == null) return ForecastAlgorithm.AUTO;
        switch (pythonName.toLowerCase()) {
            case "moving_average": return ForecastAlgorithm.MOVING_AVERAGE;
            case "linear_trend": return ForecastAlgorithm.LINEAR_TREND;
            case "exponential_smoothing": return ForecastAlgorithm.EXPONENTIAL_SMOOTHING;
            default: return ForecastAlgorithm.AUTO;
        }
    }

    /**
     * 根据预测首尾点判断趋势.
     */
    private String computeTrend(List<ForecastPoint> points) {
        if (points.size() < 2) return "STABLE";
        BigDecimal first = points.get(0).getValue();
        BigDecimal last = points.get(points.size() - 1).getValue();
        int cmp = last.compareTo(first);
        if (cmp > 0) return "UP";
        if (cmp < 0) return "DOWN";
        return "STABLE";
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
