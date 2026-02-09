package com.cretas.aims.controller;

import com.cretas.aims.dto.FactorySettingsDTO;
import com.cretas.aims.dto.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 系统控制器
 * 提供系统状态、健康检查等接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-27
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/system")
@Tag(name = "系统管理", description = "系统状态和管理接口")
@RequiredArgsConstructor
public class SystemController {

    @Value("${app.version:1.0.0}")
    private String appVersion;

    @GetMapping("/status")
    @Operation(summary = "获取系统状态")
    public ApiResponse<FactorySettingsDTO.SystemStatus> getSystemStatus() {
        log.debug("获取系统状态");

        // 获取运行时信息
        Runtime runtime = Runtime.getRuntime();
        long usedMemory = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        long maxMemory = runtime.maxMemory() / (1024 * 1024);

        // 获取JVM运行时间
        long uptime = ManagementFactory.getRuntimeMXBean().getUptime();
        String uptimeStr = formatUptime(uptime);

        // 模拟数据库大小（实际项目中应该查询数据库）
        String databaseSize = calculateDatabaseSize();

        // 模拟最后备份时间
        String lastBackup = LocalDateTime.now().minusDays(1)
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        FactorySettingsDTO.SystemStatus status = FactorySettingsDTO.SystemStatus.builder()
                .version(appVersion)
                .serverStatus("running")
                .lastBackup(lastBackup)
                .databaseSize(databaseSize)
                .build();

        return ApiResponse.success(status);
    }

    @GetMapping("/health")
    @Operation(summary = "健康检查")
    public ApiResponse<Object> healthCheck() {
        log.debug("健康检查");
        return ApiResponse.success("OK");
    }

    @GetMapping("/info")
    @Operation(summary = "获取系统信息")
    public ApiResponse<Object> getSystemInfo() {
        log.debug("获取系统信息");

        Runtime runtime = Runtime.getRuntime();
        long usedMemory = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        long maxMemory = runtime.maxMemory() / (1024 * 1024);
        long uptime = ManagementFactory.getRuntimeMXBean().getUptime();

        return ApiResponse.success(java.util.Map.of(
                "version", appVersion,
                "javaVersion", System.getProperty("java.version"),
                "osName", System.getProperty("os.name"),
                "osArch", System.getProperty("os.arch"),
                "availableProcessors", runtime.availableProcessors(),
                "usedMemoryMB", usedMemory,
                "maxMemoryMB", maxMemory,
                "uptimeMs", uptime,
                "uptimeFormatted", formatUptime(uptime)
        ));
    }

    /**
     * 格式化运行时间
     */
    private String formatUptime(long uptimeMs) {
        long seconds = uptimeMs / 1000;
        long minutes = seconds / 60;
        long hours = minutes / 60;
        long days = hours / 24;

        if (days > 0) {
            return String.format("%d天 %d小时", days, hours % 24);
        } else if (hours > 0) {
            return String.format("%d小时 %d分钟", hours, minutes % 60);
        } else {
            return String.format("%d分钟", minutes);
        }
    }

    /**
     * 计算数据库大小（模拟）
     */
    private String calculateDatabaseSize() {
        // 实际项目中应该查询数据库获取真实大小
        // SELECT SUM(data_length + index_length) FROM information_schema.tables WHERE table_schema = 'cretas_db';
        return "128 MB";
    }
}
