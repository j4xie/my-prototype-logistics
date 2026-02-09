package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 配置操作结果 DTO
 *
 * <p>用于统一返回 SmartBI 配置管理操作的结果，包括：
 * <ul>
 *   <li>意图配置操作结果</li>
 *   <li>告警阈值操作结果</li>
 *   <li>激励规则操作结果</li>
 *   <li>字段映射操作结果</li>
 *   <li>指标公式操作结果</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConfigOperationResult {

    /**
     * 操作是否成功
     */
    private boolean success;

    /**
     * 操作消息
     */
    private String message;

    /**
     * 操作返回的数据
     */
    private Object data;

    /**
     * 配置类型：INTENT, THRESHOLD, INCENTIVE_RULE, FIELD_MAPPING, METRIC_FORMULA
     */
    private String configType;

    /**
     * 操作时间戳
     */
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();

    /**
     * 操作类型：CREATE, UPDATE, DELETE, RELOAD
     */
    private String operationType;

    /**
     * 受影响的记录数
     */
    private Integer affectedCount;

    // ==================== 静态工厂方法 ====================

    /**
     * 创建成功结果
     */
    public static ConfigOperationResult success(String configType, String message) {
        return ConfigOperationResult.builder()
                .success(true)
                .configType(configType)
                .message(message)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * 创建成功结果（带数据）
     */
    public static ConfigOperationResult success(String configType, String message, Object data) {
        return ConfigOperationResult.builder()
                .success(true)
                .configType(configType)
                .message(message)
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * 创建成功结果（带操作类型和影响数量）
     */
    public static ConfigOperationResult success(String configType, String operationType,
                                                 String message, int affectedCount) {
        return ConfigOperationResult.builder()
                .success(true)
                .configType(configType)
                .operationType(operationType)
                .message(message)
                .affectedCount(affectedCount)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * 创建失败结果
     */
    public static ConfigOperationResult error(String configType, String message) {
        return ConfigOperationResult.builder()
                .success(false)
                .configType(configType)
                .message(message)
                .timestamp(LocalDateTime.now())
                .build();
    }

    // ==================== 配置类型常量 ====================

    public static final String CONFIG_TYPE_INTENT = "INTENT";
    public static final String CONFIG_TYPE_THRESHOLD = "THRESHOLD";
    public static final String CONFIG_TYPE_INCENTIVE_RULE = "INCENTIVE_RULE";
    public static final String CONFIG_TYPE_FIELD_MAPPING = "FIELD_MAPPING";
    public static final String CONFIG_TYPE_METRIC_FORMULA = "METRIC_FORMULA";
    public static final String CONFIG_TYPE_ALL = "ALL";

    // ==================== 操作类型常量 ====================

    public static final String OPERATION_CREATE = "CREATE";
    public static final String OPERATION_UPDATE = "UPDATE";
    public static final String OPERATION_DELETE = "DELETE";
    public static final String OPERATION_RELOAD = "RELOAD";
}
