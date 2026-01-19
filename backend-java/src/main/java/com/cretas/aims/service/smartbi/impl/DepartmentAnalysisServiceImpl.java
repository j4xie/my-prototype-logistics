package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.smartbi.ChartConfig;
import com.cretas.aims.dto.smartbi.DashboardResponse;
import com.cretas.aims.dto.smartbi.KPICard;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.dto.smartbi.RankingItem;
import com.cretas.aims.entity.smartbi.SmartBiDepartmentData;
import com.cretas.aims.entity.smartbi.SmartBiSalesData;
import com.cretas.aims.repository.smartbi.SmartBiDepartmentDataRepository;
import com.cretas.aims.repository.smartbi.SmartBiSalesDataRepository;
import com.cretas.aims.service.smartbi.DepartmentAnalysisService;
import com.cretas.aims.service.smartbi.MetricCalculatorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.WeekFields;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 部门分析服务实现
 *
 * 实现 SmartBI 系统中部门维度的分析能力，包括：
 * - 部门业绩排名
 * - 部门效率矩阵（四象限分析）
 * - 部门人员结构
 * - 部门趋势对比
 *
 * 参考规格文档: docs/architecture/smart-bi-ai-analysis-spec.md 第 6.3 节
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DepartmentAnalysisServiceImpl implements DepartmentAnalysisService {

    private final SmartBiDepartmentDataRepository departmentDataRepository;
    private final SmartBiSalesDataRepository salesDataRepository;
    private final MetricCalculatorService metricCalculatorService;

    // 计算精度配置
    private static final int SCALE = 4;
    private static final int DISPLAY_SCALE = 2;
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    // 时间粒度常量
    private static final String PERIOD_DAY = "DAY";
    private static final String PERIOD_WEEK = "WEEK";
    private static final String PERIOD_MONTH = "MONTH";

    // ==================== 部门排名 ====================

    @Override
    public List<RankingItem> getDepartmentRanking(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取部门业绩排名: factoryId={}, period={} to {}", factoryId, startDate, endDate);

        // 从部门数据表获取部门绩效数据
        List<SmartBiDepartmentData> departmentDataList = departmentDataRepository
                .findByFactoryIdAndRecordDateBetween(factoryId, startDate, endDate);

        if (departmentDataList.isEmpty()) {
            log.warn("未找到部门数据: factoryId={}", factoryId);
            return Collections.emptyList();
        }

        // 按部门聚合数据
        Map<String, DepartmentAggregation> aggregatedData = aggregateDepartmentData(departmentDataList);

        // 转换为排名列表
        List<RankingItem> rankings = new ArrayList<>();
        List<Map.Entry<String, DepartmentAggregation>> sortedEntries = aggregatedData.entrySet().stream()
                .sorted((a, b) -> b.getValue().salesAmount.compareTo(a.getValue().salesAmount))
                .collect(Collectors.toList());

        int rank = 1;
        for (Map.Entry<String, DepartmentAggregation> entry : sortedEntries) {
            String departmentName = entry.getKey();
            DepartmentAggregation agg = entry.getValue();

            BigDecimal completionRate = calculateCompletionRate(agg.salesAmount, agg.salesTarget);
            String alertLevel = metricCalculatorService.determineAlertLevel(
                    MetricCalculatorService.TARGET_COMPLETION, completionRate);

            RankingItem item = RankingItem.builder()
                    .rank(rank++)
                    .name(departmentName)
                    .value(agg.salesAmount.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .target(agg.salesTarget.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .completionRate(completionRate.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .alertLevel(alertLevel)
                    .build();

            rankings.add(item);
        }

        log.info("部门排名生成完成，共 {} 个部门", rankings.size());
        return rankings;
    }

    // ==================== 部门详情 ====================

    @Override
    public DashboardResponse getDepartmentDetail(String factoryId, String department,
                                                  LocalDate startDate, LocalDate endDate) {
        log.info("获取部门详情: factoryId={}, department={}, period={} to {}",
                factoryId, department, startDate, endDate);

        // 获取该部门的数据
        List<SmartBiDepartmentData> departmentDataList = departmentDataRepository
                .findByFactoryIdAndDepartment(factoryId, department);

        // 过滤日期范围
        departmentDataList = departmentDataList.stream()
                .filter(d -> !d.getRecordDate().isBefore(startDate) && !d.getRecordDate().isAfter(endDate))
                .collect(Collectors.toList());

        // 获取该部门的销售数据
        List<SmartBiSalesData> salesDataList = salesDataRepository
                .findByFactoryIdAndOrderDateBetween(factoryId, startDate, endDate)
                .stream()
                .filter(s -> department.equals(s.getDepartment()))
                .collect(Collectors.toList());

        // 构建 KPI 卡片
        List<MetricResult> metricResults = buildDepartmentKpiCards(departmentDataList, salesDataList);
        List<KPICard> kpiCards = convertToKPICards(metricResults);

        // 构建图表
        List<ChartConfig> chartList = buildDepartmentCharts(departmentDataList, salesDataList, startDate, endDate);
        Map<String, ChartConfig> charts = new LinkedHashMap<>();
        for (ChartConfig chart : chartList) {
            charts.put(chart.getTitle() != null ? chart.getTitle().replace(" ", "_") : "chart_" + charts.size(), chart);
        }

        // 构建部门内销售员排名
        List<RankingItem> salespersonRankings = buildSalespersonRankings(salesDataList);
        Map<String, List<RankingItem>> rankings = new LinkedHashMap<>();
        rankings.put("salesperson", salespersonRankings);

        return DashboardResponse.builder()
                .kpiCards(kpiCards)
                .charts(charts)
                .rankings(rankings)
                .lastUpdated(LocalDateTime.now())
                .build();
    }

    // ==================== 部门完成率 ====================

    @Override
    public List<MetricResult> getDepartmentCompletionRates(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取部门完成率: factoryId={}, period={} to {}", factoryId, startDate, endDate);

        List<SmartBiDepartmentData> departmentDataList = departmentDataRepository
                .findByFactoryIdAndRecordDateBetween(factoryId, startDate, endDate);

        if (departmentDataList.isEmpty()) {
            return Collections.emptyList();
        }

        // 按部门聚合
        Map<String, DepartmentAggregation> aggregatedData = aggregateDepartmentData(departmentDataList);

        List<MetricResult> results = new ArrayList<>();
        for (Map.Entry<String, DepartmentAggregation> entry : aggregatedData.entrySet()) {
            String departmentName = entry.getKey();
            DepartmentAggregation agg = entry.getValue();

            BigDecimal completionRate = calculateCompletionRate(agg.salesAmount, agg.salesTarget);
            String alertLevel = metricCalculatorService.determineAlertLevel(
                    MetricCalculatorService.TARGET_COMPLETION, completionRate);

            MetricResult result = MetricResult.builder()
                    .metricCode(MetricCalculatorService.TARGET_COMPLETION)
                    .metricName("目标完成率")
                    .value(completionRate.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .formattedValue(metricCalculatorService.formatMetricValue(
                            MetricCalculatorService.TARGET_COMPLETION, completionRate))
                    .unit("%")
                    .dimensionValue(departmentName)
                    .alertLevel(alertLevel)
                    .build();

            results.add(result);
        }

        // 按完成率降序排序
        results.sort((a, b) -> b.getValue().compareTo(a.getValue()));

        return results;
    }

    // ==================== 部门效率矩阵 ====================

    @Override
    public ChartConfig getDepartmentEfficiencyMatrix(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取部门效率矩阵: factoryId={}, period={} to {}", factoryId, startDate, endDate);

        List<SmartBiDepartmentData> departmentDataList = departmentDataRepository
                .findByFactoryIdAndRecordDateBetween(factoryId, startDate, endDate);

        if (departmentDataList.isEmpty()) {
            return createEmptyScatterChart("部门效率矩阵");
        }

        // 按部门聚合
        Map<String, DepartmentAggregation> aggregatedData = aggregateDepartmentData(departmentDataList);

        // 构建散点图数据
        List<Map<String, Object>> chartData = new ArrayList<>();
        BigDecimal totalPerCapitaSales = BigDecimal.ZERO;
        BigDecimal totalPerCapitaCost = BigDecimal.ZERO;
        int departmentCount = 0;

        for (Map.Entry<String, DepartmentAggregation> entry : aggregatedData.entrySet()) {
            String departmentName = entry.getKey();
            DepartmentAggregation agg = entry.getValue();

            BigDecimal perCapitaSales = agg.headcount > 0
                    ? agg.salesAmount.divide(BigDecimal.valueOf(agg.headcount), SCALE, ROUNDING_MODE)
                    : BigDecimal.ZERO;
            BigDecimal perCapitaCost = agg.headcount > 0
                    ? agg.costAmount.divide(BigDecimal.valueOf(agg.headcount), SCALE, ROUNDING_MODE)
                    : BigDecimal.ZERO;

            Map<String, Object> point = new LinkedHashMap<>();
            point.put("department", departmentName);
            point.put("perCapitaSales", perCapitaSales.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            point.put("perCapitaCost", perCapitaCost.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            point.put("salesAmount", agg.salesAmount.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            point.put("headcount", agg.headcount);
            point.put("quadrant", determineQuadrant(perCapitaSales, perCapitaCost, aggregatedData));

            chartData.add(point);

            totalPerCapitaSales = totalPerCapitaSales.add(perCapitaSales);
            totalPerCapitaCost = totalPerCapitaCost.add(perCapitaCost);
            departmentCount++;
        }

        // 计算平均值作为象限分割线
        BigDecimal avgPerCapitaSales = departmentCount > 0
                ? totalPerCapitaSales.divide(BigDecimal.valueOf(departmentCount), SCALE, ROUNDING_MODE)
                : BigDecimal.ZERO;
        BigDecimal avgPerCapitaCost = departmentCount > 0
                ? totalPerCapitaCost.divide(BigDecimal.valueOf(departmentCount), SCALE, ROUNDING_MODE)
                : BigDecimal.ZERO;

        // 构建图表选项
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("quadrantLines", Map.of(
                "xAxis", avgPerCapitaSales.setScale(DISPLAY_SCALE, ROUNDING_MODE),
                "yAxis", avgPerCapitaCost.setScale(DISPLAY_SCALE, ROUNDING_MODE)
        ));
        options.put("quadrantLabels", Map.of(
                "q1", "高投入高产出 - 需优化效率",
                "q2", "低投入低产出 - 表现平庸",
                "q3", "高投入低产出 - 需重点关注",
                "q4", "低投入高产出 - 明星部门"
        ));
        options.put("bubbleSizeField", "salesAmount");
        options.put("colorField", "department");

        return ChartConfig.builder()
                .chartType("SCATTER")
                .title("部门效率矩阵")
                .xAxisField("perCapitaSales")
                .yAxisField("perCapitaCost")
                .seriesField("department")
                .data(chartData)
                .options(options)
                .build();
    }

    // ==================== 部门人员分布 ====================

    @Override
    public ChartConfig getDepartmentHeadcountChart(String factoryId, LocalDate date) {
        log.info("获取部门人员分布: factoryId={}, date={}", factoryId, date);

        // 获取最近日期的部门数据
        List<SmartBiDepartmentData> departmentDataList = departmentDataRepository
                .findByFactoryIdAndRecordDateBetween(factoryId, date.minusDays(30), date);

        if (departmentDataList.isEmpty()) {
            return createEmptyPieChart("部门人员分布");
        }

        // 获取每个部门最新的人员数据
        Map<String, Integer> departmentHeadcount = new LinkedHashMap<>();
        Map<String, LocalDate> departmentLatestDate = new HashMap<>();

        for (SmartBiDepartmentData data : departmentDataList) {
            String dept = data.getDepartment();
            LocalDate recordDate = data.getRecordDate();

            if (!departmentLatestDate.containsKey(dept) || recordDate.isAfter(departmentLatestDate.get(dept))) {
                departmentLatestDate.put(dept, recordDate);
                departmentHeadcount.put(dept, data.getHeadcount() != null ? data.getHeadcount() : 0);
            }
        }

        // 构建饼图数据
        List<Map<String, Object>> chartData = new ArrayList<>();
        int totalHeadcount = 0;

        for (Map.Entry<String, Integer> entry : departmentHeadcount.entrySet()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("department", entry.getKey());
            item.put("headcount", entry.getValue());
            chartData.add(item);
            totalHeadcount += entry.getValue();
        }

        // 按人数降序排序
        chartData.sort((a, b) -> ((Integer) b.get("headcount")).compareTo((Integer) a.get("headcount")));

        // 计算百分比
        for (Map<String, Object> item : chartData) {
            int count = (Integer) item.get("headcount");
            BigDecimal percentage = totalHeadcount > 0
                    ? BigDecimal.valueOf(count * 100.0 / totalHeadcount).setScale(DISPLAY_SCALE, ROUNDING_MODE)
                    : BigDecimal.ZERO;
            item.put("percentage", percentage);
        }

        // 构建图表选项
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("centerText", String.format("总人数: %d", totalHeadcount));
        options.put("showPercentage", true);

        return ChartConfig.builder()
                .chartType("PIE")
                .title("部门人员分布")
                .xAxisField("department")
                .yAxisField("headcount")
                .data(chartData)
                .options(options)
                .build();
    }

    // ==================== 部门趋势对比 ====================

    @Override
    public ChartConfig getDepartmentTrendComparison(String factoryId, LocalDate startDate,
                                                     LocalDate endDate, String period) {
        log.info("获取部门趋势对比: factoryId={}, period={} to {}, granularity={}",
                factoryId, startDate, endDate, period);

        // 从销售数据获取趋势
        List<SmartBiSalesData> salesDataList = salesDataRepository
                .findByFactoryIdAndOrderDateBetween(factoryId, startDate, endDate);

        if (salesDataList.isEmpty()) {
            return createEmptyLineChart("部门销售趋势对比");
        }

        // 按时间粒度和部门聚合
        Map<String, Map<String, BigDecimal>> trendData = aggregateTrendData(salesDataList, period);

        // 获取所有时间点和部门
        Set<String> allPeriods = new TreeSet<>();
        Set<String> allDepartments = new LinkedHashSet<>();
        for (Map.Entry<String, Map<String, BigDecimal>> entry : trendData.entrySet()) {
            allPeriods.add(entry.getKey());
            allDepartments.addAll(entry.getValue().keySet());
        }

        // 构建折线图数据
        List<Map<String, Object>> chartData = new ArrayList<>();
        for (String periodKey : allPeriods) {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("period", periodKey);

            Map<String, BigDecimal> departmentSales = trendData.getOrDefault(periodKey, Collections.emptyMap());
            for (String dept : allDepartments) {
                BigDecimal amount = departmentSales.getOrDefault(dept, BigDecimal.ZERO);
                point.put(dept, amount.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            }

            chartData.add(point);
        }

        // 构建图表选项
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("series", new ArrayList<>(allDepartments));
        options.put("period", period);

        return ChartConfig.builder()
                .chartType("LINE")
                .title("部门销售趋势对比")
                .xAxisField("period")
                .yAxisField("amount")
                .seriesField("department")
                .data(chartData)
                .options(options)
                .build();
    }

    // ==================== 部门销售占比 ====================

    @Override
    public ChartConfig getDepartmentShareTrend(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取部门销售占比变化: factoryId={}, period={} to {}", factoryId, startDate, endDate);

        List<SmartBiSalesData> salesDataList = salesDataRepository
                .findByFactoryIdAndOrderDateBetween(factoryId, startDate, endDate);

        if (salesDataList.isEmpty()) {
            return createEmptyAreaChart("部门销售占比变化");
        }

        // 按月份和部门聚合
        Map<String, Map<String, BigDecimal>> monthlyData = aggregateTrendData(salesDataList, PERIOD_MONTH);

        // 计算每月总额和占比
        List<Map<String, Object>> chartData = new ArrayList<>();
        Set<String> allDepartments = new LinkedHashSet<>();

        // 收集所有部门
        for (Map<String, BigDecimal> deptSales : monthlyData.values()) {
            allDepartments.addAll(deptSales.keySet());
        }

        for (Map.Entry<String, Map<String, BigDecimal>> entry : monthlyData.entrySet()) {
            String month = entry.getKey();
            Map<String, BigDecimal> departmentSales = entry.getValue();

            // 计算月度总额
            BigDecimal monthTotal = departmentSales.values().stream()
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            Map<String, Object> point = new LinkedHashMap<>();
            point.put("month", month);
            point.put("total", monthTotal.setScale(DISPLAY_SCALE, ROUNDING_MODE));

            // 计算各部门占比
            for (String dept : allDepartments) {
                BigDecimal amount = departmentSales.getOrDefault(dept, BigDecimal.ZERO);
                BigDecimal percentage = monthTotal.compareTo(BigDecimal.ZERO) > 0
                        ? amount.multiply(BigDecimal.valueOf(100))
                        .divide(monthTotal, SCALE, ROUNDING_MODE)
                        : BigDecimal.ZERO;

                point.put(dept, amount.setScale(DISPLAY_SCALE, ROUNDING_MODE));
                point.put(dept + "_share", percentage.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            }

            chartData.add(point);
        }

        // 按月份排序
        chartData.sort((a, b) -> ((String) a.get("month")).compareTo((String) b.get("month")));

        // 构建图表选项
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("series", new ArrayList<>(allDepartments));
        options.put("stack", true);
        options.put("showPercentage", true);

        return ChartConfig.builder()
                .chartType("AREA")
                .title("部门销售占比变化")
                .xAxisField("month")
                .yAxisField("amount")
                .seriesField("department")
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
     * 聚合部门数据
     */
    private Map<String, DepartmentAggregation> aggregateDepartmentData(List<SmartBiDepartmentData> dataList) {
        Map<String, DepartmentAggregation> result = new LinkedHashMap<>();

        for (SmartBiDepartmentData data : dataList) {
            String dept = data.getDepartment();
            DepartmentAggregation agg = result.computeIfAbsent(dept, k -> new DepartmentAggregation());

            agg.salesAmount = agg.salesAmount.add(
                    data.getSalesAmount() != null ? data.getSalesAmount() : BigDecimal.ZERO);
            agg.salesTarget = agg.salesTarget.add(
                    data.getSalesTarget() != null ? data.getSalesTarget() : BigDecimal.ZERO);
            agg.costAmount = agg.costAmount.add(
                    data.getCostAmount() != null ? data.getCostAmount() : BigDecimal.ZERO);

            // 人员数取最新记录
            if (data.getHeadcount() != null && data.getHeadcount() > agg.headcount) {
                agg.headcount = data.getHeadcount();
            }
        }

        return result;
    }

    /**
     * 按时间粒度聚合销售数据
     */
    private Map<String, Map<String, BigDecimal>> aggregateTrendData(List<SmartBiSalesData> dataList, String period) {
        Map<String, Map<String, BigDecimal>> result = new TreeMap<>();

        for (SmartBiSalesData data : dataList) {
            if (data.getDepartment() == null || data.getOrderDate() == null) {
                continue;
            }

            String periodKey = getPeriodKey(data.getOrderDate(), period);
            String dept = data.getDepartment();
            BigDecimal amount = data.getAmount() != null ? data.getAmount() : BigDecimal.ZERO;

            result.computeIfAbsent(periodKey, k -> new LinkedHashMap<>())
                    .merge(dept, amount, BigDecimal::add);
        }

        return result;
    }

    /**
     * 获取时间周期键
     */
    private String getPeriodKey(LocalDate date, String period) {
        switch (period.toUpperCase()) {
            case PERIOD_DAY:
                return date.toString();
            case PERIOD_WEEK:
                int weekOfYear = date.get(WeekFields.ISO.weekOfWeekBasedYear());
                return String.format("%d-W%02d", date.getYear(), weekOfYear);
            case PERIOD_MONTH:
            default:
                return YearMonth.from(date).toString();
        }
    }

    /**
     * 计算目标完成率
     */
    private BigDecimal calculateCompletionRate(BigDecimal actual, BigDecimal target) {
        if (target == null || target.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return actual.multiply(BigDecimal.valueOf(100))
                .divide(target, SCALE, ROUNDING_MODE);
    }

    /**
     * 确定效率象限
     */
    private String determineQuadrant(BigDecimal perCapitaSales, BigDecimal perCapitaCost,
                                     Map<String, DepartmentAggregation> allData) {
        // 计算平均值
        BigDecimal avgSales = BigDecimal.ZERO;
        BigDecimal avgCost = BigDecimal.ZERO;
        int count = 0;

        for (DepartmentAggregation agg : allData.values()) {
            if (agg.headcount > 0) {
                avgSales = avgSales.add(agg.salesAmount.divide(BigDecimal.valueOf(agg.headcount), SCALE, ROUNDING_MODE));
                avgCost = avgCost.add(agg.costAmount.divide(BigDecimal.valueOf(agg.headcount), SCALE, ROUNDING_MODE));
                count++;
            }
        }

        if (count > 0) {
            avgSales = avgSales.divide(BigDecimal.valueOf(count), SCALE, ROUNDING_MODE);
            avgCost = avgCost.divide(BigDecimal.valueOf(count), SCALE, ROUNDING_MODE);
        }

        boolean highOutput = perCapitaSales.compareTo(avgSales) >= 0;
        boolean highCost = perCapitaCost.compareTo(avgCost) >= 0;

        if (highOutput && highCost) {
            return "Q1_HIGH_OUTPUT_HIGH_COST";  // 需优化效率
        } else if (highOutput && !highCost) {
            return "Q4_HIGH_OUTPUT_LOW_COST";   // 明星部门
        } else if (!highOutput && highCost) {
            return "Q3_LOW_OUTPUT_HIGH_COST";   // 需重点关注
        } else {
            return "Q2_LOW_OUTPUT_LOW_COST";    // 表现平庸
        }
    }

    /**
     * 构建部门 KPI 卡片
     */
    private List<MetricResult> buildDepartmentKpiCards(List<SmartBiDepartmentData> departmentData,
                                                        List<SmartBiSalesData> salesData) {
        List<MetricResult> kpiCards = new ArrayList<>();

        // 聚合部门数据
        BigDecimal totalSales = BigDecimal.ZERO;
        BigDecimal totalTarget = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;
        int totalHeadcount = 0;

        for (SmartBiDepartmentData data : departmentData) {
            totalSales = totalSales.add(data.getSalesAmount() != null ? data.getSalesAmount() : BigDecimal.ZERO);
            totalTarget = totalTarget.add(data.getSalesTarget() != null ? data.getSalesTarget() : BigDecimal.ZERO);
            totalCost = totalCost.add(data.getCostAmount() != null ? data.getCostAmount() : BigDecimal.ZERO);
            if (data.getHeadcount() != null && data.getHeadcount() > totalHeadcount) {
                totalHeadcount = data.getHeadcount();
            }
        }

        // 销售额
        kpiCards.add(MetricResult.of(
                MetricCalculatorService.SALES_AMOUNT,
                "销售额",
                totalSales.setScale(DISPLAY_SCALE, ROUNDING_MODE),
                "元"
        ));

        // 目标完成率
        BigDecimal completionRate = calculateCompletionRate(totalSales, totalTarget);
        String completionAlertLevel = metricCalculatorService.determineAlertLevel(
                MetricCalculatorService.TARGET_COMPLETION, completionRate);
        kpiCards.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.TARGET_COMPLETION)
                .metricName("目标完成率")
                .value(completionRate.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .unit("%")
                .alertLevel(completionAlertLevel)
                .build());

        // 人均产出
        BigDecimal perCapitaSales = totalHeadcount > 0
                ? totalSales.divide(BigDecimal.valueOf(totalHeadcount), SCALE, ROUNDING_MODE)
                : BigDecimal.ZERO;
        kpiCards.add(MetricResult.of(
                MetricCalculatorService.SALES_PER_CAPITA,
                "人均产出",
                perCapitaSales.setScale(DISPLAY_SCALE, ROUNDING_MODE),
                "元"
        ));

        // 人均成本
        BigDecimal perCapitaCost = totalHeadcount > 0
                ? totalCost.divide(BigDecimal.valueOf(totalHeadcount), SCALE, ROUNDING_MODE)
                : BigDecimal.ZERO;
        kpiCards.add(MetricResult.of(
                MetricCalculatorService.COST_PER_CAPITA,
                "人均成本",
                perCapitaCost.setScale(DISPLAY_SCALE, ROUNDING_MODE),
                "元"
        ));

        return kpiCards;
    }

    /**
     * 构建部门图表
     */
    private List<ChartConfig> buildDepartmentCharts(List<SmartBiDepartmentData> departmentData,
                                                     List<SmartBiSalesData> salesData,
                                                     LocalDate startDate, LocalDate endDate) {
        List<ChartConfig> charts = new ArrayList<>();

        // 销售趋势图
        if (!salesData.isEmpty()) {
            Map<String, Map<String, BigDecimal>> trendData = aggregateTrendData(salesData, PERIOD_DAY);

            List<Map<String, Object>> trendChartData = new ArrayList<>();
            for (Map.Entry<String, Map<String, BigDecimal>> entry : trendData.entrySet()) {
                BigDecimal dayTotal = entry.getValue().values().stream()
                        .reduce(BigDecimal.ZERO, BigDecimal::add);

                Map<String, Object> point = new LinkedHashMap<>();
                point.put("date", entry.getKey());
                point.put("amount", dayTotal.setScale(DISPLAY_SCALE, ROUNDING_MODE));
                trendChartData.add(point);
            }

            // 排序
            trendChartData.sort((a, b) -> ((String) a.get("date")).compareTo((String) b.get("date")));

            charts.add(ChartConfig.builder()
                    .chartType("LINE")
                    .title("销售趋势")
                    .xAxisField("date")
                    .yAxisField("amount")
                    .data(trendChartData)
                    .build());
        }

        return charts;
    }

    /**
     * 构建部门内销售员排名
     */
    private List<RankingItem> buildSalespersonRankings(List<SmartBiSalesData> salesData) {
        if (salesData.isEmpty()) {
            return Collections.emptyList();
        }

        // 按销售员聚合
        Map<String, BigDecimal> salespersonSales = new LinkedHashMap<>();
        for (SmartBiSalesData data : salesData) {
            if (data.getSalespersonName() != null) {
                salespersonSales.merge(
                        data.getSalespersonName(),
                        data.getAmount() != null ? data.getAmount() : BigDecimal.ZERO,
                        BigDecimal::add
                );
            }
        }

        // 转换为排名列表
        List<RankingItem> rankings = new ArrayList<>();
        List<Map.Entry<String, BigDecimal>> sortedEntries = salespersonSales.entrySet().stream()
                .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                .limit(10)
                .collect(Collectors.toList());

        int rank = 1;
        for (Map.Entry<String, BigDecimal> entry : sortedEntries) {
            rankings.add(RankingItem.builder()
                    .rank(rank++)
                    .name(entry.getKey())
                    .value(entry.getValue().setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .build());
        }

        return rankings;
    }

    // ==================== 空图表创建方法 ====================

    private ChartConfig createEmptyScatterChart(String title) {
        return ChartConfig.builder()
                .chartType("SCATTER")
                .title(title)
                .data(Collections.emptyList())
                .build();
    }

    private ChartConfig createEmptyPieChart(String title) {
        return ChartConfig.builder()
                .chartType("PIE")
                .title(title)
                .data(Collections.emptyList())
                .build();
    }

    private ChartConfig createEmptyLineChart(String title) {
        return ChartConfig.builder()
                .chartType("LINE")
                .title(title)
                .data(Collections.emptyList())
                .build();
    }

    private ChartConfig createEmptyAreaChart(String title) {
        return ChartConfig.builder()
                .chartType("AREA")
                .title(title)
                .data(Collections.emptyList())
                .build();
    }

    // ==================== 内部类 ====================

    /**
     * 部门数据聚合结果
     */
    private static class DepartmentAggregation {
        BigDecimal salesAmount = BigDecimal.ZERO;
        BigDecimal salesTarget = BigDecimal.ZERO;
        BigDecimal costAmount = BigDecimal.ZERO;
        int headcount = 0;
    }
}
