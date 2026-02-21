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

    /**
     * 过滤财务数据，只保留最新 uploadId 的记录。
     * 避免多个 Excel Sheet 上传后数据被重复聚合（如 8 个利润表 sheet 的收入加在一起）。
     */
    private List<SmartBiFinanceData> filterToLatestUpload(List<SmartBiFinanceData> records) {
        if (records == null || records.isEmpty()) return records;
        Long latestUploadId = records.stream()
                .map(SmartBiFinanceData::getUploadId)
                .filter(Objects::nonNull)
                .max(Long::compareTo)
                .orElse(null);
        if (latestUploadId == null) return records;
        final Long targetId = latestUploadId;
        return records.stream()
                .filter(r -> targetId.equals(r.getUploadId()))
                .collect(Collectors.toList());
    }

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

        // 优先从 finance_data 获取 REVENUE + COST 记录（来自 Excel 自动提取）
        // filterToLatestUpload: 只使用最新上传的数据，避免多 sheet 重复聚合
        List<SmartBiFinanceData> revenueData = filterToLatestUpload(financeDataRepository
                .findByFactoryIdAndRecordTypeAndRecordDateBetween(factoryId, RecordType.REVENUE, startDate, endDate));
        List<SmartBiFinanceData> costData = filterToLatestUpload(financeDataRepository
                .findByFactoryIdAndRecordTypeAndRecordDateBetween(factoryId, RecordType.COST, startDate, endDate));

        List<Map<String, Object>> chartData = new ArrayList<>();

        if (!revenueData.isEmpty() || !costData.isEmpty()) {
            // 使用 finance_data 中的 REVENUE/COST 数据
            chartData = buildProfitChartFromFinanceData(revenueData, costData, period);
            log.info("使用 finance_data REVENUE/COST 数据: revenue={}, cost={}", revenueData.size(), costData.size());
        } else {
            // 回退到销售数据
            List<SmartBiSalesData> salesData = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                    factoryId, startDate, endDate);
            Map<String, BigDecimal[]> aggregatedData = aggregateProfitByPeriod(salesData, period);
            for (Map.Entry<String, BigDecimal[]> entry : aggregatedData.entrySet()) {
                Map<String, Object> point = new LinkedHashMap<>();
                point.put("period", entry.getKey());
                point.put("grossProfit", entry.getValue()[0]);
                point.put("netProfit", entry.getValue()[1]);
                point.put("grossMargin", entry.getValue()[2]);
                chartData.add(point);
            }
        }

        // 配置图表选项
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("yAxis", Arrays.asList(
                Map.of("name", "金额", "position", "left"),
                Map.of("name", "毛利率(%)", "position", "right")
        ));
        options.put("series", Arrays.asList(
                Map.of("name", "营业收入", "type", "bar", "yAxisIndex", 0),
                Map.of("name", "营业成本", "type", "bar", "yAxisIndex", 0),
                Map.of("name", "毛利额", "type", "bar", "yAxisIndex", 0),
                Map.of("name", "净利润", "type", "line", "yAxisIndex", 0),
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

    /**
     * 从 finance_data 的 REVENUE/COST 记录构建利润趋势图数据
     */
    private List<Map<String, Object>> buildProfitChartFromFinanceData(
            List<SmartBiFinanceData> revenueData,
            List<SmartBiFinanceData> costData,
            String period) {

        // 按周期聚合 REVENUE
        Map<String, BigDecimal> revenueByPeriod = new TreeMap<>();
        for (SmartBiFinanceData r : revenueData) {
            if (r.getActualAmount() == null) continue;
            String key = getPeriodKey(r.getRecordDate(), period);
            // 只聚合"营业收入"类别（排除毛利、净利等）
            String cat = r.getCategory() != null ? r.getCategory() : "";
            if (cat.contains("收入")) {
                revenueByPeriod.merge(key, r.getActualAmount(), BigDecimal::add);
            }
        }

        // 按周期聚合 COST
        Map<String, BigDecimal> costByPeriod = new TreeMap<>();
        for (SmartBiFinanceData c : costData) {
            if (c.getTotalCost() == null && c.getActualAmount() == null) continue;
            String key = getPeriodKey(c.getRecordDate(), period);
            BigDecimal val = c.getTotalCost() != null ? c.getTotalCost() : c.getActualAmount();
            costByPeriod.merge(key, val, BigDecimal::add);
        }

        // 按周期聚合净利润（从 REVENUE 中查找）
        Map<String, BigDecimal> netProfitByPeriod = new TreeMap<>();
        for (SmartBiFinanceData r : revenueData) {
            if (r.getActualAmount() == null) continue;
            String key = getPeriodKey(r.getRecordDate(), period);
            String cat = r.getCategory() != null ? r.getCategory() : "";
            if (cat.contains("净利")) {
                netProfitByPeriod.merge(key, r.getActualAmount(), BigDecimal::add);
            }
        }

        // 合并所有周期
        Set<String> allPeriods = new TreeSet<>();
        allPeriods.addAll(revenueByPeriod.keySet());
        allPeriods.addAll(costByPeriod.keySet());

        List<Map<String, Object>> chartData = new ArrayList<>();
        for (String periodKey : allPeriods) {
            BigDecimal revenue = revenueByPeriod.getOrDefault(periodKey, BigDecimal.ZERO);
            BigDecimal cost = costByPeriod.getOrDefault(periodKey, BigDecimal.ZERO);
            BigDecimal grossProfit = revenue.subtract(cost);
            BigDecimal grossMargin = revenue.compareTo(BigDecimal.ZERO) > 0
                    ? grossProfit.divide(revenue, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                    : BigDecimal.ZERO;
            BigDecimal netProfit = netProfitByPeriod.getOrDefault(periodKey, grossProfit);

            Map<String, Object> point = new LinkedHashMap<>();
            point.put("period", periodKey);
            point.put("revenue", revenue.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            point.put("cost", cost.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            point.put("grossProfit", grossProfit.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            point.put("netProfit", netProfit.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            point.put("grossMargin", grossMargin.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            chartData.add(point);
        }

        return chartData;
    }

    @Override
    public List<MetricResult> getProfitMetrics(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取利润指标: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        // 优先从 finance_data 获取 REVENUE 数据
        // filterToLatestUpload: 只使用最新上传的数据，避免多 sheet 重复聚合
        List<SmartBiFinanceData> revenueRecords = filterToLatestUpload(financeDataRepository
                .findByFactoryIdAndRecordTypeAndRecordDateBetween(factoryId, RecordType.REVENUE, startDate, endDate));
        List<SmartBiFinanceData> costRecords = filterToLatestUpload(financeDataRepository
                .findByFactoryIdAndRecordTypeAndRecordDateBetween(factoryId, RecordType.COST, startDate, endDate));

        BigDecimal totalRevenue;
        BigDecimal totalCost;
        BigDecimal netProfit;
        boolean hasFinanceData = !revenueRecords.isEmpty() || !costRecords.isEmpty();

        if (hasFinanceData) {
            // 从 REVENUE 记录中取"收入"类
            totalRevenue = revenueRecords.stream()
                    .filter(r -> r.getCategory() != null && r.getCategory().contains("收入"))
                    .map(SmartBiFinanceData::getActualAmount)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            totalCost = costRecords.stream()
                    .map(r -> r.getTotalCost() != null ? r.getTotalCost() : r.getActualAmount())
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            // 从 REVENUE 记录中取"净利"类
            netProfit = revenueRecords.stream()
                    .filter(r -> r.getCategory() != null && r.getCategory().contains("净利"))
                    .map(SmartBiFinanceData::getActualAmount)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            log.info("使用 finance_data 计算利润指标: revenue={}, cost={}", totalRevenue, totalCost);
        } else {
            // 回退到销售数据
            List<SmartBiSalesData> salesData = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                    factoryId, startDate, endDate);
            totalRevenue = salesData.stream()
                    .map(SmartBiSalesData::getAmount)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            totalCost = salesData.stream()
                    .map(SmartBiSalesData::getCost)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            netProfit = null; // will calculate below
        }

        List<MetricResult> metrics = new ArrayList<>();

        BigDecimal grossProfit = totalRevenue.subtract(totalCost);
        BigDecimal grossMarginRaw = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                ? grossProfit.divide(totalRevenue, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;
        // T1.1: 毛利率>100%属于异常数据（数据录入错误），设为null让前端显示N/A
        BigDecimal grossMargin = (grossMarginRaw.compareTo(new BigDecimal("100")) > 0
                || grossMarginRaw.compareTo(new BigDecimal("-100")) < 0)
                ? null : grossMarginRaw;

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
        String marginAlertLevel = grossMargin != null
                ? determineGrossMarginAlertLevel(grossMargin)
                : MetricResult.AlertLevel.RED.name();
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.GROSS_MARGIN)
                .metricName("毛利率")
                .value(grossMargin != null ? grossMargin.setScale(DISPLAY_SCALE, ROUNDING_MODE) : null)
                .formattedValue(grossMargin != null ? grossMargin.setScale(DISPLAY_SCALE, ROUNDING_MODE) + "%" : "N/A")
                .unit("%")
                .alertLevel(marginAlertLevel)
                .description("毛利额占销售收入的比例")
                .build());

        // 净利润
        // T1.4: 无净利数据时，不虚构数据，设为null让前端显示N/A
        // netProfit remains null if not provided — do NOT fabricate from grossProfit * 0.70
        BigDecimal netMarginRaw = (netProfit != null && totalRevenue.compareTo(BigDecimal.ZERO) > 0)
                ? netProfit.divide(totalRevenue, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                : null;
        // T1.1: 净利率超出合理范围（>100%或<-100%）视为数据异常，设为null
        BigDecimal netMargin = (netMarginRaw != null
                && (netMarginRaw.compareTo(new BigDecimal("100")) > 0
                    || netMarginRaw.compareTo(new BigDecimal("-100")) < 0))
                ? null : netMarginRaw;

        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.NET_PROFIT)
                .metricName("净利润")
                .value(netProfit != null ? netProfit.setScale(DISPLAY_SCALE, ROUNDING_MODE) : null)
                .formattedValue(netProfit != null ? formatCurrency(netProfit) : "N/A")
                .unit("元")
                .alertLevel(netProfit != null
                        ? (netProfit.compareTo(BigDecimal.ZERO) >= 0
                                ? MetricResult.AlertLevel.GREEN.name()
                                : MetricResult.AlertLevel.RED.name())
                        : MetricResult.AlertLevel.GREEN.name())
                .description("毛利减去各项费用后的利润")
                .build());

        // 净利率
        metrics.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.NET_MARGIN)
                .metricName("净利率")
                .value(netMargin != null ? netMargin.setScale(DISPLAY_SCALE, ROUNDING_MODE) : null)
                .formattedValue(netMargin != null ? netMargin.setScale(DISPLAY_SCALE, ROUNDING_MODE) + "%" : "N/A")
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

        List<SmartBiFinanceData> costData = filterToLatestUpload(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.COST, startDate, endDate));

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

        List<SmartBiFinanceData> costData = filterToLatestUpload(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.COST, startDate, endDate));

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
        List<SmartBiFinanceData> arData = filterToLatestUpload(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.AR, date.minusYears(1), date));

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

        List<SmartBiFinanceData> arData = filterToLatestUpload(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.AR, date.minusYears(1), date));

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

        List<SmartBiFinanceData> arData = filterToLatestUpload(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.AR, date.minusYears(1), date));

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

        List<SmartBiFinanceData> arData = filterToLatestUpload(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.AR, startDate, endDate));

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

        List<SmartBiFinanceData> apData = filterToLatestUpload(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.AP, date.minusYears(1), date));

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

        List<SmartBiFinanceData> apData = filterToLatestUpload(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.AP, date.minusYears(1), date));

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

        List<SmartBiFinanceData> budgetData = filterToLatestUpload(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.BUDGET, startDate, endDate));

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

        List<SmartBiFinanceData> budgetData = filterToLatestUpload(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.BUDGET, startDate, endDate));

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

        List<SmartBiFinanceData> budgetData = filterToLatestUpload(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.BUDGET, startDate, endDate));

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

    // ==================== 预算达成分析 ====================

    @Override
    public ChartConfig getBudgetAchievementChart(String factoryId, int year, String metric) {
        log.info("获取预算达成分析图表: factoryId={}, year={}, metric={}", factoryId, year, metric);

        LocalDate startDate = LocalDate.of(year, 1, 1);
        LocalDate endDate = LocalDate.of(year, 12, 31);

        List<SmartBiFinanceData> budgetData = filterToLatestUpload(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                factoryId, RecordType.BUDGET, startDate, endDate));

        // 按月聚合预算和实际数据
        Map<Integer, BigDecimal[]> monthlyData = new TreeMap<>();
        for (int month = 1; month <= 12; month++) {
            // [预算, 实际]
            monthlyData.put(month, new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
        }

        for (SmartBiFinanceData data : budgetData) {
            int month = data.getRecordDate().getMonthValue();
            BigDecimal[] values = monthlyData.get(month);

            // 根据metric类型聚合数据
            BigDecimal budgetAmount = getBudgetAmountByMetric(data, metric);
            BigDecimal actualAmount = getActualAmountByMetric(data, metric);

            values[0] = values[0].add(budgetAmount);
            values[1] = values[1].add(actualAmount);
        }

        // 构建图表数据
        List<Map<String, Object>> chartData = new ArrayList<>();
        for (Map.Entry<Integer, BigDecimal[]> entry : monthlyData.entrySet()) {
            Map<String, Object> point = new LinkedHashMap<>();
            int month = entry.getKey();
            BigDecimal budget = entry.getValue()[0];
            BigDecimal actual = entry.getValue()[1];

            // 计算达成率 = 实际 / 预算 * 100%
            BigDecimal achievementRate = budget.compareTo(BigDecimal.ZERO) > 0
                    ? actual.divide(budget, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                    : BigDecimal.ZERO;

            point.put("month", month + "月");
            point.put("budget", budget.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            point.put("actual", actual.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            point.put("achievementRate", achievementRate.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            point.put("variance", actual.subtract(budget).setScale(DISPLAY_SCALE, ROUNDING_MODE));
            point.put("alertLevel", determineBudgetAchievementAlertLevel(achievementRate));
            chartData.add(point);
        }

        // 配置图表选项
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("yAxis", Arrays.asList(
                Map.of("name", "金额", "position", "left"),
                Map.of("name", "达成率(%)", "position", "right", "min", 0, "max", 150)
        ));
        options.put("series", Arrays.asList(
                Map.of("name", "预算", "type", "bar", "yAxisIndex", 0, "color", "#5470c6"),
                Map.of("name", "实际", "type", "bar", "yAxisIndex", 0, "color", "#91cc75"),
                Map.of("name", "达成率", "type", "line", "yAxisIndex", 1, "color", "#ee6666")
        ));
        options.put("referenceLine", Map.of("value", 100, "label", "目标线"));

        String metricName = getMetricDisplayName(metric);

        return ChartConfig.builder()
                .chartType("LINE_BAR")
                .title(year + "年" + metricName + "预算达成分析")
                .xAxisField("month")
                .yAxisField("budget")
                .seriesField("metric")
                .data(chartData)
                .options(options)
                .build();
    }

    // ==================== 同比环比分析 ====================

    @Override
    public ChartConfig getYoYMoMComparisonChart(
            String factoryId,
            String periodType,
            String startPeriod,
            String endPeriod,
            String metric) {
        log.info("获取同比环比分析图表: factoryId={}, periodType={}, startPeriod={}, endPeriod={}, metric={}",
                factoryId, periodType, startPeriod, endPeriod, metric);

        List<Map<String, Object>> chartData = new ArrayList<>();

        switch (periodType) {
            case PERIOD_TYPE_MONTH:
                chartData = calculateMonthYoYMoM(factoryId, startPeriod, metric);
                break;
            case PERIOD_TYPE_QUARTER:
                chartData = calculateQuarterYoYMoM(factoryId, startPeriod, metric);
                break;
            case PERIOD_TYPE_MONTH_RANGE:
                chartData = calculateMonthRangeYoYMoM(factoryId, startPeriod, endPeriod, metric);
                break;
            case PERIOD_TYPE_QUARTER_RANGE:
                chartData = calculateQuarterRangeYoYMoM(factoryId, startPeriod, endPeriod, metric);
                break;
            default:
                log.warn("未知的期间类型: {}, 使用默认月份模式", periodType);
                chartData = calculateMonthYoYMoM(factoryId, startPeriod, metric);
        }

        // 配置图表选项
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("yAxis", Arrays.asList(
                Map.of("name", "金额", "position", "left"),
                Map.of("name", "增长率(%)", "position", "right")
        ));
        options.put("series", Arrays.asList(
                Map.of("name", "本期", "type", "bar", "yAxisIndex", 0, "color", "#5470c6"),
                Map.of("name", "同期", "type", "bar", "yAxisIndex", 0, "color", "#91cc75"),
                Map.of("name", "同比增长率", "type", "line", "yAxisIndex", 1, "color", "#ee6666"),
                Map.of("name", "环比增长率", "type", "line", "yAxisIndex", 1, "color", "#fac858")
        ));
        options.put("tooltip", Map.of("trigger", "axis"));

        String metricName = getMetricDisplayName(metric);

        return ChartConfig.builder()
                .chartType("LINE_BAR")
                .title(metricName + "同比环比分析")
                .xAxisField("period")
                .yAxisField("currentValue")
                .seriesField("metric")
                .data(chartData)
                .options(options)
                .build();
    }

    // ==================== 品类结构对比 ====================

    @Override
    public ChartConfig getCategoryStructureComparisonChart(String factoryId, int year, int compareYear) {
        log.info("获取品类结构对比图表: factoryId={}, year={}, compareYear={}", factoryId, year, compareYear);

        // 获取两个年份的销售数据
        LocalDate yearStart = LocalDate.of(year, 1, 1);
        LocalDate yearEnd = LocalDate.of(year, 12, 31);
        LocalDate compareYearStart = LocalDate.of(compareYear, 1, 1);
        LocalDate compareYearEnd = LocalDate.of(compareYear, 12, 31);

        List<SmartBiSalesData> currentYearSales = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                factoryId, yearStart, yearEnd);
        List<SmartBiSalesData> compareYearSales = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                factoryId, compareYearStart, compareYearEnd);

        // 按品类聚合销售额
        Map<String, BigDecimal> currentCategoryAmount = aggregateSalesByCategory(currentYearSales);
        Map<String, BigDecimal> compareCategoryAmount = aggregateSalesByCategory(compareYearSales);

        // 计算各年度总额
        BigDecimal currentTotal = currentCategoryAmount.values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal compareTotal = compareCategoryAmount.values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 获取所有品类（合并两个年份的品类）
        Set<String> allCategories = new LinkedHashSet<>();
        allCategories.addAll(currentCategoryAmount.keySet());
        allCategories.addAll(compareCategoryAmount.keySet());

        // 构建图表数据
        List<Map<String, Object>> chartData = new ArrayList<>();
        for (String category : allCategories) {
            Map<String, Object> item = new LinkedHashMap<>();
            BigDecimal currentAmount = currentCategoryAmount.getOrDefault(category, BigDecimal.ZERO);
            BigDecimal compareAmount = compareCategoryAmount.getOrDefault(category, BigDecimal.ZERO);

            // 计算占比
            BigDecimal currentRatio = currentTotal.compareTo(BigDecimal.ZERO) > 0
                    ? currentAmount.divide(currentTotal, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                    : BigDecimal.ZERO;
            BigDecimal compareRatio = compareTotal.compareTo(BigDecimal.ZERO) > 0
                    ? compareAmount.divide(compareTotal, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                    : BigDecimal.ZERO;

            // 计算同比变化率 = (本期 - 去年同期) / 去年同期 * 100%
            BigDecimal yoyGrowthRate = compareAmount.compareTo(BigDecimal.ZERO) > 0
                    ? currentAmount.subtract(compareAmount)
                            .divide(compareAmount, SCALE, ROUNDING_MODE)
                            .multiply(new BigDecimal("100"))
                    : (currentAmount.compareTo(BigDecimal.ZERO) > 0 ? new BigDecimal("100") : BigDecimal.ZERO);

            // 计算占比变化
            BigDecimal ratioChange = currentRatio.subtract(compareRatio);

            item.put("category", category);
            item.put("currentAmount", currentAmount.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            item.put("compareAmount", compareAmount.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            item.put("currentRatio", currentRatio.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            item.put("compareRatio", compareRatio.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            item.put("yoyGrowthRate", yoyGrowthRate.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            item.put("ratioChange", ratioChange.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            item.put("currentYear", year);
            item.put("compareYear", compareYear);

            chartData.add(item);
        }

        // 按当前年度金额降序排序
        chartData.sort((a, b) -> {
            BigDecimal amountA = (BigDecimal) a.get("currentAmount");
            BigDecimal amountB = (BigDecimal) b.get("currentAmount");
            return amountB.compareTo(amountA);
        });

        // 配置图表选项
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("groupedBar", true);
        options.put("yAxis", Arrays.asList(
                Map.of("name", "金额", "position", "left"),
                Map.of("name", "同比增长率(%)", "position", "right")
        ));
        options.put("series", Arrays.asList(
                Map.of("name", year + "年", "type", "bar", "yAxisIndex", 0, "color", "#5470c6"),
                Map.of("name", compareYear + "年", "type", "bar", "yAxisIndex", 0, "color", "#91cc75"),
                Map.of("name", "同比增长率", "type", "line", "yAxisIndex", 1, "color", "#ee6666")
        ));
        options.put("summary", Map.of(
                "currentTotal", currentTotal.setScale(DISPLAY_SCALE, ROUNDING_MODE),
                "compareTotal", compareTotal.setScale(DISPLAY_SCALE, ROUNDING_MODE),
                "totalYoyGrowthRate", compareTotal.compareTo(BigDecimal.ZERO) > 0
                        ? currentTotal.subtract(compareTotal)
                                .divide(compareTotal, SCALE, ROUNDING_MODE)
                                .multiply(new BigDecimal("100"))
                                .setScale(DISPLAY_SCALE, ROUNDING_MODE)
                        : BigDecimal.ZERO
        ));

        return ChartConfig.builder()
                .chartType("BAR")
                .title(year + "年 vs " + compareYear + "年 品类结构对比")
                .xAxisField("category")
                .yAxisField("currentAmount")
                .seriesField("year")
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
     * 根据指标类型获取预算金额
     */
    private BigDecimal getBudgetAmountByMetric(SmartBiFinanceData data, String metric) {
        if (data == null || data.getBudgetAmount() == null) {
            return BigDecimal.ZERO;
        }
        // 如果有分类字段，可以按metric筛选
        String category = data.getCategory();
        if (category != null && metric != null) {
            switch (metric.toLowerCase()) {
                case "revenue":
                    if (category.contains("收入") || category.contains("销售")) {
                        return data.getBudgetAmount();
                    }
                    break;
                case "cost":
                    if (category.contains("成本")) {
                        return data.getBudgetAmount();
                    }
                    break;
                case "expense":
                    if (category.contains("费用")) {
                        return data.getBudgetAmount();
                    }
                    break;
                case "profit":
                    if (category.contains("利润")) {
                        return data.getBudgetAmount();
                    }
                    break;
                default:
                    return data.getBudgetAmount();
            }
        }
        return data.getBudgetAmount();
    }

    /**
     * 根据指标类型获取实际金额
     */
    private BigDecimal getActualAmountByMetric(SmartBiFinanceData data, String metric) {
        if (data == null || data.getActualAmount() == null) {
            return BigDecimal.ZERO;
        }
        String category = data.getCategory();
        if (category != null && metric != null) {
            switch (metric.toLowerCase()) {
                case "revenue":
                    if (category.contains("收入") || category.contains("销售")) {
                        return data.getActualAmount();
                    }
                    break;
                case "cost":
                    if (category.contains("成本")) {
                        return data.getActualAmount();
                    }
                    break;
                case "expense":
                    if (category.contains("费用")) {
                        return data.getActualAmount();
                    }
                    break;
                case "profit":
                    if (category.contains("利润")) {
                        return data.getActualAmount();
                    }
                    break;
                default:
                    return data.getActualAmount();
            }
        }
        return data.getActualAmount();
    }

    /**
     * 判断预算达成率预警级别
     * - 达成率 > 120%：RED（超支严重）
     * - 达成率 100%-120%：YELLOW（略有超支）
     * - 达成率 < 100%：GREEN（正常）
     */
    private String determineBudgetAchievementAlertLevel(BigDecimal achievementRate) {
        double v = achievementRate.doubleValue();
        if (v > 120) return MetricResult.AlertLevel.RED.name();
        if (v > 100) return MetricResult.AlertLevel.YELLOW.name();
        return MetricResult.AlertLevel.GREEN.name();
    }

    /**
     * 获取指标显示名称
     */
    private String getMetricDisplayName(String metric) {
        if (metric == null) return "综合";
        switch (metric.toLowerCase()) {
            case "revenue":
                return "收入";
            case "cost":
                return "成本";
            case "expense":
                return "费用";
            case "profit":
                return "利润";
            case "gross_margin":
                return "毛利率";
            default:
                return "综合";
        }
    }

    /**
     * 计算单月同比环比
     */
    private List<Map<String, Object>> calculateMonthYoYMoM(String factoryId, String period, String metric) {
        List<Map<String, Object>> result = new ArrayList<>();

        // 解析期间 (格式: 2026-01)
        YearMonth currentYM = YearMonth.parse(period);
        YearMonth lastYearYM = currentYM.minusYears(1);
        YearMonth lastMonthYM = currentYM.minusMonths(1);

        // 获取各期间数据
        BigDecimal currentValue = getMetricValueForPeriod(factoryId, currentYM, metric);
        BigDecimal lastYearValue = getMetricValueForPeriod(factoryId, lastYearYM, metric);
        BigDecimal lastMonthValue = getMetricValueForPeriod(factoryId, lastMonthYM, metric);

        // 计算同比增长率 = (本期 - 去年同期) / 去年同期 * 100%
        BigDecimal yoyGrowthRate = lastYearValue.compareTo(BigDecimal.ZERO) > 0
                ? currentValue.subtract(lastYearValue)
                        .divide(lastYearValue, SCALE, ROUNDING_MODE)
                        .multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;

        // 计算环比增长率 = (本期 - 上期) / 上期 * 100%
        BigDecimal momGrowthRate = lastMonthValue.compareTo(BigDecimal.ZERO) > 0
                ? currentValue.subtract(lastMonthValue)
                        .divide(lastMonthValue, SCALE, ROUNDING_MODE)
                        .multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("period", period);
        data.put("currentValue", currentValue.setScale(DISPLAY_SCALE, ROUNDING_MODE));
        data.put("lastYearValue", lastYearValue.setScale(DISPLAY_SCALE, ROUNDING_MODE));
        data.put("lastPeriodValue", lastMonthValue.setScale(DISPLAY_SCALE, ROUNDING_MODE));
        data.put("yoyGrowthRate", yoyGrowthRate.setScale(DISPLAY_SCALE, ROUNDING_MODE));
        data.put("momGrowthRate", momGrowthRate.setScale(DISPLAY_SCALE, ROUNDING_MODE));
        data.put("yoyChange", currentValue.subtract(lastYearValue).setScale(DISPLAY_SCALE, ROUNDING_MODE));
        data.put("momChange", currentValue.subtract(lastMonthValue).setScale(DISPLAY_SCALE, ROUNDING_MODE));
        result.add(data);

        return result;
    }

    /**
     * 计算单季度同比环比
     */
    private List<Map<String, Object>> calculateQuarterYoYMoM(String factoryId, String period, String metric) {
        List<Map<String, Object>> result = new ArrayList<>();

        // 解析期间 (格式: 2026-Q1)
        String[] parts = period.split("-Q");
        int year = Integer.parseInt(parts[0]);
        int quarter = Integer.parseInt(parts[1]);

        // 计算去年同季度和上季度
        int lastYearQ = quarter;
        int lastYearY = year - 1;
        int lastQuarterQ = quarter == 1 ? 4 : quarter - 1;
        int lastQuarterY = quarter == 1 ? year - 1 : year;

        // 获取各期间数据
        BigDecimal currentValue = getMetricValueForQuarter(factoryId, year, quarter, metric);
        BigDecimal lastYearValue = getMetricValueForQuarter(factoryId, lastYearY, lastYearQ, metric);
        BigDecimal lastQuarterValue = getMetricValueForQuarter(factoryId, lastQuarterY, lastQuarterQ, metric);

        // 计算同比和环比
        BigDecimal yoyGrowthRate = lastYearValue.compareTo(BigDecimal.ZERO) > 0
                ? currentValue.subtract(lastYearValue)
                        .divide(lastYearValue, SCALE, ROUNDING_MODE)
                        .multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;

        BigDecimal qoqGrowthRate = lastQuarterValue.compareTo(BigDecimal.ZERO) > 0
                ? currentValue.subtract(lastQuarterValue)
                        .divide(lastQuarterValue, SCALE, ROUNDING_MODE)
                        .multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("period", period);
        data.put("currentValue", currentValue.setScale(DISPLAY_SCALE, ROUNDING_MODE));
        data.put("lastYearValue", lastYearValue.setScale(DISPLAY_SCALE, ROUNDING_MODE));
        data.put("lastPeriodValue", lastQuarterValue.setScale(DISPLAY_SCALE, ROUNDING_MODE));
        data.put("yoyGrowthRate", yoyGrowthRate.setScale(DISPLAY_SCALE, ROUNDING_MODE));
        data.put("momGrowthRate", qoqGrowthRate.setScale(DISPLAY_SCALE, ROUNDING_MODE));
        data.put("yoyChange", currentValue.subtract(lastYearValue).setScale(DISPLAY_SCALE, ROUNDING_MODE));
        data.put("momChange", currentValue.subtract(lastQuarterValue).setScale(DISPLAY_SCALE, ROUNDING_MODE));
        result.add(data);

        return result;
    }

    /**
     * 计算月份范围同比环比
     */
    private List<Map<String, Object>> calculateMonthRangeYoYMoM(String factoryId, String startPeriod, String endPeriod, String metric) {
        List<Map<String, Object>> result = new ArrayList<>();

        YearMonth start = YearMonth.parse(startPeriod);
        YearMonth end = YearMonth.parse(endPeriod);
        YearMonth current = start;

        while (!current.isAfter(end)) {
            List<Map<String, Object>> monthData = calculateMonthYoYMoM(factoryId, current.toString(), metric);
            result.addAll(monthData);
            current = current.plusMonths(1);
        }

        return result;
    }

    /**
     * 计算季度范围同比环比
     */
    private List<Map<String, Object>> calculateQuarterRangeYoYMoM(String factoryId, String startPeriod, String endPeriod, String metric) {
        List<Map<String, Object>> result = new ArrayList<>();

        // 解析开始和结束季度
        String[] startParts = startPeriod.split("-Q");
        String[] endParts = endPeriod.split("-Q");
        int startYear = Integer.parseInt(startParts[0]);
        int startQuarter = Integer.parseInt(startParts[1]);
        int endYear = Integer.parseInt(endParts[0]);
        int endQuarter = Integer.parseInt(endParts[1]);

        int currentYear = startYear;
        int currentQuarter = startQuarter;

        while (currentYear < endYear || (currentYear == endYear && currentQuarter <= endQuarter)) {
            String period = currentYear + "-Q" + currentQuarter;
            List<Map<String, Object>> quarterData = calculateQuarterYoYMoM(factoryId, period, metric);
            result.addAll(quarterData);

            // 移动到下一个季度
            currentQuarter++;
            if (currentQuarter > 4) {
                currentQuarter = 1;
                currentYear++;
            }
        }

        return result;
    }

    /**
     * 获取指定月份的指标值
     */
    private BigDecimal getMetricValueForPeriod(String factoryId, YearMonth yearMonth, String metric) {
        LocalDate startDate = yearMonth.atDay(1);
        LocalDate endDate = yearMonth.atEndOfMonth();

        switch (metric != null ? metric.toLowerCase() : "") {
            case "revenue":
            case "profit":
            case "gross_margin":
                // 从销售数据获取
                List<SmartBiSalesData> salesData = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                        factoryId, startDate, endDate);
                return calculateMetricFromSales(salesData, metric);
            case "cost":
            case "expense":
                // 从财务数据获取
                List<SmartBiFinanceData> financeData = filterToLatestUpload(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                        factoryId, RecordType.COST, startDate, endDate));
                return financeData.stream()
                        .map(SmartBiFinanceData::getTotalCost)
                        .filter(Objects::nonNull)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
            default:
                // 默认返回销售收入
                List<SmartBiSalesData> defaultSales = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                        factoryId, startDate, endDate);
                return defaultSales.stream()
                        .map(SmartBiSalesData::getAmount)
                        .filter(Objects::nonNull)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
        }
    }

    /**
     * 获取指定季度的指标值
     */
    private BigDecimal getMetricValueForQuarter(String factoryId, int year, int quarter, String metric) {
        int startMonth = (quarter - 1) * 3 + 1;
        int endMonth = quarter * 3;

        LocalDate startDate = LocalDate.of(year, startMonth, 1);
        LocalDate endDate = LocalDate.of(year, endMonth, 1).plusMonths(1).minusDays(1);

        switch (metric != null ? metric.toLowerCase() : "") {
            case "revenue":
            case "profit":
            case "gross_margin":
                List<SmartBiSalesData> salesData = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                        factoryId, startDate, endDate);
                return calculateMetricFromSales(salesData, metric);
            case "cost":
            case "expense":
                List<SmartBiFinanceData> financeData2 = filterToLatestUpload(financeDataRepository.findByFactoryIdAndRecordTypeAndRecordDateBetween(
                        factoryId, RecordType.COST, startDate, endDate));
                return financeData2.stream()
                        .map(SmartBiFinanceData::getTotalCost)
                        .filter(Objects::nonNull)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
            default:
                List<SmartBiSalesData> defaultSales = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                        factoryId, startDate, endDate);
                return defaultSales.stream()
                        .map(SmartBiSalesData::getAmount)
                        .filter(Objects::nonNull)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
        }
    }

    /**
     * 从销售数据计算指标值
     */
    private BigDecimal calculateMetricFromSales(List<SmartBiSalesData> salesData, String metric) {
        BigDecimal totalRevenue = salesData.stream()
                .map(SmartBiSalesData::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCost = salesData.stream()
                .map(SmartBiSalesData::getCost)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        switch (metric != null ? metric.toLowerCase() : "") {
            case "revenue":
                return totalRevenue;
            case "profit":
                return totalRevenue.subtract(totalCost);
            case "gross_margin":
                return totalRevenue.compareTo(BigDecimal.ZERO) > 0
                        ? totalRevenue.subtract(totalCost)
                                .divide(totalRevenue, SCALE, ROUNDING_MODE)
                                .multiply(new BigDecimal("100"))
                        : BigDecimal.ZERO;
            default:
                return totalRevenue;
        }
    }

    /**
     * 按品类聚合销售额
     */
    private Map<String, BigDecimal> aggregateSalesByCategory(List<SmartBiSalesData> salesData) {
        Map<String, BigDecimal> result = new LinkedHashMap<>();

        for (SmartBiSalesData data : salesData) {
            String category = data.getProductCategory() != null ? data.getProductCategory() : "其他";
            BigDecimal amount = data.getAmount() != null ? data.getAmount() : BigDecimal.ZERO;
            result.merge(category, amount, BigDecimal::add);
        }

        return result;
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
