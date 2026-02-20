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
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("REPORT")
                    .status("FAILED")
                    .message("报表操作失败: " + ErrorSanitizer.sanitize(e))
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
                .message("仪表盘数据获取成功")
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
                .message("质量报表获取成功")
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
                .message("库存报表获取成功")
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
                .message("效率分析报表获取成功")
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
                .message("KPI指标报表获取成功")
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
                .message("异常报表获取成功")
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
                .message("趋势报表获取成功，类型: " + type)
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
                    .message("成本查询完成")
                    .resultData(resultData)
                    .executedAt(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error("成本查询失败: {}", e.getMessage(), e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("REPORT")
                    .status("FAILED")
                    .message("成本查询失败: " + ErrorSanitizer.sanitize(e))
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
                    .message("成本趋势分析完成")
                    .resultData(resultData)
                    .executedAt(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error("成本趋势分析失败: {}", e.getMessage(), e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("REPORT")
                    .status("FAILED")
                    .message("成本趋势分析失败: " + ErrorSanitizer.sanitize(e))
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

        if (request.getContext() != null) {
            if (request.getContext().get("date") != null) {
                startDate = LocalDate.parse((String) request.getContext().get("date"));
                endDate = startDate.plusDays(1);
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
                .status("COMPLETED").message("车间日报获取成功，周期: " + period)
                .formattedText("车间日报获取成功")
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
                .status("COMPLETED").message("经营效益概览获取成功")
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
}
