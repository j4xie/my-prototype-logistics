package com.cretas.aims.entity.smartbi.enums;

/**
 * 预警级别枚举
 *
 * 用于标识业务指标的健康状态和预警等级：
 * - GREEN: 正常状态，无需关注
 * - YELLOW: 需要关注，存在潜在风险
 * - RED: 预警状态，需要采取行动
 * - CRITICAL: 严重预警，需要立即处理
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public enum AlertLevel {

    /**
     * 正常状态
     * 各项指标在健康范围内，无需特别关注
     */
    GREEN("正常", 0),

    /**
     * 关注状态
     * 指标接近阈值或有轻微异常，建议持续关注
     */
    YELLOW("关注", 1),

    /**
     * 预警状态
     * 指标已超出正常范围，需要采取措施
     */
    RED("预警", 2),

    /**
     * 严重预警状态
     * 指标严重异常，需要立即处理
     */
    CRITICAL("严重", 3);

    /**
     * 级别描述
     */
    private final String description;

    /**
     * 严重程度（数值越大越严重）
     */
    private final int severity;

    AlertLevel(String description, int severity) {
        this.description = description;
        this.severity = severity;
    }

    /**
     * 获取级别描述
     *
     * @return 级别描述
     */
    public String getDescription() {
        return description;
    }

    /**
     * 获取严重程度
     *
     * @return 严重程度值（0-3）
     */
    public int getSeverity() {
        return severity;
    }

    /**
     * 判断当前级别是否比另一个级别更严重
     *
     * @param other 另一个预警级别
     * @return 如果当前级别更严重则返回 true
     */
    public boolean isMoreSevereThan(AlertLevel other) {
        return this.severity > other.severity;
    }

    /**
     * 判断是否需要关注（YELLOW 及以上）
     *
     * @return 如果需要关注则返回 true
     */
    public boolean needsAttention() {
        return this.severity >= YELLOW.severity;
    }

    /**
     * 判断是否需要立即行动（RED 及以上）
     *
     * @return 如果需要立即行动则返回 true
     */
    public boolean needsAction() {
        return this.severity >= RED.severity;
    }

    /**
     * 判断是否为严重状态（CRITICAL）
     *
     * @return 如果是严重状态则返回 true
     */
    public boolean isCritical() {
        return this == CRITICAL;
    }

    /**
     * 根据严重程度值获取对应的预警级别
     *
     * @param severity 严重程度值
     * @return 对应的预警级别，默认返回 GREEN
     */
    public static AlertLevel fromSeverity(int severity) {
        for (AlertLevel level : values()) {
            if (level.severity == severity) {
                return level;
            }
        }
        return GREEN;
    }

    /**
     * 获取两个级别中更严重的一个
     *
     * @param a 级别 A
     * @param b 级别 B
     * @return 更严重的级别
     */
    public static AlertLevel max(AlertLevel a, AlertLevel b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.severity >= b.severity ? a : b;
    }
}
