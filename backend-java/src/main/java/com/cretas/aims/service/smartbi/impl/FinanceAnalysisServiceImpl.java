package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.smartbi.AIInsight;
import com.cretas.aims.dto.smartbi.ChartConfig;
import com.cretas.aims.dto.smartbi.DashboardResponse;
import com.cretas.aims.dto.smartbi.KPICard;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.dto.smartbi.RankingItem;
import com.cretas.aims.entity.smartbi.SmartBiFinanceData;
import com.cretas.aims.entity.smartbi.SmartBiSalesData;
import com.cretas.aims.entity.smartbi.enums.RecordType;
import com.cretas.aims.repository.smartbi.SmartBiFinanceDataRepository;
import com.cretas.aims.repository.smartbi.SmartBiSalesDataRepository;
import com.cretas.aims.service.smartbi.FinanceAnalysisService;
import com.cretas.aims.service.smartbi.MetricCalculatorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.WeekFields;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 财务分析服务实现
 *
 * 实现 SmartBI 系统中财务相关的分析功能：
 * - 利润分析：基于销售数据计算毛利、净利
 * - 成本结构分析：原材料、人工、制造费用分解
 * - 应收账款分析：账龄分布、逾期率、客户排名
 * - 应付账款分析：账龄分布、付款情况
 * - 预算执行分析：执行率、差异、瀑布图
 *
 * 所有金融计算使用 BigDecimal 确保精度。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FinanceAnalysisServiceImpl implements FinanceAnalysisService {

    private final SmartBiFinanceDataRepository financeDataRepository;
    private final SmartBiSalesDataRepository salesDataRepository;
    private final MetricCalculatorService metricCalculatorService;

    // 计算精度配置
    private static final int SCALE = 4;
    private static final int DISPLAY_SCALE = 2;
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    // 预警阈值
    private static final double AGING_90_RED_THRESHOLD = 20.0;
    private static final double AGING_90_YELLOW_THRESHOLD = 10.0;
    private static final double BUDGET_EXECUTION_RED_THRESHOLD = 120.0;
    private static final double BUDGET_EXECUTION_YELLOW_THRESHOLD = 100.0;

    // ==================== 财务概览 ====================

    @Override
    public DashboardResponse getFinanceOverview(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取财务概览: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        // 获取核心KPI指标
        List<MetricResult> metricResults = new ArrayList<>();
        metricResults.addAll(getProfitMetrics(factoryId, startDate, endDate));
        metricResults.addAll(getReceivableMetrics(factoryId, endDate));
        List<KPICard> kpiCards = convertToKPICards(metricResults);

        // 获取关键图表
        List<ChartConfig> chartList = new ArrayList<>();
        chartList.add(getProfitTrendChart(factoryId, startDate, endDate, PERIOD_MONTH));
        chartList.add(getCostStructureChart(factoryId, startDate, endDate));
        chartList.add(getReceivableAgingChart(factoryId, endDate));
        Map<String, ChartConfig> charts = new LinkedHashMap<>();
        for (ChartConfig chart : chartList) {
            charts.put(chart.getTitle() != null ? chart.getTitle().replace(" ", "_") : "chart_" + charts.size(), chart);
        }

        // 获取逾期客户排名
        List<RankingItem> overdueRankings = getOverdueCustomerRanking(factoryId, endDate);
        Map<String, List<RankingItem>> rankings = new LinkedHashMap<>();
        rankings.put("overdue_customers", overdueRankings);

        // 生成AI洞察
        List<AIInsight> aiInsights = generateFinanceInsights(metricResults, overdueRankings);

        // 生成建议
        List<String> suggestions = generateFinanceSuggestions(metricResults, overdueRankings);

        return DashboardResponse.builder()
                .kpiCards(kpiCards)
                .charts(charts)
                .rankings(rankings)
                .aiInsights(aiInsights)
                .suggestions(suggestions)
                .lastUpdated(LocalDateTime.now())
                .build();
    }

    // ==================== 利润分析 ====================

    @Override
    public ChartConfig getProfitTrendChart(String factoryId, LocalDate startDate, LocalDate endDate, String period) {
        log.info("获取利润趋势图: factoryId={}, period={}", factoryId, period);

        // 获取销售数据计算利润
        List<SmartBiSalesData> salesData = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                factoryId, startDate, endDate);

        // 按周期聚合
        Map<String, BigDecimal[]> aggregatedData = aggregateProfitByPeriod(salesData, period);

        // 构建图表数据
        List<Map<String, Object>> chartData = new ArrayList<>();
        for (Map.Entry<String, BigDecimal[]> entry : aggregatedData.entrySet()) {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("period", entry.getKey());
            point.put("grossProfit", entry.getValue()[0]);
            point.put("netProfit", entry.getValue()[1]);
            point.put("grossMargin", entry.getValue()[2]);
            chartData.add(point);
        }

        // 配置图表选项
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("yAxis", Arrays.asList(
                Map.of("name", "金额", "position", "left"),
                Map.of("name", "毛利率(%)", "position", "right")
        ));
        options.put("series", Arrays.asList(
                Map.of("name", "毛利额", "type", "bar", "yAxisIndex", 0),
                Map.of("name", "净利润", "type", "bar", "yAxisIndex", 0),
                Map.of("name", "毛利率", "type", "line", "yAxisIndex", 1)
        ));

        return ChartConfig.builder()
                .chartType("LINE_BAR")
                .title("利润趋势分析")
                .xAxisField("period")
                .yAxisField("grossProfit")
                .seriesField("metric")
                .data(chartData)
                .options(options)
                .build();
    }

    @Override
    public List<MetricResult> getProfitMetrics(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取利润指标: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        List<SmartBiSalesData> salesData = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                factoryId, startDate, endDate);

        List<MetricResult> metrics = new ArrayList<>();

        // 计算汇总值
        BigDecimal totalRevenue = salesData.stream()
                .map(SmartBiSalesData::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCost = salesData.stream()
                .map(SmartBiSalesData::getCost)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal grossProfit = totalRevenue.subtract(totalCost);
        BigDecimal grossMargin = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                ? grossProfit.divide(totalRevenue, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;

        // 毛利额
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.GROSS_PROFIT)
                .metricName("毛利额")
                .value(grossProfit.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(formatCurrency(grossProfit))
                .unit("元")
                .alertLevel(MetricResult.AlertLevel.GREEN.name())
                .description("销售收入减去销售成本")
                .build());

        // 毛利率
        String marginAlertLevel = determineGrossMarginAlertLevel(grossMargin);
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.GROSS_MARGIN)
                .metricName("毛利率")
                .value(grossMargin.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(grossMargin.setScale(DISPLAY_SCALE, ROUNDING_MODE) + "%")
                .unit("%")
                .alertLevel(marginAlertLevel)
                .description("毛利额占销售收入的比例")
                .build());

        // 净利润（假设费用为毛利的30%）
        BigDecimal expenses = grossProfit.multiply(new BigDecimal("0.30"));
        BigDecimal netProfit = grossProfit.subtract(expenses);
        BigDecimal netMargin = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                ? netProfit.divide(totalRevenue, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;

        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.NET_PROFIT)
                .metricName("净利润")
                .value(netProfit.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(formatCurrency(netProfit))
                .unit("元")
                .alertLevel(netProfit.compareTo(BigDecimal.ZERO) >= 0
                        ? MetricResult.AlertLevel.GREEN.name()
                        : MetricResult.AlertLevel.RED.name())
                .description("毛利减去各项费用后的利润")
                .build());

        // 净利率
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.NET_MARGIN)
                .metricName("净利率")
                .value(netMargin.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(netMargin.setScale(DISPLAY_SCALE, ROUNDING_MODE) + "%")
                .unit("%")
                .alertLevel(MetricResult.AlertLevel.GREEN.name())
                .description("净利润占销售收入的比例")
                .build());

        // ROI
        BigDecimal roi = totalCost.compareTo(BigDecimal.ZERO) > 0
                ? grossProfit.divide(totalCost, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.ROI)
                .metricName("投入产出比")
                .value(roi.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(roi.setScale(DISPLAY_SCALE, ROUNDING_MODE) + "%")
                .unit("%")
                .alertLevel(determineRoiAlertLevel(roi))
                .description("毛利额与成本的比率")
                .build());

        return metrics;
    }

    // ==================== 成本结构分析 ====================

    @Override
    public ChartConfig getCostStructureChart(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取成本结构图: factoryId={}", factoryId);

        List<SmartBiFinanceData> costData = financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.COST, startDate, endDate);

        // 汇总成本结构
        BigDecimal materialCost = BigDecimal.ZERO;
        BigDecimal laborCost = BigDecimal.ZERO;
        BigDecimal overheadCost = BigDecimal.ZERO;

        for (SmartBiFinanceData data : costData) {
            materialCost = materialCost.add(data.getMaterialCost() != null ? data.getMaterialCost() : BigDecimal.ZERO);
            laborCost = laborCost.add(data.getLaborCost() != null ? data.getLaborCost() : BigDecimal.ZERO);
            overheadCost = overheadCost.add(data.getOverheadCost() != null ? data.getOverheadCost() : BigDecimal.ZERO);
        }

        BigDecimal totalCost = materialCost.add(laborCost).add(overheadCost);

        // 构建饼图数据
        List<Map<String, Object>> chartData = new ArrayList<>();
        if (totalCost.compareTo(BigDecimal.ZERO) > 0) {
            chartData.add(createPieDataItem(COST_CATEGORY_MATERIAL, materialCost, totalCost));
            chartData.add(createPieDataItem(COST_CATEGORY_LABOR, laborCost, totalCost));
            chartData.add(createPieDataItem(COST_CATEGORY_OVERHEAD, overheadCost, totalCost));
        }

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("showPercentage", true);
        options.put("colors", Arrays.asList("#5470c6", "#91cc75", "#fac858"));

        return ChartConfig.builder()
                .chartType("PIE")
                .title("成本结构分析")
                .xAxisField("category")
                .yAxisField("value")
                .data(chartData)
                .options(options)
                .build();
    }

    @Override
    public ChartConfig getCostTrendChart(String factoryId, LocalDate startDate, LocalDate endDate, String period) {
        log.info("获取成本趋势图: factoryId={}, period={}", factoryId, period);

        List<SmartBiFinanceData> costData = financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.COST, startDate, endDate);

        // 按周期聚合成本
        Map<String, BigDecimal[]> aggregatedData = aggregateCostByPeriod(costData, period);

        // 构建图表数据
        List<Map<String, Object>> chartData = new ArrayList<>();
        for (Map.Entry<String, BigDecimal[]> entry : aggregatedData.entrySet()) {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("period", entry.getKey());
            point.put("materialCost", entry.getValue()[0]);
            point.put("laborCost", entry.getValue()[1]);
            point.put("overheadCost", entry.getValue()[2]);
            point.put("totalCost", entry.getValue()[3]);
            chartData.add(point);
        }

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("stack", true);
        options.put("series", Arrays.asList(
                Map.of("name", COST_CATEGORY_MATERIAL, "stack", "cost"),
                Map.of("name", COST_CATEGORY_LABOR, "stack", "cost"),
                Map.of("name", COST_CATEGORY_OVERHEAD, "stack", "cost")
        ));

        return ChartConfig.builder()
                .chartType("BAR")
                .title("成本趋势分析")
                .xAxisField("period")
                .yAxisField("totalCost")
                .seriesField("costType")
                .data(chartData)
                .options(options)
                .build();
    }

    // ==================== 应收账款分析 ====================

    @Override
    public ChartConfig getReceivableAgingChart(String factoryId, LocalDate date) {
        log.info("获取应收账龄分布图: factoryId={}, date={}", factoryId, date);

        // 获取截止日期前的应收数据
        List<SmartBiFinanceData> arData = financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.AR, date.minusYears(1), date);

        // 按账龄分段汇总
        Map<String, BigDecimal> agingBuckets = calculateAgingBuckets(arData);

        // 构建图表数据
        List<Map<String, Object>> chartData = new ArrayList<>();
        BigDecimal totalAR = agingBuckets.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        for (String bucket : Arrays.asList(AGING_BUCKET_0_30, AGING_BUCKET_31_60, AGING_BUCKET_61_90, AGING_BUCKET_OVER_90)) {
            BigDecimal amount = agingBuckets.getOrDefault(bucket, BigDecimal.ZERO);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("agingBucket", bucket);
            item.put("amount", amount);
            item.put("percentage", totalAR.compareTo(BigDecimal.ZERO) > 0
                    ? amount.divide(totalAR, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                    : BigDecimal.ZERO);
            item.put("alertLevel", getAgingBucketAlertLevel(bucket));
            chartData.add(item);
        }

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("colors", Arrays.asList("#91cc75", "#fac858", "#ee6666", "#c23531"));
        options.put("showAlert", true);

        return ChartConfig.builder()
                .chartType("BAR")
                .title("应收账款账龄分布")
                .xAxisField("agingBucket")
                .yAxisField("amount")
                .data(chartData)
                .options(options)
                .build();
    }

    @Override
    public List<MetricResult> getReceivableMetrics(String factoryId, LocalDate date) {
        log.info("获取应收指标: factoryId={}, date={}", factoryId, date);

        List<SmartBiFinanceData> arData = financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.AR, date.minusYears(1), date);

        List<MetricResult> metrics = new ArrayList<>();

        // 计算汇总值
        BigDecimal totalReceivable = arData.stream()
                .map(SmartBiFinanceData::getReceivableAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCollection = arData.stream()
                .map(SmartBiFinanceData::getCollectionAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 应收余额
        BigDecimal arBalance = totalReceivable.subtract(totalCollection);
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.AR_BALANCE)
                .metricName("应收余额")
                .value(arBalance.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(formatCurrency(arBalance))
                .unit("元")
                .alertLevel(MetricResult.AlertLevel.GREEN.name())
                .description("尚未收回的应收账款总额")
                .build());

        // 回款率
        BigDecimal collectionRate = totalReceivable.compareTo(BigDecimal.ZERO) > 0
                ? totalCollection.divide(totalReceivable, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.COLLECTION_RATE)
                .metricName("回款率")
                .value(collectionRate.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(collectionRate.setScale(DISPLAY_SCALE, ROUNDING_MODE) + "%")
                .unit("%")
                .alertLevel(determineCollectionRateAlertLevel(collectionRate))
                .description("已回款金额占应收总额的比例")
                .build());

        // 计算账龄分布指标
        Map<String, BigDecimal> agingBuckets = calculateAgingBuckets(arData);
        BigDecimal over30 = agingBuckets.getOrDefault(AGING_BUCKET_31_60, BigDecimal.ZERO)
                .add(agingBuckets.getOrDefault(AGING_BUCKET_61_90, BigDecimal.ZERO))
                .add(agingBuckets.getOrDefault(AGING_BUCKET_OVER_90, BigDecimal.ZERO));
        BigDecimal over60 = agingBuckets.getOrDefault(AGING_BUCKET_61_90, BigDecimal.ZERO)
                .add(agingBuckets.getOrDefault(AGING_BUCKET_OVER_90, BigDecimal.ZERO));
        BigDecimal over90 = agingBuckets.getOrDefault(AGING_BUCKET_OVER_90, BigDecimal.ZERO);

        BigDecimal totalForRatio = agingBuckets.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        // 30天以上账龄占比
        BigDecimal aging30Ratio = totalForRatio.compareTo(BigDecimal.ZERO) > 0
                ? over30.divide(totalForRatio, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.AGING_30_RATIO)
                .metricName("30天以上账龄占比")
                .value(aging30Ratio.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(aging30Ratio.setScale(DISPLAY_SCALE, ROUNDING_MODE) + "%")
                .unit("%")
                .alertLevel(metricCalculatorService.determineAlertLevel(MetricCalculatorService.AGING_30_RATIO, aging30Ratio))
                .description("账龄超过30天的应收款占比")
                .build());

        // 60天以上账龄占比
        BigDecimal aging60Ratio = totalForRatio.compareTo(BigDecimal.ZERO) > 0
                ? over60.divide(totalForRatio, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.AGING_60_RATIO)
                .metricName("60天以上账龄占比")
                .value(aging60Ratio.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(aging60Ratio.setScale(DISPLAY_SCALE, ROUNDING_MODE) + "%")
                .unit("%")
                .alertLevel(metricCalculatorService.determineAlertLevel(MetricCalculatorService.AGING_60_RATIO, aging60Ratio))
                .description("账龄超过60天的应收款占比")
                .build());

        // 90天以上账龄占比（核心风险指标）
        BigDecimal aging90Ratio = totalForRatio.compareTo(BigDecimal.ZERO) > 0
                ? over90.divide(totalForRatio, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;
        String aging90AlertLevel = aging90Ratio.doubleValue() > AGING_90_RED_THRESHOLD
                ? MetricResult.AlertLevel.RED.name()
                : (aging90Ratio.doubleValue() > AGING_90_YELLOW_THRESHOLD
                        ? MetricResult.AlertLevel.YELLOW.name()
                        : MetricResult.AlertLevel.GREEN.name());
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.AGING_90_RATIO)
                .metricName("90天以上账龄占比")
                .value(aging90Ratio.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(aging90Ratio.setScale(DISPLAY_SCALE, ROUNDING_MODE) + "%")
                .unit("%")
                .alertLevel(aging90AlertLevel)
                .description("账龄超过90天的高风险应收款占比")
                .build());

        return metrics;
    }

    @Override
    public List<RankingItem> getOverdueCustomerRanking(String factoryId, LocalDate date) {
        log.info("获取逾期客户排名: factoryId={}, date={}", factoryId, date);

        List<SmartBiFinanceData> arData = financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.AR, date.minusYears(1), date);

        // 按客户汇总逾期金额
        Map<String, BigDecimal[]> customerOverdue = new LinkedHashMap<>();
        for (SmartBiFinanceData data : arData) {
            if (data.getCustomerName() == null || data.getAgingDays() == null || data.getAgingDays() <= 0) {
                continue;
            }
            String customer = data.getCustomerName();
            BigDecimal receivable = data.getReceivableAmount() != null ? data.getReceivableAmount() : BigDecimal.ZERO;
            BigDecimal collection = data.getCollectionAmount() != null ? data.getCollectionAmount() : BigDecimal.ZERO;
            BigDecimal outstanding = receivable.subtract(collection);

            if (outstanding.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal[] values = customerOverdue.computeIfAbsent(customer, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
                values[0] = values[0].add(outstanding); // 逾期金额
                values[1] = BigDecimal.valueOf(Math.max(values[1].intValue(), data.getAgingDays())); // 最大账龄
            }
        }

        // 排序并生成排名
        List<RankingItem> rankings = new ArrayList<>();
        List<Map.Entry<String, BigDecimal[]>> sorted = customerOverdue.entrySet().stream()
                .sorted((a, b) -> b.getValue()[0].compareTo(a.getValue()[0]))
                .limit(10)
                .collect(Collectors.toList());

        int rank = 1;
        for (Map.Entry<String, BigDecimal[]> entry : sorted) {
            int maxAgingDays = entry.getValue()[1].intValue();
            String alertLevel = maxAgingDays > 90
                    ? MetricResult.AlertLevel.RED.name()
                    : (maxAgingDays > 60
                            ? MetricResult.AlertLevel.YELLOW.name()
                            : MetricResult.AlertLevel.GREEN.name());

            rankings.add(RankingItem.builder()
                    .rank(rank++)
                    .name(entry.getKey())
                    .value(entry.getValue()[0].setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .alertLevel(alertLevel)
                    .build());
        }

        return rankings;
    }

    @Override
    public ChartConfig getReceivableTrendChart(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取应收趋势图: factoryId={}", factoryId);

        List<SmartBiFinanceData> arData = financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.AR, startDate, endDate);

        // 按月聚合
        Map<String, BigDecimal[]> monthlyData = new TreeMap<>();
        for (SmartBiFinanceData data : arData) {
            String month = data.getRecordDate().format(DateTimeFormatter.ofPattern("yyyy-MM"));
            BigDecimal[] values = monthlyData.computeIfAbsent(month, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            values[0] = values[0].add(data.getReceivableAmount() != null ? data.getReceivableAmount() : BigDecimal.ZERO);
            values[1] = values[1].add(data.getCollectionAmount() != null ? data.getCollectionAmount() : BigDecimal.ZERO);
        }

        // 构建图表数据
        List<Map<String, Object>> chartData = new ArrayList<>();
        for (Map.Entry<String, BigDecimal[]> entry : monthlyData.entrySet()) {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("period", entry.getKey());
            point.put("receivable", entry.getValue()[0]);
            point.put("collection", entry.getValue()[1]);
            point.put("balance", entry.getValue()[0].subtract(entry.getValue()[1]));
            chartData.add(point);
        }

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("series", Arrays.asList(
                Map.of("name", "应收金额", "type", "bar"),
                Map.of("name", "回款金额", "type", "bar"),
                Map.of("name", "应收余额", "type", "line")
        ));

        return ChartConfig.builder()
                .chartType("LINE_BAR")
                .title("应收账款趋势")
                .xAxisField("period")
                .yAxisField("balance")
                .data(chartData)
                .options(options)
                .build();
    }

    // ==================== 应付账款分析 ====================

    @Override
    public ChartConfig getPayableAgingChart(String factoryId, LocalDate date) {
        log.info("获取应付账龄分布图: factoryId={}, date={}", factoryId, date);

        List<SmartBiFinanceData> apData = financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.AP, date.minusYears(1), date);

        // 按账龄分段汇总
        Map<String, BigDecimal> agingBuckets = calculatePayableAgingBuckets(apData);

        // 构建图表数据
        List<Map<String, Object>> chartData = new ArrayList<>();
        BigDecimal totalAP = agingBuckets.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        for (String bucket : Arrays.asList(AGING_BUCKET_0_30, AGING_BUCKET_31_60, AGING_BUCKET_61_90, AGING_BUCKET_OVER_90)) {
            BigDecimal amount = agingBuckets.getOrDefault(bucket, BigDecimal.ZERO);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("agingBucket", bucket);
            item.put("amount", amount);
            item.put("percentage", totalAP.compareTo(BigDecimal.ZERO) > 0
                    ? amount.divide(totalAP, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                    : BigDecimal.ZERO);
            chartData.add(item);
        }

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("colors", Arrays.asList("#73c0de", "#5470c6", "#9a60b4", "#ea7ccc"));

        return ChartConfig.builder()
                .chartType("BAR")
                .title("应付账款账龄分布")
                .xAxisField("agingBucket")
                .yAxisField("amount")
                .data(chartData)
                .options(options)
                .build();
    }

    @Override
    public List<MetricResult> getPayableMetrics(String factoryId, LocalDate date) {
        log.info("获取应付指标: factoryId={}, date={}", factoryId, date);

        List<SmartBiFinanceData> apData = financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.AP, date.minusYears(1), date);

        List<MetricResult> metrics = new ArrayList<>();

        // 计算汇总值
        BigDecimal totalPayable = apData.stream()
                .map(SmartBiFinanceData::getPayableAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalPayment = apData.stream()
                .map(SmartBiFinanceData::getPaymentAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 应付余额
        BigDecimal apBalance = totalPayable.subtract(totalPayment);
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.AP_BALANCE)
                .metricName("应付余额")
                .value(apBalance.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(formatCurrency(apBalance))
                .unit("元")
                .alertLevel(MetricResult.AlertLevel.GREEN.name())
                .description("尚未支付的应付账款总额")
                .build());

        // 应付周转天数（假设按30天计算平均周期）
        BigDecimal avgPayable = apBalance.divide(new BigDecimal("2"), SCALE, ROUNDING_MODE);
        BigDecimal dailyPayment = totalPayment.divide(new BigDecimal("365"), SCALE, ROUNDING_MODE);
        BigDecimal turnoverDays = dailyPayment.compareTo(BigDecimal.ZERO) > 0
                ? avgPayable.divide(dailyPayment, SCALE, ROUNDING_MODE)
                : BigDecimal.ZERO;
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.AP_TURNOVER_DAYS)
                .metricName("应付周转天数")
                .value(turnoverDays.setScale(0, ROUNDING_MODE))
                .formattedValue(turnoverDays.setScale(0, ROUNDING_MODE) + "天")
                .unit("天")
                .alertLevel(MetricResult.AlertLevel.GREEN.name())
                .description("平均付款周期")
                .build());

        return metrics;
    }

    // ==================== 预算执行分析 ====================

    @Override
    public ChartConfig getBudgetExecutionWaterfall(String factoryId, int year) {
        log.info("获取预算执行瀑布图: factoryId={}, year={}", factoryId, year);

        LocalDate startDate = LocalDate.of(year, 1, 1);
        LocalDate endDate = LocalDate.of(year, 12, 31);

        List<SmartBiFinanceData> budgetData = financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.BUDGET, startDate, endDate);

        // 计算年度预算
        BigDecimal annualBudget = budgetData.stream()
                .map(SmartBiFinanceData::getBudgetAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 按月计算执行情况
        Map<Integer, BigDecimal> monthlyActual = new TreeMap<>();
        for (SmartBiFinanceData data : budgetData) {
            int month = data.getRecordDate().getMonthValue();
            BigDecimal actual = data.getActualAmount() != null ? data.getActualAmount() : BigDecimal.ZERO;
            monthlyActual.merge(month, actual, BigDecimal::add);
        }

        // 构建瀑布图数据
        List<Map<String, Object>> chartData = new ArrayList<>();

        // 起始：年度预算
        chartData.add(createWaterfallItem("年度预算", annualBudget, "total"));

        // 各月执行（负值表示减少）
        BigDecimal remaining = annualBudget;
        for (int month = 1; month <= 12; month++) {
            BigDecimal actual = monthlyActual.getOrDefault(month, BigDecimal.ZERO);
            if (actual.compareTo(BigDecimal.ZERO) > 0) {
                chartData.add(createWaterfallItem(month + "月", actual.negate(), "decrease"));
                remaining = remaining.subtract(actual);
            }
        }

        // 结束：剩余预算
        chartData.add(createWaterfallItem("剩余预算", remaining, "total"));

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("waterfallType", true);
        options.put("increaseColor", "#91cc75");
        options.put("decreaseColor", "#ee6666");
        options.put("totalColor", "#5470c6");

        return ChartConfig.builder()
                .chartType("WATERFALL")
                .title(year + "年预算执行瀑布图")
                .xAxisField("name")
                .yAxisField("value")
                .data(chartData)
                .options(options)
                .build();
    }

    @Override
    public ChartConfig getBudgetVsActualChart(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取预算对比实际图: factoryId={}", factoryId);

        List<SmartBiFinanceData> budgetData = financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.BUDGET, startDate, endDate);

        // 按类别汇总
        Map<String, BigDecimal[]> categoryData = new LinkedHashMap<>();
        for (SmartBiFinanceData data : budgetData) {
            String category = data.getCategory() != null ? data.getCategory() : "其他";
            BigDecimal[] values = categoryData.computeIfAbsent(category, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            values[0] = values[0].add(data.getBudgetAmount() != null ? data.getBudgetAmount() : BigDecimal.ZERO);
            values[1] = values[1].add(data.getActualAmount() != null ? data.getActualAmount() : BigDecimal.ZERO);
        }

        // 构建图表数据
        List<Map<String, Object>> chartData = new ArrayList<>();
        for (Map.Entry<String, BigDecimal[]> entry : categoryData.entrySet()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("category", entry.getKey());
            item.put("budget", entry.getValue()[0]);
            item.put("actual", entry.getValue()[1]);
            item.put("variance", entry.getValue()[1].subtract(entry.getValue()[0]));
            BigDecimal executionRate = entry.getValue()[0].compareTo(BigDecimal.ZERO) > 0
                    ? entry.getValue()[1].divide(entry.getValue()[0], SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                    : BigDecimal.ZERO;
            item.put("executionRate", executionRate);
            item.put("alertLevel", determineBudgetAlertLevel(executionRate));
            chartData.add(item);
        }

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("groupedBar", true);
        options.put("series", Arrays.asList(
                Map.of("name", "预算", "color", "#5470c6"),
                Map.of("name", "实际", "color", "#91cc75")
        ));

        return ChartConfig.builder()
                .chartType("BAR")
                .title("预算 vs 实际对比")
                .xAxisField("category")
                .yAxisField("budget")
                .data(chartData)
                .options(options)
                .build();
    }

    @Override
    public List<MetricResult> getBudgetMetrics(String factoryId, int year, int month) {
        log.info("获取预算指标: factoryId={}, year={}, month={}", factoryId, year, month);

        YearMonth yearMonth = YearMonth.of(year, month);
        LocalDate startDate = yearMonth.atDay(1);
        LocalDate endDate = yearMonth.atEndOfMonth();

        List<SmartBiFinanceData> budgetData = financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.BUDGET, startDate, endDate);

        List<MetricResult> metrics = new ArrayList<>();

        // 计算汇总值
        BigDecimal totalBudget = budgetData.stream()
                .map(SmartBiFinanceData::getBudgetAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalActual = budgetData.stream()
                .map(SmartBiFinanceData::getActualAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 预算执行率
        BigDecimal executionRate = totalBudget.compareTo(BigDecimal.ZERO) > 0
                ? totalActual.divide(totalBudget, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;
        String executionAlertLevel = executionRate.doubleValue() > BUDGET_EXECUTION_RED_THRESHOLD
                ? MetricResult.AlertLevel.RED.name()
                : (executionRate.doubleValue() > BUDGET_EXECUTION_YELLOW_THRESHOLD
                        ? MetricResult.AlertLevel.YELLOW.name()
                        : MetricResult.AlertLevel.GREEN.name());
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.BUDGET_EXECUTION)
                .metricName("预算执行率")
                .value(executionRate.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(executionRate.setScale(DISPLAY_SCALE, ROUNDING_MODE) + "%")
                .unit("%")
                .alertLevel(executionAlertLevel)
                .description("实际支出占预算的比例")
                .build());

        // 预算差异
        BigDecimal variance = totalActual.subtract(totalBudget);
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.BUDGET_VARIANCE)
                .metricName("预算差异")
                .value(variance.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(formatCurrency(variance))
                .unit("元")
                .alertLevel(variance.compareTo(BigDecimal.ZERO) > 0
                        ? MetricResult.AlertLevel.YELLOW.name()
                        : MetricResult.AlertLevel.GREEN.name())
                .description("实际支出与预算的差额")
                .build());

        // 预算偏差率
        BigDecimal varianceRate = totalBudget.compareTo(BigDecimal.ZERO) > 0
                ? variance.divide(totalBudget, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.BUDGET_VARIANCE_RATE)
                .metricName("预算偏差率")
                .value(varianceRate.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(varianceRate.setScale(DISPLAY_SCALE, ROUNDING_MODE) + "%")
                .unit("%")
                .alertLevel(metricCalculatorService.determineAlertLevel(MetricCalculatorService.BUDGET_VARIANCE_RATE, varianceRate))
                .description("预算差异占预算的比例")
                .build());

        // 预算剩余
        BigDecimal remaining = totalBudget.subtract(totalActual);
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.BUDGET_REMAINING)
                .metricName("预算剩余")
                .value(remaining.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(formatCurrency(remaining))
                .unit("元")
                .alertLevel(remaining.compareTo(BigDecimal.ZERO) >= 0
                        ? MetricResult.AlertLevel.GREEN.name()
                        : MetricResult.AlertLevel.RED.name())
                .description("剩余可用预算额度")
                .build());

        return metrics;
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
     * 按周期聚合利润数据
     */
    private Map<String, BigDecimal[]> aggregateProfitByPeriod(List<SmartBiSalesData> salesData, String period) {
        Map<String, BigDecimal[]> result = new TreeMap<>();

        for (SmartBiSalesData data : salesData) {
            String key = getPeriodKey(data.getOrderDate(), period);
            BigDecimal[] values = result.computeIfAbsent(key, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});

            BigDecimal revenue = data.getAmount() != null ? data.getAmount() : BigDecimal.ZERO;
            BigDecimal cost = data.getCost() != null ? data.getCost() : BigDecimal.ZERO;
            BigDecimal profit = revenue.subtract(cost);

            values[0] = values[0].add(profit); // 毛利
            values[3] = values[3].add(revenue); // 用于计算毛利率的收入累计
        }

        // 计算净利润和毛利率
        for (BigDecimal[] values : result.values()) {
            values[1] = values[0].multiply(new BigDecimal("0.70")); // 净利润 = 毛利 * 0.70 (假设费用率30%)
            values[2] = values[3].compareTo(BigDecimal.ZERO) > 0
                    ? values[0].divide(values[3], SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                    : BigDecimal.ZERO; // 毛利率
        }

        return result;
    }

    /**
     * 按周期聚合成本数据
     */
    private Map<String, BigDecimal[]> aggregateCostByPeriod(List<SmartBiFinanceData> costData, String period) {
        Map<String, BigDecimal[]> result = new TreeMap<>();

        for (SmartBiFinanceData data : costData) {
            String key = getPeriodKey(data.getRecordDate(), period);
            BigDecimal[] values = result.computeIfAbsent(key, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});

            values[0] = values[0].add(data.getMaterialCost() != null ? data.getMaterialCost() : BigDecimal.ZERO);
            values[1] = values[1].add(data.getLaborCost() != null ? data.getLaborCost() : BigDecimal.ZERO);
            values[2] = values[2].add(data.getOverheadCost() != null ? data.getOverheadCost() : BigDecimal.ZERO);
            values[3] = values[3].add(data.getTotalCost() != null ? data.getTotalCost() : BigDecimal.ZERO);
        }

        return result;
    }

    /**
     * 获取周期键
     */
    private String getPeriodKey(LocalDate date, String period) {
        switch (period) {
            case PERIOD_DAY:
                return date.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
            case PERIOD_WEEK:
                int weekOfYear = date.get(WeekFields.ISO.weekOfYear());
                return date.getYear() + "-W" + String.format("%02d", weekOfYear);
            case PERIOD_MONTH:
                return date.format(DateTimeFormatter.ofPattern("yyyy-MM"));
            case PERIOD_QUARTER:
                int quarter = (date.getMonthValue() - 1) / 3 + 1;
                return date.getYear() + "-Q" + quarter;
            default:
                return date.format(DateTimeFormatter.ofPattern("yyyy-MM"));
        }
    }

    /**
     * 计算应收账龄分段
     */
    private Map<String, BigDecimal> calculateAgingBuckets(List<SmartBiFinanceData> arData) {
        Map<String, BigDecimal> buckets = new LinkedHashMap<>();
        buckets.put(AGING_BUCKET_0_30, BigDecimal.ZERO);
        buckets.put(AGING_BUCKET_31_60, BigDecimal.ZERO);
        buckets.put(AGING_BUCKET_61_90, BigDecimal.ZERO);
        buckets.put(AGING_BUCKET_OVER_90, BigDecimal.ZERO);

        for (SmartBiFinanceData data : arData) {
            int agingDays = data.getAgingDays() != null ? data.getAgingDays() : 0;
            BigDecimal outstanding = data.getReceivableAmount() != null
                    ? data.getReceivableAmount().subtract(data.getCollectionAmount() != null ? data.getCollectionAmount() : BigDecimal.ZERO)
                    : BigDecimal.ZERO;

            if (outstanding.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            String bucket;
            if (agingDays <= 30) {
                bucket = AGING_BUCKET_0_30;
            } else if (agingDays <= 60) {
                bucket = AGING_BUCKET_31_60;
            } else if (agingDays <= 90) {
                bucket = AGING_BUCKET_61_90;
            } else {
                bucket = AGING_BUCKET_OVER_90;
            }

            buckets.merge(bucket, outstanding, BigDecimal::add);
        }

        return buckets;
    }

    /**
     * 计算应付账龄分段
     */
    private Map<String, BigDecimal> calculatePayableAgingBuckets(List<SmartBiFinanceData> apData) {
        Map<String, BigDecimal> buckets = new LinkedHashMap<>();
        buckets.put(AGING_BUCKET_0_30, BigDecimal.ZERO);
        buckets.put(AGING_BUCKET_31_60, BigDecimal.ZERO);
        buckets.put(AGING_BUCKET_61_90, BigDecimal.ZERO);
        buckets.put(AGING_BUCKET_OVER_90, BigDecimal.ZERO);

        for (SmartBiFinanceData data : apData) {
            int agingDays = data.getAgingDays() != null ? data.getAgingDays() : 0;
            BigDecimal outstanding = data.getPayableAmount() != null
                    ? data.getPayableAmount().subtract(data.getPaymentAmount() != null ? data.getPaymentAmount() : BigDecimal.ZERO)
                    : BigDecimal.ZERO;

            if (outstanding.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            String bucket;
            if (agingDays <= 30) {
                bucket = AGING_BUCKET_0_30;
            } else if (agingDays <= 60) {
                bucket = AGING_BUCKET_31_60;
            } else if (agingDays <= 90) {
                bucket = AGING_BUCKET_61_90;
            } else {
                bucket = AGING_BUCKET_OVER_90;
            }

            buckets.merge(bucket, outstanding, BigDecimal::add);
        }

        return buckets;
    }

    /**
     * 创建饼图数据项
     */
    private Map<String, Object> createPieDataItem(String category, BigDecimal value, BigDecimal total) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("category", category);
        item.put("value", value.setScale(DISPLAY_SCALE, ROUNDING_MODE));
        item.put("percentage", total.compareTo(BigDecimal.ZERO) > 0
                ? value.divide(total, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100")).setScale(DISPLAY_SCALE, ROUNDING_MODE)
                : BigDecimal.ZERO);
        return item;
    }

    /**
     * 创建瀑布图数据项
     */
    private Map<String, Object> createWaterfallItem(String name, BigDecimal value, String type) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("name", name);
        item.put("value", value.setScale(DISPLAY_SCALE, ROUNDING_MODE));
        item.put("type", type);
        return item;
    }

    /**
     * 获取账龄分段的预警级别
     */
    private String getAgingBucketAlertLevel(String bucket) {
        switch (bucket) {
            case AGING_BUCKET_0_30:
                return MetricResult.AlertLevel.GREEN.name();
            case AGING_BUCKET_31_60:
                return MetricResult.AlertLevel.YELLOW.name();
            case AGING_BUCKET_61_90:
                return MetricResult.AlertLevel.YELLOW.name();
            case AGING_BUCKET_OVER_90:
                return MetricResult.AlertLevel.RED.name();
            default:
                return MetricResult.AlertLevel.GREEN.name();
        }
    }

    /**
     * 格式化金额
     */
    private String formatCurrency(BigDecimal value) {
        if (value == null) {
            return "-";
        }
        java.text.DecimalFormat df = new java.text.DecimalFormat("#,##0.00");
        return df.format(value);
    }

    /**
     * 判断毛利率预警级别
     */
    private String determineGrossMarginAlertLevel(BigDecimal grossMargin) {
        double v = grossMargin.doubleValue();
        if (v < 15) return MetricResult.AlertLevel.RED.name();
        if (v < 25) return MetricResult.AlertLevel.YELLOW.name();
        return MetricResult.AlertLevel.GREEN.name();
    }

    /**
     * 判断ROI预警级别
     */
    private String determineRoiAlertLevel(BigDecimal roi) {
        double v = roi.doubleValue();
        if (v < 0) return MetricResult.AlertLevel.RED.name();
        if (v < 20) return MetricResult.AlertLevel.YELLOW.name();
        return MetricResult.AlertLevel.GREEN.name();
    }

    /**
     * 判断回款率预警级别
     */
    private String determineCollectionRateAlertLevel(BigDecimal rate) {
        double v = rate.doubleValue();
        if (v < 60) return MetricResult.AlertLevel.RED.name();
        if (v < 80) return MetricResult.AlertLevel.YELLOW.name();
        return MetricResult.AlertLevel.GREEN.name();
    }

    /**
     * 判断预算执行预警级别
     */
    private String determineBudgetAlertLevel(BigDecimal executionRate) {
        double v = executionRate.doubleValue();
        if (v > BUDGET_EXECUTION_RED_THRESHOLD) return MetricResult.AlertLevel.RED.name();
        if (v > BUDGET_EXECUTION_YELLOW_THRESHOLD) return MetricResult.AlertLevel.YELLOW.name();
        return MetricResult.AlertLevel.GREEN.name();
    }

    /**
     * 生成财务洞察
     */
    private List<AIInsight> generateFinanceInsights(List<MetricResult> metrics, List<RankingItem> rankings) {
        List<AIInsight> insights = new ArrayList<>();

        // 检查毛利率
        metrics.stream()
                .filter(m -> MetricCalculatorService.GROSS_MARGIN.equals(m.getMetricCode()))
                .findFirst()
                .ifPresent(m -> {
                    if (MetricResult.AlertLevel.RED.name().equals(m.getAlertLevel())) {
                        insights.add(AIInsight.builder()
                                .level("RED")
                                .category("毛利率偏低")
                                .message("当前毛利率为 " + m.getFormattedValue() + "，低于行业标准15%，建议审视成本结构和定价策略。")
                                .relatedEntity("GROSS_MARGIN")
                                .actionSuggestion("审视产品定价策略，优化采购成本")
                                .build());
                    }
                });

        // 检查90天以上应收
        metrics.stream()
                .filter(m -> MetricCalculatorService.AGING_90_RATIO.equals(m.getMetricCode()))
                .findFirst()
                .ifPresent(m -> {
                    if (MetricResult.AlertLevel.RED.name().equals(m.getAlertLevel())) {
                        insights.add(AIInsight.builder()
                                .level("RED")
                                .category("应收账款风险预警")
                                .message("90天以上账龄应收占比达 " + m.getFormattedValue() + "，超过20%警戒线，需立即加强催收。")
                                .relatedEntity("AGING_90_RATIO")
                                .actionSuggestion("启动专项催收，必要时考虑法律手段")
                                .build());
                    }
                });

        // 逾期客户提醒
        if (!rankings.isEmpty()) {
            long redCount = rankings.stream()
                    .filter(r -> MetricResult.AlertLevel.RED.name().equals(r.getAlertLevel()))
                    .count();
            if (redCount > 0) {
                insights.add(AIInsight.builder()
                        .level("YELLOW")
                        .category("高风险客户")
                        .message("发现 " + redCount + " 个客户账龄超过90天，建议优先跟进催收。")
                        .relatedEntity("OVERDUE_CUSTOMERS")
                        .actionSuggestion("优先跟进催收逾期客户")
                        .build());
            }
        }

        return insights;
    }

    /**
     * 生成财务建议
     */
    private List<String> generateFinanceSuggestions(List<MetricResult> metrics, List<RankingItem> rankings) {
        List<String> suggestions = new ArrayList<>();

        // 根据指标生成建议
        for (MetricResult metric : metrics) {
            if (MetricResult.AlertLevel.RED.name().equals(metric.getAlertLevel())) {
                switch (metric.getMetricCode()) {
                    case MetricCalculatorService.GROSS_MARGIN:
                        suggestions.add("建议审视产品定价策略，优化采购成本以提升毛利率");
                        break;
                    case MetricCalculatorService.AGING_90_RATIO:
                        suggestions.add("建议对90天以上逾期客户启动专项催收，必要时考虑法律手段");
                        break;
                    case MetricCalculatorService.COLLECTION_RATE:
                        suggestions.add("建议加强应收账款管理，缩短回款周期");
                        break;
                    case MetricCalculatorService.BUDGET_EXECUTION:
                        suggestions.add("预算超支严重，建议立即审核支出合理性并控制后续开支");
                        break;
                }
            }
        }

        // 如果没有问题，给出正面反馈
        if (suggestions.isEmpty()) {
            suggestions.add("财务指标整体健康，建议继续保持良好的成本控制和收款管理");
        }

        return suggestions;
    }
}
