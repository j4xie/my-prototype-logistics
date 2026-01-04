package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.TimeClockRecord;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.TimeClockService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 人事/考勤意图处理器
 *
 * 处理 HR 分类的意图:
 * - ATTENDANCE_STATUS: 打卡状态查询
 * - ATTENDANCE_HISTORY: 考勤历史
 * - ATTENDANCE_STATS: 考勤统计
 * - ATTENDANCE_MONTHLY: 月度考勤
 * - ATTENDANCE_ANOMALY: 考勤异常
 * - ATTENDANCE_DEPARTMENT: 部门考勤
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-03
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class HRIntentHandler implements IntentHandler {

    private final TimeClockService timeClockService;

    @Override
    public String getSupportedCategory() {
        return "HR";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        String intentCode = intentConfig.getIntentCode();
        log.info("HRIntentHandler处理: intentCode={}, factoryId={}, userId={}",
                intentCode, factoryId, userId);

        try {
            return switch (intentCode) {
                case "ATTENDANCE_STATUS" -> handleAttendanceStatus(factoryId, intentConfig, userId);
                case "ATTENDANCE_HISTORY" -> handleAttendanceHistory(factoryId, request, intentConfig, userId);
                case "ATTENDANCE_STATS" -> handleAttendanceStats(factoryId, request, intentConfig, userId);
                case "ATTENDANCE_MONTHLY" -> handleMonthlyAttendance(factoryId, request, intentConfig, userId);
                case "ATTENDANCE_ANOMALY" -> handleAttendanceAnomaly(factoryId, request, intentConfig);
                case "ATTENDANCE_DEPARTMENT" -> handleDepartmentAttendance(factoryId, request, intentConfig);
                case "ATTENDANCE_TODAY" -> handleTodayRecord(factoryId, intentConfig, userId);
                case "CLOCK_IN" -> handleClockIn(factoryId, intentConfig, userId);
                case "CLOCK_OUT" -> handleClockOut(factoryId, intentConfig, userId);
                default -> {
                    log.warn("未知的HR意图: {}", intentCode);
                    yield IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentCode)
                            .intentName(intentConfig.getIntentName())
                            .intentCategory("HR")
                            .status("FAILED")
                            .message("暂不支持此人事操作: " + intentCode)
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            };

        } catch (Exception e) {
            log.error("HRIntentHandler处理失败: intentCode={}, error={}", intentCode, e.getMessage(), e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("HR")
                    .status("FAILED")
                    .message("人事操作失败: " + e.getMessage())
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 打卡状态查询
     */
    private IntentExecuteResponse handleAttendanceStatus(String factoryId, AIIntentConfig intentConfig, Long userId) {
        Map<String, Object> status = timeClockService.getClockStatus(factoryId, userId);

        String statusMessage = (Boolean) status.getOrDefault("isClockedIn", false)
                ? "您今天已打卡，工作时长: " + status.get("workedHours") + " 小时"
                : "您今天还未打卡";

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("HR")
                .status("COMPLETED")
                .message(statusMessage)
                .resultData(status)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 考勤历史
     */
    private IntentExecuteResponse handleAttendanceHistory(String factoryId, IntentExecuteRequest request,
                                                           AIIntentConfig intentConfig, Long userId) {
        int page = 1;
        int size = 20;
        LocalDate startDate = LocalDate.now().minusDays(30);
        LocalDate endDate = LocalDate.now();

        if (request.getContext() != null) {
            page = (int) request.getContext().getOrDefault("page", 1);
            size = (int) request.getContext().getOrDefault("size", 20);
            if (request.getContext().get("startDate") != null) {
                startDate = LocalDate.parse((String) request.getContext().get("startDate"));
            }
            if (request.getContext().get("endDate") != null) {
                endDate = LocalDate.parse((String) request.getContext().get("endDate"));
            }
        }

        PageRequest pageRequest = PageRequest.of(page, size);
        PageResponse<TimeClockRecord> history = timeClockService.getClockHistory(
                factoryId, userId, startDate, endDate, pageRequest);

        Map<String, Object> result = new HashMap<>();
        result.put("records", history.getContent());
        result.put("total", history.getTotalElements());
        result.put("startDate", startDate);
        result.put("endDate", endDate);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("HR")
                .status("COMPLETED")
                .message("查询到 " + history.getTotalElements() + " 条考勤记录")
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 考勤统计
     */
    private IntentExecuteResponse handleAttendanceStats(String factoryId, IntentExecuteRequest request,
                                                         AIIntentConfig intentConfig, Long userId) {
        LocalDate startDate = LocalDate.now().withDayOfMonth(1);
        LocalDate endDate = LocalDate.now();

        if (request.getContext() != null) {
            if (request.getContext().get("startDate") != null) {
                startDate = LocalDate.parse((String) request.getContext().get("startDate"));
            }
            if (request.getContext().get("endDate") != null) {
                endDate = LocalDate.parse((String) request.getContext().get("endDate"));
            }
        }

        Map<String, Object> stats = timeClockService.getAttendanceStatistics(factoryId, userId, startDate, endDate);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("HR")
                .status("COMPLETED")
                .message("考勤统计获取成功")
                .resultData(stats)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 月度考勤
     */
    private IntentExecuteResponse handleMonthlyAttendance(String factoryId, IntentExecuteRequest request,
                                                           AIIntentConfig intentConfig, Long userId) {
        int year = LocalDate.now().getYear();
        int month = LocalDate.now().getMonthValue();

        if (request.getContext() != null) {
            year = (int) request.getContext().getOrDefault("year", year);
            month = (int) request.getContext().getOrDefault("month", month);
        }

        // Use clock history for the month instead of getMonthlyRecords
        LocalDate startDate = LocalDate.of(year, month, 1);
        LocalDate endDate = YearMonth.of(year, month).atEndOfMonth();
        PageRequest pageRequest = PageRequest.of(1, 50);
        PageResponse<TimeClockRecord> monthlyRecords = timeClockService.getClockHistory(
                factoryId, userId, startDate, endDate, pageRequest);

        Map<String, Object> result = new HashMap<>();
        result.put("year", year);
        result.put("month", month);
        result.put("records", monthlyRecords.getContent());
        result.put("totalDays", monthlyRecords.getTotalElements());
        result.put("workingDays", YearMonth.of(year, month).lengthOfMonth());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("HR")
                .status("COMPLETED")
                .message(year + "年" + month + "月考勤记录，共 " + monthlyRecords.getTotalElements() + " 天")
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 考勤异常
     */
    private IntentExecuteResponse handleAttendanceAnomaly(String factoryId, IntentExecuteRequest request,
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

        // 查询所有员工的考勤异常
        Map<String, Object> anomalies = timeClockService.getAllEmployeesAttendanceStatistics(
                factoryId, startDate, endDate);

        // 提取异常信息
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> employees = (List<Map<String, Object>>) anomalies.getOrDefault("employees", List.of());

        List<Map<String, Object>> anomalyList = employees.stream()
                .filter(e -> {
                    int lateCount = (int) e.getOrDefault("lateCount", 0);
                    int earlyLeaveCount = (int) e.getOrDefault("earlyLeaveCount", 0);
                    int absentCount = (int) e.getOrDefault("absentCount", 0);
                    return lateCount > 0 || earlyLeaveCount > 0 || absentCount > 0;
                })
                .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("anomalies", anomalyList);
        result.put("totalAnomalies", anomalyList.size());
        result.put("startDate", startDate);
        result.put("endDate", endDate);

        String message = anomalyList.isEmpty()
                ? "该时间段无考勤异常"
                : "发现 " + anomalyList.size() + " 人有考勤异常";

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("HR")
                .status("COMPLETED")
                .message(message)
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 部门考勤
     */
    private IntentExecuteResponse handleDepartmentAttendance(String factoryId, IntentExecuteRequest request,
                                                              AIIntentConfig intentConfig) {
        if (request.getContext() == null || request.getContext().get("department") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("HR")
                    .status("NEED_INPUT")
                    .message("请提供部门名称 (department)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        String department = (String) request.getContext().get("department");
        LocalDate date = LocalDate.now();
        if (request.getContext().get("date") != null) {
            date = LocalDate.parse((String) request.getContext().get("date"));
        }

        Map<String, Object> deptAttendance = timeClockService.getDepartmentAttendance(factoryId, department, date);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("HR")
                .status("COMPLETED")
                .message(department + " 部门考勤统计")
                .resultData(deptAttendance)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 今日打卡记录
     */
    private IntentExecuteResponse handleTodayRecord(String factoryId, AIIntentConfig intentConfig, Long userId) {
        TimeClockRecord today = timeClockService.getTodayRecord(factoryId, userId);

        Map<String, Object> result = new HashMap<>();
        if (today != null) {
            result.put("record", today);
            result.put("clockInTime", today.getClockInTime());
            result.put("clockOutTime", today.getClockOutTime());
        }

        String message = today == null
                ? "今天还没有打卡记录"
                : "今日打卡时间: " + today.getClockInTime();

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("HR")
                .status("COMPLETED")
                .message(message)
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 上班打卡
     */
    private IntentExecuteResponse handleClockIn(String factoryId, AIIntentConfig intentConfig, Long userId) {
        TimeClockRecord record = timeClockService.clockIn(factoryId, userId, null, null);

        Map<String, Object> result = new HashMap<>();
        result.put("record", record);
        result.put("clockInTime", record.getClockInTime());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("HR")
                .status("COMPLETED")
                .message("上班打卡成功！时间: " + record.getClockInTime())
                .resultData(result)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 下班打卡
     */
    private IntentExecuteResponse handleClockOut(String factoryId, AIIntentConfig intentConfig, Long userId) {
        TimeClockRecord record = timeClockService.clockOut(factoryId, userId);

        Map<String, Object> result = new HashMap<>();
        result.put("record", record);
        result.put("clockOutTime", record.getClockOutTime());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("HR")
                .status("COMPLETED")
                .message("下班打卡成功！时间: " + record.getClockOutTime())
                .resultData(result)
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
                .message("人事考勤意图预览功能")
                .executedAt(LocalDateTime.now())
                .build();
    }
}
