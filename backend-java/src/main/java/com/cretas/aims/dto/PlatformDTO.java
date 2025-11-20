package com.cretas.aims.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import javax.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
/**
 * 平台管理数据传输对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public class PlatformDTO {
    /**
     * 平台概览数据
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Overview {
        // 工厂统计
        private FactoryStats factoryStats;
        // 用户统计
        private UserStats userStats;
        // 生产统计
        private ProductionStats productionStats;
        // 系统统计
        private SystemStats systemStats;
        // 财务统计
        private FinancialStats financialStats;
        // 趋势数据
        private List<TrendData> trends;
        @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
        private LocalDateTime lastUpdated;
    }

    /**
     * 工厂统计
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FactoryStats {
        private Integer totalFactories;
        private Integer activeFactories;
        private Integer suspendedFactories;
        private Integer expiredFactories;
        private Integer newFactoriesThisMonth;
        private Map<String, Integer> factoriesByRegion;
        private Map<String, Integer> factoriesByType;
    }

    /**
     * 用户统计
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserStats {
        private Integer totalUsers;
        private Integer activeUsers;
        private Integer newUsersThisMonth;
        private Integer onlineUsers;
        private Map<String, Integer> usersByRole;
        private Double averageUsersPerFactory;
    }

    /**
     * 生产统计
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProductionStats {
        private Long totalProductionOrders;
        private Long completedOrders;
        private Long inProgressOrders;
        private BigDecimal totalProductionValue;
        private Double averageCompletionRate;
        private Map<String, Long> ordersByProductType;
    }

    /**
     * 系统统计
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SystemStats {
        private Long totalApiCalls;
        private Long totalDataStorage;
        private Double averageResponseTime;
        private Double systemUptime;
        private Integer activeDevices;
        private Map<String, Long> apiCallsByEndpoint;
    }

    /**
     * 财务统计
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FinancialStats {
        private BigDecimal totalRevenue;
        private BigDecimal monthlyRevenue;
        private BigDecimal averageRevenuePerFactory;
        private BigDecimal outstandingPayments;
        private Map<String, BigDecimal> revenueByPlan;
    }

    /**
     * 趋势数据
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrendData {
        private String metric;
        private String period;
        private List<DataPoint> dataPoints;
    }

    /**
     * 数据点
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DataPoint {
        private String label;
        private Number value;
        @JsonFormat(pattern = "yyyy-MM-dd")
        private LocalDateTime date;
    }

    /**
     * 工厂管理DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FactoryManagementDTO {
        private String id;
        @NotBlank(message = "工厂名称不能为空")
        @Size(max = 100, message = "工厂名称不能超过100个字符")
        private String name;
        @NotBlank(message = "工厂代码不能为空")
        @Size(max = 50, message = "工厂代码不能超过50个字符")
        private String code;
        private String type;
        private String industry;
        private String scale;
        private String status;
        @NotBlank(message = "联系人不能为空")
        private String contactPerson;
        @NotBlank(message = "联系电话不能为空")
        @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
        private String contactPhone;
        @Email(message = "邮箱格式不正确")
        private String contactEmail;
        private String address;
        private String province;
        private String city;
        private String district;
        private String subscriptionPlan;
        private LocalDateTime subscriptionExpiry;
        private Integer userLimit;
        private Integer deviceLimit;
        private Long storageLimit;
        private Map<String, Boolean> features;
        private LocalDateTime createdAt;
        private LocalDateTime lastActiveAt;
        // 统计信息
        private Long totalOrders;
    }

    /**
     * 创建工厂请求
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateFactoryRequest {
        @NotBlank(message = "工厂名称不能为空")
        @Size(max = 100)
        private String name;
        @NotBlank(message = "工厂代码不能为空")
        @Size(max = 50)
        private String code;
        @NotBlank(message = "订阅计划不能为空")
        private String subscriptionPlan;
        // 管理员账号信息
        @NotBlank(message = "管理员用户名不能为空")
        private String adminUsername;
        @NotBlank(message = "管理员密码不能为空")
        @Size(min = 6, message = "密码长度至少6位")
        private String adminPassword;
        private String adminName;
        private String adminPhone;
        private String adminEmail;
    }

    /**
     * 操作日志
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OperationLog {
        private Long id;
        private String operatorId;
        private String operatorName;
        private String operationType;
        private String targetType;
        private String targetId;
        private String targetName;
        private String action;
        private String description;
        private String ipAddress;
        private String userAgent;
        private Map<String, Object> parameters;
        private Map<String, Object> result;
        private LocalDateTime operationTime;
    }

    /**
     * 平台设置
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PlatformSettings {
        // 基础设置
        private String platformName;
        private String platformLogo;
        private String platformDescription;
        private String supportEmail;
        private String supportPhone;
        // 订阅计划
        private List<SubscriptionPlan> subscriptionPlans;
        // 系统限制
        private SystemLimits systemLimits;
        // 功能开关
        private Map<String, Boolean> featureToggles;
        // 通知设置
        private NotificationSettings notifications;
        // 安全设置
        private SecuritySettings security;
    }

    /**
     * 订阅计划
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SubscriptionPlan {
        private String id;
        private String name;
        private String description;
        private BigDecimal price;
        private String billingCycle; // MONTHLY, QUARTERLY, YEARLY
        private Integer userLimit;
        private Integer deviceLimit;
        private Long storageLimit;
        private Map<String, Boolean> features;
        private Boolean isActive;
    }

    /**
     * 系统限制
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SystemLimits {
        private Integer maxFactories;
        private Integer maxUsersPerFactory;
        private Integer maxDevicesPerFactory;
        private Long maxStoragePerFactory;
        private Integer maxApiCallsPerMinute;
        private Integer maxConcurrentUsers;
    }

    /**
     * 通知设置
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NotificationSettings {
        private Boolean emailEnabled;
        private Boolean pushEnabled;
        private List<String> adminEmails;
        private Map<String, Boolean> notificationTypes;
    }

    /**
     * 安全设置
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SecuritySettings {
        private Integer passwordMinLength;
        private Boolean requireUpperCase;
        private Boolean requireLowerCase;
        private Boolean requireNumbers;
        private Boolean requireSpecialChars;
        private Integer passwordExpiryDays;
        private Integer maxLoginAttempts;
        private Integer lockoutDuration;
        private Boolean twoFactorRequired;
    }

    /**
     * 批量操作请求
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BatchOperationRequest {
        @NotNull(message = "目标ID列表不能为空")
        @Size(min = 1, message = "至少选择一个目标")
        private List<String> targetIds;
        @NotBlank(message = "操作类型不能为空")
        private String operation; // ACTIVATE, SUSPEND, DELETE, EXPORT
        private String reason;
    }

    /**
     * 批量操作结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BatchOperationResult {
        private Integer totalCount;
        private Integer successCount;
        private Integer failedCount;
        private List<String> successIds;
        private List<FailedOperation> failedOperations;
        private LocalDateTime completedAt;
    }

    /**
     * 失败的操作
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FailedOperation {
        private String targetId;
        private String reason;
        private String errorCode;
    }
}
