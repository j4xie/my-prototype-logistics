package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.TimeClockRecord;
import com.cretas.aims.service.TimeClockService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletResponse;
import java.time.LocalDate;
import java.util.Map;

/**
 * 考勤打卡控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/timeclock")
@RequiredArgsConstructor
@Tag(name = "考勤打卡管理")
public class TimeClockController {

    private final TimeClockService timeClockService;

    /**
     * 上班打卡
     */
    @PostMapping("/clock-in")
    @Operation(summary = "上班打卡", description = "员工上班打卡")
    public ApiResponse<TimeClockRecord> clockIn(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "用户ID") Integer userId,
            @RequestParam(required = false) @Parameter(description = "打卡位置") String location,
            @RequestParam(required = false) @Parameter(description = "打卡设备") String device) {
        log.info("上班打卡: factoryId={}, userId={}", factoryId, userId);
        TimeClockRecord record = timeClockService.clockIn(factoryId, userId, location, device);
        return ApiResponse.success(record);
    }

    /**
     * 下班打卡
     */
    @PostMapping("/clock-out")
    @Operation(summary = "下班打卡", description = "员工下班打卡")
    public ApiResponse<TimeClockRecord> clockOut(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "用户ID") Integer userId) {
        log.info("下班打卡: factoryId={}, userId={}", factoryId, userId);
        TimeClockRecord record = timeClockService.clockOut(factoryId, userId);
        return ApiResponse.success(record);
    }

    /**
     * 开始休息
     */
    @PostMapping("/break-start")
    @Operation(summary = "开始休息", description = "开始休息时间")
    public ApiResponse<TimeClockRecord> breakStart(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "用户ID") Integer userId) {
        log.info("开始休息: factoryId={}, userId={}", factoryId, userId);
        TimeClockRecord record = timeClockService.breakStart(factoryId, userId);
        return ApiResponse.success(record);
    }

    /**
     * 结束休息
     */
    @PostMapping("/break-end")
    @Operation(summary = "结束休息", description = "结束休息时间")
    public ApiResponse<TimeClockRecord> breakEnd(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "用户ID") Integer userId) {
        log.info("结束休息: factoryId={}, userId={}", factoryId, userId);
        TimeClockRecord record = timeClockService.breakEnd(factoryId, userId);
        return ApiResponse.success(record);
    }

    /**
     * 获取打卡状态
     */
    @GetMapping("/status")
    @Operation(summary = "获取打卡状态", description = "获取员工当前打卡状态")
    public ApiResponse<Map<String, Object>> getClockStatus(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "用户ID") Integer userId) {
        log.info("获取打卡状态: factoryId={}, userId={}", factoryId, userId);
        Map<String, Object> status = timeClockService.getClockStatus(factoryId, userId);
        return ApiResponse.success(status);
    }

    /**
     * 获取打卡历史
     */
    @GetMapping("/history")
    @Operation(summary = "获取打卡历史", description = "获取员工打卡历史记录")
    public ApiResponse<PageResponse<TimeClockRecord>> getClockHistory(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "用户ID") Integer userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size) {
        log.info("获取打卡历史: factoryId={}, userId={}, startDate={}, endDate={}",
                factoryId, userId, startDate, endDate);
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);
        PageResponse<TimeClockRecord> history = timeClockService.getClockHistory(
                factoryId, userId, startDate, endDate, pageRequest);
        return ApiResponse.success(history);
    }

    /**
     * 获取今日打卡记录
     */
    @GetMapping("/today")
    @Operation(summary = "获取今日打卡", description = "获取员工今日打卡记录")
    public ApiResponse<TimeClockRecord> getTodayRecord(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "用户ID") Integer userId) {
        log.info("获取今日打卡记录: factoryId={}, userId={}", factoryId, userId);
        TimeClockRecord record = timeClockService.getTodayRecord(factoryId, userId);
        return ApiResponse.success(record);
    }

    /**
     * 修改打卡记录
     */
    @PutMapping("/records/{recordId}")
    @Operation(summary = "修改打卡记录", description = "手动修改打卡记录")
    public ApiResponse<TimeClockRecord> editClockRecord(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "记录ID") Long recordId,
            @RequestBody @Parameter(description = "修改内容") TimeClockRecord record,
            @RequestParam @Parameter(description = "修改人ID") Integer editedBy,
            @RequestParam @Parameter(description = "修改原因") String reason) {
        log.info("修改打卡记录: factoryId={}, recordId={}, editedBy={}", factoryId, recordId, editedBy);
        TimeClockRecord edited = timeClockService.editClockRecord(factoryId, recordId, record, editedBy, reason);
        return ApiResponse.success(edited);
    }

    /**
     * 获取考勤统计
     */
    @GetMapping("/statistics")
    @Operation(summary = "考勤统计", description = "获取员工考勤统计数据")
    public ApiResponse<Map<String, Object>> getAttendanceStatistics(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @Parameter(description = "用户ID") Integer userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate) {
        log.info("获取考勤统计: factoryId={}, userId={}, startDate={}, endDate={}",
                factoryId, userId, startDate, endDate);
        Map<String, Object> statistics = timeClockService.getAttendanceStatistics(
                factoryId, userId, startDate, endDate);
        return ApiResponse.success(statistics);
    }

    /**
     * 获取部门考勤
     */
    @GetMapping("/department/{department}")
    @Operation(summary = "部门考勤", description = "获取部门考勤情况")
    public ApiResponse<Map<String, Object>> getDepartmentAttendance(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "部门") String department,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "日期") LocalDate date) {
        log.info("获取部门考勤: factoryId={}, department={}, date={}", factoryId, department, date);
        Map<String, Object> attendance = timeClockService.getDepartmentAttendance(factoryId, department, date);
        return ApiResponse.success(attendance);
    }

    /**
     * 导出考勤记录
     */
    @GetMapping("/export")
    @Operation(summary = "导出考勤记录", description = "导出指定日期范围的考勤记录")
    public void exportAttendanceRecords(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "开始日期") LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "结束日期") LocalDate endDate,
            HttpServletResponse response) {
        log.info("导出考勤记录: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition",
                String.format("attachment; filename=\"attendance_%s_%s.xlsx\"", startDate, endDate));

        try {
            byte[] data = timeClockService.exportAttendanceRecords(factoryId, startDate, endDate);
            response.getOutputStream().write(data);
            response.getOutputStream().flush();
        } catch (Exception e) {
            log.error("导出考勤记录失败", e);
        }
    }
}