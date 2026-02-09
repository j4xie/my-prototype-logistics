package com.cretas.aims.dto.smartbi;

import com.cretas.aims.entity.smartbi.enums.AlertLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 预警 DTO
 *
 * 用于表示 SmartBI 系统生成的业务预警信息，包括：
 * - 预警级别和类别
 * - 预警标题和消息
 * - 相关指标和阈值
 * - 建议操作
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Alert {

    /**
     * 预警ID
     * 自动生成的唯一标识
     */
    @Builder.Default
    private String id = UUID.randomUUID().toString();

    /**
     * 预警级别
     * GREEN: 正常, YELLOW: 关注, RED: 预警, CRITICAL: 严重
     */
    private AlertLevel level;

    /**
     * 预警类别
     * sales: 销售预警, finance: 财务预警, department: 部门预警
     */
    private String category;

    /**
     * 预警标题
     * 简洁的预警描述
     */
    private String title;

    /**
     * 预警消息
     * 详细的预警说明
     */
    private String message;

    /**
     * 相关指标名称
     * 触发预警的指标
     */
    private String metric;

    /**
     * 当前值
     * 指标的当前数值
     */
    private BigDecimal value;

    /**
     * 阈值
     * 触发预警的阈值
     */
    private BigDecimal threshold;

    /**
     * 差距百分比
     * 当前值与阈值的偏差百分比
     */
    private BigDecimal gapPercent;

    /**
     * 建议操作
     * 针对预警的处理建议
     */
    private String suggestion;

    /**
     * 相关实体ID
     * 触发预警的相关业务实体ID（如销售员ID、客户ID等）
     */
    private String relatedEntityId;

    /**
     * 相关实体名称
     * 触发预警的相关业务实体名称
     */
    private String relatedEntityName;

    /**
     * 创建时间
     */
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /**
     * 快速创建销售预警
     */
    public static Alert salesAlert(AlertLevel level, String title, String message,
                                    String metric, BigDecimal value, BigDecimal threshold,
                                    String suggestion) {
        return Alert.builder()
                .level(level)
                .category("sales")
                .title(title)
                .message(message)
                .metric(metric)
                .value(value)
                .threshold(threshold)
                .suggestion(suggestion)
                .build();
    }

    /**
     * 快速创建财务预警
     */
    public static Alert financeAlert(AlertLevel level, String title, String message,
                                      String metric, BigDecimal value, BigDecimal threshold,
                                      String suggestion) {
        return Alert.builder()
                .level(level)
                .category("finance")
                .title(title)
                .message(message)
                .metric(metric)
                .value(value)
                .threshold(threshold)
                .suggestion(suggestion)
                .build();
    }

    /**
     * 快速创建部门预警
     */
    public static Alert departmentAlert(AlertLevel level, String title, String message,
                                         String metric, BigDecimal value, BigDecimal threshold,
                                         String suggestion) {
        return Alert.builder()
                .level(level)
                .category("department")
                .title(title)
                .message(message)
                .metric(metric)
                .value(value)
                .threshold(threshold)
                .suggestion(suggestion)
                .build();
    }

    /**
     * 判断是否需要紧急处理
     *
     * @return 如果预警级别为 RED 或 CRITICAL 则返回 true
     */
    public boolean isUrgent() {
        return level != null && level.needsAction();
    }

    /**
     * 获取预警级别的字符串表示（用于前端兼容）
     *
     * @return 预警级别名称
     */
    public String getLevelName() {
        return level != null ? level.name() : "GREEN";
    }
}
