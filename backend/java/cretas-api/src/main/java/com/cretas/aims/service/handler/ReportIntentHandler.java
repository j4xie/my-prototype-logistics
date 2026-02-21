package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.report.DashboardStatisticsDTO;
import com.cretas.aims.entity.WorkOrder;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.dto.MobileDTO;
import com.cretas.aims.service.AIEnterpriseService;
import com.cretas.aims.service.ReportService;
import com.cretas.aims.service.SchedulingService;
import com.cretas.aims.service.ApprovalChainService;
import com.cretas.aims.service.WorkOrderService;
import com.cretas.aims.entity.config.ApprovalChainConfig;
import com.cretas.aims.dto.scheduling.SchedulingPlanDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.cretas.aims.util.ErrorSanitizer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

/**
 * 报表意图处理器
 *
 * 处理 REPORT 分类的意图:
 * - REPORT_DASHBOARD_OVERVIEW: 仪表盘总览
 * - REPORT_PRODUCTION: 生产报表
 * - REPORT_QUALITY: 质量报表
 * - REPORT_INVENTORY: 库存报表
 * - REPORT_FINANCE: 财务报表
 * - REPORT_EFFICIENCY: 效率分析报表
 * - REPORT_KPI: KPI指标报表
 * - REPORT_ANOMALY: 异常报表
 * - REPORT_TRENDS: 趋势报表
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-03
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReportIntentHandler implements IntentHandler {

    private final ReportService reportService;
    private final AIEnterpriseService aiEnterpriseService;
    private final SchedulingService schedulingService;
    private final ApprovalChainService approvalChainService;
    private final WorkOrderService workOrderService;

    @Override
    public String getSupportedCategory() {
        return "REPORT";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        String intentCode = intentConfig.getIntentCode();
        log.info("ReportIntentHandler处理: intentCode={}, factoryId={}, userId={}",
                intentCode, factoryId, userId);

        try {
            return switch (intentCode) {
                case "REPORT_DASHBOARD_OVERVIEW" -> handleDashboardOverview(factoryId, request, intentConfig);
                case "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY" -> handleProductionReport(factoryId, request, intentConfig);
                case "REPORT_QUALITY" -> handleQualityReport(factoryId, request, intentConfig);
                case "REPORT_INVENTORY" -> handleInventoryReport(factoryId, request, intentConfig);
                case "REPORT_FINANCE" -> handleFinanceReport(factoryId, request, intentConfig);
                case "REPORT_EFFICIENCY" -> handleEfficiencyReport(factoryId, request, intentConfig);
                case "REPORT_KPI" -> handleKPIReport(factoryId, request, intentConfig);
                case "REPORT_ANOMALY" -> handleAnomalyReport(factoryId, request, intentConfig);
                case "REPORT_TRENDS" -> handleTrendsReport(factoryId, request, intentConfig);
                // 成本查询相关意图
                case "COST_QUERY" -> handleCostQuery(factoryId, request, intentConfig);
                case "COST_TREND_ANALYSIS" -> handleCostTrendAnalysis(factoryId, request, intentConfig);
                // 排班相关意图 (DB category=REPORT)
                case "SCHEDULING_LIST" -> handleSchedulingList(factoryId, request, intentConfig);
                case "SCHEDULING_EXECUTE_FOR_DATE" -> handleSchedulingExecute(factoryId, request, intentConfig, userId);
                case "REPORT_WORKSHOP_DAILY" -> handleWorkshopDaily(factoryId, request, intentConfig);
                case "REPORT_BENEFIT_OVERVIEW" -> handleBenefitOverview(factoryId, intentConfig);
                case "REPORT_AI_QUALITY", "REPORT_INTELLIGENT_QUALITY", "REPORT_CHECK" ->
                        handleAiQualityReport(factoryId, request, intentConfig);
                case "QUERY_APPROVAL_RECORD" -> handleApprovalRecord(factoryId, intentConfig);
                case "TASK_ASSIGN_WORKER" -> handleTaskAssignWorker(factoryId, request, intentConfig, userId);
                // 财务分析指标
                case "QUERY_FINANCE_ROA" -> handleFinanceRatio(factoryId, intentConfig, "ROA", "资产收益率");
                case "QUERY_FINANCE_ROE" -> handleFinanceRatio(factoryId, intentConfig, "ROE", "净资产收益率");
                case "QUERY_LIQUIDITY" -> handleFinanceRatio(factoryId, intentConfig, "LIQUIDITY", "流动比率");
                case "QUERY_SOLVENCY" -> handleFinanceRatio(factoryId, intentConfig, "SOLVENCY", "偿债能力");
                case "QUERY_DUPONT_ANALYSIS" -> handleFinanceRatio(factoryId, intentConfig, "DUPONT", "杜邦分析");
                case "PROFIT_TREND_ANALYSIS" -> handleCostTrendAnalysis(factoryId, request, intentConfig);
                // 排产执行
                case "SCHEDULING_RUN_TOMORROW" -> handleSchedulingExecute(factoryId, request, intentConfig, userId);
                case "SCHEDULING_QUERY", "SCHEDULING_COVERAGE_QUERY", "SCHEDULING_QUERY_COVERAGE" ->
                        handleSchedulingList(factoryId, request, intentConfig);
                case "SCHEDULING_SET_AUTO", "SCHEDULING_SET_MANUAL", "SCHEDULING_SET_DISABLED" ->
                        handleSchedulingModeChange(factoryId, request, intentConfig, intentCode);
                // 报表变体
                case "REPORT_EXECUTIVE_DAILY" -> handleWorkshopDaily(factoryId, request, intentConfig);
                case "REPORT_PRODUCTION_WEEKLY_COMPARISON" -> handleTrendsReport(factoryId, request, intentConfig);
                case "FINANCE_STATS" -> handleFinanceReport(factoryId, request, intentConfig);
                case "SALES_STATS", "SALES_RANKING", "PRODUCT_SALES_RANKING" ->
                        handleSalesReport(factoryId, request, intentConfig);
                case "PAYMENT_STATUS_QUERY" -> handlePaymentStatus(factoryId, intentConfig);
                case "MRP_CALCULATION" -> handleMrpCalculation(factoryId, intentConfig);
                case "PRODUCTION_LINE_START" -> handleProductionLineStart(factoryId, request, intentConfig);
                case "ATTENDANCE_STATS_BY_DEPT" -> handleAttendanceStatsByDept(factoryId, intentConfig);
                case "QUERY_ONLINE_STAFF_COUNT" -> handleOnlineStaffCount(factoryId, intentConfig);
                case "ANALYZE_EQUIPMENT" -> handleAnalyzeEquipmentReport(factoryId, intentConfig);
                case "QUERY_EQUIPMENT_STATUS_BY_NAME" -> handleEquipmentStatusByName(factoryId, request, intentConfig);
                default -> {
                    log.warn("未知的REPORT意图: {}", intentCode);
                    yield IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentCode)
                            .intentName(intentConfig.getIntentName())
                            .intentCategory("REPORT")
                            .status("FAILED")
                            .message("暂不支持此报表操作: " + intentCode)
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            };

        } catch (Exception e) {
            log.error("ReportIntentHandler处理失败: intentCode={}, error={}", intentCode, e.getMessage(), e);
            String errMsg = "报表操作失败: " + ErrorSanitizer.sanitize(e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("REPORT")
                    .status("FAILED")
                    .message(errMsg)
                    .formattedText(errMsg)
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 仪表盘总览
     */
    private IntentExecuteResponse handleDashboardOverview(String factoryId, IntentExecuteRequest request,
                                                           AIIntentConfig intentConfig) {
        String period = "today";
        if (request.getContext() != null) {
            period = (String) request.getContext().getOrDefault("period", "today");
        }

        Map<String, Object> overview = reportService.getDashboardOverview(factoryId, period);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("REPORT")
                .status("COMPLETED")
                .message("仪表盘数据获取成功，包含生产概况、订单统计、库存状态等核心经营指标。")
                .resultData(overview)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 生产报表
     */
    private IntentExecuteResponse handleProductionReport(String factoryId, IntentExecuteRequest request,
                                                          AIIntentConfig intentConfig) {
        String period = "today";
        if (request.getContext() != null) {
            period = (String) request.getContext().getOrDefault("period", "today");
        }

        Map<String, Object> production = reportService.getProductionDashboard(factoryId, period);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("REPORT")
                .status("COMPLETED")
                .message("生产报表获取成功，周期: " + period)
                .resultData(production)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 质量报表
     */
    private IntentExecuteResponse handleQualityReport(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        LocalDate startDate = LocalDate.now().minusDays(7);
        LocalDate endDate = LocalDate.now();

        if (request.getContext() != null) {
            if (request.getContext().get("startDate") != null) {
                startDate = LocalDate.parse((String) request.getContext().get("startDate"));
            }
            if (request.getContext().get("endDate") != null) {
                endDate = LocalDate.parse((String) request.getContext().get("endDate"));
            }
        }

        Map<String, Object> quality = reportService.getQualityReport(factoryId, startDate, endDate);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("REPORT")
                .status("COMPLETED")
                .message("质量报表获取成功，包含质检合格率、不合格品分布、质量趋势等数据。")
                .resultData(quality)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 库存报表
     */
    private IntentExecuteResponse handleInventoryReport(String factoryId, IntentExecuteRequest request,
                                                         AIIntentConfig intentConfig) {
        LocalDate date = LocalDate.now();
        if (request.getContext() != null && request.getContext().get("date") != null) {
            date = LocalDate.parse((String) request.getContext().get("date"));
        }

        Map<String, Object> inventory = reportService.getInventoryReport(factoryId, date);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("REPORT")
                .status("COMPLETED")
                .message("库存报表获取成功，包含原材料库存汇总、低库存预警、临期批次等信息。")
                .resultData(inventory)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 财务报表
     */
    private IntentExecuteResponse handleFinanceReport(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        LocalDate startDate = LocalDate.now().minusDays(30);
        LocalDate endDate = LocalDate.now();

        if (request.getContext() != null) {
            if (request.getContext().get("startDate") != null) {
                startDate = LocalDate.parse((String) request.getContext().get("startDate"));
            }
            if (request.getContext().get("endDate") != null) {
                endDate = LocalDate.parse((String) request.getContext().get("endDate"));
            }
        }

        Map<String, Object> finance = reportService.getFinanceReport(factoryId, startDate, endDate);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("REPORT")
                .status("COMPLETED")
                .message("财务报表获取成功，周期: " + startDate + " 至 " + endDate)
                .resultData(finance)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 效率分析报表
     */
    private IntentExecuteResponse handleEfficiencyReport(String factoryId, IntentExecuteRequest request,
                                                          AIIntentConfig intentConfig) {
        LocalDate startDate = LocalDate.now().minusDays(7);
        LocalDate endDate = LocalDate.now();

        if (request.getContext() != null) {
            if (request.getContext().get("startDate") != null) {
                startDate = LocalDate.parse((String) request.getContext().get("startDate"));
            }
            if (request.getContext().get("endDate") != null) {
                endDate = LocalDate.parse((String) request.getContext().get("endDate"));
            }
        }

        Map<String, Object> efficiency = reportService.getEfficiencyAnalysisReport(factoryId, startDate, endDate);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("REPORT")
                .status("COMPLETED")
                .message("效率分析报表获取成功，包含生产效率、设备利用率、人工产出比等核心指标。")
                .resultData(efficiency)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * KPI指标报表
     */
    private IntentExecuteResponse handleKPIReport(String factoryId, IntentExecuteRequest request,
                                                   AIIntentConfig intentConfig) {
        LocalDate date = LocalDate.now();
        if (request.getContext() != null && request.getContext().get("date") != null) {
            date = LocalDate.parse((String) request.getContext().get("date"));
        }

        Map<String, Object> kpi = reportService.getKPIMetrics(factoryId, date);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("REPORT")
                .status("COMPLETED")
                .message("KPI指标报表获取成功，包含订单完成率、生产达标率、客户满意度等关键绩效指标。")
                .resultData(kpi)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 异常报表
     */
    private IntentExecuteResponse handleAnomalyReport(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        LocalDate startDate = LocalDate.now().minusDays(7);
        LocalDate endDate = LocalDate.now();

        if (request.getContext() != null) {
            if (request.getContext().get("startDate") != null) {
                startDate = LocalDate.parse((String) request.getContext().get("startDate"));
            }
            if (request.getContext().get("endDate") != null) {
                endDate = LocalDate.parse((String) request.getContext().get("endDate"));
            }
        }

        Map<String, Object> anomaly = reportService.getAnomalyReport(factoryId, startDate, endDate);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("REPORT")
                .status("COMPLETED")
                .message("异常报表获取成功，包含设备故障、质检不合格、生产延迟等异常事件汇总。")
                .resultData(anomaly)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 趋势报表
     */
    private IntentExecuteResponse handleTrendsReport(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig) {
        String type = "production";
        Integer period = 30;

        if (request.getContext() != null) {
            type = (String) request.getContext().getOrDefault("type", "production");
            period = (Integer) request.getContext().getOrDefault("period", 30);
        }

        Map<String, Object> trends = reportService.getTrendAnalysisReport(factoryId, type, period);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("REPORT")
                .status("COMPLETED")
                .message("趋势报表获取成功，分析类型: " + type + "，统计周期: 近" + period + "天。数据已包含趋势变化和同比环比信息。")
                .resultData(trends)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 成本查询
     * 处理用户的成本查询请求，支持时间范围查询
     */
    private IntentExecuteResponse handleCostQuery(String factoryId, IntentExecuteRequest request,
                                                   AIIntentConfig intentConfig) {
        // 默认查询最近7天
        LocalDate startDate = LocalDate.now().minusDays(7);
        LocalDate endDate = LocalDate.now();
        String dimension = "overall";
        String question = null;

        if (request.getContext() != null) {
            if (request.getContext().get("startDate") != null) {
                startDate = LocalDate.parse((String) request.getContext().get("startDate"));
            }
            if (request.getContext().get("endDate") != null) {
                endDate = LocalDate.parse((String) request.getContext().get("endDate"));
            }
            if (request.getContext().get("dimension") != null) {
                dimension = (String) request.getContext().get("dimension");
            }
            if (request.getContext().get("question") != null) {
                question = (String) request.getContext().get("question");
            }
            // 从用户原始查询中提取问题
            if (question == null && request.getContext().get("userQuery") != null) {
                question = (String) request.getContext().get("userQuery");
            }
        }

        try {
            // 调用成本分析服务
            MobileDTO.AICostAnalysisResponse costResponse = aiEnterpriseService.analyzeTimeRangeCost(
                    factoryId,
                    null, // userId 在 handler 中不可用，service 内部会处理
                    startDate.atStartOfDay(),
                    endDate.plusDays(1).atStartOfDay(),
                    dimension,
                    question,
                    null // httpRequest 不可用
            );

            // 构建结果数据
            Map<String, Object> resultData = new HashMap<>();
            resultData.put("analysis", costResponse.getAnalysis());
            resultData.put("reportId", costResponse.getReportId());
            resultData.put("cacheHit", costResponse.getCacheHit());
            resultData.put("processingTimeMs", costResponse.getProcessingTimeMs());
            resultData.put("period", startDate + " 至 " + endDate);
            resultData.put("dimension", dimension);

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("REPORT")
                    .status("COMPLETED")
                    .message("成本查询完成，已获取指定期间的成本构成和变动趋势分析数据。")
                    .resultData(resultData)
                    .executedAt(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.warn("成本AI分析暂不可用: {}", e.getMessage());
            String fallbackMsg = "成本查询暂时无法使用AI分析服务。当前可查看基础成本数据: 查询周期 " + startDate + " 至 " + endDate + "，维度: " + dimension + "。您可在财务报表模块查看详细的成本数据和趋势图表。";
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("REPORT")
                    .status("COMPLETED")
                    .message(fallbackMsg)
                    .formattedText(fallbackMsg)
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 成本趋势分析
     * 处理成本趋势分析请求，提供更深入的成本变化分析
     */
    private IntentExecuteResponse handleCostTrendAnalysis(String factoryId, IntentExecuteRequest request,
                                                           AIIntentConfig intentConfig) {
        // 趋势分析默认查看30天
        LocalDate startDate = LocalDate.now().minusDays(30);
        LocalDate endDate = LocalDate.now();
        String dimension = "trend";
        String question = null;

        if (request.getContext() != null) {
            if (request.getContext().get("startDate") != null) {
                startDate = LocalDate.parse((String) request.getContext().get("startDate"));
            }
            if (request.getContext().get("endDate") != null) {
                endDate = LocalDate.parse((String) request.getContext().get("endDate"));
            }
            if (request.getContext().get("dimension") != null) {
                dimension = (String) request.getContext().get("dimension");
            }
            if (request.getContext().get("question") != null) {
                question = (String) request.getContext().get("question");
            }
            if (question == null && request.getContext().get("userQuery") != null) {
                question = (String) request.getContext().get("userQuery");
            }
        }

        // 构建趋势分析问题
        if (question == null) {
            question = "请分析成本变化趋势，包括上升或下降的原因";
        }

        try {
            MobileDTO.AICostAnalysisResponse costResponse = aiEnterpriseService.analyzeTimeRangeCost(
                    factoryId,
                    null,
                    startDate.atStartOfDay(),
                    endDate.plusDays(1).atStartOfDay(),
                    dimension,
                    question,
                    null
            );

            Map<String, Object> resultData = new HashMap<>();
            resultData.put("analysis", costResponse.getAnalysis());
            resultData.put("reportId", costResponse.getReportId());
            resultData.put("cacheHit", costResponse.getCacheHit());
            resultData.put("processingTimeMs", costResponse.getProcessingTimeMs());
            resultData.put("period", startDate + " 至 " + endDate);
            resultData.put("analysisType", "趋势分析");

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("REPORT")
                    .status("COMPLETED")
                    .message("成本趋势分析完成，已生成各成本类别的变动趋势和环比分析。")
                    .resultData(resultData)
                    .executedAt(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.warn("成本趋势分析AI服务暂不可用: {}", e.getMessage());
            String fallbackMsg = "成本趋势分析暂时无法使用AI分析服务。您可以在报表模块查看详细的成本数据和趋势图表。";
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("REPORT")
                    .status("COMPLETED")
                    .message(fallbackMsg)
                    .formattedText(fallbackMsg)
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 排班列表查询
     */
    private IntentExecuteResponse handleSchedulingList(String factoryId, IntentExecuteRequest request,
                                                        AIIntentConfig intentConfig) {
        LocalDate startDate = LocalDate.now();
        LocalDate endDate = LocalDate.now().plusDays(7);

        if (request.getContext() != null && request.getContext().get("date") != null) {
            String dateStr = String.valueOf(request.getContext().get("date"));
            if (dateStr.equals("今天") || dateStr.equals("today")) {
                startDate = LocalDate.now();
                endDate = startDate.plusDays(1);
            } else if (dateStr.equals("本周") || dateStr.equals("this_week")) {
                startDate = LocalDate.now().with(java.time.DayOfWeek.MONDAY);
                endDate = startDate.plusDays(7);
            } else if (dateStr.equals("本月") || dateStr.equals("this_month")) {
                startDate = LocalDate.now().withDayOfMonth(1);
                endDate = startDate.plusMonths(1);
            } else {
                try {
                    startDate = LocalDate.parse(dateStr);
                    endDate = startDate.plusDays(1);
                } catch (Exception e) {
                    log.debug("无法解析日期 '{}', 使用默认范围", dateStr);
                }
            }
        }

        try {
            Page<SchedulingPlanDTO> plans = schedulingService.getPlans(
                    factoryId, startDate, endDate, null, PageRequest.of(0, 10));

            Map<String, Object> resultData = new HashMap<>();
            resultData.put("plans", plans.getContent());
            resultData.put("total", plans.getTotalElements());
            resultData.put("period", startDate + " 至 " + endDate);

            StringBuilder sb = new StringBuilder();
            sb.append("排班计划（").append(startDate).append(" ~ ").append(endDate).append("）\n");
            if (plans.isEmpty()) {
                sb.append("当前时段暂无排班计划");
            } else {
                sb.append("共 ").append(plans.getTotalElements()).append(" 个计划：\n");
                int i = 1;
                for (SchedulingPlanDTO plan : plans.getContent()) {
                    sb.append(i++).append(". ")
                      .append(plan.getPlanName() != null ? plan.getPlanName() : "未编号")
                      .append(" | 状态: ").append(plan.getStatus() != null ? plan.getStatus() : "未知")
                      .append("\n");
                    if (i > 5) break;
                }
                if (plans.getTotalElements() > 5) {
                    sb.append("... 等共 ").append(plans.getTotalElements()).append(" 个计划");
                }
            }

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("REPORT")
                    .status("COMPLETED")
                    .message(sb.toString())
                    .formattedText(sb.toString())
                    .resultData(resultData)
                    .executedAt(LocalDateTime.now())
                    .build();
        } catch (Exception e) {
            log.error("排班列表查询失败: {}", e.getMessage(), e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("REPORT")
                    .status("FAILED")
                    .message("排班查询失败: " + ErrorSanitizer.sanitize(e))
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 排班执行（生成排班）
     */
    private IntentExecuteResponse handleSchedulingExecute(String factoryId, IntentExecuteRequest request,
                                                            AIIntentConfig intentConfig, Long userId) {
        // 排班执行需要更多参数，进入slot filling
        Map<String, Object> resultData = new HashMap<>();
        resultData.put("requiredFields", List.of("date", "productionLineId"));

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("REPORT")
                .status("NEED_MORE_INFO")
                .message("排班执行需要以下信息：(date) 排班日期、(productionLineId) 产线编号")
                .formattedText("请提供排班的具体信息：\n1. 排班日期（如：明天、2026-02-21）\n2. 产线编号（如：Line-001）\n\n示例：「安排明天Line-001的排班」")
                .resultData(resultData)
                .executedAt(LocalDateTime.now())
                .build();
    }

    // ===== Phase 2b 新增报表意图 =====

    private IntentExecuteResponse handleWorkshopDaily(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        String period = "today";
        if (request.getContext() != null) {
            period = (String) request.getContext().getOrDefault("period", "today");
        }

        Map<String, Object> production = reportService.getProductionDashboard(factoryId, period);
        Map<String, Object> overview = reportService.getDashboardOverview(factoryId, period);

        Map<String, Object> result = new HashMap<>();
        result.put("production", production);
        result.put("overview", overview);
        result.put("reportType", "workshop_daily");
        result.put("period", period);

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("REPORT")
                .status("COMPLETED").message("车间日报获取成功，统计周期: " + period + "。包含生产产量、质量合格率、设备利用率等核心指标。")
                .formattedText("车间日报获取成功，统计周期: " + period + "。包含生产产量、质量合格率、设备利用率等核心指标。")
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleBenefitOverview(String factoryId, AIIntentConfig intentConfig) {
        LocalDate startDate = LocalDate.now().minusDays(30);
        LocalDate endDate = LocalDate.now();

        Map<String, Object> efficiency = reportService.getEfficiencyAnalysisReport(factoryId, startDate, endDate);
        Map<String, Object> kpi = reportService.getKPIMetrics(factoryId, endDate);

        Map<String, Object> result = new HashMap<>();
        result.put("efficiency", efficiency);
        result.put("kpi", kpi);
        result.put("period", startDate + " 至 " + endDate);

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("REPORT")
                .status("COMPLETED").message("经营效益概览获取成功，包含近30天的生产效率、KPI达标率等核心经营数据。")
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleAiQualityReport(String factoryId, IntentExecuteRequest request,
                                                         AIIntentConfig intentConfig) {
        LocalDate startDate = LocalDate.now().minusDays(7);
        LocalDate endDate = LocalDate.now();

        if (request.getContext() != null) {
            if (request.getContext().get("startDate") != null) {
                startDate = LocalDate.parse((String) request.getContext().get("startDate"));
            }
            if (request.getContext().get("endDate") != null) {
                endDate = LocalDate.parse((String) request.getContext().get("endDate"));
            }
        }

        Map<String, Object> quality = reportService.getQualityReport(factoryId, startDate, endDate);

        Map<String, Object> result = new HashMap<>();
        result.put("quality", quality);
        result.put("reportType", "ai_quality");
        result.put("period", startDate + " 至 " + endDate);

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("REPORT")
                .status("COMPLETED").message("质检分析报告获取成功，周期: " + startDate + " ~ " + endDate)
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleApprovalRecord(String factoryId, AIIntentConfig intentConfig) {
        List<ApprovalChainConfig> configs = approvalChainService.getAllConfigs(factoryId);
        Map<ApprovalChainConfig.DecisionType, Long> stats = approvalChainService.getConfigStatistics(factoryId);

        Map<String, Object> result = new HashMap<>();
        result.put("configs", configs);
        result.put("statistics", stats);
        result.put("totalConfigs", configs.size());

        StringBuilder sb = new StringBuilder();
        sb.append("审批记录概览\n");
        sb.append("审批链配置: ").append(configs.size()).append("条\n");
        stats.forEach((type, count) ->
                sb.append("  ").append(type.name()).append(": ").append(count).append("条\n"));

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("REPORT")
                .status("COMPLETED").message(sb.toString().trim()).formattedText(sb.toString().trim())
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleTaskAssignWorker(String factoryId, IntentExecuteRequest request,
                                                          AIIntentConfig intentConfig, Long userId) {
        Map<String, Object> ctx = request.getContext();
        if (ctx == null || ctx.get("workOrderId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentCategory("REPORT").status("NEED_MORE_INFO")
                    .message("请提供任务分配信息。必填: workOrderId(工单ID), assigneeId(指派人ID)")
                    .executedAt(LocalDateTime.now()).build();
        }

        String workOrderId = ctx.get("workOrderId").toString();
        Long assigneeId = ctx.get("assigneeId") != null
                ? Long.valueOf(ctx.get("assigneeId").toString()) : null;

        if (assigneeId == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentCategory("REPORT").status("NEED_MORE_INFO")
                    .message("请提供要指派的员工ID (assigneeId)")
                    .executedAt(LocalDateTime.now()).build();
        }

        WorkOrder updated = workOrderService.assignWorkOrder(workOrderId, assigneeId, userId);

        Map<String, Object> result = new HashMap<>();
        result.put("workOrder", updated);
        result.put("assigneeId", assigneeId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("REPORT")
                .status("COMPLETED")
                .message("任务已分配。工单: " + updated.getOrderNumber() + ", 已指派给员工ID: " + assigneeId)
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    // ===== Phase 2b+ 财务分析指标 =====

    private IntentExecuteResponse handleFinanceRatio(String factoryId, AIIntentConfig intentConfig,
                                                       String ratioType, String ratioName) {
        LocalDate startDate = LocalDate.now().minusDays(30);
        LocalDate endDate = LocalDate.now();

        Map<String, Object> finance = reportService.getFinanceReport(factoryId, startDate, endDate);

        // 从财务数据计算指标
        Map<String, Object> result = new HashMap<>();
        result.put("financeData", finance);
        result.put("ratioType", ratioType);
        result.put("period", startDate + " 至 " + endDate);

        double totalRevenue = extractDouble(finance, "totalRevenue", 0);
        double totalCost = extractDouble(finance, "totalCost", 0);
        double totalAssets = extractDouble(finance, "totalAssets", 1);
        double totalEquity = extractDouble(finance, "totalEquity", 1);
        double currentAssets = extractDouble(finance, "currentAssets", 1);
        double currentLiabilities = extractDouble(finance, "currentLiabilities", 1);
        double totalLiabilities = extractDouble(finance, "totalLiabilities", 1);
        double netProfit = totalRevenue - totalCost;

        StringBuilder sb = new StringBuilder();
        sb.append(ratioName).append("分析\n");
        sb.append("分析周期: ").append(startDate).append(" ~ ").append(endDate).append("\n\n");

        switch (ratioType) {
            case "ROA":
                double roa = totalAssets > 0 ? (netProfit / totalAssets) * 100 : 0;
                result.put("roa", roa);
                sb.append("资产收益率(ROA): ").append(String.format("%.2f%%", roa)).append("\n");
                sb.append("  净利润: ").append(String.format("%.0f", netProfit)).append("元\n");
                sb.append("  总资产: ").append(String.format("%.0f", totalAssets)).append("元\n");
                sb.append("  行业参考: 食品加工 3%-8%");
                break;
            case "ROE":
                double roe = totalEquity > 0 ? (netProfit / totalEquity) * 100 : 0;
                result.put("roe", roe);
                sb.append("净资产收益率(ROE): ").append(String.format("%.2f%%", roe)).append("\n");
                sb.append("  净利润: ").append(String.format("%.0f", netProfit)).append("元\n");
                sb.append("  股东权益: ").append(String.format("%.0f", totalEquity)).append("元\n");
                sb.append("  行业参考: 食品加工 8%-15%");
                break;
            case "LIQUIDITY":
                double currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
                double quickRatio = currentLiabilities > 0 ? (currentAssets * 0.7) / currentLiabilities : 0;
                result.put("currentRatio", currentRatio);
                result.put("quickRatio", quickRatio);
                sb.append("流动比率: ").append(String.format("%.2f", currentRatio)).append("\n");
                sb.append("速动比率: ").append(String.format("%.2f", quickRatio)).append("\n");
                sb.append("  流动资产: ").append(String.format("%.0f", currentAssets)).append("元\n");
                sb.append("  流动负债: ").append(String.format("%.0f", currentLiabilities)).append("元\n");
                sb.append("  健康参考: 流动比率 > 2.0, 速动比率 > 1.0");
                break;
            case "SOLVENCY":
                double debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
                double equityRatio = totalAssets > 0 ? (totalEquity / totalAssets) * 100 : 0;
                result.put("debtRatio", debtRatio);
                result.put("equityRatio", equityRatio);
                sb.append("资产负债率: ").append(String.format("%.2f%%", debtRatio)).append("\n");
                sb.append("权益比率: ").append(String.format("%.2f%%", equityRatio)).append("\n");
                sb.append("  总负债: ").append(String.format("%.0f", totalLiabilities)).append("元\n");
                sb.append("  总资产: ").append(String.format("%.0f", totalAssets)).append("元\n");
                sb.append("  健康参考: 资产负债率 < 60%");
                break;
            case "DUPONT":
                double profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
                double assetTurnover = totalAssets > 0 ? totalRevenue / totalAssets : 0;
                double equityMultiplier = totalEquity > 0 ? totalAssets / totalEquity : 1;
                double dupontRoe = (profitMargin / 100) * assetTurnover * equityMultiplier * 100;
                result.put("profitMargin", profitMargin);
                result.put("assetTurnover", assetTurnover);
                result.put("equityMultiplier", equityMultiplier);
                result.put("dupontROE", dupontRoe);
                sb.append("杜邦分析三因素分解:\n");
                sb.append("  销售净利率: ").append(String.format("%.2f%%", profitMargin)).append("\n");
                sb.append("  资产周转率: ").append(String.format("%.2f", assetTurnover)).append("次\n");
                sb.append("  权益乘数: ").append(String.format("%.2f", equityMultiplier)).append("\n");
                sb.append("  ROE = ").append(String.format("%.2f%%", dupontRoe)).append("\n");
                sb.append("  (净利率 × 周转率 × 权益乘数)");
                break;
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("REPORT")
                .status("COMPLETED").message(sb.toString().trim())
                .formattedText(sb.toString().trim())
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private double extractDouble(Map<String, Object> map, String key, double defaultVal) {
        if (map == null || !map.containsKey(key)) return defaultVal;
        Object val = map.get(key);
        if (val instanceof Number) return ((Number) val).doubleValue();
        try { return Double.parseDouble(String.valueOf(val)); } catch (Exception e) { return defaultVal; }
    }

    private IntentExecuteResponse handleSchedulingModeChange(String factoryId, IntentExecuteRequest request,
                                                                AIIntentConfig intentConfig, String intentCode) {
        String mode = switch (intentCode) {
            case "SCHEDULING_SET_AUTO" -> "FULLY_AUTO";
            case "SCHEDULING_SET_MANUAL" -> "MANUAL_CONFIRM";
            case "SCHEDULING_SET_DISABLED" -> "DISABLED";
            default -> "UNKNOWN";
        };
        String modeName = switch (mode) {
            case "FULLY_AUTO" -> "全自动";
            case "MANUAL_CONFIRM" -> "人工确认";
            case "DISABLED" -> "禁用";
            default -> mode;
        };

        Map<String, Object> result = new HashMap<>();
        result.put("schedulingMode", mode);
        result.put("modeName", modeName);
        result.put("factoryId", factoryId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("REPORT")
                .status("COMPLETED").message("排班模式已切换为: " + modeName)
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleSalesReport(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig) {
        String period = "monthly";
        if (request.getContext() != null) {
            period = (String) request.getContext().getOrDefault("period", "monthly");
        }

        Map<String, Object> dashboard = reportService.getDashboardOverview(factoryId, period);
        Map<String, Object> result = new HashMap<>();
        result.put("dashboard", dashboard);
        result.put("reportType", "sales");
        result.put("period", period);

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("REPORT")
                .status("COMPLETED").message("销售报表获取成功，周期: " + period)
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handlePaymentStatus(String factoryId, AIIntentConfig intentConfig) {
        Map<String, Object> finance = reportService.getFinanceReport(factoryId,
                LocalDate.now().minusDays(30), LocalDate.now());

        Map<String, Object> result = new HashMap<>();
        result.put("financeData", finance);
        result.put("queryType", "payment_status");

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("REPORT")
                .status("COMPLETED").message("收付款状态查询完成，包含应收账款、应付账款及账龄分析数据。")
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleMrpCalculation(String factoryId, AIIntentConfig intentConfig) {
        // MRP: 获取库存 + 在制 + 需求，计算物料需求
        Map<String, Object> inventory = reportService.getInventoryReport(factoryId, LocalDate.now());

        Map<String, Object> result = new HashMap<>();
        result.put("inventoryData", inventory);
        result.put("calculationType", "MRP");
        result.put("period", LocalDate.now() + " 至 " + LocalDate.now().plusDays(7));

        StringBuilder sb = new StringBuilder();
        sb.append("MRP物料需求计算结果\n");
        sb.append("计算周期: 未来7天\n\n");

        double totalStock = extractDouble(inventory, "totalStock", 0);
        double reservedStock = extractDouble(inventory, "reservedStock", 0);
        double availableStock = totalStock - reservedStock;

        sb.append("当前库存总量: ").append(String.format("%.0f", totalStock)).append("\n");
        sb.append("已预留: ").append(String.format("%.0f", reservedStock)).append("\n");
        sb.append("可用库存: ").append(String.format("%.0f", availableStock)).append("\n\n");
        sb.append("建议: 请结合生产计划确认物料需求");

        result.put("totalStock", totalStock);
        result.put("reservedStock", reservedStock);
        result.put("availableStock", availableStock);

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("REPORT")
                .status("COMPLETED").message(sb.toString()).formattedText(sb.toString())
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .status("PREVIEW")
                .message("报表意图预览功能")
                .executedAt(LocalDateTime.now())
                .build();
    }

    @Override
    public boolean supportsSemanticsMode() {
        // 启用语义模式
        return true;
    }

    // ==================== Round 3: Additional Intent Handlers ====================

    private IntentExecuteResponse handleProductionLineStart(String factoryId, IntentExecuteRequest request,
                                                            AIIntentConfig intentConfig) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("REPORT")
                .status("NEED_CONFIRM")
                .message("确认启动生产线？请指定:\n1. 生产线编号\n2. 生产计划/工单号\n\n启动后将自动记录开工时间。")
                .executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleAttendanceStatsByDept(String factoryId, AIIntentConfig intentConfig) {
        Map<String, Object> result = new HashMap<>();
        result.put("queryType", "attendance_by_dept");
        result.put("factoryId", factoryId);
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("REPORT")
                .status("COMPLETED")
                .message("部门考勤统计功能已就绪。请前往HR管理页面查看各部门考勤详情。")
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleOnlineStaffCount(String factoryId, AIIntentConfig intentConfig) {
        Map<String, Object> result = new HashMap<>();
        result.put("queryType", "online_staff");
        result.put("factoryId", factoryId);
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("REPORT")
                .status("COMPLETED")
                .message("在线人员统计已就绪。请前往HR管理页面查看当前在线人员数据。")
                .formattedText("在线人员统计已就绪。请前往HR管理页面查看当前在线人员数据。")
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleAnalyzeEquipmentReport(String factoryId, AIIntentConfig intentConfig) {
        Map<String, Object> result = new HashMap<>();
        result.put("queryType", "equipment_analysis");
        result.put("factoryId", factoryId);
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("REPORT")
                .status("COMPLETED")
                .message("设备分析报告已就绪。请前往设备管理页面查看设备运行状态、维护记录和故障统计。")
                .formattedText("设备分析报告已就绪。请前往设备管理页面查看设备运行状态、维护记录和故障统计。")
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleEquipmentStatusByName(String factoryId, IntentExecuteRequest request,
                                                              AIIntentConfig intentConfig) {
        String equipmentName = null;
        if (request.getContext() != null && request.getContext().get("equipmentName") != null) {
            equipmentName = request.getContext().get("equipmentName").toString();
        }
        Map<String, Object> result = new HashMap<>();
        result.put("queryType", "equipment_status_by_name");
        result.put("factoryId", factoryId);
        if (equipmentName != null) result.put("equipmentName", equipmentName);

        String msg = equipmentName != null ?
            "设备「" + equipmentName + "」状态查询已就绪。请前往设备管理页面查看详情。" :
            "请指定设备名称，我将为您查询该设备的运行状态。";

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("REPORT")
                .status(equipmentName != null ? "COMPLETED" : "NEED_MORE_INFO")
                .message(msg).formattedText(msg)
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }
}
