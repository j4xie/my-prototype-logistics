package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.smartbi.*;
import com.cretas.aims.entity.smartbi.SmartBiDepartmentData;
import com.cretas.aims.entity.smartbi.SmartBiFinanceData;
import com.cretas.aims.entity.smartbi.SmartBiSalesData;
import com.cretas.aims.entity.smartbi.enums.AlertLevel;
import com.cretas.aims.entity.smartbi.enums.RecommendationType;
import com.cretas.aims.repository.smartbi.SmartBiDepartmentDataRepository;
import com.cretas.aims.repository.smartbi.SmartBiFinanceDataRepository;
import com.cretas.aims.repository.smartbi.SmartBiSalesDataRepository;
import com.cretas.aims.service.smartbi.RecommendationService;
import com.cretas.aims.util.DateRangeUtils;
import com.cretas.aims.util.DateRangeUtils.DateRange;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 推荐和预警服务实现
 *
 * 实现 SmartBI 系统中的智能推荐和预警功能：
 * - 多维度预警生成（销售、财务、部门）
 * - 智能建议生成
 * - 阶梯激励方案计算
 * - AI洞察汇总
 *
 * 所有计算使用 BigDecimal 确保精度，预警阈值从配置文件加载。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecommendationServiceImpl implements RecommendationService {

    private final SmartBiSalesDataRepository salesDataRepository;
    private final SmartBiFinanceDataRepository financeDataRepository;
    private final SmartBiDepartmentDataRepository departmentDataRepository;
    private final ObjectMapper objectMapper;

    // ==================== 计算精度配置 ====================

    private static final int SCALE = 4;
    private static final int DISPLAY_SCALE = 2;
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    // ==================== 默认预警阈值 ====================

    // 销售预警阈值
    private BigDecimal salesCompletionRedThreshold = new BigDecimal("60");
    private BigDecimal salesCompletionYellowThreshold = new BigDecimal("80");
    private BigDecimal salesGrowthRedThreshold = new BigDecimal("-20");
    private BigDecimal salesGrowthYellowThreshold = new BigDecimal("-10");

    // 财务预警阈值
    private int financeAgingRedThreshold = 90;
    private int financeAgingYellowThreshold = 60;
    private BigDecimal financeCostVarianceRedThreshold = new BigDecimal("20");
    private BigDecimal financeCostVarianceYellowThreshold = new BigDecimal("10");
    private BigDecimal financeAmountRedThreshold = new BigDecimal("1000000");
    private BigDecimal financeAmountYellowThreshold = new BigDecimal("500000");

    // 部门预警阈值
    private BigDecimal departmentPerCapitaRedThreshold = new BigDecimal("50000");
    private BigDecimal departmentPerCapitaYellowThreshold = new BigDecimal("80000");

    // ==================== 初始化 ====================

    /**
     * 初始化时加载预警阈值配置
     */
    @PostConstruct
    public void init() {
        loadAlertThresholds();
    }

    /**
     * 从配置文件加载预警阈值
     */
    private void loadAlertThresholds() {
        try {
            ClassPathResource resource = new ClassPathResource("config/smartbi/alert_thresholds.json");
            if (resource.exists()) {
                Map<String, Object> config = objectMapper.readValue(
                        resource.getInputStream(),
                        new TypeReference<Map<String, Object>>() {}
                );
                parseThresholds(config);
                log.info("已加载预警阈值配置");
            } else {
                log.info("使用默认预警阈值配置");
            }
        } catch (IOException e) {
            log.warn("加载预警阈值配置失败，使用默认值: {}", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private void parseThresholds(Map<String, Object> config) {
        try {
            // 销售阈值
            Map<String, Object> sales = (Map<String, Object>) config.get("sales");
            if (sales != null) {
                Map<String, Number> completionRate = (Map<String, Number>) sales.get("completion_rate");
                if (completionRate != null) {
                    salesCompletionRedThreshold = new BigDecimal(completionRate.get("red").toString());
                    salesCompletionYellowThreshold = new BigDecimal(completionRate.get("yellow").toString());
                }
                Map<String, Number> growthRate = (Map<String, Number>) sales.get("growth_rate");
                if (growthRate != null) {
                    salesGrowthRedThreshold = new BigDecimal(growthRate.get("red").toString());
                    salesGrowthYellowThreshold = new BigDecimal(growthRate.get("yellow").toString());
                }
            }

            // 财务阈值
            Map<String, Object> finance = (Map<String, Object>) config.get("finance");
            if (finance != null) {
                Map<String, Number> agingDays = (Map<String, Number>) finance.get("aging_days");
                if (agingDays != null) {
                    financeAgingRedThreshold = agingDays.get("red").intValue();
                    financeAgingYellowThreshold = agingDays.get("yellow").intValue();
                }
                Map<String, Number> costVariance = (Map<String, Number>) finance.get("cost_variance");
                if (costVariance != null) {
                    financeCostVarianceRedThreshold = new BigDecimal(costVariance.get("red").toString());
                    financeCostVarianceYellowThreshold = new BigDecimal(costVariance.get("yellow").toString());
                }
            }

            // 部门阈值
            Map<String, Object> department = (Map<String, Object>) config.get("department");
            if (department != null) {
                Map<String, Number> perCapita = (Map<String, Number>) department.get("per_capita_sales");
                if (perCapita != null) {
                    departmentPerCapitaRedThreshold = new BigDecimal(perCapita.get("red").toString());
                    departmentPerCapitaYellowThreshold = new BigDecimal(perCapita.get("yellow").toString());
                }
            }
        } catch (Exception e) {
            log.warn("解析预警阈值配置失败: {}", e.getMessage());
        }
    }

    // ==================== 预警生成 ====================

    @Override
    @Transactional(readOnly = true)
    public List<Alert> generateSalesAlerts(String factoryId, DateRange range) {
        log.info("生成销售预警: factoryId={}, range={}-{}", factoryId, range.getStartDate(), range.getEndDate());

        List<Alert> alerts = new ArrayList<>();
        List<SmartBiSalesData> salesData = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                factoryId, range.getStartDate(), range.getEndDate());

        if (salesData.isEmpty()) {
            return alerts;
        }

        // 1. 整体目标完成率预警
        BigDecimal totalSales = sumField(salesData, SmartBiSalesData::getAmount);
        BigDecimal totalTarget = sumField(salesData, SmartBiSalesData::getMonthlyTarget);
        BigDecimal completionRate = calculateRate(totalSales, totalTarget);

        if (completionRate.compareTo(salesCompletionRedThreshold) < 0) {
            alerts.add(Alert.salesAlert(
                    AlertLevel.RED,
                    "销售目标严重滞后",
                    String.format("当前完成率仅为 %.1f%%，远低于预期", completionRate),
                    "目标完成率",
                    completionRate,
                    salesCompletionRedThreshold,
                    "建议立即召开销售会议，分析原因并制定追赶计划"
            ));
        } else if (completionRate.compareTo(salesCompletionYellowThreshold) < 0) {
            alerts.add(Alert.salesAlert(
                    AlertLevel.YELLOW,
                    "销售目标需加速",
                    String.format("当前完成率为 %.1f%%，需要加快进度", completionRate),
                    "目标完成率",
                    completionRate,
                    salesCompletionYellowThreshold,
                    "建议加强客户跟进，提高成交转化率"
            ));
        }

        // 2. 环比增长预警
        LocalDate previousStart = range.getStartDate().minusMonths(1);
        LocalDate previousEnd = range.getEndDate().minusMonths(1);
        List<SmartBiSalesData> previousData = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                factoryId, previousStart, previousEnd);

        if (!previousData.isEmpty()) {
            BigDecimal previousSales = sumField(previousData, SmartBiSalesData::getAmount);
            BigDecimal growthRate = calculateGrowthRate(totalSales, previousSales);

            if (growthRate.compareTo(salesGrowthRedThreshold) < 0) {
                alerts.add(Alert.salesAlert(
                        AlertLevel.RED,
                        "销售额大幅下降",
                        String.format("销售额环比下降 %.1f%%，需紧急关注", growthRate.abs()),
                        "环比增长率",
                        growthRate,
                        salesGrowthRedThreshold,
                        "建议分析下降原因，检查是否存在市场变化或竞争加剧"
                ));
            } else if (growthRate.compareTo(salesGrowthYellowThreshold) < 0) {
                alerts.add(Alert.salesAlert(
                        AlertLevel.YELLOW,
                        "销售额有所下降",
                        String.format("销售额环比下降 %.1f%%，需关注趋势", growthRate.abs()),
                        "环比增长率",
                        growthRate,
                        salesGrowthYellowThreshold,
                        "建议分析原因，制定应对措施"
                ));
            }
        }

        // 3. 销售员个人预警
        Map<String, BigDecimal> salespersonSales = salesData.stream()
                .filter(d -> d.getSalespersonName() != null)
                .collect(Collectors.groupingBy(
                        SmartBiSalesData::getSalespersonName,
                        Collectors.reducing(BigDecimal.ZERO, SmartBiSalesData::getAmount, BigDecimal::add)
                ));

        Map<String, BigDecimal> salespersonTargets = salesData.stream()
                .filter(d -> d.getSalespersonName() != null)
                .collect(Collectors.groupingBy(
                        SmartBiSalesData::getSalespersonName,
                        Collectors.reducing(BigDecimal.ZERO,
                                d -> d.getMonthlyTarget() != null ? d.getMonthlyTarget() : BigDecimal.ZERO,
                                BigDecimal::add)
                ));

        for (Map.Entry<String, BigDecimal> entry : salespersonSales.entrySet()) {
            String name = entry.getKey();
            BigDecimal sales = entry.getValue();
            BigDecimal target = salespersonTargets.getOrDefault(name, BigDecimal.ZERO);
            BigDecimal rate = calculateRate(sales, target);

            if (rate.compareTo(salesCompletionRedThreshold) < 0) {
                alerts.add(Alert.builder()
                        .level(AlertLevel.RED)
                        .category("sales")
                        .title(String.format("销售员 %s 业绩预警", name))
                        .message(String.format("%s 目标完成率仅为 %.1f%%", name, rate))
                        .metric("个人完成率")
                        .value(rate)
                        .threshold(salesCompletionRedThreshold)
                        .relatedEntityName(name)
                        .suggestion("建议一对一沟通，了解困难并提供支持")
                        .build());
            }
        }

        return alerts;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Alert> generateFinanceAlerts(String factoryId, DateRange range) {
        log.info("生成财务预警: factoryId={}, range={}-{}", factoryId, range.getStartDate(), range.getEndDate());

        List<Alert> alerts = new ArrayList<>();
        List<SmartBiFinanceData> financeData = financeDataRepository.findByFactoryIdAndRecordDateBetween(
                factoryId, range.getStartDate(), range.getEndDate());

        if (financeData.isEmpty()) {
            return alerts;
        }

        // 1. 应收账款账龄预警
        for (SmartBiFinanceData data : financeData) {
            if (data.getReceivableAmount() != null && data.getReceivableAmount().compareTo(BigDecimal.ZERO) > 0) {
                int agingDays = data.getAgingDays() != null ? data.getAgingDays() : 0;
                BigDecimal amount = data.getReceivableAmount();

                if (agingDays > financeAgingRedThreshold) {
                    alerts.add(Alert.financeAlert(
                            AlertLevel.RED,
                            "应收账款严重逾期",
                            String.format("客户 %s 应收款 %.2f 元已逾期 %d 天",
                                    data.getCustomerName(), amount, agingDays),
                            "账龄天数",
                            new BigDecimal(agingDays),
                            new BigDecimal(financeAgingRedThreshold),
                            "建议立即联系客户催收，必要时采取法律手段"
                    ));
                } else if (agingDays > financeAgingYellowThreshold) {
                    alerts.add(Alert.financeAlert(
                            AlertLevel.YELLOW,
                            "应收账款即将逾期",
                            String.format("客户 %s 应收款 %.2f 元账龄已达 %d 天",
                                    data.getCustomerName(), amount, agingDays),
                            "账龄天数",
                            new BigDecimal(agingDays),
                            new BigDecimal(financeAgingYellowThreshold),
                            "建议跟进客户付款计划，发送催款提醒"
                    ));
                }
            }
        }

        // 2. 成本超支预警
        BigDecimal totalBudget = sumField(financeData, SmartBiFinanceData::getBudgetAmount);
        BigDecimal totalActual = sumField(financeData, SmartBiFinanceData::getActualAmount);

        if (totalBudget.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal variance = calculateGrowthRate(totalActual, totalBudget);

            if (variance.compareTo(financeCostVarianceRedThreshold) > 0) {
                alerts.add(Alert.financeAlert(
                        AlertLevel.RED,
                        "成本严重超支",
                        String.format("实际支出超预算 %.1f%%，需严格控制", variance),
                        "预算偏差率",
                        variance,
                        financeCostVarianceRedThreshold,
                        "建议立即审查各项支出，暂停非必要开支"
                ));
            } else if (variance.compareTo(financeCostVarianceYellowThreshold) > 0) {
                alerts.add(Alert.financeAlert(
                        AlertLevel.YELLOW,
                        "成本有所超支",
                        String.format("实际支出超预算 %.1f%%，需关注", variance),
                        "预算偏差率",
                        variance,
                        financeCostVarianceYellowThreshold,
                        "建议优化支出结构，控制成本增长"
                ));
            }
        }

        // 3. 大额应收预警
        BigDecimal totalReceivable = sumField(financeData, SmartBiFinanceData::getReceivableAmount);
        if (totalReceivable.compareTo(financeAmountRedThreshold) > 0) {
            alerts.add(Alert.financeAlert(
                    AlertLevel.RED,
                    "应收账款总额过高",
                    String.format("应收账款总额达 %.2f 元，资金压力大", totalReceivable),
                    "应收总额",
                    totalReceivable,
                    financeAmountRedThreshold,
                    "建议制定催收计划，加速资金回笼"
            ));
        } else if (totalReceivable.compareTo(financeAmountYellowThreshold) > 0) {
            alerts.add(Alert.financeAlert(
                    AlertLevel.YELLOW,
                    "应收账款总额较高",
                    String.format("应收账款总额达 %.2f 元，需关注回款", totalReceivable),
                    "应收总额",
                    totalReceivable,
                    financeAmountYellowThreshold,
                    "建议加强应收账款管理，定期跟进回款"
            ));
        }

        return alerts;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Alert> generateDepartmentAlerts(String factoryId, DateRange range) {
        log.info("生成部门预警: factoryId={}, range={}-{}", factoryId, range.getStartDate(), range.getEndDate());

        List<Alert> alerts = new ArrayList<>();
        List<SmartBiDepartmentData> departmentData = departmentDataRepository.findByFactoryIdAndRecordDateBetween(
                factoryId, range.getStartDate(), range.getEndDate());

        if (departmentData.isEmpty()) {
            return alerts;
        }

        // 按部门分组
        Map<String, List<SmartBiDepartmentData>> byDepartment = departmentData.stream()
                .filter(d -> d.getDepartment() != null)
                .collect(Collectors.groupingBy(SmartBiDepartmentData::getDepartment));

        for (Map.Entry<String, List<SmartBiDepartmentData>> entry : byDepartment.entrySet()) {
            String deptName = entry.getKey();
            List<SmartBiDepartmentData> deptData = entry.getValue();

            BigDecimal totalSales = sumField(deptData, SmartBiDepartmentData::getSalesAmount);
            int headcount = deptData.stream()
                    .mapToInt(d -> d.getHeadcount() != null ? d.getHeadcount() : 0)
                    .max()
                    .orElse(1);

            if (headcount > 0) {
                BigDecimal perCapita = totalSales.divide(new BigDecimal(headcount), SCALE, ROUNDING_MODE);

                if (perCapita.compareTo(departmentPerCapitaRedThreshold) < 0) {
                    alerts.add(Alert.departmentAlert(
                            AlertLevel.RED,
                            String.format("%s 人均产出过低", deptName),
                            String.format("%s 人均销售额仅为 %.2f 元，严重低于标准", deptName, perCapita),
                            "人均产出",
                            perCapita,
                            departmentPerCapitaRedThreshold,
                            "建议分析人员效能，考虑调整人员配置或加强培训"
                    ));
                } else if (perCapita.compareTo(departmentPerCapitaYellowThreshold) < 0) {
                    alerts.add(Alert.departmentAlert(
                            AlertLevel.YELLOW,
                            String.format("%s 人均产出偏低", deptName),
                            String.format("%s 人均销售额为 %.2f 元，低于期望", deptName, perCapita),
                            "人均产出",
                            perCapita,
                            departmentPerCapitaYellowThreshold,
                            "建议提升人员效率，优化工作流程"
                    ));
                }
            }
        }

        return alerts;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Alert> generateAllAlerts(String factoryId, DateRange range) {
        log.info("生成综合预警: factoryId={}", factoryId);

        List<Alert> allAlerts = new ArrayList<>();
        allAlerts.addAll(generateSalesAlerts(factoryId, range));
        allAlerts.addAll(generateFinanceAlerts(factoryId, range));
        allAlerts.addAll(generateDepartmentAlerts(factoryId, range));

        // 按严重程度降序排序
        allAlerts.sort((a, b) -> {
            int severityA = a.getLevel() != null ? a.getLevel().getSeverity() : 0;
            int severityB = b.getLevel() != null ? b.getLevel().getSeverity() : 0;
            return Integer.compare(severityB, severityA);
        });

        return allAlerts;
    }

    // ==================== 建议生成 ====================

    @Override
    @Transactional(readOnly = true)
    public List<Recommendation> generateRecommendations(String factoryId, String analysisType) {
        log.info("生成建议: factoryId={}, type={}", factoryId, analysisType);

        DateRange range = DateRangeUtils.rangeByPeriod("month");
        List<Recommendation> recommendations = new ArrayList<>();

        switch (analysisType != null ? analysisType.toLowerCase() : "all") {
            case "sales":
                recommendations.addAll(generateSalesRecommendations(factoryId, range));
                break;
            case "finance":
                recommendations.addAll(generateCostRecommendations(factoryId, range));
                break;
            case "customer":
                recommendations.addAll(generateCustomerRecommendations(factoryId, range));
                break;
            case "all":
            default:
                recommendations.addAll(generateSalesRecommendations(factoryId, range));
                recommendations.addAll(generateCostRecommendations(factoryId, range));
                recommendations.addAll(generateCustomerRecommendations(factoryId, range));
                break;
        }

        // 按优先级排序
        recommendations.sort(Comparator.comparingInt(Recommendation::getPriority));

        return recommendations;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Recommendation> generateSalesRecommendations(String factoryId, DateRange range) {
        List<Recommendation> recommendations = new ArrayList<>();
        List<SmartBiSalesData> salesData = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                factoryId, range.getStartDate(), range.getEndDate());

        if (salesData.isEmpty()) {
            return recommendations;
        }

        // 分析产品集中度
        Map<String, BigDecimal> productSales = salesData.stream()
                .filter(d -> d.getProductCategory() != null)
                .collect(Collectors.groupingBy(
                        SmartBiSalesData::getProductCategory,
                        Collectors.reducing(BigDecimal.ZERO, SmartBiSalesData::getAmount, BigDecimal::add)
                ));

        BigDecimal totalSales = productSales.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        if (totalSales.compareTo(BigDecimal.ZERO) > 0) {
            Optional<BigDecimal> topProduct = productSales.values().stream().max(BigDecimal::compareTo);
            if (topProduct.isPresent()) {
                BigDecimal concentration = topProduct.get().divide(totalSales, SCALE, ROUNDING_MODE)
                        .multiply(new BigDecimal("100"));
                if (concentration.compareTo(new BigDecimal("60")) > 0) {
                    recommendations.add(Recommendation.builder()
                            .type(RecommendationType.PRODUCT_FOCUS)
                            .title("优化产品结构")
                            .description(String.format("单一产品占比达 %.1f%%，建议分散风险", concentration))
                            .priority(2)
                            .impact("降低对单一产品的依赖，提高业务稳定性")
                            .actionItems(Arrays.asList(
                                    "分析其他产品的市场潜力",
                                    "制定新产品推广计划",
                                    "对销售团队进行产品培训"
                            ))
                            .build());
                }
            }
        }

        // 分析销售员效能差异
        Map<String, BigDecimal> salespersonSales = salesData.stream()
                .filter(d -> d.getSalespersonName() != null)
                .collect(Collectors.groupingBy(
                        SmartBiSalesData::getSalespersonName,
                        Collectors.reducing(BigDecimal.ZERO, SmartBiSalesData::getAmount, BigDecimal::add)
                ));

        if (salespersonSales.size() > 1) {
            BigDecimal max = salespersonSales.values().stream().max(BigDecimal::compareTo).orElse(BigDecimal.ZERO);
            BigDecimal min = salespersonSales.values().stream().min(BigDecimal::compareTo).orElse(BigDecimal.ZERO);
            BigDecimal avg = totalSales.divide(new BigDecimal(salespersonSales.size()), SCALE, ROUNDING_MODE);

            if (max.compareTo(BigDecimal.ZERO) > 0 && min.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal variance = max.divide(min, SCALE, ROUNDING_MODE);
                if (variance.compareTo(new BigDecimal("3")) > 0) {
                    String topSeller = salespersonSales.entrySet().stream()
                            .max(Map.Entry.comparingByValue())
                            .map(Map.Entry::getKey)
                            .orElse("");

                    recommendations.add(Recommendation.builder()
                            .type(RecommendationType.SALES_IMPROVEMENT)
                            .title("缩小销售团队业绩差距")
                            .description("销售员业绩差异较大，建议加强团队协作")
                            .priority(1)
                            .impact("提升团队整体销售能力，增加总销售额")
                            .actionItems(Arrays.asList(
                                    String.format("安排销冠 %s 分享成功经验", topSeller),
                                    "对业绩落后人员进行一对一辅导",
                                    "建立销售技能提升计划"
                            ))
                            .build());
                }
            }
        }

        return recommendations;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Recommendation> generateCostRecommendations(String factoryId, DateRange range) {
        List<Recommendation> recommendations = new ArrayList<>();
        List<SmartBiFinanceData> financeData = financeDataRepository.findByFactoryIdAndRecordDateBetween(
                factoryId, range.getStartDate(), range.getEndDate());

        if (financeData.isEmpty()) {
            return recommendations;
        }

        // 分析成本结构
        BigDecimal materialCost = sumField(financeData, SmartBiFinanceData::getMaterialCost);
        BigDecimal laborCost = sumField(financeData, SmartBiFinanceData::getLaborCost);
        BigDecimal overheadCost = sumField(financeData, SmartBiFinanceData::getOverheadCost);
        BigDecimal totalCost = materialCost.add(laborCost).add(overheadCost);

        if (totalCost.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal materialRatio = materialCost.divide(totalCost, SCALE, ROUNDING_MODE)
                    .multiply(new BigDecimal("100"));
            if (materialRatio.compareTo(new BigDecimal("60")) > 0) {
                recommendations.add(Recommendation.builder()
                        .type(RecommendationType.COST_REDUCTION)
                        .title("优化原材料成本")
                        .description(String.format("原材料成本占比达 %.1f%%，建议优化采购", materialRatio))
                        .priority(2)
                        .impact("降低原材料成本，提高利润率")
                        .actionItems(Arrays.asList(
                                "寻找替代供应商进行比价",
                                "与现有供应商谈判优惠价格",
                                "优化库存管理减少损耗"
                        ))
                        .build());
            }
        }

        return recommendations;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Recommendation> generateCustomerRecommendations(String factoryId, DateRange range) {
        List<Recommendation> recommendations = new ArrayList<>();
        List<SmartBiSalesData> salesData = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                factoryId, range.getStartDate(), range.getEndDate());

        if (salesData.isEmpty()) {
            return recommendations;
        }

        // 分析客户集中度
        Map<String, BigDecimal> customerSales = salesData.stream()
                .filter(d -> d.getCustomerName() != null)
                .collect(Collectors.groupingBy(
                        SmartBiSalesData::getCustomerName,
                        Collectors.reducing(BigDecimal.ZERO, SmartBiSalesData::getAmount, BigDecimal::add)
                ));

        BigDecimal totalSales = customerSales.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        if (totalSales.compareTo(BigDecimal.ZERO) > 0 && !customerSales.isEmpty()) {
            // Top 3 客户占比
            List<BigDecimal> topValues = customerSales.values().stream()
                    .sorted(Comparator.reverseOrder())
                    .limit(3)
                    .collect(Collectors.toList());
            BigDecimal topSum = topValues.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal topRatio = topSum.divide(totalSales, SCALE, ROUNDING_MODE)
                    .multiply(new BigDecimal("100"));

            if (topRatio.compareTo(new BigDecimal("50")) > 0) {
                recommendations.add(Recommendation.builder()
                        .type(RecommendationType.CUSTOMER_RETENTION)
                        .title("加强核心客户维护")
                        .description(String.format("Top 3 客户贡献 %.1f%% 销售额，需重点维护", topRatio))
                        .priority(1)
                        .impact("稳定核心客户，降低客户流失风险")
                        .actionItems(Arrays.asList(
                                "为核心客户制定专属服务方案",
                                "定期进行客户满意度调研",
                                "安排高层拜访加强合作关系"
                        ))
                        .build());
            }

            // 小客户开发建议
            long smallCustomerCount = customerSales.values().stream()
                    .filter(v -> v.compareTo(new BigDecimal("10000")) < 0)
                    .count();
            if (smallCustomerCount > customerSales.size() / 2) {
                recommendations.add(Recommendation.builder()
                        .type(RecommendationType.REGION_EXPANSION)
                        .title("发展中大型客户")
                        .description("小客户占比过高，建议拓展中大型客户")
                        .priority(2)
                        .impact("提高客单价，提升运营效率")
                        .actionItems(Arrays.asList(
                                "识别潜在中大型客户目标",
                                "制定针对性的销售策略",
                                "安排专人负责大客户开发"
                        ))
                        .build());
            }
        }

        return recommendations;
    }

    // ==================== 激励方案生成 ====================

    @Override
    @Transactional(readOnly = true)
    public IncentivePlan generateIncentivePlan(String factoryId, String targetType) {
        log.info("生成激励方案: factoryId={}, targetType={}", factoryId, targetType);

        DateRange range = DateRangeUtils.rangeByPeriod("month");

        switch (targetType != null ? targetType.toLowerCase() : "salesperson") {
            case "department":
                // 获取第一个部门
                List<SmartBiDepartmentData> deptData = departmentDataRepository.findByFactoryIdAndRecordDateBetween(
                        factoryId, range.getStartDate(), range.getEndDate());
                if (!deptData.isEmpty()) {
                    String deptId = deptData.get(0).getDepartment();
                    return generateDepartmentIncentivePlan(factoryId, deptId, range);
                }
                break;
            case "salesperson":
            default:
                // 获取第一个销售员
                List<SmartBiSalesData> salesData = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                        factoryId, range.getStartDate(), range.getEndDate());
                if (!salesData.isEmpty()) {
                    String salespersonId = salesData.stream()
                            .filter(d -> d.getSalespersonName() != null)
                            .map(SmartBiSalesData::getSalespersonName)
                            .findFirst()
                            .orElse("未知");
                    return generateSalespersonIncentivePlan(factoryId, salespersonId, range);
                }
                break;
        }

        // 返回空方案
        return IncentivePlan.builder()
                .targetType(targetType)
                .motivationalMessage("暂无可用数据生成激励方案")
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public IncentivePlan generateSalespersonIncentivePlan(String factoryId, String salespersonId, DateRange range) {
        log.info("生成销售员激励方案: salesperson={}", salespersonId);

        List<SmartBiSalesData> salesData = salesDataRepository.findByFactoryIdAndOrderDateBetween(
                factoryId, range.getStartDate(), range.getEndDate())
                .stream()
                .filter(d -> salespersonId.equals(d.getSalespersonName()))
                .collect(Collectors.toList());

        BigDecimal currentSales = sumField(salesData, SmartBiSalesData::getAmount);
        BigDecimal target = sumField(salesData, SmartBiSalesData::getMonthlyTarget);
        if (target.compareTo(BigDecimal.ZERO) == 0) {
            target = new BigDecimal("100000"); // 默认目标
        }

        IncentivePlan plan = IncentivePlan.forSalesperson(salespersonId, salespersonId, currentSales, target);

        // 添加阶梯奖励
        plan.addLevel(IncentiveLevel.ofCompletionRate("铜牌", new BigDecimal("60"), new BigDecimal("80"),
                new BigDecimal("500")));
        plan.addLevel(IncentiveLevel.ofCompletionRate("银牌", new BigDecimal("80"), new BigDecimal("100"),
                new BigDecimal("1000")));
        plan.addLevel(IncentiveLevel.ofCompletionRate("金牌", new BigDecimal("100"), new BigDecimal("120"),
                new BigDecimal("2000")));
        plan.addLevel(IncentiveLevel.ofCompletionRate("钻石", new BigDecimal("120"), null,
                new BigDecimal("5000")));

        plan.updateCurrentLevel();
        plan.generateMotivationalMessage();

        return plan;
    }

    @Override
    @Transactional(readOnly = true)
    public IncentivePlan generateDepartmentIncentivePlan(String factoryId, String departmentId, DateRange range) {
        log.info("生成部门激励方案: department={}", departmentId);

        List<SmartBiDepartmentData> deptData = departmentDataRepository.findByFactoryIdAndRecordDateBetween(
                factoryId, range.getStartDate(), range.getEndDate())
                .stream()
                .filter(d -> departmentId.equals(d.getDepartment()))
                .collect(Collectors.toList());

        BigDecimal currentSales = sumField(deptData, SmartBiDepartmentData::getSalesAmount);
        BigDecimal target = sumField(deptData, SmartBiDepartmentData::getSalesTarget);
        if (target.compareTo(BigDecimal.ZERO) == 0) {
            target = new BigDecimal("500000"); // 默认目标
        }

        IncentivePlan plan = IncentivePlan.forDepartment(departmentId, departmentId, currentSales, target);

        // 添加阶梯奖励
        plan.addLevel(IncentiveLevel.ofCompletionRate("达标", new BigDecimal("80"), new BigDecimal("100"),
                new BigDecimal("5000")));
        plan.addLevel(IncentiveLevel.ofCompletionRate("优秀", new BigDecimal("100"), new BigDecimal("120"),
                new BigDecimal("10000")));
        plan.addLevel(IncentiveLevel.ofCompletionRate("卓越", new BigDecimal("120"), null,
                new BigDecimal("20000")));

        plan.updateCurrentLevel();
        plan.generateMotivationalMessage();

        return plan;
    }

    // ==================== 预警级别计算 ====================

    @Override
    public AlertLevel calculateSalespersonAlertLevel(BigDecimal completionRate, BigDecimal growthRate) {
        if (completionRate == null) {
            completionRate = BigDecimal.ZERO;
        }
        if (growthRate == null) {
            growthRate = BigDecimal.ZERO;
        }

        // 检查红色预警条件
        if (completionRate.compareTo(salesCompletionRedThreshold) < 0 ||
            growthRate.compareTo(salesGrowthRedThreshold) < 0) {
            return AlertLevel.RED;
        }

        // 检查黄色预警条件
        if (completionRate.compareTo(salesCompletionYellowThreshold) < 0 ||
            growthRate.compareTo(salesGrowthYellowThreshold) < 0) {
            return AlertLevel.YELLOW;
        }

        return AlertLevel.GREEN;
    }

    @Override
    public AlertLevel calculateReceivableAlertLevel(int agingDays, BigDecimal amount) {
        if (amount == null) {
            amount = BigDecimal.ZERO;
        }

        // 检查红色预警条件
        if (agingDays > financeAgingRedThreshold ||
            amount.compareTo(financeAmountRedThreshold) > 0) {
            return AlertLevel.RED;
        }

        // 检查黄色预警条件
        if (agingDays > financeAgingYellowThreshold ||
            amount.compareTo(financeAmountYellowThreshold) > 0) {
            return AlertLevel.YELLOW;
        }

        return AlertLevel.GREEN;
    }

    @Override
    public AlertLevel calculateCostAlertLevel(BigDecimal costRate, BigDecimal budgetVariance) {
        if (budgetVariance == null) {
            budgetVariance = BigDecimal.ZERO;
        }

        // 检查红色预警条件
        if (budgetVariance.compareTo(financeCostVarianceRedThreshold) > 0) {
            return AlertLevel.RED;
        }

        // 检查黄色预警条件
        if (budgetVariance.compareTo(financeCostVarianceYellowThreshold) > 0) {
            return AlertLevel.YELLOW;
        }

        return AlertLevel.GREEN;
    }

    @Override
    public AlertLevel calculatePerCapitaAlertLevel(BigDecimal perCapitaSales) {
        if (perCapitaSales == null) {
            perCapitaSales = BigDecimal.ZERO;
        }

        // 检查红色预警条件
        if (perCapitaSales.compareTo(departmentPerCapitaRedThreshold) < 0) {
            return AlertLevel.RED;
        }

        // 检查黄色预警条件
        if (perCapitaSales.compareTo(departmentPerCapitaYellowThreshold) < 0) {
            return AlertLevel.YELLOW;
        }

        return AlertLevel.GREEN;
    }

    // ==================== AI洞察生成 ====================

    @Override
    public List<AIInsight> generateInsightSummary(DashboardResponse dashboard) {
        List<AIInsight> insights = new ArrayList<>();

        if (dashboard == null) {
            return insights;
        }

        // 从现有的 AI 洞察中提取
        if (dashboard.getAiInsights() != null) {
            insights.addAll(dashboard.getAiInsights());
        }

        // 从 KPI 卡片中分析异常
        if (dashboard.getKpiCards() != null) {
            for (KPICard kpi : dashboard.getKpiCards()) {
                if ("red".equalsIgnoreCase(kpi.getStatus())) {
                    insights.add(AIInsight.builder()
                            .level("RED")
                            .category("KPI异常")
                            .message(String.format("%s 当前值 %s，需要关注",
                                    kpi.getTitle(), kpi.getValue()))
                            .actionSuggestion("建议分析原因并采取改进措施")
                            .build());
                }
            }
        }

        // 按严重程度排序
        insights.sort((a, b) -> {
            int severityA = getLevelSeverity(a.getLevel());
            int severityB = getLevelSeverity(b.getLevel());
            return Integer.compare(severityB, severityA);
        });

        return insights;
    }

    @Override
    public List<AIInsight> generateInsightsFromAlerts(List<Alert> alerts) {
        if (alerts == null || alerts.isEmpty()) {
            return Collections.emptyList();
        }

        return alerts.stream()
                .map(alert -> AIInsight.builder()
                        .level(alert.getLevelName())
                        .category(alert.getCategory())
                        .message(alert.getMessage())
                        .relatedEntity(alert.getRelatedEntityName())
                        .actionSuggestion(alert.getSuggestion())
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    public List<AIInsight> generateInsightsFromRecommendations(List<Recommendation> recommendations) {
        if (recommendations == null || recommendations.isEmpty()) {
            return Collections.emptyList();
        }

        return recommendations.stream()
                .map(rec -> AIInsight.builder()
                        .level(rec.isHighPriority() ? "YELLOW" : "INFO")
                        .category(rec.getTypeName())
                        .message(rec.getTitle() + ": " + rec.getDescription())
                        .actionSuggestion(rec.getActionItems() != null && !rec.getActionItems().isEmpty()
                                ? rec.getActionItems().get(0)
                                : rec.getImpact())
                        .build())
                .collect(Collectors.toList());
    }

    // ==================== 工具方法 ====================

    /**
     * 字段求和
     */
    private <T> BigDecimal sumField(List<T> data,
                                     java.util.function.Function<T, BigDecimal> extractor) {
        return data.stream()
                .map(extractor)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * 计算比率
     */
    private BigDecimal calculateRate(BigDecimal actual, BigDecimal target) {
        if (target == null || target.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return actual.divide(target, SCALE, ROUNDING_MODE).multiply(new BigDecimal("100"));
    }

    /**
     * 计算增长率
     */
    private BigDecimal calculateGrowthRate(BigDecimal current, BigDecimal previous) {
        if (previous == null || previous.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return current.subtract(previous)
                .divide(previous, SCALE, ROUNDING_MODE)
                .multiply(new BigDecimal("100"));
    }

    /**
     * 获取级别严重程度
     */
    private int getLevelSeverity(String level) {
        if (level == null) return 0;
        switch (level.toUpperCase()) {
            case "CRITICAL": return 4;
            case "RED": return 3;
            case "YELLOW": return 2;
            case "INFO": return 1;
            case "GREEN": return 0;
            default: return 0;
        }
    }
}
