package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.SystemLog;
import com.cretas.aims.service.SystemService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * 系统管理控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/system")
@RequiredArgsConstructor
@Tag(name = "系统管理")
public class SystemController {

    private final SystemService systemService;

    /**
     * 系统健康检查
     */
    @GetMapping("/health")
    @Operation(summary = "系统健康检查", description = "获取系统健康状态")
    public ApiResponse<Map<String, Object>> getSystemHealth() {
        log.info("执行系统健康检查");
        Map<String, Object> health = systemService.getSystemHealth();
        return ApiResponse.success(health);
    }

    /**
     * 记录系统日志
     */
    @PostMapping("/logs")
    @Operation(summary = "记录系统日志", description = "创建新的系统日志记录")
    public ApiResponse<Void> createSystemLog(
            @RequestBody @Parameter(description = "日志信息") SystemLog systemLog) {
        log.info("记录系统日志: type={}, level={}", systemLog.getLogType(), systemLog.getLogLevel());
        systemService.createSystemLog(systemLog);
        return ApiResponse.success();
    }

    /**
     * 获取系统日志列表
     */
    @GetMapping("/logs")
    @Operation(summary = "获取系统日志", description = "分页获取系统日志列表")
    public ApiResponse<PageResponse<SystemLog>> getSystemLogs(
            @RequestParam(required = false) @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @Parameter(description = "日志类型") String logType,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size) {
        log.info("获取系统日志: factoryId={}, logType={}", factoryId, logType);
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);
        PageResponse<SystemLog> result = systemService.getSystemLogs(factoryId, logType, pageRequest);
        return ApiResponse.success(result);
    }

    /**
     * 获取API访问日志
     */
    @GetMapping("/api-logs")
    @Operation(summary = "获取API访问日志", description = "获取API访问日志记录")
    public ApiResponse<PageResponse<SystemLog>> getApiAccessLogs(
            @RequestParam(required = false) @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size) {
        log.info("获取API访问日志: factoryId={}", factoryId);
        PageRequest pageRequest = new PageRequest();
        pageRequest.setPage(page);
        pageRequest.setSize(size);
        PageResponse<SystemLog> result = systemService.getApiAccessLogs(factoryId, pageRequest);
        return ApiResponse.success(result);
    }

    /**
     * 系统性能监控
     */
    @GetMapping("/performance")
    @Operation(summary = "系统性能监控", description = "获取系统性能监控数据")
    public ApiResponse<Map<String, Object>> getSystemPerformance() {
        log.info("获取系统性能数据");
        Map<String, Object> performance = systemService.getSystemPerformance();
        return ApiResponse.success(performance);
    }

    /**
     * 系统统计概览
     */
    @GetMapping("/statistics")
    @Operation(summary = "系统统计", description = "获取系统统计概览")
    public ApiResponse<Map<String, Object>> getSystemStatistics(
            @RequestParam(required = false) @Parameter(description = "工厂ID") String factoryId) {
        log.info("获取系统统计: factoryId={}", factoryId);
        Map<String, Object> statistics = systemService.getSystemStatistics(factoryId);
        return ApiResponse.success(statistics);
    }

    /**
     * 清理过期日志
     */
    @PostMapping("/cleanup-logs")
    @Operation(summary = "清理过期日志", description = "清理指定日期之前的日志")
    public ApiResponse<Integer> cleanupLogs(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            @Parameter(description = "清理此日期之前的日志") LocalDate beforeDate) {
        log.info("清理过期日志: beforeDate={}", beforeDate);
        int deletedCount = systemService.cleanupLogs(beforeDate);
        log.info("清理日志完成: 删除{}条记录", deletedCount);
        return ApiResponse.success(deletedCount);
    }

    /**
     * 获取系统配置
     */
    @GetMapping("/configuration")
    @Operation(summary = "获取系统配置", description = "获取系统配置信息")
    public ApiResponse<Map<String, Object>> getSystemConfiguration() {
        log.info("获取系统配置");
        Map<String, Object> config = systemService.getSystemConfiguration();
        return ApiResponse.success(config);
    }

    /**
     * 获取数据库状态
     */
    @GetMapping("/database/status")
    @Operation(summary = "数据库状态", description = "获取数据库连接和状态信息")
    public ApiResponse<Map<String, Object>> getDatabaseStatus() {
        log.info("获取数据库状态");
        Map<String, Object> status = systemService.getDatabaseStatus();
        return ApiResponse.success(status);
    }
}