package com.cretas.aims.service.impl;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.SystemLog;
import com.cretas.aims.repository.SystemLogRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.repository.FactoryRepository;
import com.cretas.aims.repository.ProductionBatchRepository;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.service.SystemService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.OperatingSystemMXBean;
import java.lang.management.RuntimeMXBean;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * 系统管理服务实现类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
@RequiredArgsConstructor
public class SystemServiceImpl implements SystemService {
    private static final Logger log = LoggerFactory.getLogger(SystemServiceImpl.class);

    private final SystemLogRepository systemLogRepository;
    private final UserRepository userRepository;
    private final FactoryRepository factoryRepository;
    private final ProductionBatchRepository productionBatchRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final DataSource dataSource;

    @Value("${spring.application.name:AIMS Backend System}")
    private String applicationName;

    @Value("${spring.application.version:1.0.0}")
    private String applicationVersion;

    @Override
    public Map<String, Object> getSystemHealth() {
        Map<String, Object> health = new HashMap<>();

        // 基本健康状态
        health.put("status", "UP");
        health.put("timestamp", LocalDateTime.now());
        health.put("application", applicationName);
        health.put("version", applicationVersion);

        // 数据库连接状态
        try (Connection conn = dataSource.getConnection()) {
            health.put("database", "UP");
            health.put("databaseType", conn.getMetaData().getDatabaseProductName());
            health.put("databaseVersion", conn.getMetaData().getDatabaseProductVersion());
        } catch (Exception e) {
            health.put("database", "DOWN");
            health.put("databaseError", e.getMessage());
            health.put("status", "DOWN");
        }

        // JVM内存状态
        MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
        Map<String, Object> memory = new HashMap<>();
        memory.put("heap_used", memoryBean.getHeapMemoryUsage().getUsed() / 1024 / 1024 + " MB");
        memory.put("heap_max", memoryBean.getHeapMemoryUsage().getMax() / 1024 / 1024 + " MB");
        memory.put("non_heap_used", memoryBean.getNonHeapMemoryUsage().getUsed() / 1024 / 1024 + " MB");
        health.put("memory", memory);

        // 系统运行时间
        RuntimeMXBean runtimeBean = ManagementFactory.getRuntimeMXBean();
        long uptime = runtimeBean.getUptime();
        health.put("uptime", formatUptime(uptime));

        return health;
    }

    @Override
    @Transactional
    public void createSystemLog(SystemLog log) {
        log.setCreatedAt(LocalDateTime.now());
        systemLogRepository.save(log);
    }

    @Override
    public PageResponse<SystemLog> getSystemLogs(String factoryId, String logType, PageRequest pageRequest) {
        org.springframework.data.domain.PageRequest pageable = org.springframework.data.domain.PageRequest.of(
                pageRequest.getPage() - 1,
                pageRequest.getSize(),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<SystemLog> page;
        if (factoryId != null && logType != null) {
            page = systemLogRepository.findByFactoryIdAndLogType(factoryId, logType, pageable);
        } else if (factoryId != null) {
            page = systemLogRepository.findByFactoryId(factoryId, pageable);
        } else {
            page = systemLogRepository.findAll(pageable);
        }

        return PageResponse.of(
                page.getContent(),
                pageRequest.getPage(),
                pageRequest.getSize(),
                page.getTotalElements()
        );
    }

    @Override
    public PageResponse<SystemLog> getApiAccessLogs(String factoryId, PageRequest pageRequest) {
        return getSystemLogs(factoryId, "API_ACCESS", pageRequest);
    }

    @Override
    @Transactional
    public void createAuditLog(String factoryId, String module, String action, String message, Integer userId) {
        SystemLog log = new SystemLog();
        log.setFactoryId(factoryId);
        log.setLogType("AUDIT");
        log.setLogLevel("INFO");
        log.setModule(module);
        log.setAction(action);
        log.setMessage(message);
        log.setUserId(userId);
        createSystemLog(log);
    }

    @Override
    @Transactional
    public void createErrorLog(String factoryId, String module, String errorMessage, String stackTrace) {
        SystemLog log = new SystemLog();
        log.setFactoryId(factoryId);
        log.setLogType("ERROR");
        log.setLogLevel("ERROR");
        log.setModule(module);
        log.setErrorMessage(errorMessage);
        log.setStackTrace(stackTrace);
        createSystemLog(log);
    }

    @Override
    public Map<String, Object> getSystemPerformance() {
        Map<String, Object> performance = new HashMap<>();

        // CPU使用率
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        performance.put("processCpuLoad", osBean.getSystemLoadAverage());
        performance.put("systemCpuLoad", osBean.getSystemLoadAverage());
        performance.put("availableProcessors", osBean.getAvailableProcessors());

        // 内存使用
        MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
        long heapUsed = memoryBean.getHeapMemoryUsage().getUsed();
        long heapMax = memoryBean.getHeapMemoryUsage().getMax();
        performance.put("memoryUsedMB", heapUsed / 1024 / 1024);
        performance.put("memoryMaxMB", heapMax / 1024 / 1024);
        performance.put("memoryUsagePercent", (double) heapUsed / heapMax * 100);

        // 线程信息
        performance.put("threadCount", ManagementFactory.getThreadMXBean().getThreadCount());
        performance.put("peakThreadCount", ManagementFactory.getThreadMXBean().getPeakThreadCount());

        // GC信息
        long gcCount = ManagementFactory.getGarbageCollectorMXBeans().stream()
                .mapToLong(gc -> gc.getCollectionCount())
                .sum();
        long gcTime = ManagementFactory.getGarbageCollectorMXBeans().stream()
                .mapToLong(gc -> gc.getCollectionTime())
                .sum();
        performance.put("gcCount", gcCount);
        performance.put("gcTimeMs", gcTime);

        return performance;
    }

    @Override
    public Map<String, Object> getSystemStatistics(String factoryId) {
        Map<String, Object> statistics = new HashMap<>();

        if (factoryId != null) {
            // 工厂相关统计
            statistics.put("totalUsers", userRepository.countByFactoryId(factoryId));
            statistics.put("totalBatches", productionBatchRepository.findByFactoryId(factoryId,
                    org.springframework.data.domain.PageRequest.of(0, 1)).getTotalElements());
            statistics.put("totalMaterialBatches", materialBatchRepository.countByFactoryId(factoryId));

            // 今日统计
            LocalDateTime todayStart = LocalDate.now().atStartOfDay();
            statistics.put("todayLogs", systemLogRepository.findByFactoryIdAndCreatedAtBetween(
                    factoryId, todayStart, LocalDateTime.now(),
                    org.springframework.data.domain.PageRequest.of(0, 1)
            ).getTotalElements());
        } else {
            // 系统全局统计
            statistics.put("totalFactories", factoryRepository.count());
            statistics.put("totalUsers", userRepository.count());
            statistics.put("totalLogs", systemLogRepository.count());
        }

        statistics.put("systemUptime", formatUptime(ManagementFactory.getRuntimeMXBean().getUptime()));
        statistics.put("javaVersion", System.getProperty("java.version"));
        statistics.put("osName", System.getProperty("os.name"));
        statistics.put("osVersion", System.getProperty("os.version"));

        return statistics;
    }

    @Override
    @Transactional
    public int cleanupLogs(LocalDate beforeDate) {
        LocalDateTime dateTime = beforeDate.atStartOfDay();
        return systemLogRepository.deleteLogsBeforeDate(dateTime);
    }

    @Override
    public Map<String, Object> getSystemConfiguration() {
        Map<String, Object> config = new HashMap<>();

        // 应用配置
        config.put("applicationName", applicationName);
        config.put("applicationVersion", applicationVersion);

        // JVM配置
        Map<String, Object> jvm = new HashMap<>();
        jvm.put("version", System.getProperty("java.version"));
        jvm.put("vendor", System.getProperty("java.vendor"));
        jvm.put("home", System.getProperty("java.home"));
        jvm.put("maxMemory", Runtime.getRuntime().maxMemory() / 1024 / 1024 + " MB");
        config.put("jvm", jvm);

        // 系统配置
        Map<String, Object> system = new HashMap<>();
        system.put("os", System.getProperty("os.name"));
        system.put("osVersion", System.getProperty("os.version"));
        system.put("osArch", System.getProperty("os.arch"));
        system.put("processors", Runtime.getRuntime().availableProcessors());
        system.put("timezone", System.getProperty("user.timezone"));
        config.put("system", system);

        return config;
    }

    @Override
    public Map<String, Object> getDatabaseStatus() {
        Map<String, Object> status = new HashMap<>();

        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData metaData = conn.getMetaData();
            status.put("status", "CONNECTED");
            status.put("url", metaData.getURL());
            status.put("databaseName", metaData.getDatabaseProductName());
            status.put("databaseVersion", metaData.getDatabaseProductVersion());
            status.put("driverName", metaData.getDriverName());
            status.put("driverVersion", metaData.getDriverVersion());
            status.put("maxConnections", metaData.getMaxConnections());

            // 连接池状态（如果使用HikariCP）
            if (dataSource instanceof com.zaxxer.hikari.HikariDataSource) {
                com.zaxxer.hikari.HikariDataSource hikariDS = (com.zaxxer.hikari.HikariDataSource) dataSource;
                Map<String, Object> poolStatus = new HashMap<>();
                poolStatus.put("totalConnections", hikariDS.getHikariPoolMXBean().getTotalConnections());
                poolStatus.put("activeConnections", hikariDS.getHikariPoolMXBean().getActiveConnections());
                poolStatus.put("idleConnections", hikariDS.getHikariPoolMXBean().getIdleConnections());
                poolStatus.put("threadsAwaitingConnection", hikariDS.getHikariPoolMXBean().getThreadsAwaitingConnection());
                status.put("connectionPool", poolStatus);
            }
        } catch (Exception e) {
            status.put("status", "ERROR");
            status.put("error", e.getMessage());
            log.error("获取数据库状态失败", e);
        }

        return status;
    }

    /**
     * 格式化运行时间
     */
    private String formatUptime(long millis) {
        long days = TimeUnit.MILLISECONDS.toDays(millis);
        long hours = TimeUnit.MILLISECONDS.toHours(millis) % 24;
        long minutes = TimeUnit.MILLISECONDS.toMinutes(millis) % 60;
        return String.format("%d days, %d hours, %d minutes", days, hours, minutes);
    }
}
