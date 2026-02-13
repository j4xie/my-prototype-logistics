package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.entity.ProductionReport;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.ProductionReportRepository;
import com.cretas.aims.repository.BatchWorkSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Work Reporting intent handler for production reporting queries.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WorkReportIntentHandler implements IntentHandler {

    private final ProductionReportRepository reportRepository;
    private final BatchWorkSessionRepository batchWorkSessionRepository;

    @Override
    public String getSupportedCategory() {
        return "WORK_REPORT";
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("WORK_REPORT")
                .status("PREVIEW")
                .message("将查询生产报工数据")
                .executedAt(LocalDateTime.now())
                .build();
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {
        String intentCode = intentConfig.getIntentCode();
        log.info("WorkReportIntentHandler: intentCode={}, factoryId={}", intentCode, factoryId);

        try {
            return switch (intentCode) {
                case "PRODUCTION_PROGRESS_REPORT" -> handleProgressQuery(factoryId, intentConfig);
                case "PRODUCTION_HOURS_REPORT" -> handleHoursQuery(factoryId, intentConfig);
                case "PRODUCTION_WORKER_CHECKIN" -> handleCheckinQuery(factoryId, intentConfig);
                case "PRODUCTION_DAILY_SUMMARY" -> handleDailySummary(factoryId, intentConfig);
                default -> IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentCode)
                        .intentName(intentConfig.getIntentName())
                        .intentCategory("WORK_REPORT")
                        .status("FAILED")
                        .message("暂不支持此报工操作: " + intentCode)
                        .executedAt(LocalDateTime.now())
                        .build();
            };
        } catch (Exception e) {
            log.error("WorkReportIntentHandler error: intentCode={}, error={}", intentCode, e.getMessage(), e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("WORK_REPORT")
                    .status("FAILED")
                    .message("报工查询失败: " + e.getMessage())
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    private IntentExecuteResponse handleProgressQuery(String factoryId, AIIntentConfig intentConfig) {
        LocalDate today = LocalDate.now();
        Map<String, Object> summary = reportRepository.getProgressSummary(factoryId, today, today);

        Map<String, Object> resultData = new HashMap<>();
        resultData.put("date", today.toString());
        resultData.put("totalOutput", summary.get("total_output"));
        resultData.put("totalGood", summary.get("total_good"));
        resultData.put("totalDefect", summary.get("total_defect"));
        resultData.put("reportCount", summary.get("report_count"));

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode("PRODUCTION_PROGRESS_REPORT")
                .intentName(intentConfig.getIntentName())
                .intentCategory("WORK_REPORT")
                .status("SUCCESS")
                .message("今日生产进度查询完成")
                .resultData(resultData)
                .executedAt(LocalDateTime.now())
                .build();
    }

    private IntentExecuteResponse handleHoursQuery(String factoryId, AIIntentConfig intentConfig) {
        LocalDate today = LocalDate.now();
        Map<String, Object> summary = reportRepository.getHoursSummary(factoryId, today, today);

        Map<String, Object> resultData = new HashMap<>();
        resultData.put("date", today.toString());
        resultData.put("totalMinutes", summary.get("total_minutes"));
        resultData.put("totalWorkers", summary.get("total_workers"));
        resultData.put("totalVolume", summary.get("total_volume"));
        resultData.put("reportCount", summary.get("report_count"));

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode("PRODUCTION_HOURS_REPORT")
                .intentName(intentConfig.getIntentName())
                .intentCategory("WORK_REPORT")
                .status("SUCCESS")
                .message("今日工时统计查询完成")
                .resultData(resultData)
                .executedAt(LocalDateTime.now())
                .build();
    }

    private IntentExecuteResponse handleCheckinQuery(String factoryId, AIIntentConfig intentConfig) {
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = start.plusDays(1);
        long count = batchWorkSessionRepository.countByCheckInTimeBetween(start, end);

        Map<String, Object> resultData = new HashMap<>();
        resultData.put("date", LocalDate.now().toString());
        resultData.put("checkinCount", count);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode("PRODUCTION_WORKER_CHECKIN")
                .intentName(intentConfig.getIntentName())
                .intentCategory("WORK_REPORT")
                .status("SUCCESS")
                .message("今日签到人数: " + count)
                .resultData(resultData)
                .executedAt(LocalDateTime.now())
                .build();
    }

    private IntentExecuteResponse handleDailySummary(String factoryId, AIIntentConfig intentConfig) {
        LocalDate today = LocalDate.now();
        long todayCount = reportRepository.countByFactoryIdAndDate(factoryId, today);
        Map<String, Object> progress = reportRepository.getProgressSummary(factoryId, today, today);
        Map<String, Object> hours = reportRepository.getHoursSummary(factoryId, today, today);

        Map<String, Object> resultData = new HashMap<>();
        resultData.put("date", today.toString());
        resultData.put("totalReports", todayCount);
        resultData.put("progressSummary", progress);
        resultData.put("hoursSummary", hours);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode("PRODUCTION_DAILY_SUMMARY")
                .intentName(intentConfig.getIntentName())
                .intentCategory("WORK_REPORT")
                .status("SUCCESS")
                .message("今日共提交 " + todayCount + " 份报工")
                .resultData(resultData)
                .executedAt(LocalDateTime.now())
                .build();
    }
}
