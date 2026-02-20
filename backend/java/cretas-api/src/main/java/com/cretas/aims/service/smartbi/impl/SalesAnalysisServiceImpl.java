package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.smartbi.AIInsight;
import com.cretas.aims.dto.smartbi.ChartConfig;
import com.cretas.aims.dto.smartbi.DashboardResponse;
import com.cretas.aims.dto.smartbi.KPICard;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.dto.smartbi.RankingItem;
import com.cretas.aims.entity.smartbi.SmartBiSalesData;
import com.cretas.aims.repository.smartbi.SmartBiSalesDataRepository;
import com.cretas.aims.service.smartbi.MetricCalculatorService;
import com.cretas.aims.service.smartbi.SalesAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 销售分析服务实现
 *
 * 实现 SmartBI 系统中销售相关的分析，包括：
 * - 销售概览：KPI 卡片、图表、排名、AI 洞察
 * - 销售员分析：排名、完成率、人均产出
 * - 产品分析：销量排名、占比分布
 * - 客户分析：Top 10 客户贡献
 * - 趋势分析：日/周/月销售趋势
 *
 * 所有计算使用 BigDecimal 确保精度，默认保留 2 位小数。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SalesAnalysisServiceImpl implements SalesAnalysisService {

    private final SmartBiSalesDataRepository salesDataRepository;
    private final MetricCalculatorService metricCalculatorService;

    // 计算精度配置
    private static final int SCALE = 4;
    private static final int DISPLAY_SCALE = 2;
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    // 预警阈值配置
    private static final BigDecimal TARGET_RED_THRESHOLD = new BigDecimal("60");
    private static final BigDecimal TARGET_YELLOW_THRESHOLD = new BigDecimal("85");
    private static final BigDecimal MARGIN_RED_THRESHOLD = new BigDecimal("15");
    private static final BigDecimal MARGIN_YELLOW_THRESHOLD = new BigDecimal("25");
    private static final BigDecimal GROWTH_RED_THRESHOLD = new BigDecimal("-20");
    private static final BigDecimal GROWTH_YELLOW_THRESHOLD = new BigDecimal("-5");

    // ==================== 销售概览 ====================

    @Override
    @Transactional(readOnly = true)
    public DashboardResponse getSalesOverview(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取销售概览: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        List<SmartBiSalesData> salesData = salesDataRepository
                .findByFactoryIdAndOrderDateBetween(factoryId, startDate, endDate);

        if (salesData.isEmpty()) {
            log.warn("未找到销售数据: factoryId={}", factoryId);
            return buildEmptyDashboard();
        }

        // 计算 KPI 卡片
        List<MetricResult> metricResults = calculateKpiCards(salesData, factoryId, startDate, endDate);
        List<KPICard> kpiCards = convertToKPICards(metricResults);

        // 生成图表
        List<ChartConfig> chartList = new ArrayList<>();
        chartList.add(buildSalesTrendChartFromData(salesData, "DAY"));
        chartList.add(buildProductPieChart(salesData));
        Map<String, ChartConfig> charts = new LinkedHashMap<>();
        for (ChartConfig chart : chartList) {
            charts.put(chart.getTitle() != null ? chart.getTitle().replace(" ", "_") : "chart_" + charts.size(), chart);
        }

        // 生成排名
        List<RankingItem> salespersonRankings = calculateSalespersonRankingFromData(salesData);
        Map<String, List<RankingItem>> rankings = new LinkedHashMap<>();
        rankings.put("salesperson", salespersonRankings);

        // 生成 AI 洞察
        List<AIInsight> aiInsights = generateAiInsights(salesData, metricResults);

        // 生成建议
        List<String> suggestions = generateSuggestions(salesData, metricResults);

        return DashboardResponse.builder()
                .kpiCards(kpiCards)
                .charts(charts)
                .rankings(rankings)
                .aiInsights(aiInsights)
                .suggestions(suggestions)
                .lastUpdated(LocalDateTime.now())
                .build();
    }

    // ==================== 销售员分析 ====================

    @Override
    @Transactional(readOnly = true)
    public List<RankingItem> getSalespersonRanking(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取销售员排名: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        List<Object[]> results = salesDataRepository.findSalesBySalesperson(factoryId, startDate, endDate);
        List<RankingItem> rankings = new ArrayList<>();

        // 获取目标数据用于计算完成率
        List<SmartBiSalesData> salesData = salesDataRepository
                .findByFactoryIdAndOrderDateBetween(factoryId, startDate, endDate);
        Map<String, BigDecimal> targetMap = calculateSalespersonTargets(salesData);

        int rank = 1;
        for (Object[] row : results) {
            String salespersonName = (String) row[0];
            BigDecimal amount = toBigDecimal(row[1]);
            BigDecimal target = targetMap.getOrDefault(salespersonName, BigDecimal.ZERO);
            BigDecimal completionRate = calculateCompletionRate(amount, target);

            rankings.add(RankingItem.builder()
                    .rank(rank++)
                    .name(salespersonName)
                    .value(amount.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .target(target.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .completionRate(completionRate.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .alertLevel(determineCompletionAlertLevel(completionRate))
                    .build());
        }

        return rankings;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MetricResult> getSalespersonMetrics(String factoryId, String salespersonName,
                                                     LocalDate startDate, LocalDate endDate) {
        log.info("获取销售员指标: factoryId={}, salesperson={}, startDate={}, endDate={}",
                factoryId, salespersonName, startDate, endDate);

        List<SmartBiSalesData> salesData = salesDataRepository
                .findByFactoryIdAndOrderDateBetween(factoryId, startDate, endDate)
                .stream()
                .filter(d -> salespersonName.equals(d.getSalespersonName()))
                .collect(Collectors.toList());

        if (salesData.isEmpty()) {
            log.warn("未找到销售员数据: salesperson={}", salespersonName);
            return Collections.emptyList();
        }

        List<MetricResult> metrics = new ArrayList<>();

        // 销售额
        BigDecimal totalAmount = sumField(salesData, SmartBiSalesData::getAmount);
        metrics.add(MetricResult.of(MetricCalculatorService.SALES_AMOUNT, "销售额", totalAmount, "元"));

        // 订单数
        long orderCount = salesData.stream()
                .map(SmartBiSalesData::getProductId)
                .filter(Objects::nonNull)
                .distinct()
                .count();
        metrics.add(MetricResult.of(MetricCalculatorService.ORDER_COUNT, "订单数",
                new BigDecimal(orderCount), "单"));

        // 客单价
        BigDecimal avgOrderValue = orderCount > 0
                ? totalAmount.divide(new BigDecimal(orderCount), SCALE, ROUNDING_MODE)
                : BigDecimal.ZERO;
        metrics.add(MetricResult.of(MetricCalculatorService.AVG_ORDER_VALUE, "客单价", avgOrderValue, "元"));

        // 目标完成率
        BigDecimal totalTarget = sumField(salesData, SmartBiSalesData::getMonthlyTarget);
        BigDecimal completionRate = calculateCompletionRate(totalAmount, totalTarget);
        metrics.add(MetricResult.of(MetricCalculatorService.TARGET_COMPLETION, "目标完成率",
                completionRate, "%", determineCompletionAlertLevelEnum(completionRate)));

        // 客户数
        long customerCount = salesData.stream()
                .map(SmartBiSalesData::getCustomerName)
                .filter(Objects::nonNull)
                .distinct()
                .count();
        metrics.add(MetricResult.of(MetricCalculatorService.CUSTOMER_COUNT, "客户数",
                new BigDecimal(customerCount), "个"));

        // 毛利额
        BigDecimal totalCost = sumField(salesData, SmartBiSalesData::getCost);
        BigDecimal grossProfit = totalAmount.subtract(totalCost);
        metrics.add(MetricResult.of(MetricCalculatorService.GROSS_PROFIT, "毛利额", grossProfit, "元"));

        // 毛利率
        BigDecimal grossMargin = totalAmount.compareTo(BigDecimal.ZERO) > 0
                ? grossProfit.divide(totalAmount, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;
        metrics.add(MetricResult.of(MetricCalculatorService.GROSS_MARGIN, "毛利率",
                grossMargin, "%", determineMarginAlertLevelEnum(grossMargin)));

        // 计算环比增长（需要上一期数据）
        LocalDate previousStart = startDate.minusMonths(1);
        LocalDate previousEnd = endDate.minusMonths(1);
        List<SmartBiSalesData> previousData = salesDataRepository
                .findByFactoryIdAndOrderDateBetween(factoryId, previousStart, previousEnd)
                .stream()
                .filter(d -> salespersonName.equals(d.getSalespersonName()))
                .collect(Collectors.toList());

        if (!previousData.isEmpty()) {
            BigDecimal previousAmount = sumField(previousData, SmartBiSalesData::getAmount);
            BigDecimal momGrowth = metricCalculatorService.calculateMomGrowth(totalAmount, previousAmount);
            metrics.add(MetricResult.ofWithTrend(MetricCalculatorService.MOM_GROWTH, "环比增长",
                    momGrowth, "%", momGrowth, determineChangeDirection(momGrowth)));
        }

        return metrics;
    }

    // ==================== 产品分析 ====================

    @Override
    @Transactional(readOnly = true)
    public List<RankingItem> getProductRanking(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取产品排名: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        List<SmartBiSalesData> salesData = salesDataRepository
                .findByFactoryIdAndOrderDateBetween(factoryId, startDate, endDate);

        // 按产品类别分组统计
        Map<String, BigDecimal> productSales = salesData.stream()
                .filter(d -> d.getProductCategory() != null)
                .collect(Collectors.groupingBy(
                        SmartBiSalesData::getProductCategory,
                        Collectors.reducing(BigDecimal.ZERO,
                                SmartBiSalesData::getAmount,
                                BigDecimal::add)
                ));

        BigDecimal totalSales = productSales.values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<RankingItem> rankings = new ArrayList<>();
        int rank = 1;

        List<Map.Entry<String, BigDecimal>> sortedProducts = productSales.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                .collect(Collectors.toList());

        for (Map.Entry<String, BigDecimal> entry : sortedProducts) {
            BigDecimal percentage = totalSales.compareTo(BigDecimal.ZERO) > 0
                    ? entry.getValue().divide(totalSales, SCALE, ROUNDING_MODE)
                            .multiply(new BigDecimal("100"))
                    : BigDecimal.ZERO;

            rankings.add(RankingItem.builder()
                    .rank(rank++)
                    .name(entry.getKey())
                    .value(entry.getValue().setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .completionRate(percentage.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .alertLevel(MetricResult.AlertLevel.GREEN.name())
                    .build());
        }

        return rankings;
    }

    @Override
    @Transactional(readOnly = true)
    public ChartConfig getProductDistributionChart(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取产品分布图表: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        List<SmartBiSalesData> salesData = salesDataRepository
                .findByFactoryIdAndOrderDateBetween(factoryId, startDate, endDate);

        return buildProductPieChart(salesData);
    }

    // ==================== 客户分析 ====================

    @Override
    @Transactional(readOnly = true)
    public List<RankingItem> getCustomerRanking(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取客户排名: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        List<SmartBiSalesData> salesData = salesDataRepository
                .findByFactoryIdAndOrderDateBetween(factoryId, startDate, endDate);

        // 按客户分组统计
        Map<String, BigDecimal> customerSales = salesData.stream()
                .filter(d -> d.getCustomerName() != null)
                .collect(Collectors.groupingBy(
                        SmartBiSalesData::getCustomerName,
                        Collectors.reducing(BigDecimal.ZERO,
                                SmartBiSalesData::getAmount,
                                BigDecimal::add)
                ));

        BigDecimal totalSales = customerSales.values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<RankingItem> rankings = new ArrayList<>();
        int rank = 1;

        List<Map.Entry<String, BigDecimal>> sortedCustomers = customerSales.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                .limit(10) // Top 10
                .collect(Collectors.toList());

        for (Map.Entry<String, BigDecimal> entry : sortedCustomers) {
            BigDecimal percentage = totalSales.compareTo(BigDecimal.ZERO) > 0
                    ? entry.getValue().divide(totalSales, SCALE, ROUNDING_MODE)
                            .multiply(new BigDecimal("100"))
                    : BigDecimal.ZERO;

            rankings.add(RankingItem.builder()
                    .rank(rank++)
                    .name(entry.getKey())
                    .value(entry.getValue().setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .completionRate(percentage.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .alertLevel(MetricResult.AlertLevel.GREEN.name())
                    .build());
        }

        return rankings;
    }

    // ==================== 趋势分析 ====================

    @Override
    @Transactional(readOnly = true)
    public ChartConfig getSalesTrendChart(String factoryId, LocalDate startDate, LocalDate endDate, String period) {
        log.info("获取销售趋势图表: factoryId={}, startDate={}, endDate={}, period={}",
                factoryId, startDate, endDate, period);

        List<SmartBiSalesData> salesData = salesDataRepository
                .findByFactoryIdAndOrderDateBetween(factoryId, startDate, endDate);

        return buildSalesTrendChartFromData(salesData, period);
    }

    // ==================== 对比分析 ====================

    @Override
    @Transactional(readOnly = true)
    public ChartConfig getSalespersonComparisonChart(String factoryId, List<String> salespersonNames,
                                                      LocalDate startDate, LocalDate endDate) {
        log.info("获取销售员对比图表: factoryId={}, salespersons={}, startDate={}, endDate={}",
                factoryId, salespersonNames, startDate, endDate);

        List<SmartBiSalesData> salesData = salesDataRepository
                .findByFactoryIdAndOrderDateBetween(factoryId, startDate, endDate);

        // 过滤指定销售员
        Set<String> nameSet = new HashSet<>(salespersonNames);
        Map<String, List<SmartBiSalesData>> groupedData = salesData.stream()
                .filter(d -> d.getSalespersonName() != null && nameSet.contains(d.getSalespersonName()))
                .collect(Collectors.groupingBy(SmartBiSalesData::getSalespersonName));

        // 构建对比数据
        List<Map<String, Object>> chartData = new ArrayList<>();
        for (String name : salespersonNames) {
            List<SmartBiSalesData> personData = groupedData.getOrDefault(name, Collections.emptyList());

            BigDecimal salesAmount = sumField(personData, SmartBiSalesData::getAmount);
            BigDecimal target = sumField(personData, SmartBiSalesData::getMonthlyTarget);
            BigDecimal completionRate = calculateCompletionRate(salesAmount, target);
            BigDecimal grossProfit = salesAmount.subtract(sumField(personData, SmartBiSalesData::getCost));
            BigDecimal grossMargin = salesAmount.compareTo(BigDecimal.ZERO) > 0
                    ? grossProfit.divide(salesAmount, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                    : BigDecimal.ZERO;

            Map<String, Object> dataPoint = new LinkedHashMap<>();
            dataPoint.put("salesperson", name);
            dataPoint.put("salesAmount", salesAmount.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            dataPoint.put("completionRate", completionRate.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            dataPoint.put("grossMargin", grossMargin.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            dataPoint.put("customerCount", personData.stream()
                    .map(SmartBiSalesData::getCustomerName)
                    .filter(Objects::nonNull)
                    .distinct()
                    .count());

            chartData.add(dataPoint);
        }

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("showLegend", true);
        options.put("multiAxis", true);

        return ChartConfig.builder()
                .chartType("BAR")
                .title("销售员业绩对比")
                .xAxisField("salesperson")
                .yAxisField("salesAmount")
                .seriesField("metric")
                .data(chartData)
                .options(options)
                .build();
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 将 MetricResult 列表转换为 KPICard 列表
     */
    private List<KPICard> convertToKPICards(List<MetricResult> metricResults) {
        List<KPICard> kpiCards = new ArrayList<>();
        for (MetricResult metric : metricResults) {
            String status = "green";
            if (metric.getAlertLevel() != null) {
                switch (metric.getAlertLevel()) {
                    case "RED":
                        status = "red";
                        break;
                    case "YELLOW":
                        status = "yellow";
                        break;
                    default:
                        status = "green";
                }
            }

            String trend = "flat";
            if (metric.getChangeDirection() != null) {
                switch (metric.getChangeDirection()) {
                    case "UP":
                        trend = "up";
                        break;
                    case "DOWN":
                        trend = "down";
                        break;
                    default:
                        trend = "flat";
                }
            }

            kpiCards.add(KPICard.builder()
                    .key(metric.getMetricCode())
                    .title(metric.getMetricName())
                    .rawValue(metric.getValue())
                    .value(metric.getFormattedValue() != null ? metric.getFormattedValue() :
                           (metric.getValue() != null ? metric.getValue().toString() : "-"))
                    .unit(metric.getUnit())
                    .changeRate(metric.getChangePercent())
                    .change(metric.getChangeValue())
                    .trend(trend)
                    .status(status)
                    .description(metric.getDescription())
                    .build());
        }
        return kpiCards;
    }

    /**
     * 计算 KPI 卡片
     */
    private List<MetricResult> calculateKpiCards(List<SmartBiSalesData> salesData,
                                                  String factoryId,
                                                  LocalDate startDate,
                                                  LocalDate endDate) {
        List<MetricResult> kpiCards = new ArrayList<>();

        // 总销售额
        BigDecimal totalSales = sumField(salesData, SmartBiSalesData::getAmount);
        kpiCards.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.SALES_AMOUNT)
                .metricName("总销售额")
                .value(totalSales.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(formatCurrency(totalSales))
                .unit("元")
                .alertLevel(MetricResult.AlertLevel.GREEN.name())
                .build());

        // 订单数
        long orderCount = salesData.stream()
                .map(SmartBiSalesData::getProductId)
                .filter(Objects::nonNull)
                .distinct()
                .count();
        kpiCards.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.ORDER_COUNT)
                .metricName("订单数")
                .value(new BigDecimal(orderCount))
                .formattedValue(String.format("%,d", orderCount))
                .unit("单")
                .alertLevel(MetricResult.AlertLevel.GREEN.name())
                .build());

        // 客单价
        BigDecimal avgOrderValue = orderCount > 0
                ? totalSales.divide(new BigDecimal(orderCount), SCALE, ROUNDING_MODE)
                : BigDecimal.ZERO;
        kpiCards.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.AVG_ORDER_VALUE)
                .metricName("客单价")
                .value(avgOrderValue.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(formatCurrency(avgOrderValue))
                .unit("元")
                .alertLevel(MetricResult.AlertLevel.GREEN.name())
                .build());

        // 目标完成率
        BigDecimal totalTarget = sumField(salesData, SmartBiSalesData::getMonthlyTarget);
        BigDecimal completionRate = calculateCompletionRate(totalSales, totalTarget);
        String completionAlertLevel = determineCompletionAlertLevel(completionRate);
        kpiCards.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.TARGET_COMPLETION)
                .metricName("目标完成率")
                .value(completionRate.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(String.format("%.1f%%", completionRate.doubleValue()))
                .unit("%")
                .alertLevel(completionAlertLevel)
                .build());

        // 计算环比增长
        LocalDate previousStart = startDate.minusMonths(1);
        LocalDate previousEnd = endDate.minusMonths(1);
        List<SmartBiSalesData> previousData = salesDataRepository
                .findByFactoryIdAndOrderDateBetween(factoryId, previousStart, previousEnd);

        if (!previousData.isEmpty()) {
            BigDecimal previousSales = sumField(previousData, SmartBiSalesData::getAmount);
            BigDecimal momGrowth = metricCalculatorService.calculateMomGrowth(totalSales, previousSales);
            String growthDirection = determineChangeDirection(momGrowth);
            String growthAlertLevel = determineGrowthAlertLevel(momGrowth);

            kpiCards.add(MetricResult.builder()
                    .metricCode(MetricCalculatorService.MOM_GROWTH)
                    .metricName("环比增长")
                    .value(momGrowth.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .formattedValue(String.format("%+.1f%%", momGrowth.doubleValue()))
                    .unit("%")
                    .changePercent(momGrowth)
                    .changeDirection(growthDirection)
                    .alertLevel(growthAlertLevel)
                    .build());
        }

        return kpiCards;
    }

    /**
     * 从数据构建销售员排名
     */
    private List<RankingItem> calculateSalespersonRankingFromData(List<SmartBiSalesData> salesData) {
        Map<String, BigDecimal> salespersonSales = salesData.stream()
                .filter(d -> d.getSalespersonName() != null)
                .collect(Collectors.groupingBy(
                        SmartBiSalesData::getSalespersonName,
                        Collectors.reducing(BigDecimal.ZERO,
                                SmartBiSalesData::getAmount,
                                BigDecimal::add)
                ));

        Map<String, BigDecimal> targetMap = calculateSalespersonTargets(salesData);

        List<RankingItem> rankings = new ArrayList<>();
        int rank = 1;

        List<Map.Entry<String, BigDecimal>> sortedSalespersons = salespersonSales.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                .collect(Collectors.toList());

        for (Map.Entry<String, BigDecimal> entry : sortedSalespersons) {
            String name = entry.getKey();
            BigDecimal amount = entry.getValue();
            BigDecimal target = targetMap.getOrDefault(name, BigDecimal.ZERO);
            BigDecimal completionRate = calculateCompletionRate(amount, target);

            rankings.add(RankingItem.builder()
                    .rank(rank++)
                    .name(name)
                    .value(amount.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .target(target.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .completionRate(completionRate.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .alertLevel(determineCompletionAlertLevel(completionRate))
                    .build());
        }

        return rankings;
    }

    /**
     * 计算销售员目标
     */
    private Map<String, BigDecimal> calculateSalespersonTargets(List<SmartBiSalesData> salesData) {
        return salesData.stream()
                .filter(d -> d.getSalespersonName() != null)
                .collect(Collectors.groupingBy(
                        SmartBiSalesData::getSalespersonName,
                        Collectors.reducing(BigDecimal.ZERO,
                                d -> d.getMonthlyTarget() != null ? d.getMonthlyTarget() : BigDecimal.ZERO,
                                BigDecimal::add)
                ));
    }

    /**
     * 构建销售趋势图表
     */
    private ChartConfig buildSalesTrendChartFromData(List<SmartBiSalesData> salesData, String period) {
        Map<String, BigDecimal> periodSales;

        switch (period.toUpperCase()) {
            case "WEEK":
                periodSales = aggregateByWeek(salesData);
                break;
            case "MONTH":
                periodSales = aggregateByMonth(salesData);
                break;
            case "DAY":
            default:
                periodSales = aggregateByDay(salesData);
                break;
        }

        List<Map<String, Object>> chartData = periodSales.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> {
                    Map<String, Object> dataPoint = new LinkedHashMap<>();
                    dataPoint.put("date", entry.getKey());
                    dataPoint.put("amount", entry.getValue().setScale(DISPLAY_SCALE, ROUNDING_MODE));
                    return dataPoint;
                })
                .collect(Collectors.toList());

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("showDataLabels", false);
        options.put("smooth", true);

        return ChartConfig.builder()
                .chartType("LINE")
                .title("销售趋势")
                .xAxisField("date")
                .yAxisField("amount")
                .data(chartData)
                .options(options)
                .build();
    }

    /**
     * 按日聚合
     */
    private Map<String, BigDecimal> aggregateByDay(List<SmartBiSalesData> salesData) {
        return salesData.stream()
                .filter(d -> d.getOrderDate() != null)
                .collect(Collectors.groupingBy(
                        d -> d.getOrderDate().toString(),
                        TreeMap::new,
                        Collectors.reducing(BigDecimal.ZERO,
                                SmartBiSalesData::getAmount,
                                BigDecimal::add)
                ));
    }

    /**
     * 按周聚合
     */
    private Map<String, BigDecimal> aggregateByWeek(List<SmartBiSalesData> salesData) {
        return salesData.stream()
                .filter(d -> d.getOrderDate() != null)
                .collect(Collectors.groupingBy(
                        d -> {
                            LocalDate date = d.getOrderDate();
                            LocalDate weekStart = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                            return weekStart.toString();
                        },
                        TreeMap::new,
                        Collectors.reducing(BigDecimal.ZERO,
                                SmartBiSalesData::getAmount,
                                BigDecimal::add)
                ));
    }

    /**
     * 按月聚合
     */
    private Map<String, BigDecimal> aggregateByMonth(List<SmartBiSalesData> salesData) {
        return salesData.stream()
                .filter(d -> d.getOrderDate() != null)
                .collect(Collectors.groupingBy(
                        d -> d.getOrderDate().getYear() + "-" +
                                String.format("%02d", d.getOrderDate().getMonthValue()),
                        TreeMap::new,
                        Collectors.reducing(BigDecimal.ZERO,
                                SmartBiSalesData::getAmount,
                                BigDecimal::add)
                ));
    }

    /**
     * 构建产品饼图
     */
    private ChartConfig buildProductPieChart(List<SmartBiSalesData> salesData) {
        Map<String, BigDecimal> productSales = salesData.stream()
                .filter(d -> d.getProductCategory() != null)
                .collect(Collectors.groupingBy(
                        SmartBiSalesData::getProductCategory,
                        Collectors.reducing(BigDecimal.ZERO,
                                SmartBiSalesData::getAmount,
                                BigDecimal::add)
                ));

        List<Map<String, Object>> chartData = productSales.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                .map(entry -> {
                    Map<String, Object> dataPoint = new LinkedHashMap<>();
                    dataPoint.put("category", entry.getKey());
                    dataPoint.put("amount", entry.getValue().setScale(DISPLAY_SCALE, ROUNDING_MODE));
                    return dataPoint;
                })
                .collect(Collectors.toList());

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("showPercentage", true);
        options.put("showLegend", true);

        return ChartConfig.builder()
                .chartType("PIE")
                .title("产品销售占比")
                .xAxisField("category")
                .yAxisField("amount")
                .data(chartData)
                .options(options)
                .build();
    }

    /**
     * 生成 AI 洞察
     */
    private List<AIInsight> generateAiInsights(List<SmartBiSalesData> salesData,
                                                List<MetricResult> kpiCards) {
        List<AIInsight> insights = new ArrayList<>();

        // 基于完成率生成洞察
        MetricResult completionMetric = kpiCards.stream()
                .filter(m -> MetricCalculatorService.TARGET_COMPLETION.equals(m.getMetricCode()))
                .findFirst()
                .orElse(null);

        if (completionMetric != null && completionMetric.getValue() != null) {
            BigDecimal completionRate = completionMetric.getValue();
            if (completionRate.compareTo(TARGET_RED_THRESHOLD) < 0) {
                insights.add(AIInsight.builder()
                        .level("RED")
                        .category("目标完成")
                        .message(String.format("目标完成率仅为 %.1f%%，严重落后于计划", completionRate.doubleValue()))
                        .actionSuggestion("建议立即召开销售会议，分析原因并制定追赶计划")
                        .build());
            } else if (completionRate.compareTo(TARGET_YELLOW_THRESHOLD) < 0) {
                insights.add(AIInsight.builder()
                        .level("YELLOW")
                        .category("目标完成")
                        .message(String.format("目标完成率为 %.1f%%，需要加速", completionRate.doubleValue()))
                        .actionSuggestion("建议加强客户跟进，提高成交转化率")
                        .build());
            }
        }

        // 基于环比增长生成洞察
        MetricResult growthMetric = kpiCards.stream()
                .filter(m -> MetricCalculatorService.MOM_GROWTH.equals(m.getMetricCode()))
                .findFirst()
                .orElse(null);

        if (growthMetric != null && growthMetric.getValue() != null) {
            BigDecimal growth = growthMetric.getValue();
            if (growth.compareTo(GROWTH_RED_THRESHOLD) < 0) {
                insights.add(AIInsight.builder()
                        .level("RED")
                        .category("销售趋势")
                        .message(String.format("销售额环比下降 %.1f%%，需要关注", growth.abs().doubleValue()))
                        .actionSuggestion("建议分析下降原因，是否存在季节性因素或市场变化")
                        .build());
            } else if (growth.compareTo(BigDecimal.ZERO) > 0) {
                insights.add(AIInsight.builder()
                        .level("GREEN")
                        .category("销售趋势")
                        .message(String.format("销售额环比增长 %.1f%%，保持良好势头", growth.doubleValue()))
                        .actionSuggestion("继续保持当前销售策略，同时关注增长可持续性")
                        .build());
            }
        }

        // 找出表现最好和最差的销售员
        Map<String, BigDecimal> salespersonSales = salesData.stream()
                .filter(d -> d.getSalespersonName() != null)
                .collect(Collectors.groupingBy(
                        SmartBiSalesData::getSalespersonName,
                        Collectors.reducing(BigDecimal.ZERO,
                                SmartBiSalesData::getAmount,
                                BigDecimal::add)
                ));

        if (salespersonSales.size() > 1) {
            Map.Entry<String, BigDecimal> top = salespersonSales.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .orElse(null);
            Map.Entry<String, BigDecimal> bottom = salespersonSales.entrySet().stream()
                    .min(Map.Entry.comparingByValue())
                    .orElse(null);

            if (top != null && bottom != null) {
                insights.add(AIInsight.builder()
                        .level("INFO")
                        .category("人员表现")
                        .message(String.format("销冠 %s 贡献 %s 元，可分享成功经验",
                                top.getKey(), formatCurrency(top.getValue())))
                        .relatedEntity(top.getKey())
                        .actionSuggestion("建议安排销冠分享会，提升团队整体能力")
                        .build());
            }
        }

        return insights;
    }

    /**
     * 生成建议
     */
    private List<String> generateSuggestions(List<SmartBiSalesData> salesData,
                                              List<MetricResult> kpiCards) {
        List<String> suggestions = new ArrayList<>();

        // 基于数据特征生成建议
        long customerCount = salesData.stream()
                .map(SmartBiSalesData::getCustomerName)
                .filter(Objects::nonNull)
                .distinct()
                .count();

        long salespersonCount = salesData.stream()
                .map(SmartBiSalesData::getSalespersonName)
                .filter(Objects::nonNull)
                .distinct()
                .count();

        if (salespersonCount > 0) {
            BigDecimal avgCustomerPerPerson = new BigDecimal(customerCount)
                    .divide(new BigDecimal(salespersonCount), SCALE, ROUNDING_MODE);
            if (avgCustomerPerPerson.compareTo(new BigDecimal("5")) < 0) {
                suggestions.add("人均服务客户数较少，建议扩大客户开发力度");
            }
        }

        // 检查产品集中度
        Map<String, BigDecimal> productSales = salesData.stream()
                .filter(d -> d.getProductCategory() != null)
                .collect(Collectors.groupingBy(
                        SmartBiSalesData::getProductCategory,
                        Collectors.reducing(BigDecimal.ZERO,
                                SmartBiSalesData::getAmount,
                                BigDecimal::add)
                ));

        if (productSales.size() > 0) {
            BigDecimal totalSales = productSales.values().stream()
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal topProductSales = productSales.values().stream()
                    .max(BigDecimal::compareTo)
                    .orElse(BigDecimal.ZERO);

            if (totalSales.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal concentration = topProductSales.divide(totalSales, SCALE, ROUNDING_MODE)
                        .multiply(new BigDecimal("100"));
                if (concentration.compareTo(new BigDecimal("60")) > 0) {
                    suggestions.add("产品销售过于集中，建议推广其他产品线以降低风险");
                }
            }
        }

        return suggestions;
    }

    /**
     * 构建空仪表盘
     */
    private DashboardResponse buildEmptyDashboard() {
        return DashboardResponse.builder()
                .kpiCards(Collections.emptyList())
                .charts(Collections.emptyMap())
                .rankings(Collections.emptyMap())
                .aiInsights(Collections.singletonList(AIInsight.builder()
                        .level("YELLOW")
                        .category("数据状态")
                        .message("当前时间范围内暂无销售数据")
                        .actionSuggestion("请上传销售数据或调整时间范围")
                        .build()))
                .suggestions(Collections.singletonList("请先上传销售数据以开始分析"))
                .lastUpdated(LocalDateTime.now())
                .build();
    }

    // ==================== 工具方法 ====================

    /**
     * 计算完成率
     */
    private BigDecimal calculateCompletionRate(BigDecimal actual, BigDecimal target) {
        if (target == null || target.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return actual.divide(target, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"));
    }

    /**
     * 确定完成率预警级别
     */
    private String determineCompletionAlertLevel(BigDecimal completionRate) {
        if (completionRate.compareTo(TARGET_RED_THRESHOLD) < 0) {
            return MetricResult.AlertLevel.RED.name();
        }
        if (completionRate.compareTo(TARGET_YELLOW_THRESHOLD) < 0) {
            return MetricResult.AlertLevel.YELLOW.name();
        }
        return MetricResult.AlertLevel.GREEN.name();
    }

    /**
     * 确定完成率预警级别枚举
     */
    private MetricResult.AlertLevel determineCompletionAlertLevelEnum(BigDecimal completionRate) {
        if (completionRate.compareTo(TARGET_RED_THRESHOLD) < 0) {
            return MetricResult.AlertLevel.RED;
        }
        if (completionRate.compareTo(TARGET_YELLOW_THRESHOLD) < 0) {
            return MetricResult.AlertLevel.YELLOW;
        }
        return MetricResult.AlertLevel.GREEN;
    }

    /**
     * 确定毛利率预警级别枚举
     */
    private MetricResult.AlertLevel determineMarginAlertLevelEnum(BigDecimal margin) {
        if (margin.compareTo(MARGIN_RED_THRESHOLD) < 0) {
            return MetricResult.AlertLevel.RED;
        }
        if (margin.compareTo(MARGIN_YELLOW_THRESHOLD) < 0) {
            return MetricResult.AlertLevel.YELLOW;
        }
        return MetricResult.AlertLevel.GREEN;
    }

    /**
     * 确定增长率预警级别
     */
    private String determineGrowthAlertLevel(BigDecimal growth) {
        if (growth.compareTo(GROWTH_RED_THRESHOLD) < 0) {
            return MetricResult.AlertLevel.RED.name();
        }
        if (growth.compareTo(GROWTH_YELLOW_THRESHOLD) < 0) {
            return MetricResult.AlertLevel.YELLOW.name();
        }
        return MetricResult.AlertLevel.GREEN.name();
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
        }
        return "STABLE";
    }

    /**
     * 字段求和
     */
    private BigDecimal sumField(List<SmartBiSalesData> data,
                                 java.util.function.Function<SmartBiSalesData, BigDecimal> extractor) {
        return data.stream()
                .map(extractor)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * 转换为 BigDecimal
     */
    private BigDecimal toBigDecimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal) {
            return (BigDecimal) value;
        }
        if (value instanceof Number) {
            return new BigDecimal(value.toString());
        }
        return BigDecimal.ZERO;
    }

    /**
     * 格式化货币
     */
    private String formatCurrency(BigDecimal value) {
        if (value == null) {
            return "-";
        }
        return String.format("%,.2f", value.setScale(DISPLAY_SCALE, ROUNDING_MODE).doubleValue());
    }
}
