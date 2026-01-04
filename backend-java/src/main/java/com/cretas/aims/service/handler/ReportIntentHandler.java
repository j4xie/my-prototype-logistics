package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.report.DashboardStatisticsDTO;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.ReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

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
                case "REPORT_PRODUCTION" -> handleProductionReport(factoryId, request, intentConfig);
                case "REPORT_QUALITY" -> handleQualityReport(factoryId, request, intentConfig);
                case "REPORT_INVENTORY" -> handleInventoryReport(factoryId, request, intentConfig);
                case "REPORT_FINANCE" -> handleFinanceReport(factoryId, request, intentConfig);
                case "REPORT_EFFICIENCY" -> handleEfficiencyReport(factoryId, request, intentConfig);
                case "REPORT_KPI" -> handleKPIReport(factoryId, request, intentConfig);
                case "REPORT_ANOMALY" -> handleAnomalyReport(factoryId, request, intentConfig);
                case "REPORT_TRENDS" -> handleTrendsReport(factoryId, request, intentConfig);
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
                    .message("报表操作失败: " + e.getMessage())
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
}
