package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.smartbi.AIInsight;
import com.cretas.aims.dto.smartbi.ChartConfig;
import com.cretas.aims.dto.smartbi.DashboardResponse;
import com.cretas.aims.dto.smartbi.KPICard;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.dto.smartbi.RankingItem;
import com.cretas.aims.dto.smartbi.RegionOpportunityScore;
import com.cretas.aims.entity.smartbi.SmartBiSalesData;
import com.cretas.aims.repository.smartbi.SmartBiSalesDataRepository;
import com.cretas.aims.service.smartbi.MetricCalculatorService;
import com.cretas.aims.service.smartbi.RegionAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 区域分析服务实现
 *
 * 实现 SmartBI 系统中区域维度的分析能力，包括：
 * - 区域/省份/城市三级下钻分析
 * - 区域机会评分（增长率 + 基数 + 毛利率 + 渗透率）
 * - 地理分布热力图数据
 * - 区域销售趋势和目标完成情况
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RegionAnalysisServiceImpl implements RegionAnalysisService {

    private static final int SCALE = 4;
    private static final int DISPLAY_SCALE = 2;
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    private final SmartBiSalesDataRepository salesDataRepository;
    private final MetricCalculatorService metricCalculatorService;

    // ==================== 区域排名分析 ====================

    @Override
    public List<RankingItem> getRegionRanking(String factoryId, LocalDate startDate, LocalDate endDate) {
        log.info("获取区域销售排名: factoryId={}, period={} to {}", factoryId, startDate, endDate);

        List<SmartBiSalesData> salesData = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                factoryId, startDate, endDate);

        if (salesData.isEmpty()) {
            return Collections.emptyList();
        }

        // 按区域分组聚合
        Map<String, RegionAggregation> regionAggregations = aggregateByRegion(salesData);

        // 转换为排名列表
        List<RankingItem> rankings = new ArrayList<>();
        List<Map.Entry<String, RegionAggregation>> sortedEntries = regionAggregations.entrySet().stream()
                .sorted((e1, e2) -> e2.getValue().totalAmount.compareTo(e1.getValue().totalAmount))
                .collect(Collectors.toList());

        int rank = 1;
        for (Map.Entry<String, RegionAggregation> entry : sortedEntries) {
            String region = entry.getKey();
            RegionAggregation agg = entry.getValue();

            BigDecimal completionRate = calculateCompletionRate(agg.totalAmount, agg.totalTarget);
            String alertLevel = metricCalculatorService.determineAlertLevel(
                    MetricCalculatorService.TARGET_COMPLETION, completionRate);

            rankings.add(RankingItem.builder()
                    .rank(rank++)
                    .name(region)
                    .value(agg.totalAmount.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .target(agg.totalTarget.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .completionRate(completionRate.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .alertLevel(alertLevel)
                    .build());
        }

        return rankings;
    }

    @Override
    public List<RankingItem> getProvinceRanking(String factoryId, String region, LocalDate startDate, LocalDate endDate) {
        log.info("获取省份销售排名: factoryId={}, region={}, period={} to {}", factoryId, region, startDate, endDate);

        List<SmartBiSalesData> salesData = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                factoryId, startDate, endDate);

        log.info("查询到销售数据: {} 条", salesData.size());

        if (salesData.isEmpty()) {
            log.warn("无销售数据，factoryId={}, 日期范围={} to {}", factoryId, startDate, endDate);
            return Collections.emptyList();
        }

        // 按区域筛选（支持模糊匹配）
        if (region != null && !region.isEmpty()) {
            String normalizedRegion = normalizeRegionName(region);
            salesData = salesData.stream()
                    .filter(s -> {
                        String dataRegion = s.getRegion();
                        if (dataRegion == null) return false;
                        String normalizedData = normalizeRegionName(dataRegion);
                        return normalizedData.contains(normalizedRegion) ||
                               normalizedRegion.contains(normalizedData);
                    })
                    .collect(Collectors.toList());
            log.info("按区域 '{}' 过滤后: {} 条", region, salesData.size());
        }

        // 按省份分组聚合
        Map<String, RegionAggregation> provinceAggregations = aggregateByProvince(salesData);

        return buildRankingList(provinceAggregations);
    }

    /**
     * 标准化区域名称（用于模糊匹配）
     */
    private String normalizeRegionName(String region) {
        if (region == null) {
            return "";
        }
        return region
                .replace("地区", "")
                .replace("区域", "")
                .replace("大区", "")
                .trim();
    }

    @Override
    public List<RankingItem> getCityRanking(String factoryId, String province, LocalDate startDate, LocalDate endDate) {
        log.info("获取城市销售排名: factoryId={}, province={}, period={} to {}", factoryId, province, startDate, endDate);

        List<SmartBiSalesData> salesData = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                factoryId, startDate, endDate);

        if (salesData.isEmpty()) {
            return Collections.emptyList();
        }

        // 按省份筛选（如果指定）
        if (province != null && !province.isEmpty()) {
            salesData = salesData.stream()
                    .filter(s -> province.equals(s.getProvince()))
                    .collect(Collectors.toList());
        }

        // 按城市分组聚合
        Map<String, RegionAggregation> cityAggregations = aggregateByCity(salesData);

        return buildRankingList(cityAggregations);
    }

    // ==================== 区域详情分析 ====================

    @Override
    public DashboardResponse getRegionDetail(String factoryId, String region, LocalDate startDate, LocalDate endDate) {
        log.info("获取区域详情: factoryId={}, region={}, period={} to {}", factoryId, region, startDate, endDate);

        List<SmartBiSalesData> salesData = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                factoryId, startDate, endDate);

        // 筛选指定区域
        List<SmartBiSalesData> regionData = salesData.stream()
                .filter(s -> region.equals(s.getRegion()))
                .collect(Collectors.toList());

        if (regionData.isEmpty()) {
            return DashboardResponse.builder()
                    .kpiCards(Collections.emptyList())
                    .charts(Collections.emptyMap())
                    .rankings(Collections.emptyMap())
                    .aiInsights(Collections.emptyList())
                    .suggestions(Collections.emptyList())
                    .lastUpdated(LocalDateTime.now())
                    .build();
        }

        // 计算 KPI 指标
        List<MetricResult> metricResults = calculateRegionKPIs(regionData, startDate, endDate, factoryId);
        List<KPICard> kpiCards = convertToKPICards(metricResults);

        // 获取省份排名
        List<RankingItem> provinceRankings = getProvinceRanking(factoryId, region, startDate, endDate);
        Map<String, List<RankingItem>> rankings = new LinkedHashMap<>();
        rankings.put("province", provinceRankings);

        // 构建图表
        List<ChartConfig> chartList = buildRegionDetailCharts(regionData, region, startDate, endDate);
        Map<String, ChartConfig> charts = new LinkedHashMap<>();
        for (ChartConfig chart : chartList) {
            charts.put(chart.getTitle() != null ? chart.getTitle().replace(" ", "_") : "chart_" + charts.size(), chart);
        }

        // 生成 AI 洞察
        List<AIInsight> aiInsights = generateRegionInsights(regionData, region, metricResults);

        // 生成建议
        List<String> suggestions = generateSuggestions(regionData, region);

        return DashboardResponse.builder()
                .kpiCards(kpiCards)
                .charts(charts)
                .rankings(rankings)
                .aiInsights(aiInsights)
                .suggestions(suggestions)
                .lastUpdated(LocalDateTime.now())
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
     * 按区域分组聚合
     */
    private Map<String, RegionAggregation> aggregateByRegion(List<SmartBiSalesData> salesData) {
        Map<String, RegionAggregation> aggregations = new LinkedHashMap<>();

        for (SmartBiSalesData sale : salesData) {
            String region = sale.getRegion();
            if (region == null || region.isEmpty()) {
                region = "未分类";
            }

            RegionAggregation agg = aggregations.computeIfAbsent(region, k -> new RegionAggregation());
            agg.addSale(sale);
        }

        // 计算每个区域的毛利率
        for (RegionAggregation agg : aggregations.values()) {
            agg.calculateGrossMargin();
        }

        return aggregations;
    }

    /**
     * 按省份分组聚合
     */
    private Map<String, RegionAggregation> aggregateByProvince(List<SmartBiSalesData> salesData) {
        Map<String, RegionAggregation> aggregations = new LinkedHashMap<>();

        for (SmartBiSalesData sale : salesData) {
            String province = sale.getProvince();
            if (province == null || province.isEmpty()) {
                province = "未分类";
            }

            RegionAggregation agg = aggregations.computeIfAbsent(province, k -> new RegionAggregation());
            agg.addSale(sale);
        }

        for (RegionAggregation agg : aggregations.values()) {
            agg.calculateGrossMargin();
        }

        return aggregations;
    }

    /**
     * 按城市分组聚合
     */
    private Map<String, RegionAggregation> aggregateByCity(List<SmartBiSalesData> salesData) {
        Map<String, RegionAggregation> aggregations = new LinkedHashMap<>();

        for (SmartBiSalesData sale : salesData) {
            String city = sale.getCity();
            if (city == null || city.isEmpty()) {
                city = "未分类";
            }

            RegionAggregation agg = aggregations.computeIfAbsent(city, k -> new RegionAggregation());
            agg.addSale(sale);
        }

        for (RegionAggregation agg : aggregations.values()) {
            agg.calculateGrossMargin();
        }

        return aggregations;
    }

    /**
     * 构建排名列表
     */
    private List<RankingItem> buildRankingList(Map<String, RegionAggregation> aggregations) {
        List<RankingItem> rankings = new ArrayList<>();
        List<Map.Entry<String, RegionAggregation>> sortedEntries = aggregations.entrySet().stream()
                .sorted((e1, e2) -> e2.getValue().totalAmount.compareTo(e1.getValue().totalAmount))
                .collect(Collectors.toList());

        int rank = 1;
        for (Map.Entry<String, RegionAggregation> entry : sortedEntries) {
            String name = entry.getKey();
            RegionAggregation agg = entry.getValue();

            BigDecimal completionRate = calculateCompletionRate(agg.totalAmount, agg.totalTarget);
            String alertLevel = metricCalculatorService.determineAlertLevel(
                    MetricCalculatorService.TARGET_COMPLETION, completionRate);

            rankings.add(RankingItem.builder()
                    .rank(rank++)
                    .name(name)
                    .value(agg.totalAmount.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .target(agg.totalTarget.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .completionRate(completionRate.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                    .alertLevel(alertLevel)
                    .build());
        }

        return rankings;
    }

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
     * 计算区域 KPI
     */
    private List<MetricResult> calculateRegionKPIs(List<SmartBiSalesData> salesData,
                                                    LocalDate startDate, LocalDate endDate,
                                                    String factoryId) {
        List<MetricResult> kpis = new ArrayList<>();

        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalTarget = BigDecimal.ZERO;
        int orderCount = 0;
        Set<String> customers = new HashSet<>();

        for (SmartBiSalesData sale : salesData) {
            if (sale.getAmount() != null) {
                totalAmount = totalAmount.add(sale.getAmount());
            }
            if (sale.getCost() != null) {
                totalCost = totalCost.add(sale.getCost());
            }
            if (sale.getMonthlyTarget() != null) {
                totalTarget = totalTarget.add(sale.getMonthlyTarget());
            }
            orderCount++;
            if (sale.getCustomerName() != null) {
                customers.add(sale.getCustomerName());
            }
        }

        // 销售额
        kpis.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.SALES_AMOUNT)
                .metricName("销售额")
                .value(totalAmount.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(formatAmount(totalAmount))
                .unit("元")
                .alertLevel(MetricResult.AlertLevel.GREEN.name())
                .build());

        // 目标完成率
        BigDecimal completionRate = calculateCompletionRate(totalAmount, totalTarget);
        kpis.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.TARGET_COMPLETION)
                .metricName("目标完成率")
                .value(completionRate.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(completionRate.setScale(DISPLAY_SCALE, ROUNDING_MODE) + "%")
                .unit("%")
                .alertLevel(metricCalculatorService.determineAlertLevel(
                        MetricCalculatorService.TARGET_COMPLETION, completionRate))
                .build());

        // 毛利率
        BigDecimal grossProfit = totalAmount.subtract(totalCost);
        BigDecimal grossMargin = totalAmount.compareTo(BigDecimal.ZERO) > 0
                ? grossProfit.divide(totalAmount, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"))
                : BigDecimal.ZERO;
        kpis.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.GROSS_MARGIN)
                .metricName("毛利率")
                .value(grossMargin.setScale(DISPLAY_SCALE, ROUNDING_MODE))
                .formattedValue(grossMargin.setScale(DISPLAY_SCALE, ROUNDING_MODE) + "%")
                .unit("%")
                .alertLevel(metricCalculatorService.determineAlertLevel(
                        MetricCalculatorService.GROSS_MARGIN, grossMargin))
                .build());

        // 客户数
        kpis.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.CUSTOMER_COUNT)
                .metricName("客户数")
                .value(new BigDecimal(customers.size()))
                .formattedValue(String.valueOf(customers.size()))
                .unit("个")
                .alertLevel(MetricResult.AlertLevel.GREEN.name())
                .build());

        // 订单数
        kpis.add(MetricResult.builder()
                .metricCode(MetricCalculatorService.ORDER_COUNT)
                .metricName("订单数")
                .value(new BigDecimal(orderCount))
                .formattedValue(String.valueOf(orderCount))
                .unit("单")
                .alertLevel(MetricResult.AlertLevel.GREEN.name())
                .build());

        return kpis;
    }

    /**
     * 构建区域详情图表
     */
    private List<ChartConfig> buildRegionDetailCharts(List<SmartBiSalesData> salesData,
                                                       String region,
                                                       LocalDate startDate, LocalDate endDate) {
        List<ChartConfig> charts = new ArrayList<>();

        // 省份销售柱状图
        Map<String, RegionAggregation> provinceAggs = aggregateByProvince(salesData);
        List<Map<String, Object>> provinceData = new ArrayList<>();
        for (Map.Entry<String, RegionAggregation> entry : provinceAggs.entrySet()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("province", entry.getKey());
            item.put("amount", entry.getValue().totalAmount.setScale(DISPLAY_SCALE, ROUNDING_MODE));
            provinceData.add(item);
        }
        provinceData.sort((p1, p2) -> ((BigDecimal) p2.get("amount")).compareTo((BigDecimal) p1.get("amount")));

        charts.add(ChartConfig.builder()
                .chartType("BAR")
                .title(region + " 各省份销售额")
                .xAxisField("province")
                .yAxisField("amount")
                .data(provinceData)
                .build());

        // 日销售趋势
        Map<LocalDate, BigDecimal> dailySales = salesData.stream()
                .collect(Collectors.groupingBy(
                        SmartBiSalesData::getOrderDate,
                        Collectors.reducing(BigDecimal.ZERO,
                                s -> s.getAmount() != null ? s.getAmount() : BigDecimal.ZERO,
                                BigDecimal::add)));

        List<Map<String, Object>> trendData = new ArrayList<>();
        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("date", date.toString());
            item.put("amount", dailySales.getOrDefault(date, BigDecimal.ZERO).setScale(DISPLAY_SCALE, ROUNDING_MODE));
            trendData.add(item);
        }

        charts.add(ChartConfig.builder()
                .chartType("LINE")
                .title(region + " 销售趋势")
                .xAxisField("date")
                .yAxisField("amount")
                .data(trendData)
                .options(Map.of("smooth", true))
                .build());

        return charts;
    }

    /**
     * 生成区域洞察
     */
    private List<AIInsight> generateRegionInsights(List<SmartBiSalesData> salesData,
                                                    String region,
                                                    List<MetricResult> kpis) {
        List<AIInsight> insights = new ArrayList<>();

        // 简单的规则引擎生成洞察
        for (MetricResult kpi : kpis) {
            if (MetricResult.AlertLevel.RED.name().equals(kpi.getAlertLevel())) {
                insights.add(AIInsight.builder()
                        .level("RED")
                        .category("REGION_ANALYSIS")
                        .message(region + " " + kpi.getMetricName() + " 为 " + kpi.getFormattedValue() + "，低于正常水平，建议重点关注。")
                        .relatedEntity(region)
                        .actionSuggestion("请分析 " + kpi.getMetricName() + " 低于预期的原因，制定改进计划。")
                        .build());
            } else if (MetricResult.AlertLevel.YELLOW.name().equals(kpi.getAlertLevel())) {
                insights.add(AIInsight.builder()
                        .level("YELLOW")
                        .category("REGION_ANALYSIS")
                        .message(region + " " + kpi.getMetricName() + " 为 " + kpi.getFormattedValue() + "，处于关注区间。")
                        .relatedEntity(region)
                        .actionSuggestion("建议持续关注 " + kpi.getMetricName() + " 的变化趋势。")
                        .build());
            }
        }

        return insights;
    }

    /**
     * 生成建议
     */
    private List<String> generateSuggestions(List<SmartBiSalesData> salesData, String region) {
        List<String> suggestions = new ArrayList<>();

        // 按省份分析，找出表现较差的省份
        Map<String, RegionAggregation> provinceAggs = aggregateByProvince(salesData);
        List<Map.Entry<String, RegionAggregation>> sortedProvinces = provinceAggs.entrySet().stream()
                .sorted((e1, e2) -> e2.getValue().totalAmount.compareTo(e1.getValue().totalAmount))
                .collect(Collectors.toList());

        if (!sortedProvinces.isEmpty()) {
            // 表现最好的省份
            String topProvince = sortedProvinces.get(0).getKey();
            suggestions.add("重点维护 " + topProvince + "，该省份销售额最高，可复制其成功经验到其他省份。");

            // 表现较差的省份（如果有3个以上省份）
            if (sortedProvinces.size() >= 3) {
                String bottomProvince = sortedProvinces.get(sortedProvinces.size() - 1).getKey();
                suggestions.add("重点突破 " + bottomProvince + "，该省份销售额较低，建议分析原因并制定改进策略。");
            }
        }

        suggestions.add("建议定期检查各省份的客户覆盖情况，提升市场渗透率。");

        return suggestions;
    }

    /**
     * 计算增长率评分
     */
    private BigDecimal calculateGrowthScore(BigDecimal current, BigDecimal previous) {
        BigDecimal growthRate = metricCalculatorService.calculateMomGrowth(current, previous);
        // 增长率 > 50% 得100分, 0% 得50分, < -50% 得0分
        BigDecimal score = growthRate.add(new BigDecimal("50")).max(BigDecimal.ZERO).min(new BigDecimal("100"));
        return score;
    }

    /**
     * 计算基数评分
     */
    private BigDecimal calculateBaseScore(BigDecimal regionSales, BigDecimal totalSales) {
        if (totalSales.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        // 占比 > 30% 得100分, 10% 得50分, < 1% 得10分
        BigDecimal ratio = regionSales.divide(totalSales, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"));
        return ratio.multiply(new BigDecimal("3")).min(new BigDecimal("100"));
    }

    /**
     * 计算毛利率评分
     */
    private BigDecimal calculateMarginScore(BigDecimal grossMargin) {
        // 毛利率 > 30% 得100分, 15% 得50分, 0% 得0分
        if (grossMargin == null) {
            return BigDecimal.ZERO;
        }
        return grossMargin.multiply(new BigDecimal("3.33")).min(new BigDecimal("100")).max(BigDecimal.ZERO);
    }

    /**
     * 计算渗透率评分
     */
    private BigDecimal calculatePenetrationScore(int customerCount, int orderCount) {
        // 简单算法：客户数 * 10 + 订单数 / 10，上限100
        BigDecimal score = new BigDecimal(customerCount * 10 + orderCount / 10);
        return score.min(new BigDecimal("100"));
    }

    /**
     * 生成机会建议
     */
    private String generateOpportunityRecommendation(String region, BigDecimal totalScore,
                                                      BigDecimal growthScore, BigDecimal baseScore,
                                                      BigDecimal marginScore, BigDecimal penetrationScore) {
        StringBuilder sb = new StringBuilder();

        String level = RegionOpportunityScore.determineOpportunityLevel(totalScore);
        switch (level) {
            case "HIGH":
                sb.append(region).append("是高潜力区域，");
                break;
            case "MEDIUM":
                sb.append(region).append("具有一定发展潜力，");
                break;
            case "LOW":
                sb.append(region).append("目前发展潜力有限，");
                break;
        }

        // 找出最强和最弱的维度
        Map<String, BigDecimal> scores = new LinkedHashMap<>();
        scores.put("增长率", growthScore);
        scores.put("销售基数", baseScore);
        scores.put("毛利率", marginScore);
        scores.put("市场渗透", penetrationScore);

        String strongest = scores.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("");

        String weakest = scores.entrySet().stream()
                .min(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("");

        sb.append("优势在于").append(strongest).append("，");
        sb.append("建议重点提升").append(weakest).append("。");

        return sb.toString();
    }

    /**
     * 格式化金额
     */
    private String formatAmount(BigDecimal amount) {
        if (amount == null) {
            return "0.00";
        }
        return String.format("%,.2f", amount.doubleValue());
    }

    /**
     * 确定变化方向
     */
    private String determineDirection(BigDecimal value, BigDecimal baseline) {
        if (value == null || baseline == null) {
            return "STABLE";
        }
        int cmp = value.compareTo(baseline);
        if (cmp > 0) {
            return "UP";
        } else if (cmp < 0) {
            return "DOWN";
        } else {
            return "STABLE";
        }
    }

    /**
     * 标准化省份名称（用于地图匹配）
     */
    private String normalizeProvinceName(String province) {
        if (province == null) {
            return "未知";
        }
        // 移除"省"、"市"、"自治区"等后缀，以匹配地图数据
        return province
                .replaceAll("省$", "")
                .replaceAll("市$", "")
                .replaceAll("自治区$", "")
                .replaceAll("特别行政区$", "")
                .replaceAll("壮族$", "")
                .replaceAll("回族$", "")
                .replaceAll("维吾尔$", "");
    }

    /**
     * 确定颜色等级（用于热力图）
     */
    private String determineColorLevel(BigDecimal heatValue) {
        if (heatValue == null) {
            return "LOW";
        }
        double v = heatValue.doubleValue();
        if (v >= 0.7) {
            return "HIGH";
        } else if (v >= 0.3) {
            return "MEDIUM";
        } else {
            return "LOW";
        }
    }

    // ==================== 内部类 ====================

    /**
     * 区域聚合数据
     */
    private static class RegionAggregation {
        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalTarget = BigDecimal.ZERO;
        BigDecimal grossMargin = BigDecimal.ZERO;
        int orderCount = 0;
        int customerCount = 0;
        Set<String> customers = new HashSet<>();

        void addSale(SmartBiSalesData sale) {
            if (sale.getAmount() != null) {
                totalAmount = totalAmount.add(sale.getAmount());
            }
            if (sale.getCost() != null) {
                totalCost = totalCost.add(sale.getCost());
            }
            if (sale.getMonthlyTarget() != null) {
                totalTarget = totalTarget.add(sale.getMonthlyTarget());
            }
            orderCount++;
            if (sale.getCustomerName() != null && !sale.getCustomerName().isEmpty()) {
                customers.add(sale.getCustomerName());
            }
            customerCount = customers.size();
        }

        void calculateGrossMargin() {
            if (totalAmount.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal grossProfit = totalAmount.subtract(totalCost);
                grossMargin = grossProfit.divide(totalAmount, 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100"));
            }
        }
    }
}
