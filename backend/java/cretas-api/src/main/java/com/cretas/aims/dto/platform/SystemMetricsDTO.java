package com.cretas.aims.dto.platform;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 系统监控指标 DTO
 * 用于平台管理员查看系统运行状态
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SystemMetricsDTO {

    /**
     * CPU 使用率 (百分比, 0-100)
     */
    private Double cpuUsage;

    /**
     * 内存使用率 (百分比, 0-100)
     */
    private Double memoryUsage;

    /**
     * 内存使用量 (MB)
     */
    private Long usedMemoryMB;

    /**
     * 最大内存 (MB)
     */
    private Long maxMemoryMB;

    /**
     * 磁盘使用率 (百分比, 0-100)
     */
    private Double diskUsage;

    /**
     * 入站网络流量 (KB/s)
     */
    private Double networkIn;

    /**
     * 出站网络流量 (KB/s)
     */
    private Double networkOut;

    /**
     * 当前活跃连接数
     */
    private Integer activeConnections;

    /**
     * 每分钟请求数
     */
    private Integer requestsPerMinute;

    /**
     * 平均响应时间 (毫秒)
     */
    private Integer averageResponseTime;

    /**
     * 错误率 (百分比, 0-100)
     */
    private Double errorRate;

    /**
     * 系统运行时间 (格式化字符串)
     */
    private String uptime;

    /**
     * 系统运行时间 (毫秒)
     */
    private Long uptimeMs;

    /**
     * 可用处理器数
     */
    private Integer availableProcessors;

    /**
     * Java 版本
     */
    private String javaVersion;

    /**
     * 操作系统名称
     */
    private String osName;

    /**
     * 操作系统架构
     */
    private String osArch;

    /**
     * 应用版本
     */
    private String appVersion;

    /**
     * 数据库连接池状态
     */
    private ConnectionPoolStatus connectionPool;

    /**
     * 服务健康状态
     */
    private List<ServiceHealthStatus> serviceHealthStatus;

    /**
     * 最近活动日志
     */
    private List<ActivityLog> recentActivity;

    /**
     * 连接池状态
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConnectionPoolStatus {
        private Integer activeConnections;
        private Integer idleConnections;
        private Integer maxConnections;
        private Double utilizationPercent;
    }

    /**
     * 服务健康状态
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServiceHealthStatus {
        private String serviceName;
        private String status; // UP, DOWN, DEGRADED
        private String message;
        private Long responseTimeMs;
    }

    /**
     * 活动日志
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActivityLog {
        private Long id;
        private String type; // info, warning, error, success
        private String message;
        private String time;
        private String icon;
        private String color;
    }
}
